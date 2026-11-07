/* Private account persistence. Dossier Studio and its storage are unchanged. */
(function(){
 "use strict";
 const account=window.CareerAccount;
 if(!account?.id||!/^\/app\//.test(location.pathname))throw Error("Privater Kontokontext fehlt");
 const versions=new Map(),chains=new Map();
 async function request(path,options={}){
  const response=await fetch("/api/user/"+path,{credentials:"same-origin",cache:"no-store",...options,
   headers:{"Content-Type":"application/json",...(options.headers||{})}});
  if(!response.ok){
   let detail="HTTP "+response.status;try{detail=(await response.json()).detail||detail;}catch{}
   if(response.status===401||response.status===403)detail="Sitzung abgelaufen oder Zugriff gesperrt. Bitte erneut anmelden.";
   throw Error(detail);
  }
  return response.json();
 }
 async function load(key){const result=await request("state/"+key);versions.set(key,result.revision);return result.data;}
 function save(key,data){
  const snapshot=structuredClone(data);
  const operation=(chains.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
   if(!versions.has(key))await load(key);
   const result=await request("state/"+key,{method:"PUT",body:JSON.stringify({revision:versions.get(key),data:snapshot})});
   versions.set(key,result.revision);return result;
  });
  chains.set(key,operation);return operation;
 }
 // Pending filter edits remain device-bound, but are isolated by authenticated user.
 const scopedDB="career-private-pending-"+account.id;
 async function pending(mode,value){
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(scopedDB,1);r.onupgradeneeded=()=>r.result.createObjectStore("pending");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  return new Promise((resolve,reject)=>{let result;const tx=db.transaction("pending",mode),s=tx.objectStore("pending");
   const r=mode==="readonly"?s.get("filter"):s.put(value,"filter");r.onsuccess=()=>{result=r.result;};
   tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};});
 }
 window.AgentStore=Object.freeze({
  load:()=>load("workspace"),save:data=>save("workspace",data),
  loadSwipePrefs:()=>load("swipes"),saveSwipePrefs:data=>save("swipes",data),
  loadRadar:()=>load("radar"),saveRadar:data=>save("radar",data),clearRadar:()=>save("radar",null),
  loadLastVisit:()=>load("last-visit"),recordVisit:data=>save("last-visit",data),
  loadFilterSync:()=>pending("readonly"),saveFilterSync:data=>pending("readwrite",data),
  clear:async()=>{for(const key of ["workspace","radar","last-visit"])await save(key,null);}
 });
 window.GithubFeedback=Object.freeze({
  isConnected:()=>true,getToken:()=>"",setToken:()=>{throw Error("Das Konto benötigt keinen GitHub-Token.");},clearToken:()=>{},
  loadPublic:()=>load("feedback"),loadFilterRatings:()=>load("feedback"),
  save:async data=>{const result=await save("feedback",data);return String(result.revision);},
  saveFilterRatings:async patches=>{
   const result=await request("ratings",{method:"PATCH",body:JSON.stringify(patches)});
   // A ratings patch changes the shared feedback revision. Reload before a full save.
   // Do not advance an already-loaded full snapshot: its stale revision must conflict.
   return {...result,sha:String(result.revision)};
  }
 });
 window.CareerAccountFlush=async()=>{
  await Promise.all([...chains.values()]);
  await window.CareerFilterSync?.sync();
  if(window.CareerFilterSync?.hasPending())throw Error("Bewertungen noch nicht gespeichert. Bitte Synchronisation erneut versuchen.");
 };
 document.addEventListener("DOMContentLoaded",()=>{
  document.querySelector("#githubToken")?.closest(".persist-panel")?.setAttribute("hidden","");
  const checkbox=document.getElementById("persistEnabled");if(checkbox){checkbox.checked=true;checkbox.disabled=true;}
 });
})();
