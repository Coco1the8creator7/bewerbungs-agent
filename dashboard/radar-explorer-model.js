/* Career.Agency Interests Explorer — original content and heuristic, not a copy of SDBB assets.
 * Scores indicate overlap with self-declared interests, NEVER aptitude or suitability.
 */
(function(root){
 "use strict";
 const youth=Object.freeze([
  ["outside","Draussen arbeiten",["outdoor","nature"]],
  ["independent","Selbstständig arbeiten",["independent","planning"]],
  ["plan","Konstruieren und technisch zeichnen",["planning","design","construction"]],
  ["hours","Regelmässige Arbeitszeiten haben",["planning","independent"]],
  ["active","Körperlich aktiv sein",["outdoor","craft"]],
  ["drive","Fahrzeuge führen",["machines","logistics"]],
  ["inform","Menschen informieren und sensibilisieren",["communication","social"]],
  ["metal","Metall bearbeiten",["craft","machines","precision"]],
  ["machines","Mit Maschinen arbeiten",["machines","technology"]],
  ["travel","Viel unterwegs sein",["outdoor","logistics"]],
  ["textiles","Mit Stoff, Leder oder Papier arbeiten",["craft","design","creative"]],
  ["care","Menschen unterstützen und pflegen",["social","health"]],
  ["hands","Mit den Händen arbeiten",["craft","precision"]],
  ["code","Am Computer arbeiten",["digital","technology"]],
  ["research","Experimentieren und forschen",["science","technology"]],
  ["animals","Mit Tieren arbeiten",["animals","nature"]],
  ["precision","Präzise und sorgfältig arbeiten",["precision","craft"]],
  ["indoor","In Innenräumen arbeiten",["independent","planning"]],
  ["write","Texte verfassen",["language","communication"]],
  ["music","Musik machen, singen oder tanzen",["creative","team"]],
  ["teaching","Wissen vermitteln",["communication","social"]],
  ["technical","Technische Probleme lösen",["technology","analysis","machines"]],
  ["food","Mit Lebensmitteln arbeiten",["food","craft"]],
  ["stone","Stein, Ton und Glas bearbeiten",["craft","construction","precision"]],
  ["advise","Andere Menschen beraten",["communication","social","commerce"]],
  ["numbers","Mit Zahlen arbeiten",["numbers","planning"]],
  ["electric","Mit Elektrizität und Elektronik arbeiten",["electric","technology"]],
  ["lead","Verantwortung übernehmen und führen",["planning","team","social"]],
  ["wood","Holz bearbeiten",["wood","craft"]],
  ["team","Im Team arbeiten",["team","social"]],
  ["languages","Sprachen anwenden",["language","communication"]],
  ["plants","Mit Pflanzen arbeiten",["nature","outdoor"]],
  ["children","Mit Kindern arbeiten",["children","social"]],
  ["organise","Aufgaben planen und organisieren",["planning","commerce"]],
  ["reading","Lesen und Informationen erschliessen",["language","science"]],
  ["creative","Zeichnen, dekorieren und gestalten",["creative","design"]],
  ["contact","Kontakt zu Menschen haben",["social","communication"]]
 ].map(([id,title,tags])=>Object.freeze({id,title,tags:Object.freeze(tags)})));
 const youthLegacy=Object.freeze({
  make:"hands",draw:"creative",repair:"technical",sport:"active",
  move:"travel",sell:"contact",talk:"inform",buildings:"plan",
  health:"care"
 });
 const career=Object.freeze([
  ["manage","🗂️","Projekte koordinieren und verantworten",["planning","leadership"]],
  ["analyze","📊","Kennzahlen interpretieren und Entscheidungen vorbereiten",["numbers","analysis"]],
  ["energy","🌿","Die Energiewende praktisch voranbringen",["energy","outdoor"]],
  ["buildings","🏗️","Technische Bauprojekte umsetzen",["construction","planning"]],
  ["design","📐","Technische Systeme planen und dimensionieren",["technology","analysis"]],
  ["advise","💬","Kundschaft fachlich beraten",["communication","consulting"]],
  ["sell","🤝","Kundenbeziehungen und Lösungen entwickeln",["commerce","consulting"]],
  ["people","👥","Teams oder Fachleute koordinieren",["leadership","social"]],
  ["software","💻","Mit digitalen Werkzeugen Abläufe verbessern",["digital","analysis"]],
  ["outdoors","🥾","Regelmässig vor Ort arbeiten",["outdoor","construction"]],
  ["details","🎯","Ausschreibungen und Qualität genau prüfen",["precision","planning"]],
  ["creative","💡","Neue Konzepte erarbeiten",["creative","energy"]],
  ["hands","🛠️","Mit Technik auch praktisch arbeiten",["craft","technology"]],
  ["teaching","🎤","Komplexe Themen verständlich präsentieren",["communication","social"]],
  ["independent","🧭","Mit viel Eigenverantwortung arbeiten",["independent","leadership"]],
  ["data","📈","Prozesse und Daten auswerten",["analysis","digital"]]
 ].map(([id,emoji,title,tags])=>Object.freeze({id,emoji,title,tags:Object.freeze(tags)})));
 const youthFields=Object.freeze([
  ["Schreiner/in EFZ","🪵",["craft","wood","precision","design"]],
  ["Elektroinstallateur/in EFZ","🔌",["electric","technology","craft","construction"]],
  ["Informatiker/in EFZ","💻",["digital","technology","precision","analysis"]],
  ["Zeichner/in EFZ","📐",["design","planning","construction","precision"]],
  ["Fachperson Betreuung EFZ","🤲",["social","children","communication","team"]],
  ["Fachperson Gesundheit EFZ","🩺",["health","social","science","team"]],
  ["Kaufmann/-frau EFZ","📋",["commerce","language","communication","planning"]],
  ["Detailhandelsfachmann/-frau EFZ","🛍️",["commerce","communication","social","numbers"]],
  ["Koch/Köchin EFZ","🥗",["food","craft","precision","team"]],
  ["Gärtner/in EFZ","🌱",["nature","outdoor","craft","design"]],
  ["Tierpfleger/in EFZ","🐾",["animals","nature","precision","health"]],
  ["Polymechaniker/in EFZ","⚙️",["machines","technology","precision","craft"]],
  ["Logistiker/in EFZ","📦",["logistics","planning","machines","team"]],
  ["Mediamatiker/in EFZ","🎨",["digital","creative","design","communication"]],
  ["Laborant/in EFZ","🧪",["science","precision","technology","health"]],
  ["Zimmermann/Zimmerin EFZ","🏠",["wood","construction","outdoor","craft"]],
  ["Automobil-Mechatroniker/in EFZ","🚗",["machines","technology","craft","precision"]],
  ["Fachmann/-frau Hotellerie-Hauswirtschaft EFZ","🏨",["social","planning","food","team"]]
 ].map(([title,emoji,tags])=>Object.freeze({id:title, title,emoji,tags:Object.freeze(tags)})));
 const adultFields=Object.freeze([
  ["Projektleitung thermische Netze","🌡️",["energy","planning","leadership","construction"]],
  ["Fachplanung Gebäudetechnik","📐",["technology","analysis","construction","planning"]],
  ["Energieberatung","🌿",["energy","consulting","communication","analysis"]],
  ["Projektentwicklung Erneuerbare Energien","☀️",["energy","creative","planning","leadership"]],
  ["Technischer Vertrieb Energielösungen","🤝",["commerce","consulting","communication","energy"]],
  ["Bauherrenberatung / Bauprojektmanagement","🏗️",["construction","leadership","consulting","planning"]],
  ["Fachbereichsleitung Energie","🗂️",["leadership","energy","planning","social"]],
  ["Prozessdigitalisierung Energie","💻",["digital","analysis","technology","creative"]]
 ].map(([title,emoji,tags])=>Object.freeze({id:title,title,emoji,tags:Object.freeze(tags)})));
 function items(market){return market==="career"?career:youth;}
 function fields(market){return market==="career"?adultFields:youthFields;}
 const allowed=Object.freeze(["like","no"]);
 function normalizeExplorer(raw,market){
  const value=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const ids=new Set(items(market).map(t=>t.id)),choices={};
  if(value.choices&&typeof value.choices==="object"&&!Array.isArray(value.choices)){
   const entries=Object.entries(value.choices);
   // Migrate former 32-card prototyping questions to the new 37-interest taxonomy.
   // An explicit new answer always wins over a legacy alias.
   if(market!=="career")for(const [id,v] of entries){
    const mapped=youthLegacy[id];
    if(mapped&&allowed.includes(v)&&!Object.hasOwn(value.choices,mapped))choices[mapped]=v;
   }
   for(const [id,v] of entries)if(ids.has(id)&&allowed.includes(v))choices[id]=v;
  }
  const favorites=[...new Set((Array.isArray(value.favorites)?value.favorites:[])
   .filter(v=>typeof v==="string"&&fields(market).some(x=>x.id===v)))].slice(0,25);
  return {choices,favorites};
 }
 function progress(raw,market){
  const {choices}=normalizeExplorer(raw,market);
  const value=Object.values(choices);
  return {total:items(market).length,answered:value.length,liked:value.filter(v=>v==="like").length,
   rejected:value.filter(v=>v==="no").length};
 }
 function matches(raw,market){
  const {choices}=normalizeExplorer(raw,market);
  const liked=items(market).filter(t=>choices[t.id]==="like");
  if(liked.length<3)return [];
  const disliked=items(market).filter(t=>choices[t.id]==="no");
  return fields(market).map(field=>{
   const positive=liked.filter(t=>t.tags.some(tag=>field.tags.includes(tag)));
   const negative=disliked.filter(t=>t.tags.some(tag=>field.tags.includes(tag)));
   return {...field,liked:positive.map(t=>t.id),
    score:positive.length, conflicts:negative.length,
    // No percentages or suitability probabilities: transparent suggestion order only.
    order:positive.length*3-negative.length};
  }).filter(r=>r.score>=2&&r.order>0)
   .sort((a,b)=>b.order-a.order||b.score-a.score||a.title.localeCompare(b.title,"de-CH"))
   .slice(0,8);
 }
 const api=Object.freeze({items,fields,normalizeExplorer,progress,matches,youthLegacy});
 root.CareerRadarExplorerModel=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
