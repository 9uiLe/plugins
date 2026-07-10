#!/usr/bin/env node
// second-opinion.mjs — the mechanical engine behind the second-opinion skill.
//
// Responsibilities (all mechanical; the calling agent never curates content):
//   1. Resolve the CURRENT session transcript (no summarisation by the agent).
//   2. Extract a FIXED-FORMAT context from it (task def + every human message +
//      assistant reasoning + tool digest + every tool error). --full = verbatim.
//   3. Dispatch that context, wrapped in the five-section advisor contract, to
//      one or both backends (Fable via `claude -p`, Codex via codex-companion
//      `task`), with runtime-selected model/effort, and print their verdicts.
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
const VALID_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh"];
// Assistant-reasoning byte budget in default (non-full) mode. Human messages and
// tool errors are NEVER trimmed; only the middle of the reasoning chain is.
const ASSISTANT_CHAR_BUDGET = 120000;

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  const boolFlags = new Set(["full", "json"]);
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
  const toolNameById = new Map();
  const events = [];

  // First pass: build tool_use id -> name map.
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    let obj;
    try {
      obj = JSON.parse(s);
    } catch {
      continue;
    }
    const blocks = contentToBlocks(obj?.message?.content);
    for (const b of blocks) {
      if (b && b.type === "tool_use" && b.id) toolNameById.set(b.id, b.name || "?");
    }
  }

  // Second pass: emit events.
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    let obj;
    try {
      obj = JSON.parse(s);
    } catch {
      continue;
    }
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

function resolveCodexCompanion() {
  if (process.env.SECOND_OPINION_CODEX_COMPANION) {
    return process.env.SECOND_OPINION_CODEX_COMPANION;
  }
  const base = path.join(os.homedir(), ".claude", "plugins", "marketplaces");
  let markets;
  try {
    markets = fs.readdirSync(base);
  } catch {
    return null;
  }
  for (const m of markets) {
    const candidate = path.join(base, m, "plugins", "codex", "scripts", "codex-companion.mjs");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

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

async function runCodex(promptText, { model, effort }, timeoutMs) {
  const companion = resolveCodexCompanion();
  if (!companion) {
    return {
      backend: "codex",
      code: 127,
      stdout: "",
      stderr:
        "codex-companion.mjs not found. Install the openai-codex plugin, or set " +
        "SECOND_OPINION_CODEX_COMPANION to its path."
    };
  }
  const tmp = path.join(os.tmpdir(), `second-opinion-codex-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(tmp, promptText, "utf8");
  const args = [companion, "task", "--prompt-file", tmp];
  if (model) args.push("--model", model);
  if (effort) args.push("--effort", effort);
  const r = await runProcess("node", args, null, timeoutMs);
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  return {
    backend: "codex",
    model: model || "(default)",
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

function validateEffort(effort) {
  if (effort && !VALID_EFFORTS.includes(effort)) {
    fail(`invalid --effort "${effort}". Use one of: ${VALID_EFFORTS.join(", ")}`);
  }
}

async function cmdReview(args) {
  const backend = (args.backend || "both").toLowerCase();
  if (!["codex", "fable", "both"].includes(backend)) {
    fail(`invalid --backend "${backend}". Use codex, fable, or both.`);
  }
  validateEffort(args.effort);

  const t = resolveTranscript(args);
  if (!t.path || !fs.existsSync(t.path)) {
    fail(`could not resolve the current transcript (${t.source}). Pass --source <path-to-jsonl>.`);
  }
  if (t.warning) process.stderr.write(`[warning] ${t.warning}\n`);

  const events = parseTranscript(t.path);
  const extraction = buildExtraction(events, { full: !!args.full });
  const promptText = buildPromptText(buildContract(), extraction);

  const timeoutMs = Number(process.env.SECOND_OPINION_TIMEOUT_MS || 600000);
  // Run backends SEQUENTIALLY. The Codex app-server broker spawned by
  // codex-companion conflicts with a concurrently-running `claude -p` and
  // yields empty Codex output. An advisor call is not latency-critical, so we
  // trade parallelism for reliability.
  const thunks = [];
  if (backend === "fable" || backend === "both") {
    thunks.push(() => runFable(promptText, { effort: args.effort }, timeoutMs));
  }
  if (backend === "codex" || backend === "both") {
    thunks.push(() => runCodex(promptText, { model: args.model, effort: args.effort }, timeoutMs));
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

function cmdSetup(args) {
  const report = {
    claude: which("claude"),
    node: which("node"),
    codex_companion: resolveCodexCompanion(),
    transcript: resolveTranscript(args)
  };
  const codexOk = !!report.codex_companion;
  const fableOk = !!report.claude;
  const status = {
    ok: fableOk || codexOk,
    fable_backend_ready: fableOk,
    codex_backend_ready: codexOk,
    transcript_source: report.transcript.source,
    transcript_path: report.transcript.path,
    transcript_warning: report.transcript.warning,
    details: report
  };
  if (args.json) {
    process.stdout.write(JSON.stringify(status, null, 2) + "\n");
    return;
  }
  process.stdout.write(
    [
      `second-opinion setup`,
      `  Fable backend (claude -p): ${fableOk ? "READY" : "MISSING — `claude` not on PATH"}`,
      `  Codex backend (codex-companion task): ${codexOk ? "READY" : "MISSING — openai-codex plugin not found"}`,
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
