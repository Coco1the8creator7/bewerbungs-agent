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
 assert.match(html,/\["radar","dossier","dispatch","interview","finale"\]/);
 assert.match(html,/window\.AgentAgency\.worldPhases\(model\)/);
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
 assert.equal(shown[0].analysisProgress.level,3);
 assert.equal(shown[0].analysisProgress.count,100);
 assert.equal(shown[0].count,1,"Radar growth is based on job imports");
 assert.equal(shown[0].level,0);
 assert.equal(shown[0].next,25,"Visual import milestones are provisional");
 assert.equal(shown[0].compact,false);
 const radarArt=renderSVG(shown[0].level,"radar");
 assert.match(radarArt,/agency-art-dish/);
 assert.ok((radarArt.match(/class="agency-art-structure"/g)||[]).length<=2,
  "Radar stays visually minimal even at high Analysis levels");
 assert.deepEqual(shown.slice(1).map(p=>p.title),["PREPPER","MACHER:IN","STALKER","SPEAKER","INSIDER","ENTREPRENEUR"]);
});
test("Agency modal has the annotated minimal header, no redundant intro and a close icon",()=>{
 const html=readFileSync(new URL("../dashboard/index.html",import.meta.url),"utf8");
 const section=html.slice(html.indexOf('<dialog class="agency-world"'),html.indexOf('id="agencyInspector"'));
 assert.match(section,/<h2 id="agencyTitle">Agency World<\/h2>/);
 assert.match(section,/id="closeAgency"[^>]*aria-label="Agency World schliessen"[^>]*>×<\/button>/);
 assert.doesNotMatch(section,/THE AGENCY \/ OPERATIONS ARCHIPELAGO|Deine lebendige Operationskarte|Eine Insel je Bewerbungsphase|id="agencySummary"/);
});


const natureSource=readFileSync(new URL("../dashboard/agency-nature.js",import.meta.url),"utf8");
runInNewContext(natureSource,context,{filename:"agency-nature.js"});
const natureRender=context.window.AgentAgencyArt.renderSVG;
test("All seven Nature Blend subjects have recognisably different SVG scenes",()=>{
 const themes=["radar","dossier","dispatch","comms","interview","advanced","finale"];
 const scenes=themes.map(theme=>natureRender(2,theme));
 assert.equal(new Set(scenes).size,7);
 for(let i=0;i<scenes.length;i++){
  assert.match(scenes[i],/class="agency-art agency-nature-art"/);
  assert.match(scenes[i],new RegExp('data-theme="'+themes[i]+'"'));
  assert.match(scenes[i],/agency-nature-landmark/);
  assert.doesNotMatch(scenes[i],/agency-art-terrain|<foreignObject|<script|onload=/i);
 }
 assert.match(scenes[0],/agency-art-dish/,"Radar has a dish tower");
 assert.match(scenes[1],/agency-nature-documents/,"Prepper makes dossiers");
 assert.match(scenes[2],/agency-nature-plane/,"Macher:in launches applications");
 assert.match(scenes[3],/agency-nature-pine/,"Stalker is a wooded station");
 assert.match(scenes[4],/agency-nature-deck/,"Speaker has an outdoor stage");
 assert.match(scenes[5],/agency-nature-structure/,"Insider has a stone base and annex");
 assert.match(scenes[6],/agency-nature-flag/,"Entrepreneur has a goal flag");
});
test("Nature Blend stages evolve without changing the stored CRM model",()=>{
 const themes=["radar","dossier","dispatch","comms","interview","advanced","finale"];
 for(const theme of themes){
  const stages=[0,1,2,3,4].map(level=>natureRender(level,theme));
  assert.equal(new Set(stages).size,5,"Distinct visible progress for "+theme);
  for(let i=0;i<5;i++)assert.match(stages[i],new RegExp('data-level="'+i+'"'));
 }
 assert.equal(natureRender(-99,"radar"),natureRender(0,"radar"));
 assert.equal(natureRender(99,"radar"),natureRender(4,"radar"));
 assert.match(natureRender(3,"analysis"),/data-theme="analysis"/,"Legacy Analysis gallery remains accessible");
});
test("Radar tower growth follows unique imported ads and never counts AI or manual ratings",()=>{
 const m=build({jobs:Array.from({length:76},(_,i)=>({id:"job-"+i})).concat([{id:"job-3"}]),
  ratings:makeRatings(200)});
 const radar=context.window.AgentAgency.worldPhases(m)[0];
 assert.equal(radar.count,76);
 assert.equal(radar.level,2);
 assert.equal(radar.next,150);
 assert.equal(radar.analysisProgress.level,4);
 const withoutJobs=context.window.AgentAgency.worldPhases(build({ratings:makeRatings(200)}))[0];
 assert.equal(withoutJobs.level,0);
});
test("Nature Blend assets load in the correct order and support reduced motion",()=>{
 const html=readFileSync(new URL("../dashboard/index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../dashboard/agency-nature.css",import.meta.url),"utf8");
 assert.ok(html.indexOf('src="./agency-art.js"')<html.indexOf('src="./agency-nature.js"'));
 assert.ok(html.indexOf('src="./agency-nature.js"')<html.indexOf('src="./agency-world.js"'));
 assert.ok(html.indexOf('href="./agency-theme-beige.css"')<html.indexOf('href="./agency-nature.css"'));
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/agency-map::before/);
});


