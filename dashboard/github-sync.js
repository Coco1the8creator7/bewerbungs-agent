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
  if(!response.ok){let message="HTTP "+response.status;try{message+=(await response.json()).message?": "+(await response.clone().json()).message:"";}catch{}throw Error(message);}
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
  for(const [field,k] of [["annotations","id"],["relevance_ratings","id"],["overrides","id"],["manual_jobs","id"],["activity_log","id"]]){
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
 window.GithubFeedback=Object.freeze({getToken,setToken,clearToken,loadPublic,save});
})();