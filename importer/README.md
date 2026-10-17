# Gmail-Importer v0.1 – Prototyp

## Installation (später auf dem Mac)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-gmail.txt
python -m unittest discover -s tests -v
python -m importer.main --eml-dir local/mail
```

Für den Live-Zugriff die Google Gmail API im eigenen Google-Cloud-Projekt aktivieren, einen OAuth-Desktop-Client erstellen, seine JSON-Datei unter `local/credentials.json` speichern und `python -m importer.main --gmail` ausführen. Beim ersten Aufruf erfolgt ein lokaler OAuth-Consent-Flow. Tokens werden unter `local/token.json` gespeichert und gehören nicht ins Repository. Leseberechtigung: `gmail.readonly`.

## Datenfluss

- Bekannte Absender klassifizieren; offensichtliche Aktivierungs-E-Mails ignorieren.
- HTML-Links oder URLs aus Text-Mails lesen; mehrere Stellen pro Nachricht zulassen.
- Trackingparameter entfernen, pro kanonischer URL deduplizieren.
- SQLite in `data/jobs.sqlite3`: verarbeitete Message-Digests, Stellen und Herkunftsnachweise; identische Mails überspringen.
- `data/jobs.json` atomar exportieren und im vorhandenen HTML-Dashboard laden.
- Unsichere Titel und fehlende Arbeitgeber/Orte bleiben als `needs_review` sichtbar.

## Nicht produktionsreif

Die Parser-Heuristik ist mit echten Job-Alert-Layouts noch nicht validiert; Senderadapter, Redirect-Auflösung und vollständige Stellenbeschreibung fehlen. Der verbundene ChatGPT-Gmail-Zugang ist unabhängig vom lokalen OAuth. Keine Dauerautomatisierung, keine KI-Aufrufe und kein Matching implementiert. Nachrichten ohne erkennbare Stellenlinks werden im SQLite-Message-Status als Review erfasst, aber nicht künstlich als Stellen erzeugt.

Sensible Mails, Zugangsdaten und produktive Inserate verbleiben lokal in `local/` und `data/`. README und Tests enthalten nur synthetische Daten.
