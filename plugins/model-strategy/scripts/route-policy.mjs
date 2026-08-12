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

const SEARCH_LIKE_KINDS = new Set(["search", "enumerate", "read"]);
const R0_KINDS = new Set(["read", "enumerate"]);
const SPEC_FIELDS = ["target", "expectedResult", "allowedScope", "verification"];

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

// routeOperation: 操作記述子 → { rule, assignee, reasons }。
// 先勝ち評価: outward → P0 / R0 条件 / R1 条件 / R2 条件 / R3 条件 / それ以外 R4。
export function routeOperation(op) {
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
  return finalize("R4", reasons);
}

const KNOWN_RULE_IDS = new Set(RULES.map((rule) => rule.id));

function findingItem(code, ref, message) {
  return { code, ref: ref ?? null, message };
}

// auditManifest: 委譲マニフェスト JSON → { status: 'PASS'|'FINDINGS', findings }。
// findings ありでも実行ブロックではない (情報提供)。
export function auditManifest(manifest) {
  const tasks = Array.isArray(manifest?.tasks) ? manifest.tasks : [];
  const findings = [];

  for (const task of tasks) {
    const ref = task?.id ?? null;

    if (!KNOWN_RULE_IDS.has(task?.rule)) {
      findings.push(findingItem("UNKNOWN_RULE", ref, `未知の rule ID: ${task?.rule}`));
      continue;
    }

    if (task.plannedAssignee !== task.actualAssignee && !nonEmptyString(task.deviationNote)) {
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
    }

    if (task.rule === "P0" && (nonEmptyString(task.plannedAssignee) || nonEmptyString(task.actualAssignee))) {
      findings.push(findingItem("P0_HAS_ASSIGNEE", ref, "P0 行 (対象外ゲート) が assignee を持つ"));
    }
  }

  return { status: findings.length === 0 ? "PASS" : "FINDINGS", findings };
}

function usage() {
  process.stderr.write("usage: route-policy.mjs <route|audit> < input.json\n");
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function main() {
  if (process.argv[1] !== new URL(import.meta.url).pathname) return;
  const sub = process.argv[2];
  if (sub !== "route" && sub !== "audit") {
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

  const result = sub === "route" ? routeOperation(input) : auditManifest(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  // findings/R4 は情報提供であり実行ブロックではないため、パースに成功した
  // 限り常に exit 0 (route-warn.mjs や second-opinion のゲート系スクリプトと
  // 異なり、route-policy は許可判定ではなくルーターであるため)。
  process.exitCode = 0;
}

main().catch((error) => {
  process.stderr.write(`route-policy: ${error.message}\n`);
  process.exitCode = 2;
});
