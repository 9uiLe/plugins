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
  assert.doesNotMatch(result.stdout, /automatically injected/);
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

// --- #76 B-P23: codex fallback fires ONLY on model-not-found failures --------

// Writes a fake `codex` that appends one line per invocation to countFile.
// Behavior per invocation is controlled by the mode:
//   model-not-found : with --model -> exit 1 + real "Model not found" form; without -> succeed
//   auth-error      : always exit 1 + "401 Unauthorized"
//   policy-error    : always exit 1 + org-policy denial (contains "model is not supported")
//   parser-error    : always exit 1 + internal "unsupported model item type"
function writeFakeCodex(dir, mode) {
  const countFile = path.join(dir, "invocations.log");
  fs.writeFileSync(
    path.join(dir, "codex"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(countFile)}, args.join(" ") + "\\n");
fs.readFileSync(0, "utf8"); // drain stdin
const mode = ${JSON.stringify(mode)};
if (mode === "auth-error") {
  process.stderr.write("ERROR: 401 Unauthorized — run codex login\\n");
  process.exit(1);
}
if (mode === "policy-error") {
  process.stderr.write("Request denied: this model is not supported by your organization policy\\n");
  process.exit(1);
}
if (mode === "parser-error") {
  process.stderr.write("ERROR: unsupported model item type\\n");
  process.exit(1);
}
if (args.includes("--model")) {
  process.stderr.write("ERROR: Model not found test-model\\n");
  process.exit(1);
}
process.stdout.write("## 1. Blind spots\\nFallback Codex review\\n");
`,
    { mode: 0o755 }
  );
  return countFile;
}

function reviewWithFakeCodex(tempDir, extraArgs = []) {
  const fixture = path.join(TEST_DIR, "fixtures", "codex.jsonl");
  return runCli(["review", "--backend", "codex", "--source", fixture, ...extraArgs], {
    env: {
      ...process.env,
      HOME: tempDir,
      PATH: `${tempDir}${path.delimiter}${process.env.PATH}`,
      SECOND_OPINION_CODEX_MODEL: "test-model",
      SECOND_OPINION_NO_FALLBACK: ""
    }
  });
}

test("codex fallback fires on a model-not-found failure and is labelled", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-fb-"));
  const countFile = writeFakeCodex(tempDir, "model-not-found");
  try {
    const result = reviewWithFakeCodex(tempDir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /model=\(codex default; pinned test-model not served\)/);
    assert.match(result.stdout, /Fallback Codex review/);
    const invocations = fs.readFileSync(countFile, "utf8").trim().split("\n");
    assert.equal(invocations.length, 2, "expected pinned attempt + one fallback retry");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("codex auth failure does NOT fall back to a different model identity", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-fb-"));
  const countFile = writeFakeCodex(tempDir, "auth-error");
  try {
    const result = reviewWithFakeCodex(tempDir);
    assert.equal(result.status, 0, result.stderr); // review renders the failure, it does not crash
    assert.match(result.stdout, /CODEX \(model=test-model/); // identity NOT degraded
    assert.match(result.stdout, /backend failed: exit 1/);
    assert.match(result.stdout + result.stderr, /401 Unauthorized/);
    const invocations = fs.readFileSync(countFile, "utf8").trim().split("\n");
    assert.equal(invocations.length, 1, "auth failure must not trigger a retry");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("near-collision error texts do NOT trigger the fallback; model_not_found code does", () => {
  const variants = [
    // Truncated lookalike of the ChatGPT-account form: different suffix → no fallback.
    { text: "The test-model model is not supported when using Codex under your organization policy", fallback: false },
    // Mid-sentence "model not found" → no fallback (the real form is its own line).
    { text: "ERROR: config for model not found in cache; retry later", fallback: false },
    // Structured API error code → fallback.
    { text: '{"error":{"code":"model_not_found","message":"..."}}', fallback: true },
    // Real CLI HTTP wrapper form (openai/codex#26892, #29546) → fallback.
    { text: "ERROR: unexpected status 404 Not Found: Model not found: test-model", fallback: true },
    // Terminal line-wrap splitting the phrase (openai/codex#18793) → fallback.
    { text: "Model not\nfound test-model", fallback: true },
    // Mixed log: an internal model-404 warning (WebSocket→HTTPS probe,
    // openai/codex#26910) followed by a terminal auth failure → the auth
    // failure wins, NO fallback.
    {
      text: "WARN: websocket transport: unexpected status 404 Not Found: Model not found: test-model\nERROR: 401 Unauthorized — run codex login",
      fallback: false
    },
    // Mixed log with a terminal org-policy denial → NO fallback.
    {
      text: "WARN: unexpected status 404 Not Found: Model not found: test-model\nRequest denied: blocked by organization policy",
      fallback: false
    },
    // Model ids that merely CONTAIN failure-ish tokens must not suppress a
    // pure model-not-found fallback ("401"/"quota" as substrings of the id).
    { text: "ERROR: Model not found gpt-401", fallback: true },
    { text: "ERROR: Model not found quota-preview", fallback: true },
    // ChatGPT-account form delivered wrapped in 403 Forbidden ON THE SAME
    // LINE is still a decisive model-identity failure → fallback.
    {
      text: "ERROR: unexpected status 403 Forbidden: The test-model model is not supported when using Codex with a ChatGPT account",
      fallback: true
    },
    // ...even when the form itself wraps across lines → fallback.
    {
      text: "ERROR: unexpected status 403 Forbidden: The test-model model is not supported when using\nCodex with a ChatGPT account",
      fallback: true
    },
    // ...but a decisive terminal error AFTER the ChatGPT-form line wins → NO fallback.
    {
      text: "The test-model model is not supported when using Codex with a ChatGPT account\nERROR: 401 Unauthorized — run codex login",
      fallback: false
    },
    // ...and a terminal error CONCATENATED ON THE SAME LINE as the form also
    // wins (the exemption is match-span-scoped, not line-scoped) → NO fallback.
    {
      text: "The test-model model is not supported when using Codex with a ChatGPT account ERROR: 401 Unauthorized",
      fallback: false
    },
    // Model ids containing failure-ish WORDS must not suppress the fallback either.
    { text: "ERROR: Model not found gpt-forbidden", fallback: true },
    { text: "ERROR: Model not found rate-limit-preview", fallback: true },
    // Model ids containing snake_case failure codes as substrings → fallback
    // (codes are terminal only in a code field or standing alone as a line).
    { text: "ERROR: Model not found rate_limit-preview", fallback: true },
    { text: "ERROR: Model not found organization_policy-preview", fallback: true },
    { text: "ERROR: Model not found invalid_api_key-preview", fallback: true },
    // Definite terminal auth/quota/policy forms in mixed logs → NO fallback.
    { text: "WARN: unexpected status 404 Not Found: Model not found: test-model\nNot logged in", fallback: false },
    { text: "WARN: unexpected status 404 Not Found: Model not found: test-model\nAuthentication failed: invalid API key", fallback: false },
    { text: 'WARN: unexpected status 404 Not Found: Model not found: test-model\n{"error":{"code":"rate_limit_exceeded"}}', fallback: false },
    { text: 'WARN: unexpected status 404 Not Found: Model not found: test-model\n{"error":{"code":"usage_limit_reached"}}', fallback: false },
    { text: 'WARN: unexpected status 404 Not Found: Model not found: test-model\n{"error":{"code":"organization_policy"}}', fallback: false },
    { text: 'WARN: unexpected status 404 Not Found: Model not found: test-model\n{"error":{"code":"request_denied"}}', fallback: false },
    // snake_case auth error codes are terminal too → NO fallback.
    { text: 'WARN: unexpected status 404 Not Found: Model not found: test-model\n{"error":{"code":"invalid_api_key"}}', fallback: false },
    { text: 'WARN: unexpected status 404 Not Found: Model not found: test-model\n{"error":{"code":"authentication_failed"}}', fallback: false },
    { text: 'WARN: unexpected status 404 Not Found: Model not found: test-model\n{"error":{"code":"not_logged_in"}}', fallback: false }
  ];
  for (const { text, fallback } of variants) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-fb-"));
    const countFile = path.join(tempDir, "invocations.log");
    fs.writeFileSync(
      path.join(tempDir, "codex"),
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(countFile)}, args.join(" ") + "\\n");
fs.readFileSync(0, "utf8");
if (args.includes("--model")) {
  process.stderr.write(${JSON.stringify(text)} + "\\n");
  process.exit(1);
}
process.stdout.write("## 1. Blind spots\\nFallback Codex review\\n");
`,
      { mode: 0o755 }
    );
    try {
      const result = reviewWithFakeCodex(tempDir);
      assert.equal(result.status, 0, result.stderr);
      const invocations = fs.readFileSync(countFile, "utf8").trim().split("\n");
      if (fallback) {
        assert.equal(invocations.length, 2, `should fall back: ${text}`);
        assert.match(result.stdout, /codex default; pinned test-model not served/);
      } else {
        assert.equal(invocations.length, 1, `must NOT fall back: ${text}`);
        assert.match(result.stdout, /CODEX \(model=test-model/);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test("org-policy and internal parser failures do NOT trigger the fallback (negative classifier)", () => {
  for (const mode of ["policy-error", "parser-error"]) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-fb-"));
    const countFile = writeFakeCodex(tempDir, mode);
    try {
      const result = reviewWithFakeCodex(tempDir);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /CODEX \(model=test-model/, mode); // identity NOT degraded
      assert.match(result.stdout, /backend failed: exit 1/, mode);
      const invocations = fs.readFileSync(countFile, "utf8").trim().split("\n");
      assert.equal(invocations.length, 1, `${mode} must not trigger a retry`);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test("--no-fallback disables the fallback even for model-not-found", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-fb-"));
  const countFile = writeFakeCodex(tempDir, "model-not-found");
  try {
    const result = reviewWithFakeCodex(tempDir, ["--no-fallback"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /CODEX \(model=test-model/);
    assert.match(result.stdout, /backend failed: exit 1/);
    assert.match(result.stdout, /automatic fallback is disabled/);
    const invocations = fs.readFileSync(countFile, "utf8").trim().split("\n");
    assert.equal(invocations.length, 1, "--no-fallback must prevent the retry");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// --- #76 A-P2/B-P30: per-provider effort validation before dispatch ----------

function writeFakeClaude(dir) {
  const markerFile = path.join(dir, "claude-invoked.log");
  fs.writeFileSync(
    path.join(dir, "claude"),
    `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(${JSON.stringify(markerFile)}, process.argv.slice(2).join(" ") + "\\n");
fs.readFileSync(0, "utf8");
process.stdout.write("## 1. Blind spots\\nFake Fable review\\n");
`,
    { mode: 0o755 }
  );
  return markerFile;
}

test("effort matrix: every provider-valid effort is accepted, invalid ones fail before dispatch", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-effort-"));
  const claudeMarker = writeFakeClaude(tempDir);
  const codexCount = writeFakeCodex(tempDir, "ok");
  const fixture = path.join(TEST_DIR, "fixtures", "codex.jsonl");
  const env = {
    ...process.env,
    HOME: tempDir,
    PATH: `${tempDir}${path.delimiter}${process.env.PATH}`,
    SECOND_OPINION_CODEX_MODEL: "test-model"
  };
  // Codex effort acceptance is enforced server-side per model. Only exact
  // probe-verified entries are pre-validated (gpt-5.6-sol, 2026-07-23);
  // every other model defers to the server with a warning — family-name
  // generalization is deliberately avoided.
  const cases = [
    { backend: "fable", effort: "max", ok: true },
    { backend: "fable", effort: "xhigh", ok: true },
    { backend: "fable", effort: "minimal", ok: false, rejects: /fable \(claude-fable-5\)/ },
    { backend: "fable", effort: "none", ok: false, rejects: /fable \(claude-fable-5\)/ },
    { backend: "codex", model: "gpt-5.6-sol", effort: "max", ok: true },
    { backend: "codex", model: "gpt-5.6-sol", effort: "ultra", ok: true },
    { backend: "codex", model: "gpt-5.6-sol", effort: "minimal", ok: false, rejects: /codex \(gpt-5\.6-sol\)/ },
    { backend: "both", model: "gpt-5.6-sol", effort: "high", ok: true },
    { backend: "both", model: "gpt-5.6-sol", effort: "max", ok: true },
    { backend: "both", model: "gpt-5.6-sol", effort: "ultra", ok: false, rejects: /fable \(claude-fable-5\)/ },
    { backend: "both", model: "gpt-5.6-sol", effort: "minimal", ok: false, rejects: /fable \(claude-fable-5\)|codex \(gpt-5\.6-sol\)/ }
  ];
  try {
    for (const c of cases) {
      const modelArgs = c.model ? ["--model", c.model] : [];
      const result = runCli(
        ["review", "--backend", c.backend, "--source", fixture, "--effort", c.effort, ...modelArgs],
        { env }
      );
      if (c.ok) {
        assert.equal(result.status, 0, `${c.backend}/${c.model || "-"}/${c.effort}: ${result.stderr}`);
      } else {
        assert.equal(result.status, 1, `${c.backend}/${c.model || "-"}/${c.effort} should be rejected`);
        assert.match(result.stderr, c.rejects);
        assert.match(result.stderr, /Nothing was dispatched/);
      }
    }
    // Rejected efforts never reached a CLI: markers contain only the accepted runs.
    const claudeRuns = fs.existsSync(claudeMarker)
      ? fs.readFileSync(claudeMarker, "utf8").trim().split("\n")
      : [];
    for (const line of claudeRuns) assert.doesNotMatch(line, /--effort (?:minimal|none|ultra)\b/);
    const codexRuns = fs.existsSync(codexCount)
      ? fs.readFileSync(codexCount, "utf8").trim().split("\n")
      : [];
    for (const line of codexRuns) {
      if (line.includes("gpt-5.6-sol")) assert.doesNotMatch(line, /model_reasoning_effort="minimal"/);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("codex models outside the verified table defer effort validation to the server with a warning", () => {
  // Includes lookalike ids that a family regex would have wrongly matched
  // (gpt-5.60-experimental) and previous-generation models whose catalog
  // support is unverified (gpt-5.4-mini + minimal).
  const modelCases = [
    { model: "gpt-9-experimental", effort: "xhigh" },
    { model: "gpt-5.60-experimental", effort: "minimal" },
    { model: "gpt-5.4-mini", effort: "minimal" }
  ];
  for (const { model, effort } of modelCases) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-effort-"));
    writeFakeCodex(tempDir, "ok");
    const fixture = path.join(TEST_DIR, "fixtures", "codex.jsonl");
    try {
      const result = runCli(
        ["review", "--backend", "codex", "--source", fixture, "--effort", effort, "--model", model],
        {
          env: {
            ...process.env,
            HOME: tempDir,
            PATH: `${tempDir}${path.delimiter}${process.env.PATH}`
          }
        }
      );
      assert.equal(result.status, 0, `${model}: ${result.stderr}`);
      assert.match(
        result.stderr,
        new RegExp(`effort not pre-validated: codex model "${model.replace(/\./g, "\\.")}"`)
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test("fallback classifier recognizes the real codex CLI error forms", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-fb-"));
  const countFile = path.join(tempDir, "invocations.log");
  // Real form 1: "Model not found <id>"; real form 2 (ChatGPT account):
  // "The <id> model is not supported when using Codex with a ChatGPT account".
  fs.writeFileSync(
    path.join(tempDir, "codex"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(countFile)}, args.join(" ") + "\\n");
fs.readFileSync(0, "utf8");
if (args.includes("--model")) {
  const form = process.env.FAKE_ERROR_FORM;
  if (form === "not-found") process.stderr.write("ERROR: Model not found test-model\\n");
  else process.stderr.write("The test-model model is not supported when using Codex with a ChatGPT account\\n");
  process.exit(1);
}
process.stdout.write("## 1. Blind spots\\nFallback Codex review\\n");
`,
    { mode: 0o755 }
  );
  const fixture = path.join(TEST_DIR, "fixtures", "codex.jsonl");
  try {
    for (const form of ["not-found", "not-supported"]) {
      fs.rmSync(countFile, { force: true });
      const result = runCli(["review", "--backend", "codex", "--source", fixture], {
        env: {
          ...process.env,
          HOME: tempDir,
          PATH: `${tempDir}${path.delimiter}${process.env.PATH}`,
          SECOND_OPINION_CODEX_MODEL: "test-model",
          FAKE_ERROR_FORM: form
        }
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /model=\(codex default; pinned test-model not served\)/, form);
      const invocations = fs.readFileSync(countFile, "utf8").trim().split("\n");
      assert.equal(invocations.length, 2, `${form}: expected pinned attempt + fallback retry`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// --- #76 B-P24: setup distinguishes installed / authenticated / probe-failed -

function writeFakeAuthClis(dir, { claudeLoggedIn, codexLoggedIn, claudeBroken = false }) {
  fs.writeFileSync(
    path.join(dir, "claude"),
    claudeBroken
      ? `#!/usr/bin/env node\nprocess.stderr.write("unknown command: auth\\n");\nprocess.exit(2);\n`
      : `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write(JSON.stringify({ loggedIn: ${claudeLoggedIn}, authMethod: "claude.ai" }) + "\\n");
  process.exit(0);
}
process.exit(1);
`,
    { mode: 0o755 }
  );
  fs.writeFileSync(
    path.join(dir, "codex"),
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "login" && args[1] === "status") {
  if (${codexLoggedIn}) { process.stdout.write("Logged in using ChatGPT\\n"); process.exit(0); }
  process.stderr.write("Not logged in\\n");
  process.exit(1);
}
process.exit(1);
`,
    { mode: 0o755 }
  );
}

function runSetup(tempDir) {
  const result = runCli(["setup", "--json"], {
    env: {
      ...process.env,
      HOME: tempDir,
      PATH: `${tempDir}${path.delimiter}${process.env.PATH}`
    }
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("setup reports ready only for authenticated CLIs", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-setup-"));
  try {
    writeFakeAuthClis(tempDir, { claudeLoggedIn: true, codexLoggedIn: true });
    const ready = runSetup(tempDir);
    assert.equal(ready.fable_backend.status, "ready");
    assert.equal(ready.codex_backend.status, "ready");
    assert.equal(ready.fable_backend_ready, true);

    writeFakeAuthClis(tempDir, { claudeLoggedIn: false, codexLoggedIn: false });
    const loggedOut = runSetup(tempDir);
    assert.equal(loggedOut.fable_backend.status, "installed (not authenticated)");
    assert.equal(loggedOut.codex_backend.status, "installed (not authenticated)");
    assert.equal(loggedOut.fable_backend_ready, false);
    assert.equal(loggedOut.codex_backend_ready, false);

    writeFakeAuthClis(tempDir, { claudeLoggedIn: true, codexLoggedIn: true, claudeBroken: true });
    const broken = runSetup(tempDir);
    assert.equal(broken.fable_backend.status, "installed (auth probe failed)");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("setup auth probes are not fooled by protocol-mismatch impostors", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "second-opinion-setup-"));
  try {
    // codex printing "Not logged in" with exit 0: the substring "logged in"
    // must not read as authenticated, and the exit-0/logged-out contradiction
    // is a protocol mismatch — distinct from a real logged-out CLI (which
    // pairs the message with a non-zero exit, covered in the previous test).
    fs.writeFileSync(
      path.join(tempDir, "codex"),
      `#!/usr/bin/env node
process.stdout.write("Not logged in\\n");
process.exit(0);
`,
      { mode: 0o755 }
    );
    // claude emitting plausible loggedIn:true JSON but exiting non-zero: a
    // protocol mismatch (wrapper/fake), not an authenticated CLI.
    fs.writeFileSync(
      path.join(tempDir, "claude"),
      `#!/usr/bin/env node
process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: "claude.ai" }) + "\\n");
process.exit(3);
`,
      { mode: 0o755 }
    );
    const status = runSetup(tempDir);
    assert.equal(status.codex_backend.status, "installed (auth probe failed)");
    assert.equal(status.fable_backend.status, "installed (auth probe failed)");
    assert.equal(status.codex_backend_ready, false);
    assert.equal(status.fable_backend_ready, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
