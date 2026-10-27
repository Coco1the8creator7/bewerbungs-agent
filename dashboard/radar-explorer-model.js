/* Career.Agency Interests Explorer — original content and heuristic, not a copy of SDBB assets.
 * Scores indicate overlap with self-declared interests, NEVER aptitude or suitability.
 */
(function(root){
 "use strict";
 const youth=Object.freeze([
  ["make","🛠️","Etwas Eigenes herstellen",["craft","design"]],
  ["outside","🌳","Draussen anpacken",["outdoor","nature"]],
  ["machines","⚙️","Mit Maschinen etwas bewegen",["machines","technology"]],
  ["draw","✏️","Ideen zeichnen und gestalten",["design","creative"]],
  ["code","💻","Digitale Lösungen ausprobieren",["digital","technology"]],
  ["repair","🔧","Defekte Dinge wieder zum Laufen bringen",["craft","technology"]],
  ["wood","🪵","Mit Holz etwas bauen",["craft","wood"]],
  ["metal","🔩","Metall bearbeiten",["craft","machines"]],
  ["electric","🔌","Stromkreise und Geräte verstehen",["technology","electric"]],
  ["numbers","🔢","Mit Zahlen Probleme lösen",["numbers","planning"]],
  ["plan","📐","Gegenstände oder Räume planen",["planning","design"]],
  ["creative","🎨","Mit Farben und Formen experimentieren",["creative","design"]],
  ["write","📝","Texte und Geschichten verfassen",["language","communication"]],
  ["talk","🎤","Menschen etwas erklären",["communication","social"]],
  ["advise","💬","Andere bei Entscheidungen unterstützen",["social","communication"]],
  ["care","🤲","Menschen im Alltag helfen",["social","health"]],
  ["children","🧸","Mit jüngeren Kindern Zeit verbringen",["children","social"]],
  ["animals","🐾","Tiere versorgen und beobachten",["animals","nature"]],
  ["plants","🌱","Pflanzen pflegen und wachsen sehen",["nature","outdoor"]],
  ["food","🥘","Mahlzeiten zubereiten",["food","craft"]],
  ["sell","🛍️","Produkte zeigen und Kundschaft beraten",["commerce","communication"]],
  ["organise","📋","Veranstaltungen oder Abläufe organisieren",["planning","commerce"]],
  ["move","📦","Waren einteilen und transportieren",["logistics","machines"]],
  ["travel","🚲","Unterwegs statt am Schreibtisch sein",["outdoor","logistics"]],
  ["research","🧪","Fragen mit Experimenten erforschen",["science","technology"]],
  ["precision","🎯","Bei kleinen Details genau arbeiten",["precision","craft"]],
  ["buildings","🏗️","An Gebäuden und Baustellen mitwirken",["construction","outdoor"]],
  ["health","🩺","Mehr über Körper und Gesundheit wissen",["health","science"]],
  ["team","🤝","Gemeinsam im Team etwas erreichen",["team","social"]],
  ["independent","🧭","Aufgaben selbstständig erledigen",["independent","planning"]],
  ["languages","🌍","Andere Sprachen sprechen und verstehen",["language","communication"]],
  ["sport","🏃","Bei der Arbeit körperlich aktiv sein",["outdoor","craft"]]
 ].map(([id,emoji,title,tags])=>Object.freeze({id,emoji,title,tags:Object.freeze(tags)})));
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
  if(value.choices&&typeof value.choices==="object"&&!Array.isArray(value.choices))
   for(const [id,v] of Object.entries(value.choices))
    if(ids.has(id)&&allowed.includes(v))choices[id]=v;
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
 const api=Object.freeze({items,fields,normalizeExplorer,progress,matches});
 root.CareerRadarExplorerModel=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
