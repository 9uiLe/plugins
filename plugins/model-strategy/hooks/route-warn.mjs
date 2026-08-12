#!/usr/bin/env node
// route-warn.mjs — opt-in PreToolUse warn hook (facts-hooks.md / facts-statusline.md 準拠)。
//
// 既定は完全に不活性 (MODEL_STRATEGY_ROUTE_WARN=1 を settings.json の env で
// 明示した場合のみ動作)。メインセッション (agent_id 不在。公式に documented な
// サブエージェント判別子) が R1 相当 (探索・列挙・抽出) の操作を直接実行しようと
// した最初の 1 回だけ、additionalContext に 1 行の委譲検討メッセージを注入する。
// permissionDecision は出力しない — deny (許可フローへの介入) は裁定で不採用。
//
// 判定ロジックは decideWarn(input, env) として純関数に切り出し、CLI 部
// (stdin 読み取り・stdout 書き込み・exit) と分離してテスト可能にする。

import fs from "node:fs";
import path from "node:path";

const WARN_MESSAGE =
  "[model-strategy R1] メインセッションが探索系操作を直接実行しようとしています。" +
  "結論だけ必要なら haiku-scout への委譲を検討してください " +
  "(opt-out: MODEL_STRATEGY_ROUTE_WARN を外す)";

const GREP_LIKE_BINS = new Set(["grep", "rg", "fd", "find"]);

// Bash コマンド文字列の先頭トークンだけを見る軽量ヒューリスティック。シェルの
// 完全解析はしない (warn-only なので誤検知コストは 1 行の注入で済む)。rtk /
// rtk proxy のラッパー越しでも同じ判定になるよう、先頭のそれらを剥がしてから見る。
function isGrepLikeBashCommand(command) {
  if (typeof command !== "string" || !command.trim()) return false;
  const tokens = command.trim().split(/\s+/);
  let i = 0;
  if (tokens[i] === "rtk") {
    i += 1;
    if (tokens[i] === "proxy") i += 1;
  }
  if (GREP_LIKE_BINS.has(tokens[i])) return true;
  if (tokens[i] === "git" && tokens[i + 1] === "grep") return true;
  return false;
}

function isWarnCandidate(input) {
  const toolName = input?.tool_name;
  if (toolName === "Grep" || toolName === "Glob") return true;
  if (toolName === "Bash") return isGrepLikeBashCommand(input?.tool_input?.command);
  return false;
}

// (session_id, tool_name) につき 1 回だけ警告する。状態は CLAUDE_PLUGIN_DATA
// 配下にのみ置く (facts-statusline.md §3: プラグイン提供の command hook には常に
// export される)。/tmp へのフォールバックはしない — world-writable な共有ディレク
// トリへの予測可能パス書き込みは、他ユーザーの先取り (同名ファイル/symlink) で
// hook が壊れる失敗モードを持ち、insecure temporary file としてマージブロッカー
// になる蓋然性が高い (round2-fable.md 裁定 A 修正)。ディレクトリ実体は初回参照時
// 作成のため mkdir -p 相当の防御を入れ、作成・書き込みに失敗したら抑制なしで
// 警告を出して続行する (fail-open)。
function alreadyWarned(env, sessionId, toolName) {
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (!dataDir || !sessionId) return false;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const statePath = path.join(dataDir, `route-warn-${sessionId}.json`);
    let warned = [];
    if (fs.existsSync(statePath)) {
      const raw = JSON.parse(fs.readFileSync(statePath, "utf8"));
      warned = Array.isArray(raw.warned) ? raw.warned : [];
    }
    if (warned.includes(toolName)) return true;
    warned.push(toolName);
    fs.writeFileSync(statePath, JSON.stringify({ warned }), "utf8");
    return false;
  } catch {
    return false;
  }
}

export function decideWarn(input, env) {
  if (env.MODEL_STRATEGY_ROUTE_WARN !== "1") return false;
  if (input?.agent_id) return false; // サブエージェント内での発火は対象外 (documented な判別子)
  if (!isWarnCandidate(input)) return false;
  if (alreadyWarned(env, input?.session_id, input?.tool_name)) return false;
  return true;
}

function readStdinInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function main() {
  if (process.argv[1] !== new URL(import.meta.url).pathname) return;
  try {
    const input = readStdinInput();
    if (decideWarn(input, process.env)) {
      process.stdout.write(
        `${JSON.stringify({
          hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: WARN_MESSAGE }
        })}\n`
      );
    }
  } catch {
    // hook 障害でセッションを壊さない (fail-open): いかなる異常でも exit 0。
  }
  process.exit(0);
}

main();
