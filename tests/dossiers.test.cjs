"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("dashboard/index.html","utf8");
const js=fs.readFileSync("dashboard/dossiers.js","utf8");
const css=fs.readFileSync("dashboard/dossiers.css","utf8");

test("dossier mode is a real page with one overview tab, not a placeholder",()=>{
 assert.match(html,/<section id="mode-dossiers" class="career-mode-view"[^>]*data-mode-page="dossiers"/);
 assert.match(html,/id="dossierOverviewTab"[^>]*>Übersicht/);
 for(const id of ["dossierList","dossierLibrary","dossierCount","dossierFileCount","dossierMessage",
  "dossierSearch","dossierCreate","dossierUpload","dossierLibraryUpload","dossierFileInput"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/href="\.\/dossiers\.css\?v=/);
 assert.match(html,/src="\.\/dossiers\.js\?v=/);
 assert.match(css,/#mode-dossiers/);
});

test("job popup can open a job-linked dossier preparation form",()=>{
 for(const id of ["detailPrepareDossier","dossierDialog","dossierJobSelect","dossierTitleInput",
  "dossierCompanyInput","dossierTone","dossierLength","dossierFocus","dossierSubmit"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/window\.CareerDossierJobs=/);
 assert.match(html,/window\.CareerDossiers\?\.prepare\(/);
 assert.match(js,/window\.CareerDossiers=Object\.freeze\(\{prepare\}\)/);
 assert.match(js,/jobId/);
 assert.match(js,/preferences:\{tone:/);
});

test("private documents never use public repository or unprotected remote endpoints",()=>{
 assert.match(js,/window\.indexedDB/);
 assert.match(js,/createObjectStore\("dossiers"/);
 assert.match(js,/createObjectStore\("files"/);
 assert.match(js,/URL\.createObjectURL/);
 assert.match(js,/URL\.revokeObjectURL/);
 assert.match(js,/MAX_BYTES=15\*1024\*1024/);
 assert.doesNotMatch(js,/\bfetch\s*\(|GithubFeedback|localStorage|innerHTML|\.github\.com\/.*api/);
 assert.match(html,/nur im Browser dieses Geräts gespeichert/);
 assert.match(html,/keine KI-generierten Dokumente/);
});

test("deleting a dossier preserves uploaded documents; files require confirmation",()=>{
 assert.match(js,/window\.confirm\("Dossier «"/);
 assert.match(js,/dossierId:null/);
 assert.match(js,/await remove\("dossiers",row\.id\)/);
 assert.match(js,/window\.confirm\("Datei «"/);
 assert.match(js,/await remove\("files",file\.id\)/);
});
