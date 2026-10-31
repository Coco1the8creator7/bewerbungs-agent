/* Mobile swipe-to-dismiss for individual landing job cards.
   A deliberate leftwards, predominantly horizontal gesture is required.
   Vertical scrolling, taps and interactive keyboard controls are preserved. */
"use strict";
(function(){
 const DISTANCE=80,DRAG_START=14,VERTICAL_CANCEL=16;
 function bind(card,{onDismiss}={}){
  if(!card||typeof onDismiss!=="function")return;
  let pointer=null,dragging=false,suppressClick=false;
  const clearVisual=()=>{
   card.classList.remove("is-swiping");
   card.style.transform="";
   card.style.opacity="";
  };
  const cancel=()=>{pointer=null;dragging=false;clearVisual();};
  card.addEventListener("pointerdown",event=>{
   if(event.pointerType!=="touch"&&event.pointerType!=="pen")return;
   if(event.isPrimary===false)return;
   if(event.target?.closest?.("input,textarea,select,[contenteditable]"))return;
   pointer={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0};
   dragging=false;
  });
  card.addEventListener("pointermove",event=>{
   if(!pointer||event.pointerId!==pointer.id)return;
   const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
   pointer.dx=dx;pointer.dy=dy;
   if(!dragging&&Math.abs(dy)>VERTICAL_CANCEL&&Math.abs(dy)>Math.abs(dx)){cancel();return;}
   if(dx< -DRAG_START&&Math.abs(dx)>Math.abs(dy)*1.25)dragging=true;
   if(!dragging)return;
   if(event.cancelable)event.preventDefault();
   card.classList.add("is-swiping");
   card.style.transform="translate3d("+Math.max(-160,Math.min(0,dx))+"px,0,0)";
   card.style.opacity=String(1-Math.min(.28,Math.abs(dx)/480));
  },{passive:false});
  card.addEventListener("pointerup",event=>{
   if(!pointer||event.pointerId!==pointer.id)return;
   const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
   const shouldDismiss=dragging&&dx<=-DISTANCE&&Math.abs(dx)>Math.abs(dy)*1.25;
   const wasDrag=dragging;
   cancel();
   if(wasDrag){
    suppressClick=true;
    setTimeout(()=>{suppressClick=false;},0);
   }
   if(shouldDismiss)onDismiss();
  });
  card.addEventListener("pointercancel",cancel);
  card.addEventListener("click",event=>{
   if(!suppressClick)return;
   suppressClick=false;
   event.preventDefault();
   event.stopImmediatePropagation();
  },true);
 }
 window.CareerJobSwipe=Object.freeze({bind});
})();
