# Career.Agency — Server- und Deploymentlandkarte

Diese Karte trennt Repositorystand, verbindliche Architekturentscheidungen und tatsächlichen Produktionszustand. Keine Zugangsdaten oder Secret-Werte eintragen.

## Prüfstand

| Angabe | Status | Nachweis |
|---|---|---|
| Repository und Zielbranch | **VERIFIZIERT** | Coco1the8creator7/bewerbungs-agent, Standardbranch main |
| geprüfter Repository-Stand | **VERIFIZIERT** | 861c1e076d06d09a10133bb126a4cfa906c7cf9b, 07.11.2026; GitHub Commit API |
| PR-Lage | **VERIFIZIERT** | #102 gemergt in 861c1e0; #104 und PRs #103/#97 sind ebenfalls enthalten. |
| aktuelle Serverkonfiguration | **OFFEN** | Bei dieser Bestandsaufnahme kein Live-Statusabruf; frühere Nachweise sind zeitgebunden und teils widersprüchlich. |
| Rollout des geprüften Commits | **OFFEN** | Repository-Commit oder CI allein belegt kein Produktionsdeployment. |
| letzte Prüfung | **VERIFIZIERT** | 07.11.2026; GitHub Repository-, Datei-, Commit- und PR-API; keine Serverabfrage oder Änderung. |

## Architekturübersicht

```mermaid
flowchart TD
 B[Browser] --> D[careeragency.ch / DNS + HTTPS]
 D --> C[Infomaniak: Caddy / statische Website]
 C --> F[Lehrstellen-Feed]
 B -->|nach Aktivierung: /app und /api/auth| A[FastAPI Auth-Dienst]
 A --> DB[(PostgreSQL)]
 GH[GitHub main / Actions] -->|manueller geprüfter Rollout| C
 GH -.->|deaktivierte Legacy Pages/Importer| B
 G[Gmail] -.->|stillgelegter Legacy-Importer| GH
 Y[Yousty] -->|nach dokumentierter Quellenfreigabe| K[Server-Crawler]
 K --> F
```

Pfeile zu Auth, Datenbank und Crawler bilden den aktuellen Repository-Zielpfad ab; aktive Produktionsverbindungen sind nicht bestätigt.

## Komponenten und Aufgaben

| Komponente | Aufgabe | Status |
|---|---|---|
| dashboard/ | Statisches Frontend, Landingpage und Radar | **AUS REPOSITORY**. PR #104 lädt lehrstellen.json statt des früheren jobs.json. Live-Stand: **OFFEN**. |
| careeragency.ch | Domain in Workflows und Live-Preflight | **AUS REPOSITORY**. DNS-Ziel, aktives Zertifikat und aktuelle Caddy-Routen: **OFFEN**. |
| Infomaniak / Caddy | Produktionsziel und Reverse Proxy | **AUS REPOSITORY**. Aktuelle Host- und Laufzeitkonfiguration bleiben **OFFEN**; kein aktueller Liveabruf. |
| /var/www/careeragency/current | Im SSH-Dispatcher geprüfter Landingpage-Pfad | **AUS REPOSITORY**: status prüft index.html dort. Inhalt und Symlink-Ziel nicht live geprüft. |
| /srv/careeragency-landing-feed/jobs.json | Im Dispatcher geprüfte Feed-Datei | **AUS REPOSITORY**. Abgleich mit lehrstellen.json ist **OFFEN**. |
| authservice/ | FastAPI Authentifizierung und private API | **AUS REPOSITORY**; produktiv aktiv: **OFFEN**. |
| PostgreSQL / careeragency_auth | Auth- und Nutzerdaten gemäß Migrationen | **AUS REPOSITORY**; aktive Datenbank, Schema, Rollen und Backups nicht geprüft. |
| Yousty-Crawler | Zentraler Lehrstellenfeed und Statusprotokoll | Service/Timer sind nach PR #102 **AUS REPOSITORY**; Timer bleibt laut PR ohne dokumentierte Quellenfreigabe deaktiviert. Auf dem Server installiert/aktiv: **OFFEN**. |
| GitHub Pages | Historischer statischer Veröffentlichungsweg | Workflow bleibt manuell startbar, Deploy-Job ist deaktiviert (**AUS REPOSITORY**); live öffentlich erreichbar: **OFFEN**. |
| GitHub Actions | Import, Tests und Veröffentlichung | Definitionen **AUS REPOSITORY**; aktuelle Laufhistorie nicht geprüft. |

## Anfrage- und Datenwege

