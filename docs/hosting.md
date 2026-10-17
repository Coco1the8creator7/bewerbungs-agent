# Dashboard über GitHub Pages veröffentlichen

Der Bewerbungs-Agent erhält dieselbe Hosting-Technik wie das Projekt `was-ist-der-plan`: Ein GitHub-Actions-Workflow veröffentlicht den **Inhalt des Ordners `dashboard/`** als statische Website.

## Sicherheit vor der Umstellung auf ein öffentliches Repository

**Noch nicht ohne Prüfung öffentlich schalten!** Im vorhandenen Repository liegen persönliche Suchvorgaben, einschliesslich Gehaltszielen und Pendelpräferenzen, insbesondere unter `docs/suchvorgaben.md`. Zudem werden mit der Umstellung auf öffentlich auch frühere Commits, Issues und Actions-Protokolle sichtbar. Eine blosse Löschung auf `main` entfernt frühere Dateiversionen **nicht** aus der Git-Historie.

Vor der Veröffentlichung daher den aktuellen Stand und die gesamte Git-Historie auf vertrauliche Informationen prüfen. Falls Informationen dauerhaft privat bleiben sollen, ist ein **neues, bereinigtes öffentliches Repository nur für das Dashboard** besser als eine Umstellung dieses Entwicklungs-Repositories. Keine persönlichen Bewerbungsdateien, Tokens, Rohmails, Zugangsdaten oder privaten Datensätze committen.

## Einrichtung über GitHub.com (nach der Sicherheitsprüfung)

1. Öffne `https://github.com/Coco1the8creator7/bewerbungs-agent`.
2. **Settings → General → Danger Zone → Change repository visibility → Make public**. Die GitHub-Sicherheitsabfrage selbst bestätigen. Der vorhandene Code und die komplette Historie werden dadurch öffentlich.
3. Öffne **Settings → Pages**.
4. Unter **Build and deployment → Source** wähle **GitHub Actions**.
5. Öffne **Actions → Webseite veröffentlichen (GitHub Pages) → Run workflow** für `main`.
6. Nach erfolgreichem Deployment bestätigt GitHub Pages eine URL. Für den aktuellen Eigentümer und Repository-Namen ist `https://coco1the8creator7.github.io/bewerbungs-agent/` die erwartete Form; die URL vor dem Deployment nicht als bereits erreichbar darstellen.

GitHub Actions führt das Deployment danach automatisch aus, wenn sich `dashboard/**` oder der Deployment-Workflow auf `main` ändert. Mit `workflow_dispatch` kann der Vorgang erneut manuell gestartet werden.

## Umfang der veröffentlichten Website

- **Öffentliche GitHub-Pages-Dateien:** nur `dashboard/`, z. B. `dashboard/index.html` als Website-Startseite.
- **Öffentliche Repository-Dateien:** bei einem öffentlichen Repository sind dagegen **sämtliche nicht ignorierten Dateien und die Git-Historie** öffentlich einsehbar, auch `docs/`, `config/`, `schemas/` und `importer/`.
- Das Dashboard enthält nur fiktive Demodaten. Reale Stellen lassen sich per Dateiauswahl lokal im Browser laden, ohne automatische Übertragung an GitHub.
- Es gibt keinen serverseitigen Gmail-Importer, keine Anmeldung und keinen dauerhaft gespeicherten Bewerbungsstatus. Entscheidungen liegen nur temporär im Browser und können als JSON exportiert werden. Auf Schul-/Arbeitgebergeräten keine sensiblen Bewerbungsnotizen erfassen.
- `robots.txt` ist nur ein Indizierungswunsch, **kein Zugangsschutz**. Eine öffentliche Pages-Website darf nicht als private Anwendung behandelt werden.

GitHub-Dokumentation:
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
