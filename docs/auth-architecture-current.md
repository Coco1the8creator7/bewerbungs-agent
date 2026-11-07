# Career.Agency – verbindlicher Login-Pfad (7. November 2026)

## Aktueller Produktentscheid
Für die aktuelle Infomaniak-Migration ist **der eigene FastAPI-Dienst mit isolierter PostgreSQL-Datenbank** die ausgewählte Implementierung. Er bedient nach freigegebener Aktivierung `/account/login`, `/account/register`, `/api/auth/*`, `/api/admin/*`, `/admin` und den geschützten `/app/`-Assetpfad. Es wird keine Zahlungsschranke eingerichtet. E-Mail-Verifizierung vor manueller Admin-Freigabe bleibt Pflicht. TOTP ist für Administratoren erforderlich.

## Frühere Supabase-Pilotimplementierung
Der im Oktober vorbereitete Stand unter `dashboard/account.html`, `dashboard/account.js`, `dashboard/account-config.js` und `supabase/` ist ein **separater historischer Proof of Concept**. Er ist weder ein Nachweis für eine produktive Supabase-Verbindung noch die hier freigegebene Login-Architektur. Die öffentliche Konfiguration enthält derzeit keine URL und keinen Publishable Key. Keine Produktionseinstellungen oder personenbezogenen Daten dort eingeben.

Um zwei parallele Registrierungswege zu vermeiden, leitet der neue Caddy-Release `/account.html` auf den aktuellen Pfad `/account/login` um. Die historischen Dateien bleiben aus Reversibilitätsgründen im Repository. Dies betrifft keine anderen freigegebenen Dashboard-Komponenten.

## Zugriffsgrenzen
- Die bestehende öffentliche Landingpage und der allgemeine Lehrstellenfeed bleiben öffentlich. Dies ist **keine** nutzergetrennte Dossier-API.
- Der authentifizierte `/app/`-Pfad prüft Session, Aktivierung, MFA und Sperrstatus bei jedem Request. **Nach dem gebündelten Rollout liefert er die freigegebene Dashboard-Oberfläche mit privatem Nicht-Dossier-Speicheradapter**. Der Adapter verwendet die authentifizierte Benutzer-ID und serverseitige Besitzprüfung. Dossier-Skripte und das Studio bleiben unter `/app/` deaktiviert, damit ihre bisherige gemeinsame lokale Datenbank keine Kontodaten vermischt. Die öffentliche Demo bleibt unverändert zugänglich.
- Die alte Dashboard-Speicherung verwendet den festen IndexedDB-Namen `bewerbungs-agent-local-v1` und ist deshalb nicht mandantenfähig. Bestehende browserlokale Daten, Bewertungen und Dossiers werden **nicht** automatisch serverseitig getrennt, synchronisiert oder migriert. Kein Benutzerimport, keine Datenlöschung und kein automatischer CV-Upload.
- Alte GitHub-Pages-Kopien können weiter erreichbar sein. Keine persönlichen Daten oder Auth-Secrets aus dem SaaS in historische öffentliche Pfade schreiben.
- Datenschutzanforderungen für minderjährige Nutzer, Speicherfristen, sichere Datenexporte und Benutzertrennung müssen separat verifiziert werden, bevor persönliche Dossiers produktiv synchronisiert werden.

## Abnahmekriterium
Nicht nur `/account/login` muss HTTP 200 liefern: anonyme `/api/auth/me`, `/admin` und `/app/` müssen HTTP 401 liefern; `/account.html` muss auf den kanonischen Login umleiten. Login, TOTP, E-Mail-Bestätigung und manuelle Freigabe müssen anschliessend mit einem echten Testkonto erfolgreich geprüft werden.

Die kanonische Inbetriebnahme ist in `docs/production-completion.md` dokumentiert. `go-live-auth.sh` delegiert an diesen gebündelten Ablauf; ältere Einzelinstaller allein stellen keinen abgeschlossenen Produktivstand her.