1. **Statische Webauslieferung — AUS REPOSITORY:** Browser → careeragency.ch → vorgesehene Infomaniak-/Caddy-Auslieferung. deploy-infomaniak.yml ist auf manuellen Start begrenzt und führt nur Prüfungen aus; SFTP-Veröffentlichung ist entfernt. Ein freigegebener, manueller Infomaniak-Rollout ist in docs/production-completion.md beschrieben. Er wurde hier nicht ausgeführt oder live bestätigt.
2. **GitHub Pages — AUS REPOSITORY:** deploy-pages.yml ist stillgelegt; der Deploy-Job ist deaktiviert. Pages ist nicht mehr als Produktionsweg vorgesehen. Ob eine alte Pages-Kopie noch erreichbar ist: **OFFEN**.
3. **Jobmail-Import — AUS REPOSITORY:** alter Gmail-Importer ist mit if: false stillgelegt; Zeitplan und automatisches Schreiben in dashboard/jobs.json sind deaktiviert. Die bisherigen Secret-Namen dürfen nicht als Hinweis auf aktive Nutzung gelten.
4. **Manuelle URLs — AUS REPOSITORY:** alter URL-Importer ist mit if: false stillgelegt; keine Feed-/Pages-Veröffentlichung aus diesem Workflow.
5. **Lehrstellen-Radar — AUS REPOSITORY:** main stellt den Radar auf Lehrstellen um und erwartet ./lehrstellen.json. Live-Route und Inhalt nicht geprüft.
6. **Konten und private Daten — BESCHLOSSEN / AUS REPOSITORY:** eigener FastAPI-Dienst mit PostgreSQL, E-Mail-Verifizierung, manueller Admin-Freigabe und TOTP für Administratoren. Alte IndexedDB-Daten werden nicht automatisch zugeordnet. Dossier-Studio-Dateien und Cloud-Synchronisation sind nicht im aktuellen Loginpfad. Installation und produktive Abnahme: **OFFEN**.
7. **Crawler und Outbox — AUS REPOSITORY:** PR #102 ist gemergt und enthält nutzergetrennte PostgreSQL-Ablage, verschlüsselte Mail-Outbox und begrenzte Yousty-Crawler-Läufe. Dienste, Migrationen, SMTP und Quellennutzungsfreigabe sind auf Produktion noch nicht verifiziert; der Crawler-Timer ist ohne dokumentierte Freigabe deaktiviert.

## Deployment und PR-Ablauf

### Aktueller Repositorystand

- **Infomaniak-Frontend:** deploy-infomaniak.yml ist nur manuell startbar und prüft das Frontend; der frühere SFTP-Deploy wurde entfernt. Produktionsreleases erfordern den in docs/production-completion.md beschriebenen Betreiberablauf.
- **GitHub Pages:** deploy-pages.yml ist stillgelegt; der Job ist deaktiviert. Importworkflows für Gmail und URLs sind ebenfalls deaktiviert.
- **Eingeschränkter SSH-Dispatcher:** ops/server/ca-ops-command enthält eine Befehls-Allowlist. ops/server/install-ops-dispatcher.sh ist laut Code zentraler Installationspunkt und sichert die Vorversion. Skripte belegen keine Übereinstimmung der Serverinstallation.
- **Auth-/Backend-Rollout:** owner-setup.sh und apply-production.sh beschreiben einen interaktiven, betreiberseitigen Installationsweg. Der Merge startet ihn nicht. Ausführung und Aktivierung sind hier nicht belegt; siehe docs/production-completion.md.

### Bei jedem PR

1. Repository, Base-Branch/-SHA, PR-Nummer, Head-SHA, Merge-SHA und geänderte Dateien festhalten.
2. Auswirkungen auf Frontend/API, Domain/Proxy/TLS, Deployment/Rollback, Dienste, Datenbank/Speicher, Firewall/SSH, Jobs/Crawler und Auth/Admin/Datenschutz prüfen.
3. Karte im PR anpassen, wenn Architektur, Deployment oder Serververhalten betroffen sind. Sonst festhalten: „Serverlandkarte geprüft; keine Infrastrukturänderung.“
4. Nach Merge Workflowlauf und Livezustand über freigegebene Read-only-Wege prüfen. Merge, CI, Deployment und Live-Funktion getrennt bewerten.
5. Nur mit aktuellem Laufzeitnachweis als **VERIFIZIERT** markieren. Ohne Nachweis **OFFEN** lassen.
6. Keine Serveränderung, Migration, Neustart, Löschung oder Rechteänderung ohne ausdrücklichen Auftrag.

## Dienste, Ports, Pfade und Daten

