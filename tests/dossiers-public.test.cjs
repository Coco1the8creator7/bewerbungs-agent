"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {webcrypto,createHash}=require("node:crypto");
const code=fs.readFileSync("dashboard/dossiers-public.js","utf8");
function fakeServer(){
 const entries=new Map(),writes=[];
 const response=(status,payload)=>({status,ok:status>=200&&status<300,json:async()=>payload});
 return {entries,writes,async fetch(url,options){
  const uri=new URL(url),path=decodeURIComponent(uri.pathname.split("/contents/")[1]||"");
  if(options.method==="GET"){
   const found=entries.get(path);
   if(!found)return response(404,{message:"not found"});
   return response(200,{sha:found.sha,encoding:"base64",content:found.bytes.toString("base64")});
  }
  if(options.method==="PUT"){
   const body=JSON.parse(options.body),current=entries.get(path);
   if((current?.sha||null)!==(body.sha||null))return response(409,{message:"conflict"});
   const bytes=Buffer.from(body.content,"base64");
   const sha=createHash("sha1").update(bytes).digest("hex");
   entries.set(path,{bytes,sha});writes.push(path);
   return response(201,{content:{sha}});
  }
  throw Error("Unknown API request "+options.method);
 }};
}
function launch(server,files,dossiers=[]){
 const nodes={};
 for(const id of ["dossierPublicSave","dossierPublicLoad","dossierPublicToken","dossierPublicStatus"]){
  nodes[id]={value:"",disabled:false,textContent:"",classList:{toggle(){}},addEventListener(name,callback){this.callback=callback;}};
 }
 const imports=[],store={
  snapshot:()=>({files,dossiers}),
  async importSnapshot(ds,fs){imports.push({ds,fs});files.push(...fs);dossiers.push(...ds);}
 };
 const confirms=[];
 const context={
  window:{CareerDossiersData:store,confirm:message=>{confirms.push(message);return true;}},
  document:{getElementById:id=>nodes[id]},fetch:(...args)=>server.fetch(...args),
  crypto:webcrypto,Blob,Uint8Array,TextEncoder,TextDecoder,URL,Error,
  btoa:input=>Buffer.from(input,"binary").toString("base64"),
  atob:input=>Buffer.from(input,"base64").toString("binary")
 };
 vm.runInNewContext(code,context,{filename:"dashboard/dossiers-public.js"});
 async function trigger(id){
  nodes[id].callback();
  for(let i=0;i<100;i++){
   await new Promise(resolve=>setImmediate(resolve));
   if(!nodes[id].disabled)break;
  }
  assert.equal(nodes[id].disabled,false,"operation finished");
 }
 return {nodes,imports,confirms,trigger};
}
test("GitHub publication is explicitly confirmed and restores CV byte-for-byte",async()=>{
 const server=fakeServer(),bytes=Buffer.from("%PDF-test-cv","utf8");
 const file={id:"test-file-1",dossierId:null,name:"CV.pdf",size:bytes.byteLength,
  type:"application/pdf",createdAt:"2026-10-28T10:00:00Z",content:new Blob([bytes])};
 const first=launch(server,[file],[{id:"doss-1",title:"Testbewerbung",updatedAt:"2026-10-28T10:00:00Z"}]);
 assert.equal(server.writes.length,0);
 first.nodes.dossierPublicToken.value="test-github-pat";
 await first.trigger("dossierPublicSave");
 assert.equal(first.confirms.length,1);
 assert.match(first.confirms[0],/UNVERSCHLÜSSELT/);
 assert.equal(first.nodes.dossierPublicToken.value,"");
 assert.equal(server.writes.length,2,"one file and one manifest");
 const meta=JSON.parse(server.entries.get("public-dossiers/v1/manifest.json").bytes.toString("utf8"));
 assert.equal(meta.files.length,1);
 assert.equal(meta.dossiers.length,1);
 assert.equal(meta.files[0].sha256,createHash("sha256").update(bytes).digest("hex"));
 assert.deepEqual(server.entries.get(meta.files[0].path).bytes,bytes);
 const second=launch(server,[],[]);
 await second.trigger("dossierPublicLoad");
 assert.equal(second.imports.length,1);
 assert.equal(second.imports[0].fs[0].name,"CV.pdf");
 assert.deepEqual(Buffer.from(await second.imports[0].fs[0].content.arrayBuffer()),bytes);
 assert.equal(second.imports[0].ds[0].title,"Testbewerbung");
 await second.trigger("dossierPublicLoad");
 assert.equal(second.imports[1].fs.length,0,"same file not duplicated");
});
test("public restore refuses to import files with a mismatched SHA-256",async()=>{
 const server=fakeServer();
 const bytes=Buffer.from("test"),path="public-dossiers/v1/files/cv-1.pdf";
 server.entries.set(path,{bytes,sha:"file-hash"});
 const manifest={format:"career-agency-public-dossiers-v1",version:1,dossiers:[],files:[{
  id:"cv-1",dossierId:null,name:"CV.pdf",size:4,type:"application/pdf",
  createdAt:"2026-10-28T10:00:00Z",path,sha256:"a".repeat(64)
 }]};
 const raw=Buffer.from(JSON.stringify(manifest));
 server.entries.set("public-dossiers/v1/manifest.json",{bytes:raw,sha:"manifest-hash"});
 const app=launch(server,[],[]);
 await app.trigger("dossierPublicLoad");
 assert.equal(app.imports.length,0);
 assert.match(app.nodes.dossierPublicStatus.textContent,/Beschädigte oder fehlende Datei/);
});
