"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("dashboard/index.html","utf8");
const popupCSS=fs.readFileSync("dashboard/job-popup.css","utf8");
const dossierJS=fs.readFileSync("dashboard/dossiers.js","utf8");

test("job popup displays exactly one personal relevance slider, no deep criterion editor",()=>{
 const source=html.match(/function ratingPanel\(j\)\{[\s\S]*?\n\}(?=\nfunction stageOf)/)?.[0];
 assert.ok(source,"popup rating panel exists");
 assert.match(source,/type="range"/);
 assert.match(source,/input\.min="1";input\.max="100";input\.step="1"/);
 assert.doesNotMatch(source,/makeReasonButtons|setFeedback|setRatingNote|textarea|reasons/);
 assert.doesNotMatch(html,/id="detailReasons"|id="detailRatingNote"/);
});

test("pictogram controls have unique IDs and accessible labels",()=>{
 for(const id of ["detailSaveMark","detailPrepareDossier","detailOpenAgency","detailExportMark"]){
  const matches=[...html.matchAll(new RegExp('id="'+id+'"','g'))];
  assert.equal(matches.length,1,"exactly one control "+id);
  assert.match(html,new RegExp('id="'+id+'"[^>]*aria-label="[^"]+"'));
 }
 assert.match(html,/detail-action-bar" role="group"/);
 assert.match(html,/\.detail-icon-action\[aria-pressed="true"\]/);
 assert.match(popupCSS,/--ca-accent/);
});

test("bookmark uses CRM saved status without awarding preparation points",()=>{
 assert.match(html,/setAnnotation\(j\.id,stage==="saved"\?"open":"saved",noteOf\(j\.id\)\)/);
 assert.match(html,/\["open","review","later","saved"\]\.includes\(stage\)/);
 assert.match(html,/\["review","saved","later","preparing","applied"/);
});

test("Agency preparation is recorded only after successful dossier storage",()=>{
 assert.match(dossierJS,/await put\("dossiers",entry\);/);
 assert.match(dossierJS,/new CustomEvent\("career-dossier-prepared"/);
 const put=dossierJS.indexOf('await put("dossiers",entry)');
 const dispatched=dossierJS.indexOf('new CustomEvent("career-dossier-prepared"');
 assert.ok(dispatched>put);
 assert.match(html,/window\.addEventListener\("career-dossier-prepared"/);
 assert.match(html,/setAnnotation\(id,"preparing",noteOf\(id\)\)/);
});

test("inline app script remains valid JavaScript",()=>{
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Function(script));
});
