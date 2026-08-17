#!/usr/bin/env node
// route-policy.mjs — 操作ルーティングの正本 (P0〜R4)。
//
// 先勝ちの順序付きルール列で、単一の操作記述子を担当ルールに割り当てる
// (routeOperation) のと、委譲マニフェストの整合性を監査する (auditManifest)
// の 2 役を 1 ファイルに持つ。plugins/second-opinion/scripts/challenge-guard.mjs
// と同じ流儀 (export 関数 + stdin JSON CLI + node:test) を踏襲する。
//
// ルール表そのものがルーティングの正本。references/02-decision-matrix.md は
// 解説であり、tests/route-policy.test.mjs の 02 同期テストでドリフトを検知する。
//
// v0.3.0 (conductor mode): MODEL_STRATEGY_MODE=conductor のとき、R4 は
// ctx (会話文脈が本体) / R4a (判断パケット完結) / R4b (パケット未完結・上位
// セッション昇格) の 3 サブタイプに機械分岐する。詳細・限界は
// references/08-conductor-mode.md。mode 省略時は judge-main で v0.2.0 と
// 完全に同一の出力 (後方互換)。

import fs from "node:fs";

// RULES: 各要素は { id, title, assignee: { claude, codex } }。
// R1/R2 で claude 側 assignee (haiku-scout) が重複するのは仕様どおり
// (探索と既知検証手順の実行を、どちらも haiku-scout に委譲する)。
export const RULES = [
  {
    id: "P0",
    title: "対象外ゲート — 外向き・破壊的・履歴改変操作",
    assignee: { claude: "approval-gate", codex: "approval-gate" }
  },
  {
    id: "R0",
    title: "単発直接実行 — diff を生まない許可リスト内の単発読み取り",
    assignee: { claude: "main-direct", codex: "main-direct" }
  },
  {
    id: "R1",
    title: "取得・列挙・抽出 — 意味解釈を要しない探索",
    assignee: { claude: "haiku-scout", codex: "luna-mini" }
  },
  {
    id: "R2",
    title: "既知検証手順の実行 — 事前確定コマンドの実行と事実報告",
    assignee: { claude: "haiku-scout", codex: "luna-mini" }
  },
  {
    id: "R3",
    title: "構造化契約付き変更 — 4 フィールド仕様を渡した実装委譲",
    assignee: { claude: "sonnet-implementer", codex: "terra" }
  },
  {
    id: "R4",
    title: "デフォルト — 判断・曖昧さの解消・仕様が書き切れない作業",
    assignee: { claude: "main", codex: "sol" }
  }
];

// conductor mode の R4-ctx 閉じた許可リスト (裁定 D 修正 / round2-fable.md)。
// リスト外の ctxClass 自称は自己分類による error 回避を許さない (finding
// INVALID_CTX_CLASS + 判断型として CONDUCTOR_EXECUTED_R4 の判定対象に含める)。
export const CTX_CLASSES = ["commit-authoring", "user-communication"];

// R4a (closed) の判断パケット必須 6 フィールド。R3 の missingSpecFields と
// 同型の非空チェック (nonEmptyString) で完結性を判定する。
const PACKET_FIELDS = ["question", "options", "evidencePointers", "constraints", "acceptanceCriteria", "impactScope"];

const SEARCH_LIKE_KINDS = new Set(["search", "enumerate", "read"]);
const R0_KINDS = new Set(["read", "enumerate"]);
const SPEC_FIELDS = ["target", "expectedResult", "allowedScope", "verification"];
const MODE_VALUES = new Set(["conductor", "judge-main"]);
const MODE_SOURCE_VALUES = new Set(["env", "user-instruction", "default"]);

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function ruleById(id) {
  return RULES.find((rule) => rule.id === id);
}

function finalize(ruleId, reasons) {
  return { rule: ruleId, assignee: ruleById(ruleId).assignee, reasons };
}

