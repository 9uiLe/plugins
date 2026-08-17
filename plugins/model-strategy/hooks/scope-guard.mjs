#!/usr/bin/env node
// scope-guard.mjs — conductor mode 専用の PreToolUse warn hook。
//
// route-warn.mjs (opt-in R1 直接実行 warn) とは別エントリ・別発火条件:
// MODEL_STRATEGY_MODE=conductor かつ、マニフェスト凍結時に conductor が書いた
// 基準線ファイル ${CLAUDE_PLUGIN_DATA}/scope-baseline-<session_id>.json
// ({manifestId, globs, contractHash}) が存在する場合のみ発火する
// (baseline の生成・破棄手順は skills/model-effort-guide/SKILL.md §3/§4)。
//
// route-warn との明確な差異: **agent_id があってもスキップしない**。
// route-warn はメインセッションの直接実行だけを対象にする (サブエージェント
// 呼び出し自体が委譲そのものだから) が、scope-guard は逆に
// sonnet-implementer 等サブエージェントの範囲外編集こそ検出対象であるため、
// agent_id の有無を判定に使わない。
//
// 既知の迂回 (08-conductor-mode.md に明記): Bash 経由のファイル書き込みは
// tool_input に file_path/notebook_path を持たないため観測できない。
// 「唯一の強制点」ではなく「部分的な機械照合」である。
//
// 判定ロジックは decideScopeGuard(input, env) として純関数に切り出し、CLI 部
// (stdin 読み取り・stdout 書き込み・exit) と分離してテスト可能にする。

import fs from "node:fs";
import path from "node:path";

function scopeWarnMessage(filePath) {
  return (
    `[model-strategy scope-guard] "${filePath}" はマニフェスト凍結時の変更可能範囲 (glob) 外です。` +
    "SCOPE_EXPANSION として記録し、replan または judge への相談を検討してください " +
    "(既知の迂回: Bash 経由の書き込みは検出できません)。"
  );
}

// glob → RegExp。依存追加なしの自前変換で `*` (単一パス要素内の任意文字列) と
// `**` (パス区切りをまたぐ任意文字列) のみサポートする (仕様が要求する最小形)。
function globToRegExp(glob) {
  let pattern = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        pattern += ".*";
        i += 1;
        if (glob[i + 1] === "/") i += 1; // '**/' は 0 階層にもマッチさせる
      } else {
        pattern += "[^/]*";
      }
    } else if ("\\^$.|?+()[]{}".includes(c)) {
      pattern += `\\${c}`;
    } else {
      pattern += c;
    }
  }
  return new RegExp(`^${pattern}$`);
}

// baseline の globs はリポジトリルート相対パスで書く規約 (SKILL.md §3)。
// tool_input の file_path は通常絶対パスなので、cwd 相対化した形と生の形の
// 両方を試す (絶対 glob・非標準 cwd でも取りこぼさないための保険)。
function matchesAnyGlob(filePath, globs) {
  const relative = path.isAbsolute(filePath) ? path.relative(process.cwd(), filePath) : filePath;
  const candidates = new Set([filePath, relative]);
  return globs.some((glob) => {
    const re = globToRegExp(glob);
    for (const candidate of candidates) {
      if (re.test(candidate)) return true;
    }
    return false;
  });
}

// baseline ファイル読み取り: 存在しない/壊れている場合は「基準線なし」と同じ
// 扱いで黙る (発火条件そのものが「存在する場合のみ」であるため)。
function readBaseline(dataDir, sessionId) {
  try {
    const baselinePath = path.join(dataDir, `scope-baseline-${sessionId}.json`);
    if (!fs.existsSync(baselinePath)) return null;
    const raw = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    if (!Array.isArray(raw?.globs)) return null;
    return raw;
  } catch {
    return null;
  }
}

// (session_id, file_path) につき 1 回だけ警告する。route-warn.mjs と同機構:
// 状態は CLAUDE_PLUGIN_DATA 配下にのみ置き (/tmp フォールバックはしない)、
// 読み書きに失敗したら抑制なしで警告を出して続行する (fail-open)。
function alreadyWarned(dataDir, sessionId, filePath) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const statePath = path.join(dataDir, `scope-guard-${sessionId}.json`);
    let warned = [];
    if (fs.existsSync(statePath)) {
      const raw = JSON.parse(fs.readFileSync(statePath, "utf8"));
      warned = Array.isArray(raw.warned) ? raw.warned : [];
    }
    if (warned.includes(filePath)) return true;
    warned.push(filePath);
    fs.writeFileSync(statePath, JSON.stringify({ warned }), "utf8");
    return false;
  } catch {
    return false;
  }
}

export function decideScopeGuard(input, env) {
  if (env.MODEL_STRATEGY_MODE !== "conductor") return null;

  const sessionId = input?.session_id;
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (!sessionId || !dataDir) return null;

  const baseline = readBaseline(dataDir, sessionId);
  if (!baseline) return null; // 基準線なし = 発火条件を満たさない (仕様どおりの不活性)

  const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (typeof filePath !== "string" || !filePath) return null;

  if (matchesAnyGlob(filePath, baseline.globs)) return null; // 範囲内
  if (alreadyWarned(dataDir, sessionId, filePath)) return null;

  return { filePath, message: scopeWarnMessage(filePath) };
}

function readStdinInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function main() {
  if (process.argv[1] !== new URL(import.meta.url).pathname) return;
  try {
    const input = readStdinInput();
    const decision = decideScopeGuard(input, process.env);
    if (decision) {
      process.stdout.write(
        `${JSON.stringify({
          hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: decision.message }
        })}\n`
      );
    }
  } catch {
    // hook 障害でセッションを壊さない (fail-open): いかなる異常でも exit 0。
  }
  process.exit(0);
}

main();
