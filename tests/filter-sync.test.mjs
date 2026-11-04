import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {TextEncoder,TextDecoder} from "node:util";

const ghSource=readFileSync(new URL("../dashboard/github-sync.js",import.meta.url),"utf8");
const syncSource=readFileSync(new URL("../dashboard/filter-sync.js",import.meta.url),"utf8");
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=()=>({type:"bewerbungs-agent-feedback",schema_version:"1.0.0",
 annotations:[{id:"OTHER",decision:"review",note:"",stage_changed_at:null}],
 relevance_ratings:[{id:"JOB-2",score:55,updated_at:"2026-01-01T00:00:00Z"}],
 radar_career_ratings:[],dismissals:[],export_selection:[],activity_log:[],overrides:[],manual_jobs:[]});
function githubHarness(){
 let data=initial(),sha="sha-0",writes=0,offline=false;
 const window={},storage={getItem:()=> "github_pat_test"};
 const fetch=async (url,opts={})=>{
  if(offline)throw Error("network offline");
  if(opts.method==="PUT"){
   const body=JSON.parse(opts.body);
   if(body.sha!==sha)return {ok:false,status:409,json:async()=>({message:"conflict"})};
   data=JSON.parse(Buffer.from(body.content,"base64").toString("utf8"));
   sha="sha-"+(++writes);
   return {ok:true,json:async()=>({commit:{sha}})};
  }
  return {ok:true,json:async()=>({sha,content:Buffer.from(JSON.stringify(data)).toString("base64")})};
 };
 vm.runInNewContext(ghSource,{window,localStorage:storage,fetch,TextEncoder,TextDecoder,
  atob:x=>Buffer.from(x,"base64").toString("binary"),btoa:x=>Buffer.from(x,"binary").toString("base64"),
  structuredClone:clone,Date,Map,Set,JSON,Uint8Array});
 return {api:window.GithubFeedback,data:()=>data,writes:()=>writes,offline:x=>offline=x};
}
test("incremental writes preserve unrelated records, avoid duplicates and skip unchanged saves",async()=>{
 const h=githubHarness(),rating={id:"JOB-1",score:77,updated_at:"2026-11-04T18:00:00Z"};
 await h.api.saveFilterRatings({relevance_ratings:{"JOB-1":rating}});
 assert.equal(h.writes(),1);
 assert.equal(h.data().annotations.length,1);
 assert.equal(h.data().relevance_ratings.length,2);
 const result=await h.api.saveFilterRatings({relevance_ratings:{"JOB-1":rating}});
 assert.equal(result.unchanged,true);
 assert.equal(h.writes(),1);
});
test("offline failure does not modify remote data; retry succeeds",async()=>{
 const h=githubHarness(),rating={id:"JOB-1",score:80,updated_at:"2026-11-04T18:00:00Z"};
 h.offline(true);
 await assert.rejects(h.api.saveFilterRatings({relevance_ratings:{"JOB-1":rating}}));
 assert.equal(h.writes(),0);
 h.offline(false);
 await h.api.saveFilterRatings({relevance_ratings:{"JOB-1":rating}});
 assert.equal(h.data().relevance_ratings.find(x=>x.id==="JOB-1").score,80);
});
test("newer concurrent remote rating is never overwritten",async()=>{
 const h=githubHarness();
 await h.api.saveFilterRatings({relevance_ratings:{"JOB-1":{id:"JOB-1",score:90,updated_at:"2026-11-04T19:00:00Z"}}});
 await assert.rejects(h.api.saveFilterRatings({relevance_ratings:{"JOB-1":{id:"JOB-1",score:12,updated_at:"2026-11-04T18:00:00Z"}}}),/Bewertungskonflikt/);
 assert.equal(h.data().relevance_ratings.find(x=>x.id==="JOB-1").score,90);
});
function controllerHarness(stored=null,options={}){
 const handlers={},elements={},saved={value:stored},writes=[],rating={id:"JOB-1",score:72,updated_at:"2026-11-04T18:00:00Z"};
 let reply=async()=>({sha:"sha",unchanged:false}),interval;
 const get=id=>{
  if(elements[id])return elements[id];
  const classes=new Set(),svg={dataset:{},innerHTML:""};
  return elements[id]={disabled:false,hidden:true,textContent:"",title:"",classList:{
   toggle:(name,v)=>v?classes.add(name):classes.delete(name),add:x=>classes.add(x),remove:x=>classes.delete(x)},
   setAttribute:()=>{},querySelector:()=>svg,addEventListener:(name,cb)=>{handlers["button:"+name]=cb;}};
 };
 const win={CareerFeedbackReady:true,CareerRadarReady:true,
  AgentStore:{loadFilterSync:async()=>saved.value,saveFilterSync:async x=>{saved.value=clone(x)}},
  AgentCareerFeedback:{getEntry:()=>clone(rating),restoreEntry:(_id,x)=>Object.assign(rating,x),getScore:()=>rating.score},
  CareerRadarBridge:{getCareerRating:()=>options.criteria||null,restoreCareerRating:()=>{}},
  GithubFeedback:{loadFilterRatings:async()=>null,saveFilterRatings:async batch=>{writes.push(clone(batch));return reply(batch)}},
  addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn),
  dispatchEvent:e=>(handlers[e.type]||[]).forEach(fn=>fn(e))};
 const document={getElementById:get,hidden:false,addEventListener:()=>{}};
 vm.runInNewContext(syncSource,{window:win,document,navigator:{onLine:true},
  structuredClone:clone,Date,JSON,Object,Set,Promise,
  Event:class{constructor(type){this.type=type;}},
  setInterval:fn=>{interval=fn;},setTimeout:()=>0});
 const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve()};
 return {win,save:saved,writes,flush,tick:()=>interval(),rate:(score)=>{
  rating.score=score;rating.updated_at=new Date(Date.now()+score).toISOString();
  win.dispatchEvent({type:"career-filter-rating-dirty",detail:{kind:"relevance_ratings",job_id:"JOB-1"}});
 },reply:fn=>reply=fn,button:()=>handlers["button:click"]()};
}
test("20-second poll is idle without changes; manual sync and confirmed removal",async()=>{
 const h=controllerHarness();await h.flush();h.tick();await h.flush();
 assert.equal(h.writes.length,0);
 h.rate(78);await h.flush();
 assert.equal(h.win.CareerFilterSync.isConfirmed("JOB-1"),false);
 h.button();await h.flush();
 assert.equal(h.writes.length,1);
 assert.equal(h.win.CareerFilterSync.isConfirmed("JOB-1"),true);
 assert.equal(h.save.value.pending.relevance_ratings["JOB-1"],undefined);
});
test("20-second interval automatically uploads only the changed rating",async()=>{
 const h=controllerHarness();await h.flush();h.rate(91);await h.flush();
 h.tick();await h.flush();
 assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].relevance_ratings["JOB-1"].score,91);
 assert.equal(h.win.CareerFilterSync.isConfirmed("JOB-1"),true);
 h.tick();await h.flush();
 assert.equal(h.writes.length,1);
});
test("criteria sync excludes private free-text notes",async()=>{
 const h=controllerHarness(null,{criteria:{id:"JOB-1",scores:{tasks:4},note:"Do not publish",updated_at:"2026-11-04T18:00:00Z"}});
 await h.flush();
 h.win.dispatchEvent({type:"career-filter-rating-dirty",detail:{kind:"radar_career_ratings",job_id:"JOB-1"}});
 await h.flush();await h.win.CareerFilterSync.sync();await h.flush();
 assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].radar_career_ratings["JOB-1"].scores.tasks,4);
 assert.equal(Object.hasOwn(h.writes[0].radar_career_ratings["JOB-1"],"note"),false);
});
test("network error retains draft, reloaded controller can retry",async()=>{
 const h=controllerHarness();await h.flush();h.rate(82);await h.flush();
 h.reply(async()=>{throw Error("offline")});h.tick();await h.flush();
 assert.equal(h.win.CareerFilterSync.isConfirmed("JOB-1"),false);
 assert.equal(h.save.value.pending.relevance_ratings["JOB-1"].score,82);
 const reloaded=controllerHarness(clone(h.save.value));await reloaded.flush();
 await reloaded.win.CareerFilterSync.sync();await reloaded.flush();
 assert.equal(reloaded.win.CareerFilterSync.isConfirmed("JOB-1"),true);
});
test("change during upload stays pending after older version is confirmed",async()=>{
 const h=controllerHarness();await h.flush();h.rate(65);await h.flush();
 let release;
 h.reply(()=>new Promise(resolve=>release=resolve));
 const first=h.win.CareerFilterSync.sync();await h.flush();
 h.rate(99);await h.flush();
 assert.equal(h.writes.length,1);
 release({sha:"saved"});await first;await h.flush();
 assert.equal(h.win.CareerFilterSync.isConfirmed("JOB-1"),false);
 assert.equal(h.save.value.pending.relevance_ratings["JOB-1"].score,99);
 h.reply(async()=>({sha:"next"}));await h.win.CareerFilterSync.sync();await h.flush();
 assert.equal(h.win.CareerFilterSync.isConfirmed("JOB-1"),true);
 assert.equal(h.writes.at(-1).relevance_ratings["JOB-1"].score,99);
});
