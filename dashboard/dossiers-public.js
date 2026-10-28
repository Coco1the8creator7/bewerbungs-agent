/* Career.Agency public GitHub document storage (temporary MVP).
 * Publishing is explicit, NEVER automatic. Public files remain in Git history.
 * Credentials are not persisted by this module. Replace this adapter with a private backend.
 */
(function(){
 "use strict";
 const store=window.CareerDossiersData;
 if(!store||!document.getElementById("dossierPublicSave"))return;
 const $=id=>document.getElementById(id);
 const API="https://api.github.com/repos/Coco1the8creator7/bewerbungs-agent";
 const FOLDER="public-dossiers/v1", MANIFEST=FOLDER+"/manifest.json";
 const FORMAT="career-agency-public-dossiers-v1", LIMIT=5*1024*1024;
 let busy=false;
 function info(message,error=false){
  const node=$("dossierPublicStatus");
  node.textContent=message;node.classList.toggle("is-error",error);
 }
 function lock(value){
  busy=value;
  for(const id of ["dossierPublicSave","dossierPublicLoad"])$(id).disabled=value;
 }
 function validatedId(id){
  if(typeof id!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error("Ungültige Dossier- oder Datei-ID.");
  return id;
 }
 function filePath(file){
  const extension=String(file.name||"").split(".").pop().toLowerCase();
  if(!/^(pdf|doc|docx|odt|txt|png|jpg|jpeg)$/.test(extension))throw Error("Unzulässiger Dateityp.");
  return FOLDER+"/files/"+validatedId(file.id)+"."+extension;
 }
 function encodeBase64(bytes){
  let result="";
  for(let n=0;n<bytes.length;n+=8192)result+=String.fromCharCode(...bytes.subarray(n,n+8192));
  return btoa(result);
 }
 function decodeBase64(encoded){
  if(typeof encoded!=="string")throw Error("Die GitHub-Datei enthält keine gültigen Daten.");
  return Uint8Array.from(atob(encoded.replace(/\s/g,"")),c=>c.charCodeAt(0));
 }
 function utf8(bytes){return new TextDecoder("utf-8",{fatal:true}).decode(bytes);}
 function jsonBytes(value){return new TextEncoder().encode(JSON.stringify(value,null,2)+"\n");}
 function fileUrl(path){return "/contents/"+path.split("/").map(encodeURIComponent).join("/");}
 async function request(method,path,token,body){
  const res=await fetch(API+path,{
   method,cache:"no-store",
   headers:{"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",
    ...(token?{"Authorization":"Bearer "+token}:{}),...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  if(res.status===404&&method==="GET")return null;
  if(!res.ok){
   if(res.status===401)throw Error("GitHub-Token ungültig oder abgelaufen.");
   if(res.status===403)throw Error("GitHub-Zugriff verweigert. Token-Berechtigung Contents: Read and write prüfen.");
   if(res.status===409||res.status===422)throw Error("GitHub-Konflikt. Neu laden und erneut versuchen, es wurde nichts überschrieben.");
   throw Error("GitHub HTTP "+res.status+".");
  }
  return res.json();
 }
 async function readFile(path,token){
  const data=await request("GET",fileUrl(path)+"?ref=main",token);
  if(!data)return null;
  let content=data.content;
  if(!content){
   const blob=await request("GET","/git/blobs/"+encodeURIComponent(data.sha),token);
   if(blob?.encoding!=="base64")throw Error("GitHub liefert die Datei nicht als Base64.");
   content=blob.content;
  }
  return {sha:data.sha,bytes:decodeBase64(content)};
 }
 async function writeFile(path,bytes,token,sha){
  const payload={message:"data(dossiers): publish documents to public repository",
   branch:"main",content:encodeBase64(bytes)};
  if(sha)payload.sha=sha;
  const result=await request("PUT",fileUrl(path),token,payload);
  if(!result?.content?.sha)throw Error("GitHub hat die Speicherung nicht bestätigt.");
  return result.content.sha;
 }
 function cleanManifest(data){
  if(!data)return {format:FORMAT,version:1,dossiers:[],files:[]};
  if(data.format!==FORMAT||data.version!==1||!Array.isArray(data.dossiers)||!Array.isArray(data.files))
   throw Error("Unbekanntes öffentliches Dossierformat.");
  if(data.files.length>200||data.dossiers.length>500)throw Error("Zu viele Einträge im GitHub-Manifest.");
  for(const d of data.dossiers){
   validatedId(d.id);
   if(typeof d.title!=="string"||d.title.length>250)throw Error("Dossier-Metadaten ungültig.");
  }
  for(const f of data.files){
   validatedId(f.id);
   if(typeof f.name!=="string"||f.name.length>250||
    !Number.isSafeInteger(f.size)||f.size<1||f.size>LIMIT||
    typeof f.sha256!=="string"||!/^[a-f0-9]{64}$/.test(f.sha256)||
    f.path!==filePath(f))
    throw Error("Datei-Metadaten im GitHub-Manifest ungültig.");
  }
  return data;
 }
 async function readManifest(token){
  const fetched=await readFile(MANIFEST,token);
  if(!fetched)return {sha:null,data:cleanManifest(null)};
  return {sha:fetched.sha,data:cleanManifest(JSON.parse(utf8(fetched.bytes)))};
 }
 async function digest(bytes){
  const buffer=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,"0")).join("");
 }
 function metaDossier(d){
  return {id:validatedId(d.id),ownerId:null,jobId:d.jobId||null,
   title:d.title,company:d.company||"",location:d.location||"",
   status:d.status||"draft",origin:d.origin||"local",
   createdAt:d.createdAt,updatedAt:d.updatedAt,preferences:d.preferences||{}};
 }
 function metaFile(f,hash){
  return {id:validatedId(f.id),dossierId:f.dossierId||null,ownerId:null,
   name:f.name,size:f.size,type:f.type||"",createdAt:f.createdAt,
   path:filePath(f),sha256:hash};
 }
 async function publish(){
  if(busy)return;
  const local=store.snapshot();
  if(!local.files.length&&!local.dossiers.length){info("Noch keine lokalen Unterlagen oder Dossiers vorhanden.",true);return;}
  const token=$("dossierPublicToken").value.trim()||window.GithubFeedback?.getToken?.()||"";
  if(!token){info("Bitte GitHub-Token mit Schreibrecht eingeben.",true);return;}
  const summary=local.files.length+" Datei(en) und "+local.dossiers.length+" Dossier-Einträge";
  if(!window.confirm("Wirklich "+summary+" UNVERSCHLÜSSELT im öffentlichen GitHub-Repository veröffentlichen? Jede Person kann sie lesen. Auch nach dem Löschen können sie in der Git-Historie bleiben."))return;
  lock(true);info("Prüfe GitHub und veröffentliche Dateien …");
  try{
   const initial=await readManifest(token);
   const published=new Map(initial.data.files.map(x=>[x.id,x]));
   const dossiers=new Map(initial.data.dossiers.map(x=>[x.id,x]));
   for(const d of local.dossiers){
    const next=metaDossier(d),before=dossiers.get(next.id);
    if(!before||String(next.updatedAt)>String(before.updatedAt))dossiers.set(next.id,next);
   }
   const newFiles=[];
   for(const file of local.files){
    if(!(file.content instanceof Blob)||file.content.size!==file.size||file.size>LIMIT)
     throw Error("Datei "+file.name+" ist nicht verfügbar oder grösser als 5 MB. Nichts am Manifest verändert.");
    const bytes=new Uint8Array(await file.content.arrayBuffer());
    const sha256=await digest(bytes),next=metaFile(file,sha256),old=published.get(file.id);
    if(old){
     if(old.sha256!==sha256||old.path!==next.path||old.dossierId!==next.dossierId)
      throw Error("Dateikonflikt bei "+file.name+". Bereits veröffentlichte Dateien nicht überschrieben.");
     continue;
    }
    newFiles.push({meta:next,bytes});
   }
   for(const file of newFiles){
    const existing=await readFile(file.meta.path,token);
    if(existing){
     if(await digest(existing.bytes)!==file.meta.sha256)
      throw Error("Dateipfad bereits anders belegt: "+file.meta.name);
    }else{
     await writeFile(file.meta.path,file.bytes,token,null);
    }
    published.set(file.meta.id,file.meta);
   }
   const current=await readManifest(token);
   if(current.sha!==initial.sha)throw Error("GitHub wurde zwischenzeitlich aktualisiert. Bitte nochmals abgleichen; das Manifest blieb unverändert.");
   const merged={format:FORMAT,version:1,updatedAt:new Date().toISOString(),
    dossiers:[...dossiers.values()],files:[...published.values()]};
   await writeFile(MANIFEST,jsonBytes(merged),token,current.sha);
   info("Öffentlich auf GitHub gespeichert: "+merged.files.length+" Datei(en), "+merged.dossiers.length+" Dossier(s).");
  }catch(err){info("GitHub-Sicherung fehlgeschlagen: "+err.message,true);}
  finally{$("dossierPublicToken").value="";lock(false);}
 }
 async function restore(){
  if(busy)return;
  lock(true);info("Lade Dossiers aus dem öffentlichen Repository …");
  try{
   const {data}=await readManifest("");
   if(!data.files.length&&!data.dossiers.length){info("Noch keine öffentlichen Dossiers auf GitHub vorhanden.");return;}
   const local=store.snapshot(),known=new Map(local.files.map(f=>[f.id,f]));
   const imports=[];
   for(const meta of data.files){
    if(known.has(meta.id)){
     const existing=known.get(meta.id);
     if(existing.name!==meta.name||existing.size!==meta.size)throw Error("Datei-ID-Konflikt bei "+meta.name);
     continue;
    }
    const item=await readFile(meta.path,"");
    if(!item||item.bytes.byteLength!==meta.size||await digest(item.bytes)!==meta.sha256)
     throw Error("Beschädigte oder fehlende Datei auf GitHub: "+meta.name);
    const {path,sha256,...record}=meta;
    imports.push({...record,content:new Blob([item.bytes],{type:meta.type||"application/octet-stream"})});
   }
   await store.importSnapshot(data.dossiers,imports);
   info("GitHub-Daten geladen: "+imports.length+" zusätzliche Datei(en). Bestehende lokale Daten bleiben erhalten.");
  }catch(err){info("GitHub-Laden fehlgeschlagen: "+err.message,true);}
  finally{lock(false);}
 }
 $("dossierPublicSave").addEventListener("click",()=>void publish());
 $("dossierPublicLoad").addEventListener("click",()=>void restore());
})()
