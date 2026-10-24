# Career.Agency – Phase 1: Multi-User-Grundlage (Pilot, 24.10.2026)

## Beschluss und Geltungsbereich

**Gewählt:** separate statische Kontoseite + Supabase Auth + verwaltetes PostgreSQL + zwingende RLS für private Daten + eine Edge Function für MFA-geschützte Kontolöschung. **Nicht** sofortige Änderung des bisherigen Dashboards. Der Altbestand verbleibt bis zur ausdrücklich genehmigten Migration im Legacy-System. Kein automatischer Merge.

**Wichtig: nicht produktionsreif**, solange eine Supabase-Instanz, echte Authentifizierungs-/RLS-Tests, rechtliche Prüfung sowie die Bereinigung öffentlicher Altbestände fehlen. Die Konto-Seite zeigt bis zur Konfiguration nur einen Hinweis. Das Legacy-Dashboard enthält aktuell einen unsicheren GitHub-Token-Sync und darf nicht als SaaS-Mehrbenutzerlösung verwendet werden.

## Bestandsaufnahme main, 24.10.2026

- Öffentliche, rein statische GitHub-Pages-App: `dashboard/index.html`, `dashboard/agency-world.*`, erdiges UI-Theme, `dashboard/storage.js` (opt-in IndexedDB).
- `dashboard/jobs.json`: 183 Inserate im geprüften Stand; Jobschema und Importer vorhanden. Stellen sind allgemein zugängliche Informationen, nicht private Benutzerkonten.
- `dashboard/github-sync.js`: speichert einen Fine-grained-GitHub-Token in `localStorage`; `save()` pusht persönliche Bewertungen direkt in `dashboard/feedback.json` auf **main**. `loadPublic()` liest die Datei öffentlich. Jeder Tokeninhaber mit Schreibrechten könnte Änderungen auf main auslösen.
- `dashboard/feedback.json`: **80'237 Zeichen**, 148 `relevance_ratings`, 124 `activity_log`, ein befülltes freies Bewertungs-/Notizfeld; von der öffentlich erreichbaren Pages-Veröffentlichung umfasst. Persönliche Bewertungs- und Verhaltensmetadaten sind nicht anonym, nur weil sie Job-IDs statt Klarnamen verwenden.
- Über `GET /commits?path=dashboard/feedback.json` wurden **22 Commits** zwischen 22. und 24.10.2026 gefunden. Frühere JSON-Inhalte lassen sich über Commit-Referenzen abrufen. Das ist keine vollständige Prüfung sämtlicher Git-Objekte, Forks, Drittanbieter-Caches oder sämtlicher Geheimnisse.
- `docs/suchvorgaben.md` und weitere Projekttexte enthalten persönliche Berufs-/Pendel-/Gehaltspräferenzen; vor einer öffentlichen SaaS-Nutzung gesondert datenschutzrechtlich beurteilen.
- Vorhandene Tests: Python- und Node-Dashboard-Kontrakte; sie setzen den bisherigen Datenfluss voraus. Die alte Anwendung wird deshalb in Phase 1 nicht umgebaut.

### Sofortige Massnahmen ausserhalb dieses Branches

1. **Offengelegten GitHub-PAT unverzüglich auf GitHub widerrufen/ersetzen**, auch wenn er nicht im Repository selbst steht; eventuell bestehende lokale Browserkopien löschen. Ein bereits geteilter Token ist als kompromittiert zu behandeln.
2. Datenexport/Backup in geschützter Ablage durchführen und auf Vollständigkeit prüfen; private Arbeitsdaten nicht als Issue/PR-Anhang hochladen.
3. Bis zur Migration keine neuen persönlichen Feedback- oder Bewerbungsdaten in `dashboard/feedback.json`, öffentliche Branches oder Pages speichern.
4. **Nach gesonderter ausdrücklicher Freigabe**: öffentlich getrackte Feedback-Datei aus dem künftigen Veröffentlichungszweig entfernen, Page-Veröffentlichung auf unkritische Dateien begrenzen, gegebenenfalls Geschichte mittels `git filter-repo`/GitHub-Verfahren bereinigen und Schlüssel ersetzen. Geschichte umschreiben ändert SHAs und betrifft alle Klone/PRs; zuvor Backup, Impact-Analyse und Kommunikation. GitHub-History-Umschreibung entfernt keine Forks, Caches oder bereits heruntergeladenen Kopien.
5. Github-Sync des Legacy-Dashboards erst mit bestätigtem Migrationsplan deaktivieren/ersetzen (sonst Datenverlust oder Funktionsbruch). Das bisherige Dashboard **nicht** als nutzergetrennte Oberfläche ausliefern.

