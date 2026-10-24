/* Career.Agency Radar v0.1. Self-contained prototype; no personal data on GitHub. */
(function(){
 "use strict";
 const model=window.CareerRadarModel,root=document.getElementById("mode-radar");
 if(!root||!model)return;
 const get=id=>document.getElementById(id);
 const make=(tag,label,klass)=>{const n=document.createElement(tag);if(klass)n.className=klass;if(label!==undefined)n.textContent=String(label);return n;};
 const state=model.normalizedState(null);
 let jobs=[],feedLoaded=false,feedBusy=false,showDemo=false,persistent=false;
 let pending=Promise.resolve();
 const sampleJobs=[
  {id:"DEMO-RADAR-1",title:"Lehrstelle Zeichner/in EFZ, Fachrichtung Architektur",company:"Fiktives Atelier",location:"Zürich",source:"Demo",description:"Fiktives Beispiel: Pläne zeichnen, Modelle bauen und in einem Team arbeiten."},
  {id:"DEMO-RADAR-2",title:"Lehrstelle Fachfrau/Fachmann Betreuung EFZ",company:"Fiktive Kita",location:"Winterthur",source:"Demo",description:"Fiktives Beispiel: Kinder begleiten, den Alltag gestalten und Verantwortung übernehmen."},
  {id:"DEMO-RADAR-3",title:"Lehrstelle Informatiker/in EFZ",company:"Fiktiver IT-Betrieb",location:"Baden",source:"Demo",description:"Fiktives Beispiel: Programme kennenlernen, Probleme lösen und Nutzerinnen und Nutzer unterstützen."}
 ];
 function message(value){get("radarStatus").textContent=value;}
 function persist(){
  if(!persistent)return;
  const copy=model.normalizedState(state);
  pending=pending.catch(()=>{}).then(()=>window.AgentStore.saveRadar(copy));
  pending.catch(e=>message("Nicht gespeichert: "+e.message));
 }
 function changed(){message(persistent?"Änderungen werden ausschliesslich auf diesem Gerät gespeichert.":"Nur in diesem Tab · nicht dauerhaft gespeichert.");persist();}
 function renderSources(){
  const target=get("radarSources");target.replaceChildren();
  for(const source of model.sources){
   const label=make("label",undefined,"radar-source");
   const input=make("input");input.type="checkbox";input.value=source.id;input.checked=state.selectedSources.includes(source.id);
   const content=make("span");content.append(make("b",source.label),make("small",source.hint));
   input.addEventListener("change",()=>{
    if(input.checked&&!state.selectedSources.includes(source.id))state.selectedSources.push(source.id);
    if(!input.checked)state.selectedSources=state.selectedSources.filter(s=>s!==source.id);
    updateSourceLabel();renderReviews();changed();
   });
   label.append(input,content);target.append(label);
  }
  updateSourceLabel();
 }
 function updateSourceLabel(){
  const n=state.selectedSources.length;
  get("radarSourceCount").textContent=n===0?"Noch keine Wunschquelle markiert":n+" Wunschquelle"+(n===1:"":"n")+" markiert";
 }
 function chip(group,skill,custom=false){
  const selected=custom?state.profile.extraSkills.includes(skill):state.profile.skills[group].includes(skill);
  const btn=make("button",skill+(custom?" ×":""),"radar-chip");btn.type="button";
  btn.setAttribute("aria-pressed",String(selected));btn.setAttribute("aria-label",(selected?"Entfernen: ":"Auswählen: ")+skill);
  btn.addEventListener("click",()=>{
   const target=custom?state.profile.extraSkills:state.profile.skills[group];
   const idx=target.indexOf(skill);
   if(idx>=0)target.splice(idx,1);
   else if(!custom)target.push(skill);
   renderSkills();changed();
  });
  return btn;
 }
 function renderSkills(){
  for(const [group,items] of Object.entries(model.skillGroups)){
   const host=get("radarSkills-"+group);host.replaceChildren();
   for(const skill of items)host.append(chip(group,skill));
  }
  const customs=get("radarExtraSkills");customs.replaceChildren();
  for(const skill of state.profile.extraSkills)customs.append(chip(null,skill,true));
  const count=Object.values(state.profile.skills).reduce((n,x)=>n+x.length,0)+state.profile.extraSkills.length;
  get("radarSkillCount").textContent=count+" ausgewählt";
 }
 function renderProfileFields(){
  for(const key of ["occupations","region","level","startYear","example"]){
   const input=get("radar-"+key);
   input.value=state.profile[key];
   input.addEventListener("input",()=>{
    state.profile[key]=input.value;
    if(key==="occupations"||key==="region"||key==="level")renderReviews();
    changed();
   });
  }
  for(const [id,key] of [["radarStrictOccupation","strictOccupation"],["radarStrictRegion","strictRegion"]]){
   const input=get(id);input.checked=state.profile[key];
   input.addEventListener("change",()=>{state.profile[key]=input.checked;renderReviews();changed();});
  }
 }
 function addSkill(){
  const input=get("radarCustomSkill"),value=input.value.trim().replace(/\s+/g," ");
  if(!value)return;
  if(value.length>48){message("Eigener Skill: höchstens 48 Zeichen.");return;}
  if(state.profile.extraSkills.length>=12){message("Maximal 12 eigene Skills.");return;}
  if(!state.profile.extraSkills.some(s=>s.toLocaleLowerCase("de-CH")===value.toLocaleLowerCase("de-CH")))state.profile.extraSkills.push(value);
  input.value="";renderSkills();changed();
 }
 function updateStats(rows){
  const summary=model.summarize(rows);
  for(const [id,key] of [["radarTotal","total"],["radarSinceYesterday","sinceYesterday"],["radarWeek","thisWeek"],["radarApprenticeships","apprenticeships"]])
   get(id).textContent=summary[key].toLocaleString("de-CH");
  const status=summary.apprenticeships?"Lehrstellen-Kandidaten anhand Inserattiteln erkannt. Bitte einzeln prüfen.":
   "Der bestehende Import enthält derzeit keine eindeutig als Lehrstelle erkennbaren Inserate.";
  get("radarFeedStatus").textContent=status+(summary.missingDates?" "+summary.missingDates+" Inserate ohne Importdatum zählen nicht als neu.":"");
  get("radarLiveLabel").textContent=feedLoaded?"IMPORT GELESEN · "+rows.length+" EINTRÄGE":"IMPORT NOCH NICHT GELADEN";
 }
 async function loadFeed(force=false){
  if(feedBusy||(feedLoaded&&!force))return;
  feedBusy=true;
  get("radarRefresh").disabled=true;
  get("radarFeedStatus").textContent="Öffentlichen Inserate-Import laden …";
  try{
   const response=await fetch("./jobs.json",{cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const data=await response.json();
   if(!Array.isArray(data))throw Error("Ungültiges Stellenformat.");
   jobs=data.filter(j=>j&&typeof j.id==="string"&&typeof j.title==="string");
   feedLoaded=true;
   updateStats(jobs);
  }catch(e){
   get("radarFeedStatus").textContent="Feed nicht erreichbar: "+e.message+". Die persönlichen Eingaben bleiben unverändert.";
  }finally{feedBusy=false;get("radarRefresh").disabled=false;renderReviews();}
 }
 function jobLine(job){
  const article=make("article",undefined,"radar-job");
  const head=make("header");const info=make("div");
  info.append(make("div",job.id.startsWith("DEMO-")?"FIKTIVES BEISPIEL · keine echte Lehrstelle":(job.source||"Quelle unbekannt"),"radar-kicker"));
  const title=make("h3");
  if(!job.id.startsWith("DEMO-")&&typeof job.url==="string"){
   let valid=null;try{const u=new URL(job.url);if(u.protocol==="https:"||u.protocol==="http:")valid=u.href;}catch{}
   if(valid){const a=make("a",job.title);a.href=valid;a.target="_blank";a.rel="noopener noreferrer";title.append(a);}
   else title.textContent=job.title;
  }else title.textContent=job.title;
  info.append(title,make("p",[job.company,job.location].filter(Boolean).join(" · "),"radar-small"));
  const badge=make("span","Noch unbewertet","radar-grade");
  head.append(info,badge);article.append(head);
  if(job.id.startsWith("DEMO-"))article.append(make("p",job.description,"radar-small"));
  const details=make("details"),summary=make("summary","Stelle mit eigenen Kriterien beurteilen");
  details.append(summary);
  const grid=make("div",undefined,"radar-grade-grid");
  const existing=state.ratings[job.id]||{scores:{},note:""};
  function refreshBadge(){
   const r=model.ratingAverage(state.ratings[job.id]);
   badge.textContent=r?(r.value.toFixed(1).replace(".",",")+"/5 · "+r.count+" von 4 Kriterien"):"Noch unbewertet";
  }
  function updateRating(key,value){
   const rating=state.ratings[job.id]||{scores:{},note:""};
   if(key==="note")rating.note=value;
   else if(value===null)delete rating.scores[key];
   else rating.scores[key]=value;
   if(!Object.keys(rating.scores).length&&!rating.note.trim())delete state.ratings[job.id];
   else state.ratings[job.id]=rating;
   refreshBadge();changed();
  }
  for(const c of model.criteria){
   const label=make("label",c.label);
   const select=make("select");select.setAttribute("aria-label",c.label+" für "+job.title);
   for(const [value,text] of [["","Noch nicht bewertet"],["1","1 · passt gar nicht"],["2","2 · eher nicht"],["3","3 · teils / teils"],["4","4 · eher gut"],["5","5 · passt sehr gut"]]){
    const opt=make("option",text);opt.value=value;select.append(opt);
   }
   select.value=String(existing.scores?.[c.id]??"");
   select.addEventListener("change",()=>updateRating(c.id,select.value?Number(select.value):null));
   label.title=c.hint;label.append(select);grid.append(label);
  }
  details.append(grid);
  const noteLabel=make("label","Was fällt dir an dieser Stelle auf? (optional)");
  noteLabel.className="radar-label";noteLabel.style.marginTop="13px";
  const note=make("textarea");note.rows=2;note.maxLength=400;note.value=existing.note||"";
  note.placeholder="Zum Beispiel: Das würde ich gern in einer Schnupperlehre testen …";
  note.addEventListener("input",()=>updateRating("note",note.value));
  details.append(noteLabel,note);article.append(details);
  refreshBadge();return article;
 }
 function renderReviews(){
  const target=get("radarReviewList");target.replaceChildren();
  const all=jobs.filter(model.isApprenticeship);
  const live=all.filter(j=>model.matchesPreferences(j,state.profile,state.selectedSources)).slice(0,50);
  const sample=showDemo?sampleJobs:[];
  get("radarReviewCount").textContent=live.length+" reale Kandidaten"+(showDemo?" · 3 Beispiele":"");
  if(!live.length&&!sample.length){
   const empty=make("div",undefined,"radar-empty");
   empty.append(make("strong",feedLoaded?
    (all.length?"Keine Lehrstellen entsprechen den gewählten Filtern.":"Noch keine Lehrstellen im aktuellen Import."):
    "Für die Liste zuerst den öffentlichen Import laden."));
   empty.append(make("p","Wunschquellen steuern im Prototyp nur die vorhandene Ergebnis-Vorschau; neue Quellen werden noch nicht automatisch abgefragt. Probiere die drei klar gekennzeichneten Beispieldaten aus."));
   target.append(empty);
  }else{
   for(const job of [...live,...sample])target.append(jobLine(job));
   if(all.length>50)target.append(make("p","Maximal 50 reale Kandidaten in dieser Prototyp-Ansicht.","radar-small"));
  }
  get("radarToggleDemo").textContent=showDemo?"Beispiele ausblenden":"3 fiktive Beispiele anzeigen";
 }
 function switchTab(id){
  for(const tab of root.querySelectorAll(".radar-tab")){
   const chosen=tab.dataset.tab===id;
   tab.setAttribute("aria-selected",String(chosen));tab.tabIndex=chosen?0:-1;
  }
  for(const panel of root.querySelectorAll(".radar-panel"))panel.hidden=panel.dataset.panel!==id;
 }
 function exportProfile(){
  const data={type:"career-agency-lehrstellen-profil",schema_version:"0.1.0",
   exported_at:new Date().toISOString(),profile:model.normalizedProfile(state.profile),preferred_sources:[...state.selectedSources],
   notice:"Selbstauskünfte, nicht verifiziert. Vor Verwendung in Bewerbungsunterlagen prüfen."};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const a=make("a");a.href=url;a.download="career-agency-lehrstellen-profil.json";
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  message("Profildatei exportiert. Sie enthält deine Angaben – nur auf einem privaten Gerät verwenden.");
 }
 async function forget(){
  Object.assign(state,model.normalizedState(null));
  persistent=false;showDemo=false;
  get("radarSaveOptIn").checked=false;
  for(const key of ["occupations","region","level","startYear","example"])get("radar-"+key).value=state.profile[key];
  get("radarStrictOccupation").checked=false;get("radarStrictRegion").checked=false;
  await pending.catch(()=>{});
  try{await window.AgentStore.clearRadar();message("Radar-Profil und Bewertungen auf diesem Gerät gelöscht.");}
  catch(e){message("Lokales Löschen fehlgeschlagen: "+e.message);}
  renderSources();renderSkills();renderReviews();
 }
 async function initialize(){
  try{
   const loaded=await window.AgentStore.loadRadar();
   if(loaded){
    Object.assign(state,model.normalizedState(loaded));
    persistent=true;get("radarSaveOptIn").checked=true;
    message("Lokaler Radar-Stand dieses Browsers geladen.");
   }
  }catch{message("Browser-Speicher nicht verfügbar · Daten bleiben nur in diesem Tab.");}
  renderSources();renderSkills();
  for(const key of ["occupations","region","level","startYear","example"])get("radar-"+key).value=state.profile[key];
  get("radarStrictOccupation").checked=state.profile.strictOccupation;
  get("radarStrictRegion").checked=state.profile.strictRegion;
  updateStats(jobs);renderReviews();
  if(window.location.hash==="#radar")loadFeed();
 }
 for(const tab of root.querySelectorAll(".radar-tab")){
  tab.addEventListener("click",()=>switchTab(tab.dataset.tab));
  tab.addEventListener("keydown",event=>{
   if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
   const tabs=[...root.querySelectorAll(".radar-tab")],i=tabs.indexOf(tab);
   const next=tabs[(i+(event.key==="ArrowLeft"?-1:1)+tabs.length)%tabs.length];
   event.preventDefault();switchTab(next.dataset.tab);next.focus();
  });
 }
 get("radarCustomSkill").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addSkill();}});
 get("radarAddSkill").addEventListener("click",addSkill);
 get("radarRefresh").addEventListener("click",()=>loadFeed(true));
 get("radarToggleDemo").addEventListener("click",()=>{showDemo=!showDemo;renderReviews();});
 get("radarExport").addEventListener("click",exportProfile);
 get("radarForget").addEventListener("click",forget);
 get("radarSaveOptIn").addEventListener("change",async e=>{
  persistent=e.target.checked;
  if(persistent){message("Speicherung auf diesem Gerät eingeschaltet.");persist();}
  else{
   await pending.catch(()=>{});
   try{await window.AgentStore.clearRadar();message("Dauerhafte Radar-Speicherung ausgeschaltet und gespeicherter Stand gelöscht.");}
   catch(err){message("Konnte gespeicherte Daten nicht entfernen: "+err.message);}
  }
 });
 renderProfileFields();
 window.addEventListener("hashchange",()=>{if(window.location.hash==="#radar")loadFeed();});
 initialize();
})();
