# Lernmodus v1 – Jobs sammeln und Relevanz trainieren

Stand: 20.10.2026. Keine automatische Ablehnung oder Ausblendung wegen Relevanz.

## Produktiver Ablauf
1. GitHub Actions liest Gmail-Job-Abos. Der erste Lauf blickt bis zu 90 Tage zurück; nach erfolgreichen Läufen werden 48 Stunden überlappt und maximal fünf Nachrichten parallel geladen.
2. Für jobs.ch und publicjobs.ch werden Stellenlinks und wenn möglich Arbeitgeber/Ort aus E-Mails extrahiert. Links aus dem Footer sind keine Inserate. ewz und Energie 360° haben mangels echter Mails nur einen generischen Adapter und müssen bei den nächsten eingehenden Alerts überprüft werden.
3. Der Importer prüft technische Dubletten, er verwirft **keine** Stellen aufgrund ihrer fachlichen Relevanz.
4. Nach dem Import ergänzt `selector/score.py` einen unverbindlichen Score `selection.suggested_score` zwischen 1 und 100. `selection.exclusion` ist immer `false`. Dies ist **kein persönlicher Fit-Score** und noch kein lernendes Modell.
5. Das öffentliche `dashboard/jobs.json` wird aktualisiert und GitHub Pages veröffentlicht.

## Bewertung im Dashboard
- Jede neue Inseratekarte bietet eine numerische Relevanz-Eingabe von **1–100**.
- Über **Details** kann ein Grund ergänzt werden: `field`, `distance`, `seniority`, `tasks`, `employer`, `conditions`.
- Der Inseratetitel öffnet direkt die Original-Stelle.
- Der Knopf **Bewertungen exportieren** oberhalb der Inseratekarten erzeugt ein lokales JSON vom Typ `bewerbungs-agent-relevance-feedback` (Version 1.0.0). Es enthält nur bewusst abgegebene Scores, Gründe und Inseratkontext; keine privaten Notizen oder Bewerbungsstatus.
- Diese Datei kann in einem separaten Chat zur Trainingsauswertung hochgeladen werden. **Es gibt noch kein automatisches serverseitiges Training.**
- Für dauerhafte Speicherung zwischen Browser-Sitzungen muss im Footer **Daten & Entwicklung → Auf diesem Gerät dauerhaft speichern** aktiviert sein. Diese IndexedDB-Speicherung ist gerätegebunden. Vor Browserwechsel oder Gerätewechsel die Gesamtsicherung exportieren und auf dem anderen Gerät importieren.

## Datenschutz und Grenzen
Das Repo und GitHub Pages sind öffentlich. Bewertungen und Bewerbungsnotizen werden nicht automatisch an GitHub gesendet. Sie dürfen niemals in `dashboard/jobs.json`, einem öffentlichen Commit oder PR landen. Der Bewertungs-JSON-Export ist privat aufzubewahren. Dies ist bewusst der kostenlose, einfach wartbare Übergang ohne Feedback-API.

**Wichtig:** Der GitHub-Importer kann Daten nur aus Joblinks gewinnen, die in einer tatsächlichen Mail enthalten sind. Eine Betreffzeile mit hunderten Treffern bedeutet nicht hunderte exportierte Inserate. Die Quellenabdeckung muss bei neuen Job-Abos weiter kalibriert werden.
