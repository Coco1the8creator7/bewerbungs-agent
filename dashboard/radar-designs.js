/* Career.Agency Radar Design Lab.
 * Exactly one visual dot per new, unique job in the selected timeframe.
 * Input lists come from CareerRadarModel.newJobs, the same source as KPI metrics.
 * Never fabricate, cluster, cap or animate extra false targets.
 */
(function(root){
 "use strict";
 const dial=document.getElementById("radarDial");
 const container=document.getElementById("radarTargets");
 const options=document.getElementById("radarDesignOptions");
 if(!dial||!container||!options)return;
 const choices=Object.freeze([
  {id:"zen",name:"Zen Radar",note:"Puls vom Zentrum"},
  {id:"classic",name:"Klassisch",note:"Bisheriges Radar"},
  {id:"sonar",name:"Sonar",note:"Leuchtender Scan"},
  {id:"topography",name:"Topografie",note:"Geländelinien"},
  {id:"orbit",name:"Orbit",note:"Kreisbahnen"},
  {id:"sectors",name:"Sektoren",note:"Winkelraster"},
  {id:"minimal",name:"Minimal",note:"Feines Fadenkreuz"}
 ]);
 let selected="zen",period="yesterday",last=[];
 const wrap=Math.PI*2,golden=Math.PI*(3-Math.sqrt(5));
 function positions(jobs){
  // Golden-angle spiral yields one unique coordinate for each item, even
  // when the count exceeds the physical resolution of a small screen.
  // By design we do not replace individual jobs with aggregate clusters.
  return jobs.map((job,i)=>{
   const n=jobs.length;
   const rho=Math.sqrt((i+0.5)/Math.max(1,n));
   const angle=i*golden-1.3;
   return {id:job.id,x:50+42*rho*Math.cos(angle),y:50+42*rho*Math.sin(angle)};
  });
 }
 function setPoints(jobs,description){
  // Caller passes the exact array used to calculate the displayed KPI.
  last=Array.isArray(jobs)?jobs:[];
  const items=positions(last);
  const fragment=document.createDocumentFragment();
  for(let i=0;i<items.length;i++){
   const pos=items[i];
   const point=document.createElement("span");
   point.className="radar-target";
   point.dataset.jobId=pos.id;
   point.style.left=pos.x.toFixed(6)+"%";
   point.style.top=pos.y.toFixed(6)+"%";
   point.title=last[i].title||"Neues Inserat";
   point.style.setProperty("--target-delay",(i%13*-0.135)+"s");
   fragment.append(point);
  }
  container.replaceChildren(fragment);
  const n=last.length;
  dial.style.setProperty("--target-size",n>900?"1.5px":n>400?"2px":n>160?"3px":n>55?"4px":"7px");
  dial.setAttribute("aria-label",n+" Ortungen: genau "+n+" neue Inserate "+(description||"im gewählten Zeitraum")+".");
  document.getElementById("radarTargetCount").textContent=n.toLocaleString("de-CH");
  document.getElementById("radarTargetPeriod").textContent=
   period==="week"?"Ortungen diese Woche":"Ortungen seit gestern";
  dial.dataset.hasTargets=n>0?"yes":"no";
  return items.length;
 }
 function selectDesign(id){
  if(!choices.some(c=>c.id===id))return;
  selected=id;dial.dataset.design=id;
  for(const button of options.querySelectorAll("[data-design]"))
   button.setAttribute("aria-pressed",String(button.dataset.design===selected));
 }
 for(const choice of choices){
  const button=document.createElement("button");
  button.type="button";button.className="radar-design-button";button.dataset.design=choice.id;
  button.setAttribute("aria-pressed",String(choice.id===selected));
  const art=document.createElement("span");
  art.className="radar-design-swatch";art.dataset.design=choice.id;
  art.setAttribute("aria-hidden","true");
  const sweep=document.createElement("span");sweep.className="radar-design-swatch-sweep";
  art.append(sweep);
  if(choice.id==="zen"){
   const waves=document.createElement("span");
   waves.className="radar-design-swatch-pulses";
   for(let index=0;index<4;index++){
    const ring=document.createElement("span");
    ring.className="radar-design-swatch-pulse";
    waves.append(ring);
   }
   art.append(waves);
  }
  const label=document.createElement("span");label.className="radar-design-label";label.textContent=choice.name;
  const hint=document.createElement("span");hint.className="radar-design-hint";hint.textContent=choice.note;
  button.append(art,label,hint);
  button.addEventListener("click",()=>selectDesign(choice.id));
  options.append(button);
 }
 // Keep the initial HTML, selected picker button and dial theme synchronized.
 selectDesign(selected);
 for(const button of document.querySelectorAll("#radarPeriodControls [data-period]")){
  button.addEventListener("click",()=>{
   if(period===button.dataset.period)return;
   period=button.dataset.period;
   for(const control of document.querySelectorAll("#radarPeriodControls [data-period]"))
    control.setAttribute("aria-pressed",String(control.dataset.period===period));
   // The main controller recalculates KPIs and markers from the same snapshot.
   dial.dispatchEvent(new CustomEvent("radar-period-changed",{bubbles:true}));
  });
 }
 root.CareerRadarDesigns=Object.freeze({getPeriod:()=>period,setPoints,positions,choices});
})(window);
