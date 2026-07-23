#!/usr/bin/env node
// second-opinion.mjs — the mechanical engine behind the second-opinion skill.
//
// Responsibilities (all mechanical; the calling agent never curates content):
//   1. Resolve the CURRENT session transcript (no summarisation by the agent).
//   2. Extract a FIXED-FORMAT context from it (task def + every human message +
//      assistant reasoning + tool digest + every tool error). --full = verbatim.
//   3. Dispatch that context, wrapped in the five-section advisor contract, to
//      one or both backends (Fable via `claude -p`, Codex via `codex exec`),
//      with runtime-selected model/effort, and print their verdicts.
//
// Subcommands:
//   review   --backend <codex|fable|both> [--model M] [--effort E] [--full]
//            [--source PATH] [--stakes high|normal]
//   extract  [--full] [--source PATH]      # print the extraction only
//   resolve  [--source PATH]               # print the resolved transcript path
//   setup    [--json]                      # dependency / readiness report

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";

const FABLE_MODEL = "claude-fable-5";
// Top-tier Codex model pinned for the advisor, passed explicitly on every codex
// run so the served model can't silently drop below the top tier via a stale
// per-cwd app-server default. Env-overridable so a renamed model id needs no
// code change; runCodex additionally falls back to the codex default — but ONLY
// when the failure is classified as model-not-found (renamed / retired /
// ungated id). Auth failures, timeouts, policy errors and crashes are NOT
// silently degraded to a different model identity (#76 B-P23). Fallback can be
// disabled entirely with --no-fallback / SECOND_OPINION_NO_FALLBACK=1 (council
// rule: a fallback is a new participant identity requiring a new preflight).
const CODEX_MODEL = process.env.SECOND_OPINION_CODEX_MODEL || "gpt-5.6-sol";
// Effort capability tables (#76 A-P2/B-P30). A single shared enum does not
// exist: the fable CLI enforces its own set, and codex effort acceptance is
// MODEL-dependent (enforced server-side per model, HTTP 400 on mismatch), so
// validation happens after backend AND model are decided, BEFORE dispatch.
//   fable: `claude --help` --effort "(low, medium, high, xhigh, max)" (2026-07-23 実機確認)
//   codex: エントリは「実機 probe で検証済みの exact モデル ID」のみ。ファミリー正規表現で
//     未検証モデルへ一般化しない（例: Luna の ultra や 5.4/5.5 の minimal は catalog 上
//     未確認のため、誤った事前 BLOCK / 誤った受理の両方を避ける）。
//     表にないモデルは事前検証せず警告付きでサーバー判定（モデル別 HTTP 400）に委ねる。
const FABLE_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const CODEX_EFFORTS_BY_MODEL = new Map([
  // gpt-5.6-sol: minimal → HTTP 400 / max・ultra → 受理 (2026-07-23 実機 probe。公式 Sol セレクタとも一致)
  ["gpt-5.6-sol", ["low", "medium", "high", "xhigh", "max", "ultra"]]
]);

