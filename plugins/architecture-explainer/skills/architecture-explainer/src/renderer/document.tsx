import React from "react"
import type { ExplanationModel } from "../domain/explanation-model"
import type { Presentation } from "../domain/presentation"
import { ArchitectureView } from "../components/architecture/views"
import { RenderState } from "../components/architecture/common"

export function Document({model,presentation,css}:{model:ExplanationModel;presentation:Presentation;css:string}) {
  const state=new RenderState(model), title=presentation.title||model.subject.title
  return <html lang="ja"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>{title}</title><style dangerouslySetInnerHTML={{__html:css}}/></head>
    <body data-theme={presentation.theme}><a className="skip" href="#main">本文へ移動</a>
      <header className="doc-header"><p className="eyebrow">読者: {model.audience.profile} · 根拠: {model.source.revision}</p><h1>{title}</h1><p>{model.subject.question}</p></header>
      <div className="page"><nav className="toc" aria-label="目次"><ol>{presentation.sections.map(section=><li key={section.id}><a href={`#${section.id}`}>{section.question}</a></li>)}</ol></nav>
        <main id="main">{presentation.sections.map(section=><section key={section.id} id={section.id} className={section.id==="what"?"first-view":undefined}><h2>{section.question}</h2><ArchitectureView section={section} state={state}/></section>)}
          {model.unknowns.length>0&&<section id="unknown-appendix"><h2>不明点の解消方法</h2><ol>{model.unknowns.map(item=><li key={item.id} id={`unknown-${item.id}`}><strong>{item.question}</strong> — {item.reason}。解消方法: {item.how_to_resolve}</li>)}</ol></section>}
          <section id="evidence"><h2>根拠一覧</h2><ol>{model.evidence.map(item=><li key={item.id} id={`source-${item.id}`}>{item.kind} · {item.revision}{item.file&&<> · <code>{item.file}{item.line?`:${item.line}`:""}</code></>}{item.symbol&&<> · <code>{item.symbol}</code></>}{item.note&&<> · {item.note}</>}</li>)}</ol></section>
        </main>
      </div>
    </body>
  </html>
}
