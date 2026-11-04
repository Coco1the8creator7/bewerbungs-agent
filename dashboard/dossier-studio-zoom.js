/* Career.Agency preview-only zoom: independent of persisted document state.
 * Supports paper click, double click/tap, two-finger pinch, keyboard buttons.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.CareerStudioZoom=api;
})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const marks=[60,75,90,100,110,125,150,175,200,240];
 const clamp=v=>Math.max(60,Math.min(240,Math.round(v/5)*5));
 function step(value,direction){
  const z=clamp(value);
  return direction>=0?(marks.find(x=>x>z)||240):([ ...marks ].reverse().find(x=>x<z)||60);
 }
 function init(doc){
  const scroll=doc.getElementById("previewScroll"),host=doc.getElementById("previewHost");
  const minus=doc.getElementById("zoomOut"),plus=doc.getElementById("zoomIn"),reset=doc.getElementById("zoomReset"),display=doc.getElementById("zoomValue");
  if(!scroll||!host||!minus||!plus||!reset||!display)throw Error("Dossier Studio Zoom UI ist unvollständig.");
  let zoom=100,pinch=null;
  const current=()=>host.querySelector("#a4Page,#emailPage");
  function refresh(){
   const available=Math.max(230,scroll.clientWidth-34);
   const page=host.querySelector(".page-container"),email=host.querySelector("#emailPage");
   if(page){page.style.width=Math.min(794,available)+"px";page.style.maxWidth="none";page.style.zoom=String(zoom/100);}
   if(email){email.style.width=Math.min(720,available)+"px";email.style.maxWidth="none";email.style.zoom=String(zoom/100);}
   display.textContent=zoom+" %";minus.disabled=zoom<=60;plus.disabled=zoom>=240;
  }
  function set(value,point){
   const next=clamp(value);if(next===zoom)return;
   const target=current(),rect=target?.getBoundingClientRect();
   const viewport=scroll.getBoundingClientRect();
   const anchor=point||{clientX:viewport.left+scroll.clientWidth/2,clientY:viewport.top+scroll.clientHeight/2};
   const fx=rect?Math.max(0,Math.min(1,(anchor.clientX-rect.left)/rect.width)):.5;
   const fy=rect?Math.max(0,Math.min(1,(anchor.clientY-rect.top)/rect.height)):.5;
   zoom=next;refresh();
   const raf=doc.defaultView?.requestAnimationFrame||((cb)=>cb());
   raf(()=>{
    if(!target?.isConnected)return;
    const nr=target.getBoundingClientRect();
    scroll.scrollLeft+=nr.left+fx*nr.width-anchor.clientX;
    scroll.scrollTop+=nr.top+fy*nr.height-anchor.clientY;
   });
  }
  minus.addEventListener("click",()=>set(step(zoom,-1)));
  plus.addEventListener("click",()=>set(step(zoom,1)));
  reset.addEventListener("click",()=>set(100));
  host.addEventListener("click",event=>{
   const page=event.target.closest?.("#a4Page");
   if(!page||event.detail>1||event.target.closest("button,[contenteditable],input,select,textarea,.free-text-box"))return;
   if(event.target===page||event.target.matches(".cv-columns,.column-main,.column-side"))
    set(step(zoom,1),event);
  });
  host.addEventListener("dblclick",event=>{
   if(!event.target.closest?.("#a4Page")||event.target.closest("button,[contenteditable],.free-text-drag,.free-text-resize"))return;
   event.preventDefault();set(step(zoom,1),event);
  });
  host.addEventListener("touchstart",event=>{
   if(!event.target.closest?.("#a4Page")||event.touches.length!==2){pinch=null;return;}
   const [a,b]=event.touches;
   pinch={distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),base:zoom};
  },{passive:true});
  host.addEventListener("touchmove",event=>{
   if(!pinch||event.touches.length!==2)return;
   const [a,b]=event.touches;
   if(!pinch.distance)return;
   event.preventDefault();
   set(pinch.base*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/pinch.distance,
    {clientX:(a.clientX+b.clientX)/2,clientY:(a.clientY+b.clientY)/2});
  },{passive:false});
  host.addEventListener("touchend",event=>{if(event.touches.length<2)pinch=null;},{passive:true});
  doc.defaultView?.addEventListener("resize",refresh);
  refresh();
  return Object.freeze({refresh,set,get value(){return zoom}});
 }
 return Object.freeze({init,step,clamp});
});