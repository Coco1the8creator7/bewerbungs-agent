// Offline smoke checks for the shared navigation. No browser dependencies.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("dashboard/index.html","utf8");
const css=fs.readFileSync("dashboard/mode-nav.css","utf8");
const js=fs.readFileSync("dashboard/mode-nav.js","utf8");
for(const name of ["startseite","radar","dossiers","agency","profil","einstellungen"]){
 assert.match(html,new RegExp('data-mode="'+name+'"'));
 assert.match(html,new RegExp('data-mode-page="'+name+'"'));
}
assert.match(html,/id="openModeSidebar"/);
assert.match(html,/id="modeSidebar"/);
assert.match(html,/src="\.\/mode-nav\.js\?v=[^"]+"/);
assert.match(html,/href="\.\/mode-nav\.css\?v=[^"]+"/);
assert.match(html,/id="agencyWorld"/);
assert.match(html,/id="newJobsList"/);
assert.match(css,/\.mode-sidebar\.is-open/);
assert.match(js,/hashchange/);

function fakeElement(data={}){
 const handlers=new Map(),attrs=new Map();
 const classes=new Set();
 return {
  dataset:data,hidden:false,inert:false,textContent:"",
  classList:{
   toggle(name,on){if(on===undefined)on=!classes.has(name);on?classes.add(name):classes.delete(name);return on;},
   contains(name){return classes.has(name)}
  },
  addEventListener(type,fn){handlers.set(type,fn);},
  fire(type,event={}){handlers.get(type)?.(event);},
  setAttribute(name,value){attrs.set(name,String(value));},
  removeAttribute(name){attrs.delete(name);},
  getAttribute(name){return attrs.get(name)||null;},
  focus(){doc.activeElement=this;}
 };
}
const links=["startseite","radar","dossiers","agency","profil","einstellungen"].map(mode=>{
 const e=fakeElement({mode});e.textContent=mode;
 return e;
});
const pages=["startseite","radar","dossiers","agency","profil","einstellungen"].map(mode=>fakeElement({modePage:mode}));
const menu=fakeElement(),toggle=fakeElement(),close=fakeElement(),backdrop=fakeElement();
const launch=fakeElement(),oldAgency=fakeElement();
let agencyOpens=0;
oldAgency.click=()=>{agencyOpens++;};
const elements={modeSidebar:menu,openModeSidebar:toggle,closeModeSidebar:close,modeNavBackdrop:backdrop,modeLaunchAgency:launch,openAgency:oldAgency};
const documentHandlers=new Map(),windowHandlers=new Map();
const doc={
 body:fakeElement(),activeElement:null,title:"",
 getElementById:id=>elements[id]||null,
 querySelectorAll:selector=>selector===".mode-nav-link[data-mode]"?links:selector==="[data-mode-page]"?pages:[],
 addEventListener:(type,fn)=>documentHandlers.set(type,fn)
};
let scrolled=0,scrollEvents=0;
const win={
 location:{hash:""},
 scrollTo:()=>{scrolled++;},
 dispatchEvent:()=>{scrollEvents++;},
 addEventListener:(type,fn)=>windowHandlers.set(type,fn)
};
vm.runInNewContext(js,{document:doc,window:win,Event:class{constructor(type){this.type=type;}}});
assert.equal(doc.body.dataset.activeMode,"startseite");
assert.equal(pages.filter(x=>!x.hidden).length,1);
assert.equal(links[0].getAttribute("aria-current"),"page");
toggle.fire("click");
assert.equal(menu.inert,false);
assert.equal(menu.getAttribute("aria-hidden"),"false");
assert.equal(toggle.getAttribute("aria-expanded"),"true");
assert.equal(backdrop.hidden,false);
assert.equal(doc.activeElement,close);
win.location.hash="#radar";
windowHandlers.get("hashchange")();
assert.equal(doc.body.dataset.activeMode,"radar");
assert.equal(pages.filter(x=>!x.hidden)[0].dataset.modePage,"radar");
assert.equal(links[1].getAttribute("aria-current"),"page");
assert.equal(links[0].getAttribute("aria-current"),null);
links[1].fire("click");
assert.equal(menu.inert,true);
assert.equal(backdrop.hidden,true);
assert.equal(doc.activeElement,toggle);
toggle.fire("click");
documentHandlers.get("keydown")({key:"Escape",preventDefault(){}});
assert.equal(menu.inert,true);
// Sidebar Agency immediately opens the existing World instead of showing a placeholder.
win.location.hash="#radar";
windowHandlers.get("hashchange")();
toggle.fire("click");
let agencyLinkPrevented=false;
links[3].fire("click",{preventDefault(){agencyLinkPrevented=true;}});
assert.equal(agencyLinkPrevented,true);
assert.equal(agencyOpens,1);
assert.equal(menu.inert,true);
assert.equal(doc.body.dataset.activeMode,"radar");
assert.equal(win.location.hash,"#radar");
// Reopening the sidebar and selecting Agency must work repeatedly.
toggle.fire("click");
links[3].fire("click",{preventDefault(){}});
assert.equal(agencyOpens,2);
// Deep links should also open the existing World, not the intermediate screen.
win.location.hash="#agency";
windowHandlers.get("hashchange")();
assert.equal(agencyOpens,3);
assert.equal(doc.body.dataset.activeMode,"radar");
assert.equal(pages.find(x=>x.dataset.modePage==="agency").hidden,true);
win.location.hash="#profil";
windowHandlers.get("hashchange")();
assert.equal(doc.body.dataset.activeMode,"profil");
assert.equal(pages.filter(x=>!x.hidden)[0].dataset.modePage,"profil");
assert.equal(links[4].getAttribute("aria-current"),"page");
win.location.hash="#einstellungen";
windowHandlers.get("hashchange")();
assert.equal(doc.body.dataset.activeMode,"einstellungen");
assert.equal(pages.filter(x=>!x.hidden)[0].dataset.modePage,"einstellungen");
assert.equal(links[5].getAttribute("aria-current"),"page");
win.location.hash="#unbekannt";
windowHandlers.get("hashchange")();
assert.equal(doc.body.dataset.activeMode,"startseite");
assert.ok(scrolled>=3);
assert.ok(scrollEvents>=4);
// Simulate a newly deployed HTML mode with stale JavaScript navigation code.
pages.push(fakeElement({modePage:"neuer-modus"}));
win.location.hash="#startseite";
vm.runInNewContext(js,{document:doc,window:win,Event:class{constructor(type){this.type=type;}}});
assert.equal(doc.body.dataset.activeMode,"startseite");
toggle.fire("click");
assert.equal(menu.inert,false);
assert.equal(toggle.getAttribute("aria-expanded"),"true");
assert.equal(backdrop.hidden,false);
close.fire("click");
assert.equal(menu.inert,true);
win.location.hash="#neuer-modus";
windowHandlers.get("hashchange")();
assert.equal(doc.body.dataset.activeMode,"neuer-modus");
console.log("Six-mode sidebar, direct Agency World and deployment-mismatch checks passed");
