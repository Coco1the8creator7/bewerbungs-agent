/* Persistent layout helpers for free-positioned Dossier Studio text fields.
 * Percent coordinates are relative to the A4 page, independent of preview zoom.
 * Browser global + CommonJS for deterministic tests.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.CareerStudioModules=api;
})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const MIN_WIDTH=14,MAX_WIDTH=86,MAX_BOXES=24;
 const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):min));
 const number=(n,fallback)=>Number.isFinite(Number(n))?Number(n):fallback;
 function normalizeBox(source){
  const raw=source&&typeof source==="object"?source:{};
  const width=clamp(number(raw.width,38),MIN_WIDTH,MAX_WIDTH);
  const x=clamp(number(raw.x,12),0,100-width);
  return {
   id:typeof raw.id==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id)?raw.id:"",
   text:typeof raw.text==="string"?raw.text.slice(0,20000):"",
   x,y:clamp(number(raw.y,48),0,96),width,
   fontSize:clamp(number(raw.fontSize,100),75,200),
   align:["left","center","right"].includes(raw.align)?raw.align:"left"
  };
 }
 function createBox(id,idx=0){
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error("Ungültige Textfeld-ID.");
  return normalizeBox({id,x:12+(idx%3)*8,y:46+(idx%6)*6,width:38,fontSize:100,align:"left",text:""});
 }
 function translateBox(box,dx,dy){
  const current=normalizeBox(box);
  return {...current,x:clamp(current.x+number(dx,0),0,100-current.width),y:clamp(current.y+number(dy,0),0,96)};
 }
 function resizeBox(box,dWidth){
  const current=normalizeBox(box);
  return {...current,width:clamp(current.width+number(dWidth,0),MIN_WIDTH,Math.min(MAX_WIDTH,100-current.x))};
 }
 function zoomValue(value){return clamp(value,60,240)}
 function stepZoom(value,step=1){
  const marks=[60,75,90,100,110,125,150,175,200,240];
  const z=zoomValue(value);
  if(step===0)return z;
  if(step>0)return marks.find(v=>v>z)||240;
  return [...marks].reverse().find(v=>v<z)||60;
 }
 return Object.freeze({normalizeBox,createBox,translateBox,resizeBox,zoomValue,stepZoom,MAX_BOXES});
});