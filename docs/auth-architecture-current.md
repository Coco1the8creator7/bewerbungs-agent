# Career.Agency – verbindlicher Login-Pfad (7. November 2026)

## Aktueller Produktentscheid
Für die aktuelle Infomaniak-Migration ist **der eigene FastAPI-Dienst mit isolierter PostgreSQL-Datenbank** die ausgewählte Implementierung. Er bedient nach freigegebener Aktivierung `/account/login`, `/account/register`, `/api/auth/*`, `/api/admin/*`, `/admin` und den geschützten `/app/`-Assetpfad. Es wird keine Zahlungsschranke eingerichtet. E-Mail-Verifizierung vor manueller Admin-Freigabe bleibt Pflicht. TOTP ist für Administratoren erforderlich.

## Frühere Supabase-Pilotimplementierung
Der im Oktober vorbereitete Stand unter `dashboard/account.html`, `dashboard/account.js`, `dashboard/account-config.js` und `supabase/` ist ein **separater historischer Proof of Concept**. Er ist weder ein Nachweis für eine produktive Supabase-Verbindung noch die hier freigegebene Login-Architektur. Die öffentliche Konfiguration enthält derzeit keine URL und keinen Publishable Key. Keine Produktionseinstellungen oder personenbezogenen Daten dort eingeben.

Um zwei parallele Registrierungswege zu vermeiden, leitet der neue Caddy-Release `/account.html` auf den aktuellen Pfad `/account/login` um. Die historischen Dateien bleiben aus Reversibilitätsgründen im Repository. Dies betrifft keine anderen freigegebenen Dashboard-Komponenten.

## Zugriffsgrenzen
- Die bestehende öffentliche Landingpage und der allgemeine Lehrstellenfeed bleiben öffentlich. Dies ist **keine** nutzergetrennte Dossier-API.
- Der authentifizierte `/app/`-Pfad prüft Session, Aktivierung, MFA und Sperrstatus **für jede HTML-/Asset-Anfrage**.
- Bestehende browserlokale IndexedDB-Daten, Bewertungen und Dossiers werden dadurch **nicht** automatisch serverseitig getrennt, synchronisiert oder migriert. Kein Benutzerimport, keine Datenlöschung und kein automatischer CV-Upload.
- Alte GitHub-Pages-Kopien können weiter erreichbar sein. Keine persönlichen Daten oder Auth-Secrets aus dem SaaS in historische öffentliche Pfade schreiben.
- Datenschutzanforderungen für minderjährige Nutzer, Speicherfristen, sichere Datenexporte und Benutzertrennung müssen separat verifiziert werden, bevor persönliche Dossiers produktiv synchronisiert werden.

## Abnahmekriterium
Nicht nur `/account/login` muss HTTP 200 liefern: anonyme `/api/auth/me`, `/admin` und `/app/` müssen HTTP 401 liefern; `/account.html` muss auf den kanonischen Login umleiten. Login, TOTP, E-Mail-Bestätigung und manuelle Freigabe müssen anschliessend mit einem echten Testkonto erfolgreich geprüft werden.
