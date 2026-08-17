import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { RULES, routeOperation, auditManifest } from "../scripts/route-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function op(overrides = {}) {
  return {
    description: "op",
    producesDiff: false,
    outward: false,
    interpretationRequired: false,
    singleShot: false,
    allowlistedCommand: false,
    kind: "read",
    spec: {},
    ...overrides
  };
}

// 表形式: ルーティング代表・境界ケース (仕様書「受け入れ条件」対応表)。
const cases = [
  {
    name: "outward な操作 (git push) は P0",
    input: op({ description: "git push", outward: true, kind: "modify" }),
    expectedRule: "P0"
  },
  {
    name: "許可リスト内の単発読み取り (git status) は R0",
    input: op({ description: "git status", singleShot: true, allowlistedCommand: true, kind: "read" }),
    expectedRule: "R0"
  },
  {
    name: "同一サブタスク内の 2 手目以降 (singleShot=false) は R0 ではなく R1",
    input: op({ description: "2 手目の read", singleShot: false, allowlistedCommand: true, kind: "read" }),
    expectedRule: "R1"
  },
  {
    name: "grep 系の探索 (kind=search) は R1",
    input: op({ description: "grep for TODO", kind: "search", singleShot: true, allowlistedCommand: false }),
    expectedRule: "R1"
  },
  {
    name: "interpretationRequired=true の read (受け入れ判定用の diff 読解) は R4",
    input: op({ description: "diff を読み解いて受け入れ判定", kind: "read", interpretationRequired: true }),
    expectedRule: "R4",
    expectReasonIncludes: "interpretationRequired=true"
  },
  {
    name: "既知検証手順の実行 (npm test) は R2",
    input: op({ description: "npm test を実行", kind: "execute-verification" }),
    expectedRule: "R2"
  },
  {
    name: "失敗原因の仮説形成 (kind=judge) は分解せず R4",
    input: op({ description: "失敗原因の仮説形成", kind: "judge" }),
    expectedRule: "R4",
    expectReasonIncludes: "judge"
  },
  {
    name: "spec 4 フィールド完備の実装委譲は R3",
    input: op({
      description: "仕様確定済みの実装",
      producesDiff: true,
      kind: "modify",
      spec: { target: "t", expectedResult: "e", allowedScope: "a", verification: "v" }
    }),
    expectedRule: "R3"
  },
  {
    name: "spec の 1 フィールドが空だと R4 (reasons に欠落フィールド名)",
    input: op({
      description: "仕様が書き切れない実装",
      producesDiff: true,
      kind: "modify",
      spec: { target: "t", expectedResult: "e", allowedScope: "a", verification: "" }
    }),
    expectedRule: "R4",
    expectReasonIncludes: "verification"
  },
  {
    name: "kind=modify で spec なしは R4 (reasons に全欠落フィールド名)",
    input: op({ description: "spec 未記入の実装", producesDiff: true, kind: "modify" }),
    expectedRule: "R4",
    expectReasonIncludes: "target"
  }
];

for (const { name, input, expectedRule, expectReasonIncludes } of cases) {
  test(`routeOperation: ${name}`, () => {
    const result = routeOperation(input);
    assert.equal(result.rule, expectedRule);
    if (expectedRule === "R4") {
      assert.ok(result.reasons.length > 0, "R4 は reasons を持つ必要がある");
      if (expectReasonIncludes) {
        assert.ok(
          result.reasons.some((reason) => reason.includes(expectReasonIncludes)),
          `reasons に "${expectReasonIncludes}" を含む行が必要: ${JSON.stringify(result.reasons)}`
        );
      }
    } else {
      assert.deepEqual(result.reasons, []);
    }
  });
}

function manifest(tasks) {
  return { tasks };
}

function task(overrides = {}) {
  return {
    id: "t1",
    description: "task",
    rule: "R1",
    plannedAssignee: "haiku-scout",
    actualAssignee: "haiku-scout",
    status: "completed",
    ...overrides
  };
}

const auditCases = [
  {
    name: "予定どおり実効した R1 タスクは PASS",
    input: manifest([task()]),
    expectedStatus: "PASS",
    expectedCodes: []
  },
  {
    name: "未知の rule ID は UNKNOWN_RULE",
    input: manifest([task({ rule: "R9" })]),
    expectedStatus: "FINDINGS",
    expectedCodes: ["UNKNOWN_RULE"]
  },
  {
    name: "planned と actual が異なるのに deviationNote がなければ UNDOCUMENTED_DEVIATION",
    input: manifest([task({ plannedAssignee: "haiku-scout", actualAssignee: "main" })]),
    expectedStatus: "FINDINGS",
    expectedCodes: ["UNDOCUMENTED_DEVIATION"]
  },
  {
    name: "R4 行に r4Reason がなければ MISSING_R4_REASON",
    input: manifest([task({ rule: "R4", plannedAssignee: "main", actualAssignee: "main" })]),
    expectedStatus: "FINDINGS",
    expectedCodes: ["MISSING_R4_REASON"]
  },
  {
    name: "R3 行の specFields が欠落していれば INCOMPLETE_R3_SPEC",
    input: manifest([
      task({
        rule: "R3",
        plannedAssignee: "sonnet-implementer",
        actualAssignee: "sonnet-implementer",
        specFields: { target: "t", expectedResult: "e", allowedScope: "a" }
      })
    ]),
    expectedStatus: "FINDINGS",
    expectedCodes: ["INCOMPLETE_R3_SPEC"]
  },
  {
    name: "P0 行が assignee を持てば P0_HAS_ASSIGNEE",
    input: manifest([task({ rule: "P0", plannedAssignee: "main", actualAssignee: "main" })]),
    expectedStatus: "FINDINGS",
    expectedCodes: ["P0_HAS_ASSIGNEE"]
  }
];

for (const { name, input, expectedStatus, expectedCodes } of auditCases) {
  test(`auditManifest: ${name}`, () => {
    const result = auditManifest(input);
    assert.equal(result.status, expectedStatus);
    for (const code of expectedCodes) {
      assert.ok(result.findings.some((finding) => finding.code === code), `findings に ${code} が必要`);
    }
    if (expectedCodes.length === 0) {
      assert.deepEqual(result.findings, []);
    }
  });
}

// 二重正本ドリフト検知: references/02-decision-matrix.md はルール表の解説であり、
// scripts/route-policy.mjs の RULES がルーティングの正本。両者のルール ID と
// claude 側 assignee 名がズレたらこのテストが落ちる。
test("references/02-decision-matrix.md は RULES の全 id と claude 側 assignee 名を含む", () => {
  const doc = fs.readFileSync(path.join(__dirname, "../references/02-decision-matrix.md"), "utf8");
  for (const rule of RULES) {
    assert.ok(doc.includes(rule.id), `02-decision-matrix.md に ${rule.id} が見つからない`);
    assert.ok(
      doc.includes(rule.assignee.claude),
      `02-decision-matrix.md に assignee "${rule.assignee.claude}" (${rule.id}) が見つからない`
    );
  }
});
