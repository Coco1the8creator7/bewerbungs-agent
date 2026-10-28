"use strict";
/* Nature Blend · detailed art pass.
 * Lightweight additive SVG detailing, deliberately separated from CRM data and
 * the seven base silhouettes. Each scene has one visual focal point, spare ground,
 * and increasingly active optional scenery on levels 1–4. */
(function(){
 const base=window.AgentAgencyArt;
 if(!base)throw new Error("Agency Nature Blend base renderer is required");
 const W=Object.freeze({
  ink:"#574c3b", wood:"#8d6748", woodDark:"#6e5038", canvas:"#e9dcc7", lightWood:"#c8a079", pale:"#f8eddb",
  grass:"#84966c", moss:"#a7ae8e", leaf:"#617a56", sand:"#e5d4b5", clay:"#b58562",
  stone:"#aca99a", dark:"#4b544b", glass:"#bed1c2", teal:"#63867c",
  gold:"#e5b169", red:"#ad705b", violet:"#8d6475", metal:"#767c78"
 });
 const accepted=["radar","dossier","dispatch","comms","interview","advanced","finale"];
 const l=(x,y,a,b,color=W.wood,w=2,klass="")=>'<path d="M'+x+' '+y+' L'+a+' '+b+
   '" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="round"'+(klass?' class="'+klass+'"':"")+'/>';
 const p=(d,fill,klass="",stroke="none")=>'<path d="'+d+'" fill="'+fill+'" stroke="'+stroke+'"'+(klass?' class="'+klass+'"':"")+'/>';
 const r=(x,y,w,h,fill,klass="",rx=0)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+
  '" fill="'+fill+'"'+(klass?' class="'+klass+'"':"")+'/>';
 const c=(x,y,rad,fill,klass="",stroke="none",width=1)=>'<circle cx="'+x+'" cy="'+y+'" r="'+rad+
  '" fill="'+fill+'"'+(klass?' class="'+klass+'"':"")+' stroke="'+stroke+'" stroke-width="'+width+'"/>';
 const g=(name,content)=>'<g class="agency-nature-detail agency-detail-'+name+'">'+content+'</g>';
 function steps(x,y){
  let o="";
  for(let i=0;i<3;i++)o+=p("M"+(x-i*6)+" "+(y+i*4)+" l18 4 -8 3 -18 -4Z",
    i===0?W.pale:W.sand,"",""+W.stone);
  return g("steps",o);
 }
 function flower(x,y,fill=W.red){
  return l(x,y,x,y-5,W.grass,1)+c(x,y-7,2,fill)+c(x+3,y-7,1.3,W.pale);
 }
 function planter(x,y){
  return g("planter",p("M"+(x-9)+" "+y+" l18 0 -3 9 -12 0 Z",W.clay)+
   p("M"+(x-8)+" "+(y-3)+" q0 -10 7 -10 q5 -9 7 -3 q7 -3 8 10",W.leaf));
 }
 function lantern(x,y){
  return g("lantern",l(x,y,x,y-19,W.wood,2)+
   c(x,y-22,3,W.gold,"agency-nature-detail-glow")+
   '<path d="M'+(x-6)+' '+(y-22)+' v-5 l6 -4 6 4 v5" fill="none" stroke="'+W.wood+'" stroke-width="1.2"/>');
 }
 function crate(x,y){
  return g("crate",p("M"+x+" "+y+" l14 -5 14 5 -14 6Z",W.sand,"",W.wood)+
    p("M"+x+" "+y+" l14 6 v13 l-14 -6Z",W.wood)+
    p("M"+(x+14)+" "+(y+6)+" l14 -6 v13 l-14 6Z",W.clay)+
    l(x+3,y+4,x+11,y+12,W.pale,1.3));
 }
 function wire(x1,y1,x2,y2,n=4){
  let o='<path d="M'+x1+' '+y1+' Q'+((x1+x2)/2)+' '+(Math.max(y1,y2)+11)+' '+x2+' '+y2+
   '" fill="none" stroke="'+W.wood+'" stroke-width="1.1"/>';
  for(let i=1;i<=n;i++){
    const t=i/(n+1),x=x1+(x2-x1)*t,y=y1+(y2-y1)*t+9*Math.sin(Math.PI*t);
    o+=c(Math.round(x),Math.round(y),2.2,W.gold,"agency-nature-detail-glow");
  }
  return o;
 }
 function fence(x,y,length=36){
  let o=l(x,y-12,x+length,y-11,W.wood,2);
  for(let k=0;k<=length;k+=9)o+=l(x+k,y,x+k,y-14,W.wood,1.4);
  return g("fence",o);
 }
 function tinyGarden(){
  return g("garden",flower(56,196)+flower(68,198,W.gold)+
    flower(252,196,W.violet)+p("M61 192 q8 -4 15 -2", "none","",""+W.grass));
 }
 function radar(level){
  const top=171-(43+level*15),y=top-37;
  let o="";
  // The observation sphere gives Radar its unmistakable visual identity.
  if(level>=1){
    o+=g("radar-dome",c(163,y,18,W.pale,"",W.stone,1.4)+
      p("M148 "+(y-9)+" Q163 "+(y-21)+" 178 "+(y-9)+" M146 "+y+" Q163 "+(y+6)+" 180 "+y+
        " M148 "+(y+9)+" Q163 "+(y+19)+" 178 "+(y+9),"none","",W.stone)+
      p("M163 "+(y-18)+" Q151 "+y+" 163 "+(y+18)+
        " M163 "+(y-18)+" Q175 "+y+" 163 "+(y+18),"none","",W.stone)+
      c(163,y-20,2.3,W.red,"agency-nature-detail-glow"));
    o+=fence(127,top+15,35);
  }
  o+=steps(99,193)+crate(225,181)+g("path",p("M81 201 Q96 194 116 187","none","",W.sand));
  if(level>=2){
    o+=g("radar-equipment",r(91,167,18,9,W.dark)+
      r(94,169,12,3,W.teal)+l(99,166,99,160,W.metal,1.5));
  }
  if(level>=3){
    o+=g("radar-signals",'<circle cx="163" cy="'+y+'" r="28" fill="none" stroke="'+W.gold+
      '" stroke-width="1.2" stroke-dasharray="6 8" opacity=".72" class="agency-nature-detail-signal"/>'+
      '<circle cx="163" cy="'+y+'" r="38" fill="none" stroke="'+W.gold+
      '" stroke-width="1" stroke-dasharray="4 11" opacity=".46" class="agency-nature-detail-signal"/>');
  }
  if(level>=4)o+=g("radar-solar",p("M220 176 l31 -8 11 8 -31 8Z",W.teal,"",W.metal)+
    l(231,172,242,179,W.pale,1)+l(241,170,252,177,W.pale,1));
  return g("radar-world",o+tinyGarden());
 }
 function prepper(level){
  let o="";
  // A real community of dossier builders: workbench, filing boards, supply boxes.
  o+=g("dossier-bench",p("M168 179 l42 -12 18 7 -42 13Z",W.wood,"",W.dark)+
    l(182,187,182,198,W.wood,2)+l(218,177,218,192,W.wood,2)+
    p("M189 176 l12 -3 8 2 -12 4Z",W.pale)+
    p("M205 174 l12 -3 5 2 -12 4Z",W.sand));
  o+=g("board",r(177,127,38,27,W.wood,"",2)+r(181,131,30,20,W.pale)+
    r(185,136,21,2,W.clay)+r(186,142,16,2,W.stone)+c(204,148,2.5,W.red));
  o+=g("supplies",crate(74,196)+crate(102,200));
  o+=g("ropes",l(132,125,83,160,W.wood,1)+l(132,125,176,160,W.wood,1));
  o+=lantern(159,175);
  if(level>=1)o+=g("workstation",r(236,176,17,15,W.wood)+
     r(238,178,13,9,W.pale)+r(239,180,10,2,W.teal)+
     r(236,174,16,2,W.stone));
  if(level>=2)o+=g("camp-community",wire(107,132,191,133,5)+
    c(246,201,4,W.gold,"agency-nature-detail-glow"));
  if(level>=3)o+=g("canopy-details",p("M219 146 l29 -16 32 18", "none","",W.wood)+
    l(247,131,248,164,W.wood,2)+
    r(256,150,19,13,W.sand)+r(258,153,15,2,W.wood));
  if(level>=4)o+=g("dossier-workshop",r(114,185,23,19,W.sand)+
    p("M114 185 l11 -8 12 8Z",W.clay)+
    r(120,189,9,4,W.teal)+
    c(126,173,2,W.gold,"agency-nature-detail-glow"));
  return g("prepper-world",o+flower(252,193,W.gold));
 }
 function dispatch(level){
  let o="";
  o+=g("hangar-front",r(104,151,23,17,W.ink)+
    r(107,154,17,9,W.teal)+l(113,155,113,161,W.pale,1.1)+
    r(129,144,10,4,W.wood));
  // Recognisable runway and directional markings.
  o+=g("runway",p("M188 187 l55 -13 43 17 -62 20Z",W.stone,"",W.sand)+
    l(221,195,264,193,W.pale,1.9)+
    l(239,201,257,199,W.pale,1.8)+
    l(218,205,232,203,W.pale,1.4));
  o+=crate(78,194)+crate(55,195);
  o+=g("postal-mark",r(119,139,24,12,W.wood)+
    p("M123 141 l8 5 8 -5", "none","",W.pale)+l(123,149,139,149,W.pale,1));
  if(level>=1)o+=g("shipment-lights",lantern(259,175)+
    r(243,174,8,4,W.red));
  if(level>=2)o+=g("sorting-room",r(63,168,16,7,W.ink)+
    r(65,170,12,3,W.teal)+l(71,167,71,163,W.wood,1.5));
  if(level>=3)o+=g("launch-tower",l(269,178,269,129,W.dark,2)+
    l(260,141,279,141,W.metal,1.3)+
    c(269,127,3,W.red,"agency-nature-detail-glow"));
  if(level>=4)o+=g("active-dispatch",p("M231 167 Q247 155 264 143","none","agency-nature-detail-flight",W.gold)+
    p("M265 142 l-4 8 -6 -4Z",W.pale));
  return g("dispatch-world",o);
 }
 function comms(level){
  let o="";
  const y=138-level*8;
  // Rope bridge, timber railings, signal cabling.
  o+=g("rope-bridge",p("M75 186 Q102 164 137 "+(y+20),"none","",W.wood)+
    p("M77 181 Q106 162 140 "+(y+16),"none","",W.wood)+
    l(81,178,81,184,W.wood,2)+
    l(93,172,93,180,W.wood,2)+
    l(105,163,105,174,W.wood,2));
  o+=g("watchtower-railing",fence(152,y+16,53)+
    l(178,y+17,178,y+27,W.woodDark,2));
  o+=g("cable",wire(181,y-9,250,164,3));
  o+=g("handrails",l(126,185,112,199,W.wood,2)+
    l(131,182,117,196,W.wood,1.6)+l(115,195,134,192,W.wood,1.6));
  if(level>=1)o+=g("message-terminal",r(232,171,20,13,W.ink)+
    r(235,174,14,6,W.teal)+l(242,184,242,190,W.wood,2));
  if(level>=2)o+=g("observation-platform",fence(223,180,29)+
    lantern(259,174));
  if(level>=3)o+=g("radio-activity",c(215,y-52,12,"none","agency-nature-detail-signal",W.gold,1.4)+
    c(215,y-52,20,"none","agency-nature-detail-signal",W.gold,1));
  if(level>=4)o+=g("forest-relay",l(91,173,91,121,W.woodDark,2)+
    c(91,120,3,W.gold,"agency-nature-detail-glow")+
    wire(91,120,145,y+6,3));
  return g("comms-world",o);
 }
 function speaker(level){
  let o="";
  // Warm open-air gathering place, a microphone and speaking podium.
  o+=g("presentation",r(149,156,20,10,W.wood)+
   p("M152 155 l16 -4 13 4 -15 5Z",W.sand,"",W.wood)+
   l(167,151,167,136,W.dark,1.4)+c(167,135,2.6,W.ink));
  o+=g("seating",p("M91 197 l20 -5 17 6 -20 5Z",W.wood)+
    p("M113 203 l20 -5 14 6 -20 5Z",W.sand)+
    p("M217 200 l22 -7 15 5 -24 9Z",W.wood));
  o+=g("canvas-sail",p("M103 155 Q163 132 222 155 L163 148 Z",W.pale,"",W.sand)+
    l(103,156,103,180,W.wood,2)+l(223,155,223,187,W.wood,2));
  o+=planter(85,182)+planter(240,180);
  if(level>=1)o+=g("audience-one",c(113,186,4,W.canvas)+r(110,189,7,7,W.teal));
  if(level>=2)o+=g("presentation-screen",r(186,149,22,13,W.pale)+
    r(188,152,16,2,W.clay)+r(188,157,11,2,W.stone));
  if(level>=3)o+=g("festoon",wire(105,150,220,148,6));
  if(level>=4)o+=g("audience-three",c(248,186,4,W.canvas)+
    r(245,190,7,7,W.red)+c(90,200,3.4,W.canvas));
  return g("speaker-world",o);
 }
 function insider(level){
  let o="";
  // Restrained geology on the flank of a naturally hidden headquarters.
  o+=g("rock-strata",p("M101 187 l24 -29 17 -14 M188 139 l23 28 24 18","none","",W.stone)+
    l(107,185,136,155,W.pale,2)+l(203,146,224,178,W.pale,2));
  o+=g("vault-door",p("M148 195 V165 Q148 155 160 155 Q173 155 173 165 V195 Z",W.dark)+
    l(153,165,170,165,W.teal,2.5)+
    r(151,172,18,8,W.woodDark)+
    c(166,175,2.2,W.gold,"agency-nature-detail-glow"));
  o+=g("secure-keypad",r(185,180,14,17,W.wood)+
    r(188,183,8,3,W.glass)+
    c(189,190,1.4,W.pale)+c(195,190,1.4,W.pale));
  o+=steps(110,199)+lantern(212,169);
  if(level>=1)o+=g("bunker-camp",crate(86,191));
  if(level>=2)o+=g("annex",r(231,161,16,16,W.teal)+
    r(233,164,12,9,W.glass));
  if(level>=3)o+=g("meeting-light",c(244,145,4,W.gold,"agency-nature-detail-glow")+
    l(244,146,244,157,W.wood,2));
  if(level>=4)o+=g("bunker-solar",p("M196 131 l33 -6 14 8 -34 5Z",W.teal,"",W.wood)+
    l(207,134,237,129,W.pale,1));
  return g("insider-world",o);
 }
 function entrepreneur(level){
  let o="";
  // Light contemporary timber/glass pavilion and landscaped arrival terrace.
  o+=g("transparent-facade",r(155,113,33,32,W.glass)+
    l(167,115,167,143,W.pale,1.8)+
    l(178,115,178,143,W.pale,1.8)+
    l(155,135,188,135,W.pale,1.5));
  o+=g("garden-terrace",p("M206 171 l31 -10 25 8 -33 12Z",W.moss)+
    r(220,163,23,4,W.wood)+
    r(225,160,4,5,W.woodDark)+
    planter(252,165)+flower(238,177,W.gold));
  o+=g("steps",steps(95,195));
  o+=g("roof-plants",planter(110,101)+planter(200,106));
  if(level>=1)o+=g("flag-decor",wire(125,105,191,107,4));
  if(level>=2)o+=g("community-garden",planter(79,171)+
    planter(264,191));
  if(level>=3)o+=g("glass-extension",r(229,138,16,22,W.glass)+
    l(237,140,237,159,W.pale,1.6));
  if(level>=4)o+=g("victory",c(266,108,16,"none","agency-nature-detail-celebrate",W.gold,1.5)+
    c(266,108,6,W.gold,"agency-nature-detail-glow")+
    p("M257 95 l5 3 M275 120 l5 4 M254 120 l-5 4 M282 97 l4 -3","none","",W.red));
  return g("entrepreneur-world",o);
 }
 const scenes=Object.freeze({radar,dossier:prepper,dispatch,comms,interview:speaker,advanced:insider,finale:entrepreneur});
 function renderSVG(rawLevel,theme){
  const svg=base.renderSVG(rawLevel,theme);
  if(!accepted.includes(theme))return svg;
  const n=Number(rawLevel);
  const level=Number.isFinite(n)?Math.max(0,Math.min(4,Math.floor(n))):0;
  return svg.replace("</svg>",scenes[theme](level)+"</svg>");
 }
 function createScene(phase){
  const node=document.createElement("div");
  node.className="agency-scene agency-scene-v2 agency-scene-nature agency-scene-rich";
  node.setAttribute("aria-hidden","true");
  node.innerHTML=renderSVG(phase.visualLevel??phase.level,phase.theme);
  return node;
 }
 window.AgentAgencyArt=Object.freeze({renderSVG,createScene});
})();