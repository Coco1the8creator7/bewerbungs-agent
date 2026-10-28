"use strict";
/* Radar visual prototype, isolated from the CRM model.
 * One hero scene designed at the real 222px Agency card size.
 * Five increasingly developed stages are selected by the existing import count.
 * Other Agency worlds continue using the current Nature Blend renderer. */
(function(){
 const previous=window.AgentAgencyArt;
 if(!previous)throw new Error("Nature Blend renderer must load before radar prototype");
 const C={line:"#665f50",sand:"#eee1c9",stone:"#b7ad96",stoneDark:"#847f6d",
  pine:"#657d5d",leaf:"#8ba37b",moss:"#aeba8e",wood:"#967251",
  timber:"#674d3b",metal:"#6d7773",glass:"#a3bbb2",paper:"#fff8eb",
  bronze:"#b88a63",glow:"#f4bc77",dark:"#46524f",shadow:"#766d56"};
 const p=(coords,fill,extra="")=>'<polygon points="'+coords.map(a=>a.join(",")).join(" ")+
  '" fill="'+fill+'" stroke="'+C.line+'" stroke-width="1.25" stroke-linejoin="round" '+extra+'/>';
 const r=(x,y,w,h,fill,extra="")=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+
  '" fill="'+fill+'" '+extra+'/>';
 const l=(d,color=C.line,sw=2,extra="")=>'<path d="'+d+'" fill="none" stroke="'+color+
  '" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round" '+extra+'/>';
 const circ=(x,y,rad,fill,extra="")=>'<circle cx="'+x+'" cy="'+y+'" r="'+rad+
  '" fill="'+fill+'" '+extra+'/>';
 function pine(x,y,s=1){
  return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
   r(-2,-12,4,15,C.timber)+
   p([[-13,-15],[0,-37],[13,-15]],C.pine)+
   p([[-11,-9],[0,-31],[12,-9]],C.leaf)+
   p([[-8,-24],[0,-37],[5,-25]],"#b3c19c")+'</g>';
 }
 function rock(x,y,s=1){
  return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
   p([[-16,0],[-12,-11],[-2,-18],[12,-15],[20,-5],[16,3]],C.stone)+
   p([[-2,-18],[12,-15],[20,-5],[2,-3]],"#d9d0bf")+
   l("M-12 -10 L-7 -2 M2 -3 L12 -15",C.stoneDark,1)+'</g>';
 }
 function ground(){
  let out='<g class="radar-prototype-land">';
  out+='<ellipse cx="160" cy="222" rx="121" ry="12" fill="#938a73" opacity=".16"/>';
  out+='<path d="M34 183 Q51 161 87 166 L109 152 Q158 142 213 157 Q244 156 265 171 L283 191 Q261 214 222 210 L177 219 L126 210 Q78 221 48 201Z" fill="url(#radar-soil)" stroke="#a99b7f" stroke-width="1.3"/>';
  out+='<path d="M41 181 Q81 162 116 168 L172 149 Q222 150 264 175 L247 189 Q213 201 164 199 L114 192 L69 201Z" fill="url(#radar-meadow)" stroke="#b7b99a" stroke-width="1"/>';
  out+='<path d="M69 202 Q115 188 140 184 Q176 185 195 199" stroke="#e5d7b9" stroke-width="13" fill="none" opacity=".75"/>';
  out+='<path d="M69 202 Q115 188 140 184 Q176 185 195 199" stroke="#c2b190" stroke-width="1.3" fill="none" opacity=".65"/>';
  out+=rock(58,188,.8)+rock(250,194,.7);
  out+=pine(79,172,.78)+pine(254,181,.75)+pine(216,164,.55);
  out+='<path d="M92 188 l8 -4 M231 195 l8 1" fill="none" stroke="#869974" stroke-width="4"/>';
  out+='</g>';
  return out;
 }
 function block(x,y,w,h,d,withGlass){
  const half=w/2,top=y-h;
  let s='<g class="radar-prototype-building">';
  s+=p([[x-half,top],[x,top+d],[x,y+d],[x-half,y]],C.stoneDark);
  s+=p([[x,top+d],[x+half,top],[x+half,y],[x,y+d]],C.stone);
  s+=p([[x,top-d],[x+half,top],[x,top+d],[x-half,top]],C.paper);
  s+=p([[x+6,top+d+14],[x+half-6,top+14],[x+half-6,y-4],[x+6,y+d-4]],
    withGlass?C.glass:C.timber);
  s+=l("M"+(x+6)+" "+(top+d+26)+" L"+(x+half-6)+" "+(top+26),
    withGlass?C.paper:C.bronze,1.5);
  s+=p([[x-half+7,top+20],[x-8,top+d-2],[x-8,top+d+11],[x-half+7,top+30]],C.dark);
  s+='</g>';
  return s;
 }
 function dish(x,y,s=1){
  return '<g class="radar-prototype-dish" transform="translate('+x+' '+y+') scale('+s+')">'+
   l("M0 0 L0 -18",C.metal,3)+
   '<ellipse cx="-6" cy="-22" rx="14" ry="8" transform="rotate(-27 -6 -22)" fill="url(#radar-dish)" stroke="#645c51" stroke-width="1.7"/>'+
   l("M-7 -24 L6 -32",C.metal,1.5)+circ(7,-32,2,C.bronze)+'</g>';
 }
 function lattice(tipY,baseY){
  // Braced tower carries the large radar platform: unmistakable vertical growth.
  let o='<g class="radar-prototype-tower">';
  o+=p([[137,baseY],[146,tipY],[178,tipY+6],[187,baseY+7]],"#9b8b73");
  o+=p([[156,baseY+4],[178,tipY+6],[187,baseY+7]],C.stoneDark);
  o+=l("M140 "+baseY+" L148 "+(tipY+4)+" M184 "+(baseY+6)+" L175 "+(tipY+9),
    C.metal,3.4);
  for(let y=baseY-12;y>tipY+12;y-=13){
   const t=(baseY-y)/(baseY-tipY),x=140+8*t,xx=184-8*t;
   o+=l("M"+Math.round(x)+" "+y+" L"+Math.round(xx)+" "+(y-7),C.dark,1.6);
   o+=l("M"+Math.round(xx)+" "+(y-7)+" L"+Math.round(x)+" "+(y-14),C.metal,1.1);
  }
  o+=p([[131,tipY+2],[160,tipY-8],[195,tipY+3],[161,tipY+16]],C.wood);
  o+=l("M132 "+(tipY+6)+" L160 "+(tipY+20)+" L195 "+(tipY+7),C.timber,2);
  o+=l("M136 "+(tipY+1)+" L137 "+(tipY-5)+" M184 "+tipY+" L185 "+(tipY-7),
   C.metal,1.3);
  o+='</g>';
  return o;
 }
 function dome(x,y,rad){
  let out='<g class="radar-prototype-dome">';
  out+=circ(x,y,rad,"url(#radar-glass)",'stroke="#6e7772" stroke-width="1.7"');
  out+='<ellipse cx="'+x+'" cy="'+y+'" rx="'+(rad*.4)+'" ry="'+rad+
   '" fill="none" stroke="#84918a" stroke-width="1" opacity=".7"/>';
  out+='<ellipse cx="'+x+'" cy="'+y+'" rx="'+(rad*.75)+'" ry="'+rad+
   '" fill="none" stroke="#9caaa0" stroke-width=".8" opacity=".6"/>';
  for(const ty of [-.48,0,.48]){
   out+=l("M"+(x-rad*.86)+" "+(y+ty*rad)+" Q"+x+" "+
    (y+ty*rad+5)+" "+(x+rad*.86)+" "+(y+ty*rad),
    "#92a398",.9,'opacity=".7"');
  }
  out+=p([[x-rad*.65,y-rad*.4],[x-rad*.2,y-rad*.9],[x+rad*.15,y-rad*.78],[x,y-rad*.3]],
   "#f5f2e9",'opacity=".55"');
  out+=l("M"+x+" "+(y-rad)+" L"+x+" "+(y-rad-8),C.metal,1.4)+
   circ(x,y-rad-9,2.5,C.bronze,'class="radar-prototype-beacon"');
  out+='</g>';
  return out;
 }
 function paths(level){
  let out='<g class="radar-prototype-props">';
  // Sparse but purposeful equipment, kept subordinate to the hero structure.
  out+=block(104,187,37,18,8,false);
  out+=p([[75,201],[88,195],[104,199],[91,206]],C.wood);
  out+=l("M79 203 L89 206 M91 199 L99 201",C.paper,1.5);
  if(level>=1){
   out+=p([[210,186],[231,176],[248,183],[226,192]],"#657f76");
   out+=l("M214 186 L240 183 M221 187 L229 179",C.paper,1);
  }
  if(level>=2){
   out+=block(236,181,37,23,8,true);
  }
  if(level>=3){
   out+=p([[102,175],[116,170],[129,176],[115,182]],"#839b88");
   out+=l("M111 172 L119 180 M120 172 L126 175",C.paper,1);
  }
  if(level>=4){
   out+=dish(231,166,.52)+l("M115 150 L115 131",C.metal,2)+
    circ(115,129,2.5,C.glow,'class="radar-prototype-beacon"');
  }
  out+='</g>';
  return out;
 }
 const defs='<defs>'+
   '<linearGradient id="radar-soil" x1="0" y1="0" x2="0" y2="1">'+
    '<stop stop-color="#e0d3b6"/><stop offset="1" stop-color="#afa48d"/></linearGradient>'+
   '<linearGradient id="radar-meadow" x1="0" y1="0" x2="0" y2="1">'+
    '<stop stop-color="#bfc6a5"/><stop offset="1" stop-color="#919e7b"/></linearGradient>'+
   '<linearGradient id="radar-glass" x1="0" y1="0" x2="1" y2="1">'+
    '<stop stop-color="#fdf8e8"/><stop offset=".52" stop-color="#cfdbcf"/>'+
    '<stop offset="1" stop-color="#84988f"/></linearGradient>'+
   '<linearGradient id="radar-dish" x1="0" y1="0" x2="1" y2="1">'+
    '<stop stop-color="#fff8e9"/><stop offset="1" stop-color="#aab3aa"/></linearGradient>'+
   '</defs>';
 function renderRadar(raw){
  const n=Number(raw),level=Number.isFinite(n)?Math.min(4,Math.max(0,Math.floor(n))):0;
  let s='<svg xmlns="http://www.w3.org/2000/svg" class="agency-art radar-prototype-art" '+
   'viewBox="0 0 320 260" data-theme="radar" data-level="'+level+
   '" aria-hidden="true" role="presentation">'+defs+ground();
  s+=block(159,183,92,41,18,true);
  if(level===0){
   s+=block(162,146,38,24,11,false)+dish(169,120,.78);
  }else if(level===1){
   s+=lattice(94,149)+dish(162,91,.9);
  }else if(level===2){
   s+=lattice(71,151)+dish(162,69,1.1)+dish(199,143,.55);
  }else if(level===3){
   s+=lattice(93,151)+dome(162,55,24);
  }else{
   s+=lattice(83,153)+dome(162,43,28)+dish(202,125,.65);
   s+=l("M211 170 L211 118",C.metal,2.6)+circ(211,116,3,C.bronze,
    'class="radar-prototype-beacon"');
  }
  s+=paths(level);
  s+='</svg>';
  return s;
 }
 function renderSVG(level,theme){
  return theme==="radar"?renderRadar(level):previous.renderSVG(level,theme);
 }
 function createScene(phase){
  if(phase.theme!=="radar")return previous.createScene(phase);
  const panel=document.createElement("div");
  panel.className="agency-scene agency-scene-v2 agency-scene-nature agency-scene-rich radar-prototype-scene";
  panel.setAttribute("aria-hidden","true");
  panel.innerHTML=renderRadar(phase.visualLevel??phase.level);
  return panel;
 }
 window.AgentAgencyArt=Object.freeze({renderSVG,createScene});
})();