## Architekturvarianten

| Variante | Stärken | Schwächen / Entscheid |
| --- | --- | --- |
| A: Supabase Auth + PostgreSQL/RLS + statisches Pages-Frontend | wenig Infrastruktur, auth/MFA/Reset, konsistente SQL-Rollen, private Multi-Geräte-Datenhaltung | externer Anbieter, EU-Hosting/Vertrag & RLS-Konfiguration prüfen; **gewählt** |
| B: Managed App-Backend + PostgreSQL + eigener Auth-Server | eigene Business-Logik/Provider-Unabhängigkeit | hoher Betrieb-/Sicherheitsaufwand, zusätzliche Serverwartung; aktuell verworfen |
| C: Firebase Authentication + Firestore | verwaltete Auth und skalierbare NoSQL-Datenhaltung | andere Datenmodellierung und Security Rules, zusätzliche Portierung später für relationales CRM; aktuell verworfen |

Keine Microservices. Öffentlicher Inseratekatalog (`dashboard/jobs.json`) bleibt vom privaten Accountbereich getrennt. Öffentliche Supabase Publishable Keys sind **keine** Server-Secrets; der Service-Role-Key darf ausschliesslich in der Edge-Function-Laufzeit liegen.

## Implementierte isolierte Pilotbausteine

- `dashboard/account.html`, `account.js`, `account-config.js`: separate Kontooberfläche, Registrierung/Email-Bestätigung, Passwort-Login/Reset, Profildaten, TOTP-MFA-Enrollment und Challenge, expliziter Feedback-/Workspace-Import, Export, Abmeldung, Kontolöschung.
- Supabase JS v2.105.0; Browser-Session nutzt `sessionStorage` statt dauerhaftem GitHub-PAT in `localStorage`. Eine offene Session im selben Browser bleibt ein Angriffsrisiko; geteilte Geräte grundsätzlich vermeiden.
- `dashboard/account-core.mjs`: Konto-ID nur aus `auth.getUser()`, kein vom Benutzer vorgegebenes `user_id`. Datenformat-Kompatibilität: `bewerbungs-agent-feedback/1.0.0` und `bewerbungs-agent-workspace/0.3.0`, maximal 10 MiB je Snapshot.
- `supabase/migrations/20261024000100_career_multiuser.sql`: Profile + private Snapshots, FK-Cascade bei Auth-Löschung, RLS auf beiden Tabellen, SELECT/INSERT/UPDATE/DELETE nur für authentifizierte Eigentümer. `anon` hat keinerlei Tabellenrechte.
- `supabase/functions/delete-account/index.ts`: verifiziert JWT serverseitig, erfordert bestätigte Email, AAL2 (TOTP) und explizite Bestätigung, löscht nur den authentifizierten Nutzer mit serverseitigem Service-Role-Key. Lösch-Request verlangt zusätzliche Bestätigung in der UI. JWTs bleiben bis zum Ablauf eventuell noch formal gültig; nicht als Logout-Ersatz behandeln.
- Kein Upload privater Daten ohne expliziten Klick, kein Import des alten `feedback.json` beim Login, kein automatischer CV-Upload, keine automatisierte Bewerbung.

## Setup (nur separater Testbetrieb, keine Echtdaten)

1. Neues Supabase-Projekt im geeigneten europäischen Standort erstellen (Vertrags-, Unterauftragsverarbeitungs-, Export- und Hostingprüfung vor Echtdaten). Auth: Email-Verifizierung aktivieren; Mindestpasswortlänge mindestens 12; Rate Limits/CAPTCHA, geeignete URL- und SMTP-Konfiguration prüfen. Kein anonymer/öffentlicher Profile-Read.
2. Migration mit `supabase db push` oder SQL-Editor im **separaten Testprojekt** anwenden.
3. Edge Function `delete-account` mit JWT-Verifizierung deployen; serverseitig `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS` setzen; den Service-Role-Key niemals committen oder in Pages ausliefern.
4. In `dashboard/account-config.js` ausschliesslich Projekt-URL und **öffentlichen** Publishable Key eintragen. Erlaubte Auth-Redirect-URLs: exakte `account.html`-URL; lokale Testumgebung separat.
5. Unter `dashboard/account.html` ausschliesslich synthetische Testkonten (zwei unabhängige verifizierte Emails) anlegen, jeweils TOTP einrichten, Import/Export und Löschen testen. Keine Inhalte aus dem öffentlich sichtbaren persönlichen `dashboard/feedback.json` dafür einsetzen.
6. Nach erfolgreich bestandener Prüfung und Freigabe kann eine kontrollierte Export-/Import-Migration stattfinden: lokal exportieren, Zuordnung zum richtigen Account explizit bestätigen, JSON-Schema & Anzahl vergleichen, Cloud-Daten nachlesen, erst dann alte Schreibstrecke ausser Betrieb nehmen.

