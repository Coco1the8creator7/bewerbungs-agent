// Refresh persistence: only swipe choices are stored automatically, not the CRM workspace.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
async function run(){
 const html=fs.readFileSync("dashboard/index.html","utf8");
 const storage=fs.readFileSync("dashboard/storage.js","utf8");
 assert.match(storage,/SWIPE_PREFS_KEY = "landing-swipe-preferences-v1"/);
 assert.match(storage,/loadSwipePrefs: \(\) => operation\("readonly", store => store\.get\(SWIPE_PREFS_KEY\)\)/);
 assert.match(storage,/saveSwipePrefs: value => operation\("readwrite", store => store\.put\(value, SWIPE_PREFS_KEY\)\)/);
 assert.match(storage,/clear: async \(\) => \{/);
 assert.match(html,/const localSwipeChoices=new Map\(\)/);
 assert.match(html,/await loadLocalSwipeChoices\(\)/);
 assert.ok(html.indexOf("await loadLocalSwipeChoices()")<html.indexOf('fetch("./jobs.json"'),
  "decisions must be restored before imported cards are rendered");
 assert.match(html,/dismissedJobFeedback\.set\(id,record\);\s*lastDismissedId=id;\s*const durability=persistSwipeChoice\(id,record\)/);
 assert.match(html,/persistSwipeChoice\(id,\{signal:"restored",restored_at:new Date\(\)\.toISOString\(\)\}\)/);
 assert.match(html,/applyLocalSwipeChoices\(\);\s*selectedJobIds\.clear\(\)/);
 assert.match(html,/Weggewischte Stellen werden unabhängig davon als Inserat-ID und Entscheidung auf diesem Gerät gespeichert/);
 assert.doesNotMatch(storage,/localStorage|sessionStorage/);

 const start=html.indexOf("function validateSwipeChoices(data){");
 const end=html.indexOf("function dismissedLandingJobs(){",start);
 assert.ok(start>0&&end>start,"swipe persistence helpers exist");
 const helpers=html.slice(start,end);
 const saved={value:undefined,calls:[]};
 const makeContext=()=>{
  const dismissedJobFeedback=new Map();
  const positiveJobFeedback=new Map();
  const window={AgentStore:{
   async saveSwipePrefs(value){
    // Simulates IndexedDB writes; never stores ratings or entire job records.
    saved.value=structuredClone(value);
    saved.calls.push(structuredClone(value));
   },
   async loadSwipePrefs(){return structuredClone(saved.value);}
  }};
  const context={dismissedJobFeedback,positiveJobFeedback,window,Date,Promise,Error,String,Map,Number,
   validDate:value=>typeof value==="string"&&Number.isFinite(Date.parse(value))?Date.parse(value):null,
   validateDismissals:rows=>{
    const result=new Map();
    for(const r of rows){
     if(!r||r.signal!=="not_interested"||!["swipe_left","swipe_right","button"].includes(r.source)
        ||!Number.isFinite(Date.parse(r.dismissed_at)))throw Error("Ungültiger Eintrag");
     result.set(r.id,{signal:r.signal,source:r.source,dismissed_at:r.dismissed_at});
    }
    return result;
   },
   el:()=>({textContent:"",hidden:true})
  };
  const source='const localSwipeChoices=new Map();let pendingSwipeSave=Promise.resolve();\n'
   +helpers+'\n({localSwipeChoices,validateSwipeChoices,applyLocalSwipeChoices,loadLocalSwipeChoices,persistSwipeChoice})';
  return {api:vm.runInNewContext(source,context),dismissedJobFeedback,window};
 };
 const now="2026-11-04T12:00:00Z";
 const restoredAt="2026-11-04T12:05:00Z";
 const a=makeContext();
 await a.api.persistSwipeChoice("job-12",{signal:"not_interested",source:"swipe_right",dismissed_at:now});
 assert.equal(saved.value.version,1);
 assert.equal(saved.value.entries.length,1);
 assert.equal(saved.value.entries[0].id,"job-12");
 assert.equal(saved.value.entries[0].source,"swipe_right");
 assert.equal(saved.value.entries[0].score,undefined);
 assert.equal(saved.value.jobs,undefined);
 assert.equal(saved.value.relevance_ratings,undefined);
 assert.equal(saved.value.annotations,undefined);

 // Refresh: new in-memory state starts empty, but IndexedDB holds the choice.
 const refreshed=makeContext();
 await refreshed.api.loadLocalSwipeChoices();
 assert.equal(refreshed.dismissedJobFeedback.get("job-12").signal,"not_interested");
 assert.equal(refreshed.dismissedJobFeedback.get("job-12").source,"swipe_right");

 // A later GitHub fetch may be stale: local decision always wins for this browser.
 refreshed.dismissedJobFeedback.clear();
 refreshed.api.applyLocalSwipeChoices();
 assert.equal(refreshed.dismissedJobFeedback.has("job-12"),true);

 // Two close swipes must be serialised, not overwrite each other's ID.
 const a1=refreshed.api.persistSwipeChoice("job-13",{signal:"not_interested",source:"swipe_left",dismissed_at:now});
 const a2=refreshed.api.persistSwipeChoice("job-14",{signal:"not_interested",source:"button",dismissed_at:now});
 await Promise.all([a1,a2]);
 assert.equal(saved.value.entries.length,3);
 assert.equal(new Set(saved.value.entries.map(r=>r.id)).size,3);

 // Undo must survive a reload and suppress an older negative remote signal.
 await refreshed.api.persistSwipeChoice("job-12",{signal:"restored",restored_at:restoredAt});
 refreshed.dismissedJobFeedback.delete("job-12");
 const undone=makeContext();
 undone.dismissedJobFeedback.set("job-12",{signal:"not_interested",source:"swipe_right",dismissed_at:now});
 await undone.api.loadLocalSwipeChoices();
 assert.equal(undone.dismissedJobFeedback.has("job-12"),false);
 assert.equal(undone.dismissedJobFeedback.has("job-13"),true);
 assert.equal(undone.dismissedJobFeedback.has("job-14"),true);
 assert.equal(saved.value.entries.find(r=>r.id==="job-12").signal,"restored");

 // Backward compatibility and unsafe/corrupt storage records.
 assert.equal(undone.api.validateSwipeChoices(null).size,0);
 assert.throws(()=>undone.api.validateSwipeChoices({version:2,entries:[]}),/Ungültige/);
 assert.throws(()=>undone.api.validateSwipeChoices({version:1,entries:[
  {id:"abc",signal:"restored",restored_at:restoredAt},{id:"abc",signal:"restored",restored_at:restoredAt}
 ]}),/Ungültiger/);
 assert.throws(()=>undone.api.validateSwipeChoices({version:1,entries:[
  {id:"abc",signal:"not_interested",source:"swipe_left",dismissed_at:"bogus"}
 ]}),/Ungültiger/);

 // Storage failures must be surfaced, not silently reported as saved.
 undone.window.AgentStore.saveSwipePrefs=async()=>{throw Error("IndexedDB blockiert")};
 await assert.rejects(undone.api.persistSwipeChoice("job-15",{
  signal:"not_interested",source:"swipe_left",dismissed_at:now
 }),/IndexedDB blockiert/);
 console.log("Durable swipe/undo reload, stale GitHub, serial writes and corruption checks passed");
}
run().catch(err=>{console.error(err);process.exitCode=1;});
