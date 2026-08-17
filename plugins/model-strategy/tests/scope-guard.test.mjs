import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { decideScopeGuard } from "../hooks/scope-guard.mjs";

const CONDUCTOR_ENV_BASE = { MODEL_STRATEGY_MODE: "conductor" };

function editInput(filePath, overrides = {}) {
  return { session_id: "s1", tool_name: "Edit", tool_input: { file_path: filePath }, ...overrides };
}

function writeBaseline(dataDir, sessionId, baseline) {
  fs.writeFileSync(path.join(dataDir, `scope-baseline-${sessionId}.json`), JSON.stringify(baseline), "utf8");
}

function tmpDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "model-strategy-scope-guard-"));
}

test("decideScopeGuard: MODEL_STRATEGY_MODE=conductor でなければ発火しない (env off)", () => {
  const dataDir = tmpDataDir();
  writeBaseline(dataDir, "s1", { manifestId: "m1", globs: ["plugins/model-strategy/**"], contractHash: "h1" });
  const env = { CLAUDE_PLUGIN_DATA: dataDir };
  assert.equal(decideScopeGuard(editInput("plugins/other/foo.mjs"), env), null);
});

test("decideScopeGuard: conductor mode でも baseline ファイルが無ければ発火しない", () => {
  const dataDir = tmpDataDir();
  const env = { ...CONDUCTOR_ENV_BASE, CLAUDE_PLUGIN_DATA: dataDir };
  assert.equal(decideScopeGuard(editInput("plugins/other/foo.mjs"), env), null);
});

test("decideScopeGuard: 範囲内の編集 (glob に一致) は発火しない", () => {
  const dataDir = tmpDataDir();
  writeBaseline(dataDir, "s1", { manifestId: "m1", globs: ["plugins/model-strategy/**"], contractHash: "h1" });
  const env = { ...CONDUCTOR_ENV_BASE, CLAUDE_PLUGIN_DATA: dataDir };
  assert.equal(decideScopeGuard(editInput("plugins/model-strategy/scripts/route-policy.mjs"), env), null);
});

test("decideScopeGuard: 範囲外の編集は SCOPE_EXPANSION 警告を返す", () => {
  const dataDir = tmpDataDir();
  writeBaseline(dataDir, "s1", { manifestId: "m1", globs: ["plugins/model-strategy/**"], contractHash: "h1" });
  const env = { ...CONDUCTOR_ENV_BASE, CLAUDE_PLUGIN_DATA: dataDir };
  const decision = decideScopeGuard(editInput("plugins/second-opinion/scripts/second-opinion.mjs"), env);
  assert.ok(decision, "範囲外編集は警告を返す必要がある");
  assert.equal(decision.filePath, "plugins/second-opinion/scripts/second-opinion.mjs");
  assert.match(decision.message, /SCOPE_EXPANSION/);
});

test("decideScopeGuard: agent_id があってもスキップしない (route-warn との差異)", () => {
  const dataDir = tmpDataDir();
  writeBaseline(dataDir, "s1", { manifestId: "m1", globs: ["plugins/model-strategy/**"], contractHash: "h1" });
  const env = { ...CONDUCTOR_ENV_BASE, CLAUDE_PLUGIN_DATA: dataDir };
  const decision = decideScopeGuard(editInput("plugins/second-opinion/scripts/second-opinion.mjs", { agent_id: "sonnet-implementer-1" }), env);
  assert.ok(decision, "agent_id があっても範囲外編集は検出対象");
});

test("decideScopeGuard: glob 変換 — ** はパス区切りをまたぎ、* は 1 階層のみ", () => {
  const dataDir = tmpDataDir();
  writeBaseline(dataDir, "s1", { manifestId: "m1", globs: ["plugins/model-strategy/references/*.md"], contractHash: "h1" });
  const env = { ...CONDUCTOR_ENV_BASE, CLAUDE_PLUGIN_DATA: dataDir };
  // 1 階層の * に一致
  assert.equal(decideScopeGuard(editInput("plugins/model-strategy/references/08-conductor-mode.md"), env), null);
  // * は '/' をまたがないので、深い階層は別セッションで範囲外と判定される
  const dataDir2 = tmpDataDir();
  writeBaseline(dataDir2, "s2", { manifestId: "m1", globs: ["plugins/model-strategy/references/*.md"], contractHash: "h1" });
  const env2 = { ...CONDUCTOR_ENV_BASE, CLAUDE_PLUGIN_DATA: dataDir2 };
  const decision = decideScopeGuard(editInput("plugins/model-strategy/references/nested/deep.md", { session_id: "s2" }), env2);
  assert.ok(decision, "* は '/' をまたがないため深い階層は範囲外");
});

test("decideScopeGuard: 重複抑制 — 同一 (session, file_path) の 2 回目以降は warn しない", () => {
  const dataDir = tmpDataDir();
  writeBaseline(dataDir, "s1", { manifestId: "m1", globs: ["plugins/model-strategy/**"], contractHash: "h1" });
  const env = { ...CONDUCTOR_ENV_BASE, CLAUDE_PLUGIN_DATA: dataDir };
  const input = editInput("plugins/second-opinion/scripts/second-opinion.mjs");
  assert.ok(decideScopeGuard(input, env), "1 回目は warn する");
  assert.equal(decideScopeGuard(input, env), null, "2 回目 (同一 session, file_path) は warn しない");
});

test("decideScopeGuard: 同一セッションでも別ファイルなら再度 warn する", () => {
  const dataDir = tmpDataDir();
  writeBaseline(dataDir, "s1", { manifestId: "m1", globs: ["plugins/model-strategy/**"], contractHash: "h1" });
  const env = { ...CONDUCTOR_ENV_BASE, CLAUDE_PLUGIN_DATA: dataDir };
  assert.ok(decideScopeGuard(editInput("plugins/second-opinion/scripts/a.mjs"), env));
  assert.ok(decideScopeGuard(editInput("plugins/second-opinion/scripts/b.mjs"), env), "別ファイルは重複抑制の対象外");
});

test("decideScopeGuard: NotebookEdit は notebook_path で判定する", () => {
  const dataDir = tmpDataDir();
  writeBaseline(dataDir, "s1", { manifestId: "m1", globs: ["plugins/model-strategy/**"], contractHash: "h1" });
  const env = { ...CONDUCTOR_ENV_BASE, CLAUDE_PLUGIN_DATA: dataDir };
  const input = { session_id: "s1", tool_name: "NotebookEdit", tool_input: { notebook_path: "plugins/other/nb.ipynb" } };
  const decision = decideScopeGuard(input, env);
  assert.ok(decision, "notebook_path 経由の範囲外編集も検出する");
});