// R0〜R3 それぞれについて「どの条件が N だったか」を 1 行で返す (満たしていれば null)。
// R4 に落ちた場合の reasons は、この 4 行のうち非 null のものを機械生成で並べる。
function r0Reason({ producesDiff, singleShot, allowlistedCommand, kind }) {
  if (producesDiff) return "R0: producesDiff=true";
  if (!singleShot) return "R0: singleShot=false (連鎖のため単発直接実行の対象外)";
  if (!allowlistedCommand) return "R0: allowlistedCommand=false (許可リスト外)";
  if (!R0_KINDS.has(kind)) return `R0: kind="${kind}" は read/enumerate ではない`;
  return null;
}

function r1Reason({ producesDiff, interpretationRequired, kind }) {
  if (producesDiff) return "R1: producesDiff=true";
  if (interpretationRequired) return "R1: interpretationRequired=true (意味解釈を要するため対象外)";
  if (!SEARCH_LIKE_KINDS.has(kind)) return `R1: kind="${kind}" は search/enumerate/read のいずれでもない`;
  return null;
}

function r2Reason({ interpretationRequired, kind }) {
  if (kind !== "execute-verification") return `R2: kind="${kind}" は execute-verification ではない`;
  if (interpretationRequired) return "R2: interpretationRequired=true (事実報告を超えるため対象外)";
  return null;
}

function r3Reason({ producesDiff, missingSpecFields }) {
  if (!producesDiff) return "R3: producesDiff=false";
  if (missingSpecFields.length > 0) return `R3: spec の必須フィールドが空: ${missingSpecFields.join(", ")}`;
  return null;
}

// deriveR4Subtype: R4 操作記述子 (routeOperation の op、または auditManifest の
// task 行) の ctxClass/packet/dependsOn から R4 のサブタイプを機械導出する。
// conductor の自由分類を許さない (裁定D修正: ctxClass は閉じた enum 所属判定のみ)。
//
// 戻り値: { subtype: "R4-ctx"|"R4a"|"R4b", ctxClassInvalid, missingPacketFields }
// ctxClassInvalid=true の場合、subtype は enum 外主張を無視して判断型 (R4a/R4b)
// として評価される (自己分類による CONDUCTOR_EXECUTED_R4 回避を許さないため)。
function deriveR4Subtype({ ctxClass, packet, dependsOn } = {}) {
  const ctxClassProvided = nonEmptyString(ctxClass);
  const ctxClassValid = ctxClassProvided && CTX_CLASSES.includes(ctxClass);
  const ctxClassInvalid = ctxClassProvided && !ctxClassValid;

  if (ctxClassValid) {
    return { subtype: "R4-ctx", ctxClassInvalid: false, missingPacketFields: [] };
  }

  const packetFields = packet || {};
  const missingPacketFields = PACKET_FIELDS.filter((field) => !nonEmptyString(packetFields[field]));
  const dependsOnList = Array.isArray(dependsOn) ? dependsOn : [];
  const closed = missingPacketFields.length === 0 && dependsOnList.length === 0;

  return { subtype: closed ? "R4a" : "R4b", ctxClassInvalid, missingPacketFields };
}

// routeOperation: 操作記述子 → { rule, assignee, reasons }。
// 先勝ち評価: outward → P0 / R0 条件 / R1 条件 / R2 条件 / R3 条件 / それ以外 R4。
//
// 第 2 引数 { mode } 省略時は judge-main として扱い、v0.2.0 と完全同一の
// 出力 (subtype キーなし・assignee は RULES の { claude, codex } のまま) を返す
// (後方互換)。mode="conductor" のときのみ R4 の戻り値に subtype を追加し、
// assignee を ctx="main" / R4a="judge" / R4b="session-escalation" に分岐する。
export function routeOperation(op, { mode } = {}) {
  const producesDiff = op?.producesDiff === true;
  const outward = op?.outward === true;
  const interpretationRequired = op?.interpretationRequired === true;
  const singleShot = op?.singleShot === true;
  const allowlistedCommand = op?.allowlistedCommand === true;
  const kind = op?.kind;
  const spec = op?.spec || {};
  const missingSpecFields = SPEC_FIELDS.filter((field) => !nonEmptyString(spec[field]));

  const ctx = { producesDiff, interpretationRequired, singleShot, allowlistedCommand, kind, missingSpecFields };

  if (outward) return finalize("P0", []);
  if (r0Reason(ctx) === null) return finalize("R0", []);
  if (r1Reason(ctx) === null) return finalize("R1", []);
  if (r2Reason(ctx) === null) return finalize("R2", []);
  if (r3Reason(ctx) === null) return finalize("R3", []);

  const reasons = [r0Reason(ctx), r1Reason(ctx), r2Reason(ctx), r3Reason(ctx)].filter((reason) => reason !== null);

  if (mode !== "conductor") return finalize("R4", reasons);

  const { subtype } = deriveR4Subtype(op || {});
  const assignee = subtype === "R4-ctx" ? "main" : subtype === "R4a" ? "judge" : "session-escalation";
  return { rule: "R4", assignee, reasons, subtype };
}

