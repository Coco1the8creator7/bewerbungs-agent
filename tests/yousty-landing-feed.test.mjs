import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url);
const filter=require("../dashboard/career-filter.js");

const incoming=(title, source="yousty.ch", id="apprenticeship-"+"a".repeat(24))=>({
  source,id,title,company:"Musterbetrieb AG",
  location:"Zürich",description:""
});

test("verified Yousty apprenticeship electricians and health professions remain visible",()=>{
  assert.equal(filter.isVisible(incoming("Lehrstelle als Elektroinstallateur/in EFZ")),true);
  assert.equal(filter.isVisible(incoming("Lehrstelle als Informatiker/in EFZ")),true);
  assert.equal(filter.isVisible(incoming("Lehrstelle als Fachperson Gesundheit EFZ")),true);
  assert.equal(filter.isVisible(incoming("Lehrstelle als Detailhandelsassistent/in EBA")),true);
});

test("adult role exclusion remains unchanged",()=>{
  assert.equal(filter.isVisible(incoming("Sanitärinstallateur EFZ","jobs.ch","job-adult")),false);
  assert.equal(filter.isVisible(incoming("Lehrstelle als Elektroinstallateur/in EFZ","jobs.ch","job-adult")),false);
});

test("a fabricated Yousty source alone cannot bypass the adult filter",()=>{
  assert.equal(filter.isVisible(incoming("Lehrstelle als Elektroinstallateur/in EFZ","yousty.ch","job-adult")),false);
  assert.equal(filter.isVisible(incoming("Elektroinstallateur/in EFZ")),false);
});
