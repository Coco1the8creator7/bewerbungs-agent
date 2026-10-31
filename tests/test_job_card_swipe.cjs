// Regression: column-aware outward swipes are explicit, reversible and accessible.
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
assert.match(html,/job-card-swipe\.js\?v=20261031-2/);
assert.match(html,/Auf dem Smartphone nach links oder rechts wischen/);
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
assert.match(cards,/window\.CareerJobSwipe\?\.bind\(card,\{onDismiss:direction=>dismissLandingJob\(j\.id,direction==="right"\?"swipe_right":"swipe_left"\)\}\)/);
assert.match(cards,/dismissLandingJob\(j\.id,"button"\)/);
assert.match(cards,/restoreLandingJob\(j\.id\)/);
assert.match(cards,/card\.append\(dismissControl\)/);
assert.match(cards,/openDetails\(j\.id\)/);
assert.match(html,/\["viewDismissed","dismissed"\]/);
assert.match(github,/\["dismissals","id"\]/);
// Exercise the real three-way GitHub feedback merge without network calls.
const syncContext={window:{}};
vm.runInNewContext(github.replace("window.GithubFeedback=Object.freeze({getToken,setToken,clearToken,loadPublic,save});",
 "window.__mergeForTest=merge;"),syncContext);
const merge=syncContext.window.__mergeForTest;
const oldFeedback={type:"bewerbungs-agent-feedback",schema_version:"1.0.0",
 annotations:[],relevance_ratings:[],export_selection:[],overrides:[],manual_jobs:[],activity_log:[]};
const first={id:"job-1",signal:"not_interested",source:"swipe_left",dismissed_at:"2026-10-31T15:00:00Z"};
const second={id:"job-2",signal:"not_interested",source:"button",dismissed_at:"2026-10-31T16:00:00Z"};
const result=merge(oldFeedback,{...oldFeedback,dismissals:[first]},oldFeedback);
assert.equal(JSON.stringify(result.dismissals),JSON.stringify([first]),
 "new dismissals must merge with old feedback files lacking the field");
const updated=merge({...oldFeedback,dismissals:[first]},
 {...oldFeedback,dismissals:[first,second]},{...oldFeedback,dismissals:[first]});
assert.equal(updated.dismissals.length,2);
const deleted=merge({...oldFeedback,dismissals:[first,second]},
 {...oldFeedback,dismissals:[second]},{...oldFeedback,dismissals:[first,second]});
assert.equal(deleted.dismissals.length,1,"undo must remove the stored signal on sync");
assert.equal(deleted.dismissals[0].id,"job-2");
assert.throws(()=>merge({...oldFeedback,dismissals:[first]},
 {...oldFeedback,dismissals:[{...first,source:"button"}]},
 {...oldFeedback,dismissals:[{...first,dismissed_at:"2026-10-30T15:00:00Z"}]}),
 /Konflikt/,"conflicting edits must not silently overwrite one another");
assert.match(css,/touch-action:pan-y/);
assert.match(css,/\.job-swipe-undo\[hidden\]/);
assert.match(css,/@media\(max-width:650px\)/);
assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(/,"swipe handler must not bypass explicit privacy/storage rules");