const richSource=readFileSync(new URL("../dashboard/agency-nature-rich.js",import.meta.url),"utf8");
runInNewContext(richSource,context,{filename:"agency-nature-rich.js"});
const detailed=context.window.AgentAgencyArt.renderSVG;
test("Detailed Nature Blend has individual props in all seven scenes",()=>{
 const themes=["radar","dossier","dispatch","comms","interview","advanced","finale"];
 const signatures=[
  "agency-detail-radar-dome","agency-detail-dossier-bench","agency-detail-runway",
  "agency-detail-rope-bridge","agency-detail-presentation","agency-detail-vault-door",
  "agency-detail-garden-terrace"
 ];
 const output=themes.map(theme=>detailed(2,theme));
 assert.equal(new Set(output).size,7);
 for(let i=0;i<themes.length;i++){
  assert.match(output[i],new RegExp(signatures[i]),"missing visual motif "+themes[i]);
  assert.match(output[i],new RegExp('data-theme="'+themes[i]+'"'));
  assert.doesNotMatch(output[i],/fill="undefined"|stroke="undefined"|NaN|<script|onload=|<foreignObject/i);
 }
 assert.match(detailed(3,"radar"),/agency-detail-radar-signals/);
 assert.match(detailed(3,"comms"),/agency-detail-radio-activity/);
 assert.match(detailed(4,"finale"),/agency-detail-victory/);
});
test("Detailed scenery keeps the original seven scene milestones and legacy Analysis mode",()=>{
 const themes=["radar","dossier","dispatch","comms","interview","advanced","finale"];
 for(const theme of themes){
  const stages=[0,1,2,3,4].map(level=>detailed(level,theme));
  assert.equal(new Set(stages).size,5,"Five level-specific silhouettes: "+theme);
  assert.equal(detailed(-7,theme),stages[0]);
  assert.equal(detailed(18,theme),stages[4]);
 }
 assert.equal(detailed(2,"analysis"),natureRender(2,"analysis"));
});
test("Detailed Nature Blend assets load after base and the zoom remains opt-in",()=>{
 const html=readFileSync(new URL("../dashboard/index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../dashboard/agency-nature-rich.css",import.meta.url),"utf8");
 const js=readFileSync(new URL("../dashboard/agency-world.js",import.meta.url),"utf8");
 assert.ok(html.indexOf('src="./agency-nature.js"')<html.indexOf('src="./agency-nature-rich.js"'));
 assert.ok(html.indexOf('src="./agency-nature-rich.js"')<html.indexOf('src="./agency-world.js"'));
 assert.ok(html.indexOf('href="./agency-nature.css"')<html.indexOf('href="./agency-nature-rich.css"'));
 assert.match(js,/Szene vergrössern/);
 assert.match(js,/make\("details","agency-scene-detail"\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/agency-scene-detail-preview/);
});


const illustratedSource=readFileSync(new URL("../dashboard/agency-radar-illustrated.js",import.meta.url),"utf8");
runInNewContext(illustratedSource,context,{filename:"agency-radar-illustrated.js"});
test("Approved Nature Blend Radar uses real layered image assets instead of new SVG polygons",()=>{
 const stages=context.window.AgentAgencyArt.radarAssetStages;
 assert.equal(stages.length,5);
 assert.deepEqual(stages.map(s=>s.level),[0,1,2,3,4]);
 assert.deepEqual(stages.map(s=>s.dome),[false,false,true,true,true]);
 assert.ok(stages[0].scale<stages[1].scale&&stages[1].scale<stages[2].scale&&
  stages[2].scale<stages[3].scale&&stages[3].scale<stages[4].scale);
 for(const name of ["base","tower","dome"]){
  const binary=readFileSync(new URL("../dashboard/assets/agency/radar-"+name+".webp",import.meta.url));
  assert.equal(binary.toString("ascii",0,4),"RIFF");
  assert.equal(binary.toString("ascii",8,12),"WEBP");
  assert.ok(binary.length<10000,"Small, local, optimized raster layer "+name);
 }
 // All legacy direct SVG methods remain compatible for Analysis and other worlds.
 for(const theme of ["radar","dossier","dispatch","comms","interview","advanced","finale","analysis"])
  assert.equal(context.window.AgentAgencyArt.renderSVG(2,theme),detailed(2,theme));
});
test("Radar scene assembles original art and animation layers by the existing import-driven level",()=>{
 const saved=context.document.createElement;
 context.document.createElement=(tag)=>{
  const el={tagName:tag,className:"",children:[],dataset:{},src:"",alt:null,
   isConnected:false,replaceWith(){},
   style:{props:{},setProperty(k,v){this.props[k]=v}},
   setAttribute(){},addEventListener(){},append(...children){this.children.push(...children)}};
  return el;
 };
 try{
  const scene=context.window.AgentAgencyArt.createScene({theme:"radar",id:"radar",level:4});
  assert.match(scene.className,/agency-radar-illustrated/);
  assert.equal(scene.dataset.level,"4");
  assert.equal(scene.children.length,4);
  assert.match(scene.children[0].src,/radar-base\.webp$/);
  assert.match(scene.children[1].src,/radar-tower\.webp$/);
  assert.equal(scene.children[2].children.length,3,"Dome and two signal waves");
  assert.match(scene.children[2].children[0].src,/radar-dome\.webp$/);
  assert.equal(scene.style.props["--radar-tower-size"],"1");
  const early=context.window.AgentAgencyArt.createScene({theme:"radar",level:0});
  assert.equal(early.children.length,2,"Empty radar station must not pretend to have a dome");
  const other=context.window.AgentAgencyArt.createScene({theme:"dossier",level:3});
  assert.doesNotMatch(other.className,/agency-radar-illustrated/);
 } finally {
  if(saved===undefined)delete context.document.createElement;
  else context.document.createElement=saved;
 }
});
test("Illustrated Radar loads after rich art and honors reduced motion",()=>{
 const html=readFileSync(new URL("../dashboard/index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../dashboard/agency-radar-illustrated.css",import.meta.url),"utf8");
 assert.ok(html.indexOf('src="./agency-nature-rich.js"')<html.indexOf('src="./agency-radar-illustrated.js"'));
 assert.ok(html.indexOf('href="./agency-nature-rich.css"')<html.indexOf('href="./agency-radar-illustrated.css"'));
 assert.match(css,/radar-nature-dome-rotate/);
 assert.match(css,/radar-nature-wave/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/212px;height:198px/);
});