| Gegenstand | Angabe | Status |
|---|---|---|
| TCP 80/443 | Erwartete öffentliche Webports für Caddy | **OFFEN**: Listener und Firewall nicht live geprüft. |
| SSH | Eingeschränkter Forced-Command-Zugang für careeragency_runner im Ops-Code vorgesehen | **AUS REPOSITORY**. authorized_keys, sudoers und aktive Rechte nicht abgefragt. |
| Auth API | 127.0.0.1:8765 laut ops/production/careeragency-auth.service | **AUS REPOSITORY**; Unit installiert/aktiv: **OFFEN**. |
| PostgreSQL | Auth-Unit benötigt postgresql.service | **AUS REPOSITORY**; aktiver Dienst/Portbindung nicht live geprüft. |
| Webroot | /var/www/careeragency/current | **AUS REPOSITORY**; Inhalt/Symlink **OFFEN**. |
| Feed | Dispatcher prüft /srv/careeragency-landing-feed/jobs.json; Radar erwartet lehrstellen.json | **OFFEN**: Routing und Dateipfad abgleichen. |
| Auth-Runtime | /opt/careeragency/auth-current; Konfiguration /etc/careeragency/auth.env | **AUS REPOSITORY**; Runtime und Rechte **OFFEN**. Secret-Werte niemals erfassen. |
| PostgreSQL-Daten | careeragency_auth; Migrationen unter db/migrations/ | **AUS REPOSITORY**. Schutzbedarf hoch: Konten, Bewertungen und Aktivitäten. Backup/Restore nicht verifiziert. |
| Ops-Backups | /var/backups/careeragency-ops/dispatchers | **AUS REPOSITORY**; Aufbewahrung/Wiederherstellung **OFFEN**. |

Backend, Datenbank und Adminoberfläche sollen nicht öffentlich lauschen. Die Auth-Unit bindet an Loopback; Proxy-Routen gelten erst nach Installation.

## Schutz- und Berechtigungsgrenzen

- **VERIFIZIERT im Repository:** Workflows referenzieren Secrets über Namen; Werte sind nicht Teil dieser Karte.
- **AUS REPOSITORY:** SSH-Dispatcher verweigert unbekannte Befehle; privilegierte Operationen laufen über festgelegte Programme.
- **AUS REPOSITORY:** Auth-Unit nutzt careeragency_auth als dedizierten Benutzer, Loopback und systemd-Härtungsoptionen.
- **BESCHLOSSEN:** Nutzergetrennte Konten und Aktivitäten; manuelle Admin-Freigabe und Admin-TOTP.
- **OFFEN:** installierte SSH-Key-Einschränkungen, sudoers, UFW/Anbieter-Firewall, Dateirechte, Secret-Verteilung, DB-Rollen, Backup-Verschlüsselung und Restore-Probe.
- **Kritischer Prüfhinweis:** Die alten SFTP-/Pages-/Importer-Workflows sind im Repository deaktiviert. Bereits veröffentlichte GitHub-Pages-Kopien oder alte Serverdateien können dennoch erreichbar sein; ihren aktuellen Status separat prüfen.

## Produktionsprüfung und Rollback

**Heute belegt:** Repository-Stand und Workflow-/Skriptinhalte gemäß obigen Tabellen.

**Heute offen:** Caddy, DNS/TLS, aktive Dateien, Feedroute/-inhalt, systemd, PostgreSQL, Auth-Routen, Crawler-Timer, Firewall, Deployment-SHA und Rollbackfähigkeit. Frühere Konversationsnachweise nannten aktives Caddy und eingeschränkten SSH-Zugang, aber auch abgewiesene oder fehlende Auth-Schritte; das ist kein aktueller Systemnachweis.

### Lesende Prüfungen nach Merge

1. Actions-Lauf des konkreten Merge-SHA und Deploymentziel/URL prüfen.
2. SSH nur über den freigegebenen Dispatcher verwenden: status, release-check <vollständiger SHA> und dedizierte Read-only-Preflights.
3. Öffentlich HTTPS-Status und erwartete Endpunkte prüfen. Auth zusätzlich mit anonymen Negativtests und freigegebenem Testkonto abnehmen.
4. Datenbank/Crawler über Read-only-Status, Migrationstabelle, Timerstatus und letzte Laufprotokolle prüfen.
5. Vor einem Rollback Release-ID und Sicherung prüfen. Rollback nur mit ausdrücklichem Auftrag; danach Status und HTTP erneut prüfen.

Der neue Produktionsgateway kennt plan, lockdown, prepare und activate; Rollbackdetails und Live-Wiederherstellbarkeit stehen in docs/production-completion.md. Installation und aktuelle Sicherungen sind **OFFEN**; Wiederherstellbarkeit gilt ohne Live-Probe nicht als verifiziert.

## Offene Punkte und Risiken