const KNOWN_RULE_IDS = new Set(RULES.map((rule) => rule.id));

function findingItem(code, ref, message) {
  return { code, ref: ref ?? null, message };
}

// auditManifest: 委譲マニフェスト JSON → { status: 'PASS'|'FINDINGS', findings }。
// findings ありでも実行ブロックではない (情報提供)。
//
// v0.3.0: manifest.mode が "conductor"/"judge-main" のいずれかを明示した場合に
// 限り mode 対応の検査 (MODE_MODEL_MISMATCH / MISSING_MODE_FIELDS / R4 サブタイプ
// 系 / MISSING_BASELINE) を追加する。manifest.mode が未設定 (v0.2.0 マニフェスト)
// のときはこれらを一切評価しない — 後方互換の根拠 (mode 宣言なし = 判定対象外)。
export function auditManifest(manifest) {
  const tasks = Array.isArray(manifest?.tasks) ? manifest.tasks : [];
  const findings = [];
  const mode = manifest?.mode;
  const conductorMode = mode === "conductor";

  for (const task of tasks) {
    const ref = task?.id ?? null;

    if (!KNOWN_RULE_IDS.has(task?.rule)) {
      findings.push(findingItem("UNKNOWN_RULE", ref, `未知の rule ID: ${task?.rule}`));
      continue;
    }

    // conductor mode の R4 行のみサブタイプを機械導出する。ctxClass/packet/
    // dependsOn は task 行にそのまま記録されている前提 (routeOperation と同型)。
    let judgmentType = false;
    let suppressUndocumented = false;
    if (conductorMode && task.rule === "R4") {
      const { subtype, ctxClassInvalid } = deriveR4Subtype(task);
      judgmentType = subtype !== "R4-ctx";

      // enum 外の ctxClass 主張は、error 回避のための自己分類を許さない
      // (裁定D修正) — INVALID_CTX_CLASS を発火させたうえで判断型として扱う
      // (judgmentType は deriveR4Subtype が既に enum 外を判断型に落としている)。
      if (ctxClassInvalid) {
        findings.push(findingItem("INVALID_CTX_CLASS", ref, `ctxClass "${task.ctxClass}" は CTX_CLASSES に含まれない`));
      }

      // CONDUCTOR_EXECUTED_R4: 判断型 R4 (ctx 以外) を conductor/main が実行した
      // 場合は error 級・deviationNote による正当化不可 (裁定 C)。同一行の
      // UNDOCUMENTED_DEVIATION は重複報告のため抑制する。
      if (judgmentType && (task.actualAssignee === "conductor" || task.actualAssignee === "main")) {
        findings.push(
          findingItem(
            "CONDUCTOR_EXECUTED_R4",
            ref,
            `判断型 R4 行 (subtype=${subtype}) を conductor/main が実行した (actualAssignee: ${task.actualAssignee})`
          )
        );
        suppressUndocumented = true;
      }

      // MISSING_JUDGE_REF: R4a (closed) 行は judgeRef {agent, requestedModel,
      // resultSummary} (effort は任意) を必須とする。
      if (subtype === "R4a") {
        const judgeRef = task.judgeRef || {};
        if (!nonEmptyString(judgeRef.agent) || !nonEmptyString(judgeRef.requestedModel) || !nonEmptyString(judgeRef.resultSummary)) {
          findings.push(findingItem("MISSING_JUDGE_REF", ref, "R4a 行に judgeRef (agent/requestedModel/resultSummary) が欠落"));
        }
      }
    }

    if (!suppressUndocumented && task.plannedAssignee !== task.actualAssignee && !nonEmptyString(task.deviationNote)) {
      findings.push(
        findingItem(
          "UNDOCUMENTED_DEVIATION",
          ref,
          `plannedAssignee (${task.plannedAssignee}) と actualAssignee (${task.actualAssignee}) が異なるが deviationNote がない`
        )
      );
    }

    if (task.rule === "R4" && !nonEmptyString(task.r4Reason)) {
      findings.push(findingItem("MISSING_R4_REASON", ref, "R4 行に r4Reason がない"));
    }

    if (task.rule === "R3") {
      const specFields = task.specFields || {};
      const missing = SPEC_FIELDS.filter((field) => !nonEmptyString(specFields[field]));
      if (missing.length > 0) {
        findings.push(findingItem("INCOMPLETE_R3_SPEC", ref, `R3 行に specFields が欠落: ${missing.join(", ")}`));
      }

      // DANGLING_SPEC: contractRef (タスク受け入れ基準への参照) は R3 行に必須。
      // 宙吊り仕様 (受け入れ基準を参照しない R3) を検出する。
      if (!nonEmptyString(task.contractRef)) {
        findings.push(findingItem("DANGLING_SPEC", ref, "R3 行に contractRef (タスク受け入れ基準への参照) がない"));
      }

      // UNFALSIFIABLE_VERIFICATION: 完了した R3 行は verificationRef で
      // マニフェスト内の R2 行 id を参照しなければならない (「目視で確認」の排除)。
      if (task.status === "completed") {
        const verificationRef = task.verificationRef;
        const target = nonEmptyString(verificationRef) ? tasks.find((candidate) => candidate?.id === verificationRef) : null;
        if (!target || target.rule !== "R2") {
          findings.push(
            findingItem(
              "UNFALSIFIABLE_VERIFICATION",
              ref,
              "完了した R3 行の verificationRef が、マニフェスト内の R2 行を指していない"
            )
          );
        }
      }

      // SCOPE_EXPANSION (②): 凍結後に追加された R3 行 (producesDiff 行追加) は、
      // 正当な replan として deviationNote が記録されていない限り audit failure。
      if (task.addedAfterFreeze === true && !nonEmptyString(task.deviationNote)) {
        findings.push(findingItem("SCOPE_EXPANSION", ref, "凍結後に追加された R3 行に replan の記録 (deviationNote) がない"));
      }
    }

    if (task.rule === "P0" && (nonEmptyString(task.plannedAssignee) || nonEmptyString(task.actualAssignee))) {
      findings.push(findingItem("P0_HAS_ASSIGNEE", ref, "P0 行 (対象外ゲート) が assignee を持つ"));
    }
  }

  // マニフェスト全体に対する検査 (mode/modeSource/sessionModel/baseline/contractHash)。
  // manifest.mode が未設定 (v0.2.0 マニフェスト) の場合はここを一切評価しない。
  if (mode !== undefined) {
    const validMode = MODE_VALUES.has(mode);
    const validModeSource = MODE_SOURCE_VALUES.has(manifest.modeSource);
    const validSessionModel = nonEmptyString(manifest.sessionModel);
    if (!validMode || !validModeSource || !validSessionModel) {
      findings.push(findingItem("MISSING_MODE_FIELDS", null, "manifest の mode/modeSource/sessionModel が不完全または不正"));
    }

    const sessionModel = validSessionModel ? manifest.sessionModel.toLowerCase() : "";
    const mismatch =
      (mode === "conductor" && (sessionModel.includes("opus") || sessionModel.includes("fable"))) ||
      (mode === "judge-main" && sessionModel.includes("sonnet"));
    if (mismatch) {
      findings.push(
        findingItem("MODE_MODEL_MISMATCH", null, `mode=${mode} と sessionModel="${manifest.sessionModel}" が整合しない`)
      );
    }

    if (conductorMode) {
      const hasR3 = tasks.some((task) => task?.rule === "R3");
      if (hasR3 && !manifest.baseline) {
        findings.push(findingItem("MISSING_BASELINE", null, "mode=conductor かつ R3 行が存在するが baseline がマニフェストに記録されていない"));
      }
    }
  }

  // SCOPE_EXPANSION (③): baseline.contractHash と現在の contractHash の乖離。
  if (manifest?.baseline && nonEmptyString(manifest.baseline.contractHash) && nonEmptyString(manifest?.currentContractHash)) {
    if (manifest.baseline.contractHash !== manifest.currentContractHash) {
      findings.push(findingItem("SCOPE_EXPANSION", null, "baseline.contractHash と currentContractHash が一致しない (contract 変化)"));
    }
  }

  return { status: findings.length === 0 ? "PASS" : "FINDINGS", findings };
}

