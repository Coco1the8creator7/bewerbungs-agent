# SSH-Schreibzugriff für Career.Agency (GitHub → Infomaniak)

## Beschluss
ChatGPT darf über die bereits geprüfte GitHub-Action **echte Dateien auf dem
Infomaniak-Server schreiben**, jedoch als eigener Linux-Benutzer
`careeragency_runner` innerhalb
`/home/careeragency_runner/careeragency-workspace/releases/<commit-sha>/`.

Der Schreibauftrag ist **nicht** bloss ein Lesetest: GitHub wird auf dem
Server geklont und ein ganz bestimmter Git-Commit dauerhaft und atomar
ausgecheckt. GitHub-Änderungen aus ChatGPT können damit ohne wiederholtes
Kopieren von Terminalbefehlen auf dem Server bereitgestellt werden.

Für **produktive Frontend-Änderungen** existiert unabhängig davon bereits
der Workflow `.github/workflows/deploy-infomaniak.yml`, der nach dem Merge
nach `main` getestete `dashboard/**` Dateien via SFTP publiziert. Dessen
Berechtigungen werden hier nicht ausgeweitet.

## 1. Einmalige Installation nach Pull-Request-Merge

```bash
cd /tmp/careeragency-server-ops-bootstrap
git pull --ff-only origin main
sudo bash ops/server/enable-write.sh
```

Erwartet:

```text
ssh_workspace_write=enabled
workspace=/home/careeragency_runner/careeragency-workspace/releases
production_files_changed=false
caddy_restart=false
secrets_changed=false
```

Das Skript prüft das bisherige Forced-Command-SSH-Verfahren und die
Benutzerberechtigungen, erstellt das private Arbeitsverzeichnis und
installiert das root-eigene Staging-Skript. Es verändert weder die Caddy-
Konfiguration noch das produktive Webroot oder die Datenbank und braucht
**keine neuen Secrets oder SSH-Schlüssel**.

## 2. Schreibauftrag aus ChatGPT auslösen

Die bereits verbundene GitHub-App kann ein Issue unter folgendem Titel
erstellen (vollständiger Commit-Hash, 40 kleine Hex-Zeichen):

```text
CA-OPS: stage b80941a80968880b63db6d2d1ce0be8feebaa720
```

Die GitHub-Action prüft den Issue-Ersteller (fest auf GitHub User ID
`343900642`), die SHA-Syntax und die Repo-Zugehörigkeit. Über die
bestehenden `careeragency-ops` Secrets verbindet sie sich per SSH.
Der Forced-Command-Dispatcher ruft ausschliesslich das root-eigene
Staging-Skript auf, **ohne** `sudo` für den Server-Benutzer.

Alternativ in GitHub Actions manuell `stage` und die SHA eingeben.

Erwartetes Ergebnis im **öffentlichen** Actions-Log (keine geheimen Werte):

```text
workspace_stage=written
workspace_commit=b80941a80968880b63db6d2d1ce0be8feebaa720
workspace_target=/home/careeragency_runner/careeragency-workspace/releases/b80941a80968880b63db6d2d1ce0be8feebaa720
production_modified=false
```

Ein wiederholter Auftrag zu einer unveränderten SHA liefert
`workspace_stage=already_present`. Wenn das vorhandene Workspace-Checkout
lokal verändert wurde, wird es **nicht** überschrieben. Die Zahl der
Checkout-Verzeichnisse ist begrenzt, um das Serverlaufwerk nicht vollzulaufen.

## 3. Produktiven Code ändern

1. ChatGPT entwickelt im GitHub-Feature-Branch und erstellt einen Pull Request.
2. Die Tests prüfen den Code. ChatGPT kann den Commit zusätzlich mit
   `CA-OPS: stage <sha>` im SSH-Workspace ablegen.
3. Nach deinem Merge auf `main` veröffentlicht der schon bestehende
   SFTP-Workflow das Frontend automatisch – **ohne erneute SSH-Konsolenbefehle**.
4. Der SSH-Schreibzugriff ist **nicht** identisch mit einem
   Root-/Produktiv-Schreibrecht: Caddy, PostgreSQL und Serverdienste benötigen
   künftig separate, konkret begrenzte Freigaben.

Ein produktiver Release darf **nicht** allein durch eine Stage-Issue-Nachricht
ausgelöst werden. Das bestehende Designsystem und freigegebene UI bleiben
unverändert, bis ein entsprechender PR bewusst gemergt wurde.

## Sicherheit und wichtige Grenzen

- **GitHub-Ruleset:** Zum Prüfzeitpunkt war ein aktives Ruleset
  `Protect main – Career.Agency` mit Pull-Request-Pflicht vorhanden.
- **Keine freie Root-Shell:** Das SSH-Konto darf nach wie vor nur
  fest definierte Operationen ausführen. Ein Git-Commit aus einem
  beliebigen PR wird **nur als Dateiinhalt geschrieben, nicht ausgeführt**.
- **Ausnahme:** Der existierende `tests`-Befehl führt die zuvor gepinnte
  Yousty-Testversion mit eingeschränktem Benutzer aus.
- **Schreibort:** Nur das eigene Arbeitsverzeichnis unter
  `/home/careeragency_runner/careeragency-workspace`. Es werden keine
  Zugriffsrechte auf `/var/www`, `/etc` oder
  `/srv/careeragency-landing-feed` erteilt.
- **Produktive Daten:** Benutzerbewertungen, Dossiers, persönliche Dokumente,
  Datenbanken und Caddy-Secrets werden weder kopiert noch verändert.
- **Rollback:** GitHub-Workflow deaktivieren; auf dem Server den Wrapper
  `/usr/local/bin/careeragency-ops-command.before-write` zurückkopieren
  und `stage_commit.sh` entfernen. Alte Workspace-Daten erst nach
  Sichtung löschen.

## Verifikation

CI führt Shell- und Negative-Tests, YAML-Prüfung und einen Integrationstest
mit einem eigens erstellten unprivilegierten Linux-Konto aus. Der
Integrationstest checkt einen bestätigten Git-Commit real auf ein
persistentes Testverzeichnis aus und wiederholt den Vorgang idempotent.

Live auf Infomaniak ist die Operation erst nach der Installation und
erfolgreichem GitHub-Issue-Test nachgewiesen.
