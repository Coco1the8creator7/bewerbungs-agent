"use strict";
/* Illustrated Radar, based on the approved Nature Blend image.
 * Progressive layers are derived from the existing, unique-import Radar level.
 * No persistence, achievement or CRM logic lives in this module. */
(function(){
  const previous=window.AgentAgencyArt;
  if(!previous)throw new Error("Agency artwork must be loaded before illustrated Radar");
  const ROOT="./assets/agency/";
  const ASSETS=Object.freeze({
    ground:ROOT+"radar-base.webp",
    tower:ROOT+"radar-tower.webp",
    dome:ROOT+"radar-dome.webp"
  });
  const TOWER_SCALES=Object.freeze([.48,.64,.78,.90,1]);
  const DOME_SCALES=Object.freeze([0,0,.80,.90,1]);
  const DOME_TOP=Object.freeze([0,0,"19.9%","10.8%","3.2%"]);
  const levelOf=phase=>{
    const n=Number(phase.visualLevel??phase.level);
    return Number.isFinite(n)?Math.min(4,Math.max(0,Math.floor(n))):0;
  };
  function element(tag,cls){
    const e=document.createElement(tag);
    e.className=cls;
    return e;
  }
  function layer(name,file){
    const img=element("img","radar-illustration-"+name);
    img.src=file;
    img.alt="";
    img.draggable=false;
    img.decoding="async";
    return img;
  }
  function createScene(phase){
    if(phase.theme!=="radar")return previous.createScene(phase);
    const level=levelOf(phase);
    const stage=element("div","agency-scene agency-scene-v2 agency-scene-nature agency-radar-illustrated");
    stage.setAttribute("aria-hidden","true");
    stage.dataset.level=String(level);
    stage.style.setProperty("--radar-tower-size",String(TOWER_SCALES[level]));
    stage.style.setProperty("--radar-dome-size",String(DOME_SCALES[level]));
    stage.style.setProperty("--radar-dome-top",DOME_TOP[level]);
    const landscape=layer("landscape",ASSETS.ground);
    landscape.loading="eager";
    stage.append(landscape);
    const tower=layer("tower",ASSETS.tower);
    tower.loading="eager";
    stage.append(tower);
    if(level>=2){
      const receiver=element("div","radar-illustration-receiver");
      receiver.append(layer("dome",ASSETS.dome));
      if(level>=3){
        receiver.append(element("span","radar-illustration-wave"));
        if(level===4)receiver.append(element("span","radar-illustration-wave radar-illustration-wave-secondary"));
      }
      stage.append(receiver);
    }
    if(level>=1)stage.append(element("span","radar-illustration-beacon"));
    // If an asset fails, fall back to the existing locally-rendered artwork.
    stage.addEventListener("error",()=>{
      if(stage.isConnected)stage.replaceWith(previous.createScene(phase));
    },{capture:true,once:true});
    return stage;
  }
  window.AgentAgencyArt=Object.freeze({
    renderSVG:previous.renderSVG, // legacy Analysis level gallery
    createScene,
    radarAssetStages:Object.freeze(TOWER_SCALES.map((scale,level)=>({
      level,scale,dome:DOME_SCALES[level]>0
    })))
  });
})();