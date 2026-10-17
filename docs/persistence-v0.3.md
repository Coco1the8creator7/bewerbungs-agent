# Persistente JSON-Bearbeitung – Dashboard v0.3

## Ziel und Grenzen

GitHub Pages bleibt eine **öffentliche, rein statische Website**. Änderungen in der Oberfläche können deshalb **nicht direkt** in die Dateien des öffentlichen GitHub-Repositories geschrieben werden. Persönliche Bewerbungsdaten und OAuth-Tokens dürfen keinesfalls in dieses Repository oder in `dashboard/` gelangen.

Die aktuelle Implementierung stellt einen lokalen, portablen **Arbeitsstand** bereit:

- `jobs.json` als vollständiger Inseratbestand (manuell korrigierbar);
- `bewerbungs-agent-decisions` als getrennte, persönliche Status-/Notizdatei;
- `bewerbungs-agent-workspace` v0.3.0 als **Gesamtsicherung** inklusive Inseraten, Status, Notizen und manuellen Feldkorrekturen;
- **optionale** dauerhafte Speicherung in der IndexedDB des aktuellen Browsers (erst nach ausdrücklichem Opt-in).

Das Opt-in ist standardmässig deaktiviert. Wird es aktiviert, stellt das Dashboard beim nächsten Besuch auf **demselben Browserprofil und derselben Website-Origin** den Arbeitsstand wieder her. Beim Deaktivieren wird die lokale gespeicherte Kopie gelöscht. Browserdaten-Löschung und Inkognito-Modus können die Daten entfernen. Die IndexedDB ist **keine geräteübergreifende Datenbank und kein Backup**: regelmässig eine Gesamtsicherung herunterladen.

## UI-Eingaben und JSON-Auswirkungen

| Benutzeraktion | JSON-Ziel | Wirkung |
| --- | --- | --- |
| Bewerbungsstatus ändern | `annotations[].decision` | Verändert Status/KPI/Prozessliste |
| Status wechseln | `annotations[].stage_changed_at` | Zeitstempel wird aktualisiert |
| Persönliche Notiz bearbeiten | `annotations[].note` | Notiz ohne Änderung des Status-Zeitstempels |
| Inseratdaten bearbeiten | `jobs[]` | Titel, Firma, Standort, Quelle, URL, Datum, Kategorien, Pensum, Lohn, Arbeitsmodell, Vertragsart und Beschreibung |
| Manuelles Inserat erfassen | `jobs[]` | Neuer vollständiger Datensatz mit stabiler `MANUAL-`-ID |
| Import einer neuen Stellenliste | `jobs[]` | Ersetzt nicht die manuell erfassten Inserate; manuelle Feldkorrekturen werden per Job-ID erneut angewendet |
| Gesamtsicherung importieren | Gesamter Arbeitsstand | Ersetzt Inserate, Status und manuelle Korrekturen mit geprüfter v0.3.0-Struktur |
| Gesamtsicherung exportieren | Download | Export aller obigen Daten als portable private Datei |

Technische Herkunftsdaten (`provenance`), Importprüfstatus (`processing`), Job-ID und automatisch ermittelte Fit-Scores sind **nicht** als frei bearbeitbare Felder vorgesehen. Wenn Jobdaten manuell korrigiert werden, wird ein vorhandener automatischer Fit-Score auf `not_run` zurückgesetzt, damit keine veraltete Punktzahl als aktuell erscheint. Automatisches Matching bleibt bis zur Entwicklung des Bewerberprofils ausgesetzt.

## Kompatibilität

Alte Statusdateien im Format `0.1.0` und `0.2.0` können weiter importiert werden. Das neue Komplettformat lautet `0.3.0`, während die Struktur eines einzelnen Inserates weiterhin `schemas/job.schema.json` v0.1.0 folgt.

Die separate `jobs.json` und die separate Statusdatei lassen sich weiter verwenden. Nur der v0.3-Gesamtexport enthält zusätzlich die manuellen Korrekturregeln, die nach einem späteren erneuten Jobimport wichtig sind.

## Arbeits- und Schulgeräte

Die Browser-Datenspeicherung auf fremden oder vom Arbeitgeber verwalteten Geräten **nicht aktivieren**. Für Tests ausschliesslich die fiktive Demo verwenden. Bei echten Bewerbungsdaten idealerweise nur einen persönlichen Rechner und eine geschützte Speicherung benutzen.

## Nächste technische Etappe

Eine geräteübergreifende, geschützte Synchronisierung erfordert eine Anmeldung und ein eigenes Backend. Die Datenablage kann dann serverseitig in einer privaten Datenbank oder auf dem eigenen Mac erfolgen, ohne persönliche Daten ins öffentliche GitHub-Repository zu schreiben. GitHub Pages bleibt in diesem Szenario nur die öffentlich ausgelieferte Benutzeroberfläche.
