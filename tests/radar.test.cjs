"use strict";
// Offline checks: no real applicant data, network or dependencies.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const model=require("../dashboard/radar-model.js");

test("apprenticeships require explicit training intent, not EFZ alone",()=>{
 assert.equal(model.isApprenticeship({title:"Lehrstelle Schreiner/in EFZ"}),true);
 assert.equal(model.isApprenticeship({title:"Lernende Kauffrau EFZ"}),true);
 assert.equal(model.isApprenticeship({title:"Spontanbewerbung Fachperson Gesundheit EFZ"}),false);
 assert.equal(model.isApprenticeship({title:"Carrosseriespengler/-in EFZ"}),false);
 assert.equal(model.isApprenticeship({title:"Teamleitung, betreut Lernende"}),false);
});

test("counts unique feed jobs using their first-seen dates, excluding samples",()=>{
 const now=new Date(2026,9,24,14,0);
 const iso=(day,h=11)=>new Date(2026,9,day,h,0).toISOString();
 const rows=[
  {id:"one",title:"Lehrstelle Informatiker/in EFZ",first_seen_at:iso(24)},
  {id:"one",title:"Lehrstelle Informatiker/in EFZ",first_seen_at:iso(24)},
  {id:"two",title:"Projektleitung",first_seen_at:iso(23)},
  {id:"three",title:"Projektleitung",first_seen_at:iso(20)},
  {id:"four",title:"Projektleitung",first_seen_at:iso(16)},
  {id:"MANUAL-1",title:"Lehrstelle Schreiner",first_seen_at:iso(24)},
  {id:"DEMO-1",title:"Lehrstelle Koch",first_seen_at:iso(24)}
 ];
 assert.deepEqual(model.summarize(rows,now),{total:4,sinceYesterday:2,thisWeek:3,apprenticeships:1,missingDates:0});
});

test("source, region, occupation and EFZ filters are transparent",()=>{
 const job={id:"j",title:"Lehrstelle Informatiker/in EFZ",source:"yousty.ch",location:"Zürich"};
 const prefs={...model.initialProfile(),region:"Zürich",occupations:"Informatiker",level:"EFZ",strictRegion:true,strictOccupation:true};
 assert.equal(model.matchesPreferences(job,prefs,["yousty.ch"]),true);
 assert.equal(model.matchesPreferences(job,prefs,["gateway.one"]),false);
 assert.equal(model.matchesPreferences(job,{...prefs,region:"Bern"},["yousty.ch"]),false);
 assert.equal(model.matchesPreferences(job,{...prefs,occupations:"Bäcker"},["yousty.ch"]),false);
 assert.equal(model.matchesPreferences(job,{...prefs,level:"EBA"},["yousty.ch"]),false);
});

test("unanswered evaluation fields never become implicit ratings",()=>{
 assert.equal(model.ratingAverage({scores:{}}),null);
 assert.deepEqual(model.ratingAverage({scores:{interest:5,tasks:3,commute:null}}),{value:4,count:2});
 const s=model.normalizedState({profile:{skills:{schule:["Mathematik & Zahlen","Falscher Wert"]},extraSkills:["HTML","HTML"]},ratings:{j:{scores:{interest:4,tasks:0},note:""}}});
 assert.deepEqual(s.profile.skills.schule,["Mathematik & Zahlen"]);
 assert.deepEqual(s.profile.extraSkills,["HTML"]);
 assert.deepEqual(s.ratings.j.scores,{interest:4});
});

test("radar is isolated from adult CRM and uses opt-in local persistence",()=>{
 const html=fs.readFileSync(path.join(root,"dashboard/index.html"),"utf8");
 const js=fs.readFileSync(path.join(root,"dashboard/radar.js"),"utf8");
 const store=fs.readFileSync(path.join(root,"dashboard/storage.js"),"utf8");
 for(const marker of ["radarTabOverview","radarTabProfile","radarTabReview","radarSkills-interessen","radarSources","radarReviewList","radarSaveOptIn"]){
  assert.ok(html.includes('id="'+marker+'"'),marker);
 }
 assert.match(html,/src="\.\/radar-model\.js"/);
 assert.match(html,/src="\.\/radar\.js"/);
 assert.match(html,/href="\.\/radar\.css"/);
 assert.match(js,/AgentStore\.saveRadar/);
 assert.match(js,/AgentStore\.clearRadar/);
 assert.match(store,/RADAR_KEY/);
 assert.doesNotMatch(js,/localStorage|GithubFeedback|fetch\(["'].*feedback/);
 assert.match(html,/FIKTIVE|fiktive/);
});
