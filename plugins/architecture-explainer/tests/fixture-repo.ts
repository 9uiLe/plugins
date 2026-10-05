import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import { resolve, join } from "node:path"
import { spawnSync } from "node:child_process"

const fixture=resolve(import.meta.dir,"fixtures/auth-service")
const messages:Record<string,string>={
  "1-feature":"feat: login, refresh token rotation, and async client SDK",
  "2-fix":"fix(client): share one in-flight token refresh\n\nUsers were randomly logged out when several requests found the access\ntoken expired at the same time. Each request called /token/refresh with\nthe same refresh token; the server treated the second use as refresh\ntoken reuse and revoked the session.\n\nTokenManager now keeps the in-flight refresh task and lets concurrent\ncallers await it. force_refresh() takes the rejected access token and\nskips refreshing when another caller has already replaced it.",
  "3-docs":"docs: add architecture overview"
}
const gitEnv={...process.env,GIT_AUTHOR_NAME:"fixture",GIT_AUTHOR_EMAIL:"fixture@example.com",GIT_COMMITTER_NAME:"fixture",GIT_COMMITTER_EMAIL:"fixture@example.com",GIT_AUTHOR_DATE:"2026-09-01T00:00:00+00:00",GIT_COMMITTER_DATE:"2026-09-01T00:00:00+00:00"}
function git(cwd:string,...args:string[]):string {const result=spawnSync("git",["-c","init.defaultBranch=main","-c","commit.gpgsign=false",...args],{cwd,env:gitEnv,encoding:"utf8"});if(result.status!==0)throw new Error(result.stderr);return result.stdout.trim()}
export function build(destination:string){
  if(existsSync(destination)&&readdirSync(destination).length)throw new Error(`destination is not empty: ${destination}`)
  mkdirSync(destination,{recursive:true});git(destination,"init","-q")
  const commits=[]
  for(const layer of Object.keys(messages).sort()){
    cpSync(join(fixture,layer),destination,{recursive:true,force:true})
    git(destination,"add","-A");git(destination,"commit","-q","-m",messages[layer])
    commits.push({layer,sha:git(destination,"rev-parse","--short","HEAD"),subject:messages[layer].split("\n")[0]})
  }
  return {path:destination,commits}
}
if(import.meta.main){try{if(process.argv.length!==3)throw new Error("usage: bun fixture-repo.ts <destination>");console.log(JSON.stringify(build(resolve(process.argv[2])),null,2))}catch(error){console.error(`Error: ${error}`);process.exitCode=1}}
