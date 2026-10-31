# Career.Agency – Vorselektor v2 (27.10.2026)

## Beschluss
Die bereits vorhandenen Berufsfeld-Ausschlüsse werden um wenige eindeutige fachfremde Tätigkeiten ergänzt. Alle anderen Stellen bleiben selbst bei niedriger automatischer Priorität sichtbar. Für die Erwachsenenansicht wird eine transparente V2-Priorität als **Sortierhilfe** berechnet. Filterwirkung besteht ausschliesslich im Frontend, nicht im Importer und nicht in den JSON-Rohdaten.

## Bewertungssystem
`dashboard/career-filter.js` liefert `classify(job)`: `visible`, `reason`, `priority` (1–99), `reason_codes`, `version`, `exclusion`. Die Gewichtungen bilden vorläufige Hypothesen aus ausdrücklichen persönlichen Bewertungen ab, **kein statistisch trainiertes Modell**. Fachbauleitung/Fernwärme, Projektleitung, Energietechnik und benachbarte Berufsfelder bekommen Prioritätsboni. Unklare Tätigkeiten bleiben sichtbar; eine niedrige Priorität ist keine Ausschlussbedingung. Technische Spitalberufe und explizite KI-Agenten-Innovation bleiben Ausnahmen von bisherigen Ausschlussmustern.

## Verlustfreie Kontrolle
Alle importierten Stellen bleiben unter derselben ID in `dashboard/jobs.json`. In `Radar > Bewertungs-Hub > Zurückgestellt` stehen alle in der Erwachsenen-Startseite ausgeblendeten Inserate zur Verfügung, inklusive Quelle, Link, Stellenbeschreibung und fakultativer Kriterienbewertung. Diese Audit-Ansicht ignoriert optionale Wunschberufe, Wunschregionen und Quellenfilter, damit kein ausgeschiedenes Inserat verborgen bleibt. Bei mehr als 50 Treffern können weitere Datensätze nachgeladen werden. Die Lehrstellenansicht bleibt unverändert.

## Grenzen
- Die Radar-Kriterienbewertungen (1–5) bleiben **vom CRM-Relevanzscore (1–100) getrennt** und werden nicht umgerechnet. Die Erwachsenen-Radaransicht bietet deshalb zusätzlich einen ausdrücklichen 1–100-Regler, der denselben Relevanzeintrag wie die Startseite aktualisiert. Dauerhafte GitHub-Sicherung erfolgt weiterhin über «Bewertungen speichern» (öffentliches Repository). Kriterienbewertungen werden nicht automatisch in das Lernsystem übernommen.
- Die beim Import gespeicherten `selection.suggested_score`-Felder bleiben zunächst auf `heuristic-v1`; die V2-Priorität ist bewusst eine gesonderte, rein lokale Darstellungshilfe.
- Kein Löschen, kein automatischer Versand, keine kostenpflichtige KI-API und kein Training auf unbearbeiteten Kriterien.
- Die Filter- und Prioritätsregeln sind versioniert und können unabhängig vom Rohdatenbestand angepasst beziehungsweise zurückgenommen werden.

## Nächste Validierung
Eine repräsentative neue Stichprobe manuell beurteilen: Recall interessanter Stellen (>=60/100), Anteil irrtümlich zurückgestellter Stellen und Präzision unter den Top-20. Änderungen nur nach Gegenprüfung und Rückmeldung.

## Präzisierung v2.1 – verbindliche Ausschlüsse vom 31.10.2026

### Sichtbarkeit der Erwachsenenstellen
- **Zurückstellen:** Rollen mit klarer Zuständigkeit im Gewerk **Elektro**, **Sanitär** oder **Lüftung**, auch bei expliziter Projektleitung und in gemischten Bereichen wie HLK/HLKS. Ein Gewerk wird im **Stellentitel** erkannt; eine beiläufige Erwähnung bei der Schnittstellenkoordination im Beschreibungstext ist kein Ausschlussgrund.
- **Zurückstellen:** **Hochbau**, **Fassadenbau**, **Innenausbau** und vergleichbare eindeutig architektonische Hochbau-Rollen, einschliesslich Projektleitung. Projektleitung Tiefbau/Leitungsbau wird nicht pauschal ausgeschlossen.
- **Zurückstellen:** Alle **allgemeinen Bauleiter-/Bauleitungsrollen** einschliesslich Oberbauleitung und bauleitender Funktionen. Nur ausdrücklich als **Fachbauleitung/Fachbauleiter** ausgeschriebene Stellen bestehen diesen konkreten Ausschlusscheck. Fachbauleitung anderer ausgeschlossener Gewerke oder Sekundär-Heizung bleibt dennoch zurückgestellt.
- **Heizung:** Die Zielrichtung ist **Primärseite thermischer Netze**. Eindeutige sekundärseitige Gebäudeheizung, Heizungsinstallations- oder Heizungsverteilungsrollen werden zurückgestellt. Aus dem Titel oder expliziten Tätigkeiten wird eine Klassifikation `primary`, `secondary` oder `undetermined` abgeleitet; `undetermined` ist ausdrücklich **kein Ausschluss**.
- **Primärseite:** Fernwärme-/Wärmenetzprojektierung, Wärmeverbund und Trassen-/Netzbau bleiben sichtbar, einschliesslich geeigneter Fachbauleitung. Eine in deren Beschreibung erwähnte Schnittstelle zu Sekundäranlagen allein verwandelt die primärseitige Rolle nicht in einen Heizungsjob auf der Sekundärseite.
- Frühere Ausnahmen für Spitaltechnik oder KI-Agenteninnovation setzen **die hier bestätigten Gewerke-, Hochbau- oder Bauleitungs-Ausschlüsse nicht ausser Kraft**. Technische primärseitige Wärmeversorgung in Spitälern kann weiterhin passen.

### Daten und Risiken
Die Regel ist ausschliesslich ein **reversibler Anzeige-Filter** (`career-preselector-v2.1`). Weder Importer noch `dashboard/jobs.json`, IDs, Scores oder private Bewertungswerte werden verändert. Im Radar-Reiter **Filter-KI → Zurückgestellt** bleiben sämtliche zurückgestellten Inserate für die Kontrolle und Bewertung vorhanden; die Gründe werden dort textlich angezeigt.

**Verbleibende Unsicherheit:** Wo Titel und Beschreibung keine verlässliche Zuordnung zur Primär- oder Sekundärseite erlauben, bleibt die Stelle sichtbar. Vollständige Stellenbeschreibungen und qualifizierte Aufgabenextraktion sind deshalb weiterhin eine wichtige Voraussetzung für eine höhere Filtertrefferquote. Die Zuordnung ist regelbasiert und kein überprüftes ML-Modell.
