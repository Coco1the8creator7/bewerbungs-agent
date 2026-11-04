# Career.Agency: automatisches Frontend-Deployment auf Infomaniak

Status: **GitHub Actions vorbereitet; Live-Schaltung erst nach Konfiguration von Infomaniak und GitHub-Secrets.**

Die Datei `.github/workflows/deploy-infomaniak.yml` stellt nach jedem Push auf `main` mit Änderungen an `dashboard/**` automatisch das **statische Dashboard** bereit. Vor dem Upload werden die bestehenden JavaScript-Prüfungen und Tests ausgeführt. Schlägt ein Test fehl, wird nicht veröffentlicht. Es gibt **keinen manuellen Freigabeschritt**.

> Wichtig: Dies ist zunächst ein **Frontend-Deployment**, kein automatischer Backend-Release mit Prozessneustart, Migrationen oder persistenten Benutzerdaten. Microsoft-Authenticator-Login und die Mehrbenutzer-Datenbank sind noch nicht Bestandteil dieser Integration.

## Einmalige Einrichtung bei Infomaniak

1. Im Infomaniak Manager das gewünschte Hosting und die Website anlegen. Bei Node.js muss die laufende Anwendung statische Dateien aus dem Zielverzeichnis ausliefern; ein neu angelegtes Node.js-Beispielprojekt macht das nicht automatisch für unser Dashboard. Vor dem ersten Deployment die Zuordnung von Webadresse, Node.js-Startbefehl und Verzeichnis prüfen.
2. Unter **FTP / SSH** einen separaten Benutzer mit **SSH/SFTP-Rechten** für diese Website erstellen. Infomaniak legt bei Node.js-Websites nicht automatisch einen solchen Benutzer an.
3. Den **SFTP-Hostnamen**, **Benutzernamen** und das **Passwort** im Manager entnehmen.
4. Den **absoluten, bereits existierenden Serverordner** bestimmen, aus dem die laufende Website die öffentlichen Dashboard-Dateien ausliefert (z. B. einen eigens für das Frontend angelegten Ordner). Diesen Pfad nicht erraten; über die SSH-Konsole des Managers ermitteln. Der Workflow erstellt **keine** Serververzeichnisse.
5. Den **öffentlichen SSH-Hostschlüssel** des SFTP-Servers über einen vertrauenswürdigen Kanal verifizieren (Fingerabdruck beim Anbieter / Support abgleichen). Der GitHub-Workflow verlangt dafür einen OpenSSH-`known_hosts`-Eintrag, z. B. eine komplette Zeile im Format `HOST ssh-ed25519 AAAA...`. Nicht ungeprüft irgendeinen `ssh-keyscan`-Wert übernehmen.

Hinweise von Infomaniak:
- https://www.infomaniak.com/de/support/faq/2537/erstellen-sie-eine-nodejs-website-bei-infomaniak
- https://www.infomaniak.com/de/support/faq/1982/ftp-ssh-konten-verwalten
- https://www.infomaniak.com/de/support/faq/446/die-protokolle-ftp-sftp-und-ssh-fur-webhosting-verstehen
- https://www.infomaniak.com/de/support/faq/2054/mit-ssh-schlussel-anmelden

## Fünf geschützte GitHub-Secrets einrichten

GitHub → Repository `bewerbungs-agent` → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Inhalt |
| --- | --- |
| `INFOMANIAK_SFTP_HOST` | SFTP-Hostname aus dem Manager (nur Hostname, ohne `sftp://`) |
| `INFOMANIAK_SFTP_USER` | Name des separaten SSH/SFTP-Benutzers |
| `INFOMANIAK_SFTP_PASSWORD` | Passwort des separaten Benutzers |
| `INFOMANIAK_SFTP_PATH` | Absoluter Ordner auf dem Server, aus dem die Webanwendung Dashboard-Dateien ausliefert |
| `INFOMANIAK_SSH_KNOWN_HOSTS` | Verifizierte komplette OpenSSH-`known_hosts`-Zeile für den SFTP-Host |

**Keine Zugangsdaten im Chat, in GitHub-Dateien, Issues oder Commit-Texten veröffentlichen.**

Für Node.js-Hosting ist laut Infomaniak der SSH-Key-Login nicht verfügbar; deshalb verwendet dieser Workflow SFTP per Passwort **mit vorab verifiziertem Server-Hostschlüssel**. Das ist ein dedizierter Deployment-Account mit möglichst eng beschränkten Rechten.

## Test und Normalbetrieb

1. Erst nach Hinterlegen der fünf Secrets in GitHub unter **Actions → Career.Agency – Infomaniak Frontend automatisch veröffentlichen → Run workflow** einen ersten Test auslösen.
2. In den Actions-Logs müssen `Frontend prüfen` und `Frontend per SFTP hochladen` erfolgreich sein.
3. Über die Webadresse im Browser testen, ob die neue Dashboard-Version erreichbar ist (gegebenenfalls Cache aktualisieren).
4. Danach genügt ein erfolgreiches `git push` auf `main`, sofern das Dashboard oder der Workflow verändert wurde. GitHub veröffentlicht automatisch; keine manuelle Freigabe.
5. Bei Problemen: zunächst Actions-Logs und Infomaniak-Website-Konfiguration prüfen. Änderungen können durch erneutes Deployen eines bekannten guten Commits rückgängig gemacht werden.

### Was der Workflow bewusst **nicht** macht

- Er lädt **nur** den Inhalt von `dashboard/` in das konfigurierte Zielverzeichnis hoch; nicht das gesamte Repository.
- Er löscht **keine** Dateien auf dem Server. Entfernte Altdateien müssen bei Bedarf separat bereinigt werden.
- Er startet einen laufenden Node.js-Prozess **nicht** neu und führt weder `npm install` noch Datenbankmigrationen aus. Für spätere Backend-Updates brauchen wir eine zusätzliche kontrollierte Release-/Restart-Lösung.
- Er lädt keine lokalen IndexedDB-Daten oder Dossiers auf den Server. Private Nutzerdaten gehören nicht ins öffentliche Webverzeichnis.
- Er garantiert ohne abschliessenden Aufruf der Live-Website keinen erfolgreichen End-to-End-Release.
- Bis die Secrets eingerichtet sind, scheitert der Job ausdrücklich mit einer verständlichen Fehlermeldung.

### Sicherheitshinweise

- Repository-`main` darf nur für vertrauenswürdige Änderungen beschreibbar sein, da jeder passende Push eine Veröffentlichung auslösen kann.
- Für Personenprofile und Dossiers müssen später separate Authentifizierung, serverseitige Zugriffskontrollen, geschützte Speicherung und Backups eingerichtet werden.
- Für Backendausrollungen, Datenbankmigrationen und Rollbacks sollte der Workflow künftig um versionierte Releases erweitert werden.
