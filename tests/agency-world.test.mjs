import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../dashboard/agency-world.js",import.meta.url),"utf8");
const context={window:{},document:{}};
runInNewContext(source,context,{filename:"agency-world.js"});
const build=context.window.AgentAgency.buildModel;
const makeRatings=n=>Array.from({length:n},(_,i)=>({id:"job-"+i,score:65}));
const island=(m,id)=>m.islands.find(p=>p.id===id);
test("Analysis Hub has exactly four cumulative thresholds and caps at level 4",()=>{
 for(const [count,expected,next] of [[0,0,50],[49,0,50],[50,1,75],[74,1,75],[75,2,100],[99,2,100],[100,3,200],[199,3,200],[200,4,null],[350,4,null]]){
  const p=island(build({ratings:makeRatings(count)}),"analysis");
  assert.equal(p.level,expected,"count="+count);
  assert.equal(p.next,next,"next threshold at count="+count);
  assert.equal(p.maxLevel,4);
 }
});
test("Imported jobs, AI scores, duplicates and empty user ratings never level up Analysis Hub",()=>{
 const m=build({
  jobs:[{id:"job-1",selection:{suggested_score:99}},{id:"job-2",matching:{score:99}}],
  ratings:[{id:"job-1",score:50},{id:"job-1",score:97},{id:"job-2",score:null},{id:"DEMO-x",score:90}],
  activityLog:[{id:"act-1",job_id:"job-2",type:"screened"}]
 });
 assert.equal(island(m,"analysis").count,1);
 assert.equal(island(m,"radar").count,2);
 assert.equal(island(m,"radar").level,0);
});
test("Events are deduplicated by job for milestones and retain progress after a declined status",()=>{
 const m=build({
  activityLog:[
   {id:"a1",job_id:"a",type:"applied"},
   {id:"a2",job_id:"a",type:"applied"},
   {id:"a3",job_id:"a",type:"interview"},
   {id:"a4",job_id:"a",type:"follow_up"},
   {id:"a5",job_id:"a",type:"follow_up"}
  ],
  annotations:[{id:"a",decision:"declined"}]
 });
 assert.equal(island(m,"dispatch").count,1);
 assert.equal(island(m,"interview").count,1);
 assert.equal(island(m,"comms").count,2);
});
test("An offer is not a confirmed acceptance and does not imply an interview",()=>{
 const m=build({annotations:[{id:"b",decision:"offer"}]});
 assert.equal(m.accepted,0);
 assert.equal(island(m,"interview").count,0);
 assert.equal(island(m,"finale").count,1);
 assert.equal(m.achievements.find(a=>a.title==="Mission Accomplished").unlocked,false);
});
test("A confirmed acceptance unlocks finale achievement while the view creates no new storage",()=>{
 const m=build({annotations:[{id:"b",decision:"accepted"}]});
 assert.equal(m.accepted,1);
 assert.equal(m.achievements.find(a=>a.title==="Mission Accomplished").unlocked,true);
});
test("Demo events do not affect real profile and real events do not affect demo",()=>{
 const args={ratings:[{id:"job-1",score:10},{id:"DEMO-1",score:20}]};
 assert.equal(island(build(args),"analysis").count,1);
 assert.equal(island(build({...args,demoMode:true}),"analysis").count,1);
});

