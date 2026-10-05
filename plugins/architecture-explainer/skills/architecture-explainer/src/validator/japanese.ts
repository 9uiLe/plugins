import type { ExplanationModel } from "../domain/explanation-model"
import type { Findings } from "../domain/evidence"
import { attr, line, textContent, type HtmlFacts } from "./html"

const abstractLabels=new Set(["使用","呼び出し","依存","通信","連携","参照","利用","書き込む","読み出す","保存","取得"])
const ambiguous=/^(?:これ|それ|この処理|その値|該当するもの|前述のもの)(?:は|が|を|に|で|も|について|、)/
export function checkJapanese(facts:HtmlFacts,findings:Findings,model?:ExplanationModel):void {
  if(model){
    const glossary=new Map(model.glossary.map(item=>[item.concept,item]))
    if(model.glossary.length&&!facts.concepts.length)findings.warnings.push({code:"LANG004",message:"model has glossary but HTML has no data-concept"})
    const owners=new Map<string,Set<string>>()
    for(const entry of model.glossary)for(const term of [entry.preferred,...entry.code_terms,...entry.aliases])if(term)owners.set(term,new Set([...(owners.get(term)||[]),entry.concept]))
    for(const node of facts.concepts){const concept=attr(node,"data-concept"),entry=glossary.get(concept),label=textContent(node).trim().replace(/\s+/g," ")
      if(!entry){findings.warnings.push({code:"LANG004",message:`${concept} has no glossary entry`,line:line(node)});continue}
      const allowed=[entry.preferred,...entry.code_terms,...entry.aliases]
      if(!allowed.includes(label)){
        const other=owners.get(label)?.size&&![...owners.get(label)!].includes(concept)
        ;(other?findings.errors:findings.warnings).push({code:"LANG004",message:`${label} differs from preferred term ${entry.preferred}`,line:line(node)})
      }
    }
    for(const node of facts.prose){const prose=textContent(node);for(const entry of model.glossary)for(const word of entry.avoid)if(word&&prose.includes(word))findings.warnings.push({code:"LANG007",message:`${word} is discouraged for ${entry.concept}`,line:line(node)})}
  }
  for(const node of facts.prose){const block=textContent(node).trim(),sentences=block.split(/(?<=[。！？])/).map(s=>s.trim()).filter(Boolean)
    for(const sentence of sentences){if(ambiguous.test(sentence)||/(?:、|。)(?:これ|それ|この処理|その値)(?:は|が|を|に)/.test(sentence))findings.warnings.push({code:"LANG003",message:`ambiguous reference: ${sentence.slice(0,24)}`,line:line(node)})
      if((sentence.match(/場合|ため|ので/g)||[]).length>=3)findings.warnings.push({code:"LANG008",message:"several conditions or reasons in one sentence",line:line(node)})
      if(sentence.length>120&&((sentence.match(/、/g)||[]).length>=3||(sentence.match(/場合/g)||[]).length>=2))findings.hints.push({code:"LANG001",message:"long sentence with several clauses",line:line(node)})
      if(/を行う|を実施する|をすることができる/.test(sentence))findings.hints.push({code:"LANG009",message:"consider a direct action verb",line:line(node)})
    }
    if(sentences.length>6)findings.hints.push({code:"LANG002",message:"paragraph has many sentences",line:line(node)})
  }
  for(const arrow of facts.arrowLabels)if(abstractLabels.has(arrow.value))findings.warnings.push({code:"LANG006",message:`abstract arrow label ${arrow.value}`,line:arrow.line})
  for(const node of facts.responsibilities)if((textContent(node).match(/[。！？]/g)||[]).length>=3)findings.warnings.push({code:"LANG005",message:"responsibility has several claims",line:line(node)})
}