// Rendered column geometry, not array index, governs the allowed swipe direction.
class FakeCard{
 constructor({left=0,width=280,gridLeft=0,gridWidth=600}={}){
  this.left=left;this.width=width;this.gridLeft=gridLeft;this.gridWidth=gridWidth;
  this.parentElement={getBoundingClientRect:()=>({left:this.gridLeft,width:this.gridWidth})};
  this.events=new Map();this.style={};this.captureId=null;
  this.classList={flags:new Set(),add:x=>this.classList.flags.add(x),remove:x=>this.classList.flags.delete(x)};
 }
 getBoundingClientRect(){return {left:this.left,width:this.width};}
 addEventListener(name,fn){const a=this.events.get(name)||[];a.push(fn);this.events.set(name,a);}
 setPointerCapture(id){this.captureId=id;}
 hasPointerCapture(id){return this.captureId===id;}
 releasePointerCapture(id){if(this.captureId===id)this.captureId=null;}
 fire(name,props={}){
  const e={pointerType:"touch",pointerId:1,isPrimary:true,button:0,clientX:150,clientY:120,
   cancelable:true,prevented:false,preventDefault(){this.prevented=true;},
   stopImmediatePropagation(){this.stopped=true;},target:{closest:()=>null},...props};
  for(const fn of this.events.get(name)||[])fn(e);return e;
 }
}
const context={window:{},setTimeout:()=>0};
vm.runInNewContext(source,context);
const bind=context.window.CareerJobSwipe.bind;
assert.equal(typeof bind,"function");
function sequence(card,points,additional={}){
 card.fire("pointerdown",{clientX:points[0][0],clientY:points[0][1],...additional});
 for(const [x,y] of points.slice(1,-1))card.fire("pointermove",{clientX:x,clientY:y,...additional});
 const [x,y]=points[points.length-1];return card.fire("pointerup",{clientX:x,clientY:y,...additional});
}
const left=new FakeCard({left:0,width:280,gridWidth:600});
const leftDismissals=[];
bind(left,{onDismiss:d=>leftDismissals.push(d)});
// Natural vertical scroll is never an action.
sequence(left,[[150,120],[148,150],[146,220]]);
assert.equal(leftDismissals.length,0);
assert.equal(left.style.transform,"");
// Rightward gesture on left column is not a dismissal and cannot open details accidentally.
sequence(left,[[150,120],[190,123],[260,123]]);
assert.equal(leftDismissals.length,0);
assert.equal(left.fire("click").prevented,true);
// Short left drag resets instead of dismissing.
sequence(left,[[150,120],[118,122],[105,123]]);
assert.equal(leftDismissals.length,0);
assert.equal(left.style.transform,"");
// Leftward drag over threshold triggers exactly one event.
sequence(left,[[150,120],[105,123],[60,125]]);
assert.equal(leftDismissals.length,1);
assert.equal(leftDismissals[0],"left");
assert.equal(left.fire("click").stopped,true);
// Simple taps still open the card.
left.fire("pointerdown",{clientX:150,clientY:120});
left.fire("pointerup",{clientX:150,clientY:120});
assert.equal(left.fire("click").prevented,false);
// Interactive rating buttons and links retain their normal controls.
for(const tag of ["BUTTON","A","INPUT"]){
 left.fire("pointerdown",{clientX:150,target:{closest:()=>({tagName:tag})}});
 left.fire("pointermove",{clientX:30,clientY:121});
 left.fire("pointerup",{clientX:30,clientY:121});
 assert.equal(leftDismissals.length,1);
}
// Cancelled gestures never dismiss.
left.fire("pointerdown",{clientX:150,clientY:120});
left.fire("pointermove",{clientX:40,clientY:121});
left.fire("pointercancel");
left.fire("pointerup",{clientX:20,clientY:121});
assert.equal(leftDismissals.length,1);

const right=new FakeCard({left:320,width:280,gridWidth:600});
const rightDismissals=[];
bind(right,{onDismiss:d=>rightDismissals.push(d)});
sequence(right,[[150,120],[105,122],[60,124]]);
assert.equal(rightDismissals.length,0,"leftward on the right column is ignored");
assert.equal(right.fire("click").prevented,true);
const moved=right.fire("pointerdown",{clientX:150,clientY:120});
right.fire("pointermove",{clientX:205,clientY:122});
assert.match(right.style.transform,/translate3d\(55px/,"rightward drag animates in the correct direction");
right.fire("pointerup",{clientX:245,clientY:124});
assert.deepEqual(rightDismissals,["right"]);
assert.equal(right.style.transform,"","drag styling clears after dismissal");
// Mouse dragging is supported in a two-column desktop view, not just touch.
sequence(right,[[150,120],[190,121],[251,123]],{pointerType:"mouse",button:0});
assert.equal(rightDismissals.length,2);
assert.equal(rightDismissals[1],"right");
assert.equal(right.captureId,null);
// A secondary mouse button never initiates dismissal.
sequence(right,[[150,120],[215,121],[255,123]],{pointerType:"mouse",button:2});
assert.equal(rightDismissals.length,2);

// In the single-column mobile layout, either swipe direction dismisses.
const mobile=new FakeCard({left:0,width:560,gridWidth:560});
const mobileDismissals=[];
bind(mobile,{onDismiss:d=>mobileDismissals.push(d)});
sequence(mobile,[[150,120],[105,121],[60,123]]);
sequence(mobile,[[150,120],[200,121],[245,123]]);
assert.deepEqual(mobileDismissals,["left","right"]);

// The direction is based on CURRENT position after responsive layout changes.
const movedColumn=new FakeCard({left:0,width:280,gridWidth:600});
const movedDismissals=[];
bind(movedColumn,{onDismiss:d=>movedDismissals.push(d)});
sequence(movedColumn,[[150,120],[105,123],[60,125]]);
movedColumn.left=320;
sequence(movedColumn,[[150,120],[205,123],[245,125]]);
assert.deepEqual(movedDismissals,["left","right"]);

// Rejected gesture on vertically moving content remains a scroll, in either column.
sequence(right,[[150,120],[152,170],[251,240]]);
assert.equal(rightDismissals.length,2);
assert.match(source,/getBoundingClientRect/);
assert.doesNotMatch(source,/indexOf\(card\)|children\.indexOf/,"position must not depend on collection ordering");
console.log("Swipe-to-dismiss gesture, feedback persistence and recovery contract checks passed");
