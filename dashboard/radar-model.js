/* Career.Agency Radar v0.1: pure, offline-testable apprentice matching helpers.
 * This module never stores or transmits personal information.
 */
(function(root){
 "use strict";
 const sources=Object.freeze([
  {id:"berufsberatung.ch",label:"berufsberatung.ch",hint:"Offizielles Berufs- und Lehrstellenportal"},
  {id:"yousty.ch",label:"Yousty",hint:"Lehrstellen und Schnupperangebote"},
  {id:"lehrstellen.ch",label:"lehrstellen.ch",hint:"Schweizer Lehrstellenportal"},
  {id:"gateway.one",label:"gateway.one",hint:"Lehrstellen und Berufsorientierung"}
 ]);
 const skillGroups=Object.freeze({
  schule:["Mathematik & Zahlen","Deutsch & Schreiben","Fremdsprachen","Natur & Technik","Gestalten","Digitale Grundlagen"],
  staerken:["Teamarbeit","Zuverlässigkeit","Sorgfalt","Kreativität","Praktisch anpacken","Mit Menschen umgehen"],
  erfahrungen:["Schnupperlehre","Schulprojekt","Verein","Nebenjob","Eigenes Projekt","Zu Hause mithelfen"],
  interessen:["Technik","Handwerk","Natur & Tiere","Gesundheit & Soziales","Medien & Gestaltung","Kaufmännisches","Gastronomie","Informatik","Bauen","Logistik"]
 });
 const careerSkillGroups=Object.freeze({
  schule:["Projektplanung","Energietechnik","Bau & Infrastruktur","Kundenberatung","Digitalisierung","Analytisches Arbeiten"],
  staerken:["Projektkoordination","Selbstständigkeit","Teamarbeit","Kommunikation","Organisation","Lösungsorientierung"],
  erfahrungen:["Fachbauleitung","Projektleitung","Ausschreibungen","Offertenvergleich","Bausitzungen","Technische Planung"],
  interessen:["Fernwärme & thermische Netze","Erneuerbare Energien","Energiekonzepte","Nachhaltigkeit","Beratung & Vertrieb","Kommunale Projekte"]
 });
 const careerCriteria=Object.freeze([
  {id:"interest",label:"Fachliche Passung",hint:"Passt die Stelle zu meiner Berufserfahrung?"},
  {id:"tasks",label:"Aufgaben & Entwicklung",hint:"Interessieren mich Aufgaben und Verantwortung?"},
  {id:"commute",label:"Arbeitsweg",hint:"Ist die Pendeldauer praktikabel?"},
  {id:"company",label:"Arbeitgeber",hint:"Passt der Betrieb zu meinen Erwartungen?"},
  {id:"conditions",label:"Lohn & Bedingungen",hint:"Sind Gehalt und Arbeitsbedingungen attraktiv?"}
 ]);
 const criteria=Object.freeze([
  {id:"interest",label:"Mein Interesse",hint:"Möchte ich diesen Beruf kennenlernen?"},
  {id:"tasks",label:"Tätigkeiten",hint:"Passen die beschriebenen Aufgaben zu mir?"},
  {id:"commute",label:"Arbeitsweg",hint:"Ist der Arbeitsweg für mich machbar?"},
  {id:"company",label:"Lehrbetrieb",hint:"Gefällt mir, was ich über den Betrieb weiss?"}
 ]);
 const fold=v=>String(v??"").toLocaleLowerCase("de-CH").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").trim();
 const slug=s=>fold(s).replace(/[^a-z0-9]+/g,"");
 function isApprenticeship(job){
  const title=fold(job?.title);
  if(!title)return false;
  // Deliberately conservative: EFZ/EBA alone identifies a qualification,
  // not an apprenticeship. Adult vacancies often require an EFZ.
  return /\b(lehrstelle|lehrling|ausbildungsplatz|lehre als|apprenti\w*|apprentissage)\b/.test(title) ||
   /^(?:wir suchen )?lernende[rn]?\b/.test(title);

 }
 function startOfLocalDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();}
 function summarize(rows,now=new Date(),market="all"){
  const seen=new Set();
  const unique=(Array.isArray(rows)?rows:[]).filter(j=>{
   if(!j||typeof j.id!=="string"||!j.id||j.id.startsWith("DEMO-")||j.id.startsWith("MANUAL-")||seen.has(j.id))return false;
   seen.add(j.id);return true;
  });
  const entries=market==="career"?unique.filter(j=>!isApprenticeship(j)):market==="apprentice"?unique.filter(isApprenticeship):unique;
  const yesterday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1).getTime();
  const weekday=(now.getDay()+6)%7;
  const week=new Date(now.getFullYear(),now.getMonth(),now.getDate()-weekday).getTime();
  const end=now.getTime();
  const since=start=>entries.filter(j=>{
   const ms=Date.parse(j.first_seen_at);
   return Number.isFinite(ms)&&ms>=start&&ms<=end;
  }).length;
  return {total:entries.length,sinceYesterday:since(yesterday),thisWeek:since(week),
   apprenticeships:entries.filter(isApprenticeship).length,missingDates:entries.filter(j=>!Number.isFinite(Date.parse(j.first_seen_at))).length};
 }
 const initialProfile=()=>({skills:{schule:[],staerken:[],erfahrungen:[],interessen:[]},extraSkills:[],
  occupations:"",region:"",level:"any",startYear:"",example:"",strictOccupation:false,strictRegion:false});
 function normalizedProfile(raw,market="apprentice"){
  const base=initialProfile(),o=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const skills=o.skills&&typeof o.skills==="object"?o.skills:{};
  const groups=market==="career"?careerSkillGroups:skillGroups;
  for(const group of Object.keys(groups))
   base.skills[group]=[...new Set((Array.isArray(skills[group])?skills[group]:[]).filter(s=>typeof s==="string"&&groups[group].includes(s)))];
  base.extraSkills=[...new Set((Array.isArray(o.extraSkills)?o.extraSkills:[]).filter(x=>typeof x==="string").map(x=>x.trim()).filter(x=>x.length>0&&x.length<=48))].slice(0,12);
  for(const [key,max] of [["occupations",250],["region",80],["example",500]])base[key]=typeof o[key]==="string"?o[key].slice(0,max):"";
  base.level=["any","EFZ","EBA"].includes(o.level)?o.level:"any";
  base.startYear=/^20\d{2}$/.test(String(o.startYear||""))?String(o.startYear):"";
  base.strictOccupation=o.strictOccupation===true;
  base.strictRegion=o.strictRegion===true;
  return base;
 }
 function normalizeRatings(raw,market){
  const ratings={},groups=market==="career"?careerCriteria:criteria;
  if(raw&&typeof raw==="object"&&!Array.isArray(raw))
   for(const [id,item] of Object.entries(raw).slice(0,400)){
    if(typeof id!=="string"||!id||id.length>180||!item||typeof item!=="object")continue;
    const scores={};
    for(const c of groups)if(Number.isInteger(item.scores?.[c.id])&&item.scores[c.id]>=1&&item.scores[c.id]<=5)scores[c.id]=item.scores[c.id];
    const note=typeof item.note==="string"?item.note.slice(0,400):"";
    if(Object.keys(scores).length||note)ratings[id]={scores,note};
   }
  return ratings;
 }
 function normalizedState(raw){
  const obj=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const selectedSources=[...new Set((Array.isArray(obj.selectedSources)?obj.selectedSources:[]).filter(x=>sources.some(s=>s.id===x)))];
  const oldCareer=obj.career&&typeof obj.career==="object"&&!Array.isArray(obj.career)?obj.career:{};
  return {
   schema_version:"radar-prototype-v2",market:obj.market==="apprentice"?"apprentice":"career",
   profile:normalizedProfile(obj.profile),selectedSources,ratings:normalizeRatings(obj.ratings,"apprentice"),
   career:{
    profile:normalizedProfile(oldCareer.profile,"career"),
    selectedSources:[...new Set((Array.isArray(oldCareer.selectedSources)?oldCareer.selectedSources:[])
      .filter(x=>typeof x==="string"&&x.length>0&&x.length<=120))].slice(0,30),
    ratings:normalizeRatings(oldCareer.ratings,"career")
   }
  };
 }
 function sourceMatch(jobSource,selection){
  const term=slug(jobSource);
  if(!term)return false;
  return selection.some(id=>term.includes(slug(id))||slug(id).includes(term) && term.length>4);
 }
 function apprenticeshipLevel(job){
  const title=fold(job?.title);return /\beba\b/.test(title)?"EBA":/\befz\b/.test(title)?"EFZ":null;
 }
 function matchesPreferences(job,profile,sourcesChosen,market="apprentice"){
  if(sourcesChosen.length&&!sourceMatch(job.source,sourcesChosen))return false;
  if(market==="apprentice"&&profile.level!=="any"){const level=apprenticeshipLevel(job);if(level&&level!==profile.level)return false;}
  if(profile.strictRegion&&profile.region&&!fold(job.location).includes(fold(profile.region)))return false;
  const choices=profile.occupations.split(/[,;\n]/).map(fold).filter(Boolean);
  if(profile.strictOccupation&&choices.length&&!choices.some(x=>fold(job.title).includes(x)))return false;
  return true;
 }
 function ratingAverage(rating,market="apprentice"){
  const nums=(market==="career"?careerCriteria:criteria).map(c=>rating?.scores?.[c.id]).filter(x=>Number.isInteger(x)&&x>=1&&x<=5);
  return nums.length?{value:nums.reduce((a,b)=>a+b,0)/nums.length,count:nums.length}:null;
 }
 const api=Object.freeze({sources,skillGroups,careerSkillGroups,criteria,careerCriteria,isApprenticeship,summarize,initialProfile,
  normalizedProfile,normalizedState,matchesPreferences,ratingAverage});
 root.CareerRadarModel=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
