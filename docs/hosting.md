# Browser-Hosting – Bewerbungs-Agent (Cloudflare Pages)

## Ziel

Eine feste HTTPS-Adresse für die **statische** Benutzeroberfläche, ohne lokale Installation auf Schul-/Arbeitgeber-Geräten. Der Quellcode bleibt im **privaten** GitHub-Repository `Coco1the8creator7/bewerbungs-agent`. Das Dashboard selbst wird öffentlich erreichbar, bis optional eine Zugriffskontrolle eingerichtet wird.

Das Hosting stellt **keine** private Datenbank, kein Gmail-OAuth und keinen automatischen E-Mail-Import bereit. Das Dashboard liest nutzerseitig ausgewählte lokale JSON-Dateien und verarbeitet sie im Browser. Die eingebauten Demo-Stellen sind fiktiv.

## Einmaliges Einrichten im Browser

1. Öffne https://dash.cloudflare.com/ und melde dich an (ggf. kostenloses Cloudflare-Konto erstellen).
2. Navigiere zu **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Verbinde GitHub. Autorisiere **nur** das Repository `Coco1the8creator7/bewerbungs-agent` statt aller privaten Repositories.
4. Wähle dieses Repository als Quelle, Produktionszweig **main**.
5. Wähle **kein Framework** und konfiguriere:
   - **Build command:** leer lassen
   - **Build output directory:** `dashboard`
   - **Root directory (advanced):** nicht ändern (Repository-Wurzel)
6. Klicke **Save and Deploy**.
7. Cloudflare zeigt nach erfolgreicher Veröffentlichung eine eigene URL der Form `https://<gewaehlter-projektname>.pages.dev/` an. Diese URL wird erst nach dem tatsächlichen Deployment bestätigt.

Cloudflare erstellt bei neuen Commits auf `main` automatisch neue Versionen. Nur der Inhalt von `dashboard/` wird als Webverzeichnis veröffentlicht, nicht `docs/`, `data/`, `config/` oder `schemas/`.

## Datenschutz und Grenzen

- **Eine lange oder unbekannte URL ist kein Passwort.** Die Seite ist standardmässig im Internet erreichbar. `robots.txt` bittet Suchmaschinen, sie nicht zu indizieren, schützt aber nicht vor Aufrufen.
- **Niemals** Lebensläufe, persönliche Dokumente, E-Mails, Inserat-Datenbanken, API-Schlüssel oder OAuth-Tokens in `dashboard/` committen.
- Das Dashboard nutzt keine automatische Browser-Persistenz: Entscheidungen/Notizen gehen beim Neuladen verloren, falls sie nicht separat als Datei exportiert werden. Auf fremden Geräten keine privaten Bewerbungsnotizen erfassen.
- Für die spätere produktive Nutzung mit personenbezogenen Daten: Login/Zugriffsschutz (z. B. Cloudflare Access), ein authentifiziertes Backend und eine private Datenhaltung planen. Static Pages alleine sind dafür nicht ausreichend.
- Auf Geräten des Arbeitgebers gelten unabhängig davon dessen Nutzungs- und Sicherheitsrichtlinien.

## Warum nicht direkt dieselbe GitHub-Pages-Konfiguration wie beim Eventkalender?

`was-ist-der-plan` ist **öffentlich** und hat eine `deploy-pages.yml` für GitHub Pages. Das Bewerbungs-Repository ist bewusst **privat**. GitHub Pages unterstützt private Repositories nur auf berechtigten kostenpflichtigen GitHub-Plänen. Zudem ist eine daraus veröffentlichte GitHub-Pages-Site trotzdem öffentlich. Cloudflare Pages unterstützt die Git-Integration auch mit privaten Repositories, ohne diese öffentlich zu machen.

Anleitung: https://developers.cloudflare.com/pages/get-started/git-integration/
