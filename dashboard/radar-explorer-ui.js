/* Career.Agency Interests Explorer UI. Desktop drag/drop and equal-accessible touch/keyboard buttons. */
(function(){
 "use strict";
 const data=window.CareerRadarExplorerModel,bridge=window.CareerRadarBridge;
 const root=document.getElementById("radarExplorer");
 if(!data||!bridge||!root)return;
 const el=id=>document.getElementById(id);
 const make=(tag,text,klass)=>{
  const n=document.createElement(tag);
  if(text!==undefined)n.textContent=String(text);
  if(klass)n.className=klass;
  return n;
 };
 const offsets={career:0,apprentice:0};
 const selection=()=>bridge.profile().explorer;
 const market=()=>bridge.market();
 function current(){
  const state=selection();
  const unmarked=data.items(market()).filter(i=>!state.choices[i.id]);
  if(!unmarked.length)return null;
  return unmarked[offsets[market()]%unmarked.length];
 }
 function choice(answer){
  const item=current();
  if(!item)return;
  selection().choices[item.id]=answer;
  // Advance to the next unsorted card, regardless of earlier skips.
  offsets[market()]=Math.min(offsets[market()],Math.max(0,data.progress(selection(),market()).total-
   data.progress(selection(),market()).answered-1));
  bridge.changed();render();
 }
 function next(){
  if(!current())return;
  offsets[market()]++;
  render();
 }
 function listChoices(answer,targetId,countId){
  const picked=data.items(market()).filter(item=>selection().choices[item.id]===answer);
  el(countId).textContent=picked.length+" Tätigkeiten";
  const target=el(targetId);target.replaceChildren();
  if(!picked.length)target.append(make("p","Noch keine Auswahl","radar-explorer-empty"));
  for(const item of picked){
   const b=make("button",item.emoji+" "+item.title+" ×","radar-explorer-pill");
   b.type="button";b.title="Einschätzung zurücknehmen";
   b.setAttribute("aria-label","Auswahl für "+item.title+" zurücknehmen");
   b.addEventListener("click",()=>{
    delete selection().choices[item.id];bridge.changed();render();
   });
   target.append(b);
  }
 }
 function renderCard(){
  const host=el("radarExplorerCard");host.replaceChildren();
  const item=current();
  const actions=["radarExplorerYes","radarExplorerNo","radarExplorerSkip"];
  for(const id of actions)el(id).disabled=!item;
  if(!item){
   const done=make("div",undefined,"radar-explorer-prompt finished");
   done.append(make("span","✓","radar-explorer-emoji"));
   done.append(make("h4","Alles eingeordnet"));
   done.append(make("p","Du kannst jede Antwort rechts und links wieder ändern. Deine Berufsideen stehen darunter."));
   host.append(done);return;
  }
  const prompt=make("article",undefined,"radar-explorer-prompt");
  prompt.draggable=true;
  prompt.dataset.interestId=item.id;
  prompt.setAttribute("aria-label","Interesse: "+item.title+". Gefällt mir, eher nicht oder später wählen.");
  prompt.append(make("span",item.emoji,"radar-explorer-emoji"));
  prompt.append(make("h4",item.title));
  prompt.append(make("p","Wäre das eine Tätigkeit, die du gerne ausprobieren würdest?"));
  prompt.addEventListener("dragstart",e=>{
   e.dataTransfer.effectAllowed="move";
   e.dataTransfer.setData("text/plain",item.id);
   prompt.classList.add("is-dragging");
  });
  prompt.addEventListener("dragend",()=>prompt.classList.remove("is-dragging"));
  host.append(prompt);
 }
 function renderMatches(){
  const host=el("radarExplorerResults");host.replaceChildren();
  const state=selection(),p=data.progress(state,market());
  const results=data.matches(state,market());
  const saved=new Set(state.favorites);
  el("radarExplorerResultCount").textContent=p.liked<3?"Noch "+(3-p.liked)+" positive Antworten":"Auswahl: "+results.length+" Vorschläge";
  if(p.liked<3){
   const hint=make("div",undefined,"radar-explorer-result-placeholder");
   hint.append(make("span","✧"));
   hint.append(make("p","Wähle mindestens drei Tätigkeiten, die du gerne machen würdest."));
   host.append(hint);return;
  }
  if(!results.length){
   host.append(make("p","Noch keine deutliche Übereinstimmung im kleinen Beispielkatalog. Probiere weitere Tätigkeiten aus.","radar-explorer-result-placeholder"));
   return;
  }
  const questionMap=new Map(data.items(market()).map(i=>[i.id,i]));
  for(const suggestion of results){
   const card=make("article",undefined,"radar-explorer-match");
   const heading=make("div",undefined,"radar-explorer-match-head");
   const icon=make("span",suggestion.emoji,"radar-explorer-match-icon");
   const title=make("div");title.append(make("h4",suggestion.title),
    make("span",suggestion.score+" Interessen passen zu diesem Vorschlag","radar-small"));
   heading.append(icon,title);
   const favorite=make("button",saved.has(suggestion.id)?"♥ Gemerkt":"♡ Merken","radar-explorer-save");
   favorite.type="button";favorite.setAttribute("aria-pressed",String(saved.has(suggestion.id)));
   favorite.setAttribute("aria-label",(saved.has(suggestion.id)?"Berufsidee entfernen: ":"Berufsidee merken: ")+suggestion.title);
   favorite.addEventListener("click",()=>{
    const list=selection().favorites,at=list.indexOf(suggestion.id);
    if(at>=0)list.splice(at,1);
    else list.push(suggestion.id);
    bridge.changed();renderMatches();
   });
   card.append(heading,favorite);
   const reasons=make("p","Zum Beispiel: "+suggestion.liked.slice(0,3)
    .map(id=>questionMap.get(id)?.title).filter(Boolean).join(" · "),"radar-explorer-reasons");
   card.append(reasons);
   if(suggestion.conflicts)card.append(make("p","Es gibt auch "+suggestion.conflicts+" eher uninteressante Überschneidung"+(suggestion.conflicts===1?"":"en")+".","radar-explorer-conflict"));
   host.append(card);
  }
  const favorites=state.favorites.filter(id=>data.fields(market()).some(x=>x.id===id));
  if(favorites.length){
   const foot=make("div",undefined,"radar-explorer-favorites");
   foot.append(make("strong","Gemerkte Ideen"));
   for(const id of favorites)foot.append(make("span",id,"radar-explorer-favorite-tag"));
   host.append(foot);
  }
 }
 function render(){
  const m=market(),count=data.progress(selection(),m);
  el("radarExplorerIntro").textContent=m==="career"?
   "Wähle Arbeitsaufgaben, die dir Freude machen. Die Vorschläge sind von deinen bisherigen Stellenbewertungen unabhängig.":
   "Wähle Tätigkeiten, die du gern einmal ausprobieren würdest – ohne Noten und ohne richtige oder falsche Antworten.";
  el("radarExplorerCount").textContent=count.answered+" von "+count.total+" eingeordnet";
  const progress=el("radarExplorerProgress");
  progress.setAttribute("aria-valuemax",String(count.total));
  progress.setAttribute("aria-valuenow",String(count.answered));
  el("radarExplorerFill").style.width=(100*count.answered/count.total)+"%";
  el("radarExplorerReset").disabled=!count.answered&&!selection().favorites.length;
  listChoices("like","radarExplorerLikes","radarExplorerYesCount");
  listChoices("no","radarExplorerDislikes","radarExplorerNoCount");
  renderCard();renderMatches();
 }
 for(const [id,answer] of [["radarExplorerYes","like"],["radarExplorerNo","no"]])
  el(id).addEventListener("click",()=>choice(answer));
 el("radarExplorerSkip").addEventListener("click",next);
 for(const [id,answer] of [["radarExplorerYesZone","like"],["radarExplorerNoZone","no"]]){
  const zone=el(id);
  zone.addEventListener("dragover",event=>{
   if(!current())return;
   event.preventDefault();event.dataTransfer.dropEffect="move";
   zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave",event=>{
   if(!zone.contains(event.relatedTarget))zone.classList.remove("drag-over");
  });
  zone.addEventListener("drop",event=>{
   event.preventDefault();zone.classList.remove("drag-over");
   if(event.dataTransfer.getData("text/plain")===current()?.id)choice(answer);
  });
 }
 el("radarExplorerReset").addEventListener("click",()=>{
  if(!window.confirm("Nur die Interessen-Auswahl und gemerkten Berufsideen dieses Bereichs zurücksetzen? Fähigkeiten und übrige Radar-Bewertungen bleiben erhalten."))return;
  selection().choices={};selection().favorites=[];offsets[market()]=0;
  bridge.changed();render();
 });
 window.CareerRadarExplorer=Object.freeze({render});
 render();
})();
