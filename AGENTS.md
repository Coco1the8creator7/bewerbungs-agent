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
