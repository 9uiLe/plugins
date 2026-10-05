import { strict as assert } from "node:assert"
import { cpSync, copyFileSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const project=resolve(import.meta.dir,"..")
const fixtures=resolve(import.meta.dir,"../../../tests/fixtures")
const temp=mkdtempSync(join(tmpdir(),"architecture-explainer-smoke-"))
try {
  const binary=join(temp,"architecture-explainer")
  copyFileSync(join(project,"dist/architecture-explainer"),binary)
  copyFileSync(join(fixtures,"presentation/auth-model.json"),join(temp,"model.json"))
  copyFileSync(join(fixtures,"presentation/auth-presentation.json"),join(temp,"presentation.json"))
  cpSync(join(fixtures,"auth-service/1-feature"),join(temp,"source"),{recursive:true})
  const env={PATH:"/usr/bin:/bin",HOME:temp}
  const run=(args:string[])=>{
    const result=spawnSync(binary,args,{cwd:temp,env,encoding:"utf8"})
    assert.equal(result.status,0,`${args[0]} failed: ${result.stderr}\n${result.stdout}`)
    return result.stdout
  }
  run(["render","--model","model.json","--presentation","presentation.json","--output","index.html"])
  const html=readFileSync(join(temp,"index.html"),"utf8")
  const css=html.match(/<style>([\s\S]+)<\/style>/)?.[1]||""
  assert.ok(css.length>1000,"inline CSS is missing")
  assert.match(css,/\.gap-3\{/)
  assert.match(css,/\.overflow-x-auto\{/)
  assert.doesNotMatch(html,/<script\b|__NEXT_DATA__|react-dom|<link[^>]+stylesheet/i)
  const report=JSON.parse(run(["validate","index.html","--model","model.json","--source-root","source"]))
  assert.deepEqual(report.errors,[])
  assert.deepEqual(report.warnings,[])
  assert.equal(report.ok,true)
  console.log(`standalone executable smoke passed (${statSync(binary).size} bytes)`)
} finally {
  rmSync(temp,{recursive:true,force:true})
}
