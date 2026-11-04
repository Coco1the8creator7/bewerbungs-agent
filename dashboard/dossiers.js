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
 const state={dossiers:[],files:[],uploadTarget:null,ready:false};
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
 function openGenerationDialog(){
  const choices=state.dossiers.filter(row=>row.jobId&&!row.generatedStudio&&!String(row.jobId).startsWith("DEMO-"));
  const select=$("dossierGenerateJobSelect");
  select.replaceChildren();
  for(const row of choices)select.add(new Option(row.title+(row.company?" · "+row.company:""),row.id));
  const empty=!choices.length;
  $("dossierGenerateConfirm").disabled=empty;
  select.disabled=empty;
  $("dossierGenerationHint").textContent=empty
   ?"Noch keine vorgemerkten Stellen ohne Dossier. Markiere zuerst eine Stelle über das Dokumenten-Piktogramm auf der Startseite."
   :"CV, Motivationsschreiben und Bewerbungsmail werden als bearbeitbare Entwürfe angelegt. Persönliche Angaben müssen anschliessend geprüft und ergänzt werden.";
  $("dossierGenerationDialog").showModal();
 }
 function openStudio(row){window.location.href="./dossier-studio.html?dossier="+encodeURIComponent(row.id);}
 async function generateDossier(id){
  const run=async()=>{
   await initialRefresh;
   const previous=await transact("dossiers","readonly","get",id);
   if(!previous||!previous.jobId||String(previous.jobId).startsWith("DEMO-"))
    throw Error("Bitte zuerst eine gültige vorgemerkte Stelle wählen.");
   if(previous.generatedStudio){await refresh();return previous;}
   const docs=window.CareerDossierDocuments;
   if(!docs?.createDraft)throw Error("Dokumentenvorlagen sind noch nicht geladen.");
   const entry={...previous,generatedStudio:docs.createDraft(previous),generationStatus:"draft",
    updatedAt:new Date().toISOString()};
   await put("dossiers",entry);
   await refresh();
   // Agency: only successful draft generation counts, not bookmarking alone.
   window.dispatchEvent(new CustomEvent("career-dossier-prepared",{detail:{job_id:entry.jobId}}));
   notice("Dossierentwürfe erstellt. Bitte persönliche Angaben und Inhalte im Studio überprüfen.");
   return entry;
  };
  const result=refreshPending.then(run,run);
  refreshPending=result.catch(()=>{});
  return result;
 }
 async function downloadDossier(id,trigger){
  if(trigger)setBusy(trigger,true);
  try{
   const row=await transact("dossiers","readonly","get",id);
   if(!row?.generatedStudio)throw Error("Das Dossier wurde noch nicht generiert.");
   window.CareerDossierDocuments.download(row.generatedStudio,row.title);
  }catch(err){notice("Download fehlgeschlagen: "+err.message,true);}
  finally{if(trigger)setBusy(trigger,false);}
 }
 async function submitGeneration(event){
  event.preventDefault();
  const id=$("dossierGenerateJobSelect").value;
  const button=$("dossierGenerateConfirm");
  if(!id)return;
  setBusy(button,true);
  try{const entry=await generateDossier(id);$("dossierGenerationDialog").close();openStudio(entry);}
  catch(err){notice("Generierung fehlgeschlagen: "+err.message,true);}
  finally{setBusy(button,false);}
 }
  function card(row){
  const files=state.files.filter(file=>file.dossierId===row.id),generated=!!row.generatedStudio;
  const card=make("article",undefined,"dossier-card");
  const header=make("div",undefined,"dossier-card-head");
  const lead=make("div");
  lead.append(make("h3",row.title),make("p",[row.company,row.location].filter(Boolean).join(" · ")||"Ohne verknüpftes Inserat"));
  const status=make("span",generated?"Entwurf vorhanden":row.jobId?"Stelle vorgemerkt":"Alte Vorbereitung","dossier-status");
  header.append(lead,status);
  const detail=make("p",generated
   ?"CV · Motivationsschreiben · Bewerbungsmail · Zuletzt bearbeitet "+formatDate(row.updatedAt)
   :"Zuletzt bearbeitet "+formatDate(row.updatedAt),"dossier-card-detail");
  const actions=make("div",undefined,"dossier-card-actions");
  if(generated){
   actions.append(button("Dossier bearbeiten",()=>openStudio(row)));
   actions.append(button("Dossier herunterladen",event=>downloadDossier(row.id,event.currentTarget),true));
  }else if(row.jobId){
   actions.append(button("Dossier generieren",async function(){
    setBusy(this,true);
    try{const result=await generateDossier(row.id);openStudio(result);}
    catch(err){notice("Generierung fehlgeschlagen: "+err.message,true);setBusy(this,false);}
   }));
  }
  const extra=make("details",undefined,"dossier-card-more");
  extra.append(make("summary","Weitere Optionen"));
  const del=button("Dossier entfernen",async()=>{
   if(!window.confirm("Dossier «"+row.title+"» entfernen? Zugeordnete Dateien bleiben unter Basisunterlagen erhalten."))return;
   try{
    for(const f of files)await put("files",{...f,dossierId:null});
    await remove("dossiers",row.id);await refresh();notice("Dossier entfernt. Dateien bleiben in der Ablage.");
   }catch(err){notice(err.message,true);}
  },true);
  extra.append(del);
  const contents=make("div",undefined,"dossier-attachments");
  if(!generated&&!row.jobId)contents.append(make("p","Diese frühere Vorbereitung bleibt erhalten. Ohne verknüpfte Stelle ist keine automatische Generierung möglich.","dossier-quiet"));
  if(files.length)for(const f of files)contents.append(fileRow(f));
  card.append(header,detail,actions,extra,contents);
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
   empty.append(make("p",q?"Keine passenden Dossiers gefunden.":"Noch keine vorgemerkten Stellen. Nutze das Dokumenten-Piktogramm bei einer Stellenkarte."));
   if(!q)empty.append(button("Dossier generieren",openGenerationDialog));
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
   notice("Stelle vorgemerkt. Du kannst jetzt das Dossier generieren.");
   // Intentionally no career-dossier-prepared event: saving a job is not
   // evidence that an application document was prepared.
   return {added:true,dossierId:entry.id};
  };
  const result=refreshPending.then(run,run);
  refreshPending=result.catch(()=>{});
  return result;
 }
 window.CareerDossiers=Object.freeze({
  addJob,listJobIds:()=>state.dossiers.map(row=>row.jobId).filter(Boolean)
 });
 $("dossierGenerate").addEventListener("click",openGenerationDialog);
 $("dossierGenerationForm").addEventListener("submit",submitGeneration);
 $("dossierGenerateCancel").addEventListener("click",()=>$("dossierGenerationDialog").close());
 $("dossierUpload").addEventListener("click",()=>chooseFiles());
 $("dossierLibraryUpload").addEventListener("click",()=>chooseFiles());
 $("dossierFileInput").addEventListener("change",e=>handleUpload(e.target.files));
 $("dossierSearch").addEventListener("input",render);
 window.addEventListener("focus",()=>{if(state.ready)refresh().catch(err=>notice(err.message,true));});
  const initialRefresh=refresh().catch(err=>{
  notice("Lokale Dateiablage nicht verfügbar: "+err.message,true);
  // Avoid an unhandled rejection when the user never clicks a Dossier action.
  // addJob checks state.ready and reports the failure to the caller.
  return null;
 });
})();