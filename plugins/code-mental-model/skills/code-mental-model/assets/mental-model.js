(()=>{
  const page=document.querySelector('.page');
  const links=[...document.querySelectorAll('.graph-link')];
  const details=[...document.querySelectorAll('.detail')];
  const stepPanel=document.getElementById('step-explanation');
  const stepDetails=[...stepPanel.querySelectorAll('.step-detail')];
  const endpoints=new Map([...document.querySelectorAll('.edge[data-from]')].map(e=>[e.dataset.detail,[e.dataset.from,e.dataset.to]]));
  let selected=null,mode='structure',scenario=page.dataset.scenario;
  document.documentElement.classList.add('has-js');
  function updateStepExplanation(){
    const active=mode==='execution'&&selected
      ?stepDetails.find(detail=>detail.dataset.stepScenario===scenario&&detail.dataset.stepEdge===selected)
      :null;
    stepPanel.hidden=!active;
    stepDetails.forEach(detail=>{detail.hidden=detail!==active});
  }
  function focus(id){
    selected=id;page.classList.add('is-focused');
    details.forEach(d=>d.classList.toggle('active',d.dataset.detail===id));
    const pair=endpoints.get(id),near=new Set(pair||[id]);
    links.forEach(link=>{
      const key=link.dataset.detail,ends=endpoints.get(key);
      const related=key!==id&&(near.has(key)||!!ends&&ends.some(v=>near.has(v)));
      link.classList.toggle('is-selected',key===id);
      link.classList.toggle('is-related',related);
      link.classList.toggle('is-muted',key!==id&&!related);
      if(key===id)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');
    });
    updateStepExplanation();
  }
  function overview(){
    selected=null;page.classList.remove('is-focused');
    details.forEach(d=>d.classList.remove('active'));
    links.forEach(link=>{link.classList.remove('is-selected','is-related','is-muted');link.removeAttribute('aria-current')});
    updateStepExplanation();
  }
  function renderMode(){
    page.dataset.mode=mode;page.dataset.scenario=scenario;
    document.querySelectorAll('.modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    document.querySelectorAll('.scenarios button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===scenario)));
    const questions=page.dataset.locale==='en-US'
      ?{structure:'What exists, and how is it connected?',execution:'Where does execution start, and what happens next?',change:'Which connections changed?'}
      :{structure:'何が存在し、どう繋がるか。',execution:'どこから始まり、どの順番で進むか。',change:'どの接続が変わったか。'};
    document.getElementById('mode-question').textContent=questions[mode];
    document.querySelectorAll('.edge').forEach(edge=>{
      const steps=JSON.parse(edge.dataset.execution||'{}');
      edge.classList.toggle('path-on',mode==='execution'&&!!steps[scenario]);
      const label=edge.querySelector('.step');
      if(label)label.textContent=steps[scenario]||'';
    });
    const activeNodes=new Set([...document.querySelectorAll('.edge.path-on')].flatMap(edge=>[edge.dataset.from,edge.dataset.to]));
    document.querySelectorAll('.node').forEach(node=>node.classList.toggle('path-node',mode==='execution'&&activeNodes.has(node.dataset.detail)));
    const selectedLink=links.find(link=>link.dataset.detail===selected);
    if(mode==='execution'&&selectedLink&&!selectedLink.classList.contains('path-on')&&!selectedLink.classList.contains('path-node'))overview();
    else if(selected)focus(selected);
    else updateStepExplanation();
  }
  links.forEach(link=>link.addEventListener('click',event=>{
    if(!details.some(d=>d.dataset.detail===link.dataset.detail))return;
    event.preventDefault();focus(link.dataset.detail);
  }));
  document.getElementById('overview-button').addEventListener('click',overview);
  document.getElementById('step-explanation-close').addEventListener('click',()=>{
    overview();
    document.querySelector('.modes button[data-mode=execution]')?.focus();
  });
  document.querySelectorAll('.modes button').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;renderMode()}));
  document.querySelectorAll('.scenarios button').forEach(b=>b.addEventListener('click',()=>{scenario=b.dataset.scenario;renderMode()}));
  renderMode();
})();
