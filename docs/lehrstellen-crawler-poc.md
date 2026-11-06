# Lehrstellen-Crawler – isolierter Proof of Concept (6.11.2026)

## Status und Grenzen

Dies ist **kein produktiver Web-Crawler**. Der Prototyp verarbeitet ausschliesslich explizit bereitgestellte HTML-Dateien in einem synthetischen, quellenunabhängigen Testformat. Er enthält **keine Netzwerkzugriffe**, keine Scheduler, keine Datenbankschreibvorgänge, keine UI-Anpassung und keine Datenmigration. Insbesondere ist das Format `data-*` **keine Behauptung über das HTML einer realen Lehrstellenplattform**.

## Tests

```sh
python -m unittest discover -s crawler/tests -v
python -m crawler.prototype --source synthetic --html crawler/fixtures/synthetic.html
```

## Verifizierter Repository-Befund

- Statisches Dashboard in `dashboard/`, bisheriges `dashboard/jobs.json` und `dashboard/feedback.json`.
- `dashboard/github-sync.js` schreibt persönliche Bewertungsdaten mit einem im Browser-localStorage abgelegten GitHub-Token in das öffentliche Repository. Für produktive Nutzerkonten ungeeignet.
- `dashboard/dossier-cloud-sync.js` ist explizit als öffentliche DEMO markiert; nicht für echte personenbezogene Dossiers verwenden.
- `.github/workflows/deploy-infomaniak.yml` überträgt nur `dashboard/` per SFTP; kein Backend-/Datenbankdeployment.
- `docs/architektur.md`, `docs/hosting.md` und `README.md` enthalten veraltete Architektur-/Hostingangaben; nicht ohne Abgleich als Ist-Stand behandeln.

## Quellenprüfung

- SDBB dokumentiert LSR-Schnittstellen für Publikationsportale. Ein Datenbezug für Dritte ist laut publizierter Übersicht auf Anfrage mit Datennutzungsvertrag möglich. **Aktuelle Berechtigung, Vertrag und technische Details sind ungeklärt.** Quelle: https://edudoc.ch/record/230708/files/Kurzuebersicht_Datenaustauschprojekte-und_dienste_d.pdf
- SDBB-Prozess: https://www.sdbb.ch/fileadmin/redaktion-seviceseiten/04-datenmanagement/haka-ech/HAKA_SOLL-Datenaustauschprozesse_V3.0_de.pdf
- Yousty stellt gewerbliche Nutzung unter Zustimmungsvorbehalt und verbietet systematische Auslesung von Nutzerdaten; ohne Rechtsevaluation und Genehmigung keine Integration. Quelle: https://www.yousty.ch/de-CH/nutzungsbestimmungen

## Empfohlenes Zielschema

`sources(id, name, legal_status, active)`; `crawl_runs(id, source_id, started_at, finished_at, status, seen_count, error)`; `apprenticeships(id, title, employer, location, profession_code, start_year, status)`; `source_listings(id, source_id, external_id, apprenticeship_id, canonical_url, content_hash, last_seen_at, last_successful_run_id, missing_count, raw_metadata)`; `users(id, identity_subject)`; `user_profiles(id, user_id, preferences)`; `user_job_state(id, user_id, apprenticeship_id, rating, saved, notes, revision)`; `dossiers(id, user_id, apprenticeship_id, metadata, object_key)`.

Indexes/constraints: `UNIQUE(source_id, external_id)`; `UNIQUE(user_id, apprenticeship_id)`; private records always require server-validated authenticated `user_id`. Central records and user records must **not** share writable rows.

Object storage for dossier files outside web root, with private authentication and strict ownership checks; the database should store references, not large PDFs. Never expose source or OAuth credentials to browser.

## Etappierung und Abnahmekriterien

1. Quellenvertrag/Robots/Technik pro Anbieter dokumentieren. Keine automatischen Live-Abfragen vor Freigabe. SDBB-LSR-Zugang priorisiert abklären; Quelladapter bleiben eigene Software.
2. Reales erlaubtes HTML bzw. API-Fixture untersuchen; spezifischen Adapter und Parser-Tests erstellen.
3. Auf isolierter Entwicklungsdatenbank Idempotenz, Versionierung, Dubletten, Fehlerfälle und Statusübergänge testen. Nicht gefunden ist noch nicht geschlossen; erst nach mindestens zwei vollständigen, erfolgreichen Läufen und Quellen-validierter Bestätigung zur Deaktivierung vormerken.
4. Infomaniak-Runtime und PostgreSQL-Verfügbarkeit, Backups, Zugriffsrechte, Deployment, Monitoring und Rücksicherung prüfen.
5. Authentifizierte Lese-API und benutzerbezogene Schreib-API einführen, bestehende GitHub-/Browserdaten zuerst sicher exportieren und migrieren. UI vor ausdrücklicher Freigabe nicht ändern. Erwachsene und Lehrstellen getrennt halten.

## Offene Entscheidung

Für die produktive Datenbeschaffung sind die konkreten Nutzungsbedingungen und der offizielle Datenzugang entscheidend. Die Architekturentscheidung eigener Crawler/Importer bleibt bestehen. Eine erlaubte LSR-Schnittstelle darf als Quelladapter dienen, statt rechtsriskant HTML zu scrapen.
