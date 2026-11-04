"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const cloud=require("../dashboard/dossier-cloud-sync.js");
const html=fs.readFileSync("dashboard/dossier-studio.html","utf8");
const SRC="Coco1the8creator7/bewerbungs-agent";
const draft={docs:{cv:{type:"cv",data:{name:"Test"}},letter:{type:"letter"},email:{type:"email"}},activeDoc:"cv",enabled:{cv:true,letter:true,email:true}};
const zip=Uint8Array.from([80,75,3,4,1,2,3,4]);

function server(){
 const files=new Map();let counter=0,writes=0;
 async function request(url,options){
  const path=url.replace("https://api.github.com/repos/","").split("?")[0];
  const method=options?.method||"GET";
  const response=(status,value)=>({ok:status>=200&&status<300,status,json:async()=>value});
  if(path==="tester/private")return response(200,{private:true,visibility:"private",default_branch:"main"});
  if(path==="tester/public")return response(200,{private:false,visibility:"public",default_branch:"main"});
  if(!path.startsWith("tester/private/contents/"))return response(404,{message:"Not found"});
  const key=path.slice("tester/private/contents/".length);
  if(method==="GET")return files.has(key)?response(200,files.get(key)):response(404,{message:"Not found"});
  if(method==="PUT"){
   assert.match(options.headers.Authorization,/^Bearer token$/);
   const body=JSON.parse(options.body),prior=files.get(key);
   if((prior?.sha||null)!==(body.sha||null))return response(409,{message:"Concurrent write"});
   const sha="rev-"+(++counter);
   files.set(key,{sha,content:body.content});
   writes++;
   return response(201,{content:{sha}});
  }
  return response(405,{message:"Unsupported"});
 }
 return {request,files,get writes(){return writes;},externalReplace(name,data){
  const key="dossier-studio/v1/test-123/"+name;
  const bytes=Buffer.from(JSON.stringify({format:"career-agency-dossier-v1",dossierId:"test-123",savedAt:"external",data}),"utf8");
  files.set(key,{sha:"external-"+(++counter),content:bytes.toString("base64")});
 }};
}
test("never write to the public source or other public repositories",async()=>{
 const s=server(),c=cloud.createClient(s.request);
 await assert.rejects(c.connect({repository:SRC,token:"token",id:"test-123",local:draft}),e=>e.code==="PUBLIC");
 await assert.rejects(c.connect({repository:"tester/public",token:"token",id:"test-123",local:draft}),e=>e.code==="PUBLIC");
 assert.equal(s.writes,0);
 assert.equal(c.status().connected,false);
});
test("rejects invalid IDs, missing credentials and path traversal",async()=>{
 const c=cloud.createClient(server().request);
 await assert.rejects(c.connect({repository:"tester/private",token:"token",id:"../evil",local:draft}),e=>e.code==="INVALID");
 await assert.rejects(c.connect({repository:"tester/private",token:"",id:"test-123",local:draft}),e=>e.code==="AUTH");
});
test("writes editable JSON and downloadable archive; skips unchanged snapshots",async()=>{
 const s=server(),c=cloud.createClient(s.request);
 const r=await c.connect({repository:"tester/private",token:"token",id:"test-123",local:draft});
 assert.equal(r.remoteExists,false);
 assert.equal(c.status().hasToken,true);
 const uploaded=await c.push(draft,zip);
 assert.equal(uploaded.unchanged,false);
 assert.equal(s.writes,2);
 const noChange=await c.push(draft,zip);
 assert.equal(noChange.unchanged,true);
 assert.equal(s.writes,2);
 assert.deepEqual(await c.pull(),draft);
 const names=[...s.files.keys()].sort();
 assert.deepEqual(names,["dossier-studio/v1/test-123/Dossier.zip","dossier-studio/v1/test-123/draft.json"]);
 c.disconnect();
 assert.equal(c.status().hasToken,false);
 await assert.rejects(c.push(draft,zip),e=>e.code==="DISCONNECTED");
});
test("remote changes are never silently overwritten across devices",async()=>{
 const s=server(),c1=cloud.createClient(s.request),c2=cloud.createClient(s.request);
 await c1.connect({repository:"tester/private",token:"token",id:"test-123",local:draft});
 await c1.push(draft,zip);
 const changed={...draft,activeDoc:"letter"};
 const divergent=await c2.connect({repository:"tester/private",token:"token",id:"test-123",local:changed});
 assert.equal(divergent.blocked,true);
 await assert.rejects(c2.push(changed,zip),e=>e.code==="CONFLICT");
 assert.deepEqual(await c2.pull(),draft);
 c2.acceptRemote();
 await c2.push(changed,zip);
 await assert.rejects(c1.push({...draft,activeDoc:"email"},zip),e=>e.code==="CONFLICT");
 assert.equal(c1.status().blocked,true);
});
test("external edits and invalid archives fail safely",async()=>{
 const s=server(),c=cloud.createClient(s.request);
 await c.connect({repository:"tester/private",token:"token",id:"test-123",local:draft});
 await assert.rejects(c.push(draft,new Uint8Array(0)),e=>e.code==="INVALID");
 assert.equal(s.writes,0);
 s.externalReplace("draft.json",draft);
 await assert.rejects(c.push(draft,zip),e=>e.code==="CONFLICT");
 assert.equal(s.writes,0);
});
test("studio wires opt-in cloud and change-aware background synchronization",()=>{
 assert.match(html,/dossier-cloud-sync\.js\?v=/);
 assert.match(html,/id="cloudRepo"/);
 assert.match(html,/id="cloudToken" type="password"/);
 assert.match(html,/id="cloudSync"/);
 assert.match(html,/function cloudChanged\(/);
 assert.match(html,/if\(cloudRevision===revision\)cloudDirty=false/);
 assert.match(html,/setInterval\(\(\)=>\{if\(cloudDirty\)syncCloud\(\)\},30000\)/);
 assert.match(html,/await persistNow\(\)/);
 assert.match(html,/cloudClient\.status\(\)\.blocked/);
 const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(inline);
 assert.doesNotThrow(()=>new Function(inline));
});