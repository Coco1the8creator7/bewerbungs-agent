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

test("adult market retains job-alert feed as independent matching input",()=>{
 const adult={id:"job-123",title:"Projektleiter thermische Netze",source:"jobs.ch",location:"Zürich",first_seen_at:"2026-10-24T06:00:00Z"};
 const learner={id:"job-456",title:"Lehrstelle Zeichner/in EFZ",source:"yousty.ch",location:"Zürich",first_seen_at:"2026-10-24T06:00:00Z"};
 const now=new Date("2026-10-24T14:00:00Z");
 assert.equal(model.summarize([adult,learner],now,"career").total,1);
 assert.equal(model.summarize([adult,learner],now,"apprentice").total,1);
 assert.equal(model.matchesPreferences(adult,{...model.initialProfile("career"),level:"EBA"},["jobs.ch"],"career"),true);
 assert.equal(model.matchesPreferences(adult,model.initialProfile("career"),["publicjobs.ch"],"career"),false);
 assert.equal(model.matchesPreferences(learner,model.initialProfile(),["yousty.ch"],"apprentice"),true);
});

test("career ratings, skills and source choices are disjoint from youth profile",()=>{
 const old={
  profile:{skills:{schule:["Mathematik & Zahlen"]}},
  ratings:{"old-id":{scores:{interest:3},note:"Frühere Lehrstellen-Bewertung"}},
  selectedSources:["yousty.ch"]
 };
 const current=model.normalizedState(old);
 assert.equal(current.market,"career");
 assert.equal(current.ratings["old-id"].scores.interest,3);
 assert.deepEqual(current.selectedSources,["yousty.ch"]);
 assert.equal(current.career.selectedSources.length,0);
 assert.equal(current.career.ratings["old-id"],undefined);
 assert.equal(current.profile.skills.schule[0],"Mathematik & Zahlen");
 const newState=model.normalizedState({...old,career:{
  selectedSources:["jobs.ch"],
  profile:{skills:{fachwissen:["Projektplanung"],berufserfahrung:["Fachbauleitung"]}},
  ratings:{"adult-id":{scores:{interest:4,conditions:5},note:""}}
 }});
 assert.equal(newState.career.profile.skills.fachwissen[0],"Projektplanung");
 assert.equal(newState.career.profile.skills.berufserfahrung[0],"Fachbauleitung");
 assert.equal(newState.career.ratings["adult-id"].scores.conditions,5);
 assert.equal(newState.ratings["adult-id"],undefined);
 assert.equal(model.ratingAverage(newState.career.ratings["adult-id"],"career").value,4.5);
 assert.deepEqual(model.normalizedState({...newState,market:"apprentice"}).market,"apprentice");
 const migrated=model.normalizedProfile({skills:{schule:["Projektplanung"],erfahrungen:["Fachbauleitung"]}},"career");
 assert.deepEqual(migrated.skills.fachwissen,["Projektplanung"]);
 assert.deepEqual(migrated.skills.berufserfahrung,["Fachbauleitung"]);
});

test("Radar uses original public jobs.json and keeps legacy CRM intact",()=>{
 const html=fs.readFileSync(path.join(root,"dashboard/index.html"),"utf8");
 const radar=fs.readFileSync(path.join(root,"dashboard/radar.js"),"utf8");
 const nav=fs.readFileSync(path.join(root,"dashboard/mode-nav.js"),"utf8");
 assert.match(html,/data-market="career"/);
 assert.match(html,/data-market="apprentice"/);
 assert.match(html,/id="radarSourcesInfo"/);
 assert.match(radar,/fetch\("\.\/jobs\.json"/);
 assert.match(radar,/model\.careerCriteria/);
 assert.match(radar,/model\.matchesPreferences/);
 assert.match(radar,/AgentCareerFilter\.isVisible/);
 assert.match(radar,/bucket\(\)\.ratings/);
 assert.doesNotMatch(radar,/GithubFeedback\.(save|publish)|feedback\.json|fetch\(["'].*\/api\/.*POST/);
 assert.match(nav,/hashchange/);
 assert.match(html,/id="newJobsList"/);
});


test("v2 preserves access to all excluded careers through Radar even if wishlist restricts candidates",()=>{
 const radar=fs.readFileSync(path.join(root,"dashboard/radar.js"),"utf8");
 const html=fs.readFileSync(path.join(root,"dashboard/index.html"),"utf8");
 const filter=fs.readFileSync(path.join(root,"dashboard/career-filter.js"),"utf8");
 for(const id of ["radarReviewScope","radarReviewScopeGroup","radarReviewMore","radarReviewList"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
 }
 assert.match(html,/value="filtered">Zurückgestellt/);
 assert.match(radar,/mode==="filtered"\?!isVisible\(j\)/);
 assert.match(radar,/adult&&mode==="filtered"\?true/);
 assert.match(radar,/reviewLimit\+=50/);
 assert.match(radar,/Originale Stellenbeschreibung anzeigen/);
 assert.match(radar,/Mit meinen Kriterien bewerten/);
 assert.match(filter,/career-preselector-v2/);
 assert.match(filter,/const isVisible = job => classify\(job\)\.visible/);
 assert.match(html,/value="priority" selected/);
 assert.doesNotMatch(radar,/\.splice\([^)]*jobs/);
});
