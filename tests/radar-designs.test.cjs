"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const model=require("../dashboard/radar-model.js");

test("new-job dots and existing KPIs share the exact same rows, dates and deduplication",()=>{
 const now=new Date(2026,9,29,14,0);
 const date=(d,h=8)=>new Date(2026,9,d,h,0).toISOString();
 const rows=[
  {id:"adult-mon",title:"Projektleiter Energietechnik",first_seen_at:date(26)},
  {id:"adult-wed",title:"Energieberatung",first_seen_at:date(28)},
  {id:"adult-thu",title:"Fachplanung",first_seen_at:date(29)},
  {id:"adult-thu",title:"Fachplanung",first_seen_at:date(29)},
  {id:"adult-old",title:"Energieentwicklung",first_seen_at:date(25)},
  {id:"apprentice",title:"Lehrstelle Schreiner EFZ",first_seen_at:date(29)},
  {id:"DEMO-fake",title:"Projektleiter",first_seen_at:date(29)},
  {id:"MANUAL-test",title:"Beispiel",first_seen_at:date(29)},
  {id:"undated",title:"Projektleitung"},
  {id:"future",title:"Projektleitung",first_seen_at:date(30)}
 ];
 for(const market of ["all","career","apprentice"]){
  const summary=model.summarize(rows,now,market);
  const recent=model.newJobs(rows,now,market,"yesterday");
  const week=model.newJobs(rows,now,market,"week");
  assert.equal(recent.length,summary.sinceYesterday,market+" yesterday");
  assert.equal(week.length,summary.thisWeek,market+" week");
  assert.equal(new Set(recent.map(j=>j.id)).size,recent.length,"one dot per job id");
  assert.ok(recent.every(j=>Date.parse(j.first_seen_at)<=now.getTime()));
 }
 assert.equal(model.newJobs(rows,now,"career","yesterday").length,2);
 assert.equal(model.newJobs(rows,now,"career","week").length,3);
 assert.equal(model.newJobs(rows,now,"apprentice","yesterday").length,1);
 assert.equal(model.newJobs([],now,"career","week").length,0);
});

function fakeUI(){
 class Node{
  constructor(tag="div"){
   this.tag=tag;this.dataset={};this.children=[];this.listeners={};this.attrs={};
   this.style={properties:{},setProperty(k,v){this.properties[k]=v;}};
   this.textContent="";this.disabled=false;
  }
  append(...args){this.children.push(...args);}
  replaceChildren(...args){this.children=args.flatMap(n=>n.tag==="fragment"?n.children:[n]);}
  setAttribute(key,value){this.attrs[key]=String(value);}
  getAttribute(key){return this.attrs[key];}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  dispatchEvent(e){(this.listeners[e.type]||[]).forEach(fn=>fn(e));return true;}
  querySelectorAll(selector){return this.children.filter(n=>selector==="[data-design]"&&n.dataset.design);}
 }
 const nodes={};
 for(const id of ["radarDial","radarTargets","radarDesignOptions","radarTargetCount","radarTargetPeriod"])
  nodes[id]=new Node();
 const buttons=["yesterday","week"].map(name=>{
  const node=new Node("button");node.dataset.period=name;
  node.setAttribute("aria-pressed",name==="yesterday");return node;
 });
 const document={
  getElementById:id=>nodes[id]||null,
  createElement:tag=>new Node(tag),
  createDocumentFragment:()=>new Node("fragment"),
  querySelectorAll:selector=>selector==="#radarPeriodControls [data-period]"?buttons:[]
 };
 const window={};
 class CustomEvent{constructor(type,opts){this.type=type;this.bubbles=Boolean(opts?.bubbles);}}
 vm.runInNewContext(fs.readFileSync(path.join(root,"dashboard/radar-designs.js"),"utf8"),
  {window,document,CustomEvent,Math,Object,Array});
 return {window,nodes,buttons};
}

