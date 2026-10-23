/* Career.Agency: display-only exclusion of clinical and classical IT roles.
   Keep original jobs, IDs, ratings and CRM data unchanged. */
(function (root) {
  "use strict";
  const clinical = [
    /\b(?:ober|chef|assistenz|fach|haus|kinder|notfall|leitend[ea]n?)?aerz(?:t|te|tin)\b/,
    /\barzt\b/, /\bpflege(?:fach|helfer|expert|personal|dienst|leitung|kraft|beruf|assistent|person|mann|frau)?\w*\b/,
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
    /\b(?:cloud\w*|azure|aws|kubernetes|sap|erp|cyber\w*|security engineer|information security|it security|informationstechnolog\w*)\b/,
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
  const hospitalContext = /\b(?:spital\w*|klinik\w*|krankenhaus\w*|hospital\w*|hirslanden|usz|gesundheitszentrum\w*)\b/;
  const hospitalEngineering = /\b(?:bauleiter\w*|bauprojekt\w*|bauingenieur\w*|hochbau|tiefbau|baumanagement|bauentwicklungsplanung|bau[- ]?entwicklungsplanung|bauherrenvertret\w*|gebaeudetechnik|haustechnik|hlk|hlks|tga|heizung\w*|lueftung\w*|kaelte\w*|energieversorgung\w*|energieprojekt\w*|betriebstechnik|betriebsingenieur\w*|versorgungstechnik|facility management|technisch\w* dienst|medizintechnik|medizin[- ]?technik)\b/;
  const fold = v => String(v || "").toLocaleLowerCase("de").replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[\u0300-\u036f]/g,"").replace(/[\s_]+/g," ").trim();
  const matches = (patterns, title) => patterns.some(re => re.test(title));
  function classify(job) {
    const title = fold(job && job.title);
    const company = fold(job && job.company);
    if (!title) return {visible:true, reason:null};
    if (matches(agentInnovation, title)) return {visible:true, reason:"agent_innovation_exception"};
    if (hospitalContext.test(title + " " + company) && hospitalEngineering.test(title))
      return {visible:true, reason:"hospital_engineering_exception"};
    // Technical medical-device engineering is engineering, not patient care.
    if (hospitalEngineering.test(title) && /\b(?:medizintechnik|medizin[- ]?technik)\b/.test(title))
      return {visible:true, reason:"medical_engineering_exception"};
    if (matches(clinical,title)) return {visible:false, reason:"healthcare_role"};
    if (matches(classicalIT,title)) return {visible:false, reason:"it_role"};
    return {visible:true, reason:null};
  }
  const isVisible = job => classify(job).visible;
  const api = Object.freeze({classify,isVisible});
  root.AgentCareerFilter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
