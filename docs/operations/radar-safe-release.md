# Reversibles Radar-Deployment auf careeragency.ch

## Betriebsentscheid

Der verbundene SSH-Zugang (`careeragency_runner`) ist bereits funktionsfähig,
aber absichtlich auf konkrete Befehle beschränkt. **Nicht** mit
`INFOMANIAK_SFTP_*`-Secrets ersetzen oder per allgemeinem
`mirror --reverse` veröffentlichen: Die reale
`/var/www/careeragency/current/index.html` hat serverseitige
Lehrstellen-Patches, die nicht vollständig in `dashboard/index.html` liegen.

Neuer Releaseumfang: **nur** `index.html` (minimale HTML-Teiländerung),
`radar.js` und `radar-model.js`. Keine Caddy-, DNS-, HTTPS-,
Authentifizierungs-, Datenbank-, Dossier-, Feed- oder sonstigen Asset-Änderungen.

Der neue Code in `ops/production/radar-safe-release.py` ist ein
root-eigener, über die zentrale SSH-Allowlist freigegebener
Release-Mechanismus. Er verweigert die Veröffentlichung, falls:

- das Server-HTML nicht mehr das bereits produktiv geschaltete
  `fetch("./lehrstellen.json",{cache:"no-store"})` enthält,
- die Umschaltung unerwartet verändert wurde,
- eine andere/neue Vorversion von `radar.js` oder `radar-model.js`
  nicht einer bereits auf `main` veröffentlichten Revision entspricht,
- das anzuwendende Commit nicht exakt dem aktuellen `origin/main` entspricht,
- die betroffenen Live-Dateien Symlinks oder unzulässig sind.

Im Erfolgsfall sichert er die drei Dateien vor dem Austausch unter
`/var/backups/careeragency-ops/radar-releases/RELEASE-ID`, ersetzt
nur diese atomar und prüft alle Inhalte nach dem Austausch.
Ein Fehler führt zur Wiederherstellung der drei Ausgangsdateien.
Andere Dateien werden niemals kopiert oder gelöscht.

## Einmalige Administratorinstallation

Dieser einmalige Vorgang **kann nicht** mit dem schon bestehenden
eingeschränkten ChatGPT-SSH-Befehl ausgeführt werden. Es wäre ein
Sicherheitsbruch, den read-only `production-plan`-Befehl dafür
umzufunktionieren. Der Repository-Inhaber installiert den geprüften
neuen Gateway einmal mit Root-Berechtigung:

1. Den freigegebenen, getesteten `main`-Commit per
   `CA-OPS: stage <VOLLER-SHA>` im vorhandenen eingeschränkten
   SSH-Workflow bereitstellen.
2. Als Serveradministrator den **exakten zuvor gestagten Commit**
   verwenden und einmal ausführen:

   ```bash
   sudo bash /home/careeragency_runner/careeragency-workspace/releases/<VOLLER-SHA>/ops/production/install-radar-release.sh
   ```

3. Die Ausgabe `radar_gateway=installed` und
   `production_content_modified=false` prüfen.

Der Installer legt nur das root-eigene Releaseprogramm und die
präzise sudoers-Freigabe an und verwendet zur Aktualisierung des
SSH-Befehlsverteilers ausschliesslich
`ops/server/install-ops-dispatcher.sh`; dieser sichert die vorherige
Konfiguration und verweigert unbekannte lokale SSH-Erweiterungen.

## Veröffentlichung und Prüfung

Nach Installation darf der Besitzer via GitHub-Issue-Trigger oder
GitHub Actions `Career.Agency scoped Radar production release`
die Befehle ausführen:

- `CA-RADAR: check <VOLLER-MAIN-SHA>` – prüft ausschliesslich, schreibt keine
  produktiven Dateien;
- `CA-RADAR: deploy <VOLLER-MAIN-SHA>` – schreibt nach erfolgreichem Check
  ausschliesslich die drei beschriebenen Dateien, mit Backup;
- `CA-RADAR: rollback <RELEASE-ID>` – stellt exakt die gesicherten Dateien
  wieder her.

Nur Issues des geprüften Inhabers und exakt formatierte Befehle werden
ausgeführt. Der Workflow verwendet bestehende Geheimnisse
`CA_OPS_*`, einen geprüften SSH-Hostschlüssel, verbietet interaktive
Passwortanmeldung und führt keine beliebigen Shell-Befehle aus.

Nach dem Deploy prüft der Workflow `https://careeragency.ch/` und
`https://careeragency.ch/radar.js` direkt auf:
keine Erwachsenen-/Lehrstellen-Umschaltung, erhaltenen Yousty-Feed,
aktiven Lehrstellenmodus und die korrekte Radar-Quelle. Das reale
Marker/KPI-Verhältnis wird zusätzlich durch
`tests/radar-designs.test.cjs` und `tests/radar.test.cjs` geprüft.

### Kritische Abgrenzung

Die Veröffentlichung ist **erst dann verifiziert**, wenn der neue
Gateway auf dem Server installiert, der genaue Live-Check bestanden,
der Deploy erfolgreich und der öffentliche Smoke-Test erfolgreich sind.
Ein erfolgreicher PR/CI-Test ist für sich genommen kein Live-Deployment.
