"use strict";
/* Reusable, dependency-free isometric island renderer.
 * All art is generated from trusted constants; CRM data is never embedded in the SVG. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const palette = Object.freeze({
    ink: "#554d43", edge: "#665f52", roof: "#e9e2d3", roofLight: "#f6f0e3",
    left: "#a69b88", right: "#c1b5a0", earthLeft: "#847a68", earthRight: "#9b907d",
    turf: "#acb28b", grass: "#758364", screen: "#647a79", glow: "#e2aa63",
    trunk: "#77694d", leaf: "#71805c", stone: "#c8bcaa", light: "#f7ddb0"
  });
  const themeAccents = Object.freeze({
    radar:"#8d9581", analysis:"#bf9767", dossier:"#9f9580", dispatch:"#8d9e81",
    comms:"#b69b75", interview:"#b9957d", advanced:"#ac9b7e", finale:"#b99560"
  });
  const points = coords => coords.map(pair=>pair.join(",")).join(" ");
  const polygon = (coords,fill,cls="") =>
    '<polygon points="'+points(coords)+'" fill="'+fill+'" stroke="'+palette.edge+
    '" stroke-width="1.4" stroke-linejoin="miter"'+(cls?' class="'+cls+'"':"")+'/>';
  const rect = (x,y,w,h,fill,cls="") =>
    '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+
    '"'+(cls?' class="'+cls+'"':"")+'/>';
  function tower(x,y,w,h,d,accent,large) {
    const ty=y-h, half=w/2;
    let o='<g class="agency-art-structure">';
    o+=polygon([[x-half,ty],[x,ty+d],[x,y+d],[x-half,y]],palette.left);
    o+=polygon([[x,ty+d],[x+half,ty],[x+half,y],[x,y+d]],palette.right);
    o+=polygon([[x,ty-d],[x+half,ty],[x,ty+d],[x-half,ty]],palette.roofLight);
    // Two small window strips, recessed into the right facade.
    o+=polygon([[x+7,ty+d+10],[x+half-6,ty+6],[x+half-6,ty+12],[x+7,ty+d+16]],palette.ink);
    o+=polygon([[x+8,ty+d+11],[x+half-7,ty+8],[x+half-7,ty+10],[x+8,ty+d+14]],accent);
    if (large) {
      // Readable analysis display: a dark rectangle containing restrained amber bars.
      const a=x+6,b=x+half-5,top=ty+d+24,skew=d*0.62;
      o+=polygon([[a,top],[b,top-skew],[b,top+27-skew],[a,top+27]],palette.screen);
      for(let i=0;i<3;i++){
        const bx=a+6+i*7,by=top+19-i*4;
        o+=rect(bx,by,3,4+i*4,palette.light,"agency-art-display");
      }
    } else {
      o+=rect(x-half+7,ty+15,5,8,palette.light,"agency-art-window");
    }
    // Roof details and a small aerial.
    o+=rect(x-3,ty-d-10,3,12,palette.ink);
    o+=rect(x-3,ty-d-11,3,3,palette.glow,"agency-art-beacon");
    o+='</g>';
    return o;
  }
  function tree(x,y,s=1) {
    return '<g class="agency-art-tree" transform="translate('+x+' '+y+') scale('+s+')">'+
      rect(-2,-15,4,22,palette.trunk)+
      polygon([[-13,-19],[0,-35],[13,-19],[9,-11],[-9,-11]],palette.leaf)+
      polygon([[-11,-17],[0,-27],[7,-18]],palette.turf)+'</g>';
  }
  function agent(x,y) {
    return '<g class="agency-art-agent" transform="translate('+x+' '+y+')"><g class="agency-art-agent-motion">'+
       rect(-3,-12,6,7,palette.ink)+rect(-2,-16,4,4,palette.light)+
       rect(-3,-5,2,5,palette.ink)+rect(1,-5,2,5,palette.ink)+'</g></g>';
  }
  function dish(x,y) {
    return '<g class="agency-art-dish" transform="translate('+x+' '+y+')">'+
      rect(-2,-17,4,22,palette.edge)+
      '<ellipse cx="-2" cy="-21" rx="14" ry="7" transform="rotate(-28 -2 -21)" fill="'+palette.roofLight+
      '" stroke="'+palette.ink+'" stroke-width="2"/>'+
      rect(5,-30,2,10,palette.ink)+'</g>';
  }
  function drone(x,y) {
    return '<g class="agency-art-drone" transform="translate('+x+' '+y+')"><g class="agency-art-drone-motion">'+
      polygon([[-15,-2],[15,-2],[10,2],[-10,2]],palette.ink)+
      rect(-6,-7,12,7,palette.stone)+
      rect(-16,-4,5,2,palette.glow)+rect(11,-4,5,2,palette.glow)+'</g></g>';
  }
  function landing(x,y) {
    return '<g class="agency-art-landing">'+
      polygon([[x,y-12],[x+30,y],[x,y+12],[x-30,y]],palette.ink)+
      polygon([[x,y-8],[x+22,y],[x,y+8],[x-22,y]],palette.roof)+
      '<path d="M '+(x-8)+' '+(y-2)+' h 16 M '+x+' '+(y-5)+' v 10" stroke="'+palette.ink+
      '" stroke-width="3" fill="none"/></g>';
  }
  function terrain() {
    let o='<g class="agency-art-terrain">';
    o+='<ellipse cx="160" cy="243" rx="126" ry="13" fill="#ad9e86" opacity=".17"/>';
    o+=polygon([[40,177],[160,222],[160,250],[40,204]],palette.earthLeft);
    o+=polygon([[160,222],[280,177],[280,204],[160,250]],palette.earthRight);
    o+=polygon([[160,149],[280,177],[160,222],[40,177]],palette.stone);
    o+=polygon([[160,149],[280,177],[160,204],[43,176]],palette.roof);
    o+=polygon([[160,149],[212,161],[197,166],[148,153]],palette.turf);
    o+=polygon([[54,176],[87,163],[103,171],[71,184]],palette.turf);
    o+=polygon([[230,188],[262,178],[270,182],[238,195]],palette.turf);
    // Sparse stone seams; avoid busy texture.
    o+='<path d="M 73 185 l 11 4 M 232 191 l 11 -4 M 136 211 l 12 4" stroke="'+
      palette.left+'" stroke-width="2" fill="none"/>';
    o+='</g>';
    return o;
  }
  function renderSVG(rawLevel,rawTheme) {
    const level=Math.max(0,Math.min(4,Number.isFinite(Number(rawLevel))?Math.floor(Number(rawLevel)):0));
    const theme=Object.prototype.hasOwnProperty.call(themeAccents,rawTheme)?rawTheme:"analysis";
    const accent=themeAccents[theme];
    const special=theme==="radar";
    let o='<svg class="agency-art" xmlns="'+NS+'" viewBox="0 0 320 260" role="presentation" '+
      'aria-hidden="true" shape-rendering="crispEdges" data-level="'+level+'" data-theme="'+theme+'">';
    o+=terrain();
    o+=tree(94,150,0.6)+tree(236,171,0.65);
    if(level===0) {
      o+=tower(147,178,56,26,12,accent,false)+dish(204,166);
    } else if(level===1) {
      o+=tower(163,169,70,49,16,accent,true);
      if(special)o+=dish(213,154);
      o+=agent(118,188);
    } else if(level===2) {
      o+=tower(155,171,76,58,17,accent,true);
      o+=tower(220,186,46,25,12,accent,false);
      if(special)o+=dish(96,152);
      o+=agent(118,190)+drone(250,90);
    } else if(level===3) {
      o+=tower(116,185,52,34,12,accent,false);
      o+=tower(191,170,76,79,17,accent,true);
      o+=landing(241,178);
      if(special)o+=dish(91,149);
      o+=agent(144,198)+agent(219,194)+drone(257,91);
    } else {
      o+=tower(123,178,62,59,15,accent,true);
      o+=tower(216,165,74,93,17,accent,true);
      o+=tower(167,196,46,29,11,accent,false);
      o+=landing(251,187);
      if(special)o+=dish(92,148);
      o+=agent(112,192)+agent(153,209)+agent(222,199)+drone(267,76);
    }
    o+='</svg>';
    return o;
  }
  function createScene(phase) {
    const panel=document.createElement("div");
    panel.className="agency-scene agency-scene-v2";
    panel.setAttribute("aria-hidden","true");
    const level=phase.id==="radar"&&phase.count>0?Math.max(1,phase.level):phase.level;
    panel.innerHTML=renderSVG(level,phase.theme);
    return panel;
  }
  window.AgentAgencyArt=Object.freeze({renderSVG,createScene});
})();