const artSource=readFileSync(new URL("../dashboard/agency-art.js",import.meta.url),"utf8");
runInNewContext(artSource,context,{filename:"agency-art.js"});
const renderSVG=context.window.AgentAgencyArt.renderSVG;
test("Five Analysis Hub levels use distinct modular structures without altering thresholds",()=>{
 const art=[0,1,2,3,4].map(level=>renderSVG(level,"analysis"));
 assert.equal(new Set(art).size,5);
 for(let i=0;i<5;i++)assert.match(art[i],new RegExp('data-level="'+i+'"'));
 assert.deepEqual(art.map(svg=>(svg.match(/class="agency-art-structure"/g)||[]).length),[1,1,2,2,3]);
 assert.equal(art[0].includes("agency-art-drone"),false);
 assert.equal(art[3].includes("agency-art-landing"),true);
 assert.equal(art[4].includes("agency-art-landing"),true);
 assert.equal(renderSVG(99,"analysis"),renderSVG(4,"analysis"));
});
test("Agency artwork remains data-free and all known islands reuse one renderer",()=>{
 for(const theme of ["radar","analysis","dossier","dispatch","comms","interview","advanced","finale"]){
  const svg=renderSVG(1,theme);
  assert.match(svg,/<svg /);
  assert.match(svg,new RegExp('data-theme="'+theme+'"'));
  assert.doesNotMatch(svg,/<script|onload=|<foreignObject/i);
 }
});
test("Warm beige styling loads after the legacy theme and has reduced-motion safeguards",()=>{
 const html=readFileSync(new URL("../dashboard/index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../dashboard/agency-theme-beige.css",import.meta.url),"utf8");
 assert.ok(html.indexOf("agency-world.css")<html.indexOf("agency-theme-beige.css"));
 assert.ok(html.indexOf("agency-art.js")<html.indexOf("agency-world.js"));
 assert.match(css,/#f7eddd/i);
 assert.match(css,/prefers-reduced-motion/);
});

test("Mission Control previews use the same Agency renderer and current CRM levels",()=>{
 const html=readFileSync(new URL("../dashboard/index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../dashboard/agency-theme-beige.css",import.meta.url),"utf8");
 assert.equal((html.match(/class="mission-route-art"/g)||[]).length,5);
 assert.doesNotMatch(html,/id="routeShip"|el\("routeShip"\)/);
 assert.match(html,/window\.AgentAgency\.buildModel\(agencyData\(\)\)/);
 assert.match(html,/window\.AgentAgencyArt\.createScene\(phase\)/);
 assert.match(html,/\["radar","analysis","dispatch","interview","finale"\]/);
 assert.match(html,/host\.dataset\.sceneKey!==sceneKey/);
 assert.match(css,/#routeMap \.mission-route-art \.agency-art/);
 assert.match(css,/scroll-snap-type:x proximity/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});


test("World map has seven stops with Analysis milestones integrated into Radar",()=>{
 const data=build({jobs:[{id:"job-imported"}],ratings:makeRatings(100)});
 const shown=Array.from(context.window.AgentAgency.worldPhases(data));
 assert.deepEqual(shown.map(p=>p.id),["radar","dossier","dispatch","comms","interview","advanced","finale"]);
 assert.equal(data.islands.find(p=>p.id==="radar").count,1,"Original import count stays independent");
 assert.equal(data.islands.find(p=>p.id==="analysis").count,100,"Original Analysis count stays independent");
 assert.equal(shown[0].sourceId,"analysis");
 assert.equal(shown[0].level,3);
 assert.equal(shown[0].count,100);
 assert.equal(shown[0].compact,true);
 assert.deepEqual(shown.slice(1,4).map(p=>p.title),["PREPPER","MACHER:IN","STALKER"]);
});
test("Agency modal has the annotated minimal header, no redundant intro and a close icon",()=>{
 const html=readFileSync(new URL("../dashboard/index.html",import.meta.url),"utf8");
 const section=html.slice(html.indexOf('<dialog class="agency-world"'),html.indexOf('id="agencyInspector"'));
 assert.match(section,/<h2 id="agencyTitle">Agency World<\/h2>/);
 assert.match(section,/id="closeAgency"[^>]*aria-label="Agency World schliessen"[^>]*>×<\/button>/);
 assert.doesNotMatch(section,/THE AGENCY \/ OPERATIONS ARCHIPELAGO|Deine lebendige Operationskarte|Eine Insel je Bewerbungsphase|id="agencySummary"/);
});
