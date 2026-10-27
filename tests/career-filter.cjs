"use strict";
const assert = require("node:assert/strict");
const {classify,isVisible} = require("../dashboard/career-filter.js");
const hidden = [
  "Oberärztin / Oberarzt 80-100%",
  "Assistenzärztin / Assistenzarzt Rheumatologie",
  "Pflegefachperson für die Bettenstationen",
  "Dipl. Pflegefachmann HF Intensivpflege",
  "MPA / FaGe für den Personalärztlichen Dienst",
  "Fachfrau Gesundheit EFZ im Nachtdienst",
  "Physiotherapeutin / Physiotherapeut",
  "Laborant:in mit biologischer Ausrichtung",
  "SAP Cloud Integration Developer",
  "Senior Cloud Engineer / Architect (Azure)",
  "Information Security Engineer - two positions",
  "IT Sales Representative",
  "Applikationsmanager IT und OT",
  "Senior Developer C# & React mit KI-gestützter Entwicklung",
  "GRC Consultant / IT Auditor",
  "Product Owner – B2B Digital Ecosystem Platform"
];
const visible = [
  ["Bauleiter:in Neubau USZ Universitätsspital Zürich","Fanzun AG"],
  ["Projektleiter:in Bau-Entwicklungsplanung 80-100 %","Universitätsspital Zürich"],
  ["Projektleiter HLKS Spital","Ingenieurbüro"],
  ["Projektleiter Medizintechnik","Muster Engineering AG"],
  ["Ingenieur für Energieversorgung im Krankenhaus","Ingenieur AG"],
  ["Fachspezialist*in Netzinformationssysteme (GIS, CAD)","ewz"],
  ["Teamleiter*in Betrieb HLK","ewz"],
  ["Projektleiter/in Verkehrs- und Infrastrukturprojekte","Kanton Zürich"],
  ["Projektentwickler Energie","ewz"],
  ["Werkstudent/in AI-Innovation & Prozessautomatisierung","Vokus Personal AG"],
  ["Agentic AI Innovation Engineer","Technologie AG"],
  ["KI-Agenten Automatisierung / Digital Innovation","Innovation AG"],
  ["AI Agent Developer","Software AG"],
  ["Servicetechniker/in Gas & Fernwärmesysteme","Hoval AG"],
  ["Projektleiter:in Kraftwerke & Automatisierung","KWO"]
];
for(const title of hidden){
 const got=classify({title,company:"Muster AG"});
 assert.equal(got.visible,false,"Should hide: "+title);
 assert.ok(["healthcare_role","it_role"].includes(got.reason));
}
for(const [title,company] of visible)
 assert.equal(isVisible({title,company}),true,"Should retain: "+title);
assert.equal(isVisible({title:"Bauleiter:in Hochbau",company:"Universitätsspital Zürich",description:"Patientenversorgung Klinik"}),true);
assert.equal(isVisible({title:"SAP Administrator",company:"Universitätsspital Zürich"}),false);
assert.equal(isVisible({title:"Projektleiter Energiekonzept",company:"Spital GmbH"}),true);
assert.equal(isVisible({title:"Unbekannte Stelle",company:"Pflegeheim AG"}),false,"Healthcare-sector roles without technical evidence should be hidden");
assert.equal(isVisible({title:"Technischer Hauswart",company:"Universitätsspital Zürich"}),true);
assert.equal(isVisible({title:"Diätkoch 80-100%",company:"Universitätsspital Zürich"}),false);
assert.equal(isVisible({title:"Schichtverantwortliche:r AEMP 80-100%",company:"Universitätsspital Zürich"}),false);
assert.equal(isVisible({title:"Senior Software Developer (KI-gestützte Programmierung)",company:"Muster AG"}),false);
console.log("Career filter: "+hidden.length+" exclusions and "+visible.length+" allowed roles validated");


// V2 prioritises career-adjacent roles while parking only obvious misses.
const outOfScopeTitles=[
 "Koch / Köchin EFZ", "Coiffeur 80%", "Reinigungskraft 60-80%",
 "Cleanroom Fabrication Engineer at the Quantum Device Lab"
];
for(const title of outOfScopeTitles){
 const r=classify({title,company:"Muster AG"});
 assert.equal(r.visible,false,"Must park: "+title);
 assert.equal(r.reason,"out_of_scope_role");
 assert.equal(r.exclusion,true);
}
const careerTitles=[
 "Fachbauleiter Rohrleitungsbau Fernwärme",
 "Projektleiter Klima und Mobilität",
 "Junior Lichtdesigner",
 "Verkaufsberater thermische Netze",
 "Bauprojektadministration",
 "Projektleiter Energiecontrolling",
 "Projektleiter HLKS Universitätsspital",
 "Projektleitung KI-Agenten Innovation"
];
for(const title of careerTitles){
 const r=classify({title,company:"Engineering AG"});
 assert.equal(r.visible,true,"Must keep cross-entry: "+title);
 assert.equal(r.version,"career-preselector-v2");
 assert.ok(Number.isInteger(r.priority)&&r.priority>=1&&r.priority<=99);
}
const relevant=classify({title:"Fachbauleiter Rohrleitungsbau Fernwärme"}).priority;
const unrelated=classify({title:"Allgemeine Büroarbeiten"}).priority;
assert.ok(relevant>unrelated,"Priority must favour thermal networks and project delivery");
assert.equal(isVisible({title:"Koch EFZ",description:"Wir wollen die Energiewende vorantreiben"}),false,
 "Employer's energy marketing must not override clear occupation");
assert.equal(isVisible({title:"Projektleiter Gastronomie"}),true,
 "Ambiguous transitions must stay reviewable");
assert.equal(classify({title:"Unbekannte Funktion"}).visible,true,
 "Insufficient evidence must not exclude");