function codexEffortsFor(model) {
  return CODEX_EFFORTS_BY_MODEL.get(model) ?? null; // null = 未検証モデル、サーバー判定に委譲
}
// Assistant-reasoning byte budget in default (non-full) mode. Human messages and
// tool errors are NEVER trimmed; only the middle of the reasoning chain is.
const ASSISTANT_CHAR_BUDGET = 120000;

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  const boolFlags = new Set(["full", "json", "no-fallback"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (boolFlags.has(key)) {
        out[key] = true;
      } else {
        out[key] = argv[++i];
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// transcript resolution (fallback chain)
// ---------------------------------------------------------------------------

function cwdSlug(cwd) {
  // Claude stores transcripts under ~/.claude/projects/<slug>/ where slug is the
  // cwd with path separators and dots replaced by '-'.
  return cwd.replace(/[/.]/g, "-");
}

function newestTranscriptForCwd(cwd) {
  const dir = path.join(os.homedir(), ".claude", "projects", cwdSlug(cwd));
  let entries;
  try {
    entries = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return null;
  }
  let best = null;
  let bestMtime = -1;
  for (const f of entries) {
    const full = path.join(dir, f);
    try {
      const m = fs.statSync(full).mtimeMs;
      if (m > bestMtime) {
        bestMtime = m;
        best = full;
      }
    } catch {
      /* ignore */
    }
  }
  return best;
}

// Returns { path, source, warning }.
function resolveTranscript(args) {
  if (args.source) {
    return { path: args.source, source: "--source", warning: null };
  }
  if (process.env.SECOND_OPINION_TRANSCRIPT_PATH) {
    return {
      path: process.env.SECOND_OPINION_TRANSCRIPT_PATH,
      source: "SECOND_OPINION_TRANSCRIPT_PATH",
      warning: null
    };
  }
  if (process.env.CODEX_COMPANION_TRANSCRIPT_PATH) {
    return {
      path: process.env.CODEX_COMPANION_TRANSCRIPT_PATH,
      source: "CODEX_COMPANION_TRANSCRIPT_PATH",
      warning: null
    };
  }
  const guess = newestTranscriptForCwd(process.cwd());
  if (guess) {
    return {
      path: guess,
      source: "newest-mtime",
      warning:
        "transcript env not set (SessionStart hook likely has not run in this session yet); " +
        "fell back to the newest .jsonl by mtime, which can pick the wrong session when several run at once. " +
        "Pass --source <path> to be certain."
    };
  }
  return { path: null, source: "none", warning: "could not locate any transcript" };
}

// ---------------------------------------------------------------------------
// transcript parsing
// ---------------------------------------------------------------------------

function contentToBlocks(content) {
  if (content == null) return [];
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (Array.isArray(content)) return content.filter((b) => b && typeof b === "object");
  if (typeof content === "object") return [content];
  return [];
}

function blockText(b) {
  if (typeof b === "string") return b;
  if (b && typeof b === "object") {
    if (typeof b.text === "string") return b.text;
    if (typeof b.content === "string") return b.content;
    if (Array.isArray(b.content)) {
      return b.content
        .map((x) => (typeof x === "string" ? x : (x && x.text) || ""))
        .join("\n");
    }
  }
  return "";
}

const NOISE_PATTERNS = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<task-notification>[\s\S]*?<\/task-notification>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<command-args>[\s\S]*?<\/command-args>/g,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  /\[SYSTEM NOTIFICATION[\s\S]*?\](?=\n|$)/g
];

function stripNoise(text) {
  let t = text;
  for (const p of NOISE_PATTERNS) t = t.replace(p, "");
  return t.trim();
}

function detectSlashCommand(rawText) {
  const m = rawText.match(/<command-name>\s*(\/[^<\s]+)\s*<\/command-name>/);
  return m ? m[1] : null;
}

// Parse the JSONL into an ordered list of normalized events:
//   { kind: 'user', text }
//   { kind: 'assistant', text }
//   { kind: 'tool_use', name, argline, id }
//   { kind: 'tool_result', name, isError, text }
//   { kind: 'command', name }
function parseTranscript(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n");
  const records = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    try {
      records.push(JSON.parse(s));
    } catch {
      // Ignore partial/corrupt JSONL records; transcripts may be read while active.
    }
  }
  const isCodex = records.some(
    (obj) => obj?.type === "session_meta" || (obj?.payload && obj?.type === "response_item")
  );
  return isCodex ? parseCodexTranscript(records) : parseClaudeTranscript(records);
}

function parseClaudeTranscript(records) {
  const toolNameById = new Map();
  const events = [];

  // First pass: build tool_use id -> name map.
  for (const obj of records) {
    const blocks = contentToBlocks(obj?.message?.content);
    for (const b of blocks) {
      if (b && b.type === "tool_use" && b.id) toolNameById.set(b.id, b.name || "?");
    }
  }

  // Second pass: emit events.
  for (const obj of records) {
    const type = obj.type || obj?.message?.role || "";
    const blocks = contentToBlocks(obj?.message?.content);

    const hasToolResult = blocks.some((b) => b && b.type === "tool_result");
    const hasToolUse = blocks.some((b) => b && b.type === "tool_use");
    // Reliable Claude Code transcript markers that distinguish genuine human
    // input from injected/automated user-role turns.
    const originKind = obj?.origin?.kind || null; // "human" | "task-notification" | null
    const isCompactSummary = obj?.isCompactSummary === true;
    const isMeta = obj?.isMeta === true;

    if (type === "assistant" || obj?.message?.role === "assistant") {
      for (const b of blocks) {
        if (b.type === "text" && b.text && b.text.trim()) {
          events.push({ kind: "assistant", text: b.text.trim() });
        } else if (b.type === "tool_use") {
          events.push({
            kind: "tool_use",
            name: b.name || "?",
            id: b.id,
            argline: summarizeInput(b.name, b.input)
          });
        }
      }
      continue;
    }

    // user turns: may be genuine human text OR tool results returned to the model
    // OR injected/automated turns (task-notifications, compaction summary, meta).
    if (type === "user" || obj?.message?.role === "user") {
      if (hasToolResult) {
        for (const b of blocks) {
          if (b.type !== "tool_result") continue;
          const name = toolNameById.get(b.tool_use_id) || "?";
          const isError = b.is_error === true;
          events.push({
            kind: "tool_result",
            name,
            isError,
            text: blockText(b).trim()
          });
        }
        continue;
      }

      const rawText = blocks.map(blockText).join("\n");
      const cmd = detectSlashCommand(rawText);
      if (cmd) events.push({ kind: "command", name: cmd });

      // A compaction summary is a LOSSY synthetic turn — never attribute it to
      // the human. But it may be the only record of pre-compaction work whose
      // raw turns are absent from this file, so keep it in a clearly-labeled,
      // de-prioritised section rather than dropping it.
      if (isCompactSummary) {
        events.push({ kind: "compaction_summary", text: stripNoise(rawText) });
        continue;
      }
      // Injected meta (command caveats, hook context) and automated
      // task-notifications are not the human speaking.
      if (isMeta || originKind === "task-notification") {
        continue;
      }
      // Genuine human input is marked origin.kind === "human". Fall back to
      // "no origin marker but has real text after noise-stripping" only when
      // the marker is absent (older transcripts), excluding slash-command
      // machinery which carries no origin at all.
      const clean = stripNoise(rawText);
      if (originKind === "human") {
        if (clean) events.push({ kind: "user", text: clean });
      }
      continue;
    }
    // other line types (summary, system, file-history-snapshot, etc.) are ignored
    void hasToolUse;
  }

  return events;
}

function parseCodexTranscript(records) {
  const toolNameById = new Map();
  const events = [];
  const hasHumanEventRecords = records.some(
    (obj) => obj?.type === "event_msg" && obj?.payload?.type === "user_message"
  );

  for (const obj of records) {
    if (obj?.type !== "response_item") continue;
    const payload = obj.payload || {};
    const callId = payload.call_id || payload.id;
    const name = codexToolName(payload);
    if (callId && name && isCodexToolCall(payload.type)) {
      toolNameById.set(callId, name);
    }
  }

  for (const obj of records) {
    if (hasHumanEventRecords && obj?.type === "event_msg" && obj?.payload?.type === "user_message") {
      const text = codexHumanEventText(obj.payload);
      if (text) events.push({ kind: "user", text });
      continue;
    }
    if (obj?.type !== "response_item") continue;
    const payload = obj.payload || {};

    if (payload.type === "message") {
      const text = contentToBlocks(payload.content).map(blockText).join("\n").trim();
      if (!text) continue;
      if (payload.role === "user") {
        // Modern rollouts also store injected environment/developer context as
        // role=user response items. Prefer event_msg/user_message, which is the
        // host's genuine-human event stream, and use response items only for
        // older rollouts that have no such records.
        if (!hasHumanEventRecords && !isCodexInjectedUserText(text)) {
          events.push({ kind: "user", text });
        }
      } else if (payload.role === "assistant") {
        events.push({ kind: "assistant", text });
      }
      continue;
    }

    if (payload.type === "reasoning") {
      const text = contentToBlocks(payload.summary).map(blockText).join("\n").trim();
      if (text) events.push({ kind: "assistant", text });
      continue;
    }

    if (isCodexToolCall(payload.type)) {
      const name = codexToolName(payload) || "?";
      const input = codexToolInput(payload);
      events.push({
        kind: "tool_use",
        name,
        id: payload.call_id || payload.id,
        argline: summarizeInput(name, input)
      });
      continue;
    }

    if (isCodexToolOutput(payload.type)) {
      const name = toolNameById.get(payload.call_id) || codexToolName(payload) || "?";
      const text = codexToolOutputText(payload);
      events.push({
        kind: "tool_result",
        name,
        isError: codexToolOutputIsError(payload, text),
        text
      });
    }
  }

  return events;
}

function codexHumanEventText(payload) {
  if (typeof payload.message === "string") return payload.message.trim();
  return contentToBlocks(payload.message).map(blockText).join("\n").trim();
}

function isCodexInjectedUserText(text) {
  return /^\s*(?:# AGENTS\.md instructions\b|<environment_context>|<INSTRUCTIONS>|<system-reminder>)/i.test(
    text
  );
}

function isCodexToolCall(type) {
  return ["function_call", "custom_tool_call", "tool_search_call", "web_search_call"].includes(type);
}

function isCodexToolOutput(type) {
  return ["function_call_output", "custom_tool_call_output", "tool_search_output"].includes(type);
}

function codexToolName(payload) {
  if (payload.name) return payload.name;
  if (payload.type === "web_search_call") return "web_search";
  if (payload.type === "tool_search_call" || payload.type === "tool_search_output") return "tool_search";
  return null;
}

function codexToolInput(payload) {
  const input = payload.arguments ?? payload.input ?? payload.action ?? "";
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function codexToolOutputText(payload) {
  const output = payload.output ?? payload.tools ?? payload;
  if (typeof output === "string") return output.trim();
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

function codexToolOutputIsError(payload, text) {
  if (payload.is_error === true || payload.success === false) return true;
  if (["failed", "error", "cancelled"].includes(String(payload.status).toLowerCase())) return true;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (parsed && typeof parsed === "object") {
    if (parsed.is_error === true || parsed.success === false) return true;
    if (typeof parsed.exit_code === "number" && parsed.exit_code !== 0) return true;
    if (typeof parsed.code === "number" && parsed.code !== 0) return true;
    if (["failed", "error", "cancelled"].includes(String(parsed.status).toLowerCase())) return true;
  }
  return /(?:"exit_code"\s*:\s*[1-9]\d*|process exited with (?:code|status) [1-9]\d*)/i.test(text);
}

function summarizeInput(name, input) {
  if (input == null) return "";
  try {
    if (typeof input === "string") return truncate(input, 160);
    const keys = ["file_path", "path", "command", "pattern", "prompt", "url", "description", "query", "skill", "old_string"];
    for (const k of keys) {
      if (input[k]) return `${k}=${truncate(String(input[k]), 160)}`;
    }
    return truncate(JSON.stringify(input), 160);
  } catch {
    return "";
  }
}

function truncate(s, n) {
  s = String(s).replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ---------------------------------------------------------------------------
// extraction rendering
// ---------------------------------------------------------------------------

function buildExtraction(events, { full }) {
  const users = events.filter((e) => e.kind === "user");
  const assistants = events.filter((e) => e.kind === "assistant");
  const toolUses = events.filter((e) => e.kind === "tool_use");
  const toolResults = events.filter((e) => e.kind === "tool_result");
  const errors = toolResults.filter((e) => e.isError);

  const summaries = events.filter((e) => e.kind === "compaction_summary" && e.text);

  const parts = [];
  parts.push(
    `# SECOND-OPINION CONTEXT — mechanically extracted, NOT summarised (${full ? "full" : "default"} mode)`
  );
  parts.push(
    `# counts: human=${users.length} assistant_turns=${assistants.length} tool_calls=${toolUses.length} tool_errors=${errors.length}`
  );
  if (summaries.length) {
    parts.push(
      "# note: this session was compacted. Genuine human messages (section 2) and raw turns are extracted directly; " +
        "the compaction summary is included last (section 7) as SYNTHETIC context only — do not treat it as the human's words."
    );
  }

  // 1. Task definition
  parts.push("\n## 1. Task definition (first human message)");
  parts.push(users.length ? users[0].text : "(no human message found)");

  // 2. Every human message verbatim
  parts.push("\n## 2. Every human message, verbatim, in order");
  if (users.length) {
    users.forEach((u, i) => parts.push(`\n[H${i + 1}] ${u.text}`));
  } else {
    parts.push("(none)");
  }

  // 3. Assistant reasoning chain (verbatim, possibly middle-trimmed in default mode)
  parts.push("\n## 3. Assistant reasoning & decisions, verbatim (the approach chain)");
  parts.push(renderAssistantChain(assistants, { full }));

  // 4. Tool activity digest
  parts.push("\n## 4. Tool activity digest (name — args — result)");
  if (events.length) {
    const digest = [];
    // Walk events in order, pairing tool_use with the next tool_result of same name.
    for (const e of events) {
      if (e.kind === "tool_use") {
        digest.push(`- ${e.name}(${e.argline})`);
      } else if (e.kind === "tool_result") {
        digest.push(`    -> ${e.isError ? "ERROR" : "ok"}${e.isError ? ": " + truncate(e.text, 200) : ""}`);
      } else if (e.kind === "command") {
        digest.push(`- [slash-command] ${e.name}`);
      }
    }
    parts.push(digest.length ? digest.join("\n") : "(no tool activity)");
  } else {
    parts.push("(no tool activity)");
  }

  // 5. Every tool error verbatim
  parts.push("\n## 5. Every tool error, verbatim (ground truth — never trimmed)");
  if (errors.length) {
    errors.forEach((e, i) => parts.push(`\n[ERR${i + 1}] ${e.name}\n${e.text}`));
  } else {
    parts.push("(no tool errors)");
  }

  if (full) {
    parts.push("\n## 6. Every tool result, verbatim (full mode)");
    if (toolResults.length) {
      toolResults.forEach((e, i) =>
        parts.push(`\n[R${i + 1}] ${e.name}${e.isError ? " (ERROR)" : ""}\n${e.text}`)
      );
    } else {
      parts.push("(none)");
    }
  }

  if (summaries.length) {
    parts.push(
      "\n## 7. Compaction summary — SYNTHETIC and lossy, NOT the human's words"
    );
    parts.push(
      "(Included only for pre-compaction context that may not appear in the raw turns above. Prefer sections 1–6 wherever they conflict.)"
    );
    summaries.forEach((e, i) => parts.push(`\n[SUMMARY${i + 1}]\n${e.text}`));
  }

  return parts.join("\n");
}

function renderAssistantChain(assistants, { full }) {
  const rendered = assistants.map((a, i) => `[A${i + 1}] ${a.text}`);
  const joined = rendered.join("\n\n");
  if (full || joined.length <= ASSISTANT_CHAR_BUDGET) return joined || "(none)";

  // Trim the MIDDLE, keep head (early assumptions — where blind spots live) and
  // tail (recent decisions). Log exactly what was dropped.
  const headBudget = Math.floor(ASSISTANT_CHAR_BUDGET * 0.35);
  const tailBudget = ASSISTANT_CHAR_BUDGET - headBudget;
  const head = [];
  let headLen = 0;
  for (let i = 0; i < rendered.length; i++) {
    if (headLen + rendered[i].length > headBudget) break;
    head.push(rendered[i]);
    headLen += rendered[i].length;
  }
  const tail = [];
  let tailLen = 0;
  for (let i = rendered.length - 1; i >= head.length; i--) {
    if (tailLen + rendered[i].length > tailBudget) break;
    tail.unshift(rendered[i]);
    tailLen += rendered[i].length;
  }
  const dropped = assistants.length - head.length - tail.length;
  return (
    head.join("\n\n") +
    `\n\n[... ${dropped} assistant turn(s) trimmed from the middle to fit the default budget; ` +
    `re-run with --full to include everything ...]\n\n` +
    tail.join("\n\n")
  );
}

// ---------------------------------------------------------------------------
// advisor contract
// ---------------------------------------------------------------------------

function buildContract() {
  return [
    "You are a rigorous SECOND-OPINION reviewer (an \"advisor\").",
    "Below is the mechanically-extracted, UNEDITED context of another agent's working session.",
    "The agent that produced this work cannot see its own blind spots — that is why you exist.",
    "Do NOT restate or summarise the session back. Do NOT use any tools. Read the context, then",
    "answer in EXACTLY these five sections, each a few sharp sentences, no filler:",
    "",
    "## 1. Blind spots",
    "The assumptions, risks, or missing considerations the agent has not surfaced.",
    "## 2. Convergence",
    "Is the approach converging or diverging? Name the evidence either way.",
    "## 3. Ship / No-ship",
    "State one verdict: SHIP or NO-SHIP, and the single reason that decides it.",
    "## 4. Decisive constraint",
    "Which one constraint most determines success or failure here?",
    "## 5. Strongest counterargument",
    "The most compelling case against the current direction, argued in good faith.",
    "",
    "Be specific to THIS session. Prefer naming concrete files, decisions, and risks over generic advice.",
    "",
    "Respond in the same language the human used in the session (Japanese if the session is in Japanese)."
  ].join("\n");
}

function buildPromptText(contract, extraction) {
  return `${contract}\n\n=== SESSION CONTEXT (verbatim, mechanically extracted) ===\n\n${extraction}\n`;
}

// ---------------------------------------------------------------------------
// backends
// ---------------------------------------------------------------------------

function runProcess(cmd, argsList, input, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, argsList, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let done = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          if (!done) {
            done = true;
            try {
              child.kill("SIGKILL");
            } catch {
              /* ignore */
            }
            resolve({ code: 124, stdout, stderr: stderr + "\n[timed out]" });
          }
        }, timeoutMs)
      : null;
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: String(e && e.message) });
    });
    child.on("close", (code) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    if (input != null) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function runFable(promptText, { effort }, timeoutMs) {
  const args = [
    "-p",
    "--model",
    FABLE_MODEL,
    "--permission-mode",
    "dontAsk",
    "--output-format",
    "text",
    "--no-session-persistence",
    "--append-system-prompt",
    "You are a second-opinion reviewer. Follow the five-section contract in the user message exactly. Do not use tools; output only the review.",
    "--disallowedTools",
    "Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit,Agent"
  ];
  if (effort) args.push("--effort", effort);
  const r = await runProcess("claude", args, promptText, timeoutMs);
  return { backend: "fable", model: FABLE_MODEL, effort: effort || "(default)", ...r };
}

// Narrow classifier: does this failure mean "the pinned model id itself is not
// served" (renamed / retired / ungated / typo)? Only such failures may fall
// back to the codex default. Auth, quota, policy, network, timeout and crash
// failures must surface as failures — silently swapping the model identity on
// them would bypass the council invariant that a fallback is a new participant
// identity requiring a new preflight (#76 B-P23).
// Mixed-log guard: a model-not-found phrase may appear as a non-fatal internal
// warning (e.g. the WebSocket→HTTPS transport probe logs a model 404,
// openai/codex#26910) while the RUN actually dies on auth/quota/policy. If any
// such terminal failure class is present anywhere in the log, the failure is
// NOT classified as model absence — those classes always win, because an
// identity-changing fallback must never mask them.
function hasNonModelTerminalFailure(text) {
  return (
    // HTTP auth/permission/rate statuses — matched only in status context
    // ("status 401", "401 Unauthorized"), never as bare numbers or words,
    // which can legitimately occur inside model ids (e.g. "gpt-401",
    // "gpt-forbidden").
    /(?:\bstatus\s+|\bhttp\s+)(?:40[13]|429)\b/i.test(text) ||
    /\b40[13]\s+(?:unauthorized|forbidden)\b/i.test(text) ||
    /\b429\s+too\s+many\s+requests\b/i.test(text) ||
    // "Unauthorized"/"Forbidden" as the message itself (line start, optional
    // "ERROR:" prefix) — not as a substring elsewhere.
    /^(?:\s*(?:error:?\s*)?)(?:unauthorized|forbidden)\b/im.test(text) ||
    // Definite auth failures (prose forms).
    /\bnot\s+logged\s+in\b|\blogged\s+out\b/i.test(text) ||
    /authentication\s+failed|invalid\s+api\s+key/i.test(text) ||
    /run\s+codex\s+login|please\s+log\s?in/i.test(text) ||
    // Quota / rate limits — prose forms context-bound (a limit word plus
    // exceeded/reached) so ids like "quota-preview" or "rate-limit-preview"
    // don't match.
    /quota\s+(?:exceeded|reached|exhausted)|insufficient\s+quota/i.test(text) ||
    /\brate[\s-]?limits?\s+(?:exceeded|reached|hit)\b|\brate\s+limited\b/i.test(text) ||
    /\busage[\s-]?limits?\s+(?:exceeded|reached)\b/i.test(text) ||
    // Policy denials (prose forms).
    /organization\s+policy|request\s+denied/i.test(text) ||
    // snake_case error codes — ONLY in an error-code field or standing alone
    // as their own message line, never as substrings of model ids
    // ("Model not found rate_limit-preview" must not match).
    SNAKE_CODE_FIELD.test(text) ||
    SNAKE_CODE_LINE.test(text)
  );
}

const SNAKE_TERMINAL_CODES =
  "(?:rate_limit(?:_exceeded)?|usage_limit(?:_reached)?|invalid_api_key|authentication_failed|not_logged_in|organization_policy|request_denied|insufficient_quota)";
const SNAKE_CODE_FIELD = new RegExp(
  `["']?(?:code|type|error)["']?\\s*[:=]\\s*["']${SNAKE_TERMINAL_CODES}["']?`,
  "i"
);
const SNAKE_CODE_LINE = new RegExp(`^(?:\\s*(?:error:?\\s*)?)${SNAKE_TERMINAL_CODES}\\s*$`, "im");

function isModelNotFoundError(r) {
  const text = `${r.stderr || ""}\n${r.stdout || ""}`;
  // ONLY the exact model-identity failure forms count. Deliberately narrow:
  //   - "Model not found <id>"                       (openai/codex core tests)
  //   - "The <id> model is not supported when using Codex with a ChatGPT
  //      account"                                    (実機再現 2026-07-23)
  //   - "model_not_found"                            (structured API error code)
  // Broad phrases like "unsupported model ..." or "... model is not supported
  // by <policy>" are NOT matched: they also appear in org-policy denials and
  // internal parser errors ("unsupported model item type"), where an
  // identity-changing fallback would be wrong.
  //
  // The full ChatGPT-account form is a decisive model-identity failure even
  // when the server delivers it wrapped in 403 Forbidden. The exemption is
  // MATCH-SPAN-scoped: only the form itself plus its directly attached 403
  // wrapper are removed (tolerating line wraps inside the form, since \s+
  // spans newlines), and the ENTIRE remainder still goes through the
  // terminal-failure guard — so any other decisive auth/quota/policy error,
  // even on the same physical line, still wins ("terminal classes always
  // win"). Truncated lookalikes ("... when using Codex under your
  // organization policy") do not match.
  const chatGptForm =
    /(?:(?:unexpected\s+)?status\s+403\s+forbidden:?\s*|403\s+forbidden:?\s*)?The\s+\S+\s+model\s+is\s+not\s+supported\s+when\s+using\s+Codex\s+with\s+a\s+ChatGPT\s+account\b/gi;
  if (text.match(chatGptForm)) {
    const remainder = text.replace(chatGptForm, " ");
    return !hasNonModelTerminalFailure(remainder);
  }
  if (hasNonModelTerminalFailure(text)) return false;
  return (
    // "Model not found <id>" at line start (with optional "ERROR:" prefix).
    // \s+ between the tokens tolerates terminal line-wrapping ("Model not\n
    // found", openai/codex#18793). Mid-sentence collisions ("config for model
    // not found in cache") do not match.
    /^(?:\s*(?:error:?\s*)?)model\s+not\s+found\b/im.test(text) ||
    // Real CLI HTTP wrapper form: "ERROR: unexpected status 404 Not Found:
    // Model not found ..." (openai/codex#26892, #29546). Requires the full
    // "404 Not Found:" wrapper immediately before the phrase.
    /404\s+not\s+found:\s*model\s+not\s+found\b/i.test(text) ||
    /\bmodel_not_found\b/i.test(text)
  );
}

async function runCodex(promptText, { model, effort, allowFallback = true }, timeoutMs) {
  // Pin the model explicitly so the advisor can't silently drop below the top
  // tier via a stale host default. If the pinned model id is not served
  // (classified narrowly by isModelNotFoundError), retry once WITHOUT --model
  // (defer to the codex default) and label the degradation. Every other
  // failure class is returned as a failure, unmasked.
  const pinnedModel = model || CODEX_MODEL;
  const baseArgs = [
    "exec",
    "--sandbox",
    "read-only",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--color",
    "never",
    "-C",
    os.tmpdir()
  ];
  const effortArgs = effort ? ["-c", `model_reasoning_effort=${JSON.stringify(effort)}`] : [];
  let usedModel = pinnedModel;
  let r = await runProcess(
    "codex",
    [...baseArgs, "--model", pinnedModel, ...effortArgs, "-"],
    promptText,
    timeoutMs
  );
  if (r.code !== 0 || !r.stdout.trim()) {
    if (allowFallback && isModelNotFoundError(r)) {
      // Pinned model id is not served — degrade to the codex default, labelled.
      r = await runProcess("codex", [...baseArgs, ...effortArgs, "-"], promptText, timeoutMs);
      usedModel = `(codex default; pinned ${pinnedModel} not served)`;
    } else if (isModelNotFoundError(r)) {
      r = {
        ...r,
        stderr:
          (r.stderr || "") +
          `\n[pinned model ${pinnedModel} appears not to be served; automatic fallback is disabled (--no-fallback)]`
      };
    }
    // Any other failure class (auth, timeout, policy, crash, empty output
    // without a model-not-found marker) surfaces as-is: no identity swap.
  }
  return {
    backend: "codex",
    model: usedModel,
    effort: effort || "(default)",
    ...r
  };
}

function renderBackendResult(r) {
  const head = `===== ${r.backend.toUpperCase()} (model=${r.model || "?"}, effort=${r.effort || "?"}) =====`;
  if (r.code === 0 && r.stdout.trim()) {
    return `${head}\n${r.stdout.trim()}`;
  }
  return `${head}\n[backend failed: exit ${r.code}]\n${(r.stderr || "").trim()}`;
}

// ---------------------------------------------------------------------------
// subcommands
// ---------------------------------------------------------------------------

// Validate --effort against the capability table of every SELECTED backend
// (and, for codex, the RESOLVED model — codex acceptance is model-dependent),
// BEFORE any dispatch. With --backend both an effort must be accepted by both
// sides, otherwise one advisor would die on an argument/HTTP error while the
// other runs (#76 A-P2/B-P30). No implicit remapping (e.g. minimal -> low):
// changing the requested effort semantics silently is not this tool's call.
function validateEffort(effort, backends, codexModel) {
  if (!effort) return;
  const rejected = [];
  if (backends.includes("fable") && !FABLE_EFFORTS.includes(effort)) {
    rejected.push(`fable (${FABLE_MODEL}) accepts: ${FABLE_EFFORTS.join(", ")}`);
  }
  if (backends.includes("codex")) {
    const efforts = codexEffortsFor(codexModel);
    if (efforts === null) {
      process.stderr.write(
        `[warning] effort not pre-validated: codex model "${codexModel}" is not in the ` +
          `verified capability table — the server enforces effort per model and may reject "${effort}"\n`
      );
    } else if (!efforts.includes(effort)) {
      rejected.push(`codex (${codexModel}) accepts: ${efforts.join(", ")}`);
    }
  }
  if (rejected.length) {
    fail(
      `--effort "${effort}" is not supported by: ${rejected.join("; ")}. Nothing was dispatched.`
    );
  }
}

async function cmdReview(args) {
  const backend = (args.backend || "both").toLowerCase();
  if (!["codex", "fable", "both"].includes(backend)) {
    fail(`invalid --backend "${backend}". Use codex, fable, or both.`);
  }
  const selectedBackends = backend === "both" ? ["fable", "codex"] : [backend];
  validateEffort(args.effort, selectedBackends, args.model || CODEX_MODEL);
  const allowFallback = !(
    args["no-fallback"] || process.env.SECOND_OPINION_NO_FALLBACK === "1"
  );

  const t = resolveTranscript(args);
  if (!t.path || !fs.existsSync(t.path)) {
    fail(`could not resolve the current transcript (${t.source}). Pass --source <path-to-jsonl>.`);
  }
  if (t.warning) process.stderr.write(`[warning] ${t.warning}\n`);

  const events = parseTranscript(t.path);
  if (!events.some((event) => event.kind === "user")) {
    fail(
      "unsupported or empty transcript format: no human messages were extracted; " +
        "refusing to request a context-free review"
    );
  }
  const extraction = buildExtraction(events, { full: !!args.full });
  const promptText = buildPromptText(buildContract(), extraction);

  const timeoutMs = Number(process.env.SECOND_OPINION_TIMEOUT_MS || 600000);
  // Run backends sequentially so their independent output and failures remain
  // easy to attribute. Advisor calls favor a deterministic handoff over latency.
  const thunks = [];
  if (backend === "fable" || backend === "both") {
    thunks.push(() => runFable(promptText, { effort: args.effort }, timeoutMs));
  }
  if (backend === "codex" || backend === "both") {
    thunks.push(() =>
      runCodex(promptText, { model: args.model, effort: args.effort, allowFallback }, timeoutMs)
    );
  }
  const results = [];
  for (const thunk of thunks) results.push(await thunk());

  process.stdout.write(
    `# Second opinion — backend=${backend}, transcript via ${t.source}\n\n`
  );
  process.stdout.write(results.map(renderBackendResult).join("\n\n"));
  process.stdout.write("\n");
  if (backend === "both") {
    process.stdout.write(
      "\n----- READER NOTE -----\n" +
        "Two independent reviewers above. Treat points BOTH raise as highest-priority; " +
        "treat points only ONE raises as blind-spot candidates to weigh.\n"
    );
  }
}

function cmdExtract(args) {
  const t = resolveTranscript(args);
  if (!t.path || !fs.existsSync(t.path)) {
    fail(`could not resolve the current transcript (${t.source}). Pass --source <path-to-jsonl>.`);
  }
  if (t.warning) process.stderr.write(`[warning] ${t.warning}\n`);
  const events = parseTranscript(t.path);
  process.stdout.write(buildExtraction(events, { full: !!args.full }) + "\n");
}

function cmdResolve(args) {
  const t = resolveTranscript(args);
  process.stdout.write(`${t.path || "(none)"}\t(via ${t.source})\n`);
  if (t.warning) process.stderr.write(`[warning] ${t.warning}\n`);
}

// Auth probes (#76 B-P24): an executable on PATH is only "installed", not
// "ready" — a logged-out CLI would fail at review time. Probe cheaply and
// report three distinguishable states: authenticated / not authenticated /
// probe failed (e.g. a fake binary that doesn't speak the auth protocol).
const AUTH_PROBE_TIMEOUT_MS = 15000;

function probeClaudeAuth() {
  const r = spawnSync("claude", ["auth", "status", "--json"], {
    encoding: "utf8",
    timeout: AUTH_PROBE_TIMEOUT_MS
  });
  if (r.error) return { authenticated: null, detail: `auth probe failed: ${r.error.message}` };
  // Only a clean exit counts: a non-zero exit with plausible-looking JSON is a
  // protocol mismatch (wrapper script / fake binary), not an authenticated CLI.
  if (r.status === 0) {
    try {
      const parsed = JSON.parse(r.stdout);
      if (typeof parsed.loggedIn === "boolean") {
        return {
          authenticated: parsed.loggedIn,
          detail: parsed.loggedIn ? `logged in (${parsed.authMethod || "?"})` : "not logged in"
        };
      }
    } catch {
      /* fall through */
    }
  }
  return {
    authenticated: null,
    detail: `auth probe failed: unexpected \`claude auth status --json\` output (exit ${r.status})`
  };
}

function probeCodexAuth() {
  const r = spawnSync("codex", ["login", "status"], {
    encoding: "utf8",
    timeout: AUTH_PROBE_TIMEOUT_MS
  });
  if (r.error) return { authenticated: null, detail: `auth probe failed: ${r.error.message}` };
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  // "Not logged in" contains the substring "logged in" — check the negative
  // forms FIRST so they can never read as ready. The real CLI pairs the
  // logged-out message with a non-zero exit; a logged-out message WITH exit 0
  // is a protocol mismatch (impostor/wrapper), distinct from a logged-out CLI.
  if (/not\s+logged\s+in|logged\s+out|no\s+credentials/i.test(out)) {
    if (r.status !== 0) {
      return { authenticated: false, detail: out.split("\n")[0] || "not logged in" };
    }
    return {
      authenticated: null,
      detail: "auth probe failed: logged-out message with exit 0 (protocol mismatch)"
    };
  }
  if (r.status === 0 && /logged in/i.test(out)) {
    return { authenticated: true, detail: out.split("\n")[0] };
  }
  if (r.status !== 0) {
    return {
      authenticated: null,
      detail: `auth probe failed: \`codex login status\` exit ${r.status}${out ? ` — ${out.split("\n")[0]}` : ""}`
    };
  }
  return { authenticated: null, detail: "auth probe failed: unrecognized `codex login status` output" };
}

function backendStatus(binPath, probe) {
  if (!binPath) return { installed: false, authenticated: null, status: "missing", detail: null };
  const { authenticated, detail } = probe();
  const status =
    authenticated === true
      ? "ready"
      : authenticated === false
        ? "installed (not authenticated)"
        : "installed (auth probe failed)";
  return { installed: true, authenticated, status, detail };
}

function cmdSetup(args) {
  const report = {
    claude: which("claude"),
    node: which("node"),
    codex: which("codex"),
    transcript: resolveTranscript(args)
  };
  const fable = backendStatus(report.claude, probeClaudeAuth);
  const codex = backendStatus(report.codex, probeCodexAuth);
  const status = {
    ok: fable.status === "ready" || codex.status === "ready",
    fable_backend: fable,
    codex_backend: codex,
    // Legacy booleans: kept for old consumers, now meaning installed AND authenticated.
    fable_backend_ready: fable.status === "ready",
    codex_backend_ready: codex.status === "ready",
    transcript_source: report.transcript.source,
    transcript_path: report.transcript.path,
    transcript_warning: report.transcript.warning,
    details: report
  };
  if (args.json) {
    process.stdout.write(JSON.stringify(status, null, 2) + "\n");
    return;
  }
  const line = (label, b, missingHint) =>
    `  ${label}: ${b.installed ? b.status.toUpperCase() : `MISSING — ${missingHint}`}${b.detail ? ` (${b.detail})` : ""}`;
  process.stdout.write(
    [
      `second-opinion setup`,
      line("Fable backend (claude -p)", fable, "`claude` not on PATH"),
      line("Codex backend (codex exec)", codex, "`codex` not on PATH"),
      `  transcript: ${status.transcript_path || "(unresolved)"} via ${status.transcript_source}`,
      status.transcript_warning ? `  note: ${status.transcript_warning}` : ""
    ]
      .filter(Boolean)
      .join("\n") + "\n"
  );
}

function which(bin) {
  if (process.platform === "win32") {
    const r = spawnSync("where", [bin], { encoding: "utf8" });
    return (r.stdout || "").trim() || null;
  }
  const r = spawnSync("sh", ["-c", `command -v ${bin}`], { encoding: "utf8" });
  return (r.stdout || "").trim() || null;
}

function fail(msg) {
  process.stderr.write(`second-opinion: ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  const args = parseArgs(argv.slice(1));
  switch (sub) {
    case "review":
      await cmdReview(args);
      break;
    case "extract":
      cmdExtract(args);
      break;
    case "resolve":
      cmdResolve(args);
      break;
    case "setup":
      cmdSetup(args);
      break;
    default:
      process.stderr.write(
        "usage: second-opinion.mjs <review|extract|resolve|setup> [options]\n"
      );
      process.exit(sub ? 1 : 0);
  }
}

main().catch((e) => {
  process.stderr.write(`second-opinion: ${e && e.stack ? e.stack : e}\n`);
  process.exit(1);
});
