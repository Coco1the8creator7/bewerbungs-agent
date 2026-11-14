"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("authservice/mission-control.html","utf8");
const js=fs.readFileSync("dashboard/dossiers.js","utf8");
const css=fs.readFileSync("dashboard/dossiers.css","utf8");

test("Dossiers: one simple job selector, old creation form fully removed",()=>{
 assert.match(html,/<section id="mode-dossiers" class="career-mode-view"[^>]*data-mode-page="dossiers"/);
 for(const id of ["dossierList","dossierLibrary","dossierCount","dossierFileCount","dossierMessage",
  "dossierSearch","dossierGenerate","dossierUpload","dossierLibraryUpload","dossierFileInput",
  "dossierGenerationDialog","dossierGenerationForm","dossierGenerateJobSelect","dossierGenerateConfirm"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 for(const removed of ["dossierCreate","dossierDialog","dossierJobSelect","dossierTitleInput",
  "dossierCompanyInput","dossierTone","dossierLength","dossierFocus","dossierSubmit",
  "Dossier vorbereiten","Dossier gestalten"]){
  assert.ok(!html.includes('id="'+removed+'"'),removed+" absent");
  assert.ok(!js.includes('$("'+removed+'")'),removed+" no JS references");
 }
 const dialog=html.match(/<dialog id="dossierGenerationDialog"[\s\S]*?<\/dialog>/)?.[0];
 assert.ok(dialog);
 assert.equal((dialog.match(/<select\b/g)||[]).length,1,"only one dropdown");
 assert.doesNotMatch(dialog,/<textarea\b|type="text"/);
 assert.match(html,/src="\.\/dossier-documents\.js\?v=/);
 assert.match(html,/src="\.\/dossiers\.js\?v=/);
});
test("one generation path for central selection and card; actions depend on generatedStudio",()=>{
 assert.match(js,/async function generateDossier\(id\)/);
 assert.match(js,/async function submitGeneration\(event\)/);
 assert.match(js,/const result=await generateDossier\(row\.id\)/);
 assert.match(js,/const entry=await generateDossier\(id\)/);
 assert.match(js,/if\(previous\.generatedStudio\)/);
 assert.match(js,/if\(generated\)/);
 assert.match(js,/button\("Dossier bearbeiten"/);
 assert.match(js,/button\("Dossier herunterladen"/);
 assert.match(js,/button\("Dossier generieren"/);
 assert.doesNotMatch(js,/button\("Datei hinzufügen"|button\("Einstellungen"/);
 assert.match(js,/\.\/dossier-studio\.html\?dossier=/);
 assert.match(js,/career-dossier-jobs-changed/);
 assert.match(js,/window\.CareerDossiers=Object\.freeze\(/);
 assert.doesNotMatch(js,/\bfunction prepare\(/);
});
test("dossiers stay local and the public GitHub panel is fully removed",()=>{
 assert.match(js,/window\.indexedDB/);
 assert.match(js,/createObjectStore\("dossiers"/);
 assert.match(js,/createObjectStore\("files"/);
 assert.match(js,/URL\.createObjectURL/);
 assert.match(js,/URL\.revokeObjectURL/);
 assert.match(js,/MAX_BYTES=15\*1024\*1024/);
 assert.doesNotMatch(js,/\bfetch\s*\(|localStorage|innerHTML|CareerDossiersData/);
 assert.match(html,/Nur lokal im Browser/);
 for(const obsolete of ["dossierPublicSave","dossierPublicLoad","dossierPublicToken",
  "dossierPublicStatus","dossierPublicHeading","Öffentliche GitHub-Ablage",
  "dossiers-public.js","GitHub-Abgleich","GitHub nur nach Freigabe"]){
  assert.ok(!html.includes(obsolete),obsolete+" must be removed");
 }
 assert.doesNotMatch(css,/dossier-public/);
 assert.match(html,/Persönliche Angaben musst du im Studio ergänzen und überprüfen/);
});

test("deleting a dossier preserves uploaded documents; files require confirmation",()=>{
 assert.match(js,/window\.confirm\("Dossier «"/);
 assert.match(js,/dossierId:null/);
 assert.match(js,/await remove\("dossiers",row\.id\)/);
 assert.match(js,/window\.confirm\("Datei «"/);
 assert.match(js,/await remove\("files",file\.id\)/);
});
