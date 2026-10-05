import { afterAll, expect, test } from "bun:test"
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const project=resolve(import.meta.dir,"..")
const fixtures=resolve(import.meta.dir,"../../../tests/fixtures/presentation")
const temp=mkdtempSync(join(tmpdir(),"architecture-explainer-cli-"))
afterAll(()=>rmSync(temp,{recursive:true,force:true}))
const modelFile=join(temp,"model.json"),presentationFile=join(temp,"presentation.json"),htmlFile=join(temp,"index.html")
copyFileSync(join(fixtures,"auth-model.json"),modelFile)
copyFileSync(join(fixtures,"auth-presentation.json"),presentationFile)

function cli(...args:string[]){return spawnSync("bun",["src/cli.ts",...args],{cwd:project,encoding:"utf8"})}
function expectCleanFailure(args:string[],message:string){
  const result=cli(...args)
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain(`Error: ${message}`)
  expect(result.stderr).not.toContain(" at ")
  expect(result.stderr).not.toContain("src/cli.ts:")
}

test("render and validate use readable CLI output",()=>{
  const rendered=cli("render","--model",modelFile,"--presentation",presentationFile,"--output",htmlFile)
  expect(rendered.status).toBe(0)
  expect(rendered.stdout.trim()).toBe(htmlFile)
  expect(readFileSync(htmlFile,"utf8")).toContain("<style>")
  const validated=cli("validate",htmlFile,"--model",modelFile,"--source-root",resolve(fixtures,"../auth-service/1-feature"))
  expect(validated.status).toBe(0)
  const report=JSON.parse(validated.stdout)
  expect(report.ok).toBe(true)
  expect(report.errors).toEqual([])
  expect(report.warnings).toEqual([])
})
test("CLI errors are nonzero, human-readable and stack-free",()=>{
  const malformed=join(temp,"malformed.json"),invalid=join(temp,"invalid.json")
  writeFileSync(malformed,"{broken")
  writeFileSync(invalid,JSON.stringify({subject:{title:"T"}}))
  expectCleanFailure(["render","--model",join(temp,"missing.json"),"--presentation",presentationFile,"--output",htmlFile],"cannot read JSON file")
  expectCleanFailure(["render","--model",malformed,"--presentation",presentationFile,"--output",htmlFile],"invalid JSON")
  expectCleanFailure(["render","--model",invalid,"--presentation",presentationFile,"--output",htmlFile],"Explanation Model schema")
  expectCleanFailure(["validate",join(temp,"missing.html")],"cannot read HTML file")
  expectCleanFailure(["validate",htmlFile,"--source-root",join(temp,"missing-source")],"source root is not a readable directory")
  expectCleanFailure(["render","--model",modelFile,"--presentation",presentationFile],"--output is required")
  expectCleanFailure(["unknown"],"Usage:")
})
test("inspect reports stable model counts and rejects malformed models",()=>{
  const result=cli("inspect",modelFile)
  expect(result.status).toBe(0)
  const inspected=JSON.parse(result.stdout)
  expect(inspected.subject.title).toBe("認証フロー")
  expect(inspected.counts).toEqual({components:3,scenarios:2,decisions:1,unknowns:2,evidence:4})
  const malformed=join(temp,"invalid-inspect.json")
  writeFileSync(malformed,"{invalid")
  expectCleanFailure(["inspect",malformed],"invalid JSON")
})
test("lint returns a stable JSON result and nonzero for semantic errors",()=>{
  const valid=cli("lint",modelFile)
  expect(valid.status).toBe(0)
  expect(JSON.parse(valid.stdout)).toMatchObject({ok:true,errors:[],warnings:[],hints:[]})
  const model=JSON.parse(readFileSync(modelFile,"utf8"))
  model.purpose.evidence=[]
  const invalid=join(temp,"semantic-error.json")
  writeFileSync(invalid,JSON.stringify(model))
  const result=cli("lint",invalid)
  expect(result.status).toBe(1)
  expect(JSON.parse(result.stdout)).toMatchObject({ok:false,errors:[{code:"claim-evidence"}]})
})
test("help is readable at the root and command level",()=>{
  for(const args of [["--help"],["render","--help"]]){
    const result=cli(...args)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("architecture-explainer render")
    expect(result.stdout).toContain("architecture-explainer validate")
    expect(result.stdout).toContain("architecture-explainer inspect")
    expect(result.stdout).toContain("architecture-explainer lint")
  }
})
