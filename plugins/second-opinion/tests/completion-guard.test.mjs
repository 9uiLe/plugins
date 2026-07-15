import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCompletion } from "../scripts/completion-guard.mjs";

function snapshot(overrides = {}) {
  return {
    transport: "SUPERVISED",
    collection: { finalized: true, reason: "WORKER_DONE_RECEIVED", fetchAttempts: 2, firstFetchedAt: "2026-07-15T00:00:00Z", finalizedAt: "2026-07-15T00:00:01Z", cursor: "cursor-2" },
    observation: { source: "PERSISTED_MESSAGE_STORE", cursor: "cursor-2" },
    dispatch: { id: "ctx-1", taskId: "task-1", assigneeHandle: "term-1", status: "completed" },
    messages: [{ id: "msg-1", sequence: 1, type: "worker_done", fromHandle: "term-1", body: "Conditional acceptance.", reportContent: "Full report", payload: { taskId: "task-1", dispatchId: "ctx-1", reportPath: "/tmp/report.md" } }],
    ...overrides
  };
}

test("completed dispatch without worker_done is blocked", () => {
  const result = evaluateCompletion(snapshot({ messages: [] }));
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.findings.some((finding) => finding.code === "MISSING_WORKER_DONE"));
});

test("stale or mismatched worker_done cannot authorize completion", () => {
  const message = snapshot().messages[0];
  message.payload = { taskId: "old-task", dispatchId: "old-dispatch" };
  const result = evaluateCompletion(snapshot({ messages: [message] }));
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "STALE_OR_MISMATCHED_WORKER_DONE"));
});

test("worker_done from a different assignee cannot authorize completion", () => {
  const message = snapshot().messages[0]; message.fromHandle = "term-other";
  assert.equal(evaluateCompletion(snapshot({ messages: [message] })).valid, false);
});

test("matching durable worker_done authorizes completion", () => {
  const result = evaluateCompletion(snapshot());
  assert.equal(result.valid, true);
  assert.equal(result.completion.messageId, "msg-1");
});

test("report path recovers a result when body is empty", () => {
  const message = snapshot().messages[0]; message.body = "";
  const result = evaluateCompletion(snapshot({ messages: [message] }));
  assert.equal(result.valid, true);
  assert.equal(result.completion.recoveryMode, "CAPTURED_REPORT");
});

test("completion metadata without body or report is unrecoverable", () => {
  const message = snapshot().messages[0]; message.body = ""; message.payload = { taskId: "task-1", dispatchId: "ctx-1" };
  const result = evaluateCompletion(snapshot({ messages: [message] }));
  assert.ok(result.findings.some((finding) => finding.code === "UNRECOVERABLE_WORKER_RESULT"));
});

test("duplicate matching worker_done is blocked", () => {
  const messages = [snapshot().messages[0], { ...snapshot().messages[0], id: "msg-2", sequence: 2 }];
  assert.ok(evaluateCompletion(snapshot({ messages })).findings.some((finding) => finding.code === "DUPLICATE_WORKER_DONE"));
});

test("nonterminal dispatch remains in progress", () => {
  const result = evaluateCompletion(snapshot({ dispatch: { ...snapshot().dispatch, status: "dispatched" }, messages: [] }));
  assert.equal(result.status, "IN_PROGRESS");
});

test("completed but non-finalized collection remains in progress", () => {
  const result = evaluateCompletion(snapshot({ collection: { ...snapshot().collection, finalized: false }, messages: [] }));
  assert.equal(result.status, "IN_PROGRESS");
  assert.ok(!result.findings.some((finding) => finding.code === "MISSING_WORKER_DONE"));
});

test("whitespace-only body is not recoverable", () => {
  const message = snapshot().messages[0]; message.body = "   "; message.reportContent = "";
  assert.equal(evaluateCompletion(snapshot({ messages: [message] })).valid, false);
});

test("non-supervised transports are not applicable", () => {
  const result = evaluateCompletion({ transport: "DIRECT_CLI" });
  assert.equal(result.status, "NOT_APPLICABLE");
  assert.equal(result.valid, null);
  assert.equal(result.safeToSynthesize, null);
});

test("unknown transport and dispatch status fail closed", () => {
  assert.equal(evaluateCompletion({ transport: "SUPERVISED_TYPO" }).status, "BLOCKED");
  const result = evaluateCompletion(snapshot({ dispatch: { ...snapshot().dispatch, status: "cancelled" }, messages: [] }));
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.findings.some((finding) => finding.code === "INVALID_DISPATCH_STATUS"));
});

test("invalid collection and persistence evidence fail closed", () => {
  const result = evaluateCompletion(snapshot({
    collection: { ...snapshot().collection, fetchAttempts: 0, finalizedAt: "not-a-time" },
    observation: { source: "TRANSIENT_STREAM", cursor: "cursor-2" }
  }));
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.findings.some((finding) => finding.code === "UNVERIFIED_MESSAGE_OBSERVATION"));
});
