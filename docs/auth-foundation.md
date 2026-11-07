# Career.Agency – Auth-Fundament (Entwicklungsstand)

## Status
Branch `feature/auth-foundation-20261107`; **nicht deployt**, **keine Datenbankmigration ausgeführt**.
Dies ist die erste isolierte Datenbankgrundlage, **noch kein funktionierendes Login**.

## Verifizierte Repository-Befunde (7. November 2026)
- `AGENTS.md` verlangt Konzeptprüfung, Tests und Abnahme.
- `dashboard/index.html` ist vorhanden; `dashboard/urban-mono-magenta.css` ist das Designsystem.
- `ops/server/ca-ops-command` erlaubt dem eingeschränkten GitHub-Actions-SSH-Account ausschliesslich `status` und `tests`. Die Tests klonen derzeit die Crawler-PoC-Branch; **kein Remote-Deploy- oder Migrationsbefehl**.
- Der Repository-README beschreibt bisher statische/browserlokale Speicherung. Er ist teilweise historisch und kein Beleg über produktive Serverdienste.
- PostgreSQL-Installation, produktiver App-Backend-Prozess und Caddy-Routing sind von hier noch nicht verifiziert.

## Geltende Produkteckpunkte
- Normale Benutzer: E-Mail-Bestätigung, **manuelle Adminfreigabe**; kostenlose Pilotphase.
- Administrator: über einmaligen gesicherten Serverbefehl, verpflichtende TOTP-2FA.
- Normale Benutzer: TOTP freiwillig; Wiederherstellungscodes bei aktivierter 2FA.
- 72 Stunden Standardsitzung, optional 45 Tage mit expliziter «Angemeldet bleiben»-Wahl.
- Klassen-/Lehrpersonenverwaltung aus externer Anleitung **nicht beschlossen**.
- Persönliche Dossiers/Bewertungen nicht systemweit für Admins sichtbar.
- Vorhandene UI und Crawler bleiben unverändert; alte Gmail-Stellen dürfen nicht erscheinen.

## Schema und Grenzen
`db/migrations/001_auth_foundation.sql` erstellt im eigenen Schema `career_auth`:
- `users` (Rolle, Freischaltungsstatus, Profilfelder, optionale Geburtstagsangabe)
- `one_time_tokens` (nur SHA-256-Token-Hashes; Verifikation und Reset)
- `sessions` (nur Sitzungs-Hashes, Widerruf und Ablauf)
- `totp_credentials` (verschlüsselte Secrets; Schlüssel extern zu verwalten)
- `recovery_codes` (nur Hashes)
- `admin_audit` (sicherheitsrelevante Aktionen)

UUIDs müssen vom vertrauenswürdigen Backend erzeugt werden. Das Backend muss Token kryptografisch sicher generieren, die Hashes bilden, Transaktionen für Einmalverbrauch verwenden und Ablauf prüfen. E-Mail-Normalisierung und Passwortvalidierung erfolgen im Backend. **Tabellen allein bewirken keine Authentifizierung, E-Mail-Zustellung, Schutz gegen Brute Force, RLS oder Zugriffssicherheit.**

## Einmalige kontrollierte Migration
Nur nach Server-/Backup- und Versionsprüfung auf einer **separaten Testdatenbank**:
```sh
psql -X -v ON_ERROR_STOP=1 -d careeragency_auth_test -f db/migrations/001_auth_foundation.sql
psql -X -v ON_ERROR_STOP=1 -d careeragency_auth_test -f db/tests/auth_foundation_smoke.sql
```
Nicht blind auf Produktion ausführen. Migration ist absichtlich nicht stillschweigend idempotent. Vor produktiver Anwendung: Rollbackstrategie, gesicherte Backups, restriktive DB-Rollen und Migrationstracking einführen.

## Nächster technischer Schritt
1. Über bestehende Ops-Verbindung `status` prüfen und per abgesicherter Inventur feststellen, ob bereits eine Server-App oder PostgreSQL-Konfiguration existiert; **nicht** den Runner mit Sudo- oder Schreibrechten ausstatten.
2. Backend-Stack und Datenbankverbindung festlegen, dann etablierte Auth-Bibliothek mit E-Mail-Verifizierung, Passwort-Reset, TOTP, Session- und Freigabekontrolle integrieren.
3. Vor Live-Schaltung Direkt-URL-/API-Bypass, Sessionwiderruf, Admin-MFA, Benutzertrennung und alte GitHub-Pages-Deploymentwege testen.

## Prüfnachweis
Der SQL-Smoke-Test ist vorbereitet, aber **noch nicht auf PostgreSQL ausgeführt**. Keine Auth-Funktion ist als funktionsfähig zu betrachten.
