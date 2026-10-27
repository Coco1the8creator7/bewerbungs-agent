// Regression tests: moved Agency status overview and accessible notification bell.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const html=fs.readFileSync("dashboard/index.html","utf8");
const style=fs.readFileSync("dashboard/notifications.css","utf8");
const agencyStyle=fs.readFileSync("dashboard/agency-theme-beige.css","utf8");
assert.match(html,/id="notificationBell"/);
assert.match(html,/id="notificationPanel"/);
assert.match(html,/id="notificationBadge"/);
assert.match(html,/notifications.js\?v=/);
assert.match(html,/notifications.css\?v=/);
assert.match(style,/\.notification-panel\[hidden\]/);
assert.match(agencyStyle,/\.agency-world \.agency-status-overview/);

const world=html.indexOf('id="agencyWorld"');
const islandMap=html.indexOf('id="agencyMap"');
const inspector=html.indexOf('id="agencyInspector"');
const status=html.indexOf('class="section agency-status-overview"');
const weekly=html.indexOf('class="agency-weekly-missions"');
assert.ok(world>=0&&islandMap>world&&inspector>islandMap&&status>inspector&&weekly>status,
 "Agency status must follow islands and precede weekly goals");
for(const id of ["newCount","newCountWindow","unratedCount","reviewTotalCount","declinedNewCount"]){
 assert.equal(html.split('id="'+id+'"').length-1,1,id+" occurs exactly once");
}
assert.ok(html.indexOf('id="mode-startseite"')<world,"home page exists");
assert.ok(html.indexOf('id="notificationBell"')<html.indexOf('id="mode-startseite"'),"bell in header");
assert.match(html,/window\.CareerNotifications\?\.update\(\{newArrivals,declinedRecent,windowLabel:incomingWindow\.label,demoMode\}\)/);

class FakeEl{
 constructor(name="div"){
  this.name=name;this.hidden=false;this.children=[];this.textContent="";
  this.events={};this.attributes={};this.focused=false;
 }
 addEventListener(kind,fn){(this.events[kind]??=[]).push(fn);}
 fire(kind,event={}){for(const fn of this.events[kind]??[])fn(event);}
 setAttribute(key,value){this.attributes[key]=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];}
 focus(){this.focused=true;}
}
const els={};
for(const id of ["notificationBell","notificationPanel","notificationBadge","notificationList",
 "notificationEmpty","notificationContext","notificationClose"]){els[id]=new FakeEl(id);}
els.notificationPanel.hidden=true;
els.notificationBadge.hidden=true;
const root=new FakeEl("notificationRoot");
root.contains=target=>[els.notificationBell,els.notificationPanel,els.notificationClose].includes(target);
const document={
 getElementById:id=>els[id],
 querySelector:query=>query===".career-header-notifications"?root:null,
 createElement:name=>new FakeEl(name),
 addEventListener(kind,fn){(this.events[kind]??=[]).push(fn);},
 events:{},
 fire(kind,event){for(const fn of this.events[kind]??[])fn(event);}
};
const window={
 events:{},
 addEventListener(kind,fn){(this.events[kind]??=[]).push(fn);},
 fire(kind,event){for(const fn of this.events[kind]??[])fn(event);}
};
const source=fs.readFileSync("dashboard/notifications.js","utf8");
vm.runInNewContext(source,{window,document});
assert.equal(typeof window.CareerNotifications?.update,"function");
assert.equal(els.notificationBadge.hidden,true,"initially no badge");
assert.equal(els.notificationEmpty.hidden,false,"initial empty state visible");

window.CareerNotifications.update({
 newArrivals:29,declinedRecent:1,windowLabel:"Seit letztem Besuch",demoMode:false
});
assert.equal(els.notificationBadge.hidden,false);
assert.equal(els.notificationBadge.textContent,"30","badge shows underlying event total, not categories");
assert.equal(els.notificationList.children.length,2);
assert.equal(els.notificationList.children[0].children[1].children[0].textContent,"29 neue Stelleninserate");
assert.equal(els.notificationList.children[1].children[1].children[0].textContent,"1 Absage erhalten");
assert.match(els.notificationList.children[0].children[1].children[1].textContent,/Seit letztem Besuch/);
assert.match(els.notificationList.children[1].children[1].children[1].textContent,/7 Tage/);

els.notificationBell.fire("click");
assert.equal(els.notificationPanel.hidden,false);
assert.equal(els.notificationBell.getAttribute("aria-expanded"),"true");
assert.equal(els.notificationClose.focused,true);
document.fire("pointerdown",{target:els.notificationPanel});
assert.equal(els.notificationPanel.hidden,false,"inside clicks do not dismiss");
document.fire("keydown",{key:"Escape",preventDefault(){}});
assert.equal(els.notificationPanel.hidden,true,"Escape dismisses");
assert.equal(els.notificationBell.getAttribute("aria-expanded"),"false");
els.notificationBell.fire("click");
document.fire("pointerdown",{target:new FakeEl("outside")});
assert.equal(els.notificationPanel.hidden,true,"outside click dismisses");
els.notificationBell.fire("click");
window.fire("hashchange");
assert.equal(els.notificationPanel.hidden,true,"navigation dismisses");

window.CareerNotifications.update({newArrivals:0,declinedRecent:0});
assert.equal(els.notificationBadge.hidden,true,"no badge when no current events");
assert.equal(els.notificationList.children.length,0);
assert.equal(els.notificationEmpty.hidden,false);
window.CareerNotifications.update({newArrivals:120,declinedRecent:2,demoMode:true});
assert.equal(els.notificationBadge.textContent,"99+","large badge is capped visually");
assert.match(els.notificationContext.textContent,/Demomodus/);
window.CareerNotifications.update({newArrivals:-4.5,declinedRecent:NaN});
assert.equal(els.notificationBadge.hidden,true,"invalid counts cannot generate fake notifications");
console.log("Agency status location and notification UI checks passed");
