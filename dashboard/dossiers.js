/* Career.Agency / Dossiers: local IndexedDB document workspace.
 * Stable IDs support a future authenticated private backend.
 */
(function(){
 "use strict";
 const root=document.getElementById("mode-dossiers");
 if(!root)return;
 const $=id=>document.getElementById(id);
 const DB="career-agency-dossiers-v1",DB_VERSION=1,MAX_BYTES=15*1024*1024,MAX_FILES=50;
 const ALLOWED=new Set(["pdf","doc","docx","odt","txt","png","jpg","jpeg"]);
 const state={dossiers:[],files:[],editingId:null,uploadTarget:null,ready:false};
 let connection=null,refreshPending=Promise.resolve();

 function make(tag,value,klass){
  const e=document.createElement(tag);
  if(klass)e.className=klass;
  if(value!==undefined)e.textContent=String(value);
  return e;
 }
 function notice(value,error=false){
  const el=$("dossierMessage");el.textContent=value;el.classList.toggle("is-error",error);
 }
 function uniqueId(){
  return window.crypto?.randomUUID?.() || "d-"+Date.now()+"-"+Math.random().toString(36).slice(2);
 }
 function openDb(){
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
   const req=window.indexedDB.open(DB,DB_VERSION);
   req.onupgradeneeded=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains("dossiers"))db.createObjectStore("dossiers",{keyPath:"id"});
    if(!db.objectStoreNames.contains("files"))db.createObjectStore("files",{keyPath:"id"});
   };
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error||Error("Dossierspeicher konnte nicht geöffnet werden."));
   req.onblocked=()=>reject(Error("Bitte andere Tabs mit Career.Agency schliessen."));
  }).catch(e=>{connection=null;throw e;});
  return connection;
 }
 async function transact(table,mode,method,payload){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(table,mode);
   const store=tx.objectStore(table),req=payload===undefined?store[method]():store[method](payload);
   let result;
   req.onsuccess=()=>{result=req.result;};
   tx.oncomplete=()=>resolve(result);
   tx.onerror=tx.onabort=()=>reject(tx.error||req.error||Error("Lokale Speicherung fehlgeschlagen."));
  });
 }
 function getAll(table){return transact(table,"readonly","getAll");}
 function put(table,value){return transact(table,"readwrite","put",value);}
 function remove(table,id){return transact(table,"readwrite","delete",id);}
 function availableJobs(){
  const rows=window.CareerDossierJobs?.()||[];
  return rows.filter(j=>j&&typeof j.id==="string"&&!j.id.startsWith("DEMO-"))
   .map(j=>({id:j.id,title:String(j.title||""),company:String(j.company||""),location:String(j.location||"")}));
 }
 function formatDate(date){
  const d=new Date(date);return Number.isNaN(d.getTime())?"–":new Intl.DateTimeFormat("de-CH",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
 }
 function fileSize(value){return value<1024*1024?Math.max(1,Math.round(value/1024))+" KB":(value/(1024*1024)).toFixed(1)+" MB";}
 function setBusy(button,value){button.disabled=value;button.setAttribute("aria-busy",String(value));}
 async function refresh(){
  const [dossiers,files]=await Promise.all([getAll("dossiers"),getAll("files")]);
  state.dossiers=dossiers.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  state.files=files.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  state.ready=true;
  render();
  // Tell the landing page which jobs are already represented in Dossiers.
  // IndexedDB remains the single source of truth; no duplicate CRM storage.
  window.dispatchEvent(new CustomEvent("career-dossier-jobs-changed",{
   detail:{job_ids:state.dossiers.filter(row=>typeof row.jobId==="string"&&row.jobId).map(row=>row.jobId)}
  }));
 }
 function button(label,handler,secondary=false){
  const b=make("button",label,secondary?"dossier-button-quiet":"");
  b.type="button";b.addEventListener("click",handler);return b;
 }
 function downloadable(file){
  const anchor=document.createElement("a"),url=URL.createObjectURL(file.content);
  anchor.href=url;anchor.download=file.name;document.body.append(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 function preview(file){
  if(!/\.(pdf|png|jpg|jpeg)$/i.test(file.name)){downloadable(file);return;}
  const url=URL.createObjectURL(file.content);
  const anchor=document.createElement("a");
  anchor.href=url;anchor.target="_blank";anchor.rel="noopener noreferrer";
  document.body.append(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),120000);
 }
 function fileRow(file){
  const row=make("div",undefined,"dossier-file");
  const info=make("div",undefined,"dossier-file-info");
  info.append(make("strong",file.name),make("small",fileSize(file.size)+" · "+formatDate(file.createdAt)));
  const actions=make("div",undefined,"dossier-file-actions");
  actions.append(button("Öffnen",()=>preview(file),true),button("Download",()=>downloadable(file),true));
  const del=button("Entfernen",async()=>{
   if(!window.confirm("Datei «"+file.name+"» dauerhaft aus diesem Browser löschen?"))return;
   try{await remove("files",file.id);await refresh();notice("Datei entfernt.");}
   catch(err){notice(err.message,true);}
  },true);
  del.setAttribute("aria-label","Datei entfernen: "+file.name);actions.append(del);
  row.append(info,actions);return row;
 }
 function renderLibrary(){
  const host=$("dossierLibrary");host.replaceChildren();
  const files=state.files.filter(file=>!file.dossierId);
  $("dossierLibraryCount").textContent=files.length+" "+(files.length===1?"Datei":"Dateien");
  if(!files.length){
   host.append(make("p","Noch keine Basisunterlagen hochgeladen. Hier kannst du beispielsweise Lebenslauf, Zeugnisse und Diplome ablegen.","dossier-quiet"));
   return;
  }
  for(const file of files)host.append(fileRow(file));
 }
 function editDossier(row){
  state.editingId=row?.id||null;
  const select=$("dossierJobSelect"),jobs=availableJobs();
  select.replaceChildren(new Option("Ohne verknüpftes Inserat",""));
  for(const j of jobs)select.add(new Option(j.title+(j.company?" · "+j.company:""),j.id));
  if(row?.jobId&&!jobs.some(j=>j.id===row.jobId)){
   select.add(new Option(row.title+(row.company?" · "+row.company:"")+" (ursprüngliches Inserat)",row.jobId));
  }
  select.value=row?.jobId||"";
  $("dossierTitleInput").value=row?.title||"";
  $("dossierCompanyInput").value=row?.company||"";
  $("dossierTone").value=row?.preferences?.tone||"klar";
  $("dossierLength").value=row?.preferences?.length||"standard";
  $("dossierFocus").value=row?.preferences?.focus||"";
  $("dossierDialogTitle").textContent=row?"Dossier bearbeiten":"Dossier vorbereiten";
  $("dossierSubmit").textContent=row?"Änderungen speichern":"Vorbereitung speichern";
  $("dossierDialog").showModal();
 }
 function card(row){
  const files=state.files.filter(file=>file.dossierId===row.id);
  const card=make("article",undefined,"dossier-card");
  const header=make("div",undefined,"dossier-card-head");
  const lead=make("div");lead.append(make("h3",row.title),make("p",[row.company,row.location].filter(Boolean).join(" · ")||"Eigene Bewerbung"));
  const status=make("span",files.length?"Dateien vorhanden":"In Vorbereitung","dossier-status");
  header.append(lead,status);
  const detail=make("p","Zuletzt bearbeitet "+formatDate(row.updatedAt)+" · "+files.length+" "+(files.length===1?"Datei":"Dateien"),"dossier-card-detail");
  const actions=make("div",undefined,"dossier-card-actions");
  actions.append(button("Datei hinzufügen",()=>chooseFiles(row.id)),button("Einstellungen",()=>editDossier(row),true));
  if(files.length===1)actions.append(button("Dossier-Datei laden",()=>downloadable(files[0]),true));
  const del=button("Dossier entfernen",async()=>{
   if(!window.confirm("Dossier «"+row.title+"» entfernen? Zugeordnete Dateien bleiben unter Basisunterlagen erhalten."))return;
   try{
    for(const f of files)await put("files",{...f,dossierId:null});
    await remove("dossiers",row.id);await refresh();notice("Dossier entfernt. Dateien bleiben in der Ablage.");
   }catch(err){notice(err.message,true);}
  },true);
  actions.append(del);
  const contents=make("div",undefined,"dossier-attachments");
  if(!files.length)contents.append(make("p","Noch keine Dateien zugeordnet. Generierte Dokumente können später hier erscheinen.","dossier-quiet"));
  else for(const f of files)contents.append(fileRow(f));
  card.append(header,detail,actions,contents);
  return card;
 }
 function render(){
  if(!state.ready)return;
  const q=$("dossierSearch").value.trim().toLocaleLowerCase("de-CH");
  const rows=state.dossiers.filter(d=>[d.title,d.company,d.location].join(" ").toLocaleLowerCase("de-CH").includes(q));
  $("dossierCount").textContent=String(state.dossiers.length);
  $("dossierFileCount").textContent=String(state.files.length);
  $("dossierTabCount").textContent="("+state.dossiers.length+")";
  const host=$("dossierList");host.replaceChildren();
  if(!rows.length){
   const empty=make("div",undefined,"dossier-empty");
   empty.append(make("p",q?"Keine passenden Dossiers gefunden.":"Noch keine Dossiers vorhanden. Starte hier oder direkt aus einem Inserat."));
   if(!q)empty.append(button("Dossier vorbereiten",()=>editDossier(null)));
   host.append(empty);
  }else for(const row of rows)host.append(card(row));
  renderLibrary();
 }
 function chooseFiles(dossierId=null){
  state.uploadTarget=dossierId;
  const input=$("dossierFileInput");input.value="";input.click();
 }
 async function handleUpload(selected){
  const files=Array.from(selected||[]);if(!files.length)return;
  const target=state.uploadTarget;
  if(state.files.length+files.length>MAX_FILES){notice("Maximal "+MAX_FILES+" Dateien pro Browser-Arbeitsplatz.",true);return;}
  const rejected=[],stored=[];
  for(const file of files){
   const ext=file.name.split(".").pop()?.toLowerCase();
   if(!ALLOWED.has(ext)||file.size>MAX_BYTES||!file.size){rejected.push(file.name);continue;}
   const duplicate=state.files.some(f=>f.dossierId===target&&f.name===file.name&&f.size===file.size);
   if(duplicate){rejected.push(file.name+" (bereits vorhanden)");continue;}
   try{
    const entry={id:uniqueId(),dossierId:target,ownerId:null,name:file.name,size:file.size,type:file.type||"",createdAt:new Date().toISOString(),content:file};
    await put("files",entry);state.files.push(entry);stored.push(file.name);
   }catch(err){notice("Speichern fehlgeschlagen. Möglicherweise ist der Gerätespeicher voll: "+err.message,true);break;}
  }
  await refresh();
  if(stored.length)notice(stored.length+" "+(stored.length===1?"Datei":"Dateien")+" lokal gespeichert."+ (rejected.length?" Übersprungen: "+rejected.join(", "):""));
  else if(rejected.length)notice("Keine Datei gespeichert. Zulässig sind PDF, DOC(X), ODT, TXT und Bilder bis 15 MB. "+rejected.join(", "),true);
 }
 function populateFromSelected(){
  const job=availableJobs().find(j=>j.id===$("dossierJobSelect").value);
  if(job){$("dossierTitleInput").value=job.title;$("dossierCompanyInput").value=job.company;}
 }
 async function submit(event){
  event.preventDefault();
  const title=$("dossierTitleInput").value.trim(),company=$("dossierCompanyInput").value.trim();
  const jobId=$("dossierJobSelect").value||null;
  if(!title){notice("Bitte eine Stellenbezeichnung angeben.",true);$("dossierTitleInput").focus();return;}
  if(jobId){
   const existing=state.dossiers.find(d=>d.jobId===jobId&&d.id!==state.editingId);
   if(existing){$("dossierDialog").close();editDossier(existing);notice("Für dieses Inserat gibt es bereits ein Dossier. Du bearbeitest den vorhandenen Eintrag.");return;}
  }
  const former=state.dossiers.find(d=>d.id===state.editingId);
  const now=new Date().toISOString();
  const job=availableJobs().find(j=>j.id===jobId);
  const entry={
   id:former?.id||uniqueId(),ownerId:null,jobId,
   title:title.slice(0,250),company:company.slice(0,250),
   location:job?.location||former?.location||"",
   status:"draft",origin:former?.origin||"local",createdAt:former?.createdAt||now,updatedAt:now,
   preferences:{tone:$("dossierTone").value,length:$("dossierLength").value,focus:$("dossierFocus").value.trim().slice(0,1000)}
  };
  const submit=$("dossierSubmit");setBusy(submit,true);
  try{
   await put("dossiers",entry);$("dossierDialog").close();await refresh();
   // CRM/Agency erst nach einer tatsächlich erfolgreichen Dossierspeicherung fortschreiben.
   window.dispatchEvent(new CustomEvent("career-dossier-prepared",{detail:{job_id:entry.jobId||null}}));
   notice("Dossiervorbereitung gespeichert. KI-Dokumentengenerierung ist noch nicht angeschlossen.");
  }catch(err){notice("Dossier konnte nicht gespeichert werden: "+err.message,true);}
  finally{setBusy(submit,false);}
 }
 async function addJob(job){
  if(!job||typeof job.id!=="string"||!job.id.trim()||job.id.startsWith("DEMO-")||
     typeof job.title!=="string"||!job.title.trim())
   throw Error("Dieses Inserat kann nicht in Dossiers übernommen werden.");
  // Serialize rapid taps so the same job never creates two draft records.
  const run=async()=>{
   await initialRefresh;
   if(!state.ready)throw Error("Dossierspeicher ist derzeit nicht verfügbar.");
   const existing=state.dossiers.find(row=>row.jobId===job.id);
   if(existing){
    notice("Diese Stelle ist bereits in deiner Dossierübersicht vorhanden.");
    return {added:false,dossierId:existing.id};
   }
   const now=new Date().toISOString();
   const entry={
    id:uniqueId(),ownerId:null,jobId:job.id,
    title:job.title.trim().slice(0,250),
    company:String(job.company||"").slice(0,250),
    location:String(job.location||"").slice(0,250),
    status:"draft",origin:"job-card",createdAt:now,updatedAt:now,
    preferences:{tone:"klar",length:"standard",focus:""}
   };
   await put("dossiers",entry);
   await refresh();
   notice("Stelle in die Dossierübersicht übernommen. Du kannst das Dossier jetzt vorbereiten.");
   // Intentionally no career-dossier-prepared event: saving a job is not
   // evidence that an application document was prepared.
   return {added:true,dossierId:entry.id};
  };
  const result=refreshPending.then(run,run);
  refreshPending=result.catch(()=>{});
  return result;
 }
 function prepare(job){
  if(!state.ready){notice("Lokale Ablage wird noch initialisiert. Bitte nochmals versuchen.",true);return;}
  window.location.hash="#dossiers";
  const existing=job?.id?state.dossiers.find(d=>d.jobId===job.id):null;
  editDossier(existing||null);
  if(job&&!existing){
   const select=$("dossierJobSelect");
   if(job.id && ![...select.options].some(o=>o.value===job.id))select.add(new Option(job.title,job.id));
   select.value=job.id||"";
   $("dossierTitleInput").value=job.title||"";
   $("dossierCompanyInput").value=job.company||"";
  }
 }
 window.CareerDossiers=Object.freeze({prepare,addJob,listJobIds:()=>state.dossiers.map(row=>row.jobId).filter(Boolean)});
 $("dossierCreate").addEventListener("click",()=>editDossier(null));
 $("dossierUpload").addEventListener("click",()=>chooseFiles());
 $("dossierLibraryUpload").addEventListener("click",()=>chooseFiles());
 $("dossierFileInput").addEventListener("change",e=>handleUpload(e.target.files));
 $("dossierSearch").addEventListener("input",render);
 $("dossierJobSelect").addEventListener("change",populateFromSelected);
 $("dossierForm").addEventListener("submit",submit);
 $("dossierCancel").addEventListener("click",()=>$("dossierDialog").close());
 const initialRefresh=refresh().catch(err=>{
  notice("Lokale Dateiablage nicht verfügbar: "+err.message,true);
  throw err;
 });
})();