# Career.Agency – Vorselektor v2 (27.10.2026)

## Beschluss
Die bereits vorhandenen Berufsfeld-Ausschlüsse werden um wenige eindeutige fachfremde Tätigkeiten ergänzt. Alle anderen Stellen bleiben selbst bei niedriger automatischer Priorität sichtbar. Für die Erwachsenenansicht wird eine transparente V2-Priorität als **Sortierhilfe** berechnet. Filterwirkung besteht ausschliesslich im Frontend, nicht im Importer und nicht in den JSON-Rohdaten.

## Bewertungssystem
`dashboard/career-filter.js` liefert `classify(job)`: `visible`, `reason`, `priority` (1–99), `reason_codes`, `version`, `exclusion`. Die Gewichtungen bilden vorläufige Hypothesen aus ausdrücklichen persönlichen Bewertungen ab, **kein statistisch trainiertes Modell**. Fachbauleitung/Fernwärme, Projektleitung, Energietechnik und benachbarte Berufsfelder bekommen Prioritätsboni. Unklare Tätigkeiten bleiben sichtbar; eine niedrige Priorität ist keine Ausschlussbedingung. Technische Spitalberufe und explizite KI-Agenten-Innovation bleiben Ausnahmen von bisherigen Ausschlussmustern.

## Verlustfreie Kontrolle
Alle importierten Stellen bleiben unter derselben ID in `dashboard/jobs.json`. In `Radar > Bewertungs-Hub > Zurückgestellt` stehen alle in der Erwachsenen-Startseite ausgeblendeten Inserate zur Verfügung, inklusive Quelle, Link, Stellenbeschreibung und fakultativer Kriterienbewertung. Diese Audit-Ansicht ignoriert optionale Wunschberufe, Wunschregionen und Quellenfilter, damit kein ausgeschiedenes Inserat verborgen bleibt. Bei mehr als 50 Treffern können weitere Datensätze nachgeladen werden. Die Lehrstellenansicht bleibt unverändert.

## Grenzen
- Die Radar-Kriterienbewertungen (1–5) sind aktuell **vom CRM-Relevanzscore (1–100) getrennt**. Sie werden nicht stillschweigend umgerechnet, nicht zur Filteränderung verwendet und nicht automatisch in das Lernsystem übernommen.
- Die beim Import gespeicherten `selection.suggested_score`-Felder bleiben zunächst auf `heuristic-v1`; die V2-Priorität ist bewusst eine gesonderte, rein lokale Darstellungshilfe.
- Kein Löschen, kein automatischer Versand, keine kostenpflichtige KI-API und kein Training auf unbearbeiteten Kriterien.
- Die Filter- und Prioritätsregeln sind versioniert und können unabhängig vom Rohdatenbestand angepasst beziehungsweise zurückgenommen werden.

## Nächste Validierung
Eine repräsentative neue Stichprobe manuell beurteilen: Recall interessanter Stellen (>=60/100), Anteil irrtümlich zurückgestellter Stellen und Präzision unter den Top-20. Änderungen nur nach Gegenprüfung und Rückmeldung.
