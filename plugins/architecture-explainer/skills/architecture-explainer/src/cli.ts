#!/usr/bin/env bun
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { parseModel, parsePresentation } from "./domain/schema"
import { checkModel } from "./domain/evidence"
import { render } from "./renderer/render"
import { validateHtml } from "./validator/validate"

function option(args:string[],name:string):string|undefined {const i=args.indexOf(name);return i<0?undefined:args[i+1]}
function required(args:string[],name:string):string {const value=option(args,name);if(!value||value.startsWith("--"))throw new Error(`${name} is required`);return value}
function json(path:string):unknown {return JSON.parse(readFileSync(path,"utf8"))}
function usage():never {throw new Error("usage: architecture-explainer render --model model.json --presentation presentation.json --output index.html | validate index.html [--model model.json] [--source-root dir] | inspect model.json | lint model.json")}
export function main(args:string[]):number {
  try {
    const [command,...rest]=args
    if(command==="render"){
      const model=parseModel(json(required(rest,"--model"))),presentation=parsePresentation(json(required(rest,"--presentation"))),output=required(rest,"--output")
      const html=render(model,presentation);mkdirSync(dirname(output),{recursive:true});writeFileSync(output,html,"utf8");console.log(output);return 0
    }
    if(command==="validate"){
      if(!rest[0]||rest[0].startsWith("--"))usage()
      const modelPath=option(rest,"--model"),sourceRoot=option(rest,"--source-root")
      const report=validateHtml(readFileSync(rest[0],"utf8"),{model:modelPath?parseModel(json(modelPath)):undefined,sourceRoot})
      console.log(JSON.stringify({file:rest[0],...report},null,2));return report.ok?0:1
    }
    if(command==="inspect"){
      if(!rest[0])usage();const model=parseModel(json(rest[0]));console.log(JSON.stringify({subject:model.subject,audience:model.audience,source:model.source,counts:{components:model.components.length,scenarios:model.runtime_scenarios.length,decisions:model.decisions.length,unknowns:model.unknowns.length,evidence:model.evidence.length}},null,2));return 0
    }
    if(command==="lint"){
      if(!rest[0])usage();const model=parseModel(json(rest[0])),findings=checkModel(model);console.log(JSON.stringify({ok:!findings.errors.length,...findings},null,2));return findings.errors.length?1:0
    }
    usage()
  } catch(error){console.error(`Error: ${error instanceof Error?error.message:String(error)}`);return 1}
}
if(import.meta.main)process.exitCode=main(process.argv.slice(2))
