# Auth-Backend: revisionsgebundene Laufzeitvorbereitung

Dieser Schritt **aktiviert kein Login**. Er richtet ausschliesslich die Produktions-Laufzeit mit einer lokalen ASGI-Bindung auf `127.0.0.1:8765` ein. Der systemd-Dienst bleibt deaktiviert und wird nicht gestartet.

## Bekannter Ist-Zustand (Serverausgabe 07.11.2026)

- Caddy liefert statische Inhalte aus `/var/www/careeragency/current` und den öffentlichen Lehrstellenfeed aus.
- PostgreSQL aktiv; bisher nur `postgres` und `careeragency_test` gefunden.
- Keine produktive Login-Datenbank, keine Auth-Unit, keine Caddy-Auth-Routen, keine `/etc/careeragency/auth.env`.

## Vorbereitung auf dem Server (Administrator)

```bash
git clone https://github.com/Coco1the8creator7/bewerbungs-agent.git /tmp/careeragency-auth-runtime
cd /tmp/careeragency-auth-runtime
git checkout <verified-current-main-SHA>
bash -n ops/production/prepare-auth-runtime.sh
sudo bash ops/production/prepare-auth-runtime.sh <verified-current-main-SHA>
```

Der Installer verweigert eine vorhandene Auth-Unit oder einen existierenden Auth-Deployment-Symlink. Er lädt Quellcode nur vom aktuellen `main`, kompiliert Python und richtet eine isolierte virtuelle Umgebung ein. Dabei sind Paketinstallationen notwendig; sie sind noch nicht mit einer Hash-Lockdatei reproduzierbar.

## Separate Freigabegates für tatsächlichen Produktivbetrieb

1. Dedizierte produktive PostgreSQL-Datenbank samt eigenem Runtime- und Migration-Account. Vor SQL: getesteter Dump und vollständiger Restore-Test auf separater Datenbank. Migrationen 001 und 002 ausführen.
2. Serverweite Datei `/etc/careeragency/auth.env` ausschliesslich root-lesbar anlegen; SMTP, Fernet-Key, public origin, DSN konfigurieren, ohne Secrets in GitHub oder Chat zu kopieren.
3. Dienst manuell auf Loopback starten und direkte API-Healthchecks durchführen. Noch kein externes Routing.
4. Bestehende Caddyfile vollständig begutachten. API- und Konto-Routen hinzufügen, ohne `/jobs.json`, `/career-filter.js` oder die Landingpage zu verändern.
5. **Bevor `/app/` veröffentlicht wird:** Schutz aller privaten HTML-, JS-, JSON- und Upload-Ressourcen serverseitig durchsetzen. Nicht bloss UI-Weiterleitungen. Direkte unauthentifizierte URLs und GitHub-Pages-Kopien prüfen.
6. Registrierung, E-Mail-Bestätigung, Admin-TOTP, Freischaltung und Sessionwiderruf inklusive SMTP-Retry/Outbox-Strategie testen.
7. Rollback des Codes auf vorherige Release-Symlinks; SQL-Migrationen nur mit expliziter Restore-Entscheidung rückgängig machen (Datenverlustrisiko!).

**Kritische Grenze:** Die bisherige statische Release-Gateway-Erweiterung unterstützt weder die Auth-Service-Installation noch Datenbank- oder Caddy-Administration. Diese Vorbereitung schafft noch keinen Remote-Ausführungsbefehl über SSH/GitHub Actions.