1. **OFFEN — Liveinventar:** Caddy-Routen, Dienste, Dateien, DNS/TLS, Firewall und Deployment-SHA über freigegebenen Read-only-Zugang abrufen.
2. **OFFEN — nach Merge #102:** Merge ist erfolgt, aber der manuelle Betreiber-Bootstrap und die abschließende Liveabnahme sind separat nachzuweisen. Code/Unit/Migrationen im main beweisen keine Installation.
3. **OFFEN — Altbestände:** automatische SFTP-/Pages-/Importer-Wege sind im main deaktiviert. Verifizieren, dass Livehost, alte Pages-Kopie und Legacy-Feeds keine unbeabsichtigten Altinhalte mehr ausliefern.
4. **OFFEN — Feedpfad:** Radar erwartet lehrstellen.json; ältere Ops-Prüfungen referenzieren jobs.json. Proxy und Publisher müssen denselben Feed bereitstellen.
5. **OFFEN — Auth-Abnahme:** Auth, PostgreSQL, SMTP, TOTP, Freigabe, Redirects und 401-Schutz auf dem Zielsystem nachweisen.
6. **OFFEN — Datenschutz:** keine Dossier-Cloudablage im beschlossenen Umfang. Schutz Minderjähriger, Speicherfristen und Exporte vor Synchronisation persönlicher Dokumente klären.
7. **OFFEN — Lehrstellenbetrieb:** Crawler-Timer erst mit dokumentierter Quellenfreigabe aktivieren. Laufzeit, Fehleralarm, Feedroute und öffentliche Ausgabe nach Betreiber-Bootstrap prüfen.

## Eintrag je PR

- PR / Titel:
- Base-Branch und Base-SHA:
- Head-SHA / Merge-SHA:
- Geänderte Infrastruktur- und Anwendungspfade:
- Auswirkungen: Frontend/API | Domain/Proxy/TLS | Deployment/Rollback | Dienste | DB/Speicher | Firewall/SSH | Jobs/Crawler | Auth/Admin/Datenschutz
- Karte: aktualisiert / geprüft und unverändert
- Workflow-Nachweis: Run-ID, Status, SHA
- Produktion: **VERIFIZIERT** / **ungeprüft** / **nicht ausgerollt**
- Live-Prüfmethode, Zeitpunkt und Endpunkte/Dienste:
- Offene Prüfungen / Rollback-Referenz:

## Prüfung zu PR #108 — Dispatcher-Installer

- **Repository/Base:** main, ffbcc95bb8bb9b6fcdbeb31c6d73fff27d518790. Änderung: `ops/server/install-ops-dispatcher.sh`; Regressionen: `ops/tests/test_dispatcher_upgrade.py`.
- **Verifiziert, lokaler Test:** 31 Ops-Tests erfolgreich. Der Validator unterscheidet nun äussere SSH-Aktionen von verschachtelten Release-Unterfällen; die Befehls-Whitelist bleibt unverändert. Unbekannte äussere Aktionen werden weiterhin abgewiesen.
- **Verifiziert, Betreiber-Terminal vom 07.11.2026:** `owner-setup.sh` brach beim Dispatcher-Validator mit den fälschlich erkannten Unterfällen `release-check|release-deploy`, `release-rollback` und `*` ab. Dieser Abbruch liegt vor Dispatcher-Installation, Gateway-Installation, Migrationen und Dienstaktivierung.
- **Letzter direkter HTTPS-Nachweis (07.11.2026, vor dem erneuten Installationsversuch):** `/` und `/lehrstellen.json` HTTP 200, Feed 185 Yousty-Inserate; `/jobs.json` 401; `/feedback.json` 200; `/account/login`, `/app/`, `/api/auth/me` 404. Auth-Produktivbetrieb ist damit nicht bestätigt; die Feedback-Sperre war noch nicht aktiv.
- **SSH-Nachweis:** Read-only-Plan über [Run 42388395669](https://github.com/Coco1the8creator7/bewerbungs-agent/actions/runs/42388395669) abgewiesen (Exit 64, Befehl nicht auf installierter Allowlist). Das belegt die Erreichbarkeit des eingeschränkten SSH-Zugangs, nicht die Installation des neuen Produktionsgateways.
- **Auswirkungen:** Nur Installationsprüfung/Deployment. Keine UI-, Proxy-, Datenbank-, Auth- oder Whitelist-Erweiterung durch diesen Fix. Die bestehende Sicherung und atomare Dispatcher-Installation bleiben erhalten.
- **Offen:** CI und Merge von PR #108; danach Betreiber-Bootstrap mit aktuellem main wiederholen und erst anschliessend HTTP-, Dienst-, Migrations- und Zugriffsschutzprüfungen aktualisieren. Serverseitiger Rollout dieses Fixes ist noch nicht nachgewiesen.
