"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const cloud=require("../dashboard/dossier-cloud-sync.js");
const studio=fs.readFileSync("dashboard/dossier-studio.html","utf8");
const SRC="Coco1the8creator7/bewerbungs-agent";
const PREFIX="demo-dossiers/v1/test-123/";
const draft={docs:{cv:{type:"cv",data:{name:"Alex Muster"}},letter:{type:"letter"},email:{type:"email"}},activeDoc:"cv",enabled:{cv:true,letter:true,email:true}};
const zip=Uint8Array.from([80,75,3,4,1,2,3,4]);
function fixture(){
 const files=new Map(),requests=[];let next=0,writes=0,visibility="public",online=true;
 const respond=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
 async function request(url,options={}){
  requests.push({url,method:options.method||"GET"});
  if(!online)throw Error("Disconnected");
  const path=url.replace("https://api.github.com/repos/","").split("?")[0];
  if(path===SRC)return respond(200,{full_name:SRC,private:visibility==="private",visibility,default_branch:"main"});
  if(!path.startsWith(SRC+"/contents/"))return respond(404,{message:"Unknown repository"});
  const name=decodeURIComponent(path.slice((SRC+"/contents/").length));
  if(!name.startsWith(PREFIX))return respond(400,{message:"Outside demo folder"});
  if((options.method||"GET")==="GET")return files.has(name)?respond(200,files.get(name)):respond(404,{message:"Not found"});
  if(options.method==="PUT"){
   assert.match(options.headers.Authorization,/^Bearer demo-token$/);
   const body=JSON.parse(options.body),old=files.get(name);
   if((body.sha||null)!==(old?.sha||null))return respond(409,{message:"Conflict"});
   const sha="rev-"+(++next);
   files.set(name,{sha,content:body.content});
   writes++;
   return respond(201,{content:{sha}});
  }
  return respond(405,{message:"Unsupported"});
 }
 return {request,files,requests,get writes(){return writes;},setVisibility:v=>visibility=v,setOnline:v=>online=v,
 externalDraft:data=>{
  const key=PREFIX+"draft.json",content=Buffer.from(JSON.stringify({format:cloud.FORMAT,dossierId:"test-123",savedAt:"external",data})).toString("base64");
  files.set(key,{sha:"outside-"+(++next),content});
 }};
}
const connect=(c,local=draft)=>c.connect({token:"demo-token",id:"test-123",local,publicDemoConfirmed:true});

test("public publishing requires affirmative per-dossier demo consent",async()=>{
 const api=fixture(),client=cloud.createClient(api.request);
 await assert.rejects(client.connect({token:"demo-token",id:"test-123",local:draft}),e=>e.code==="CONSENT");
 assert.equal(api.requests.length,0);
 assert.equal(api.writes,0);
 assert.equal(client.status().connected,false);
});
test("fixed repository and directory; no arbitrary target and no path traversal",async()=>{
 const api=fixture(),client=cloud.createClient(api.request);
 await assert.rejects(client.connect({token:"demo-token",id:"../escape",local:draft,publicDemoConfirmed:true}),e=>e.code==="INVALID");
 await assert.rejects(client.connect({token:"",id:"test-123",local:draft,publicDemoConfirmed:true}),e=>e.code==="AUTH");
 const result=await client.connect({repository:"attacker/elsewhere",token:"demo-token",id:"test-123",local:draft,publicDemoConfirmed:true});
 assert.equal(result.remoteExists,false);
 await client.push(draft,zip);
 assert.ok(api.requests.every(r=>r.url.startsWith("https://api.github.com/repos/"+SRC)));
 assert.deepEqual([...api.files.keys()].sort(),[PREFIX+"Dossier.zip",PREFIX+"draft.json"]);
});
test("upload editable JSON plus ZIP, skip unchanged data and revoke token on disconnect",async()=>{
 const api=fixture(),client=cloud.createClient(api.request);
 await connect(client);
 const result=await client.push(draft,zip);
 assert.equal(result.unchanged,false);
 assert.equal(api.writes,2);
 assert.deepEqual(await client.pull(),draft);
 assert.equal((await client.push(draft,zip)).unchanged,true);
 assert.equal(api.writes,2);
 client.disconnect();
 assert.equal(client.status().hasToken,false);
 await assert.rejects(client.push(draft,zip),e=>e.code==="DISCONNECTED");
});
test("reject unknown remote version and retain local changes after conflicts",async()=>{
 const api=fixture(),a=cloud.createClient(api.request),b=cloud.createClient(api.request);
 await connect(a);await a.push(draft,zip);
 const changed={...draft,activeDoc:"letter"};
 const result=await connect(b,changed);
 assert.equal(result.blocked,true);
 await assert.rejects(b.push(changed,zip),e=>e.code==="CONFLICT");
 assert.deepEqual(await b.pull(),draft);
 b.keepLocal();
 await b.push(changed,zip);
 await assert.rejects(a.push({...draft,activeDoc:"email"},zip),e=>e.code==="CONFLICT");
 assert.equal(a.status().blocked,true);
});
test("failed local archive validation and changed cloud revisions cannot upload",async()=>{
 const api=fixture(),client=cloud.createClient(api.request);
 await connect(client);
 await assert.rejects(client.push(draft,new Uint8Array()),e=>e.code==="INVALID");
 assert.equal(api.writes,0);
 api.externalDraft(draft);
 await assert.rejects(client.push(draft,zip),e=>e.code==="CONFLICT");
 assert.equal(api.writes,0);
});
test("public-demo adapter refuses a repo that was changed to private",async()=>{
 const api=fixture(),client=cloud.createClient(api.request);
 await connect(client);
 api.setVisibility("private");
 await assert.rejects(client.push(draft,zip),e=>e.code==="INVALID");
 assert.equal(api.writes,0);
 assert.equal(client.status().blocked,true);
});
test("offline cannot falsely report a GitHub save",async()=>{
 const api=fixture(),client=cloud.createClient(api.request);
 await connect(client);
 api.setOnline(false);
 await assert.rejects(client.push(draft,zip),e=>e.code==="NETWORK");
 assert.equal(api.writes,0);
});
test("studio guards public publishing and reuses prior dashboard token",()=>{
 assert.match(studio,/id="cloudDemoConsent"/);
 assert.match(studio,/id="cloudConnect" type="button" disabled/);
 assert.match(studio,/career-agency-public-demo-optin-v1/);
 assert.match(studio,/bewerbungs-agent-github-token-v1/);
 assert.match(studio,/function demoToken\(\)/);
 assert.match(studio,/publicDemoConfirmed:true/);
 assert.match(studio,/setInterval\(\(\)=>\{if\(cloudDirty\)syncCloud\(\)\},30000\)/);
 assert.match(studio,/if\(activeDossier&&demoApproved\(\)&&demoToken\(\)\)connectCloud\(\)/);
 assert.match(studio,/id="studioPrintPdf"/);
 assert.match(studio,/await persistNow\(\);\s*closeReview\(\);\s*window\.print\(\)/);
 assert.doesNotMatch(studio,/id="cloudRepo"/);
 const inline=studio.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(inline);assert.doesNotThrow(()=>new Function(inline));
});
