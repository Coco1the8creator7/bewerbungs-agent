// Dossier filing from job cards: save first, then navigate; never fake a milestone.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

async function run(){
const html=fs.readFileSync("dashboard/index.html","utf8");
const dossier=fs.readFileSync("dashboard/dossiers.js","utf8");
const css=fs.readFileSync("dashboard/card-dossier-action.css","utf8");
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,"original CRM script must exist");
assert.doesNotThrow(()=>new Function(script));
assert.doesNotThrow(()=>new Function(dossier));
assert.match(html,/id="dossierTransferNotice"/);
assert.match(html,/card-dossier-action\.css\?v=/);
assert.match(html,/dossiers\.js\?v=20261031-secret-file-1/);
assert.match(html,/const dossierLinkedJobIds=new Set\(\)/);
assert.match(html,/dossierLinkedJobIds\.has\(j\.id\)/);
assert.match(html,/window\.addEventListener\("career-dossier-jobs-changed"/);
assert.match(html,/function secretDossierButton\(job\)/);
assert.match(html,/cardActions\.append\(secretDossierButton\(j\),cardRatingButton\(j\)\)/);
assert.match(html,/window\.location\.hash="#dossiers"/);
assert.match(html,/result\?\.dossierId/);
assert.match(html,/button\.setAttribute\("aria-busy","true"\)/);
assert.match(dossier,/window\.CareerDossiers=Object\.freeze\(\{prepare,addJob,listJobIds:/);
assert.match(dossier,/origin:"job-card"/);
assert.match(dossier,/status:"draft"/);
assert.match(dossier,/career-dossier-jobs-changed/);
assert.match(css,/#newJobsList \.card-secret-dossier/);
assert.match(css,/#newJobsList \.card-header-actions/);
assert.match(css,/min-height:44px/);

const addStart=dossier.indexOf(" async function addJob(job){");
const addEnd=dossier.indexOf("\n function prepare(job){",addStart);
assert.ok(addStart>=0&&addEnd>addStart);
const addSource=dossier.slice(addStart,addEnd);
assert.doesNotMatch(addSource,/career-dossier-prepared|setAnnotation|setRating/);
assert.match(addSource,/await put\("dossiers",entry\)/);
assert.match(addSource,/await refresh\(\)/);
assert.match(addSource,/await initialRefresh/);

// Run the original repository function against a controlled IndexedDB mock.
const state={dossiers:[],ready:true};
const saved=[];
const messages=[];
const ctx={
 state,
 refreshPending:Promise.resolve(),
 initialRefresh:Promise.resolve(),
 uniqueId:()=> "draft-"+(saved.length+1),
 async put(table,entry){assert.equal(table,"dossiers");saved.push(entry);},
 async refresh(){state.dossiers=[...saved];},
 notice:(text)=>messages.push(text),
 Date,Error,Promise,String
};
const addJob=vm.runInNewContext(addSource+"\naddJob",ctx);
const selected={id:"job-42",title:"Projektleitung Fernwärme",company:"Muster AG",location:"Zürich"};
const first=addJob(selected);
const second=addJob(selected);
const [added,already]=await Promise.all([first,second]);
assert.equal(added.added,true);
assert.equal(already.added,false);
assert.equal(added.dossierId,already.dossierId);
assert.equal(saved.length,1,"rapid double taps create exactly one draft");
assert.equal(saved[0].jobId,selected.id);
assert.equal(saved[0].title,selected.title);
assert.equal(saved[0].company,selected.company);
assert.equal(saved[0].location,selected.location);
assert.equal(saved[0].status,"draft");
assert.equal(saved[0].origin,"job-card");
assert.equal(saved[0].ownerId,null);
assert.equal(saved[0].preferences.tone,"klar");
assert.equal(saved[0].preferences.length,"standard");
assert.ok(messages.some(x=>x.includes("Dossierübersicht")));

await assert.rejects(addJob({id:"DEMO-1",title:"Fiktives Inserat"}),/kann nicht/);
await assert.rejects(addJob({id:"",title:""}),/kann nicht/);
assert.equal(saved.length,1);

// Failed IndexedDB writes cannot be represented as successful transfers.
const failing={
 state:{dossiers:[],ready:true},
 refreshPending:Promise.resolve(),initialRefresh:Promise.resolve(),
 uniqueId:()=> "bad",
 async put(){throw Error("Speicher verweigert");},
 async refresh(){throw Error("Should not refresh after failed write");},
 notice:()=>{},Date,Error,Promise,String
};
const addFail=vm.runInNewContext(addSource+"\naddJob",failing);
await assert.rejects(addFail(selected),/Speicher verweigert/);
assert.equal(failing.state.dossiers.length,0);
failing.state.ready=false;
await assert.rejects(addFail(selected),/nicht verfügbar/);

// The original refresh informs the landing of all linked IDs, including removals.
const refreshStart=dossier.indexOf(" async function refresh(){");
const refreshEnd=dossier.indexOf("\n function button(",refreshStart);
assert.ok(refreshStart>=0&&refreshEnd>refreshStart);
const refreshSource=dossier.slice(refreshStart,refreshEnd);
const refreshState={dossiers:[],files:[],ready:false};
const events=[];let renders=0;
const eventCtx={
 state:refreshState,
 async getAll(table){return table==="dossiers"?[...saved]:[];},
 render(){renders++;},
 window:{dispatchEvent:event=>events.push(event)},
 CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
 Promise
};
const refresh=vm.runInNewContext(refreshSource+"\nrefresh",eventCtx);
await refresh();
assert.equal(refreshState.ready,true);
assert.equal(renders,1);
assert.equal(events[0].type,"career-dossier-jobs-changed");
assert.equal(JSON.stringify(events[0].detail.job_ids),JSON.stringify([selected.id]));
saved.length=0;
await refresh();
assert.equal(JSON.stringify(events[1].detail.job_ids),"[]","removing Dossier restores landing membership");

// Run the actual clickable icon and transfer handler in isolation.
const transferStart=html.indexOf("async function transferJobToDossiers(job,button){");
const transferEnd=html.indexOf("function cardRatingButton(j){",transferStart);
assert.ok(transferStart>=0&&transferEnd>transferStart);
const transferSource=html.slice(transferStart,transferEnd);
assert.doesNotMatch(transferSource,/setRating|setAnnotation|logActivity|toggleExportSelection/);
class FakeButton{
 constructor(){this.type="button";this.className="";this.attrs={};this.disabled=false;this.events={};this.innerHTML="";this.title="";}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(type,handler){this.events[type]=handler;}
 click(){return this.events.click?.();}
}
const notice={textContent:"",hidden:true};
const route={hash:"#startseite"};
let transferred=null;
const uiCtx={
 window:{location:route,CareerDossiers:{async addJob(job){transferred=job;return {added:true,dossierId:"draft-1"};}}},
 document:{createElement:()=>new FakeButton()},
 el:id=>{assert.equal(id,"dossierTransferNotice");return notice;},
 Error
};
const ui=vm.runInNewContext(transferSource+"\n({transferJobToDossiers,secretDossierButton})",uiCtx);
const action=ui.secretDossierButton(selected);
assert.match(action.attrs["aria-label"],/Geheimakte/);
assert.match(action.innerHTML,/<svg.*<rect/s,"secret-file icon contains lock artwork");
await action.click();
assert.equal(route.hash,"#dossiers");
assert.equal(transferred.id,selected.id);
assert.equal(action.disabled,false);
assert.equal(action.attrs["aria-busy"],"false");
assert.equal(notice.hidden,true);
const demoButton=ui.secretDossierButton({id:"DEMO-4",title:"Demo"});
assert.equal(demoButton.disabled,true);
assert.equal(demoButton.events.click,undefined);

// A storage failure leaves the user and job card on the landing.
route.hash="#startseite";transferred=null;
uiCtx.window.CareerDossiers.addJob=async()=>{throw Error("IndexedDB ist gesperrt");};
const failedAction=ui.secretDossierButton(selected);
await failedAction.click();
assert.equal(route.hash,"#startseite");
assert.equal(failedAction.disabled,false);
assert.equal(notice.hidden,false);
assert.match(notice.textContent,/IndexedDB ist gesperrt/);
console.log("Dossier card transfer, duplicate, deletion and storage-error checks passed");
}
run().catch(err=>{console.error(err);process.exitCode=1;});
