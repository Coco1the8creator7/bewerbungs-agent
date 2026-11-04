"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const model=require("../dashboard/dossier-studio-modules.js");
const studio=fs.readFileSync("dashboard/dossier-studio.html","utf8");
const docs=require("../dashboard/dossier-documents.js");

test("Word-like square wrap creates a side exclusion only at the obstacle height",()=>{
 const target=model.rectangle(0,0,400,600);
 const obstacle=model.rectangle(100,50,160,100);
 const result=model.textExclusion(target,obstacle,"square",8);
 assert.equal(result.side,"left");
 assert.equal(result.y,42);
 assert.equal(result.width,268);
 assert.equal(result.height,116);
 assert.ok(result.y>0,"text should remain full width above the obstacle");
});
test("right-side exclusion, full-line break and front/behind modes behave distinctly",()=>{
 const target=model.rectangle(0,0,400,600);
 const obstacle=model.rectangle(300,30,90,80);
 const right=model.textExclusion(target,obstacle,"square",6);
 assert.equal(right.side,"right");
 assert.equal(right.width,106);
 const full=model.textExclusion(target,obstacle,"top-bottom",6);
 assert.equal(full.width,target.width);
 assert.equal(full.mode,"top-bottom");
 assert.equal(model.textExclusion(target,obstacle,"front"),null);
 assert.equal(model.textExclusion(target,obstacle,"behind"),null);
 assert.equal(model.textExclusion(target,model.rectangle(450,100,30,30),"square"),null);
});
test("source frames preserve binding and layer order; user field text cannot disappear on migration",()=>{
 const source=model.normalizeFrame({id:"anchor_data_name",source:"data:name",text:"kept",z:40,x:10,y:12,width:70,wrap:"square"});
 assert.deepEqual({source:source.source,text:source.text,z:source.z},{source:"data:name",text:"kept",z:40});
 assert.equal(model.normalizeFrame({id:"a",source:"data:__proto__"}).source,"");
 assert.equal(model.normalizeFrame({id:"b",source:"section:profile"}).source,"section:profile");
 const custom=model.normalizeFrame({id:"field_one",text:"Anwendungsbrief",z:100,width:40,x:20});
 assert.equal(custom.text,"Anwendungsbrief");
 assert.equal(custom.z,100);
});
test("higher stacked frames become obstacles but earlier frames do not create cycles",()=>{
 const frames=[
  {id:"name",z:1,wrap:"square"},
  {id:"skills",z:2,wrap:"square"},
  {id:"picture",z:3,wrap:"top-bottom"}
 ];
 const rectangles={
  name:model.rectangle(0,0,300,500),
  skills:model.rectangle(90,80,100,60),
  picture:model.rectangle(150,180,100,70)
 };
 assert.equal(model.exclusionsForFrame(frames[0],frames,rectangles).length,2);
 assert.equal(model.exclusionsForFrame(frames[1],frames,rectangles).length,0);
 assert.equal(model.exclusionsForFrame(frames[2],frames,rectangles).length,0);
});
test("legacy content is converted from actual measured DOM geometry, not guessed source content",()=>{
 assert.match(studio,/function ensureSourceFrames\(doc,page,style\)/);
 assert.match(studio,/getBoundingClientRect\(\)/);
 assert.match(studio,/doc\.layoutBoxes=frames/);
 assert.match(studio,/doc\.layoutVersion=2/);
 assert.match(studio,/function sourceEntries\(doc\)/);
 assert.match(studio,/function setFrameText\(frame,value\)/);
 assert.match(studio,/function frameText\(frame\)/);
 assert.match(studio,/renderFreeTextOverlay\(page\)/);
 assert.match(studio,/MODULES\.normalizeFrame/);
 assert.match(studio,/allDocumentFrames\(\)/);
});
test("native float exclusions preserve the full width of lines above overlapped frames",()=>{
 assert.match(studio,/function reflowFrameExclusions\(\)/);
 assert.match(studio,/MODULES\.textExclusion\(/);
 assert.match(studio,/spacer\.style\.shapeOutside="polygon\(/);
 assert.match(studio,/spacer\.style\.marginTop="0"/);
 assert.doesNotMatch(studio,/spacer\.style\.shapeOutside="margin-box"/);
 assert.match(studio,/content\.contentEditable="true"/);
 assert.match(studio,/frame-flow/);
 assert.match(studio,/requestAnimationFrame\(\(\)=>\{reflowFrameExclusions\(\);checkOverflow\(\)\}\)/);
});
test("all source text stays in existing generated dossier schema, no fabricated applicant content",()=>{
 const draft=docs.createDraft({title:"Technische Lehrstelle",company:"Fiktiv AG"});
 assert.match(draft.docs.cv.data.name,/\[Vorname Nachname\]/);
 assert.ok(draft.docs.cv.sections.find(part=>part.id==="photo").visible);
 assert.equal(draft.docs.cv.freeBoxes.length,0);
 const json=JSON.stringify(draft);
 assert.doesNotMatch(json,/random applicant|faked credential/i);
});
