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
assert.equal(isVisible({title:"Unbekannte Stelle",company:"Pflegeheim AG"}),true,"Employer alone is not a job classification");
assert.equal(isVisible({title:"Senior Software Developer (KI-gestützte Programmierung)",company:"Muster AG"}),false);
console.log("Career filter: "+hidden.length+" exclusions and "+visible.length+" allowed roles validated");
