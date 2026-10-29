> **Historische Dokumentation (Stand 28.10.2026):** Die hier beschriebene öffentliche Dossier-Synchronisation wurde am 29.10.2026 aus dem Dashboard entfernt und deaktiviert. Die Ablage in GitHub wird nicht automatisch aufgeräumt und bereits veröffentlichte Dateien bleiben gegebenenfalls öffentlich zugänglich. Der Inhalt unten ist nur als Entscheidungsverlauf archiviert.

# Career.Agency – provisorische öffentliche Dossier-Ablage (28.10.2026)

## Entscheidung und Geltungsbereich

Auf ausdrücklichen Wunsch des Projektinhabers werden **Dokumente derzeit unverschlüsselt** im bereits öffentlichen Repository gespeichert. Dies ist ein bewusst befristeter **Einzelbenutzer-Prototyp**, keine für Jugendliche oder andere SaaS-Benutzer geeignete Lösung. Die bestehende lokale IndexedDB bleibt bestehen. Eine verschlüsselte/private Ablage wird erst später umgesetzt.

## Technischer Ablauf

- Die Dossiers-Seite speichert neue Uploads und Vorbereitungseinträge zunächst **nur lokal**.
- «Auf GitHub sichern» zeigt vor jedem Upload einen ausdrücklichen Hinweis mit Anzahl Dateien/Dossiers. Erst nach Bestätigung werden **alle aktuell lokalen** Einträge öffentlich hochgeladen.
- Ein GitHub Fine-grained Personal Access Token mit *Contents: Read and write* für **dieses eine Repository** ist nötig. Die Dossier-Funktion persistiert das Token **nicht**. Falls im alten Feedback-Sync bereits ein Token gespeichert ist, kann dieses verwendet werden; dessen bestehende Sicherheitsproblematik bleibt bestehen.
- Die GitHub Contents API schreibt Dateien nach `public-dossiers/v1/files/<file-id>.<ext>` und Metadaten nach `public-dossiers/v1/manifest.json` auf `main`. Dateien sind bewusst **nicht** Teil des veröffentlichten Dashboard-Ordners, aber über die öffentliche GitHub-Repository-API und Git-Historie lesbar.
- «Von GitHub laden» benötigt kein Token, prüft Dateigrösse und SHA-256, ergänzt fehlende Dateien und Dossiers in der lokalen IndexedDB und überschreibt vorhandene lokale Einträge nicht.
- Der Remote-Upload ist auf **5 MiB pro Datei** begrenzt (lokal weiterhin 15 MiB). GitHub synchronisiert **nicht automatisch** und ist kein Backup von gelöschten oder geänderten lokalen Einträgen.
- Dossier-Einträge, Dateien und Metadaten behalten stabile IDs, damit ein späterer Wechsel auf ein privates Backend möglich bleibt.

## Grenzen und Datenschutzrisiken

**Jede Person** kann alle veröffentlichten Unterlagen und Metadaten herunterladen. Auch ein späteres Entfernen aus dem Arbeitsverzeichnis entfernt sie nicht verlässlich aus Git-Verlauf, Forks, Caches oder bereits erstellten Kopien. Ein Browser-Löschvorgang löscht nur die lokale Kopie. Ein späteres privates Backend muss echte Benutzer-Isolation, Authentifizierung, Löschung und Datenmigration umsetzen.

**Nicht verwenden** für reale Minderjährige, fremde Bewerberprofile, Geheimnisse, Ausweise, Zugangsdaten oder andere sensible Dokumente. Kein automatische Veröffentlichung von Altbeständen. Vor SaaS-Veröffentlichung muss die Public-Dossier-Funktion **deaktiviert/ersetzt** und öffentliches Repository von persönlichen Inhalten getrennt werden. Bereits veröffentlichte Testdokumente gegebenenfalls aus dem Repository und der Git-Historie bereinigen; externe Kopien bleiben unkontrollierbar.

## Prüfschritte

1. Dossier lokal anlegen und kleines, ausdrücklich zur Veröffentlichung freigegebenes Test-PDF hochladen.
2. GitHub-Sicherung mit Fine-grained PAT und Bestätigung auslösen.
3. Manifest und Dateipfad auf `main` prüfen.
4. In einem zweiten Browser «Von GitHub laden» ausführen und Datei öffnen.
5. Wiederholen und prüfen, dass Dubletten vermieden und bestehende Dateien nicht überschrieben werden.
6. Vor einem Produktiveinsatz öffentliche Berechtigungen und die Migration auf privaten Speicher neu entscheiden.