test("exactly N DOM dots are created for 0, 1, 8, 250 and 1700 targets without hidden caps",()=>{
 const {window,nodes}=fakeUI();
 const app=window.CareerRadarDesigns;
 assert.equal(app.choices.length,7);
 assert.equal(app.choices[0].id,"zen");
 assert.equal(nodes.radarDesignOptions.children.length,7);
 assert.equal(nodes.radarDial.dataset.design,"zen");
 for(const n of [0,1,8,250,1700]){
  const jobs=Array.from({length:n},(_,i)=>({id:"new-"+i,title:"Stelle "+i}));
  assert.equal(app.setPoints(jobs,"in dieser Woche"),n);
  assert.equal(nodes.radarTargets.children.length,n);
  assert.equal(new Set(nodes.radarTargets.children.map(x=>x.dataset.jobId)).size,n);
  assert.equal(nodes.radarTargetCount.textContent,n.toLocaleString("de-CH"));
  assert.match(nodes.radarDial.getAttribute("aria-label"),new RegExp("genau "+n+" neue Inserate"));
 }
});

test("switching design and timeframe never inserts fake contacts",()=>{
 const {window,nodes,buttons}=fakeUI();
 const app=window.CareerRadarDesigns;
 const jobs=[{id:"a",title:"A"},{id:"b",title:"B"}];
 app.setPoints(jobs,"seit gestern");
 assert.equal(nodes.radarDial.dataset.design,"zen");
 nodes.radarDesignOptions.children[3].dispatchEvent({type:"click"});
 assert.equal(nodes.radarDial.dataset.design,"topography");
 assert.equal(nodes.radarTargets.children.length,2);
 let changed=0;
 nodes.radarDial.addEventListener("radar-period-changed",()=>changed++);
 buttons[1].dispatchEvent({type:"click"});
 assert.equal(changed,1);
 assert.equal(app.getPeriod(),"week");
 assert.equal(nodes.radarTargets.children.length,2);
 assert.equal(buttons[1].getAttribute("aria-pressed"),"true");
});

