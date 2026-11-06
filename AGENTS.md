# Career.Agency — project guidance for future UI and feature work

## Global UI decisions (27 October 2026)

Follow the existing **Onest**, **Urban Mono** and **muted-magenta**
design system in `dashboard/urban-mono-magenta.css`, including its
semantic `--ca-*` tokens. Prefer quiet surfaces, clear typography and
comfortable whitespace to decorative interface chrome.

**Treat the screenshot-based Radar cleanup as a general default for new
features and pages:**

- Give each area **one useful, plain-language heading**. Do not repeat the
  product name, module name or feature title in extra micro-headlines.
- **No technical phase/kicker labels, version badges or numbered tab
  prefixes** in ordinary customer-facing UI (e.g. "SCAN / 01",
  "IMPORT / STATUS", "02 Meine Stärken", "PROTOTYPE 0.2").
- Surface **primary metrics and actions**, not explanatory paragraphs
  that merely describe the visible number or restate how an import works.
  Put essential explanation in contextual help/details only if genuinely
  needed for correct decisions.
- **Keep success/loading metadata quiet by default.** Show concise,
  accessible errors and situations requiring action. Do not replace
  meaningful errors with blank screens.
- Do not add nonessential count badges like "all sources selected" to
  checkbox groups when the selected state is already visible.
- Avoid extra visible buttons for functionality that already updates
  automatically. Keep controls that actually influence a decision,
  including filters and time windows.
- Keep notifications in the context where requested. On Radar, hide the
  header bell; **preserve** the existing notification feature on the
  Startseite and existing relevant modes.
- Avoid introducing unnecessary new concepts, ornamental controls,
  onboarding banners or repeated disclaimer text in a mature dashboard.
- On mobile and tablet, check that useful information remains legible,
  tap targets remain accessible and layouts have enough breathing room.

## Functional and technical guardrails

- Never drop, overwrite or expose existing job, CRM, Gmail-import,
  review or application data to simplify the UI.
- The animated Radar has **exactly one actual target DOM point per new,
  uniquely identified imported job** in the selected local time window;
  its decorative concentric Zen waves never count as jobs.
- Keep youth apprenticeship and adult job-search profiles distinct.
- Source data and privacy notices stay accurate; when removing visible
  copy, preserve important explanations in accessible or contextual
  help if necessary.
- Use global design tokens rather than hardcoded older sage/beige colors.
- For a removal or visual simplification, also remove dead JS references
  and update regression tests, including an explicit negative assertion
  that obsolete UI text or selectors cannot return unnoticed.

This is a **design and implementation convention**, not an instruction to
remove controls from unrelated existing pages without an explicit user
request. If a feature genuinely requires a status, label, help text,
validation warning or user approval, include it clearly.

## Mandatory AI development workflow (6 November 2026)

These rules apply to **all AI assistants and coding agents** making proposals or changes for Career.Agency. They supplement — and must not override — the UI, functional and privacy guardrails above. Scale effort to the actual risk: do not block trivial, clearly scoped changes with unnecessary meetings or questions.

### Gate 1 — check concept and feasibility *before* consequential implementation

Before changing code, inspect the existing implementation and the relevant dependencies. For a complex, ambiguous, high-impact or architecture-changing request, assess feasibility, system architecture, alternatives, likely effort, data implications, operational costs, risks and potential side effects.

If important design decisions remain unresolved, **warn before implementation** under the heading **"Konzeption vor Umsetzung erforderlich"**. State the specific gaps, risks, viable alternatives and a recommended approach. Suggest a limited proof of concept where appropriate. Do not silently turn a large feature request into an unreviewed architecture change.

A request to "implement directly" does not cancel this check. For simple, low-risk, sufficiently specified changes, proceed without introducing needless approval steps. When uncertainty is immaterial, document assumptions and proceed with a safe, reversible approach.

### Gate 2 — implement narrowly and verify the outcome

- Preserve existing functionality, interfaces, users' data and approved UI unless the task explicitly requires otherwise.
- Prefer focused, reversible changes with clear version control; check callers and dependencies rather than editing in isolation.
- Define or infer concrete acceptance criteria before editing. Validate the requested behavior, regression risks, failure/edge cases, data integrity, security and relevant integrations.
- Run applicable automated tests and build or syntax checks **when the environment permits**. Add or update regression tests for changed behavior. Inspect results and report failures.
- Never equate "code written", "tests passed", "deployed" and "verified in production". Do not report tests, deployment or functionality as successful unless actually observed. If a check cannot be run, label it **not verified**.

**After every implementation**, provide a concise **Abnahmebericht** (acceptance report):
1. **Umgesetzt** — what was changed; relevant files and commit/PR links if available.
2. **Verifiziert** — checks actually executed and their observed outcomes.
3. **Nicht verifiziert** — tests, functionality and assumptions that remain unchecked.
4. **Risiken** — known defects, side effects, security concerns and technical debt.
5. **Status** — `Bereit zur Abnahme`, `Eingeschränkt funktionsfähig` or `Nicht abnahmefähig`, based on evidence. The user retains final acceptance authority.

### Gate 3 — independently challenge assumptions and decisions

Act as a critical reviewer, not just an agreeable implementer. For decisions that affect product behavior, architecture, security, privacy, stability or cost:

- Check user assumptions **and** the assistant's earlier suggestions and implementations for contradictions, missing evidence and likely failure modes.
- Compare simpler, more robust and more economical approaches. Explain substantive objections and recommend the best-supported option rather than agreeing automatically.
- Distinguish claims as **Verifiziert** (supported by an actual check or reliable source), **Plausibel** (reasoned but unconfirmed), **Ungeklärt** (insufficient evidence) or **Widerlegt** (contradicted by evidence). Never invent sources, test results or technical guarantees.
- Use the heading **"Kritischer Prüfhinweis"** when a material concern warrants user attention. Summarize the issue, consequence and suggested alternative.
- Apply heightened scrutiny to authentication, credentials, personal application documents, data migrations, public repositories, deployments, destructive operations and any production-connected integrations.
- Avoid contrarian commentary with no concrete benefit; do not reopen previously resolved decisions without new evidence.

These gates are **operating rules**, not a substitute for actually executing tests or for the user's acceptance of results. If tool access or permissions prevent a required action, report the limitation explicitly instead of claiming completion.
