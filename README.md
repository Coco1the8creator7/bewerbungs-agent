# KI-Bewerbungs-Agent

Entwicklungs-Repository für einen lokalen Stellen-Importer und ein interaktives HTML-Dashboard. Vor der geplanten Veröffentlichung als öffentliches Repository ist die Git-Historie auf private Daten zu prüfen.

**Projektstand: 17.10.2026 · Dashboard-Layout v0.2 (Entwicklungsversion)**

## Ziel

Job-Alerts aus einem separat angebundenen Gmail-Postfach auslesen, Stellenangebote aus verschiedenen Plattformen vereinheitlichen und in einem lokalen HTML-Dashboard darstellen. Das individuelle Bewerberprofil und das Matching werden **erst später** entwickelt.

## Verzeichnisstruktur

- \`dashboard/index.html\` – Dashboard mit drei Abschnitten: vier Status-KPIs, laufende Bewerbungen, neue Inserate mit optionalem Fit-Score. Daten-/Demo-Tools dezent am Seitenende. Import-/Export und Notizen bleiben erhalten.
- \`schemas/job.schema.json\` – Schema für **ein** normalisiertes Stelleninserat (v0.1.0). Die lokale Datei \`data/jobs.json\` enthält ein Array solcher Einträge.
- \`config/job-alerts.json\` – Quellen und in Gmail nachgewiesene Job-Abo-Bestätigungen; keine Logins, Aktivierungslinks oder personenbezogenen Postfachdaten.
- \`docs/suchvorgaben.md\` – technische Zusammenfassung relevanter Entscheidungen; **nicht** die vollständige Originaldatei des Pflichtenhefts v0.7.
- \`docs/architektur.md\` – geplanter Datenfluss, Dublettenstrategie, Sicherheitsregeln und nächste Schritte.
- \`importer/README.md\` – Spezifikation des **noch nicht implementierten** Importers.
- \`examples/jobs.example.json\` – ausdrücklich fiktive Datensätze zum Testen der Anzeige.
- \`data/\` – künftig lokale produktive Daten (**per .gitignore ausgeschlossen**).

## Neuer Dashboard-Aufbau v0.2

Oben: **Neue Inserate**, **Seit letzter Woche in Prüfung**, **Total in Prüfung**, **Absagen neu** (rollierendes 7-Tage-Fenster). Darunter die **laufenden Bewerbungen** mit Status und die **noch ungeprüften neuen Stellen** mit optionalem Fit-Score. Im Footer: ausklappbarer Bereich **Daten & Entwicklung** mit Demo, JSON-Import und Status-Export. Details und KPI-Logik: [docs/dashboard-v0.2.md](docs/dashboard-v0.2.md).

Auf GitHub Pages werden beim ersten Aufruf ausdrücklich **fiktive Demo-Daten** angezeigt. Die echte Gmail-Anbindung, ein dauerhaftes Status-Backend und die Matching-Engine sind noch nicht vorhanden. Reale Scores werden deshalb nicht erfunden.

## Offline testen (ohne Gmail)

1. Repository als ZIP herunterladen oder später auf dem Mac klonen.
2. Datei dashboard/index.html im Browser öffnen oder die veröffentlichte GitHub-Pages-URL aufrufen.
3. Die Demo wird bereits beim Start mit mehreren fiktiven Inseraten geladen – **ohne Jobmails**.
4. Filter ausprobieren, persönliche Entscheidungen treffen und in „Details / Notiz“ Notizen ergänzen.
5. „Statusdatei exportieren“ sichert eine eigenständige JSON-Datei mit Inserat-IDs, persönlichen Entscheidungen und Notizen.
6. „Statusdatei laden“ stellt diese Daten wieder her; „Stellen-JSON laden“ importiert echte Inserate.

**Datentrennung:** processing.state bleibt der technische Importstatus. Der persönliche Status (z. B. In Prüfung, Bewerbung vorbereiten, Beworben, Absage erhalten) wird getrennt geführt und als JSON exportiert (Format v0.2.0, ältere Dateien v0.1.0 einlesbar).

**Schul-/Arbeitgebergerät:** Bewusst keine dauerhafte Browser-Speicherung. Beim Schliessen/Neuladen gehen nicht exportierte Entscheidungen verloren. Private Bewerbungsnotizen nicht auf verwalteten Geräten eingeben; Exporte mit personenbezogenen Inhalten nicht in GitHub laden.

**Automatische Offline-Tests:** GitHub Actions validiert JavaScript-Syntax und die fiktiven Datensätze gegen das JSON-Schema. Lokal: Python mit jsonschema sowie Node.js installieren, dann: python -m unittest discover -s tests -v.

## Permanente Webadresse über GitHub Pages

Für die statische Website verwenden wir denselben Hosting-Ansatz wie bei `was-ist-der-plan`: `.github/workflows/deploy-pages.yml` veröffentlicht ausschliesslich den Ordner `dashboard/`.

**Voraussetzungen:** Sicherheitsprüfung der vorhandenen Git-Historie, anschliessend Umstellung auf **öffentlich**, `Settings → Pages → Source: GitHub Actions` und einmaliger manueller Workflow-Start. Die erwartete URL lautet nach erfolgreicher Einrichtung `https://coco1the8creator7.github.io/bewerbungs-agent/` (noch nicht live bestätigt). Details unter [docs/hosting.md](docs/hosting.md).

**Achtung:** Bei einem öffentlichen Repository wird **das gesamte Repository mitsamt Historie** sichtbar, nicht bloss `dashboard/`. Unter `docs/suchvorgaben.md` liegen derzeit persönliche Gehalts- und Pendelpräferenzen. Keine privaten Dateien oder Zugangsdaten veröffentlichen.

## Spätere produktive Nutzung

Der geplante Importer erzeugt/aktualisiert lokal \`data/jobs.json\`; dann kann diese Datei im Dashboard manuell eingelesen werden. Ein automatischer Gmail-Abruf, eine Datenbank, KI-Matching und Bewerbungsautomatisierung sind **noch nicht implementiert**.

**Sicherheit:** E-Mails, Inserate, OAuth-Tokens, persönliche Daten und Bewerbungsunterlagen niemals ins Repository committen. Auch in einem privaten Repository gilt dies als Grundregel. Es werden keine Bewerbungen ohne ausdrückliche Freigabe versendet.

## Nächster Schritt

Reguläre Job-Alert-Mails in Gmail identifizieren (Aktivierungs- und Bestätigungsmails getrennt behandeln), daraus den ersten Parser entwickeln und mit dem JSON-Schema validieren.
