#!/usr/bin/env node
// SessionStart hook: record this session's transcript path into $CLAUDE_ENV_FILE
// so that second-opinion.mjs (run later from the skill) can locate the current
// transcript without an mtime scan. Fail-open: never block or noisily fail a
// session start.

import fs from "node:fs";
import process from "node:process";

const TRANSCRIPT_PATH_ENV = "SECOND_OPINION_TRANSCRIPT_PATH";
const SESSION_ID_ENV = "SECOND_OPINION_SESSION_ID";

function shellEscape(value) {
  // Wrap in single quotes and escape embedded single quotes as '"'"' so the
  // value survives being sourced by a POSIX shell.
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function appendEnvVar(name, value) {
  if (!process.env.CLAUDE_ENV_FILE || value == null || value === "") {
    return;
  }
  fs.appendFileSync(
    process.env.CLAUDE_ENV_FILE,
    `export ${name}=${shellEscape(value)}\n`,
    "utf8"
  );
}

function readHookInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

try {
  const input = readHookInput();
  if (process.env.CLAUDE_ENV_FILE) {
    appendEnvVar(TRANSCRIPT_PATH_ENV, input.transcript_path);
    appendEnvVar(SESSION_ID_ENV, input.session_id);
  } else if (input.transcript_path) {
    // Codex command hooks cannot persist shell environment variables for later
    // turns. SessionStart can, however, add deterministic developer context.
    // The skill passes this exact path back to the mechanical extractor.
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext:
            `SECOND_OPINION_TRANSCRIPT_PATH=${JSON.stringify(input.transcript_path)}. ` +
            "When the second-opinion skill runs, pass this exact value with --source; " +
            "do not summarize or curate the transcript."
        }
      })
    );
  }
} catch {
  // Swallow all errors: a capture failure must never disrupt the session.
}

process.exit(0);
