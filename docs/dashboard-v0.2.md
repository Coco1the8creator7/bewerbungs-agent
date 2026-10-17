# Dashboard v0.2 – fachliches UI-Konzept

## Horizontale Hauptbereiche

1. **Statusübersicht (4 KPI-Karten):** Neue Inserate, Seit letzter Woche in Prüfung, Total in Prüfung, Absagen neu.
2. **In Bearbeitung & Bewerbungsprozess:** laufende Inserate mit Stelle, Arbeitgeber, aktuellem Bewerbungsstatus, Datum der letzten Statusänderung und Detailansicht.
3. **Neue Inserate:** noch nicht behandelte Inserate mit Such- und Kategorie-/Quellenfiltern, Arbeitsort, Datum, Fit-Score und direkter Statusänderung.

Import-/Entwicklungsfunktionen erscheinen nur im aufklappbaren Bereich **Daten & Entwicklung** unterhalb aller drei Hauptbereiche. Auf der Startansicht werden keine Import-Buttons angezeigt.

## Kennzahlendefinition (vorläufig für MVP)

- **Neue Inserate:** Eingang (`first_seen_at`) innerhalb der letzten 7 × 24 Stunden, persönlicher Status `open`, technischer Importstatus nicht `excluded`. Ältere ungeprüfte Inserate bleiben trotzdem in der Liste «Neue Inserate», bis sie bearbeitet werden.
- **Seit letzter Woche in Prüfung:** Aktuell im Status `review` und in den letzten 7 × 24 Stunden auf `review` umgestellt (`stage_changed_at`). Das Zeitfenster ist vorläufig **rollierend sieben Tage**, nicht «letzte Kalenderwoche».
- **Total in Prüfung:** Aktuell im persönlichen Bewerbungsstatus `review`, unabhängig von der Dauer.
- **Absagen neu:** Aktuell `declined`, in den letzten 7 × 24 Stunden als Absage markiert (`stage_changed_at`). `rejected` (selbst nicht weiterverfolgt) zählt ausdrücklich **nicht** als Arbeitgeber-Absage.
- Ein geänderter Notiztext aktualisiert `stage_changed_at` **nicht**. Historische Exporte v0.1.0 ohne Datum können keine sichere «seit letzter Woche»-Zählung liefern und werden nicht spekulativ als neu gezählt.

## Persönlicher Bewerbungsstatus

`open` Neu; `review` In Prüfung; `saved` Vorgemerkt; `later` Später prüfen; `preparing` Bewerbung vorbereiten; `applied` Beworben; `interview` Vorstellungsgespräch; `offer` Angebot erhalten; `declined` Absage erhalten; `rejected` Nicht weiterverfolgt.

Die mittlere Liste umfasst **review, saved, later, preparing, applied, interview, offer**. `declined` und `rejected` sind abgeschlossen und erscheinen vorerst nur in den Kennzahlen beziehungsweise später im Archiv.

**Wichtig:** Bewerbungsstatus und `processing.state` (technische Extraktionsqualität) sind voneinander unabhängig. Eine technische Prüfung durch den Importer ist keine persönliche Prüfung einer Bewerbung.

## Fit-Score und Datenmodell

Das Job-Schema v0.1.0 unterstützt neu optional:
`matching: {status: "not_run"|"pending"|"complete"|"error", score: number|null, rationale?: string|null, evaluated_at?: string|null}`.

Ein numerischer Fit-Score wird ausschliesslich für `status:"complete"` angezeigt, alle anderen Datensätze erhalten **«Fit offen»**. Die eigentliche Matching-Engine wird weiterhin erst nach Aufbau des Bewerberprofils implementiert. Die integrierte Demo enthält explizit **fiktive** Scores und Beispielanzeigen.

## Speichern und Hosting

- Die GitHub-Pages-Seite ist öffentlich. Das Dashboard selbst enthält nur Demo-Daten und lädt ohne Benutzeraktion **keine** echten Stellen oder personenbezogenen Daten aus einem Backend.
- Ein Seitenreload verwirft Änderungen. Exportierte Statusdateien (Format v0.2.0) enthalten je Inserat-ID Entscheidung, Notiz und `stage_changed_at`.
- Statusdateien v0.1.0 bleiben importierbar; fehlende Zeitstempel bleiben unbekannt.
- Weder Gmail, Dateisystem, API noch Repository werden beim Laden automatisch verändert. Keine sensiblen Notizen auf fremden/verwalteten Geräten erfassen.
- Später für reale Daten und persistente Bewerbungen: geschützten Backend-Speicher, Anmeldung und Datensynchronisierung entwickeln.
