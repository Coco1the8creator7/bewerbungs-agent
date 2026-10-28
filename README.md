# KI-Bewerbungs-Agent

Entwicklungs-Repository für einen lokalen Stellen-Importer und ein interaktives HTML-Dashboard. Vor der geplanten Veröffentlichung als öffentliches Repository ist die Git-Historie auf private Daten zu prüfen.

**Projektstand: 20.10.2026 · Produktiver Jobmail-Import + Lernmodus v1**

**Aktueller Ablauf:** GitHub Actions importiert automatisch Stellenlinks, prüft Dubletten und berechnet unverbindliche Relevanzvorschläge. Der kalibrierte Feed enthält 83 Inserate. Keine automatischen Relevanzausschlüsse. Nutzerbewertungen von 1–100 lassen sich im Dashboard erfassen und als private JSON-Datei für das Training exportieren. Siehe [docs/lernmodus-v1.md](docs/lernmodus-v1.md).

## Ziel

Job-Alerts aus einem separat angebundenen Gmail-Postfach auslesen, Stellenangebote aus verschiedenen Plattformen vereinheitlichen und in einem lokalen HTML-Dashboard darstellen. Das individuelle Bewerberprofil und das Matching werden **erst später** entwickelt.

## Verzeichnisstruktur

- \`dashboard/index.html\` – Dashboard mit drei Abschnitten: vier Status-KPIs, laufende Bewerbungen, neue Inserate mit optionalem Fit-Score. Daten-/Demo-Tools dezent am Seitenende. Import-/Export und Notizen bleiben erhalten.
- \`schemas/job.schema.json\` – Schema für **ein** normalisiertes Stelleninserat (v0.1.0). Die lokale Datei \`data/jobs.json\` enthält ein Array solcher Einträge.
- \`config/job-alerts.json\` – Quellen und in Gmail nachgewiesene Job-Abo-Bestätigungen; keine Logins, Aktivierungslinks oder personenbezogenen Postfachdaten.
- \`docs/suchvorgaben.md\` – technische Zusammenfassung relevanter Entscheidungen; **nicht** die vollständige Originaldatei des Pflichtenhefts v0.7.
- \`docs/architektur.md\` – geplanter Datenfluss, Dublettenstrategie, Sicherheitsregeln und nächste Schritte.
- `importer/github_daily.py` – produktiver inkrementeller Jobmail-Importer; `selector/score.py` – unverbindliche Vorschläge.
- \`examples/jobs.example.json\` – ausdrücklich fiktive Datensätze zum Testen der Anzeige.
- \`data/\` – künftig lokale produktive Daten (**per .gitignore ausgeschlossen**).

## Neuer Dashboard-Aufbau v0.2

Oben: **Neue Inserate**, **Seit letzter Woche in Prüfung**, **Total in Prüfung**, **Absagen neu** (rollierendes 7-Tage-Fenster). Darunter die **laufenden Bewerbungen** mit Status und die **noch ungeprüften neuen Stellen** mit optionalem Fit-Score. Im Footer: ausklappbarer Bereich **Daten & Entwicklung** mit Demo, JSON-Import und Status-Export. Details und KPI-Logik: [docs/dashboard-v0.2.md](docs/dashboard-v0.2.md).

GitHub Pages lädt bei Verfügbarkeit den echten importierten Stellenfeed; ansonsten werden Demo-Daten gezeigt. Relevanzvorschläge sind keine individuellen Fit-Scores. Persönliches Matching und geschützte Cloud-Synchronisierung bleiben späteren Phasen vorbehalten.

## Dauerhafte Bearbeitung & Sicherung (v0.3)

Das Dashboard bietet **opt-in Speicherung im aktuellen Browser** (IndexedDB) über den dezenten Footer «Daten & Entwicklung». Damit werden Jobliste, Status, Notizen und manuelle Inseratkorrekturen bei einem Neuladen auf demselben Gerät wiederhergestellt. Die Speicherung ist standardmässig **aus** – insbesondere auf Arbeitgeber- und Schulgeräten nicht aktivieren.

Im Detailfenster lassen sich Inseratdaten (Arbeitgeber, Ort, Kategorien, Pensum, Gehalt, Arbeitsmodell etc.) ändern. Es können vollständige Inserat-JSON-Dateien, separate Statusdateien und eine **Gesamtsicherung v0.3** exportiert und wieder importiert werden. Bei einem erneuten Jobimport bleiben manuelle Korrekturen nach Inserat-ID erhalten. Bestehende Fit-Scores werden nach inhaltlichen Änderungen als veraltet markiert, nicht unverändert angezeigt.

**Keine Cloud-Synchronisierung:** Die öffentliche GitHub-Pages-Webseite hat keinen sicheren Schreibzugriff auf eine private Datenbank oder lokale Mac-Dateien; sie schreibt auch nicht zurück ins GitHub-Repository. Für mehrere Geräte wäre später ein authentifiziertes Backend erforderlich. Technische Details: [docs/persistence-v0.3.md](docs/persistence-v0.3.md).

## Provisorische öffentliche Dossier-Ablage (28.10.2026)

Im Bereich **Dossiers** können Dateien und Dossier-Vorbereitungen weiterhin lokal in IndexedDB abgelegt und **nach separater Bestätigung** unverschlüsselt unter `public-dossiers/v1/` in das öffentliche GitHub-Repository hochgeladen werden. Über «Von GitHub laden» können diese mit einem weiteren Browser abgerufen werden. Der Schreibzugriff erfordert einen GitHub-Token mit `Contents: Read and write`; die Dossiers-Funktion speichert ihn nicht zusätzlich. **Jede veröffentlichte Datei ist öffentlich zugänglich und kann auch nach Löschung in der Git-Historie erhalten bleiben.** Nur für bewusst zur Veröffentlichung freigegebene eigene Testunterlagen; ausdrücklich **nicht** für andere Nutzer, Minderjährige oder eine produktive SaaS-Nutzung. Die bisherige verschlüsselte/private Backend-Lösung bleibt als spätere Migration vorgesehen. Details: [docs/dossiers-public-mvp.md](docs/dossiers-public-mvp.md).

## Offline testen (ohne Gmail)

1. Repository als ZIP herunterladen oder später auf dem Mac klonen.
2. Datei dashboard/index.html im Browser öffnen oder die veröffentlichte GitHub-Pages-URL aufrufen.
3. Die Demo wird bereits beim Start mit mehreren fiktiven Inseraten geladen – **ohne Jobmails**.
4. Filter ausprobieren, persönliche Entscheidungen treffen und in „Details / Notiz“ Notizen ergänzen.
5. „Statusdatei exportieren“ sichert eine eigenständige JSON-Datei mit Inserat-IDs, persönlichen Entscheidungen und Notizen.
6. „Statusdatei laden“ stellt diese Daten wieder her; „Stellen-JSON laden“ importiert echte Inserate.

**Datentrennung:** processing.state bleibt der technische Importstatus. Der persönliche Status (z. B. In Prüfung, Bewerbung vorbereiten, Beworben, Absage erhalten) wird getrennt geführt und als JSON exportiert (Format v0.2.0, ältere Dateien v0.1.0 einlesbar).

**Schul-/Arbeitgebergerät:** Die optionale lokale Browser-Speicherung nicht aktivieren. Ohne Aktivierung gehen beim Neuladen nicht exportierte Änderungen verloren. Private Bewerbungsnotizen nicht auf verwalteten Geräten eingeben; Exporte mit personenbezogenen Inhalten nicht in GitHub laden.

**Automatische Offline-Tests:** GitHub Actions validiert JavaScript-Syntax und die fiktiven Datensätze gegen das JSON-Schema. Lokal: Python mit jsonschema sowie Node.js installieren, dann: python -m unittest discover -s tests -v.

## Permanente Webadresse über GitHub Pages

Für die statische Website verwenden wir denselben Hosting-Ansatz wie bei `was-ist-der-plan`: `.github/workflows/deploy-pages.yml` veröffentlicht ausschliesslich den Ordner `dashboard/`.

**Voraussetzungen:** Sicherheitsprüfung der vorhandenen Git-Historie, anschliessend Umstellung auf **öffentlich**, `Settings → Pages → Source: GitHub Actions` und einmaliger manueller Workflow-Start. Die erwartete URL lautet nach erfolgreicher Einrichtung `https://coco1the8creator7.github.io/bewerbungs-agent/` (GitHub-Pages-Deployments erfolgreich). Details unter [docs/hosting.md](docs/hosting.md).

