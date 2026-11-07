# Career.Agency – vorhandene Lehrstellen auf der bestehenden Landing anzeigen

## Ergebnis und begründete Entscheidung

Der Server-Feed enthält aktuell 185 validierte Yousty-ZH-Lehrstellen mit Beginn
2027; GitHub Actions hat den Stand über `CA-OPS: feed-audit` bestätigt.
`CA-OPS: release-check` hat zudem festgestellt, dass die produktive
`index.html` **nicht bytegleich mit** `main:dashboard/index.html` ist.

Deshalb wird der laufende HTML-Code **nur an eindeutig identifizierbaren
Stellen gepatcht**, nicht durch eine historische, möglicherweise veraltete
GitHub-Datei ersetzt. Der bereits genehmigte Onest-/Urban-Mono-/Magenta-Stil,
Layouts, Dossiers, Radar und Benutzerbewertungen bleiben unverändert.

Die vorhandene `/jobs.json`-Caddy-Route bleibt wie bisher durch HTTP
Basic Auth geschützt. Für die **öffentliche Startseite** wird eine zweite,
strikt auf Lehrstellen-Metadaten reduzierte JSON-Datei bereitgestellt:

```text
https://careeragency.ch/lehrstellen.json
```

Inhalt: Titel, Betrieb, Ort, Lehrbeginn, EFZ/EBA und Link zum Original;
keine vollständigen Inserattexte, privaten Dossiers oder Bewertungen.

## 1. Einmalig root-eigene Veröffentlichung einrichten

Nach Review und Merge des Pull Requests:

```bash
cd /tmp/careeragency-server-ops-bootstrap
git pull --ff-only origin main
sudo bash ops/server/enable-landing-publish.sh
```

Erwartet:
```text
publish_setup_python_syntax=valid
publish_setup=installed
next_operation=CA-OPS: publish-lehrstellen
production_files_changed=false
caddy_modified=false
existing_ui_modified=false
```

Das Setup installiert nur einen root-eigenen, argumentlosen Publisher
und eine sudoers-Ausnahme genau für diesen Befehl. Es verändert weder
Website, Caddy noch DB. Die bestehenden GitHub Secrets bleiben gültig.

## 2. ChatGPT veröffentlicht die Lehrstellen selbst

Die mit GitHub verbundene KI erstellt ein Issue mit genau diesem Titel:

```text
CA-OPS: publish-lehrstellen
```

Nur das registrierte Eigentümerkonto mit GitHub-ID 343900642 kann den
Workflow auslösen. Der eingeschränkte SSH-Benutzer ruft über die einzige
freigegebene sudoers-Regel den argumentlosen, root-eigenen Publisher auf.

Der Publisher:
1. Verifiziert die vorhandene Yousty-Metadatenquelle und stoppt bei
   fremden Quellen, ungültigen IDs/URLs, Duplikaten oder weniger als
   50 Datensätzen.
2. Schreibt eine neu aus Metadaten zusammengesetzte `lehrstellen.json`
   atomar ins vorhandene öffentliche Webroot.
3. Prüft HTTPS 200 und korrekte Datensatzanzahl an der öffentlichen URL.
   Bei Fehler wird der alte Feed wiederhergestellt.
4. Sichert die laufende `index.html` nach
   `/var/backups/careeragency-apprenticeships/index.<UTC>.html`.
5. Patches **nur** den Datenabruf und die alte persönliche Filterung
   der bestehenden Startseite. Der Rest der HTML-Datei bleibt erhalten.
   Ein unerwarteter Codezustand führt zum Abbruch (kein Blind-Overwrite).

Bei Erfolg meldet der Workflow:
```text
landing_publish=success
public_feed_records=185
public_feed_http=200
landing_logic_changed=true
unchanged_ui_structure=true
protected_jobs_json_untouched=true
```

Die genaue Zahl ergibt sich aus dem aktuellen Feed und wird nicht
fest angenommen. Alle Logs sind auf dem **öffentlichen** GitHub lesbar;
daher druckt der Publisher keine persönlichen Daten und keine
vollständigen Inserattexte.

## 3. Abnahme und Grenzen

- `https://careeragency.ch/lehrstellen.json` muss ohne Login HTTP 200
  und das aktuelle Datensatzarray liefern.
- Auf `https://careeragency.ch/#startseite` müssen die Lehrstellen in
  den vorhandenen Karten sichtbar sein; mobil weiterhin 5 Karten/Seite.
- Filter-KI darf **nicht** die Startseiten-Lehrstellen ausblenden oder
  nach dem Erwachsenenprofil priorisieren.
- Die persönliche Filter-KI im Radar bleibt unverändert.
- Fehlt der Feed, wird ein Fehler angezeigt; keine stillschweigende
  Rückkehr zu Erwachsenen-Demo-Inseraten.
- Es werden **keine** DB-Änderungen, Caddy-Rewrites oder Datenmigrationen
  ausgeführt. Die auf dem Server vorhandene Lehrstellenquelle wird
  lediglich metadatenreduziert veröffentlicht.
- Bei aktiven alten, lokal gespeicherten Workspaces überlagert der
  verifizierte Feed die angezeigten Inserate. Gespeicherte Bewertungen
  werden nicht bewusst gelöscht; das bestehende Workspace-Speicherdesign
  ist für Mehrbenutzerbetrieb **noch nicht fertig migriert**.
- Die gegenwärtige Zuordnung von Inserat-URLs basiert auf dem bisherigen
  Yousty-Pilot und bestätigt nicht, dass jede Lehrstelle noch offen ist.
- **Kritischer Prüfhinweis:** Nutzungsbedingungen bzw. Nutzungsrechte
  zur öffentlichen Weiterveröffentlichung von Yousty-Metadaten sind
  noch nicht abschliessend geklärt. Bei Untersagung muss der öffentliche
  Feed abgeschaltet werden. Kein Volltext-Rehosting.

## 4. Rückbau

Das alte HTML ist nach jeder Veröffentlichung im root-eigenen
Backup-Verzeichnis verfügbar. Bei unerwarteten Abweichungen stoppen,
nicht den vorhandenen Webroot mit einem alten GitHub-Snapshot
überschreiben. Den freigegebenen Stand gezielt wiederherstellen und
`lehrstellen.json` danach bei Bedarf zurückziehen.

**Offen (für die Folgeentwicklung):** GitHub-`main` enthält noch die
ältere Landing-Implementierung. Solange die produktive HTML-Version von
`main` abweicht, kann ein späterer automatischer SFTP-Deploy die
gezielte Serverkorrektur zurücksetzen. Vor dem nächsten Dashboard-Deploy
sind Live-Version und Repository zwingend zu vergleichen und eine
minimale, geprüfte Synchronisierung zu beschliessen.