// verifyEvidence: { items: [{ file, line, quote }] } → 各 quote が file に文字どおり
// (exact substring) 存在するか検査する。存在すれば実際の行番号 (1 始まり) と
// 申告 line とのズレを返し、無ければ found=false で報告する。幻覚引用・stale
// 引用の機械検出 (裁定 A の「引用実在検査」)。
export function verifyEvidence(input) {
  const items = Array.isArray(input?.items) ? input.items : [];

  const results = items.map((item) => {
    const file = item?.file;
    const line = item?.line;
    const quote = item?.quote;

    if (!nonEmptyString(file) || !nonEmptyString(quote)) {
      return { file: file ?? null, line: line ?? null, quote: quote ?? null, found: false, actualLine: null, lineDrift: null, error: "file/quote が空" };
    }

    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch (error) {
      return { file, line: line ?? null, quote, found: false, actualLine: null, lineDrift: null, error: `ファイル読み取り失敗: ${error.message}` };
    }

    const idx = content.indexOf(quote);
    if (idx === -1) {
      return { file, line: line ?? null, quote, found: false, actualLine: null, lineDrift: null };
    }

    const actualLine = content.slice(0, idx).split("\n").length;
    const lineDrift = typeof line === "number" ? actualLine - line : null;
    return { file, line: line ?? null, quote, found: true, actualLine, lineDrift };
  });

  const allFound = results.length > 0 && results.every((result) => result.found);
  return { status: allFound ? "PASS" : "FAIL", items: results };
}