**Achtung:** Bei einem öffentlichen Repository wird **das gesamte Repository mitsamt Historie** sichtbar, nicht bloss `dashboard/`. Unter `docs/suchvorgaben.md` liegen derzeit persönliche Gehalts- und Pendelpräferenzen. Keine privaten Dateien oder Zugangsdaten veröffentlichen.

## Spätere produktive Nutzung

Der produktive GitHub-Action-Importer aktualisiert `dashboard/jobs.json` täglich und nach Änderungen am Importcode. Nicht implementiert sind persönliches Bewerberprofil-Matching, automatisches Training aus privaten Bewertungen und Bewerbungsautomatisierung.

**Sicherheit:** E-Mails, OAuth-Tokens und vertrauliche Drittunterlagen niemals ins Repository committen. **Zeitlich begrenzte Ausnahme:** Der Projektinhaber hat ausdrücklich der unverschlüsselten Veröffentlichung seiner eigenen Test-Bewerbungsunterlagen im Prototyp zugestimmt; siehe öffentliche Dossier-Ablage. Keine Freigabe für fremde Daten. Es werden keine Bewerbungen ohne ausdrückliche Freigabe versendet.

## Nächster Schritt

Weitere HTML-Layouts von ewz und Energie 360° bei Eingang ihrer ersten echten Jobmails kalibrieren und private Bewertungs-JSON-Exporte für das spätere Training auswerten.