test("Radar UI uses one shared list for markers, excludes hardcoded decorative ping dots",()=>{
 const html=fs.readFileSync(path.join(root,"dashboard/index.html"),"utf8");
 const js=fs.readFileSync(path.join(root,"dashboard/radar.js"),"utf8");
 const css=fs.readFileSync(path.join(root,"dashboard/radar-designs.css"),"utf8");
 assert.match(html,/id="radarTargets"/);
 assert.match(html,/id="radarDesignOptions"/);
 assert.match(html,/id="radarTargetCount"/);
 assert.match(html,/data-period="week"/);
 assert.doesNotMatch(html,/class="radar-ping/);
 assert.match(js,/model\.newJobs\(jobs,now,market\(\),period\)/);
 assert.match(js,/CareerRadarDesigns\?\.setPoints\(newJobs/);
 assert.match(js,/radar-period-changed/);
 assert.match(css,/prefers-reduced-motion/);
});

test("Zen is the initial theme with four purely decorative concentric waves",()=>{
 const html=fs.readFileSync(path.join(root,"dashboard/index.html"),"utf8");
 const css=fs.readFileSync(path.join(root,"dashboard/radar-designs.css"),"utf8");
 const js=fs.readFileSync(path.join(root,"dashboard/radar-designs.js"),"utf8");
 assert.match(html,/id="radarDial" data-design="zen"/);
 assert.match(html,/RADAR-DESIGNS \/ 7 VARIANTEN/);
 assert.match(html,/class="radar-pulse-waves" aria-hidden="true"/);
 const inner=html.slice(html.indexOf('class="radar-pulse-waves"'),html.indexOf('class="radar-cross"'));
 assert.equal((inner.match(/class="radar-pulse-wave"/g)||[]).length,4);
 assert.match(css,/@keyframes radar-zen-expand/);
 assert.match(css,/radar-pulse-wave:nth-child\(4\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.radar-dial\[data-design="zen"\] \.radar-sweep\{display:none\}/);
 assert.match(css,/\.radar-dial\[data-design="zen"\] \.radar-target/);
 assert.match(js,/let selected="zen"/);
 assert.doesNotMatch(js,/container\.append\(.*radar-pulse/);
});

test("pulse design switch changes CSS only; targets and jobs stay untouched",()=>{
 const {window,nodes}=fakeUI();
 const api=window.CareerRadarDesigns;
 api.setPoints([{id:"job-1",title:"A"},{id:"job-2",title:"B"},{id:"job-3",title:"C"}],"seit gestern");
 const targets=nodes.radarTargets.children.slice();
 for(const button of nodes.radarDesignOptions.children){
  button.dispatchEvent({type:"click"});
  assert.equal(nodes.radarTargets.children.length,3);
  assert.ok(targets.every((point,index)=>point===nodes.radarTargets.children[index]),
   "Changing design must not re-create, delete, or add any job targets");
 }
 nodes.radarDesignOptions.children[0].dispatchEvent({type:"click"});
 assert.equal(nodes.radarDial.dataset.design,"zen");
 const zenSwatch=nodes.radarDesignOptions.children[0].children[0];
 assert.equal(zenSwatch.children.length,2);
 assert.equal(zenSwatch.children[1].children.length,4);
});

test("published Zen assets have matching cache-busting versions and highest stylesheet priority",()=>{
 const html=fs.readFileSync(path.join(root,"dashboard/index.html"),"utf8");
 const version="20261027-zen-magenta-1";
 for(const src of ["radar-model.js","radar-designs.js","radar.js"]){
  assert.ok(html.includes('src="./'+src+'?v='+version+'"'),src+" must bypass stale browser cache");
 }
 for(const src of ["radar.css","radar-designs.css"]){
  assert.ok(html.includes('href="./'+src+'?v='+version+'"'),src+" must bypass stale browser cache");
 }
 const zen=html.indexOf('href="./radar-designs.css?v='+version+'"');
 const base=html.indexOf('href="./radar.css?v=20261027-radar-clean-1"');
 const others=html.indexOf('href="./urban-mono-magenta.css');
 assert.ok(zen>base&&zen>others,"Pulse stylesheet must be last, after the global magenta theme");
 const dial=html.match(/id="radarDial"[^>]+/);
 assert.match(dial?.[0]||"",/data-design="zen"/);
 assert.doesNotMatch(html,/href="\.\/radar-designs\.css"/);
 assert.doesNotMatch(html,/src="\.\/radar-designs\.js"/);
});

test("design-picker visibility: hidden previews, with Zen, time windows and live point layer intact",()=>{
 const html=fs.readFileSync(path.join(root,"dashboard/index.html"),"utf8");
 assert.match(html,/<div class="radar-design-heading" hidden>/);
 assert.match(html,/<div class="radar-design-options" id="radarDesignOptions"[^>]*hidden>/);
 assert.match(html,/id="radarDial" data-design="zen"/);
 assert.match(html,/id="radarTargets"/);
 assert.match(html,/id="radarPeriodControls"/);
 assert.match(html,/data-period="yesterday"/);
 assert.match(html,/data-period="week"/);
 const css=fs.readFileSync(path.join(root,"dashboard/radar.css"),"utf8");
 assert.match(css,/#mode-radar \[hidden\]\{display:none!important\}/);
});

test("Zen radar palette matches the existing global muted-magenta accent without changing job targets",()=>{
 const palette=fs.readFileSync(path.join(root,"dashboard/urban-mono-magenta.css"),"utf8");
 const css=fs.readFileSync(path.join(root,"dashboard/radar-designs.css"),"utf8");
 assert.match(palette,/--ca-accent: #95516E;/);
 assert.match(palette,/--ca-accent-hover: #793E58;/);
 assert.match(palette,/--ca-accent-soft: #F7EEF2;/);
 assert.match(palette,/--ca-accent-line: #E8D5DF;/);
 const zen=css.slice(css.indexOf("/* Design 07 / Zen Radar"));
 assert.ok(zen.length>1500);
 assert.match(zen,/--zen-ink:var\(--ca-accent,#95516E\)/);
 assert.match(zen,/--zen-line:var\(--ca-accent-line,#E8D5DF\)/);
 assert.match(zen,/\.radar-dial\[data-design="zen"\] \.radar-target/);
 assert.match(zen,/\.radar-pulse-wave:nth-child\(4\)/);
 assert.match(zen,/\.radar-metric\.is-active-period/);
 assert.doesNotMatch(zen,/#(?:668269|54705b|58775d|c2cdb9|faf7f0)\b/i);
 const {window,nodes}=fakeUI();
 for(const n of [0,1,12,300]){
  const jobs=Array.from({length:n},(_,i)=>({id:"job-"+i,title:"Teststelle "+i}));
  assert.equal(window.CareerRadarDesigns.setPoints(jobs,"seit gestern"),n);
  assert.equal(nodes.radarTargets.children.length,n);
 }
});
