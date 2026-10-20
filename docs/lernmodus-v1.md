# Lernmodus v1 – Jobs sammeln und Relevanz trainieren

Stand: 20.10.2026. Keine automatische Ablehnung oder Ausblendung wegen Relevanz.

## Produktiver Ablauf
1. GitHub Actions liest Gmail-Job-Abos. Der erste Lauf blickt bis zu 90 Tage zurück; nach erfolgreichen Läufen werden 48 Stunden überlappt und maximal fünf Nachrichten parallel geladen.
2. Für jobs.ch und publicjobs.ch werden Stellenlinks und wenn möglich Arbeitgeber/Ort aus E-Mails extrahiert. Links aus dem Footer sind keine Inserate. ewz und Energie 360° haben mangels echter Mails nur einen generischen Adapter und müssen bei den nächsten eingehenden Alerts überprüft werden.
3. Der Importer prüft technische Dubletten, er verwirft **keine** Stellen aufgrund ihrer fachlichen Relevanz.
4. Nach dem Import ergänzt `selector/score.py` einen unverbindlichen Score `selection.suggested_score` zwischen 1 und 100. `selection.exclusion` ist immer `false`. Dies ist **kein persönlicher Fit-Score** und noch kein lernendes Modell.
5. Das öffentliche `dashboard/jobs.json` wird aktualisiert und GitHub Pages veröffentlicht.

## Bewertung im Dashboard
- Jede **neue Inseratekarte** zeigt einen Slider von **1–100**, dessen Zahl live sichtbar wird. Bis zur ersten aktiven Veränderung bleibt die Stelle ausdrücklich **unbewertet**; die mittige Sliderposition ist kein vergebener Score.
- Direkt unter dem Slider stehen die sechs Bewertungsgründe als **Mehrfachauswahl-Buttons**: Berufsfeld (`field`), Arbeitsweg (`distance`), Seniorität (`seniority`), Aufgaben (`tasks`), Arbeitgeber (`employer`), Arbeitsbedingungen (`conditions`). Gründe ohne Zahl dürfen erfasst werden, gehen aber **nicht** als vollständiges Trainingsbeispiel in den Bewertungs-Export ein.
- Das **Disketten-Symbol** rechts oben auf der Inseratekarte dient ausschliesslich als **Markierung für einen späteren selektiven Inserate-Export**. Die aktive Markierung wird zurückhaltend **grün** dargestellt. Sie ändert weder Bewerbungsstatus noch Relevanz noch den GitHub-Feed und speichert nichts im Repository.
- **Markierte Inserate exportieren** erzeugt eine private Datei vom Typ `bewerbungs-agent-marked-jobs` v1.0.0 mit den aktuell vorhandenen markierten Stellen und – wenn vergeben – den zugehörigen Relevanzwerten und Gründen. Der bisherige Footer-Export **Inserate-JSON exportieren** exportiert weiterhin alle Inserate.
- **Bewertungen exportieren** erzeugt weiterhin ein lokales JSON vom Typ `bewerbungs-agent-relevance-feedback` v1.0.0, unabhängig von der Diskettenmarkierung. Es enthält nur bewusst abgegebene numerische Scores, `reason` (erstes Label, kompatibel mit bisherigen Exporten), neu das Feld `reasons` (mehrere Codes) sowie Inseratkontext. Keine privaten Notizen oder Bewerbungsstatus.
- Über **Details** lassen sich Zahl und die gleichen sechs Gründe bearbeiten. Die bestehenden älteren Einträge mit einem einzelnen `reason` werden beim Laden in die neue Mehrfachauswahl übernommen.
- Die Markierung (`export_selection`) und die Bewertungsgründe (`relevance_ratings[].reasons`) werden nur in der optionalen gerätegebundenen IndexedDB-Speicherung und in privaten **Gesamtsicherungen v0.3** gehalten. Vorhandene v0.3-Sicherungen ohne diese optionalen Felder bleiben lesbar.
- Diese Bewertungsdatei kann in einem separaten Chat zur Trainingsauswertung hochgeladen werden. **Es gibt noch kein automatisches serverseitiges Training, keine automatische Aussortierung und keine öffentliche Speicherung der Bewertungen.**

## Kriterienfeedback v2 (20.10.2026)

Die Hauptbewertung bleibt **1–100** und ist vollständig unabhängig vom Kriterienfeedback.

- **Arbeitsweg** (`distance`), **Aufgaben** (`tasks`), **Arbeitgeber** (`employer`) und **Arbeitsbedingungen** (`conditions`): jeweils eine unmittelbar bedienbare Rot–Neutral–Grün-Farbfläche mit unsichtbarem Range-Eingabeelement. Die Richtung des Effekts und seine Stärke werden als ganzzahliger Wert von **−100** (sehr negativ) bis **+100** (sehr positiv) gespeichert. **0** ist eine bewusste neutrale Bewertung; *nicht angefasst* bedeutet **nicht bewertet** und bleibt ohne Schlüssel. Ein × neben der Farbfläche setzt nur diesen Teilwert zurück.
- **Berufsfeld** (`field_relation`): genau eine von `unrelated` (keinerlei Berufsverwandtheit), `transferable` (erkennbare Erfahrung) oder `aligned` (richtiges Berufsfeld); Klick auf die aktive Auswahl hebt sie auf.
- **Seniorität** (`seniority_assessment`): genau eine von `underchallenging` (unterfordernd), `too_early` (zu jung bzw. noch wenig Erfahrung, aber potenzielle Entwicklung), `good_chance` (gute Chance) oder `overwhelming` (absolute Überforderung). **Diese Labels sind Kategorien, keine automatische lineare Skala.**

Beispiel für einen **bewerteten** Export (`schema_version: 1.1.0`):

```json
{
  "user_score": 78,
  "aspects": {"distance": -75, "tasks": 60, "employer": 20},
  "field_relation": "aligned",
  "seniority_assessment": "good_chance"
}
```

Bestehende v0.3-Gesamtsicherungen und frühere Einzelgründe unter `reason` oder `reasons` bleiben lesbar; der Altbestand erscheint im Export zusätzlich als `legacy_reasons`. Alte pauschale Gründe werden **nicht** in neue Skalenwerte umgedeutet. Die Kriterien werden nur lokal bzw. in privaten Exporten gespeichert. Im Export ist `ratings` die Menge vollständig bewerteter Jobs, `unrated_feedback` enthält separat Eingaben ohne 1–100-Gesamtscore. Beide sind keine automatische Vorselektion.

## Datenschutz und Grenzen
Das Repo und GitHub Pages sind öffentlich. Bewertungen und Bewerbungsnotizen werden nicht automatisch an GitHub gesendet. Sie dürfen niemals in `dashboard/jobs.json`, einem öffentlichen Commit oder PR landen. Der Bewertungs-JSON-Export ist privat aufzubewahren. Dies ist bewusst der kostenlose, einfach wartbare Übergang ohne Feedback-API.

**Wichtig:** Der GitHub-Importer kann Daten nur aus Joblinks gewinnen, die in einer tatsächlichen Mail enthalten sind. Eine Betreffzeile mit hunderten Treffern bedeutet nicht hunderte exportierte Inserate. Die Quellenabdeckung muss bei neuen Job-Abos weiter kalibriert werden.
