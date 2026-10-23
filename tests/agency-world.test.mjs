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
