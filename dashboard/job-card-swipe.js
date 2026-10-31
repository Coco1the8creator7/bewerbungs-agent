/* Landing cards are dismissed by swiping toward their outer edge:
   left column -> left; right column -> right; single column -> either.
   Determine the *rendered* column, not the array index: hidden mobile cards,
   filter changes and responsive breakpoints must not alter the meaning. */
"use strict";
(function(){
 const DISTANCE=80,DRAG_START=14,VERTICAL_CANCEL=16,DOMINANCE=1.25;

 function allowedDirection(card){
  const cardBounds=card.getBoundingClientRect?.();
  const gridBounds=card.parentElement?.getBoundingClientRect?.();
  if(!cardBounds||!gridBounds||gridBounds.width<=0||cardBounds.width<=0
    ||cardBounds.width>=gridBounds.width*.75)return "both";
  const cardCenter=cardBounds.left+cardBounds.width/2;
  const gridCenter=gridBounds.left+gridBounds.width/2;
  return cardCenter<gridCenter?"left":"right";
 }
 function bind(card,{onDismiss}={}){
  if(!card||typeof onDismiss!=="function")return;
  let pointer=null,dragging=false,suppressClick=false;
  const clearVisual=()=>{
   card.classList.remove("is-swiping");
   card.style.transform="";
   card.style.opacity="";
  };
  const cancel=()=>{
   if(pointer&&card.hasPointerCapture?.(pointer.id)){
    try{card.releasePointerCapture(pointer.id);}catch{}
   }
   pointer=null;dragging=false;clearVisual();
  };
  card.addEventListener("pointerdown",event=>{
   const type=event.pointerType;
   if(!["touch","pen","mouse"].includes(type)||event.isPrimary===false)return;
   if(type==="mouse"&&event.button!==0)return;
   // Buttons and links retain their original click / rating behaviour.
   if(event.target?.closest?.("button,a,input,textarea,select,label,summary,[contenteditable]"))return;
   pointer={id:event.pointerId,x:event.clientX,y:event.clientY,
    allowed:allowedDirection(card),wrongDirection:false};
   dragging=false;
   // Mouse capture keeps a drag alive even when it leaves the card bounds.
   if(type==="mouse"){
    try{card.setPointerCapture?.(event.pointerId);}catch{}
   }
  });
  card.addEventListener("pointermove",event=>{
   if(!pointer||event.pointerId!==pointer.id)return;
   const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
   if(!dragging&&Math.abs(dy)>VERTICAL_CANCEL&&Math.abs(dy)>Math.abs(dx)){cancel();return;}
   if(!dragging&&Math.abs(dx)>DRAG_START&&Math.abs(dx)>Math.abs(dy)*DOMINANCE){
    const direction=dx<0?"left":"right";
    if(pointer.allowed==="both"||pointer.allowed===direction)dragging=true;
    else pointer.wrongDirection=true;
   }
   if(!dragging)return;
   if(event.cancelable)event.preventDefault();
   card.classList.add("is-swiping");
   const offset=Math.max(-160,Math.min(160,dx));
   card.style.transform="translate3d("+offset+"px,0,0)";
   card.style.opacity=String(1-Math.min(.28,Math.abs(dx)/480));
  },{passive:false});
  card.addEventListener("pointerup",event=>{
   if(!pointer||event.pointerId!==pointer.id)return;
   const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
   const direction=dx<0?"left":"right";
   const shouldDismiss=dragging&&Math.abs(dx)>=DISTANCE
    &&Math.abs(dx)>Math.abs(dy)*DOMINANCE
    &&(pointer.allowed==="both"||pointer.allowed===direction);
   const consumed=dragging||pointer.wrongDirection;
   cancel();
   if(consumed){
    suppressClick=true;
    setTimeout(()=>{suppressClick=false;},0);
   }
   if(shouldDismiss)onDismiss(direction);
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
