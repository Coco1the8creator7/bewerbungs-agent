"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const explorer=require("../dashboard/radar-explorer-model.js");
const radar=require("../dashboard/radar-model.js");

test("the original activity catalog covers two audiences without sharing question ids",()=>{
 const youth=explorer.items("apprentice"),career=explorer.items("career");
 assert.ok(youth.length>=30);
 assert.ok(career.length>=12);
 assert.notStrictEqual(youth,career);
 assert.ok(youth.every(x=>x.id&&x.emoji&&x.title&&x.tags.length));
 assert.equal(new Set(youth.map(x=>x.id)).size,youth.length);
 assert.equal(new Set(career.map(x=>x.id)).size,career.length);
});

test("only explicit likes count towards exploratory occupation suggestions",()=>{
 const state={choices:{wood:"like",make:"like",repair:"like",outside:"no"}};
 const summary=explorer.progress(state,"apprentice");
 assert.deepEqual(summary,{total:32,answered:4,liked:3,rejected:1});
 const results=explorer.matches(state,"apprentice");
 assert.ok(results.length);
 assert.ok(results.some(item=>item.title.includes("Schreiner")));
 assert.ok(results.every(x=>x.score>=2));
 assert.ok(results.every(x=>!Object.hasOwn(x,"probability")));
 assert.deepEqual(explorer.matches({choices:{wood:"like",make:"no"}},"apprentice"),[]);
});

test("an adult technical interest path suggests a project field, not a youth profession",()=>{
 const answer={choices:{energy:"like",manage:"like",buildings:"like"}};
 const results=explorer.matches(answer,"career");
 assert.ok(results.some(x=>x.title==="Projektleitung thermische Netze"));
 assert.ok(results.every(x=>!x.title.endsWith("EFZ")));
 assert.equal(explorer.progress(answer,"career").answered,3);
});

test("invalid and unknown answer values and foreign favorite titles are dropped",()=>{
 const state=explorer.normalizeExplorer({choices:{wood:"like",make:"yes",invalid:"no",__proto__:"like"},
  favorites:["Schreiner/in EFZ","Nicht existierender Beruf","Schreiner/in EFZ"]},"apprentice");
 assert.deepEqual(state.choices,{wood:"like"});
 assert.deepEqual(state.favorites,["Schreiner/in EFZ"]);
});

test("profile normalization preserves every earlier skill and opt-in interest decision separately",()=>{
 const initial=radar.normalizedState({profile:{
  skills:{schule:["Mathematik & Zahlen"]},
  explorer:{choices:{wood:"like",outside:"no"},favorites:["Schreiner/in EFZ"]}
 },career:{profile:{
  skills:{fachwissen:["Projektplanung"]},
  explorer:{choices:{energy:"like",manage:"no"},favorites:["Projektleitung thermische Netze"]}
 }}});
 assert.equal(initial.profile.skills.schule[0],"Mathematik & Zahlen");
 assert.equal(initial.profile.explorer.choices.wood,"like");
 assert.equal(initial.career.profile.skills.fachwissen[0],"Projektplanung");
 assert.equal(initial.career.profile.explorer.choices.energy,"like");
 assert.equal(initial.career.profile.explorer.choices.wood,undefined);
 assert.deepEqual(radar.normalizedState(initial),initial);
});

test("explorer UI is accessible without drag, contains no server write and stays within Radar",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../dashboard/index.html"),"utf8");
 const js=fs.readFileSync(path.join(__dirname,"../dashboard/radar-explorer-ui.js"),"utf8");
 const css=fs.readFileSync(path.join(__dirname,"../dashboard/radar-explorer.css"),"utf8");
 assert.match(html,/id="radarPanelProfile"/);
 assert.match(html,/id="radarExplorerCard"/);
 assert.match(html,/id="radarExplorerYes"/);
 assert.match(html,/id="radarExplorerNo"/);
 assert.match(html,/id="radarExplorerSkip"/);
 assert.match(html,/id="radarExplorerResults"/);
 assert.match(html,/src="\.\/radar-explorer-model\.js"/);
 assert.match(html,/src="\.\/radar-explorer-ui\.js"/);
 assert.match(html,/href="\.\/radar-explorer\.css"/);
 assert.match(js,/addEventListener\("click"/);
 assert.match(js,/addEventListener\("drop"/);
 assert.match(js,/aria-label/);
 assert.doesNotMatch(js,/innerHTML|localStorage|GithubFeedback|fetch\(|https?:\/\//);
 assert.match(css,/prefers-reduced-motion/);
});