## Prüfbarkeit

- `node --test tests/multi-user.test.mjs`: Konto-ID wird aus validierter Session übernommen, Benutzer A/B sehen nur eigene Mock-Daten, Invalid-JSON wird abgelehnt. **Mock ersetzt keine echte Cloud-Prüfung**.
- `psql ... -f tests/rls_harness.sql`, Migration, `tests/rls_isolation.sql`: echte PostgreSQL-RLS-Prüfung mit **zwei synthetischen Accounts**, Cross-Account SELECT/INSERT/UPDATE/DELETE, anonyme Verweigerung, FK-Kaskade. Die CI-Workflow-Datei führt dies mit PostgreSQL 16 aus. Der Test-Harness simuliert die JWT-abgeleitete `auth.uid()`; er testet **nicht** die Kryptografie der Supabase-Anmeldung.
- Live: Zwei reale Supabase-Testkonten und End-to-End-E-Mail/Passwort, TOTP, Session-Ablauf, Passwort-Reset, API-Tampering, geschützte Löschung und Datenexport **noch offen**; ohne bereitgestellte Testinstanz nicht verifiziert.

## Datenschutz und minderjährige Zielgruppe

- Die Sekundarstufen-Zielgruppe macht Transparenz, Datenminimierung, verständliche Lösch-/Exportprozesse, minimale Protokolle und eine Alters-/Einwilligungsstrategie besonders wichtig; weder Geburtsdatum noch Schulklasse sind in Phase 1 Pflichtfelder.
- Verantwortlichkeit nach revidiertem Schweizer DSG, Auftragsverarbeitungsvertrag, internationale Bekanntgabe/Angemessenheit, Unterauftragsverarbeiter, Datenaufbewahrung, Backup-Löschfristen, Informationspflicht und allfällige DSGVO-Anwendbarkeit **vor Livebetrieb** klären. Dieser Prototyp ist keine abschliessende Rechtsprüfung.
- Keine KI-Profile oder Bewerbungsunterlagen im SaaS-Pilot. Spätere Dokumentenspeicherung nur in privaten Storage-Buckets mit eigenständiger Policy, Malware-/MIME-/Grössenprüfung und Löschkonzept.
- Alterserfassung, Erziehungsberechtigte und Notfallzugriff sind offene Produkt- und Rechtsentscheidungen; Minderjährige nicht durch voreingestellte Elternfreigaben entmündigen, aber wirksame Schutzmassnahmen konzipieren.
- Kein öffentliches GitHub-Repository als Speicher für Feedback, Kontaktdaten, Lebensläufe, Bewerbungsaktivitäten oder personenbezogene Trainingslabels.

## Offene Entscheidungen / Release-Sperren

- **Blockiert:** Livebetrieb für Jugendliche, Migration/Entfernung bestehender persönlicher Daten aus `main` und Historienänderungen – nur mit ausdrücklicher Freigabe.
- **Extern:** Supabase-Projekt, Hostingregion, vertraglicher Datenschutz, SMTP/Email-Bestätigung, Auth-Redirects, DNS/Custom-Domain, CDN/CSP und Login-Rate-Limits.
- **Technisch:** browserseitige vollständige Sync-Anbindung des Bestands-Dashboards, Konfliktbehandlung mehrerer Geräte/Revisionen, Offline-Strategie, gesicherte Backups, sichere File-Storage-Policies, Sitzungslaufzeit, Penetrationstest.
- **MFA:** TOTP gewählt. Passkeys/WebAuthn laut Supabase-Dokumentation im Oktober 2026 noch experimentell; erneute Evaluation vor Einführung.
- **Produkt:** Stufe 2 (lernender Jugendlicher-Assistent), Bewerbungsfreigaben, Jugend-UX, Datenschutzinformation und Onboarding werden gesondert entschieden.
