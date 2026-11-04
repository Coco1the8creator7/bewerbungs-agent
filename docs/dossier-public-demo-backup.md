# Career.Agency Dossier-Studio: öffentliches Demo-Backup

**Stand:** 04.11.2026 · **Freigegebener Projektrahmen:** Nur fiktive Testdossiers; reale Bewerberdaten werden später benutzerbezogen über ein privates Hosting-/Backend-System gesichert.

## Ziel und verbindliche Entscheidung

Für die Entwicklungs- und Demonstrationsphase werden Demo-Dossiers im bereits öffentlichen Repository `Coco1the8creator7/bewerbungs-agent` unter dem Pfad `demo-dossiers/v1/<Dossier-ID>/` gespeichert. Der vorherige Vorschlag eines separaten privaten GitHub-Repositories wurde auf Wunsch des Projektinhabers verworfen. **Dies ist keine Datenarchitektur für produktive Bewerberprofile.**

## Gespeicherte Dateien

- `draft.json`: alle bearbeitbaren Angaben des generierten Dossier-Entwurfs einschliesslich Dokumenttexten, Design, Bausteinen und möglicherweise eingebetteten Fotos.
- `Dossier.zip`: drei einfach formatierte PDFs aus dem aktuellen PDF-Generator. Das ZIP entspricht nicht vollständig der layoutgetreuen A4-Druckvorschau.
- **Nicht enthalten:** extern hochgeladene Dokumente aus der Dossier-Bibliothek, neue Browserdateien und lokale persönliche Vorlagenslots.

Die Backups liegen **ausserhalb des GitHub-Pages-Dashboardordners**, sind über GitHub aber trotzdem öffentlich abrufbar.

## Bedienung

1. Ein generiertes Dossier im Dossier-Studio öffnen.
2. **Demo-GitHub** öffnen und ausdrücklich bestätigen, dass es ausschliesslich fiktive Daten enthält. **Keine echten Namen, Adressen, Telefonnummern, E-Mail-Adressen, Bewerbungsfotos oder Dokumente von Minderjährigen hochladen.**
3. Falls im Dashboard unter «Daten & Entwicklung» bereits ein GitHub-Token gespeichert wurde und dieses Schreibberechtigung für das Repository hat, wird es automatisch wiederverwendet. Sonst im Dialog ein entsprechend eingeschränktes Token für die Sitzung eingeben; dieses neue Token wird vom Dossier-Studio nicht persistent gespeichert.
4. **Demo-Sicherung aktivieren**. Bei vorhandenem Token und bereits erteilter Zustimmung wird beim nächsten Öffnen des Dossiers automatisch erneut verbunden.
5. Änderungen werden lokal gespeichert und bei aktiver Verbindung ungefähr alle **30 Sekunden**, sowie bei Rückkehr/Netzwiederverbindung, nach GitHub übertragen, soweit tatsächlich Änderungen vorliegen. **Jetzt sichern** startet einen manuellen Vorgang.
6. Bei widersprüchlichen Cloud- und Lokalständen stoppt das Hochladen. Entweder die GitHub-Version nach ausdrücklicher Bestätigung laden oder die lokale Demo-Version bewusst behalten. Frühere Versionen bleiben in der Git-Historie.
7. GitHub-Status kontrollieren. Fehlender Token, Offline-Zustand, Berechtigungsfehler oder Konflikte verhindern Cloud-Sicherung; lokale Entwürfe bleiben erhalten.

## Risiken und Grenzen

- Git-Historie, Forks, Suchmaschinen-Caches und Kopien Dritter können eine spätere vollständige Löschung öffentlich verfügbarer Daten unmöglich machen. Auch ein Demo-Foto sollte eine fiktive Darstellung sein.
- Das im Dashboard bereits lokal gespeicherte GitHub-Token wird durch diese Funktion **nicht** gelöscht, geändert oder zusätzlich gespeichert. Token-Zugriff im Browser bleibt eine Übergangslösung.
- Bei jeder Synchronisation entstehen Git-Commits (bei echtem Änderungsbedarf), wodurch die Historie bei häufiger Bearbeitung wachsen kann.
- Die automatische Synchronisation läuft nur, solange das Studio geöffnet und verbunden ist; in Hintergrund-Tabs können Browser-Timer verzögert oder ausgesetzt werden. Keine Garantie für kontinuierliche Backups im Hintergrund.
- Der Cloud-Adapter prüft den festen Repositorypfad, einen ausdrücklichen Demo-Zustimmungsparameter und die Revision des letzten Cloud-Stands. Die Zustimmung ist eine notwendige Freigabe, **keine automatische Erkennung personenbezogener Daten**.
- Das Verfahren ersetzt kein produktives Authentifizierungs-, Berechtigungs-, Versionierungs- oder Datenschutzkonzept.

## Offene Umsetzungsarbeiten

- Mehrgeräte-Wiederherstellung einschliesslich Auffinden von Dossier-IDs.
- Verifikation mit einem echten anonymen Testdossier auf GitHub, einschliesslich Unterbruch und Konfliktfall.
- Layoutgetreuer automatischer PDF-Export anstelle des bisherigen Basislayout-ZIP.
- Automatische Synchronisation extern hochgeladener Anhänge, sofern dies tatsächlich zum Produktkonzept gehört.
- Für die produktive SaaS-Version: private nutzerbezogene Speicherung bei einem Hostinganbieter, rollenbasierte Berechtigung, Authentifizierung, Löschung und Migration.

**Hinweis:** Die historische Anleitung [Private GitHub-Zwischenlösung](dossier-private-github-backup.md) ist nur noch als Entscheidungsverlauf archiviert.
