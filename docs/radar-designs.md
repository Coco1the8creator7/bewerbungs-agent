# Radar-Designs und Ortungsinvariante (Career.Agency)

## Verbindliche Funktion
Die Radar-Animation visualisiert echte, neue Inserate aus dem bisherigen
`dashboard/jobs.json`; sie startet selbst keinen Live-Crawler. **Pro neues,
eindeutiges Inserat genau ein Punkt**, ohne feste dekorative Pings, Zufallspunkte
oder maximale Zeichenanzahl.

Zeitraum: «Seit gestern» (ab 00:00 gestern) oder «Diese Woche» (ab Montag,
00:00), jeweils bis zum aktuellen Zeitpunkt, gemäss lokaler Zeitzone des
Browsers. Das Datum ist `first_seen_at` (erstmaliger Import), nicht das
Publikationsdatum. Es gelten die bestehenden Regeln zur eindeutigen
Inserat-ID, demo-/testfreien Zählung und Trennung von `career` und
`apprentice`.

`dashboard/radar-model.js`: `newJobs(rows,now,market,period)` ist
**Single Source of Truth**. Sowohl die KPI-Zähler (`summarize`) als auch
der Renderer nutzen genau diese Liste. `radar-designs.js` erzeugt pro
Element ein `span.radar-target`, also **exakt N DOM-Punkte**. Es wird nichts
geclustert oder abgeschnitten. Bei hoher Dichte können sich Marker rein
optisch überlagern. Die Darstellung ist keine geografische Karte:
Positionen im Kreis sind deterministisch verteilt und enthalten keine
Standort-Koordinaten.

Die Daten werden beim Öffnen/Zurückkehren in den Radar, nach Wiedereinblenden
der Browserseite, alle 15 Minuten während sichtbarem Radar sowie durch den
Aktualisieren-Button neu geladen. Die zeitabhängigen KPI-Grenzen werden
zudem am lokalen Mitternachtswechsel neu berechnet. Zwischen zwei
Abrufen repräsentieren die Punkte den zuletzt erfolgreichen Feed.

## Gestaltungsvarianten
- Klassisch: bisheriges gedecktes Grün
- Sonar: dunkles Oliv mit grünem Sweep
- Topografie: topografisch inspirierte Konturlinien
- Orbit: mehrfache konzentrische Kreisbahnen
- Sektoren: Winkelteilung
- Minimal: helle reduzierte Scanfläche
- **Zen Radar (Standard):** vier langsame, vom Zentrum bis zum äusseren
  Kreis expandierende, sehr dünne olivgrüne Wellen auf warmem Elfenbein.
  Die Rotations-Sweep-Animation ist in diesem Modus ausgeblendet; der
  Zentrumspunkt ist ein statischer Sender und ausdrücklich **keine Ortung**.
  Die Wellen und die Miniatur-Vorschauen enthalten keine Job-Marker.
  Bei `prefers-reduced-motion` bleiben dezente statische Ringe bestehen.

Sechs zusätzliche Varianten; das klassische Radar bleibt auswählbar. Themenwahl
ändert ausschliesslich CSS und den dekorativen Puls-Container, nicht Inserate, Termine, CRM, Bewertungen
oder Matching. Kleine Designvorschauen haben absichtlich keine
Markerpunkte, damit diese nicht mit echten Ortungen verwechselt werden.
Die Designauswahl bleibt vorerst nur für die laufende Sitzung.

## Tests / bekannte Grenzen
`tests/radar-designs.test.cjs` prüft identische Datenlisten, deduplizierte
IDs und tatsächliche DOM-Knoten (0, 1, 8, 250, 1700); ausserdem Zeitraum-
und Themenwechsel ohne Zusatzpunkte. Bei extrem vielen Jobs ist nicht
garantiert, dass jeder Punkt auf einem kleinen Bildschirm räumlich
unterscheidbar bleibt; eine spätere Zoomfunktion wäre eine optionale
Erweiterung, nicht Voraussetzung für die korrekte Anzahl.
