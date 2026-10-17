# KI-Bewerbungs-Agent

Privates Entwicklungs-Repository für einen lokalen Stellen-Importer und ein interaktives HTML-Dashboard.

**Projektstand: 17.10.2026 · Technische Basis v0.1**

## Ziel

Job-Alerts aus einem separat angebundenen Gmail-Postfach auslesen, Stellenangebote aus verschiedenen Plattformen vereinheitlichen und in einem lokalen HTML-Dashboard darstellen. Das individuelle Bewerberprofil und das Matching werden **erst später** entwickelt.

## Verzeichnisstruktur

- \`dashboard/index.html\` – erster **funktionaler lokaler HTML-Viewer**: JSON-Datei manuell einlesen, Suchtext/Quelle/Kategorie/Status filtern und Original-Inserate aufrufen.
- \`schemas/job.schema.json\` – Schema für **ein** normalisiertes Stelleninserat (v0.1.0). Die lokale Datei \`data/jobs.json\` enthält ein Array solcher Einträge.
- \`config/job-alerts.json\` – Quellen und in Gmail nachgewiesene Job-Abo-Bestätigungen; keine Logins, Aktivierungslinks oder personenbezogenen Postfachdaten.
- \`docs/suchvorgaben.md\` – technische Zusammenfassung relevanter Entscheidungen; **nicht** die vollständige Originaldatei des Pflichtenhefts v0.7.
- \`docs/architektur.md\` – geplanter Datenfluss, Dublettenstrategie, Sicherheitsregeln und nächste Schritte.
- \`importer/README.md\` – Spezifikation des **noch nicht implementierten** Importers.
- \`examples/jobs.example.json\` – ausdrücklich fiktive Datensätze zum Testen der Anzeige.
- \`data/\` – künftig lokale produktive Daten (**per .gitignore ausgeschlossen**).

## Lokal testen (ohne Gmail)

1. Repository lokal klonen oder als ZIP herunterladen.
2. Datei \`dashboard/index.html\` im Browser öffnen.
3. Auf **«JSON-Datei laden / aktualisieren»** klicken und \`examples/jobs.example.json\` auswählen.
4. Filter ausprobieren und die Kategorien prüfen. Die Beispiel-URLs führen absichtlich zu keiner echten Stellenanzeige.

Die Seite benötigt keine Installation und keine Internetverbindung, um die gewählte JSON-Datei auszuwerten. Nach jeder lokalen Änderung der Datei diese über den Auswahldialog erneut einlesen.

## Spätere produktive Nutzung

Der geplante Importer erzeugt/aktualisiert lokal \`data/jobs.json\`; dann kann diese Datei im Dashboard manuell eingelesen werden. Ein automatischer Gmail-Abruf, eine Datenbank, KI-Matching und Bewerbungsautomatisierung sind **noch nicht implementiert**.

**Sicherheit:** E-Mails, Inserate, OAuth-Tokens, persönliche Daten und Bewerbungsunterlagen niemals ins Repository committen. Auch in einem privaten Repository gilt dies als Grundregel. Es werden keine Bewerbungen ohne ausdrückliche Freigabe versendet.

## Nächster Schritt

Reguläre Job-Alert-Mails in Gmail identifizieren (Aktivierungs- und Bestätigungsmails getrennt behandeln), daraus den ersten Parser entwickeln und mit dem JSON-Schema validieren.
