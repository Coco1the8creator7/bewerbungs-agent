"use strict";
/* The Agency MVP – read-only view model, no personal data is stored or published here.
   A future private, user-scoped CRM adapter can supply the same input contract. */
(function(){
 const definitions=[
  {id:"radar",title:"RADAR",name:"Stellen entdecken",metric:"Importierte Inserate (nur Information)",thresholds:[],theme:"radar"},
  {id:"analysis",title:"ANALYSIS HUB",name:"Inserate bewerten",metric:"Selbst bewertete Inserate",thresholds:[50,75,100,200],theme:"analysis"},
  {id:"dossier",title:"DOSSIER BUREAU",name:"Bewerbung vorbereiten",metric:"Vorgänge in Vorbereitung",thresholds:[1,3,7,15],theme:"dossier"},
  {id:"dispatch",title:"DISPATCH",name:"Bewerbungen versenden",metric:"Als versendet erfasste Bewerbungen",thresholds:[1,3,7,15],theme:"dispatch"},
  {id:"comms",title:"COMMS HUB",name:"Kontakte und Follow-ups",metric:"Dokumentierte Follow-ups",thresholds:[1,3,7,15],theme:"comms"},
  {id:"interview",title:"INTERVIEW",name:"Erstes Gespräch",metric:"Erreichte Gesprächsphasen",thresholds:[1,2,4,8],theme:"interview"},
  {id:"advanced",title:"ADVANCED OPS",name:"Weitere Gespräche",metric:"Erfasste weitere Gesprächsrunden",thresholds:[1,2,4,8],theme:"advanced"},
  {id:"finale",title:"FINAL HQ",name:"Angebot und Zusage",metric:"Erhaltene Angebote",thresholds:[1,2,3,5],theme:"finale"}
 ];
 const unique=xs=>new Set(xs);
 function buildModel({jobs=[],ratings=[],annotations=[],activityLog=[],demoMode=false}={}){
  const allowed=id=>typeof id==="string"&&(demoMode?id.startsWith("DEMO-"):!id.startsWith("DEMO-"));
  const status=new Map(annotations.filter(x=>x&&allowed(x.id)).map(x=>[x.id,x.decision]));
  const activities=activityLog.filter(e=>e&&allowed(e.job_id));
  const eventIds=type=>unique(activities.filter(e=>e.type===type).map(e=>e.job_id));
  const stageIds=stages=>unique([...status].filter(([,stage])=>stages.includes(stage)).map(([id])=>id));
  const reached=(type,stages)=>unique([...eventIds(type),...stageIds(stages)]).size;
  const analysis=unique(ratings.filter(r=>r&&allowed(r.id)&&Number.isInteger(r.score)&&r.score>=1&&r.score<=100).map(r=>r.id)).size;
  const counts={
   radar:jobs.filter(j=>j&&allowed(j.id)).length,
   analysis,
   dossier:reached("preparing",["preparing"]),
   dispatch:reached("applied",["applied","interview","interview2","offer","accepted"]),
   comms:activities.filter(e=>e.type==="follow_up").length,
   interview:reached("interview",["interview","interview2","offer","accepted"]),
   advanced:reached("interview2",["interview2"]),
   finale:reached("offer",["offer","accepted"])
  };
  const accepted=reached("accepted",["accepted"]);
  const islands=definitions.map(def=>{
   const count=counts[def.id],level=def.thresholds.filter(t=>count>=t).length;
   return {...def,count,level,maxLevel:def.thresholds.length,next:def.thresholds[level]??null,
    previous:level?def.thresholds[level-1]:0};
  });
  const achievements=[
   {title:"Erste Analyse",detail:"Erstes Inserat selbst bewertet",unlocked:analysis>=1},
   {title:"Radar Master",detail:"50 Inserate bewertet",unlocked:analysis>=50},
   {title:"Senior Analyst",detail:"100 Inserate bewertet",unlocked:analysis>=100},
   {title:"Elite Intelligence",detail:"200 Inserate bewertet",unlocked:analysis>=200},
   {title:"First Dispatch",detail:"Erste Bewerbung versendet",unlocked:counts.dispatch>=1},
   {title:"Persistence",detail:"5 Follow-ups dokumentiert",unlocked:counts.comms>=5},
   {title:"Face to Face",detail:"Erste Gesprächsphase erreicht",unlocked:counts.interview>=1},
   {title:"Mission Accomplished",detail:"Zusage ausdrücklich bestätigt",unlocked:accepted>=1}
  ];
  return {islands,achievements,accepted,demoMode};
 }
 const number=n=>Number(n).toLocaleString("de-CH");
 const make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
 function scene(phase){
  const panel=make("div","agency-scene");panel.setAttribute("aria-hidden","true");
  const level=Math.max(phase.level,phase.id==="radar"&&phase.count>0?1:0);
  const sky=make("div","agency-sky");panel.append(sky);
  const ground=make("div","agency-ground");panel.append(ground);
  const structures=make("div","agency-structures");panel.append(structures);
  if(level>=1){structures.append(make("div","agency-building agency-building-a"));structures.append(make("div","agency-antenna"));}
  if(level>=2){structures.append(make("div","agency-building agency-building-b"));structures.append(make("div","agency-light agency-light-a"));}
  if(level>=3){structures.append(make("div","agency-building agency-building-c"));structures.append(make("div","agency-person agency-person-a"));structures.append(make("div","agency-person agency-person-b"));}
  if(level>=4){structures.append(make("div","agency-tower"));structures.append(make("div","agency-person agency-person-c"));structures.append(make("div","agency-light agency-light-b"));}
  return panel;
 }
 function render(root,input){
  const model=buildModel(input);
  const board=root.querySelector("#agencyMap"),awards=root.querySelector("#agencyAwards"),inspector=root.querySelector("#agencyInspector");
  if(!board||!awards||!inspector)return model;
  board.replaceChildren();
  for(const p of model.islands){
   const b=make("button","agency-island");b.type="button";b.dataset.theme=p.theme;
   b.setAttribute("aria-pressed","false");
   b.setAttribute("aria-label",p.name+", "+number(p.count)+" "+p.metric+", Stufe "+p.level);
   b.append(make("span","agency-island-number",String(model.islands.indexOf(p)+1).padStart(2,"0")));
   b.append(scene(p));
   b.append(make("span","agency-island-title",p.title));
   b.append(make("span","agency-island-sub",p.name));
   b.append(make("span","agency-island-stat",number(p.count)+" · "+(p.maxLevel?"LEVEL "+p.level+"/"+p.maxLevel:"RADAR ONLINE")));
   const strip=make("span","agency-level-pips");
   for(let i=1;i<=p.maxLevel;i++)strip.append(make("i",i<=p.level?"is-active":""));
   b.append(strip);
   b.addEventListener("click",()=>{
    board.querySelectorAll(".agency-island").forEach(x=>x.setAttribute("aria-pressed","false"));
    b.setAttribute("aria-pressed","true");inspect(inspector,p);
   });
   board.append(b);
  }
  awards.replaceChildren();
  for(const a of model.achievements){
   const item=make("div","agency-award"+(a.unlocked?" earned":""));
   item.append(make("span","agency-award-glyph",a.unlocked?"✦":"◇"));
   const content=make("span","agency-award-copy");
   content.append(make("strong","",a.title));content.append(make("small","",a.detail));
   item.append(content);awards.append(item);
  }
  const header=root.querySelector("#agencySummary");
  if(header)header.textContent=number(model.islands.find(p=>p.id==="analysis").count)+" selbst bewertete Inserate · "+model.achievements.filter(a=>a.unlocked).length+" von "+model.achievements.length+" Achievements";
  inspect(inspector,model.islands.find(p=>p.id==="analysis"));
  if(board.children[1])board.children[1].setAttribute("aria-pressed","true");
  return model;
 }
 function inspect(target,p){
  target.replaceChildren();
  const head=make("div","agency-inspector-heading");
  head.append(make("strong","",p.name));
  head.append(make("span","",p.maxLevel?"Level "+p.level+" / "+p.maxLevel:"Informationsstation"));
  target.append(head);
  const msg=p.next===null?(p.maxLevel?"Höchste Entwicklungsstufe erreicht.":"Importierte Stellen werden angezeigt, aber nicht als eigene Leistung belohnt."):
   "Nächste Entwicklung bei "+number(p.next)+" · noch "+number(Math.max(0,p.next-p.count))+" bis zum nächsten Ausbau.";
  target.append(make("p","",number(p.count)+" "+p.metric+". "+msg));
  if(p.maxLevel){
   const track=make("div","agency-meter"),fill=make("span","");
   const span=(p.next??p.thresholds.at(-1))-p.previous;
   fill.style.width=(p.next===null?100:Math.min(100,Math.max(0,100*(p.count-p.previous)/Math.max(span,1))))+"%";
   track.append(fill);target.append(track);
  }
 }
 function open(root,input,{celebrate=false}={}){
  const model=render(root,input);
  const celebration=root.querySelector("#agencyCelebration");
  celebration.hidden=!(celebrate&&model.accepted>0);
  if(!root.open)root.showModal();
  return model;
 }
 window.AgentAgency=Object.freeze({buildModel,render,open});
})();