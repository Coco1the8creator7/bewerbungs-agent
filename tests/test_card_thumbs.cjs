// Bottom score + explicit positive/negative quick feedback: data and UI regression.
"use strict";
async function run(){
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("authservice/mission-control.html","utf8");
const styles=fs.readFileSync("dashboard/landing-thumbs.css","utf8");
const gh=fs.readFileSync("dashboard/github-sync.js","utf8");
const segment=html.slice(html.indexOf("function renderNewJobs(){"),html.indexOf("\nfunction render(){",html.indexOf("function renderNewJobs(){")));
assert.match(html,/id="viewInterested"/);
assert.match(html,/positive_feedback:\[\.\.\.positiveJobFeedback\.entries\(\)\]/);
assert.match(html,/positive_feedback:state\.positive_feedback/);
assert.match(html,/function validatePositiveFeedback\(records\)/);
assert.match(html,/positive_feedback:\[\.\.\.positiveJobFeedback\.entries\(\)\]\.filter/);
assert.match(html,/positiveJobFeedback\.clear\(\);for\(const \[id,v\] of positives\)/);
assert.match(html,/positiveJobFeedback\.clear\(\);for\(const \[id,entry\] of positives\)/);
assert.match(html,/function interestedLandingJobs\(\)/);
assert.match(html,/signal:"interested",source:"thumb_up"/);
assert.match(html,/persistSwipeChoice\(id,record\)/);
assert.match(html,/persistSwipeChoice\(id,\{signal:"restored",restored_at:/);
assert.match(segment,/footer\.append\(cardRatingButton\(j\)\)/);
assert.match(segment,/quickActions\.append\(cardThumbButton\(j,true\),cardThumbButton\(j,false\)\)/);
assert.doesNotMatch(segment,/card\.append\(tags\)|className="tags"|className="card-dismiss-button"/);
assert.match(segment,/window\.CareerJobSwipe\?\.bind\(card/);
assert.match(segment,/secretDossierButton\(j\)/);
assert.match(styles,/\.card-thumb-up/);
assert.match(styles,/\.card-thumb-down/);
assert.match(styles,/\.card-thumb:focus-visible/);
assert.match(styles,/width:46px/);
assert.doesNotMatch(gh,/api.github.com/);

// Validate explicit signals and backward compatibility with older feedback.
const validateStart=html.indexOf("function validatePositiveFeedback(records){");
const validateEnd=html.indexOf("function validateSwipeChoices(data){",validateStart);
assert.ok(validateStart>0&&validateEnd>validateStart);
const validator=vm.runInNewContext(html.slice(validateStart,validateEnd)+"\nvalidatePositiveFeedback",{
 Date,Map,Error,Array,
 validDate:iso=>typeof iso==="string"&&Number.isFinite(Date.parse(iso))?Date.parse(iso):null
});
const at="2026-11-04T12:30:00.000Z";
assert.equal(validator(null).size,0);
assert.equal(validator([{id:"job-1",signal:"interested",source:"thumb_up",marked_at:at}]).get("job-1").signal,"interested");
assert.throws(()=>validator([{id:"job-1",signal:"interested",source:"thumb_up",marked_at:"bad"}]),/Ungültige/);
assert.throws(()=>validator([{id:"job-1",signal:"not_interested",source:"thumb_up",marked_at:at}]),/Ungültige/);

class FakeButton{
 constructor(){this.attrs={};this.listeners={};this.disabled=false;this.innerHTML="";this.className="";this.title="";}
 setAttribute(key,value){this.attrs[key]=String(value);}
 addEventListener(type,fn){this.listeners[type]=fn;}
 click(){return this.listeners.click?.();}
}
async function flush(){await Promise.resolve();await Promise.resolve();}
const job={id:"job-1",title:"Energiespezialist"};
const positiveJobFeedback=new Map(),dismissedJobFeedback=new Map();
const persisted=[],notice={textContent:"",hidden:true},undo={hidden:true};
let renderCount=0,workspaceSaves=0,negativeSource=null,view="unrated";
const context={jobs:[job],positiveJobFeedback,dismissedJobFeedback,
 Date,Promise,String,Error,Map,
 persistSwipeChoice(id,record){persisted.push({id,...record});return Promise.resolve()},
 saveChanges(){workspaceSaves++},
 render(){renderCount++},
 swipeStorageWarning(){throw Error("Unexpected persistence warning")},
 document:{createElement:()=>new FakeButton()},
 el:id=>({swipeUndoText:notice,swipeUndoToast:undo})[id],
 dismissLandingJob(id,source){negativeSource=source;positiveJobFeedback.delete(id);dismissedJobFeedback.set(id,{signal:"not_interested"});return true},
 hasReviewFeedback:()=>false,
 get reviewListView(){return view},set reviewListView(v){view=v}
};
const funcsStart=html.indexOf("function markLandingJobInteresting(id){");
const funcsEnd=html.indexOf('el("swipeUndoButton").addEventListener',funcsStart);
assert.ok(funcsStart>=0&&funcsEnd>funcsStart);
const funcs=vm.runInNewContext(html.slice(funcsStart,funcsEnd)+"\n({markLandingJobInteresting,restoreInterestingJob,cardThumbButton})",context);
assert.equal(funcs.markLandingJobInteresting(job.id),true);
await flush();
assert.equal(funcs.markLandingJobInteresting(job.id),false,"no double positive reaction");
assert.equal(positiveJobFeedback.get(job.id).signal,"interested");
assert.equal(persisted[0].source,"thumb_up");
assert.equal(persisted[0].signal,"interested");
assert.equal(undo.hidden,false);
assert.ok(renderCount>0);
const up=funcs.cardThumbButton(job,true);
const down=funcs.cardThumbButton(job,false);
assert.match(up.innerHTML,/<svg/);
assert.match(down.innerHTML,/<svg/);
assert.match(up.attrs["aria-label"],/zurücknehmen/);
assert.match(down.attrs["aria-label"],/Nicht interessant/);
assert.equal(up.attrs["aria-pressed"],"true");
assert.equal(funcs.restoreInterestingJob(job.id),true);
await flush();
assert.equal(positiveJobFeedback.size,0);
assert.equal(view,"unrated");
assert.equal(persisted.at(-1).signal,"restored");
assert.equal(funcs.restoreInterestingJob(job.id),false);
down.click();
assert.equal(negativeSource,"button","red thumb follows existing dismissal pipeline");
assert.equal(dismissedJobFeedback.has(job.id),true);
assert.equal(positiveJobFeedback.size,0);
assert.ok(workspaceSaves>=2);

// Private account state preserves the separate signals; no public GitHub writes.
assert.doesNotMatch(gh,/api.github.com|localStorage.getItem/);
assert.match(fs.readFileSync("authservice/private_state.py","utf8"),/"positive_feedback"/);
console.log("Desktop thumbs, separate positive feedback, undo and private account persistence contract checks passed");

}
run().catch(err=>{console.error(err);process.exitCode=1;});
