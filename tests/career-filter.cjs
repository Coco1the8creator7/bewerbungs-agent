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
  ["Projektleiter:in Bau-Entwicklungsplanung 80-100 %","Universitätsspital Zürich"],
  ["Projektleiter Medizintechnik","Muster Engineering AG"],
  ["Ingenieur für Energieversorgung im Krankenhaus","Ingenieur AG"],
  ["Fachspezialist*in Netzinformationssysteme (GIS, CAD)","ewz"],
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
assert.equal(isVisible({title:"Bauleiter:in Hochbau",company:"Universitätsspital Zürich",description:"Patientenversorgung Klinik"}),false);
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
 "Fachbauleiter Fernwärme Universitätsspital",
 "Projektleitung KI-Agenten Innovation"
];
for(const title of careerTitles){
 const r=classify({title,company:"Engineering AG"});
 assert.equal(r.visible,true,"Must keep cross-entry: "+title);
 assert.equal(r.version,"career-preselector-v2.1");
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


// 31.10.2026: user-confirmed discipline exclusions and PRIMARY-only heat focus.
const excludedByScope=[
 ["Junior Projektleiter Elektro 80-100%","electrical_trade"],
 ["Netzelektriker EFZ","electrical_trade"],
 ["Fachbauleiter Elektrotechnik","electrical_trade"],
 ["Projektleiter Sanitär und Heizung","sanitary_trade"],
 ["Fachbauleiter Sanitär","sanitary_trade"],
 ["Projektleiter Lüftung","ventilation_trade"],
 ["Technischer Verkaufsberater Komfortlüftung","ventilation_trade"],
 ["Teamleiter Betrieb HLK","ventilation_trade"],
 ["Projektleiter HLKS im Spital","ventilation_trade"],
 ["Projektentwickler Fassadenbau","building_construction"],
 ["Projektleiter Hochbau","building_construction"],
 ["Projektleiter Innenausbau","building_construction"],
 ["Fachbauleiter Hochbau","building_construction"],
 ["Bauleiter Fernwärme","general_construction_supervision"],
 ["Projekt- und Bauleitung Construction & Design Services","general_construction_supervision"],
 ["Oberbauleiter Energiezentrale","general_construction_supervision"],
 ["Gesamtprojektleiter / Oberbauleiter","general_construction_supervision"],
 ["Bauleiter Neubau Universitätsspital","general_construction_supervision"],
 ["Heizungsinstallateur","secondary_heating"],
 ["Gebäudetechnikplanerin Heizung / Kälte","secondary_heating"],
 ["Fachbauleiter Heizung Sekundärseite","secondary_heating"],
 ["Projektleiter thermische Netze Sekundärseite","secondary_heating"]
];
for(const [title,reason] of excludedByScope){
 const result=classify({title,company:"Ingenieurbüro AG"});
 assert.equal(result.visible,false,"Excluded role: "+title);
 assert.equal(result.reason,reason,"Wrong exclusion for "+title);
 assert.equal(result.exclusion,true);
}
const safelyVisible=[
 "Fachbauleiter Rohrleitungsbau Fernwärme",
 "Fach-Bauleiter Fernwärmenetz",
 "Projektleiter Primärseite Fernwärme",
 "Projektleiter Wärmeverbund und Netztrassen",
 "Projektleiter thermische Netze",
 "Projektleiter Heizung", // Unknown: not silently made secondary
 "Projektleiter Wärmetechnik", // Unknown: role-level evidence is insufficient
 "Fachbauleiter Heizung", // Fachbauleitung allowed; heating side unknown
 "Projektleiter Tiefbau / Leitungsbau",
 "Ingenieur Energieversorgung im Universitätsspital",
 "Projektleiter KI-Agent Innovation"
];
for(const title of safelyVisible){
 assert.equal(classify({title}).visible,true,"Keep: "+title);
}
const cases=[
 [{title:"Projektleiter Heizung",description:"Planung der Heizkörper und Heizkreise für Mehrfamilienhäuser"},false,"secondary"],
 [{title:"Projektleiter Heizung",description:"Sekundärseitige Heizungsanlagen auslegen und projektieren"},false,"secondary"],
 [{title:"Projektleiter Fernwärme",description:"Schnittstellen zu Heizkreisen auf der Sekundärseite koordinieren"},true,"primary"],
 [{title:"Projektleiter Heizung",description:"Koordination mit der Primärseite und Sekundärseite"},true,"undetermined"],
 [{title:"Servicetechniker Wärmepumpen",description:null},true,"undetermined"],
 [{title:"Fachbauleiter Fernwärme",description:"Baustellenleitung und Qualitätssicherung"},true,"primary"],
 [{title:"Projektleiter Heizung Primärseite",description:"Heizkörper als Schnittstelle"},true,"primary"]
];
for(const [job,visible,side] of cases){
 const got=classify(job);
 assert.equal(got.visible,visible,"Side check for "+job.title+" / "+job.description);
 assert.equal(got.heating_side,side,"Side category for "+job.title+" / "+job.description);
}
assert.equal(classify({title:"Projektleiter Elektro und Fernwärme Primärseite"}).reason,"electrical_trade",
 "A trade role does not become thermal network engineering just by mentioning Fernwärme.");
