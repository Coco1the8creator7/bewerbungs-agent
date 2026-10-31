// Regression: swipe-left dismissal is explicit, reversible and accessible.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const html=fs.readFileSync("dashboard/index.html","utf8");
const css=fs.readFileSync("dashboard/job-card-swipe.css","utf8");
const github=fs.readFileSync("dashboard/github-sync.js","utf8");
const source=fs.readFileSync("dashboard/job-card-swipe.js","utf8");
const cards=html.slice(html.indexOf("function renderNewJobs(){"),html.indexOf("\nfunction render(){",html.indexOf("function renderNewJobs(){")));
assert.match(html,/id="viewDismissed"/);
assert.match(html,/id="swipeUndoToast"/);
assert.match(html,/id="swipeUndoButton"/);
assert.match(html,/job-card-swipe\.js\?v=/);
assert.match(html,/job-card-swipe\.css\?v=/);
assert.match(html,/const dismissedJobFeedback=new Map\(\)/);
assert.match(html,/function validateDismissals\(records\)/);
assert.match(html,/dismissals:\[\.\.\.dismissedJobFeedback\.entries\(\)\]/);
assert.match(html,/dismissals:state\.dismissals/);
assert.match(html,/dismissed=validateDismissals\(data\.dismissals\)/);
assert.match(html,/dismissedJobFeedback\.clear\(\);for\(const \[id,entry\] of dismissed\)/);
assert.match(html,/dismissedJobFeedback\.clear\(\);for\(const \[id,v\] of dismissed\)/);
assert.match(html,/function buildRelevancePayload\(\)/);
assert.match(html,/signal:value\.signal,source:value\.source,dismissed_at:value\.dismissed_at/);
assert.match(cards,/window\.CareerJobSwipe\?\.bind\(card,\{onDismiss:\(\)=>dismissLandingJob\(j\.id,"swipe_left"\)\}\)/);
assert.match(cards,/dismissLandingJob\(j\.id,"button"\)/);
assert.match(cards,/restoreLandingJob\(j\.id\)/);
assert.match(cards,/card\.append\(dismissControl\)/);
assert.match(cards,/openDetails\(j\.id\)/);
assert.match(html,/\["viewDismissed","dismissed"\]/);
assert.match(github,/\["dismissals","id"\]/);
assert.match(css,/touch-action:pan-y/);
assert.match(css,/\.job-swipe-undo\[hidden\]/);
assert.match(css,/@media\(max-width:650px\)/);
assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(/,"swipe handler must not bypass explicit privacy/storage rules");

class FakeCard{
 constructor(){this.events=new Map();this.style={};this.classList={flags:new Set(),add:x=>this.classList.flags.add(x),remove:x=>this.classList.flags.delete(x)};}
 addEventListener(name,fn){const a=this.events.get(name)||[];a.push(fn);this.events.set(name,a);}
 fire(name,props={}){const e={pointerType:"touch",pointerId:1,isPrimary:true,clientX:150,clientY:120,
   cancelable:true,prevented:false,preventDefault(){this.prevented=true;},
   stopImmediatePropagation(){this.stopped=true;},target:{closest:()=>null},...props};
  for(const fn of this.events.get(name)||[])fn(e);return e;}
}
const context={window:{},setTimeout:()=>0};
vm.runInNewContext(source,context);
const bind=context.window.CareerJobSwipe.bind;
assert.equal(typeof bind,"function");
let dismissed=0;
const card=new FakeCard();bind(card,{onDismiss:()=>dismissed++});
function sequence(points){card.fire("pointerdown",{clientX:points[0][0],clientY:points[0][1]});
 for(const [x,y] of points.slice(1,-1))card.fire("pointermove",{clientX:x,clientY:y});
 const [x,y]=points[points.length-1];return card.fire("pointerup",{clientX:x,clientY:y});}
// Vertical scroll must not dismiss.
sequence([[150,120],[148,150],[146,220]]);
assert.equal(dismissed,0);
assert.equal(card.style.transform,"");
// Right swipe must not dismiss.
sequence([[150,120],[190,123],[260,123]]);
assert.equal(dismissed,0);
// Short drag must reset without dismissing.
sequence([[150,120],[118,122],[105,123]]);
assert.equal(dismissed,0);
assert.equal(card.style.transform,"");
// Left swipe over threshold triggers exactly one dismissal.
sequence([[150,120],[105,123],[60,125]]);
assert.equal(dismissed,1);
const click=card.fire("click");
assert.equal(click.prevented,true,"drag must suppress the next synthetic card click");
assert.equal(click.stopped,true);
// Normal tap remains a normal click.
card.fire("pointerdown",{clientX:150,clientY:120});
card.fire("pointerup",{clientX:150,clientY:120});
assert.equal(card.fire("click").prevented,false);
// Swipes beginning at form controls are ignored.
card.fire("pointerdown",{clientX:150,target:{closest:()=>({tagName:"INPUT"})}});
card.fire("pointermove",{clientX:30,clientY:121});
card.fire("pointerup",{clientX:30,clientY:121});
assert.equal(dismissed,1);
// Cancelled gestures do not dismiss.
card.fire("pointerdown",{clientX:150,clientY:120});
card.fire("pointermove",{clientX:40,clientY:121});
card.fire("pointercancel");
card.fire("pointerup",{clientX:20,clientY:121});
assert.equal(dismissed,1);
console.log("Swipe-to-dismiss gesture, feedback persistence and recovery contract checks passed");
