import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.dirname(TEST_DIR);
const CLI = path.join(PLUGIN_DIR, "scripts", "second-opinion.mjs");
const CAPTURE_HOOK = path.join(PLUGIN_DIR, "hooks", "capture-transcript.mjs");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: PLUGIN_DIR,
    encoding: "utf8",
    ...options
  });
}

test("extract reads user, reasoning, tool errors, and assistant output from a Codex rollout", () => {
  const fixture = path.join(TEST_DIR, "fixtures", "codex.jsonl");
  const result = runCli(["extract", "--source", fixture]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /counts: human=1 assistant_turns=2 tool_calls=1 tool_errors=1/
  );
  assert.match(result.stdout, /Codex user request/);
  assert.match(result.stdout, /Codex reasoning summary/);
  assert.match(result.stdout, /Codex final response/);
  assert.match(result.stdout, /command failed/);
});

test("extract preserves Claude Code transcript behavior", () => {
  const fixture = path.join(TEST_DIR, "fixtures", "claude.jsonl");
  const result = runCli(["extract", "--source", fixture]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /counts: human=1 assistant_turns=1 tool_calls=1 tool_errors=1/
  );
  assert.match(result.stdout, /Claude user request/);
  assert.match(result.stdout, /Claude response/);
  assert.match(result.stdout, /Claude command failed/);
});

test("SessionStart hook publishes the Codex transcript path as developer context", () => {
  const transcriptPath = "/tmp/codex-session.jsonl";
  const result = spawnSync(process.execPath, [CAPTURE_HOOK], {
    cwd: PLUGIN_DIR,
    encoding: "utf8",
    input: JSON.stringify({
      hook_event_name: "SessionStart",
      session_id: "codex-session",
      transcript_path: transcriptPath
    }),
    env: { ...process.env, CLAUDE_ENV_FILE: "" }
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(output.hookSpecificOutput.additionalContext, /SECOND_OPINION_TRANSCRIPT_PATH/);
  assert.match(output.hookSpecificOutput.additionalContext, new RegExp(transcriptPath));
});

test("SessionStart hook keeps writing Claude Code's environment file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-hook-"));
  const envFile = path.join(tempDir, "env.sh");
  fs.writeFileSync(envFile, "", "utf8");
  try {
    const result = spawnSync(process.execPath, [CAPTURE_HOOK], {
      cwd: PLUGIN_DIR,
      encoding: "utf8",
      input: JSON.stringify({
        hook_event_name: "SessionStart",
        session_id: "claude-session",
        transcript_path: "/tmp/claude-session.jsonl"
      }),
      env: { ...process.env, CLAUDE_ENV_FILE: envFile }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    const written = fs.readFileSync(envFile, "utf8");
    assert.match(written, /SECOND_OPINION_TRANSCRIPT_PATH='\/tmp\/claude-session\.jsonl'/);
    assert.match(written, /SECOND_OPINION_SESSION_ID='claude-session'/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Codex backend uses codex exec with an isolated read-only session", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-codex-"));
  const fakeCodex = path.join(tempDir, "codex");
  fs.writeFileSync(
    fakeCodex,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const required = ["exec", "--sandbox", "read-only", "--ephemeral", "--model", "test-model", "-c", 'model_reasoning_effort="low"', "-"];
for (const item of required) {
  if (!args.includes(item)) {
    process.stderr.write("missing arg: " + item);
    process.exit(2);
  }
}
const prompt = fs.readFileSync(0, "utf8");
if (!prompt.includes("Codex user request")) {
  process.stderr.write("missing mechanical transcript");
  process.exit(3);
}
process.stdout.write("## 1. Blind spots\\nFake Codex review\\n");
`,
    { mode: 0o755 }
  );

  try {
    const fixture = path.join(TEST_DIR, "fixtures", "codex.jsonl");
    const result = runCli(
      ["review", "--backend", "codex", "--source", fixture, "--effort", "low"],
      {
        env: {
          ...process.env,
          HOME: tempDir,
          PATH: `${tempDir}${path.delimiter}${process.env.PATH}`,
          SECOND_OPINION_CODEX_MODEL: "test-model"
        }
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /CODEX \(model=test-model, effort=low\)/);
    assert.match(result.stdout, /Fake Codex review/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("review fails closed when a transcript has no extractable conversation events", () => {
  const fixture = path.join(TEST_DIR, "fixtures", "codex-unsupported.jsonl");
  const result = runCli(["review", "--backend", "codex", "--source", fixture]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported or empty transcript format/);
});
