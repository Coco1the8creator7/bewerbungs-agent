/* Optional encrypted sync for the personal MVP.
 * PUBLIC repository, NO plaintext files, NO saved password/key.
 * Writes are restricted to opaque .enc.json objects outside GitHub Pages' dashboard directory.
 */
(function(){
 "use strict";
 const root=document.getElementById("mode-dossiers"),crypto=window.CareerDossierCrypto,store=window.CareerDossiersData;
 if(!root||!crypto||!store)return;
 const $=id=>document.getElementById(id);
 const repo="Coco1the8creator7/bewerbungs-agent";
 const base="https://api.github.com/repos/"+repo;
 const folder="encrypted-dossiers/v1";
 const manifestPath=folder+"/manifest.enc.json";
 const MAX_BYTES=15*1024*1024;
 let token="",key=null,salt=null,manifestSha=null,remote=null,connected=false,busy=false;
 let needsRestore=false,queued=false,saveTimer=null,savePromise=Promise.resolve();
 const string=(value)=>typeof value==="string"?value:"";
 function stateMessage(message,isError=false){
  $("dossierVaultStatus").textContent=message;
  $("dossierVaultStatus").classList.toggle("is-error",isError);
 }
 function setBusy(flag){
  busy=flag;
  for(const id of ["dossierVaultConnect","dossierVaultSave","dossierVaultRestore"])
   $(id).disabled=flag;
 }
 function renderStatus(){
  $("dossierVaultForm").hidden=connected;
  $("dossierVaultActions").hidden=!connected;
  $("dossierVaultRestore").hidden=!remote;
  $("dossierVaultSave").disabled=busy||needsRestore;
 }
 function idValid(id){return typeof id==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(id);}
 function filePath(id){
  if(!idValid(id))throw Error("Ungültige Datei-ID in der lokalen Ablage.");
  return folder+"/files/"+id+".enc.json";
 }
 function tokenAvailable(){
  return token||window.GithubFeedback?.getToken?.()||"";
 }
 async function request(method,path,payload=null){
  const access=tokenAvailable();
  if(!access)throw Error("GitHub-Schreib-Token fehlt. Trage einen Token zur Verbindung ein.");
  const res=await fetch(base+path,{
   method,
   headers:{
    "Accept":"application/vnd.github+json",
    "X-GitHub-Api-Version":"2022-11-28",
    "Authorization":"Bearer "+access,
    ...(payload?{"Content-Type":"application/json"}:{})
   },
   ...(payload?{body:JSON.stringify(payload)}:{}),
   cache:"no-store"
  });
  if(res.status===404&&method==="GET")return null;
  if(!res.ok){
   if(res.status===401)throw Error("GitHub-Token ungültig oder abgelaufen.");
   if(res.status===403)throw Error("GitHub verweigert den Zugriff. Token benötigt Contents: Read and write für dieses Repository.");
   if(res.status===409||res.status===422)throw Error("GitHub-Konflikt: Die Datei wurde möglicherweise anderweitig geändert. Bitte erneut verbinden.");
   throw Error("GitHub HTTP "+res.status+". Bitte Verbindung und Token-Berechtigung prüfen.");
  }
  return res.json();
 }
 function binaryToBase64String(text){
  return crypto.toBase64(new TextEncoder().encode(text));
 }
 function decodeString(value){
  return new TextDecoder("utf-8",{fatal:true}).decode(crypto.fromBase64(value.replace(/\s/g,"")));
 }
 async function readJson(path){
  const encoded=path.split("/").map(encodeURIComponent).join("/");
  const response=await request("GET","/contents/"+encoded+"?ref=main");
  if(!response)return null;
  let raw=response.content;
  if(!raw&&response.sha){
   const blob=await request("GET","/git/blobs/"+encodeURIComponent(response.sha));
   if(!blob||blob.encoding!=="base64")throw Error("GitHub konnte die verschlüsselte Datei nicht liefern.");
   raw=blob.content;
  }
  if(typeof raw!=="string")throw Error("Dateiantwort von GitHub ist unvollständig.");
  return {sha:response.sha,data:JSON.parse(decodeString(raw))};
 }
 async function writeJson(path,data,sha){
  const encoded=path.split("/").map(encodeURIComponent).join("/");
  const payload={
   message:"data(dossiers): encrypted browser-side backup",
   content:binaryToBase64String(JSON.stringify(data)),
   branch:"main"
  };
  if(sha)payload.sha=sha;
  const result=await request("PUT","/contents/"+encoded,payload);
  return result.content?.sha;
 }
 function verifyManifest(data){
  if(!data||data.format!=="career-agency-e2ee-v1"||typeof data.salt!=="string")throw Error("Unbekanntes verschlüsseltes Manifestformat.");
  const s=crypto.fromBase64(data.salt);
  if(s.length!==16)throw Error("Ungültiges Manifest-Salz.");
  return s;
 }
 async function readRemote(){
  const found=await readJson(manifestPath);
  if(!found)return null;
  const remoteSalt=verifyManifest(found.data);
  if(!key||!salt||crypto.toBase64(remoteSalt)!==crypto.toBase64(salt))
   throw Error("Der Verschlüsselungsschlüssel passt nicht zu dieser Ablage.");
  const clear=crypto.decodeJson(await crypto.decrypt(key,found.data,crypto.manifestContext()));
  if(clear.schemaVersion!==1||!Array.isArray(clear.dossiers)||!Array.isArray(clear.files))
   throw Error("Unbekannte Dossier-Version im verschlüsselten Manifest.");
  for(const file of clear.files){
   if(!idValid(file.id)||typeof file.name!=="string"||typeof file.size!=="number"||file.size<0||file.size>MAX_BYTES)
    throw Error("Ungültiger Datei-Eintrag in der Sicherung.");
  }
  return {sha:found.sha,meta:clear};
 }
 function strippedSnapshot(snapshot){
  return {
   schemaVersion:1,
   dossiers:snapshot.dossiers.map(d=>({
    id:d.id,ownerId:d.ownerId||null,jobId:d.jobId||null,title:d.title,company:d.company,
    location:d.location,status:d.status,origin:d.origin,
    createdAt:d.createdAt,updatedAt:d.updatedAt,preferences:d.preferences
   })),
   files:snapshot.files.map(f=>({
    id:f.id,dossierId:f.dossierId||null,ownerId:null,name:f.name,size:f.size,
    type:f.type||"",createdAt:f.createdAt
   }))
  };
 }
 function remoteMissingLocally(remoteMeta,local){
  if(!remoteMeta)return false;
  const haveD=new Set(local.dossiers.map(x=>x.id)),haveF=new Set(local.files.map(x=>x.id));
  return remoteMeta.dossiers.some(x=>!haveD.has(x.id))||remoteMeta.files.some(x=>!haveF.has(x.id));
 }
 function sameRemoteIds(remoteMeta,local){
  if(!remoteMeta)return true;
  const haveD=new Map(local.dossiers.map(x=>[x.id,x])),haveF=new Map(local.files.map(x=>[x.id,x]));
  return remoteMeta.dossiers.every(x=>!haveD.has(x.id)||haveD.get(x.id).jobId===x.jobId)
   &&remoteMeta.files.every(x=>!haveF.has(x.id)||(
    haveF.get(x.id).name===x.name&&haveF.get(x.id).size===x.size));
 }
 async function connect(event){
  event.preventDefault();
  if(busy)return;
  const password=$("dossierVaultPassword").value;
  if(password.length<16){stateMessage("Bitte ein sicheres, eigenes Kennwort mit mindestens 16 Zeichen eingeben.",true);return;}
  const tempToken=$("dossierVaultToken").value.trim()||window.GithubFeedback?.getToken?.()||"";
  if(!tempToken){stateMessage("Ein GitHub-Token mit Schreibrecht für dieses Repository ist erforderlich.",true);return;}
  setBusy(true);stateMessage("Prüfe die verschlüsselte GitHub-Ablage …");
  try{
   // Verify the remote object before choosing or creating a new salt.
   token=tempToken;
   const response=await readJson(manifestPath);
   const nextSalt=response?verifyManifest(response.data):crypto.randomBytes(16);
   const nextKey=await crypto.deriveKey(password,nextSalt);
   if(response){
    const plain=crypto.decodeJson(await crypto.decrypt(nextKey,response.data,crypto.manifestContext()));
    if(plain.schemaVersion!==1||!Array.isArray(plain.files)||!Array.isArray(plain.dossiers))
     throw Error("Unbekanntes Manifestformat.");
    remote={sha:response.sha,meta:plain};
    manifestSha=response.sha;
   }else{remote=null;manifestSha=null;}
   salt=nextSalt;key=nextKey;connected=true;
   $("dossierVaultPassword").value="";$("dossierVaultToken").value="";
   const local=store.snapshot();
   needsRestore=remoteMissingLocally(remote?.meta,local);
   if(!sameRemoteIds(remote?.meta,local))throw Error("Gleichnamige Dateieinträge weichen voneinander ab. Bitte nicht überschreiben.");
   renderStatus();
   if(needsRestore)stateMessage("In GitHub sind zusätzliche Dossiers oder Dateien vorhanden. Lade diese zuerst in den Browser, bevor du wieder sicherst.");
   else{
    stateMessage("Verschlüsselung entsperrt. Prüfe die Sicherung …");
    queueSave();
   }
  }catch(err){
   connected=false;remote=null;key=null;salt=null;token="";manifestSha=null;needsRestore=false;renderStatus();
   stateMessage("Verbindung fehlgeschlagen: "+err.message,true);
  }finally{setBusy(false);renderStatus();}
 }
 async function save(){
  if(!connected||!key||!salt||needsRestore)return;
  if(busy){queued=true;return;}
  setBusy(true);stateMessage("Verschlüssele und sichere Bewerbungsdossiers auf GitHub …");
  try{
   const latest=await readRemote();
   if((latest?.sha||null)!==manifestSha)
    throw Error("In GitHub gibt es einen neueren Stand. Bitte Verbindung sperren und neu entsperren; nichts wurde überschrieben.");
   const local=store.snapshot();
   if(!sameRemoteIds(latest?.meta,local))throw Error("Dateikonflikt: Unterschiedliche Daten zur selben Datei-ID.");
   const encryptedIDs=new Set(latest?.meta.files.map(x=>x.id)||[]);
   for(const f of local.files){
    if(!idValid(f.id)||f.size>MAX_BYTES)throw Error("Ungültige oder zu grosse Datei in der Sicherung.");
    if(encryptedIDs.has(f.id))continue;
    const blob=f.content;
    if(!(blob instanceof Blob))throw Error("Dateiinhalt fehlt: "+f.name);
    const actual=new Uint8Array(await blob.arrayBuffer());
    if(actual.byteLength!==f.size)throw Error("Ungültige Dateigrösse bei "+f.name);
    const envelope=await crypto.encrypt(key,actual,crypto.fileContext(f.id));
    // Upload each file before pointing the manifest at it (no broken references).
    const existing=await readJson(filePath(f.id));
    if(existing)throw Error("Datei-ID existiert bereits auf GitHub. Keine Datei überschrieben.");
    await writeJson(filePath(f.id),envelope,null);
   }
   const fresh=await readJson(manifestPath);
   if((fresh?.sha||null)!==manifestSha)
    throw Error("Das Manifest wurde während des Uploads geändert. Der alte Stand bleibt erhalten.");
   const snapshot=strippedSnapshot(local);
   const envelope=await crypto.encrypt(key,crypto.encodeJson(snapshot),crypto.manifestContext());
   const written=await writeJson(manifestPath,{format:"career-agency-e2ee-v1",salt:crypto.toBase64(salt),...envelope},manifestSha);
   if(!written)throw Error("GitHub hat den Speicher-Commit nicht bestätigt.");
   manifestSha=written;remote={sha:written,meta:snapshot};needsRestore=false;
   stateMessage("Verschlüsselt auf GitHub gesichert · "+snapshot.files.length+" Datei(en), "+snapshot.dossiers.length+" Dossier(s).");
  }catch(err){
   stateMessage("Nicht gesichert: "+err.message,true);
  }finally{
   setBusy(false);renderStatus();
   if(queued){queued=false;queueSave();}
  }
 }
 async function restore(){
  if(!connected||busy)return;
  if(!window.confirm("Verschlüsselte GitHub-Dateien in diesen Browser laden? Gleichnamige lokale Einträge bleiben erhalten."))return;
  setBusy(true);stateMessage("Entschlüssele die vorhandenen Bewerbungsdossiers …");
  try{
   const found=await readRemote();
   if(!found)throw Error("Noch keine Sicherung im Repository vorhanden.");
   const local=store.snapshot(),have=new Set(local.files.map(x=>x.id));
   const imports=[];
   for(const meta of found.meta.files){
    if(have.has(meta.id))continue;
    const foundFile=await readJson(filePath(meta.id));
    if(!foundFile)throw Error("Verschlüsselte Datei "+meta.id+" fehlt im Repository.");
    const bytes=await crypto.decrypt(key,foundFile.data,crypto.fileContext(meta.id));
    if(bytes.byteLength!==meta.size)throw Error("Datei-Integrität verletzt: "+meta.id);
    imports.push({...meta,content:new Blob([bytes],{type:meta.type||"application/octet-stream"})});
   }
   await store.importSnapshot(found.meta.dossiers,imports);
   const updated=store.snapshot();
   manifestSha=found.sha;remote=found;needsRestore=false;
   if(!sameRemoteIds(found.meta,updated))throw Error("Metadatenkonflikt nach dem Import.");
   stateMessage("GitHub-Sicherung eingelesen: "+imports.length+" zusätzliche Datei(en). Lokale Daten wurden nicht gelöscht.");
   renderStatus();
   // Upload any remaining local-only content as a new encrypted revision.
   if(updated.files.length>found.meta.files.length||updated.dossiers.length>found.meta.dossiers.length)queueSave();
  }catch(err){stateMessage("Wiederherstellung fehlgeschlagen: "+err.message,true);}
  finally{setBusy(false);renderStatus();}
 }
 function queueSave(){
  if(!connected||needsRestore)return;
  window.clearTimeout(saveTimer);
  saveTimer=window.setTimeout(()=>{if(busy){queued=true;return;}void save();},900);
 }
 function lock(){
  window.clearTimeout(saveTimer);token="";key=null;salt=null;remote=null;
  connected=false;busy=false;needsRestore=false;queued=false;manifestSha=null;
  renderStatus();stateMessage("GitHub-Sicherung gesperrt. Lokale Dateien bleiben erhalten.");
 }
 $("dossierVaultForm").addEventListener("submit",connect);
 $("dossierVaultSave").addEventListener("click",()=>{window.clearTimeout(saveTimer);void save();});
 $("dossierVaultRestore").addEventListener("click",()=>void restore());
 $("dossierVaultLock").addEventListener("click",lock);
 window.addEventListener("career-dossiers-changed",()=>{
  if(connected&&!needsRestore){stateMessage("Lokale Änderung erkannt · verschlüsselte GitHub-Sicherung läuft …");queueSave();}
  else if(!connected)stateMessage("Änderungen nur lokal. Für die GitHub-Sicherung entsperren.");
 });
 renderStatus();
})();
