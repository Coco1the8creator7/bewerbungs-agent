# Import Stellenmails – GitHub Actions

Workflow: `.github/workflows/import-stellenmails.yml` (05:17 UTC täglich, manuell über Actions → Import Stellenmails → Run workflow). GitHub Actions geplante Läufe können verzögert werden. Der Workflow ist erst lauffähig, wenn die drei Secrets vorhanden sind.

## Einmalige Einrichtung
1. In einem eigenen Google-Cloud-Projekt Gmail API aktivieren, OAuth-Zustimmungsbildschirm konfigurieren und Desktop-App-Client erstellen.
2. Einmal lokal oder in einer kontrollierten OAuth-Umgebung den Scope `https://www.googleapis.com/auth/gmail.readonly` autorisieren und einen gültigen **Refresh-Token** beziehen. Die ChatGPT-Gmail-Verbindung ist **nicht** als OAuth-Token in GitHub verfügbar. Bei OAuth-Testing-Modus kann das Refresh-Token nach 7 Tagen auslaufen; gegebenenfalls App auf geeigneten Publishing-Status setzen.
3. GitHub → Settings → Secrets and variables → Actions → New repository secret: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.
4. Workflow nach Merge auf `main` erstmals manuell ausführen und das Log prüfen.

## Architektur und Datenschutz
Das Ausgabeartefakt `dashboard/jobs.json` wird versioniert; es enthält **nur aus öffentlichen Stellen-Links abgeleitete Informationen** (Titel, Firma, Ort, URL, Basisfelder), **keine** Nachrichten-IDs, privaten Suchbegriffe, Notizen oder Gmail-Tokens. Es ist als **öffentlich lesbarer Feed** zu verstehen. Ein öffentliches GitHub Pages kann diese Datei ohne Anmeldung automatisch laden. Wenn die Stellenliste nicht öffentlich sein soll, ist das keine geeignete Architektur: dann Authentifizierung/privates Backend verwenden.
Der Workflow verarbeitet derzeit jobs.ch und publicjobs.ch, nicht ewz und Energie 360°. Er liest einen 30-Tage-Rückblick und vereinigt nach stabiler quellenbasierter ID. Bei öffentlich sichtbarer Repository-Historie bleiben alte Feed-Versionen einsehbar. Unvollständige Informationen werden gekennzeichnet; Weiterleitungslinks von publicjobs sind noch nicht zu Original-URLs aufgelöst.

## GitHub Pages
Der bisherige Deploy-Workflow führt aus Sicherheitsgründen nur für **öffentliche** Repositories aus und der Workflow selbst darf private Benutzerprofile nicht automatisch veröffentlichen. Da ein Push per Actions-GITHUB_TOKEN keine anderen `push`-Workflows auslöst, muss `Webseite veröffentlichen` nach Import **manuell** ausgelöst werden oder die Deployment-Ausführung in den Import-Workflow integriert werden. Hier ist der automatische Deploy-Job bereits im Import-Workflow enthalten, sofern Repository öffentlich und Pages konfiguriert ist.

## Produktivstatus
Code vorhanden, nicht live per Gmail getestet. Gmail-Secrets sind durch ChatGPT nicht automatisch konfiguriert. Ein täglicher Lauf startet erst nach Merge auf main und Einrichtung.
