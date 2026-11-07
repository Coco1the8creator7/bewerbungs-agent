# Career.Agency – Auth produktiv schalten (kontrollierter Ablauf)

**Status:** Die Freigabe erfolgt nur nach grünen PR-Tests sowie bestätigtem Root-Operator-Lauf. Weder ein GitHub-Merge noch ein SSH-Workspace-Stage ist ein Backend-Deployment.

## Voraussetzungen
- Infomaniak-Server: PostgreSQL und Caddy aktiv.
- Ein gültiges SMTP-Postfach unter `careeragency.ch` mit separat verwaltetem Passwort.
- Ein aktueller, sauberer Checkout des **getesteten Main-Commits**.
- Zugang als Server-Administrator mit sudo und interaktivem Terminal.
- Kein offener unüberprüfter Systemd-Konflikt und kein bestehendes produktives Auth-Deployment.
- Backups werden unter `/var/backups/careeragency-ops/auth/` erzeugt; Zustand von `careeragency_auth` wird vor Migration erkannt.

## Ablauf
```bash
git clone --depth 1 --branch main \
  https://github.com/Coco1the8creator7/bewerbungs-agent.git \
  /tmp/careeragency-auth-release
cd /tmp/careeragency-auth-release
sha="$(git rev-parse HEAD)"
sudo bash ops/production/go-live-auth.sh "$sha"
```

Das Skript:
1. Prüft, dass lokal **exakt der aktuelle, unveränderte Main-Commit** vorliegt.
2. Installiert die isolierte Auth-Laufzeit. Ein bereits vorhandener Systemd-Dienst muss *bytegenau* dem geprüften Template entsprechen.
3. Legt ausschliesslich eine neue Auth-Datenbank an, vervollständigt eine leere, bereits angelegte Auth-DB oder prüft eine vollständig vorhandene. **Keine Migration über unbekannte Teilzustände hinweg.**
4. Erfragt lokal SMTP-Hostname, Absender, Benutzername und Passwort. Infomaniak-Standard: `mail.infomaniak.com:587` mit zertifikatsgeprüftem STARTTLS. Es erfolgt eine Anmeldeprüfung, **keine Test-E-Mail**. Das Passwort erscheint nicht in GitHub oder der Terminalausgabe.
5. Startet den Dienst ausschliesslich auf `127.0.0.1:8765` und prüft: Login-HTML 200; anonymer Zugriff auf `/api/auth/me`, `/admin`, `/app/` jeweils 401.
6. Erstellt, falls noch kein Admin vorhanden, dessen Zugang über interaktive Passworteingabe. Beim ersten Login ist TOTP verpflichtend.
7. Sichert die Caddyfile, ergänzt nur die Auth-Pfade und führt Syntaxprüfung, Reload und HTTP-Sicherheitstests aus. Die öffentliche Landingpage und der Jobfeed müssen ihren vorherigen Status behalten. Bei einem Fehler wird die Caddyfile automatisch zurückgespielt.

## Erfolgsmerkmale
```text
auth_backend=loopback_ready
auth_caddy=routed
auth_public_landing=unchanged
auth_public_feed=unchanged
auth_admin_unauthenticated=denied
auth_app_unauthenticated=denied
auth_go_live=routes_published
```

**Nach der Inbetriebnahme:** Den SMTP-Test mit echter Registrierung durchführen, E-Mail-Link prüfen, Admin TOTP einrichten, Benutzer manuell freischalten, private Session ausloggen, Direkt-URL-Zugriff testen. Sofern einer dieser Tests scheitert, keine freigegebene Abnahme behaupten.

## Rückfall / Grenzen
- Caddy-Skript hält ein Root-Backup der bisherigen Datei bereit und rollt bei fehlgeschlagener Validierung zurück.
- Bei fehlgeschlagener Auth-Probe wird der Backend-Dienst wieder gestoppt, bevor die Routen veröffentlicht werden.
- Keine automatische Löschung von Datenbanken oder bereits angelegten Administratoren. Datenbank-Restore nur nach separater, bewusster Entscheidung.
- Die ursprüngliche öffentliche Dashboard-Version bleibt aus Kompatibilitätsgründen erreichbar. **Das ist keine abgeschlossene Migration von Dossiers und Bewertungen in benutzerisolierte Serverspeicherung.**
- Die Auth-E-Mails werden derzeit nach der Datenbanktransaktion versendet; bei SMTP-Ausfall ist ein erneuter Versand unter Umständen notwendig. Für höhere Zuverlässigkeit später Retry-Outbox ergänzen.
- Caddyfile mit überlagernden `route`, `rewrite` oder `import`-Anweisungen wird bewusst nicht automatisch angepasst; zuerst prüfen und dann eine passende Änderung freigeben.
- Eine ungeschützte Alt-URL (z.B. alte GitHub Pages) ist kein Ersatz für den autorisierten `/app/`-Pfad. Keine privaten Daten dort publizieren.
