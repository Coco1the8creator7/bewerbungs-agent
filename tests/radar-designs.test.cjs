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
 assert.equal(app.choices.length,6);
 assert.equal(nodes.radarDesignOptions.children.length,6);
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
 assert.equal(nodes.radarDial.dataset.design,undefined);
 nodes.radarDesignOptions.children[2].dispatchEvent({type:"click"});
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
