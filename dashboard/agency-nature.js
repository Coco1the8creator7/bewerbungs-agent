"use strict";
/* Nature Blend: seven recognisable, low-detail isometric dioramas.
 * SVG markup is assembled solely from fixed art constants and clamped levels.
 * CRM content is never interpolated into SVG. */
(function(){
  const legacy=window.AgentAgencyArt;
  if(!legacy)throw new Error("agency-art.js must be loaded before agency-nature.js");
  const NS="http://www.w3.org/2000/svg";
  const P=Object.freeze({
    ink:"#5f5b50",line:"#817967",stone:"#c8bda7",light:"#f5eddc",
    sand:"#e5d7bb",sand2:"#d6c6a7",moss:"#a4ac83",olive:"#6f805e",
    pine:"#637552",wood:"#9d7755",woodDark:"#70563f",canvas:"#e8d9b8",
    copper:"#bd8e66",glass:"#b7c9bc",screen:"#819c90",warm:"#e2ab68"
  });
  const THEMES=["radar","dossier","dispatch","comms","interview","advanced","finale"];
  const q=(points)=>points.map(p=>p.join(",")).join(" ");
  function poly(ps,fill,cls=""){return '<polygon points="'+q(ps)+'" fill="'+fill+'" stroke="'+P.line+'" stroke-width="1.2" stroke-linejoin="round"'+(cls?' class="'+cls+'"':"")+'/>';}
  function box(x,y,w,h,fill,cls=""){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'"'+(cls?' class="'+cls+'"':"")+'/>';}
  function line(x1,y1,x2,y2,color=P.ink,width=2,cls=""){return '<path d="M'+x1+' '+y1+' L'+x2+' '+y2+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round"'+(cls?' class="'+cls+'"':"")+'/>';}
  function group(kind,body){return '<g class="agency-nature-'+kind+'">'+body+'</g>';}
  function shrub(x,y,s=1){return '<g transform="translate('+x+' '+y+') scale('+s+')"><path d="M-11 0 Q-16 -13 -5 -13 Q0 -23 9 -15 Q19 -7 10 0Z" fill="'+P.olive+'"/><path d="M-8 -5 Q0 -14 8 -7" fill="none" stroke="'+P.moss+'" stroke-width="2"/></g>';}
  function pine(x,y,s=1){
    return '<g class="agency-nature-pine" transform="translate('+x+' '+y+') scale('+s+')">'+
      box(-2,-17,4,23,P.woodDark)+poly([[-15,-13],[0,-44],[15,-13]],P.pine)+
      poly([[-11,-21],[0,-44],[6,-22]],P.olive)+'</g>';
  }
  function person(x,y){return '<g class="agency-nature-person" transform="translate('+x+' '+y+')">'+
    '<circle cx="0" cy="-14" r="3.4" fill="'+P.canvas+'" stroke="'+P.ink+'" stroke-width="1"/>'+
    box(-4,-10,8,8,P.woodDark)+line(-2,-2,-3,5)+line(2,-2,4,5)+'</g>';}
  function roofHouse(x,y,w,h,glass=false){
    const a=w/2,top=y-h;
    let o=poly([[x-a,top],[x,top+12],[x,y+12],[x-a,y]],P.wood);
    o+=poly([[x,top+12],[x+a,top],[x+a,y],[x,y+12]],glass?P.glass:P.sand2);
    o+=poly([[x,top-13],[x+a,top],[x,top+13],[x-a,top]],P.light);
    o+=glass?poly([[x+5,top+22],[x+a-4,top+9],[x+a-4,y-7],[x+5,y+5]],P.screen):
      poly([[x+5,top+20],[x+a-5,top+11],[x+a-5,top+27],[x+5,top+36]],P.ink);
    o+=line(x+5,top+34,x+a-5,top+25,P.canvas,1.6);
    return group("structure",o);
  }
  function deck(x,y,w=95,d=29){
    return group("deck",poly([[x-w/2,y],[x,y-d/2],[x+w/2,y],[x,y+d/2]],P.sand2)+
      line(x-w/2+8,y+2,x,y+d/2-1,P.wood,1)+
      line(x,y+d/2-1,x+w/2-8,y+2,P.wood,1));
  }
  function table(x,y){
    return group("table",box(x-13,y-17,27,5,P.wood)+
      line(x-10,y-11,x-10,y+3,P.woodDark,2)+line(x+10,y-11,x+10,y+3,P.woodDark,2)+
      box(x-6,y-21,14,3,P.light)+line(x-1,y-21,x-1,y-18,P.wood,1));
  }
  function flag(x,y){
    return group("flag",line(x,y,x,y-58,P.woodDark,2)+
      '<path d="M'+x+' '+(y-56)+' l23 4 -5 12 -18 -4 Z" fill="'+P.woodDark+'"/>'+
      '<path d="M'+(x+9)+' '+(y-52)+' l4 5 -4 0" fill="none" stroke="'+P.light+'" stroke-width="2"/>');
  }
  function dish(x,y,s=1){
    return '<g class="agency-art-dish" transform="translate('+x+' '+y+') scale('+s+')">'+
      line(0,0,0,-18,P.line,3)+
      '<ellipse cx="-5" cy="-21" rx="14" ry="8" transform="rotate(-28 -5 -21)" fill="'+P.light+
      '" stroke="'+P.ink+'" stroke-width="1.6"/>'+line(-5,-21,7,-31,P.ink,1.4)+'</g>';
  }
  function docStack(x,y){return group("documents",box(x,y,16,3,P.light)+box(x+3,y-4,16,3,P.canvas)+line(x+7,y-7,x+17,y-7,P.wood,1));}
  function ground(theme){
    const soil=theme==="radar"?P.stone:theme==="dispatch"?P.sand:theme==="advanced"?P.sand2:P.moss;
    const shadow='<ellipse cx="160" cy="217" rx="116" ry="9" fill="#9b8b6d" opacity=".14"/>';
    const top=poly([[36,181],[111,160],[216,170],[285,194],[212,214],[103,211]],soil);
    const edge='<path d="M36 181 L103 211 L212 214 L285 194" fill="none" stroke="'+P.line+'" stroke-opacity=".35" stroke-width="3"/>';
    let accents="";
    if(theme==="comms"){accents=pine(57,177,.88)+shrub(266,189,.95)+pine(271,178,.64);}
    else if(theme==="advanced"){accents=pine(56,183,.62)+shrub(257,194,.7);}
    else if(theme==="radar"){accents=pine(56,181,.68)+pine(264,184,.74);}
    else if(theme==="dispatch"){accents=shrub(60,190,.54)+shrub(264,191,.62);}
    else if(theme==="interview"){accents=shrub(65,191,.7)+pine(272,179,.62);}
    else {accents=pine(54,181,.68)+shrub(264,193,.62);}
    return group("terrain",shadow+top+edge+accents);
  }
  function radar(level){
    const h=43+level*15,top=171-h;
    let o="";
    // An open timber lookout, not a solid apartment block.
    const xl=130,xr=189;
    o+=line(xl,178,xl+5,top+10,P.woodDark,4)+line(xr,180,xr-3,top+10,P.woodDark,4);
    o+=line(xl+5,top+10,xr-3,top+10,P.wood,4);
    o+=line(xl,178,xr-3,top+10,P.woodDark,1.8)+line(xr,180,xl+5,top+10,P.woodDark,1.8);
    o+=poly([[116,top+9],[155,top-4],[204,top+8],[163,top+20]],P.wood);
    o+=line(117,top+14,163,top+26,P.woodDark,3)+line(163,top+26,204,top+13,P.woodDark,3);
    o+=dish(163,top-8,level>=3?1.25:1);
    if(level>=1)o+=line(207,182,207,top+10,P.ink,2)+
      '<circle cx="207" cy="'+(top+5)+'" r="3.3" fill="'+P.warm+'" class="agency-art-beacon"/>';
    if(level>=2)o+=roofHouse(101,183,44,22);
    if(level>=3)o+=dish(233,181,.52);
    if(level>=4)o+=line(102,182,102,top-10,P.ink,2)+line(94,top-8,110,top-8,P.ink,1.5);
    return group("landmark",o);
  }
  function prepper(level){
    let o="";
    // Small collaborative survival-style camp; producing real dossiers.
    o+=poly([[91,183],[133,126],[171,181]],P.canvas);
    o+=poly([[133,126],[171,181],[133,184]],P.sand2);
    o+=line(133,128,133,185,P.woodDark,1.6);
    o+=box(135,157,16,21,P.woodDark);
    o+=table(209,177)+docStack(198,162);
    o+=person(180,192)+person(224,198);
    if(level>=1)o+=roofHouse(73,187,43,22)+docStack(184,198);
    if(level>=2)o+=group("campfire",'<path d="M191 206 l7 -16 8 16 Z" fill="'+P.warm+'"/>'+
      line(186,204,210,210,P.woodDark,3)+line(211,205,186,210,P.woodDark,3));
    if(level>=3)o+=poly([[219,144],[249,128],[280,148],[252,163]],P.canvas)+
      line(220,147,220,188,P.woodDark,2)+line(269,146,269,182,P.woodDark,2);
    if(level>=4)o+=flag(76,146)+table(115,203);
    return group("landmark",o);
  }
  function dispatch(level){
    let o="";
    o+=roofHouse(132,174,78,46);
    o+=deck(214,193,94,31);
    o+=line(175,182,246,194,P.wood,2);
    o+=poly([[221,179],[271,194],[230,195],[233,187]],P.light,"agency-nature-plane");
    o+=poly([[221,179],[232,187],[230,195]],P.copper);
    o+=person(175,197);
    if(level>=1)o+=docStack(95,192);
    if(level>=2)o+=roofHouse(72,188,36,20)+person(254,201);
    if(level>=3)o+=flag(93,136);
    if(level>=4)o+=deck(223,205,105,21);
    return group("landmark",o);
  }
  function comms(level){
    let o=pine(104,175,1.15)+pine(249,181,.84);
    const top=138-level*8;
    o+=line(147,190,155,top,P.woodDark,5)+line(203,192,199,top,P.woodDark,5);
    o+=line(148,189,199,top,P.woodDark,2)+line(203,189,155,top,P.woodDark,2);
    o+=poly([[134,top+9],[175,top-8],[220,top+6],[178,top+25]],P.wood);
    o+=roofHouse(178,top+2,50,21);
    o+=line(138,top+20,210,top+20,P.woodDark,1.4);
    o+=line(137,top+21,111,182,P.woodDark,2);
    o+=dish(226,top+6,.68);
    if(level>=1)o+=line(213,top-23,213,top-51,P.ink,2)+
      '<circle cx="213" cy="'+(top-54)+'" r="3" fill="'+P.warm+'" class="agency-art-beacon"/>';
    if(level>=2)o+=deck(240,182,51,17);
    if(level>=3)o+=pine(71,187,.82)+person(119,195);
    if(level>=4)o+=roofHouse(94,184,32,18);
    return group("landmark",o);
  }
  function speaker(level){
    let o=deck(160,180,139,39);
    o+=poly([[102,164],[161,146],[223,164],[163,183]],P.light);
    o+=line(103,167,103,194,P.woodDark,3)+line(222,165,222,193,P.woodDark,3);
    o+=box(142,146,42,3,P.wood);
    o+=person(166,177);
    o+=line(74,190,106,199,P.woodDark,3)+line(84,199,114,209,P.woodDark,3);
    o+=line(221,203,249,192,P.woodDark,3);
    if(level>=1)o+=person(102,200);
    if(level>=2)o+=box(184,152,20,12,P.screen)+line(184,156,204,156,P.light,1.5);
    if(level>=3)o+=line(105,150,219,148,P.wood,1.4)+
      '<circle cx="127" cy="150" r="2.5" fill="'+P.warm+'" class="agency-art-beacon"/>'+
      '<circle cx="194" cy="149" r="2.5" fill="'+P.warm+'"/>';
    if(level>=4)o+=person(239,194)+pine(264,189,.6);
    return group("landmark",o);
  }
  function insider(level){
    let o="";
    o+=poly([[84,191],[123,136],[203,135],[247,188],[210,206],[117,206]],P.stone);
    o+=poly([[124,136],[179,110],[202,136]],P.sand2);
    o+='<path d="M139 200 V163 Q140 145 160 145 Q182 145 182 163 V200 Z" fill="'+P.woodDark+
      '" stroke="'+P.line+'" stroke-width="2"/>';
    o+='<path d="M148 200 V164 Q148 155 161 155 Q173 155 173 164 V200 Z" fill="'+P.ink+'"/>';
    o+=box(159,164,3,35,P.warm);
    o+=line(140,163,183,163,P.wood,3);
    o+=box(192,179,7,15,P.woodDark);
    o+='<circle cx="196" cy="177" r="4" fill="'+P.warm+'" class="agency-art-beacon"/>';
    if(level>=1)o+=person(122,195);
    if(level>=2)o+=roofHouse(228,177,43,24,true);
    if(level>=3)o+=table(233,196);
    if(level>=4)o+=flag(213,128);
    return group("landmark",o);
  }
  function entrepreneur(level){
    let o=roofHouse(160,164,116,62,true);
    o+=deck(214,184,95,29);
    o+=line(105,191,94,206,P.stone,3)+line(96,205,82,212,P.stone,3);
    o+=person(215,198);
    if(level>=1)o+=flag(117,110);
    if(level>=2)o+=pine(85,173,.72)+shrub(241,188,.76);
    if(level>=3)o+=roofHouse(232,167,46,31,true);
    if(level>=4)o+=group("achievement",'<circle cx="270" cy="99" r="9" fill="'+P.warm+
      '" opacity=".42"/>'+poly([[263,97],[270,90],[277,97],[270,103]],P.copper));
    return group("landmark",o);
  }
  const motifs={radar, dossier:prepper,dispatch,comms,interview:speaker,advanced:insider,finale:entrepreneur};
  function natureSVG(rawLevel,rawTheme){
    const theme=Object.prototype.hasOwnProperty.call(motifs,rawTheme)?rawTheme:"radar";
    const n=Number(rawLevel);
    const level=Number.isFinite(n)?Math.max(0,Math.min(4,Math.floor(n))):0;
    return '<svg xmlns="'+NS+'" class="agency-art agency-nature-art" viewBox="0 0 320 245" '+
      'role="presentation" aria-hidden="true" shape-rendering="geometricPrecision" '+
      'data-theme="'+theme+'" data-level="'+level+'">'+ground(theme)+motifs[theme](level)+'</svg>';
  }
  function renderSVG(level,theme){
    return THEMES.includes(theme)?natureSVG(level,theme):legacy.renderSVG(level,theme);
  }
  function createScene(phase){
    const panel=document.createElement("div");
    panel.className="agency-scene agency-scene-v2 agency-scene-nature";
    panel.setAttribute("aria-hidden","true");
    const level=phase.visualLevel??phase.level;
    panel.innerHTML=renderSVG(level,phase.theme);
    return panel;
  }
  window.AgentAgencyArt=Object.freeze({renderSVG,createScene});
})();