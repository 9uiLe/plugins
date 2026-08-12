import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { decideWarn } from "../hooks/route-warn.mjs";

function grepInput(overrides = {}) {
  return { session_id: "s1", tool_name: "Grep", tool_input: {}, ...overrides };
}

function bashInput(command, overrides = {}) {
  return { session_id: "s1", tool_name: "Bash", tool_input: { command }, ...overrides };
}

const WARN_ENV = { MODEL_STRATEGY_ROUTE_WARN: "1" };

const cases = [
  { name: "env 未設定なら warn しない (既定不活性)", input: grepInput(), env: {}, expected: false },
  {
    name: "agent_id があれば warn しない (サブエージェント内は対象外)",
    input: grepInput({ agent_id: "sub-1" }),
    env: WARN_ENV,
    expected: false
  },
  { name: "Grep は warn する", input: grepInput(), env: WARN_ENV, expected: true },
  { name: "Bash 'rtk grep foo' は warn する", input: bashInput("rtk grep foo"), env: WARN_ENV, expected: true },
  { name: "Bash 'git grep x' は warn する", input: bashInput("git grep x"), env: WARN_ENV, expected: true },
  { name: "Bash 'npm test' は warn しない", input: bashInput("npm test"), env: WARN_ENV, expected: false },
  { name: "Bash 'rg -n pat' は warn する", input: bashInput("rg -n pat"), env: WARN_ENV, expected: true }
];

for (const { name, input, env, expected } of cases) {
  test(`decideWarn: ${name}`, () => {
    assert.equal(decideWarn(input, env), expected);
  });
}

test("decideWarn: 重複抑制 — 同一 (session, tool) の 2 回目以降は warn しない", () => {
  // 予測可能パス直書き禁止: os.tmpdir() + mkdtemp で一時 CLAUDE_PLUGIN_DATA を作る。
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "model-strategy-route-warn-"));
  const env = { MODEL_STRATEGY_ROUTE_WARN: "1", CLAUDE_PLUGIN_DATA: dataDir };
  const input = grepInput();
  assert.equal(decideWarn(input, env), true, "1 回目は warn する");
  assert.equal(decideWarn(input, env), false, "2 回目 (同一 session, tool) は warn しない");
});
