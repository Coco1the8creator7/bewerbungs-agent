# Career.Agency – Authentifizierung, Release-Gates und Betriebsgrenzen

**Stand 07.11.2026:** Auth-Backend und Kontorouten sind auf `careeragency.ch` aktiviert. Der Server-Smoke bestätigt Landingpage/Feed/Login/Registrierung und den Schutz privater App-, Admin- und API-Routen ohne Sitzung. Reale Admin-Anmeldung mit TOTP, Zustellung einer echten E-Mail und Zwei-Konten-Abnahme sind noch nicht nachgewiesen. Ein Git-Merge ersetzt weder Datenbankmigration noch Serverdeployment.

## Beschlossene MVP-Eigenschaften
- Kostenlos; keine Zahlungsschranke.
- Vorname, Nachname, E-Mail, Passwort, Wohnort; Geburtsdatum freiwillig.
- E-Mail-Bestätigung, danach manuelle Administratorfreigabe.
- Kein Selbstfreischalten; Status `pending` bleibt bis zur Freigabe bestehen.
- TOTP für Administratoren verpflichtend, für reguläre Benutzer freiwillig.
- Standard-Session 72 Stunden, optional 45 Tage mit aktivem Häkchen.
- Eine geschützte Admin-Oberfläche unter `/admin`, kein Einsichtsrecht in persönliche Dossiers.
- Kein Klassenmodell, keine neue Datenfreigabe und keine Migration persönlicher Daten.
- Vorhandene Landingpage, Radar, Dossiers, Agency, globales Design und Lehrstellenfeed bleiben unverändert.

## Laufender Produktionsbetrieb
Die ASGI-Anwendung liegt unter `authservice.asgi:app`. Sie braucht eine dedizierte PostgreSQL-Rolle mit minimalen Rechten und die folgenden **serverseitigen** Umgebungsvariablen:
```text
CAREER_AUTH_DATABASE_URL          # PostgreSQL DSN, nur auf dem Server
CAREER_AUTH_PUBLIC_ORIGIN         # https://careeragency.ch
CAREER_AUTH_TOTP_KEY              # Fernet.generate_key(), 32 Bytes Base64
CAREER_AUTH_MAIL_FROM             # noreply@careeragency.ch
CAREER_AUTH_SMTP_HOST
CAREER_AUTH_SMTP_PORT             # 587 (Standard)
CAREER_AUTH_SMTP_USER
CAREER_AUTH_SMTP_PASS
```
Das einmalige CLI-Bootstrap benötigt zusätzlich `CAREER_AUTH_ALLOW_ADMIN_BOOTSTRAP=YES_ONCE` und ein echtes Terminal; `python -m authservice.bootstrap_admin`. **Keine Credentials in GitHub oder in Chats speichern.**

Voraussetzungen: HTTPS, SMTP-Authentifizierung und DNS-Einträge SPF/DKIM/DMARC; PostgreSQL-Backup; passende Datenbankprivilegien; Dienst nur auf Loopback; eingeschränkte systemd-Unit. Der Administrator muss bei der Erstanmeldung TOTP einrichten.

## Caddy: notwendige Fail-Closed-Einbindung
Die folgende Skizze ist **keine** produktionsfertige Caddyfile. Erst den aktuellen Caddy-Routenbaum vollständig vergleichen; nie blind ersetzen.

- `/api/auth/*`, `/api/admin/*`, `/account/*` und `/admin` müssen zum lokal gebundenen ASGI-Prozess gehen.
- `/app/*` sowie **jede** dazugehörige statische Datei und private Daten-API müssen serverseitig autorisiert werden; nicht nur die Start-HTML-Datei.
- Vor Rückgabe privater Daten ist `GET /api/auth/check-app` mit dem ursprünglichen Session-Cookie auszuführen; nur HTTP 200 darf Zugriff erlauben. Ein 401/403 muss verweigern, nicht auf eine statische Ausweichroute fallen.
- Öffentliche Landingpage und der zulässige zentrale Lehrstellenfeed können öffentlich bleiben. Es dürfen keine früheren Gmail-Jobdaten veröffentlicht werden.
- Ein noch öffentliches GitHub-Pages-Deployment darf **nicht** als geschützte Instanz behandelt werden. Vor Produktionsfreigabe alternative URLs und alte Kopien prüfen.

## Release-Gates
1. Tatsächliches Caddy-Routing, Dienste, PostgreSQL-Installation, Backups und SMTP verifizieren.
2. Migrationen auf separat gesicherter Testdatenbank ausführen; PostgreSQL-CI muss vollständig grün sein.
3. Benutzerregistrierung → Bestätigung → Warteseite → Admin-MFA → Freigabe → Benachrichtigung → Zugriff real testen.
4. Direktaufrufe von `/app/`, statischen Ressourcen, `/admin`, und Backend-API ohne Session/mit fremdem Konto prüfen.
5. Sessionwiderruf bei Sperrung und Reset, Brute-Force-Schutz, einmalige Tokens, TOTP-Replay und Wiederherstellungscodes testen.
6. HTML/JS-Regression der bisherigen Landingpage, Hauptnavigation, Radar, Filter-KI, Dossier Studio und Agency; alter Gmail-Feed bleibt verborgen.
7. Sicherheitsreview, Datenschutz- und Datenaufbewahrungsregeln für Minderjährige, E-Mail-Zustellbarkeit und Wiederherstellung im Notfall.
8. Erst dann getrennte Produktivfreigabe mit überprüftem Rollback.

## Offene Risiken / Implementierungsgrenzen
- Der bestehende GitHub-Actions-SSH-Runner erlaubt **nur das Staging** von Commits in seinem privaten Workspace. Er hat weder produktive Caddy-/systemd-Rechte noch Datenbankmigration- oder Deployment-Rechte. Keine Umgehung durch SSH-Key-Entfernung oder globale sudo-Rechte.
- SMTP-Versand erfolgt derzeit direkt nach der Transaktion. Bei Mailfehlern ist eine nachträgliche Zustellung nicht garantiert; für Produktionsbetrieb transaktionales Outbox-/Retry-Verfahren ergänzen.
- `/app/` und zugehörige private Ressourcen werden vom ASGI-Dienst ausgeliefert und ohne Sitzung serverseitig abgewiesen. Die produktive Zwei-Konten-Isolation ist noch nicht separat abgenommen.
- Reverse-Proxy-IP-Zuordnung, sichere Protokollaufbewahrung, Löschung abgelaufener Tokens und Datenschutzinformationen sind für produktiven Betrieb noch abzunehmen.
- Passwort- und MFA-Management sowie E-Mail-Verifizierung brauchen Tests in einem realen, geschützten Stagingbetrieb; ein erfolgreicher CI-Test allein ist kein Produktivnachweis.

**Freigegebenes UI:** Öffentliche Landingpage, Hauptnavigation, Startseite, Radar, Filter-KI, Dossier Studio, Agency und globales Designsystem werden nicht verändert. Neue UI: isolierte Konto-/Admin-Oberflächen mit passender Schrift/Farbgebung.
