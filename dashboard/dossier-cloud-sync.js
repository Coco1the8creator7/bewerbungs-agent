/*
 * Career.Agency public DEMO dossier backup. Only synthetic application data.
 * Explicit per-dossier public-data acknowledgement is required. Token is kept
 * in memory by this module (the existing Feedback token may be reused by UI).
 * Do NOT reuse this GitHub storage adapter for real applicant information.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.CareerDossierCloud=api;
})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){
  "use strict";
  const SOURCE_REPO="Coco1the8creator7/bewerbungs-agent";
  const PREFIX="demo-dossiers/v1";
  const MAX_ARCHIVE_BYTES=5*1024*1024;
  const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/;
  const FORMAT="career-agency-public-demo-dossier-v1";
  const utf8=new TextEncoder();
  function fail(code,message){const err=new Error(message);err.code=code;return err;}
  function bytesToBase64(bytes){
    let text="";
    for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
    if(typeof btoa==="function")return btoa(text);
    if(typeof Buffer!=="undefined")return Buffer.from(bytes).toString("base64");
    throw fail("UNSUPPORTED","Base64-Kodierung nicht unterstützt.");
  }
  function base64ToText(value){
    const encoded=String(value||"").replace(/\s+/g,"");
    const bytes=typeof atob==="function"?Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)):
      typeof Buffer!=="undefined"?Uint8Array.from(Buffer.from(encoded,"base64")):null;
    if(!bytes)throw fail("UNSUPPORTED","Base64-Dekodierung nicht unterstützt.");
    return new TextDecoder().decode(bytes);
  }
  function canonical(value){return JSON.stringify(value);}
  function createClient(fetcher=typeof fetch==="function"?fetch.bind(globalThis):null){
    if(typeof fetcher!=="function")throw fail("UNSUPPORTED","GitHub-Zugriff ist in diesem Browser nicht verfügbar.");
    let repoName="",credential="",branch="",dossierId="",knownSha=null,bundleSha=null,remoteExists=false,blocked=false,connected=false;
    function path(name){return PREFIX+"/"+dossierId+"/"+name;}
    function fileUrl(name){
      return "https://api.github.com/repos/"+repoName+"/contents/"+path(name).split("/").map(encodeURIComponent).join("/");
    }
    async function request(url,method="GET",body){
      if(!credential)throw fail("DISCONNECTED","GitHub-Verbindung fehlt.");
      let response;
      try{response=await fetcher(url,{method,cache:"no-store",headers:{
        "Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",
        "Authorization":"Bearer "+credential,...(body?{"Content-Type":"application/json"}:{})
      },...(body?{body:JSON.stringify(body)}:{})});}
      catch(_error){throw fail("NETWORK","GitHub ist nicht erreichbar. Der lokale Entwurf bleibt erhalten.");}
      if(response.status===404)return {missing:true};
      if(!response.ok){
        const code=response.status===401||response.status===403?"AUTH":response.status===409||response.status===422?"CONFLICT":"REMOTE";
        throw fail(code,"GitHub HTTP "+response.status+" – bitte Berechtigung, Verbindung und Dateikonflikte prüfen.");
      }
      try{return await response.json()}catch(_error){throw fail("FORMAT","Unerwartete GitHub-Antwort.");}
    }
    async function get(name){
      const info=await request(fileUrl(name)+"?ref="+encodeURIComponent(branch));
      if(info.missing)return null;
      if(!info.sha||typeof info.content!=="string")throw fail("FORMAT","GitHub-Datei hat ein unerwartetes Format.");
      return info;
    }
    async function readRemote(){
      const file=await get("draft.json");
      if(!file)return null;
      let parsed;
      try{parsed=JSON.parse(base64ToText(file.content));}
      catch(_error){throw fail("FORMAT","Cloud-Entwurf ist beschädigt oder nicht lesbar.");}
      if(parsed?.format!==FORMAT||parsed?.dossierId!==dossierId||!parsed?.data?.docs)
        throw fail("FORMAT","Unbekannte oder unpassende Dossier-Datei auf GitHub.");
      return {sha:file.sha,data:parsed.data,savedAt:parsed.savedAt};
    }
    function requireConnected(){if(!connected)throw fail("DISCONNECTED","Bitte zuerst die öffentliche Demo-Sicherung verbinden.");}
    async function connect({token,id,local,publicDemoConfirmed=false}){
      disconnect();
      if(!ID.test(id||""))throw fail("INVALID","Dossier-ID ungültig.");
      if(publicDemoConfirmed!==true)
        throw fail("CONSENT","Vor einer öffentlichen Sicherung müssen ausdrücklich ausschliesslich fiktive Demo-Daten bestätigt werden.");
      if(typeof token!=="string"||!token.trim())throw fail("AUTH","GitHub-Token fehlt. Bitte zuerst den bestehenden GitHub-Zugang verbinden.");
      repoName=SOURCE_REPO;credential=token.trim();dossierId=id;
      try{
        const info=await request("https://api.github.com/repos/"+SOURCE_REPO);
        if(info.missing)throw fail("AUTH","Öffentliches Demo-Repository nicht erreichbar.");
        if(info.full_name&&info.full_name.toLowerCase()!==SOURCE_REPO.toLowerCase())
          throw fail("INVALID","GitHub hat ein anderes Repository geliefert.");
        if(info.private!==false||info.visibility==="private")
          throw fail("INVALID","Der öffentliche Demo-Modus erwartet das bekannte öffentliche Repository.");
        if(info.archived||info.disabled)throw fail("INVALID","Das Repository ist nicht beschreibbar.");
        branch=info.default_branch;
        if(!branch)throw fail("FORMAT","Standardbranch konnte nicht ermittelt werden.");
        const remote=await readRemote();
        knownSha=remote?.sha||null;
        remoteExists=!!remote;
        blocked=remoteExists&&canonical(remote.data)!==canonical(local);
        connected=true;
        return {remoteExists,blocked,matching:remoteExists&&!blocked};
      }catch(err){disconnect();throw err;}
    }
    async function write(name,bytes,sha,message){
      const body={branch,message,content:bytesToBase64(bytes)};
      if(sha)body.sha=sha;
      const response=await request(fileUrl(name),"PUT",body);
      if(!response?.content?.sha)throw fail("REMOTE","GitHub hat keinen Dateistand bestätigt.");
      return response.content.sha;
    }
    async function push(local,archiveBytes){
      requireConnected();
      // The user approved publication only in this fixed, public demo repository.
      const visibility=await request("https://api.github.com/repos/"+SOURCE_REPO);
      if(visibility.missing||visibility.private!==false||visibility.visibility==="private"){
        blocked=true;
        throw fail("INVALID","Öffentliches Demo-Repository nicht mehr verfügbar; Sicherung gestoppt.");
      }
      if(blocked)throw fail("CONFLICT","Auf GitHub liegt ein anderer Entwurf. Bitte erst «Von GitHub laden» verwenden. Lokale Änderungen bleiben erhalten.");
      if(!(archiveBytes instanceof Uint8Array)||!archiveBytes.length||archiveBytes.length>MAX_ARCHIVE_BYTES)
        throw fail("INVALID","Dossier-ZIP fehlt oder ist grösser als 5 MB. Nichts wurde übertragen.");
      const current=await readRemote();
      if((current?.sha||null)!==(knownSha||null)){
        blocked=true;
        throw fail("CONFLICT","Auf GitHub wurde dieser Entwurf inzwischen geändert. Keine lokale Version überschrieben.");
      }
      if(current&&canonical(current.data)===canonical(local)){
        knownSha=current.sha;return {unchanged:true};
      }
      // Write the downloadable bundle first, then the editable source of truth last.
      // A failed second write keeps the prior draft intact; a later retry refreshes the bundle.
      const lastArchive=await get("Dossier.zip");
      bundleSha=await write("Dossier.zip",archiveBytes,lastArchive?.sha||null,"backup: Dossier Studio PDF bundle");
      const record={format:FORMAT,dossierId,savedAt:new Date().toISOString(),data:local};
      knownSha=await write("draft.json",utf8.encode(JSON.stringify(record)),knownSha,"backup: Dossier Studio editable documents");
      remoteExists=true;
      return {unchanged:false,savedAt:record.savedAt};
    }
    async function pull(){
      requireConnected();
      const remote=await readRemote();
      if(!remote)throw fail("MISSING","Auf GitHub wurde noch kein Dossier-Entwurf gefunden.");
      knownSha=remote.sha;remoteExists=true;
      return structuredClone(remote.data);
    }
    function acceptRemote(){
      requireConnected();blocked=false;
      // The caller MUST have safely persisted the data returned by pull() before calling this.
    }
    function keepLocal(){
      requireConnected();
      // Only call after an explicit, informed conflict-resolution decision.
      // knownSha remains the observed remote revision; later external edits still block.
      blocked=false;
    }
    function disconnect(){
      credential="";repoName="";branch="";dossierId="";knownSha=null;bundleSha=null;remoteExists=false;blocked=false;connected=false;
    }
    function status(){return {connected,repository:repoName,blocked,remoteExists,hasToken:!!credential};}
    return Object.freeze({connect,push,pull,acceptRemote,keepLocal,disconnect,status});
  }
  return Object.freeze({createClient,SOURCE_REPO,PREFIX,MAX_ARCHIVE_BYTES,FORMAT});
});