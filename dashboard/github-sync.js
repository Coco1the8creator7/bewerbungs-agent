"use strict";
(function(){
 const owner="Coco1the8creator7",repo="bewerbungs-agent",path="dashboard/feedback.json",key="bewerbungs-agent-github-token-v1";
 const api="https://api.github.com/repos/"+owner+"/"+repo+"/contents/"+path;
 let baseline=null;
 function getToken(){try{return localStorage.getItem(key)||"";}catch{return "";}}
 function setToken(value){if(!/^(github_pat_|ghp_)/.test(value))throw Error("Ungültiges Tokenformat");localStorage.setItem(key,value);}
 function clearToken(){localStorage.removeItem(key);}
 async function request(url,options={}){
  const response=await fetch(url,{...options,headers:{"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",...(getToken()?{"Authorization":"Bearer "+getToken()}:{}),...(options.headers||{})},cache:"no-store"});
  if(!response.ok){let message="HTTP "+response.status;try{const payload=await response.json();if(payload.message)message+=": "+payload.message;}catch{}throw Error(message);}
  return response.json();
 }
 function decode(content){const binary=atob(content.replace(/\s/g,""));return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0))));}
 function encode(data){const bytes=new TextEncoder().encode(JSON.stringify(data,null,2)+"\n");let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
 async function read(){
  try{const r=await request(api+"?ref=main");return {sha:r.sha,data:decode(r.content)};}
  catch(e){if(/HTTP 404/.test(e.message))return {sha:null,data:null};throw e;}
 }
 async function loadPublic(){
  const response=await fetch("./feedback.json?nocache="+Date.now(),{cache:"no-store"});
  if(response.status===404)return null;
  if(!response.ok)throw Error("HTTP "+response.status);
  const data=await response.json();
  if(data.type!=="bewerbungs-agent-feedback")throw Error("Unerwartetes Feedbackformat");
  baseline=structuredClone(data);
  return data;
 }
 function entries(a,k){return new Map((a||[]).map(x=>[x[k],x]));}
 function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
 function merge(base,local,remote){
  if(!remote)return local;
  if(remote.type!=="bewerbungs-agent-feedback"||remote.schema_version!=="1.0.0")throw Error("Unbekanntes GitHub-Feedbackformat");
  if(!base){if(!equal(remote,local))throw Error("GitHub enthält bereits Daten. Bitte erst GitHub-Bewertungen laden bzw. lokale Daten sichern, um Überschreiben zu vermeiden.");return remote;}
  const result={...remote,updated_at:new Date().toISOString()};
  for(const [field,k] of [["annotations","id"],["relevance_ratings","id"],["dismissals","id"],["overrides","id"],["manual_jobs","id"],["activity_log","id"]]){
   const old=entries(base[field],k),ours=entries(local[field],k),theirs=entries(remote[field],k);
   for(const id of new Set([...old.keys(),...ours.keys()])){
    const before=old.get(id),mine=ours.get(id),other=theirs.get(id);
    if(equal(mine,before))continue;
    if(!equal(other,before)&&!equal(other,mine))throw Error("Konflikt bei "+field+" / "+id+". Bitte Änderungen sichern und auf einem Gerät zusammenführen.");
    if(mine===undefined)theirs.delete(id);else theirs.set(id,mine);
   }
   result[field]=[...theirs.values()];
  }
  const b=new Set(base.export_selection||[]),l=new Set(local.export_selection||[]),r=new Set(remote.export_selection||[]);
  for(const id of new Set([...b,...l])){if(b.has(id)===l.has(id))continue;if(l.has(id))r.add(id);else r.delete(id);}
  result.export_selection=[...r];
  return result;
 }
 async function save(local){
  if(!getToken())throw Error("Kein GitHub-Token hinterlegt");
  const current=await read();
  const data=merge(baseline,local,current.data);
  const body={message:"data: save dashboard feedback",content:encode(data),branch:"main"};
  if(current.sha)body.sha=current.sha;
  const written=await request(api,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  baseline=structuredClone(data);
  return written.commit.sha;
 }
 // Filter-KI sends only explicitly changed job IDs. All unrelated CRM records remain intact.
 // A concurrent writer is detected by the GitHub blob SHA; differing newer values are not overwritten.
 async function saveFilterRatings(patches){
  if(!getToken())throw Error("Kein GitHub-Token hinterlegt. Unter «Daten & Entwicklung» verbinden.");
  const kinds=["relevance_ratings","radar_career_ratings"];
  if(!patches||typeof patches!=="object")throw Error("Ungültige Bewertungsänderungen.");
  for(let attempt=0;attempt<3;attempt++){
   const current=await read();
   const remote=current.data||{type:"bewerbungs-agent-feedback",schema_version:"1.0.0",
    annotations:[],relevance_ratings:[],dismissals:[],export_selection:[],
    activity_log:[],overrides:[],manual_jobs:[]};
   if(remote.type!=="bewerbungs-agent-feedback"||remote.schema_version!=="1.0.0")throw Error("Unbekanntes GitHub-Feedbackformat.");
   const merged={...remote};
   let changed=false;
   for(const kind of kinds){
    const edits=patches[kind]||{};
    const items=new Map((remote[kind]||[]).map(item=>[item.id,item]));
    for(const [id,entry] of Object.entries(edits)){
     if(!id||id.startsWith("DEMO-")||!entry||entry.id!==id)throw Error("Ungültige Inserat-ID beim Synchronisieren.");
     const previous=items.get(id);
     if(JSON.stringify(previous)===JSON.stringify(entry))continue;
     // A newer remote edit to the same job needs a manual conflict resolution.
     const remoteTime=Date.parse(previous?.updated_at||"")||0;
     const localTime=Date.parse(entry.updated_at||"")||0;
     if(previous&&remoteTime>localTime)
      throw Error("Bewertungskonflikt bei "+id+": Auf GitHub liegt eine neuere Bewertung. Bitte manuell abgleichen.");
     items.set(id,entry);changed=true;
    }
    if(Object.keys(edits).length)merged[kind]=[...items.values()];
   }
   if(!changed)return {sha:current.sha,unchanged:true};
   merged.updated_at=new Date().toISOString();
   const body={message:"data: sync changed Filter-KI ratings",content:encode(merged),branch:"main"};
   if(current.sha)body.sha=current.sha;
   try{
    const written=await request(api,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    baseline=structuredClone(merged);
    return {sha:written.commit.sha,unchanged:false};
   }catch(err){
    if(/HTTP (409|422)/.test(err.message)&&attempt<2)continue;
    throw err;
   }
  }
  throw Error("GitHub wurde gleichzeitig geändert. Bitte erneut synchronisieren.");
 }
 // The read-only check retrieves the latest committed state, not the delayed Pages deployment.
 async function loadFilterRatings(){const current=await read();return current.data;}
 window.GithubFeedback=Object.freeze({getToken,setToken,clearToken,loadPublic,save,saveFilterRatings,loadFilterRatings});
})();