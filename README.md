# KI-Bewerbungs-Agent

Privates Entwicklungs-Repository für einen lokalen Stellen-Importer und ein interaktives HTML-Dashboard.

**Projektstand: 17.10.2026 · Dashboard-Prüfworkflow (Entwicklungsversion)**

## Ziel

Job-Alerts aus einem separat angebundenen Gmail-Postfach auslesen, Stellenangebote aus verschiedenen Plattformen vereinheitlichen und in einem lokalen HTML-Dashboard darstellen. Das individuelle Bewerberprofil und das Matching werden **erst später** entwickelt.

## Verzeichnisstruktur

- \`dashboard/index.html\` – Offline-Dashboard: JSON-Datei laden, suchen, filtern, Details/Notizen bearbeiten, Entscheidungen separat importieren/exportieren und eingebaute Demo testen.
- \`schemas/job.schema.json\` – Schema für **ein** normalisiertes Stelleninserat (v0.1.0). Die lokale Datei \`data/jobs.json\` enthält ein Array solcher Einträge.
- \`config/job-alerts.json\` – Quellen und in Gmail nachgewiesene Job-Abo-Bestätigungen; keine Logins, Aktivierungslinks oder personenbezogenen Postfachdaten.
- \`docs/suchvorgaben.md\` – technische Zusammenfassung relevanter Entscheidungen; **nicht** die vollständige Originaldatei des Pflichtenhefts v0.7.
- \`docs/architektur.md\` – geplanter Datenfluss, Dublettenstrategie, Sicherheitsregeln und nächste Schritte.
- \`importer/README.md\` – Spezifikation des **noch nicht implementierten** Importers.
- \`examples/jobs.example.json\` – ausdrücklich fiktive Datensätze zum Testen der Anzeige.
- \`data/\` – künftig lokale produktive Daten (**per .gitignore ausgeschlossen**).

## Offline testen (ohne Gmail)

1. Repository als ZIP herunterladen oder später auf dem Mac klonen.
2. Datei dashboard/index.html im Browser öffnen.
3. Auf „Demo anzeigen“ klicken, um drei fiktive Jobs zu laden – **ohne Jobmails**.
4. Filter ausprobieren, persönliche Entscheidungen treffen und in „Details / Notiz“ Notizen ergänzen.
5. „Entscheidungen exportieren“ sichert eine eigenständige JSON-Datei mit Inserat-IDs, persönlichen Entscheidungen und Notizen.
6. „Entscheidungen laden“ kann diese Daten wiederherstellen; „Stellen-JSON laden“ importiert echte Inserate aus einer separaten lokalen Datei.

**Datentrennung:** processing.state bleibt der technische Importstatus. Persönliche Entscheidungen (Offen, Merkliste, Später prüfen, Nicht relevant, Beworben) verändern die Ursprungsjobs nicht und werden getrennt exportiert.

**Schul-/Arbeitgebergerät:** Bewusst keine dauerhafte Browser-Speicherung. Beim Schliessen/Neuladen gehen nicht exportierte Entscheidungen verloren. Private Bewerbungsnotizen nicht auf verwalteten Geräten eingeben; Exporte mit personenbezogenen Inhalten nicht in GitHub laden.

**Automatische Offline-Tests:** GitHub Actions validiert JavaScript-Syntax und die fiktiven Datensätze gegen das JSON-Schema. Lokal: Python mit jsonschema sowie Node.js installieren, dann: python -m unittest discover -s tests -v.

## Permanente Webadresse (ohne lokalen Rechner)

Das statische Dashboard kann über **Cloudflare Pages** aus diesem privaten Repository als öffentliche HTTPS-Seite veröffentlicht werden. Einmalig ist eine GitHub-Autorisierung im Cloudflare-Dashboard erforderlich; anschliessend aktualisiert sich die Seite automatisch bei Änderungen an `main`. Die genaue Einrichtung (Build-Ausgabeordner `dashboard`) und die Datenschutzgrenzen stehen in [docs/hosting.md](docs/hosting.md).

**Wichtig:** Eine veröffentlichte HTML-Seite ist kein geschütztes Benutzerkonto und enthält weiterhin keine persistente private Datenbank oder einen Gmail-Importer. Nur fiktive Beispieldaten im Code; reale Bewerbungsdaten niemals in den veröffentlichten Ordner committen.

## Spätere produktive Nutzung

Der geplante Importer erzeugt/aktualisiert lokal \`data/jobs.json\`; dann kann diese Datei im Dashboard manuell eingelesen werden. Ein automatischer Gmail-Abruf, eine Datenbank, KI-Matching und Bewerbungsautomatisierung sind **noch nicht implementiert**.

**Sicherheit:** E-Mails, Inserate, OAuth-Tokens, persönliche Daten und Bewerbungsunterlagen niemals ins Repository committen. Auch in einem privaten Repository gilt dies als Grundregel. Es werden keine Bewerbungen ohne ausdrückliche Freigabe versendet.

## Nächster Schritt

Reguläre Job-Alert-Mails in Gmail identifizieren (Aktivierungs- und Bestätigungsmails getrennt behandeln), daraus den ersten Parser entwickeln und mit dem JSON-Schema validieren.
