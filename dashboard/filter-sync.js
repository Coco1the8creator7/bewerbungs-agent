/* Filter-KI synchronisation: incremental, durable and independent of the main CRM save button. */
(function(){
 "use strict";
 const kinds=["relevance_ratings","radar_career_ratings"];
 const empty=()=>({relevance_ratings:{},radar_career_ratings:{}});
 const pending=empty();
 const confirmed=new Set();
 const touchedBeforeReady=[];
 let ready=false,starting=false,busy=false,lastError="",successUntil=0,writing=Promise.resolve(),storageError="";
 let writeRevision=0,savedRevision=0;
 const button=document.getElementById("radarSyncFeedback");
 const status=document.getElementById("radarSyncStatus");
 const equals=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const hasPending=()=>kinds.some(kind=>Object.keys(pending[kind]).length>0);
 function announce(message,error=false){
  status.hidden=!message;status.textContent=message;
  status.classList.toggle("is-error",error);
 }
 function icon(type){
  const svg=button.querySelector("svg");
  const paths={
   sync:'<path d="M20 11a8 8 0 0 0-14.7-4.3L4 8M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.7 4.3L20 16M16 16h4v4"/>',
   check:'<path d="m5 12 4 4L19 6"/>',
   warning:'<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>'
  };
  if(svg.dataset.icon!==type){svg.innerHTML=paths[type]||paths.sync;svg.dataset.icon=type;}
 }
 function show(){
  const dirty=hasPending();
  const failed=!!(lastError||storageError);
  const success=!dirty&&!failed&&Date.now()<successUntil;
  button.classList.toggle("is-syncing",busy);
  button.classList.toggle("is-dirty",dirty&&!busy&&!failed);
  button.classList.toggle("is-error",failed&&!busy);
  button.disabled=busy||!ready;
  button.setAttribute("aria-busy",String(busy));
  icon(!busy&&failed?"warning":success?"check":"sync");
  const label=busy?"Synchronisation läuft":failed?"Synchronisation fehlgeschlagen":
   dirty?"Ungespeicherte Bewertungen synchronisieren":success?"Bewertungen synchronisiert":"Keine Änderungen";
  button.title=label;
  button.setAttribute("aria-label",label);
  if(failed)announce(storageError||lastError,true);
  else if(busy)announce("Synchronisiere Bewertungen …");
  else if(success)announce("Bewertungen synchronisiert ✓");
  else if(dirty)announce("Änderungen ausstehend");
  else announce("");
 }
 function durable(){
  const snapshot={version:1,pending:structuredClone(pending),confirmed:[...confirmed]};
  const revision=++writeRevision;
  writing=writing.catch(()=>{}).then(async()=>{
   await window.AgentStore.saveFilterSync(snapshot);
   savedRevision=revision;storageError="";
  });
  writing.catch(err=>{storageError="Lokale Sicherung fehlgeschlagen: "+err.message;show();});
  return writing;
 }
 function entry(kind,id){
  if(kind==="relevance_ratings")return window.AgentCareerFeedback?.getEntry(id)||null;
  const current=window.CareerRadarBridge?.getCareerRating(id);
  // Synchronise numeric criteria only. Personal notes remain in opt-in local Radar storage.
  // Empty scores are explicit tombstones for cleared ratings.
  return {id,scores:structuredClone(current?.scores||{}),
   updated_at:current?.updated_at||new Date().toISOString()};
 }
 function capture(kind,id){
  if(!kinds.includes(kind)||typeof id!=="string"||!id||id.startsWith("DEMO-"))return;
  if(!ready){touchedBeforeReady.push({kind,id});return;}
  const value=entry(kind,id);
  if(!value)return;
  pending[kind][id]=structuredClone(value);
  confirmed.delete(id);
  lastError="";successUntil=0;
  durable();show();
 }
 function syncUpdated(){window.dispatchEvent(new Event("career-filter-sync-updated"));}
 function isConfirmed(id){
  return ready&&confirmed.has(id)&&!kinds.some(kind=>Object.hasOwn(pending[kind],id))&&
   (window.AgentCareerFeedback?.getScore(id)!=null||
    Object.keys(window.CareerRadarBridge?.getCareerRating(id)?.scores||{}).length>0);
 }
 async function sync(){
  if(!ready||busy||!hasPending())return;
  busy=true;show();
  try{
   // Flush IndexedDB first: reload during upload must retain all draft changes.
   await writing;
   if(storageError)throw Error(storageError);
   const batch=structuredClone(pending);
   // Browser Web Locks serialise writes across tabs of the same origin when supported.
   // GitHub SHA conflict checks remain the fallback for other browsers/devices.
   const write=()=>window.GithubFeedback.saveFilterRatings(batch);
   const result=await (navigator.locks?.request?
    navigator.locks.request("career-filter-ki-github-writer",{mode:"exclusive"},write):write());
   // A newer edit may have arrived during the network request: acknowledge only
   // the version actually sent. A second batch will be sent on the next tick.
   const touched=new Set();
   for(const kind of kinds){
    for(const [id,value] of Object.entries(batch[kind])){
     if(equals(pending[kind][id],value)){
      delete pending[kind][id];
      touched.add(id);
     }
    }
   }
   for(const id of touched)if(!kinds.some(kind=>Object.hasOwn(pending[kind],id)))confirmed.add(id);
   await durable();
   if(storageError)throw Error(storageError);
   lastError="";successUntil=Date.now()+3500;
   syncUpdated();
   if(result.unchanged)announce("Bereits auf GitHub gespeichert");
  }catch(err){
   lastError=err.message||"Netzwerkfehler. Erneut versuchen.";
  }finally{
   busy=false;show();
   if(!hasPending()&&!lastError)setTimeout(show,3700);
  }
 }
 async function start(){
  if(ready||starting)return;
  if(!window.CareerFeedbackReady||!window.CareerRadarReady)return;
  starting=true;
  try{
   const old=await window.AgentStore.loadFilterSync();
   if(old&&old.version===1){
    for(const kind of kinds)Object.assign(pending[kind],old.pending?.[kind]||{});
    for(const id of old.confirmed||[])if(typeof id==="string")confirmed.add(id);
   }
   // Pending changes take precedence over a possibly stale cloud snapshot at reload.
   for(const [id,value] of Object.entries(pending.relevance_ratings))
    window.AgentCareerFeedback?.restoreEntry(id,value);
   for(const [id,value] of Object.entries(pending.radar_career_ratings))
    window.CareerRadarBridge?.restoreCareerRating(id,value);
   // Read the account state once at startup. Previously synced 1–5
   // criteria were not part of the dashboard's original feedback loader.
   // Never overwrite a pending draft or a newer local opt-in rating.
   if(navigator.onLine!==false){
    try{
     const remote=await window.GithubFeedback.loadFilterRatings();
     if(remote?.type==="bewerbungs-agent-feedback"){
      for(const item of remote.radar_career_ratings||[]){
       if(!item||typeof item.id!=="string"||Object.hasOwn(pending.radar_career_ratings,item.id))continue;
       const local=window.CareerRadarBridge?.getCareerRating(item.id);
       if(!local||((Date.parse(local.updated_at)||0)<=(Date.parse(item.updated_at)||0))){
        window.CareerRadarBridge?.restoreCareerRating(item.id,item);
        if(!Object.hasOwn(pending.relevance_ratings,item.id))confirmed.add(item.id);
       }
      }
      for(const item of remote.relevance_ratings||[]){
       if(!item?.id||Object.hasOwn(pending.relevance_ratings,item.id))continue;
       const local=window.AgentCareerFeedback?.getEntry(item.id);
       if(!local||(Date.parse(local.updated_at)||0)<(Date.parse(item.updated_at)||0))
        window.AgentCareerFeedback?.restoreEntry(item.id,item);
       if(window.AgentCareerFeedback?.getScore(item.id)===item.score)confirmed.add(item.id);
      }
     }
    }catch(_err){/* Offline reads must not block local drafts or retry. */}
   }
  }catch(err){
   storageError="Lokale Bewertungen konnten nicht geladen werden: "+err.message;
  }
  ready=true;starting=false;
  for(const item of touchedBeforeReady.splice(0))capture(item.kind,item.id);
  show();syncUpdated();
  // No network request when nothing has changed.
  if(hasPending()&&navigator.onLine!==false)sync();
 }
 window.CareerFilterSync=Object.freeze({isConfirmed,sync,hasPending,isReady:()=>ready});
 window.addEventListener("career-filter-rating-dirty",e=>capture(e.detail?.kind,e.detail?.job_id));
 window.addEventListener("career-feedback-ready",start);
 window.addEventListener("career-radar-ready",start);
 button.addEventListener("click",()=>{if(hasPending())sync();else show();});
 window.addEventListener("online",()=>{if(hasPending())sync();});
 window.addEventListener("focus",()=>{if(hasPending())sync();});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&hasPending())sync();});
 window.addEventListener("beforeunload",e=>{
  if(!hasPending()&&writeRevision===savedRevision)return;
  if(!storageError&&writeRevision===savedRevision)return;
  e.preventDefault();e.returnValue="";
 });
 setInterval(()=>{if(hasPending()&&navigator.onLine!==false)sync();else show();},20000);
 show();
 start();
})();
