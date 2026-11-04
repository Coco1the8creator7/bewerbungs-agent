"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const modules=require("../dashboard/dossier-studio-modules.js");
const zoom=require("../dashboard/dossier-studio-zoom.js");
const docs=require("../dashboard/dossier-documents.js");
const studio=fs.readFileSync("dashboard/dossier-studio.html","utf8");
const model=fs.readFileSync("dashboard/dossier-studio-modules.js","utf8");
const zoomJs=fs.readFileSync("dashboard/dossier-studio-zoom.js","utf8");

test("new CV defaults include a visible optional photo placeholder and editable modular arrays",()=>{
 const d=docs.createDraft({title:"Lehrstelle Zeichner",company:"Beispielbetrieb"});
 assert.equal(d.docs.cv.sections.find(s=>s.id==="photo")?.visible,true);
 assert.equal(d.docs.cv.data.photoData,"");
 assert.deepEqual(d.docs.cv.freeBoxes,[]);
 assert.deepEqual(d.docs.letter.freeBoxes,[]);
 assert.equal(d.docs.email.freeBoxes,undefined);
});
test("free fields use stable zoom-independent percentage positions",()=>{
 const a=modules.createBox("field_1");
 assert.equal(a.x,12);assert.equal(a.width,38);
 const moved=modules.translateBox(a,16,23);
 assert.equal(moved.x,28);assert.equal(moved.y,69);
 assert.equal(a.x,12,"model functions are immutable");
 const beyond=modules.translateBox(a,10000,-10000);
 assert.equal(beyond.x,62);assert.equal(beyond.y,0);
 const width=modules.resizeBox(a,200);
 assert.equal(width.width,86);
 assert.equal(modules.resizeBox(width,-200).width,14);
});
test("corrupted free fields are normalized and clamped safely",()=>{
 const b=modules.normalizeBox({id:"box1",text:"Alpha",x:999,y:-20,width:200,fontSize:300,align:"bad"});
 assert.deepEqual({x:b.x,y:b.y,width:b.width,fontSize:b.fontSize,align:b.align},{x:14,y:0,width:86,fontSize:200,align:"left"});
 assert.equal(modules.normalizeBox({id:"../../hack"}).id,"");
 assert.equal(modules.normalizeBox({fontSize:0}).fontSize,75);
});
test("zoom supports click/pinch limits without affecting free-field geometry",()=>{
 assert.equal(zoom.clamp(25),60);
 assert.equal(zoom.clamp(250),240);
 assert.equal(zoom.step(100,1),110);
 assert.equal(zoom.step(100,-1),90);
 assert.equal(zoom.step(240,1),240);
 assert.equal(zoom.step(60,-1),60);
 assert.match(zoomJs,/touchstart/);
 assert.match(zoomJs,/touchmove/);
 assert.match(zoomJs,/dblclick/);
 assert.match(zoomJs,/preventDefault/);
 assert.doesNotMatch(zoomJs,/localStorage|indexedDB|draft\.json/);
});
test("the simplified PDF preserves the content of modular fields",()=>{
 const d=docs.createDraft({title:"Lehrstelle Zeichner",company:"Beispielbetrieb"});
 d.docs.cv.freeBoxes=[{id:"field_test",text:"Eigenständiges Projekt Alpha",x:45,y:35,width:30,fontSize:100,align:"left"}];
 const pdf=Buffer.from(docs.pdfBytes(d,"cv")).toString("latin1");
 assert.match(pdf,/Eigenständiges Projekt Alpha/);
});
test("studio document picker is removed, tab switching remains and modular controls are interactive",()=>{
 assert.doesNotMatch(studio,/id="docChecks"|function renderChecks\(/);
 assert.match(studio,/id="docTabs"/);
 assert.match(studio,/id="freeTextSection"/);
 assert.match(studio,/id="addFreeText"/);
 assert.match(studio,/id="freeTextList"/);
 assert.match(studio,/function renderFreeTextOverlay\(/);
 assert.match(studio,/function wireFreeDrag\(/);
 assert.match(studio,/renderFreeTextOverlay\(page\)/);
 assert.match(studio,/function renderFreeTextList\(/);
 assert.match(studio,/MODULES\.normalizeBox/);
 assert.match(studio,/cloudChanged\(\)/);
 assert.match(studio,/function generatedSnapshot\(/);
});
test("landscape, print zoom reset and field actions retain the established design",()=>{
 assert.match(studio,/@media\s*\(orientation:landscape\)\s*and\s*\(max-height:600px\)/);
 assert.match(studio,/id="toggleStudioTools"/);
 assert.match(studio,/id="zoomIn"/);
 assert.match(studio,/id="zoomOut"/);
 assert.match(studio,/id="zoomReset"/);
 assert.match(studio,/\.workspace\.tools-collapsed/);
 assert.match(studio,/\.page-container,\.email-preview\{zoom:1!important\}/);
 assert.match(studio,/\.free-text-box\s+\.free-text-drag,\.free-text-box\s+\.free-text-resize\{display:none!important\}/);
 assert.match(studio,/id="studioPrintPdf"/);
 assert.match(studio,/#95516E/);
});
test("Studio scripts compile and do not move document elements when zooming",()=>{
 const inline=studio.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
 assert.ok(inline);assert.doesNotThrow(()=>new Function(inline));
 assert.doesNotThrow(()=>new Function(model));
 assert.doesNotThrow(()=>new Function(zoomJs));
 assert.match(studio,/const zoomController=window\.CareerStudioZoom\.init\(document\)/);
 assert.doesNotMatch(zoomJs,/positionFreeNode|renderFreeTextList|freeBoxes/);
 assert.match(studio,/s\.id==="photo"/);
});
