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

 const SOURCE=/^(?:data:(?:name|role|contact|title|greeting)|section:[A-Za-z0-9_-]{1,80})$/;
 function normalizeFrame(raw){
  const base=normalizeBox(raw);
  return {...base,
   text:typeof raw?.text==="string"?raw.text.slice(0,20000):"",
   source:typeof raw?.source==="string"&&SOURCE.test(raw.source)?raw.source:"",
   visible:raw?.visible!==false,
   z:clamp(number(raw?.z,0),0,10000),
   wrap:["square","top-bottom","front","behind"].includes(raw?.wrap)?raw.wrap:"square"
  };
 }
 function rectangle(left,top,width,height){
  const x=Number(left)||0,y=Number(top)||0,w=Math.max(0,Number(width)||0),h=Math.max(0,Number(height)||0);
  return {left:x,top:y,right:x+w,bottom:y+h,width:w,height:h};
 }
 function textExclusion(target,blocker,mode="square",padding=6){
  if(!target||!blocker||mode==="front"||mode==="behind")return null;
  const left=Math.max(target.left,blocker.left),right=Math.min(target.right,blocker.right);
  const top=Math.max(target.top,blocker.top),bottom=Math.min(target.bottom,blocker.bottom);
  if(right<=left||bottom<=top)return null;
  const gap=Math.max(0,Number(padding)||0);
  const y=Math.max(0,top-target.top-gap);
  const height=Math.min(target.height-y,Math.max(0,bottom-target.top+gap-y));
  if(height<=0)return null;
  const width=target.width;
  if(mode==="top-bottom"){
   return {side:"left",x:0,y,width,height,mode};
  }
  const availableLeft=Math.max(0,blocker.left-target.left-gap);
  const availableRight=Math.max(0,target.right-blocker.right-gap);
  if(availableLeft<10&&availableRight<10)
   return {side:"left",x:0,y,width,height,mode:"top-bottom"};
  // CSS float wrapping uses the larger corridor, as in Word's 'largest side'.
  if(availableRight>=availableLeft){
   return {side:"left",x:0,y,width:Math.min(width,blocker.right-target.left+gap),height,mode};
  }
  return {side:"right",x:width-Math.min(width,target.right-blocker.left+gap),y,
   width:Math.min(width,target.right-blocker.left+gap),height,mode};
 }
 function exclusionsForFrame(target,ordered,rectangles,padding=6){
  const t=rectangles?.[target.id];if(!t)return [];
  const index=ordered.findIndex(item=>item.id===target.id);
  if(index<0)return [];
  return ordered.slice(index+1).filter(item=>item?.wrap!=="front"&&item?.wrap!=="behind")
   .map(item=>textExclusion(t,rectangles[item.id],item.wrap||"square",padding))
   .filter(Boolean).sort((a,b)=>a.y-b.y);
 }
 return Object.freeze({normalizeBox,normalizeFrame,rectangle,textExclusion,exclusionsForFrame,createBox,translateBox,resizeBox,zoomValue,stepZoom,MAX_BOXES});
});