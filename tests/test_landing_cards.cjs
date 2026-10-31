// Regression tests for compact job cards, rating badges and the header bell.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("dashboard/index.html","utf8");
const css=fs.readFileSync("dashboard/landing-cards.css","utf8");
const bellCss=fs.readFileSync("dashboard/notifications.css","utf8");

const header=html.slice(html.indexOf('<header class="career-app-header">'),html.indexOf("</header>",html.indexOf('<header class="career-app-header">')));
const sidebar=header.indexOf('id="openModeSidebar"');
const brand=header.indexOf('class="career-header-copy"');
const bell=header.indexOf('id="notificationBell"');
assert.ok(sidebar>=0&&brand>sidebar&&bell>brand,"header order must be menu, brand, notification");
assert.match(bellCss,/grid-template-columns:44px minmax\(0,1fr\) 44px/);
assert.match(bellCss,/\.career-app-header > \.career-header-notifications\{grid-column:3;grid-row:1/);
assert.match(bellCss,/\.notification-panel\{[\s\S]*?right:0/);
assert.match(bellCss,/\.career-app-header > \.career-header-copy\{grid-column:1\/-1;grid-row:2/);
assert.match(html,/<h2 id="newJobsTitle">Meine Inserate<\/h2>/);
assert.doesNotMatch(html,/<h2 id="newJobsTitle">Inserate beurteilen<\/h2>/);
assert.match(html,/value="priority" selected>Priorität<\/option>/);
assert.match(html,/id="detailExportMarkHost"/);
assert.match(css,/#newJobsList \.card-rating/);
assert.match(css,/\.card-rating\.rated/);
assert.match(css,/\.card-rating:focus-visible/);
assert.match(html,/id="saveGithubFeedback"/,"shared GitHub save button is preserved");

const start=html.indexOf("function renderNewJobs(){");
const end=html.indexOf("\nfunction render(){",start);
assert.ok(start>=0&&end>start);
const cards=html.slice(start,end);
assert.match(cards,/top\.append\(info,cardRatingButton\(j\)\)/);
assert.match(cards,/card\.append\(tags\)/);
assert.match(cards,/openDetails\(j\.id\)/,"whole card still opens the details dialog");
for(const forbidden of ["exportMarkButton(j)","jobSalaryLabel(j)","Lohn-Range",
 "V2-Priorität","Vorschlag ","actions.append(actionButton(j))","card-footer"]){
 assert.ok(!cards.includes(forbidden),"Removed card fragment still exists: "+forbidden);
}
assert.ok(!html.includes("function jobSalaryLabel(j)"),"unneeded salary card formatter removed");
assert.match(html,/function syncDetailActions\(j\)/,"detail action bar remains available");
assert.match(html,/id="detailExportMark"[^>]+aria-pressed="false"/);
assert.match(html,/el\("detailExportMark"\)\.addEventListener\("click",\(\)=>\{/);
assert.match(html,/toggleExportSelection\(j\.id\);\s*syncDetailActions\(j\);\s*renderNewJobs\(\);/);
assert.match(html,/input\.addEventListener\("change",\(\)=>\{setRating\(j\.id,input\.value\);renderNewJobs\(\);/);

// Execute the rating chip and export control in isolation with fake buttons.
// The importer score must never be presented as a manual rating.
const source=html.slice(html.indexOf("function cardRatingButton(j){"),html.indexOf("function ratingPanel(j){"));
assert.match(source,/ratingOf\(j\.id\)\?\.score/);
assert.doesNotMatch(source,/selection\?\.|classify\(/);
class Button{
 constructor(){this.attributes={};this.listeners={};this.textContent="";this.title="";this.type="";}
 setAttribute(key,val){this.attributes[key]=String(val);}
 addEventListener(kind,fn){this.listeners[kind]=fn;}
 click(){this.listeners.click();}
}
let userRating=null,opened=null,focused=0,renders=0,saved=0,markedUpdates=0;
const selectedJobIds=new Set();
const job={id:"job-7",title:"Projektleiter Fernwärme",selection:{suggested_score:99}};
const fakeDocument={createElement:()=>new Button()};
const context={
 document:fakeDocument,selectedJobIds,Number,
 ratingOf:()=>userRating,
 openDetails:(id)=>{opened=id},
 el:()=>({querySelector:()=>({focus(){focused++}})}),
 toggleExportSelection(id){if(selectedJobIds.has(id))selectedJobIds.delete(id);else selectedJobIds.add(id);saved++;},
 renderNewJobs(){renders++},
 updateMarkedSummary(){markedUpdates++}
};
const methods=vm.runInNewContext(source+"\n({cardRatingButton})",context);
let button=methods.cardRatingButton(job);
assert.equal(button.textContent,"Bewerten","no user rating must be shown as missing");
assert.ok(button.className.includes("unrated"));
assert.match(button.attributes["aria-label"],/Inserat bewerten/);
button.click();
assert.equal(opened,job.id);
assert.equal(focused,1,"rating chip focuses the existing slider");

userRating={score:87};
button=methods.cardRatingButton(job);
assert.equal(button.textContent,"87 / 100");
assert.ok(button.className.includes("rated"));
button.click();
assert.equal(focused,2);

userRating={score:0};
assert.equal(methods.cardRatingButton(job).textContent,"Bewerten","invalid ratings must not display");
userRating={score:100};
assert.equal(methods.cardRatingButton(job).textContent,"100 / 100");

// The detail dialog owns the export icon; the card itself does not.
assert.ok(html.includes('id="detailExportMark"'));
assert.ok(!cards.includes("detailExportMark"));
assert.ok(!cards.includes("exportMarkButton"));
console.log("Landing card and top-right notification regression checks passed");
