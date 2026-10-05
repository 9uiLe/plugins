import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "../../../tests/fixture-repo"
import { modelForHtml, validate } from "../../../tests/eval/check-outputs"
import { validateHtml } from "../src/validator/validate"

test("evaluation fixture history is reproducible and defective HTML fails structural gates",()=>{
  const root=mkdtempSync(join(tmpdir(),"arch-fixture-test-"))
  const first=build(join(root,"first")),second=build(join(root,"second"))
  expect(first.commits).toEqual(second.commits)
  expect(first.commits.map(item=>item.subject)).toEqual(["feat: login, refresh token rotation, and async client SDK","fix(client): share one in-flight token refresh","docs: add architecture overview"])
  const report=validateHtml(readFileSync(join(root,"first/docs/architecture.html"),"utf8"),{sourceRoot:join(root,"first")})
  expect(new Set(report.errors.map(error=>error.code))).toEqual(new Set(["external-script","external-stylesheet","html-lang","meta-viewport","svg-label"]))
})
test("evaluation uses the documented model filename and reports missing or malformed models",()=>{
  const root=mkdtempSync(join(tmpdir(),"arch-eval-test-")),html=join(root,"architecture.improved.html")
  writeFileSync(html,'<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T</title></head><body><h1>T</h1></body></html>')
  expect(modelForHtml(html)).toBe(join(root,"architecture.explanation-model.json"))
  expect(validate(html,root).errors).toContain("missing-model")
  writeFileSync(modelForHtml(html),'{"glossary":null}')
  expect(validate(html,root).errors).toContain("validator-failed")
})
