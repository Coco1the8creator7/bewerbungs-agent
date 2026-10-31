/* Career.Agency: display-only exclusion of clinical and classical IT roles.
   Keep original jobs, IDs, ratings and CRM data unchanged. */
(function (root) {
  "use strict";
  const clinical = [
    /\b(?:ober|chef|assistenz|fach|haus|kinder|notfall|leitend[ea]n?)?aerz(?:t|te|tin)\b/,
    /\b(?:ober|chef|assistenz|fach|haus|kinder|notfall|leitend\w*)?arzt\w*\b/, /\bpflege(?:fach|helfer|expert|personal|dienst|leitung|kraft|beruf|assistent|person|mann|frau)?\w*\b/,
    /\bfage\b/, /\b(?:fachperson|fachfrau|fachmann) gesundheit\b/,
    /\b(?:medizinisch\w*|clinical|klinisch\w*|patient\w*|nurse|nursing|hebamme|midwife|mpa)\b/,
    /\b(?:physiotherap\w*|ergotherap\w*|psychotherap\w*|psycholog\w*|rheumatolog\w*|geriatr\w*|nephrolog\w*|radiolog\w*|onkolog\w*|chirurg\w*|intensivmedizin\w*)\b/,
    /\b(?:pharmazeut\w*|apotheker\w*|dental\w*|zahnaerzt\w*|rettungssanitaet\w*|operationstechnisch\w*)\b/,
    /\blaborant\w*\b.*\b(?:biolog\w*|medizin\w*|diagnostik|mikrobiolog\w*)\b/,
    /\b(?:betreuungsfachperson|fachperson betreuung|langzeitbetreuung|pflegeheimleitung)\b/
  ];
  const classicalIT = [
    /\b(?:it|ict|informatik|informatiker\w*|wirtschaftsinformatik\w*|edv)\b/,
    /\b(?:software\w*|webentwickl\w*|webdevelop\w*|frontend|backend|full[ -]?stack|devops|developer\w*|programmierer\w*|coding)\b/,
    /\b(?:cloud\w*|azure|aws|kubernetes|sap|erp|cyber\w*|security engineer|information security|security infrastructure engineer|security consultant|it security|informationstechnolog\w*)\b/,
    /\b(?:applikations\w*|datenbank\w*|data scientist|data engineer|data analyst|systemadministrat\w*|system engineer|systemarchitekt\w*|network engineer|netzwerkadministrat\w*)\b/,
    /\b(?:solution architekt\w*|solution architect\w*|softwarearchitekt\w*|product owner|digital ecosystem|digital platform|digital product|it auditor|grc consultant)\b/,
    /\b(?:c#|c\+\+|react|java developer|python developer|sql developer)\b/
  ];
  // AI/agent automation is an explicit career-path exception, not a blanket
  // exception for software jobs that merely mention using AI as a coding tool.
  const agentInnovation = [
    /\b(?:ki|ai)[ -]?(?:agent\w*|innovation\w*|automatisierung\w*|automation|orchestrierung\w*|transformation\w*)\b/,
    /\b(?:agentic[ -]?(?:ai|automation)|intelligent\w* agent\w*|agenten[- ]?innovation|agenten[- ]?automatisierung)\b/,
    /\bprozessautomatisierung\b.*\b(?:ai|ki)\b/,
    /\b(?:ai|ki)\b.*\bprozessautomatisierung\b/
  ];
  // A hospital is not itself a reason for exclusion. Technical construction
  // and facility/infrastructure roles in hospitals must remain visible.
  const hospitalContext = /\b(?:\w*(?:spital|klinik)\w*|krankenhaus\w*|hospital\w*|hirslanden|usz|gesundheitszent(?:rum|ren)\w*|pflegeheim\w*|alterszentrum\w*)\b/;
  const hospitalEngineering = /\b(?:bauleiter\w*|bauprojekt\w*|bauingenieur\w*|hochbau|tiefbau|baumanagement|bauentwicklungsplanung|bau[- ]?entwicklungsplanung|bauherrenvertret\w*|gebaeudetechnik|haustechnik|technisch\w* hauswart|hauswart\w*|facility\w*|hlk|hlks|tga|heizung\w*|lueftung\w*|kaelte\w*|energieversorgung\w*|energiekonzept\w*|energieberatung\w*|energieplanung\w*|energieprojekt\w*|betriebstechnik|betriebsingenieur\w*|versorgungstechnik|facility management|technisch\w* dienst|medizintechnik|medizin[- ]?technik)\b/;
  const fold = v => String(v || "").toLocaleLowerCase("de").replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[\u0300-\u036f]/g,"").replace(/[\s_]+/g," ").trim();
  const matches = (patterns, title) => patterns.some(re => re.test(title));
  // V2: transparent and intentionally conservative. Learned *directions* from
  // explicit manual feedback, not fitted coefficients or an applicant CV.
  // A low priority score NEVER removes a job; only unambiguous occupation
  // families are parked for inspection in Radar > Bewertungs-Hub.
  const outOfScope = [
    /\b(?:koch|koechin|kuechenhilfe|kuechenmitarbeiter\w*|gastronomiefach\w*|servicemitarbeiter\w* gastronomie|restaurationsfach\w*)\b/,
    /\b(?:coiffeur\w*|friseur\w*|florist\w*|kosmetiker\w*|nageldesign\w*|tierpfleger\w*)\b/,
    /\b(?:reinigungskraft\w*|reinigungsmitarbeiter\w*|zimmermaedchen|housekeeping|hauswirtschaftsmitarbeiter\w*)\b/,
    /\b(?:chauffeur\w*|lieferfahrer\w*|paketzusteller\w*|kassierer\w*|detailhandelsfach\w*|verkaufsmitarbeiter\w* detailhandel)\b/,
    /\b(?:cleanroom fabrication|quantum device|quantenphysik|quantencomput\w*|mikrofabrikation)\b/
  ];
  // User-confirmed scope, 31.10.2026:
  // A trade in the ROLE TITLE is enough to park it. Merely coordinating
  // another trade in the description is not a role-level exclusion.
  const excludedTrades = [
    ["electrical_trade", /\b(?:elektro\w*|elektriker\w*|elektronik\w*|netzelektriker\w*|elektrisch\w* installat\w*)\b/],
    ["sanitary_trade", /\b(?:\w*sanitaer\w*)\b/],
    ["ventilation_trade", /\b(?:\w*lueft\w*|raumluft\w*|ventilation\w*|hlk\w*)\b/]
  ];
  // Architectural building construction is distinct from primary heat
  // networks. Don't reject all 'Bauprojekt...' or 'Projektleiter Tiefbau':
  // those titles may describe civil works for district heating.
  const buildingConstruction = /\b(?:hochbau\w*|fassaden\w*|innenausbau\w*|ausbaugewerk\w*|wohnungsbau\w*|architektur\w*|architekt\w*|immobilienprojekt\w*|gebaeudeneubau\w*)\b/;
  const fachBauleitung = /\bfach(?:[- ]?bauleit(?:er(?:in)?|ung|end\w*)\w*)\b/;
  const ordinaryBauleitung = /\b(?:\w*bauleit(?:er(?:in)?|ung|end\w*)\w*)\b/;
  // This is about PRIMARY distribution networks (Fernwärme/thermische Netze),
  // NOT building-internal secondary heating systems. Heat generation and the
  // handover station can be interfaces; do not guess a side from them alone.
  const heatingRole = /\b(?:fernwaerm\w*|waermenetz\w*|waermeverbund\w*|thermisch\w* netz\w*|waermeversorgung\w*|waermetechnik\w*|heiz\w*|waermepump\w*|gebaeudetechnik\w*|hlk\w*)\b/;
  const primaryTitle = /\b(?:primaer(?:seit\w*|netz\w*)?|fernwaerm\w*|fernkaelt\w*|waermenetz\w*|waermeverbund\w*|thermisch\w* netz\w*|netzausbau\w*|netztrasse\w*|trassenplan\w*)\b/;
  const secondaryTitle = /\b(?:sekundaer(?:seit\w*|netz\w*)?|heizungsinstallat\w*|heizungsmonteur\w*|heizkoerper\w*|fussbodenheiz\w*|raumheiz\w*|gebaeudeheiz\w*|heizungsverteilung\w*)\b/;
  const buildingHeatingTitle = /\bgebaeudetechnikplan\w*\b.*\bheiz\w*\b|\bheiz\w*\b.*\b(?:efh|mfh|wohngebaeude\w*|heizzentrale(?:n)? im gebaeude)\b/;
  const secondaryDescription = /\b(?:heizkreis\w*|heizkoerper\w*|fussbodenheiz\w*|raumheiz\w*|heizungsverteilung\w*|gebaeudeintern\w* heiz\w*|heizungsinstallat\w* im gebaeude)\b/;
  const careerSignals = [
    ["thermal_networks", /\b(?:fernwaerm\w*|waermenetz\w*|thermisch\w* netz\w*|rohrleitungsbau|waermeversorgung\w*)\b/, 33],
    ["project_management", /\b(?:projektleit\w*|projektmanag\w*|projektkoordin\w*|fachbauleit\w*|bauleit\w*|bauherrenvertret\w*)\b/, 19],
    ["energy", /\b(?:energieberat\w*|energiecontroll\w*|energiekonzept\w*|energieplanung\w*|energietechnik\w*|energieversorg\w*|waermepump\w*)\b/, 21],
    ["infrastructure", /\b(?:infrastrukt\w*|tiefbau\w*|gebaeudetechnik\w*|hlks|heizung\w*|kaeltetechnik\w*|netzentwickl\w*)\b/, 13],
    ["climate_environment", /\b(?:klima\w*|umwelt\w*|nachhaltig\w*|erneuerbar\w*|energiewend\w*|dekarbonisier\w*|foerderprogramm\w*)\b/, 13],
    ["technical_sales", /\b(?:technisch\w* vertrieb\w*|technisch\w* verkauf\w*|sales engineer\w*|account manager\w*|kundenberat\w*|verkaufsberat\w*)\b/, 10],
    ["career_adjacency", /\b(?:projektingenieur\w*|projektadministration\w*|projektassistenz\w*|lichtdesign\w*|gis\b|cad\b|kommunal\w* projekt\w*)\b/, 9]
  ];
  const advancedSeniority = /\b(?:geschaeftsfuehr\w*|geschaeftsleit\w*|direktor\w*|chief\b|head of\b|leitung \w+region|leiter\w* strassenregion)\b/;
  const transferableOverride = /\b(?:projektleit\w*|projektmanag\w*|bauleit\w*|energie\w*|technisch\w*|infrastruktur\w*)\b/;
  function classify(job) {
    const title = fold(job && job.title);
    const company = fold(job && job.company);
    const description = fold(job && job.description);
    const version="career-preselector-v2.1";
    if (!title) return {visible:true,reason:null,priority:40,reason_codes:[],version,exclusion:false,heating_side:"not_applicable"};
    const innovation = matches(agentInnovation, title);
    const hospitalRole = hospitalContext.test(title + " " + company) && hospitalEngineering.test(title);
    const medicalEngineering = hospitalEngineering.test(title) && /\b(?:medizintechnik|medizin[- ]?technik)\b/.test(title);
    const isHeatRelated = heatingRole.test(title);
    const explicitlySecondary = isHeatRelated && secondaryTitle.test(title);
    const clearlyBuildingHeating = isHeatRelated && buildingHeatingTitle.test(title);
    const hasPrimaryTitle = isHeatRelated && primaryTitle.test(title);
    // Text may mention an interface to secondary systems while the advertised
    // role works on the primary network. Title controls role classification.
    const secondaryFromTasks = isHeatRelated && !hasPrimaryTitle && secondaryDescription.test(description);
    const heating_side = !isHeatRelated?"not_applicable":
      explicitlySecondary||clearlyBuildingHeating||secondaryFromTasks?"secondary":
      hasPrimaryTitle?"primary":"undetermined";
    let reason = null;
    const trade=excludedTrades.find(([,pattern])=>pattern.test(title));
    if(trade) reason=trade[0];
    else if(buildingConstruction.test(title)) reason="building_construction";
    else {
      // 'Fachbauleiter:in' (including hyphenated variants) is deliberately
      // retained, but 'Bauleiter:in' and generic Bauleitung are not.
      const withoutFach=title.replace(/\bfach[- ]?bauleit\w*\b/g," ");
      if(ordinaryBauleitung.test(withoutFach)) reason="general_construction_supervision";
      else if(heating_side==="secondary") reason="secondary_heating";
    }
    // Existing exclusions stay in force, but the newly confirmed discipline
    // exclusions OVERRIDE legacy hospital/AI exceptions.
    if (!reason && !innovation && !hospitalRole && !medicalEngineering) {
      if (matches(clinical, title)) reason = "healthcare_role";
      else if (matches(classicalIT, title)) reason = "it_role";
      else if (hospitalContext.test(title + " " + company)) reason = "healthcare_employer";
    }
    if (!reason && matches(outOfScope, title) && !transferableOverride.test(title)) reason = "out_of_scope_role";
    let priority = 37;
    const reason_codes = [];
    let descriptionBonus = 0;
    for (const [code, pattern, weight] of careerSignals) {
      if (pattern.test(title)) {priority += weight;reason_codes.push(code);}
      else if (pattern.test(description)) {descriptionBonus += Math.ceil(weight / 4);reason_codes.push(code + "_context");}
    }
    priority += Math.min(12,descriptionBonus);
    if (advancedSeniority.test(title)) {priority -= 14;reason_codes.push("advanced_seniority");}
    if (isHeatRelated) reason_codes.push("heating_"+heating_side);
    priority = Math.max(1,Math.min(99,priority));
    if (reason) priority = Math.min(priority,19);
    if (innovation) reason_codes.push("agent_innovation_exception");
    if (hospitalRole) reason_codes.push("hospital_engineering_exception");
    if (medicalEngineering) reason_codes.push("medical_engineering_exception");
    return {visible:!reason,reason,priority,reason_codes,version,exclusion:!!reason,heating_side};
  }
  const isVisible = job => classify(job).visible;
  const api = Object.freeze({classify,isVisible});
  root.AgentCareerFilter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
