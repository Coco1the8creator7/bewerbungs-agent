/* Landing-page notifications: current CRM facts, no inferred unread state or push subscriptions. */
(function(){
 "use strict";
 const bell=document.getElementById("notificationBell");
 const panel=document.getElementById("notificationPanel");
 const badge=document.getElementById("notificationBadge");
 const list=document.getElementById("notificationList");
 const empty=document.getElementById("notificationEmpty");
 const context=document.getElementById("notificationContext");
 const closeButton=document.getElementById("notificationClose");
 const root=document.querySelector(".career-header-notifications");
 if(!bell||!panel||!badge||!list||!empty||!context||!closeButton||!root)return;

 let lastSignature=null;
 const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;

 function close(restoreFocus=false){
  if(panel.hidden)return;
  panel.hidden=true;
  bell.setAttribute("aria-expanded","false");
  if(restoreFocus)bell.focus({preventScroll:true});
 }
 function notice(icon,title,description,kind){
  const item=document.createElement("div");
  item.className="notification-item notification-"+kind;
  const mark=document.createElement("span");
  mark.className="notification-item-icon";
  mark.setAttribute("aria-hidden","true");
  mark.textContent=icon;
  const copy=document.createElement("div");
  copy.className="notification-item-copy";
  const heading=document.createElement("strong");
  heading.textContent=title;
  const detail=document.createElement("small");
  detail.textContent=description;
  copy.append(heading,detail);
  item.append(mark,copy);
  return item;
 }
 function update({newArrivals=0,declinedRecent=0,windowLabel="Seit gestern",demoMode=false}={}){
  const newJobs=count(newArrivals),declines=count(declinedRecent);
  const signature=[newJobs,declines,windowLabel,demoMode].join("|");
  if(signature===lastSignature)return;
  lastSignature=signature;
  const total=newJobs+declines;
  badge.hidden=total===0;
  badge.textContent=total>99?"99+":String(total);
  bell.setAttribute("aria-label",total
   ?"Benachrichtigungen öffnen: "+newJobs+" neue Inserate, "+declines+" Absagen in den letzten 7 Tagen"
   :"Benachrichtigungen öffnen: keine aktuellen Hinweise");
  context.textContent=demoMode?"Demomodus · keine echten Bewerbungsereignisse":"Aktuelle Hinweise aus deinen Bewerbungsdaten";
  list.replaceChildren();
  if(newJobs>0)list.append(notice("✦",
   newJobs===1?"1 neues Stelleninserat":newJobs+" neue Stelleninserate",
   windowLabel||"Seit gestern","jobs"));
  if(declines>0)list.append(notice("!",
   declines===1?"1 Absage erhalten":declines+" Absagen erhalten",
   "Statusänderungen der letzten 7 Tage","declines"));
  empty.hidden=total>0;
 }
 bell.addEventListener("click",()=>{
  if(!panel.hidden){close(true);return;}
  panel.hidden=false;
  bell.setAttribute("aria-expanded","true");
  closeButton.focus({preventScroll:true});
 });
 closeButton.addEventListener("click",()=>close(true));
 document.addEventListener("pointerdown",event=>{
  if(!panel.hidden&&!root.contains(event.target))close();
 });
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&!panel.hidden){
   event.preventDefault();
   close(true);
  }
 });
 window.addEventListener("hashchange",()=>close());
 update();
 window.CareerNotifications=Object.freeze({update});
})();
