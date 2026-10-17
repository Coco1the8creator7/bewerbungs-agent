// Offline logic checks for stage tracking and score visibility. No dependencies.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("dashboard/index.html", "utf8");
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, "expected inline script");
const end = match[1].indexOf('el("choose").addEventListener');
assert.ok(end > 0, "expected event handlers after function definitions");
const code = match[1].slice(0, end);
const fixture = [
  'render = function() {};',
  'assert.equal(stageNames.get("review"), "In Prüfung");',
  'assert.equal(stageNames.get("declined"), "Absage erhalten");',
  'assert.ok(activeStages.has("review"));',
  'assert.ok(activeStages.has("applied"));',
  'assert.ok(!activeStages.has("declined"));',
  'assert.equal(getScore({matching:{status:"pending",score:99}}),null);',
  'assert.equal(getScore({matching:{status:"complete",score:null}}),null);',
  'assert.equal(getScore({matching:{status:"complete",score:105}}),null);',
  'assert.equal(getScore({matching:{status:"complete",score:82}}),82);',
  'assert.equal(getScore({}),null);',
  'assert.ok(recent(new Date(Date.now()-24*60*60*1000).toISOString()));',
  'assert.ok(!recent(new Date(Date.now()-10*24*60*60*1000).toISOString()));',
  'assert.ok(!recent(null));',
  'setAnnotation("abc","review","");',
  'assert.equal(stageOf("abc"),"review");',
  'const stamp=stageChangedAt("abc");',
  'assert.ok(recent(stamp));',
  'setAnnotation("abc","review","Notiz verändert");',
  'assert.equal(stageChangedAt("abc"),stamp);',
  'setAnnotation("abc","declined","Rückmeldung erhalten");',
  'assert.equal(stageOf("abc"),"declined");',
  'setAnnotation("abc","rejected","");',
  'assert.notEqual(stageOf("abc"),"declined");',
  'setAnnotation("abc","open","");',
  'assert.equal(annotations.has("abc"),false);',
  'assert.throws(()=>setAnnotation("x","invalid",""));',
].join("\n");
vm.runInNewContext(code + fixture, {assert,Date,Intl,URL,console});
console.log("Dashboard logic checks passed");