function usage() {
  process.stderr.write("usage: route-policy.mjs <route|audit|verify-evidence> < input.json\n");
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function main() {
  if (process.argv[1] !== new URL(import.meta.url).pathname) return;
  const sub = process.argv[2];
  if (sub !== "route" && sub !== "audit" && sub !== "verify-evidence") {
    usage();
    process.exitCode = sub ? 1 : 0;
    return;
  }

  let input;
  try {
    input = await readStdinJson();
  } catch (error) {
    process.stderr.write(`route-policy: invalid JSON input: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  if (sub === "route") {
    // mode は MODEL_STRATEGY_MODE env の閉じた enum (conductor|judge-main) を
    // そのまま渡す。それ以外の値 (未設定含む) は routeOperation 側で judge-main
    // 扱いにフォールバックする (無効値のマニフェスト記録検証は audit の役目)。
    const mode = process.env.MODEL_STRATEGY_MODE === "conductor" ? "conductor" : "judge-main";
    const result = routeOperation(input, { mode });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    // findings/R4 は情報提供であり実行ブロックではないため、パースに成功した
    // 限り常に exit 0 (route-warn.mjs や second-opinion のゲート系スクリプトと
    // 異なり、route-policy は許可判定ではなくルーターであるため)。
    process.exitCode = 0;
    return;
  }

  if (sub === "audit") {
    const result = auditManifest(input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 0;
    return;
  }

  // verify-evidence は route/audit と異なり真偽判定ツールであるため、
  // challenge-guard.mjs 等と同じく判定結果を exit code にも反映する。
  const result = verifyEvidence(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "PASS" ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(`route-policy: ${error.message}\n`);
  process.exitCode = 2;
});
