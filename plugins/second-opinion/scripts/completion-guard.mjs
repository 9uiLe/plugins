#!/usr/bin/env node

function parsePayload(payload) {
  if (payload && typeof payload === "object") return payload;
  if (typeof payload !== "string") return null;
  try { return JSON.parse(payload); } catch { return null; }
}

const present = (value) => value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "");
const NON_SUPERVISED = new Set(["DIRECT_CLI", "HOST_NATIVE", "GENERIC_SUBAGENT", "SELF_CRITIQUE"]);
const DISPATCH_STATUSES = new Set(["dispatched", "completed", "failed"]);

export function evaluateCompletion(snapshot) {
  if (NON_SUPERVISED.has(snapshot?.transport)) return { applicable: false, valid: null, safeToSynthesize: null, status: "NOT_APPLICABLE", completion: null, findings: [] };
  const dispatch = snapshot?.dispatch || {};
  const collection = snapshot?.collection || {};
  const observation = snapshot?.observation || {};
  const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
  const findings = [];
  if (![snapshot?.transport, dispatch.id, dispatch.taskId, dispatch.assigneeHandle, dispatch.status, collection.reason, collection.firstFetchedAt, collection.finalizedAt, collection.cursor].every(present) || typeof collection.finalized !== "boolean" || !Number.isSafeInteger(collection.fetchAttempts) || collection.fetchAttempts < 1) findings.push({ code: "INCOMPLETE_COMPLETION_SNAPSHOT", blocking: true });
  if (snapshot?.transport !== "SUPERVISED") findings.push({ code: "UNSUPPORTED_TRANSPORT", blocking: true });
  if (!DISPATCH_STATUSES.has(dispatch.status)) findings.push({ code: "INVALID_DISPATCH_STATUS", blocking: true });
  if ([collection.firstFetchedAt, collection.finalizedAt].some((value) => present(value) && Number.isNaN(Date.parse(value)))) findings.push({ code: "INVALID_FETCH_TIME", blocking: true });
  if (observation.source !== "PERSISTED_MESSAGE_STORE" || !present(observation.cursor) || observation.cursor !== collection.cursor) findings.push({ code: "UNVERIFIED_MESSAGE_OBSERVATION", blocking: true });
  const matching = [];
  for (const message of messages.filter((item) => item?.type === "worker_done")) {
    const payload = parsePayload(message.payload);
    if (payload?.taskId !== dispatch.taskId || payload?.dispatchId !== dispatch.id || message.fromHandle !== dispatch.assigneeHandle) {
      findings.push({ code: "STALE_OR_MISMATCHED_WORKER_DONE", ref: message.id || null, blocking: false });
      continue;
    }
    if (!present(message.id) || !Number.isSafeInteger(message.sequence) || message.sequence < 0) {
      findings.push({ code: "UNIDENTIFIED_WORKER_DONE", ref: message.id || null, blocking: true });
      continue;
    }
    const recoverableReport = present(payload.reportPath) && present(message.reportContent);
    if (!present(message.body) && !recoverableReport) {
      findings.push({ code: "UNRECOVERABLE_WORKER_RESULT", ref: message.id, blocking: true });
      continue;
    }
    matching.push({ messageId: message.id, sequence: message.sequence, body: present(message.body) ? message.body : null, reportPath: recoverableReport ? payload.reportPath : null, reportContent: recoverableReport ? message.reportContent : null, recoveryMode: present(message.body) ? "INLINE_BODY" : "CAPTURED_REPORT", payload });
  }
  if (matching.length > 1) findings.push({ code: "DUPLICATE_WORKER_DONE", blocking: true });
  if (dispatch.status === "completed" && collection.finalized === true && matching.length === 0) findings.push({ code: "MISSING_WORKER_DONE", blocking: true });
  if (dispatch.status === "failed") findings.push({ code: "DISPATCH_FAILED", blocking: true });
  const valid = dispatch.status === "completed" && collection.finalized === true && matching.length === 1 && !findings.some((finding) => finding.blocking);
  const blocked = findings.some((finding) => finding.blocking);
  return { applicable: true, valid, safeToSynthesize: valid, status: valid ? "COMPLETE" : blocked ? "BLOCKED" : "IN_PROGRESS", completion: valid ? matching[0] : null, findings };
}

async function main() {
  if (process.argv[1] !== new URL(import.meta.url).pathname) return;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const result = evaluateCompletion(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.valid === false ? 1 : 0;
}
main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2; });
