> **Historischer Stand (nicht mehr aktiv):** Die unten dokumentierte private GitHub-Zwischenlösung wurde am 04.11.2026 auf ausdrücklichen Projektentscheid durch eine öffentliche **Demo-only**-Sicherung im bestehenden Repository ersetzt. Aktuelle Anleitung: [Öffentliches Demo-Backup](dossier-public-demo-backup.md). Für echte Bewerberdaten ist weiterhin ausschliesslich eine private, nutzerbezogene Backend-Speicherung vorgesehen.

# Dossier-Studio: private GitHub-Sicherung (Einzelbenutzer-Teststand, 04.11.2026)

## Geltungsbereich
Die Funktion ergänzt die lokale IndexedDB-Speicherung des Dossier Studios. Sie ist **kein produktionsreifer Mehrbenutzer-Speicher** und darf nicht für reale Lehrstellensuchende oder Minderjährige eingesetzt werden. Bestehendes öffentliches Repository `Coco1the8creator7/bewerbungs-agent` ist **nicht** als Backup-Ziel zulässig.

## Ersteinrichtung
1. Unter https://github.com/new ein **separates privates** Repository erstellen, zum Beispiel `<GitHub-Benutzer>/private-dossiers`. Keine GitHub-Pages-Veröffentlichung aktivieren.
2. Unter https://github.com/settings/personal-access-tokens ein zeitlich begrenztes **Fine-grained Token** für **nur dieses private Repository** ausstellen. Repository permission: **Contents – Read and write**. Keine zusätzlichen Rechte vergeben.
3. Auf der Career.Agency-Dossiersseite ein generiertes Dossier öffnen, im Studio oben auf **GitHub-Sicherung** klicken, Repository `Besitzer/Name` und Token eingeben, **Verbinden** wählen.
4. Der Studio-Status zeigt `Cloud ausstehend`, `Cloud gesichert`, `Cloud-Konflikt` oder `Cloud-Fehler`. Nur bei tatsächlichen Änderungen erfolgt ungefähr alle 30 Sekunden ein Schreibversuch, solange das Studio geöffnet und verbunden ist. **Jetzt sichern** löst einen manuellen Versuch aus.
5. Nach einem Neuladen oder neuen Browser-Tab muss das Token erneut eingegeben werden. Es wird bewusst **nicht** in localStorage oder IndexedDB abgelegt.

## Dateien im privaten Repository
- `dossier-studio/v1/<Dossier-ID>/draft.json` – editierbarer Lebenslauf, Motivationsschreiben, E-Mail und Design-/Textangaben (einschliesslich Foto, wenn eingefügt).
- `dossier-studio/v1/<Dossier-ID>/Dossier.zip` – drei PDFs des **vereinfachten** bisherigen PDF-Generators. Es handelt sich um ein zusätzliches Backup-Artefakt, nicht um den layoutgetreuen Druckexport.
- Dateien, die in der Dossier-Bibliothek separat hochgeladen wurden, sind **noch nicht** Teil des Cloud-Backups.

**Layoutgetreues PDF:** Im Studio auf **A4-PDF** oder **Entwurf prüfen** klicken, Angaben und Überlauf prüfen, Druckvorschau öffnen und im Browser **Als PDF speichern** wählen. Dieses A4-PDF wird **nicht automatisch** nach GitHub hochgeladen.

## Datensicherheit, Konflikte und Grenzen
- Vor der Verbindung und unmittelbar vor **jedem Cloud-Schreibvorgang** prüft die Anwendung, ob GitHub das Ziel ausdrücklich als **privat** ausweist. Öffentliche Ziele werden blockiert.
- Cloud-Zugriffe erfolgen direkt aus dem Browser mit einem **nur im Arbeitsspeicher** gehaltenen Token. Dies reduziert Persistenzrisiken, ersetzt aber **kein serverseitiges Zugriffsmanagement**: Bei manipuliertem Browser, unsicherer Umgebung oder XSS kann der Token in der aktiven Sitzung gefährdet sein.
- Bei abweichenden oder zwischenzeitlich veränderten Cloud-Ständen wird nicht automatisch überschrieben. Nach ausdrücklicher Entscheidung kann die Cloud-Version geladen oder die lokale Version unter Wahrung einer SHA-Versionsprüfung behalten werden. Vor Überschreiben immer eigene Sicherheitskopie erstellen.
- Beim Schreiben werden `Dossier.zip` und `draft.json` nacheinander hochgeladen. Ein Verbindungsabbruch dazwischen kann zu einem kurzzeitig unterschiedlichen Stand beider Dateien führen. `draft.json` bleibt die führende editierbare Version.
- Der Cloud-Abgleich arbeitet **nur bei geöffnetem Studio**; Browser-Timer können im Hintergrund verzögert sein. Keine Garantie für die Speicherung direkt vor App-Schluss, Stromausfall oder Offline-Phasen. Lokal speichern bleibt notwendig.
- Ein Git-Repository hält auch ältere Versionen in der Historie. Wiederholtes automatisches Speichern kann den Speicherbedarf vergrössern. Bei späteren Löschungsanforderungen die Git-Historie, Forks und Backups berücksichtigen.
- Für tatsächlichen SaaS-Betrieb: authentifiziertes privates Backend, Benutzertrennung, Datenminimierung, serverseitige Tokens, dokumentierter Export und Löschprozess, Versionshistorie und Wiederherstellung auf einem neuen Gerät.

## Noch offene Arbeiten
- Sichere Übernahme privater Dossiers auf einem vollständig neuen Gerät ohne lokale Datensatz-ID.
- Backup der separat hochgeladenen Anhänge.
- Layoutgetreuer automatischer PDF-Export ohne Browser-Druckdialog.
- Browser-E2E-Tests für Druck, längere Dokumente, Safari/iPad und unterbrochene Cloud-Schreibvorgänge.
