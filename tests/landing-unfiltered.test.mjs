import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source=fs.readFileSync(path.resolve("dashboard/index.html"),"utf8");

test("existing landing uses all jobs without personal adult career visibility filtering",()=>{
  assert.match(source,/function visibleJobs\(\)\{return jobs;\}/);
  assert.doesNotMatch(source,/function visibleJobs\(\)\{return jobs\.filter/);
  assert.match(source,/function renderNewJobs\(\)/);
  assert.match(source,/id="newJobsList"/);
});

test("public landing does not apply adult-personal priority or predicted scores",()=>{
  assert.doesNotMatch(source,/AgentCareerFilter\?\.classify\(j\)/);
  assert.doesNotMatch(source,/AgentCareerFilter\.classify\(b\)/);
  assert.match(source,/const predicted=null;/);
  assert.match(source,/<select id="sort"><option value="date" selected>/);
  assert.doesNotMatch(source,/<option value="priority"/);
});

test("feed source, existing popup, review and personal Radar remain intact",()=>{
  assert.match(source,/fetch\("\.\/jobs\.json",\{cache:"no-store"\}\)/);
  assert.match(source,/function openDetails\(id\)/);
  assert.match(source,/function cardRatingButton\(j\)/);
  assert.match(source,/function renderPipeline\(\)/);
  assert.match(source,/id="mode-radar"/);
  assert.match(source,/src="\.\/career-filter\.js"/);
  assert.doesNotMatch(source,/zurückgestellt · Radar > Filter-KI/);
});
