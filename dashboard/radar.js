/* Career.Agency / Radar 0.2. Legacy job alerts remain the live adult feed.
 * Separate future apprenticeship mode; local opt-in storage only.
 */
(function(){
 "use strict";
 const model=window.CareerRadarModel,root=document.getElementById("mode-radar");
 if(!model||!root)return;
 const get=id=>document.getElementById(id);
 const make=(tag,label,klass)=>{
  const e=document.createElement(tag);
  if(klass)e.className=klass;
  if(label!==undefined)e.textContent=String(label);
  return e;
 };
 const state=model.normalizedState(null);
 let jobs=[],feedLoaded=false,feedBusy=false,showDemo=false,persistent=false,pending=Promise.resolve();
 const market=()=>state.market;
 const bucket=()=>market()==="career"?state.career:state;
 const profile=()=>bucket().profile;
 const groups=()=>market()==="career"?model.careerSkillGroups:model.skillGroups;
 const criteria=()=>market()==="career"?model.careerCriteria:model.criteria;
 const sampleJobs=[
  {id:"DEMO-RADAR-1",title:"Lehrstelle Zeichner/in EFZ, Fachrichtung Architektur",company:"Fiktives Atelier",location:"Zürich",source:"Demo",description:"Fiktives Beispiel: Pläne zeichnen und in einem Team arbeiten."},
  {id:"DEMO-RADAR-2",title:"Lehrstelle Fachperson Betreuung EFZ",company:"Fiktive Kita",location:"Winterthur",source:"Demo",description:"Fiktives Beispiel: Kinder begleiten und Verantwortung übernehmen."},
  {id:"DEMO-RADAR-3",title:"Lehrstelle Informatiker/in EFZ",company:"Fiktiver IT-Betrieb",location:"Baden",source:"Demo",description:"Fiktives Beispiel: Programme kennenlernen und Probleme lösen."}
 ];
 function message(t){get("radarStatus").textContent=t;}
 function persist(){
  if(!persistent)return;
  const copy=model.normalizedState(state);
  pending=pending.catch(()=>{}).then(()=>window.AgentStore.saveRadar(copy));
  pending.catch(e=>message("Speichern fehlgeschlagen: "+e.message));
 }
 function changed(){
  message(persistent?"Auf diesem Gerät gespeichert (keine Cloud-Synchronisation).":"Nur in diesem Tab · nicht dauerhaft gespeichert.");
  persist();
 }
 function sources(){
  if(market()==="apprentice")return model.sources;
  const totals=new Map();
  for(const j of jobs){
   if(model.isApprenticeship(j))continue;
   if(typeof j.source==="string"&&j.source.trim())totals.set(j.source,(totals.get(j.source)||0)+1);
  }
  return [...totals.entries()].sort((a,b)=>a[0].localeCompare(b[0],"de-CH"))
   .map(([id,n])=>({id,label:id,hint:n+" Inserate aus bestehenden Stellenabos"}));
 }
 function renderSources(){
  const host=get("radarSources");host.replaceChildren();
  for(const src of sources()){
   const label=make("label",undefined,"radar-source");
   const cb=make("input");cb.type="checkbox";cb.value=src.id;
   cb.checked=bucket().selectedSources.includes(src.id);
   const details=make("span");
   details.append(make("b",src.label),make("small",src.hint));
   cb.addEventListener("change",()=>{
    if(cb.checked&&!bucket().selectedSources.includes(src.id))bucket().selectedSources.push(src.id);
    if(!cb.checked)bucket().selectedSources=bucket().selectedSources.filter(id=>id!==src.id);
    updateSourcesCount();renderReviews();changed();
   });
   label.append(cb,details);host.append(label);
  }
  updateSourcesCount();
 }
 function updateSourcesCount(){
  const n=bucket().selectedSources.length;
  get("radarSourceCount").textContent=n? n+" Quelle"+(n===1?"":"n")+" gewählt":"Alle verfügbaren Quellen · keine Einschränkung";
 }
 function chip(group,skill,custom=false){
  const target=custom?profile().extraSkills:profile().skills[group];
  const active=target.includes(skill);
  const btn=make("button",skill+(custom?" ×":""),"radar-chip");btn.type="button";
  btn.setAttribute("aria-pressed",String(active));
  btn.setAttribute("aria-label",(active?"Entfernen: ":"Auswählen: ")+skill);
  btn.addEventListener("click",()=>{
   const index=target.indexOf(skill);
   if(index>=0)target.splice(index,1);
   else if(!custom)target.push(skill);
   renderSkills();changed();
  });
  return btn;
 }
 function renderSkills(){
  for(const [group,items] of Object.entries(groups())){
   const slot=market()==="career"&&group==="fachwissen"?"schule":
    market()==="career"&&group==="berufserfahrung"?"erfahrungen":group;
   const host=get("radarSkills-"+slot);host.replaceChildren();
   for(const item of items)host.append(chip(group,item));
  }
  const extra=get("radarExtraSkills");extra.replaceChildren();
  for(const item of profile().extraSkills)extra.append(chip(null,item,true));
  const n=Object.values(profile().skills).reduce((sum,a)=>sum+a.length,0)+profile().extraSkills.length;
  get("radarSkillCount").textContent=n+" ausgewählt";
 }
 function updateForm(){
  for(const key of ["occupations","region","level","startYear","example"])get("radar-"+key).value=profile()[key];
  get("radarStrictOccupation").checked=profile().strictOccupation;
  get("radarStrictRegion").checked=profile().strictRegion;
 }
 function setupForm(){
  for(const key of ["occupations","region","level","startYear","example"]){
   get("radar-"+key).addEventListener("input",e=>{
    profile()[key]=e.target.value;
    if(["occupations","region","level"].includes(key))renderReviews();
    changed();
   });
  }
  for(const [id,key] of [["radarStrictOccupation","strictOccupation"],["radarStrictRegion","strictRegion"]]){
   get(id).addEventListener("change",e=>{profile()[key]=e.target.checked;renderReviews();changed();});
  }
 }
 function addSkill(){
  const input=get("radarCustomSkill"),skill=input.value.trim().replace(/\s+/g," ");
  if(!skill)return;
  if(skill.length>48){message("Eigener Skill: höchstens 48 Zeichen.");return;}
  if(profile().extraSkills.length>=12){message("Maximal 12 eigene Skills.");return;}
  if(!profile().extraSkills.some(s=>s.toLocaleLowerCase("de-CH")===skill.toLocaleLowerCase("de-CH")))
   profile().extraSkills.push(skill);
  input.value="";renderSkills();changed();
 }
 function updateStats(){
  const summary=model.summarize(jobs,new Date(),market());
  const visibleAdult=jobs.filter(j=>!model.isApprenticeship(j)&&(!window.AgentCareerFilter||window.AgentCareerFilter.isVisible(j)));
  const count=market()==="career"?visibleAdult.length:summary.apprenticeships;
  for(const [id,value] of [["radarTotal",summary.total],["radarSinceYesterday",summary.sinceYesterday],
    ["radarWeek",summary.thisWeek],["radarApprenticeships",count]])
   get(id).textContent=value.toLocaleString("de-CH");
  const explanation=market()==="career"?
   "Deine bestehenden Gmail-/URL-Stellenabos liefern weiterhin die Inserate. "+visibleAdult.length+" davon sind mit den bisherigen Anzeige-Regeln sichtbar.":
   (summary.apprenticeships?"Einige Titel sehen nach Lehrstellen aus. Bitte Einträge prüfen.":"Die bisherigen Stellenabos liefern noch keine eindeutig erkannten Lehrstellen.");
  get("radarFeedStatus").textContent=explanation+
   (summary.missingDates?" "+summary.missingDates+" Inserate ohne Erstimportdatum zählen nicht als neu.":"");
  get("radarLiveLabel").textContent=feedLoaded?"IMPORT GELESEN · "+jobs.length+" EINTRÄGE":"IMPORT NOCH NICHT GELADEN";
 }
 async function loadFeed(force=false){
  if(feedBusy||(feedLoaded&&!force))return;
  feedBusy=true;get("radarRefresh").disabled=true;
  get("radarFeedStatus").textContent="Bestehenden Inserate-Import lesen …";
  try{
   const response=await fetch("./jobs.json",{cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const rows=await response.json();
   if(!Array.isArray(rows))throw Error("Ungültiges Stellenformat");
   jobs=rows.filter(j=>j&&typeof j.id==="string"&&typeof j.title==="string");
   feedLoaded=true;updateStats();renderSources();
  }catch(err){
   get("radarFeedStatus").textContent="Bestehender Feed vorübergehend nicht verfügbar: "+err.message;
  }finally{feedBusy=false;get("radarRefresh").disabled=false;renderReviews();}
 }
 function jobCard(job){
  const article=make("article",undefined,"radar-job");
  const heading=make("header"),info=make("div"),title=make("h3");
  info.append(make("div",job.id.startsWith("DEMO-")?"FIKTIVES BEISPIEL · keine echte Stelle":(job.source||"Quelle unbekannt"),"radar-kicker"));
  if(!job.id.startsWith("DEMO-")&&typeof job.url==="string"){
   let url=null;
   try{const u=new URL(job.url);if(["http:","https:"].includes(u.protocol))url=u.href;}catch{}
   if(url){
    const link=make("a",job.title);link.href=url;link.target="_blank";link.rel="noopener noreferrer";title.append(link);
   }else title.textContent=job.title;
  }else title.textContent=job.title;
  info.append(title,make("p",[job.company,job.location].filter(Boolean).join(" · "),"radar-small"));
  const badge=make("span","Noch unbewertet","radar-grade");
  heading.append(info,badge);article.append(heading);
  if(job.id.startsWith("DEMO-"))article.append(make("p",job.description,"radar-small"));
  const details=make("details");details.append(make("summary","Mit meinen Kriterien bewerten"));
  const grid=make("div",undefined,"radar-grade-grid");
  const existing=bucket().ratings[job.id]||{scores:{},note:""};
  function refreshBadge(){
   const rating=model.ratingAverage(bucket().ratings[job.id],market());
   badge.textContent=rating?rating.value.toFixed(1).replace(".",",")+"/5 · "+rating.count+" von "+criteria().length+" Kriterien":"Noch unbewertet";
  }
  function updateRating(key,value){
   const ratings=bucket().ratings,rating=ratings[job.id]||{scores:{},note:""};
   if(key==="note")rating.note=value;
   else if(value===null)delete rating.scores[key];
   else rating.scores[key]=value;
   if(!Object.keys(rating.scores).length&&!rating.note.trim())delete ratings[job.id];
   else ratings[job.id]=rating;
   refreshBadge();changed();
  }
  for(const c of criteria()){
   const label=make("label",c.label);
   const select=make("select");select.setAttribute("aria-label",c.label+" für "+job.title);
   for(const [value,name] of [["","Noch nicht bewertet"],["1","1 · passt gar nicht"],["2","2 · eher nicht"],
     ["3","3 · teils / teils"],["4","4 · eher gut"],["5","5 · passt sehr gut"]]){
    const option=make("option",name);option.value=value;select.append(option);
   }
   select.value=String(existing.scores?.[c.id]??"");
   select.addEventListener("change",()=>updateRating(c.id,select.value?Number(select.value):null));
   label.title=c.hint;label.append(select);grid.append(label);
  }
  details.append(grid);
  const noteLabel=make("label","Meine Ergänzung (optional)","radar-label");
  noteLabel.style.marginTop="13px";
  const note=make("textarea");note.maxLength=400;note.rows=2;note.value=existing.note||"";
  note.placeholder=market()==="career"?"Warum ist diese Stelle interessant oder weniger geeignet?":
   "Was möchte ich bei einer Schnupperlehre prüfen?";
  note.addEventListener("input",()=>updateRating("note",note.value));
  details.append(noteLabel,note);article.append(details);refreshBadge();return article;
 }
 function renderReviews(){
  const host=get("radarReviewList");host.replaceChildren();
  const adult=market()==="career";
  const available=jobs.filter(j=>adult?
    (!model.isApprenticeship(j)&&(!window.AgentCareerFilter||window.AgentCareerFilter.isVisible(j))):model.isApprenticeship(j));
  const matching=available.filter(j=>model.matchesPreferences(j,profile(),bucket().selectedSources,market()))
   .sort((a,b)=>(Date.parse(b.first_seen_at)||0)-(Date.parse(a.first_seen_at)||0));
  const selected=matching.slice(0,50),examples=!adult&&showDemo?sampleJobs:[];
  get("radarReviewCount").textContent=matching.length+" echte Stellen"+(examples.length?" · 3 Beispiele":"");
  if(!selected.length&&!examples.length){
   const empty=make("div",undefined,"radar-empty");
   empty.append(make("strong",!feedLoaded?"Stellenimport wird geladen …":available.length?
    "Keine Stellen passen zu den gewählten Filtern.":"Keine "+(adult?"Berufsstellen":"Lehrstellen")+" im bisherigen Import."));
   empty.append(make("p",adult?
    "Die bisherigen Stellenabos bleiben aktiv. Passe hier nur Quellen oder optionale Radar-Filter an.":
    "Die Jugend-Lehrstellenquellen werden erst später angebunden. Drei fiktive Beispiele stehen zum Testen bereit."));
   host.append(empty);
  }else{
   for(const job of [...selected,...examples])host.append(jobCard(job));
   if(matching.length>50)host.append(make("p","Die ersten 50 Treffer nach Importdatum. Engere Filter helfen bei der Auswahl.","radar-small"));
  }
  get("radarToggleDemo").hidden=adult;
  get("radarToggleDemo").textContent=showDemo?"Beispiele ausblenden":"3 fiktive Beispiele anzeigen";
 }
 function renderMarket(){
  const adult=market()==="career";
  for(const b of root.querySelectorAll(".radar-market"))b.setAttribute("aria-pressed",String(b.dataset.market===market()));
  get("radarAudienceBadge").textContent=adult?"PRIVATER TEST · 0.2":"LEHRSTELLEN-VORSCHAU · 0.2";
  get("radarSegmentLabel").textContent=adult?"Davon im CRM sichtbar":"Mögliche Lehrstellen";
  get("radarSegmentHint").textContent=adult?"Bestehende CRM-Anzeigeregeln · kein Importfilter":
   "Im Titel als Lehrstelle erkannt, noch nicht geprüft";
  get("radarSkillsTitle").textContent=adult?"Deine Kompetenzen":"Was kannst du schon?";
  get("radarSkillIntro").textContent=adult?"Fachwissen, Erfahrung und Interessen helfen, Stellen besser einzuordnen.":
   "Auch Schule, Freizeit und Schnupperlehren zählen. Wähle nur aus, was auf dich zutrifft.";
  get("radarWishesTitle").textContent=adult?"Welche Stelle suchst du?":"Wie stellst du dir deine Lehre vor?";
  get("radarWishesIntro").textContent=adult?"Deine Wünsche filtern nur die Radar-Vorschau, nicht deine bestehenden Abos.":
   "Deine Wünsche helfen künftig bei der Lehrstellensuche und bei den Unterlagen.";
  get("radarReviewTitle").textContent=adult?"Berufsstellen beurteilen":"Lehrstellen beurteilen";
  get("radarReviewIntro").textContent=adult?"Fünf Kriterien von 1 bis 5, freiwillig und unabhängig vom bisherigen CRM. Leere Kriterien zählen nicht.":
   "Vier Kriterien von 1 bis 5, freiwillig. Leere Kriterien zählen nicht.";
  get("radarFilterHelp").textContent=adult?"Die Quellen- und Suchfilter wirken nur im Radar. Startseite, Abos und Import bleiben unverändert.":
   "Wunschquellen und EFZ-/EBA-Abschluss filtern nur bereits importierte Lehrstellen.";
  get("radarSourcesInfo").textContent=adult?
   "Diese Quellen stammen direkt aus deinem bestehenden Gmail-/URL-Import. Die Quellenwahl wirkt nur auf den Radar-Bewertungs-Hub – nicht auf Importer oder CRM.":
   "Lehrstellenportale sind als Wunschquellen vorbereitet. Noch kein neuer Crawler: Die Auswahl wirkt nur auf bereits importierte Treffer.";
  get("radarLevelGroup").hidden=adult;get("radarYearGroup").hidden=adult;
  const labels=adult?["Fachwissen","Persönliche Stärken","Berufliche Erfahrung","Interessen"]:
   ["Schule & Lernen","Persönliche Stärken","Erste Erfahrungen","Interessen"];
  for(const [i,k] of ["schule","staerken","erfahrungen","interessen"].entries())get("radarGroup-"+k).textContent=labels[i];
  get("radar-occupations").placeholder=adult?"z. B. Projektleiter, Fernwärme, Energieberatung":"z. B. Mediamatiker/in, Schreiner/in";
  get("radar-example").placeholder=adult?"Ein Projekt, das deine fachlichen Kompetenzen zeigt.":
   "Ein Schulprojekt, ein Hobby oder eine Schnupperlehre.";
  get("radarReviewNotice").textContent=adult?
   "Radar-Testbewertungen bleiben von den bisherigen CRM-Bewertungen getrennt. Kein GitHub-Upload und kein KI-Training. Die Stellenabos laufen unverändert weiter.":
   "Lehrstellen-Bewertungen bleiben vom Erwachsenen-CRM getrennt. Für den produktiven Einsatz mit Jugendlichen braucht es zuerst geschützte Benutzerkonten.";
  updateForm();renderSkills();renderSources();updateStats();renderReviews();
 }
 function switchTab(id){
  for(const tab of root.querySelectorAll(".radar-tab")){
   const active=tab.dataset.tab===id;
   tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;
  }
  for(const section of root.querySelectorAll(".radar-panel"))section.hidden=section.dataset.panel!==id;
 }
 function exportProfile(){
  const body={type:"career-agency-radar-profile",schema_version:"0.2.0",market:market(),
   exported_at:new Date().toISOString(),profile:model.normalizedProfile(profile(),market()),
   preferred_sources:[...bucket().selectedSources],
   notice:"Freiwillige Selbstauskunft, nicht verifiziert. Vor Verwendung für Bewerbungen prüfen."};
  const url=URL.createObjectURL(new Blob([JSON.stringify(body,null,2)],{type:"application/json"}));
  const a=make("a");a.href=url;a.download="career-agency-"+market()+"-profil.json";
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  message("Profil dieser Stellenart exportiert. Datei privat aufbewahren.");
 }
 async function forget(){
  if(!window.confirm("Alle Radar-Skills, Suchwünsche und Testbewertungen beider Ansichten von diesem Gerät löschen?"))return;
  Object.assign(state,model.normalizedState(null));persistent=false;showDemo=false;
  get("radarSaveOptIn").checked=false;
  await pending.catch(()=>{});
  try{await window.AgentStore.clearRadar();message("Radar-Profil und Bewertungen auf diesem Gerät gelöscht.");}
  catch(err){message("Löschen fehlgeschlagen: "+err.message);}
  renderMarket();
 }
 async function initialize(){
  try{
   const saved=await window.AgentStore.loadRadar();
   if(saved){
    Object.assign(state,model.normalizedState(saved));
    persistent=true;get("radarSaveOptIn").checked=true;
    message("Dein lokaler Radar-Stand wurde wiederhergestellt.");
   }
  }catch(err){message("Lokaler Speicher nicht verfügbar · nur aktuelle Sitzung.");}
  renderMarket();
  if(window.location.hash==="#radar")loadFeed();
 }
 for(const tab of root.querySelectorAll(".radar-tab")){
  tab.addEventListener("click",()=>switchTab(tab.dataset.tab));
  tab.addEventListener("keydown",event=>{
   if(!["ArrowLeft","ArrowRight"].includes(event.key))return;
   const arr=[...root.querySelectorAll(".radar-tab")],i=arr.indexOf(tab);
   const next=arr[(i+(event.key==="ArrowLeft"?-1:1)+arr.length)%arr.length];
   event.preventDefault();switchTab(next.dataset.tab);next.focus();
  });
 }
 for(const b of root.querySelectorAll(".radar-market")){
  b.addEventListener("click",()=>{
   if(b.dataset.market===market())return;
   state.market=b.dataset.market;showDemo=false;renderMarket();changed();
  });
 }
 setupForm();
 get("radarCustomSkill").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addSkill();}});
 get("radarAddSkill").addEventListener("click",addSkill);
 get("radarRefresh").addEventListener("click",()=>loadFeed(true));
 get("radarToggleDemo").addEventListener("click",()=>{showDemo=!showDemo;renderReviews();});
 get("radarExport").addEventListener("click",exportProfile);
 get("radarForget").addEventListener("click",forget);
 get("radarSaveOptIn").addEventListener("change",async e=>{
  persistent=e.target.checked;
  if(persistent){message("Lokale Speicherung aktiviert.");persist();}
  else{
   await pending.catch(()=>{});
   try{await window.AgentStore.clearRadar();message("Gespeicherte Radar-Daten entfernt · nur aktuelle Sitzung.");}
   catch(err){message("Lokale Daten konnten nicht gelöscht werden: "+err.message);}
  }
 });
 window.addEventListener("hashchange",()=>{if(window.location.hash==="#radar")loadFeed();});
 initialize();
})();
