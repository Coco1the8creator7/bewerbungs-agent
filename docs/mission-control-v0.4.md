# Mission Control – Gamification-Entwurf v0.4 (20.10.2026)

## Ziel
Das bestehende Dashboard bleibt die zentrale, ernsthaft nutzbare Bewerbungsoberfläche. Darauf liegt eine zurückhaltende **Pixel-Space-Optik**: dunkler Hintergrund, dezente Sternpunkte, Statuskarten, kontrastreiche Typografie, kleine animierte Route und ein Wochen-Questboard. Keine fremden Grafiken, Tracking-Skripte oder externen Fonts.

## Umsetzung im Entwurfsbranch
- Hauptblöcke **Statusübersicht → Mission Control → Bewerbungsprozess → neue Inserate**; technische Funktionen bleiben im Footer.
- Karriere-Route mit **Radar → Prüfen → Bewerben → Gespräche → Angebot**. Das Raumschiff zeigt den *höchsten aktuellen, manuell vergebenen Bewerbungsstatus*, nicht ein statistisches Erfolgsversprechen. Archivierte Absagen gelten nicht als Rückschritt.
- Drei datengestützte Wochenquests (Montag bis Sonntag, Geräte-Zeitzone):
  1. **3 Inserate beurteilen**: pro unterschiedlicher Stelle ein Wechsel vom persönlichen Status «Neu» zu einem anderen Status innerhalb der Woche.
  2. **1 Bewerbung als versendet erfassen**: Wechsel in den Status «Beworben» innerhalb der Woche.
  3. **5 Stellen nachfassen**: pro unterschiedlicher Stelle ein explizit dokumentiertes Follow-up innerhalb der Woche. Der Knopf ist nur für «Beworben» und «Vorstellungsgespräch» sichtbar; derselbe Knopf macht einen Eintrag dieser Woche rückgängig.
- **Keine Fit-Scores**: Score-Karten, Sortierung und Dialogfeld sind ausgeblendet. Das Matching-Schema bleibt für eine spätere Projektphase bestehen.
- CSS-Animationen pausieren bei `prefers-reduced-motion: reduce`; Progressbars tragen ARIA-Werte; bewegte Elemente sind rein dekorativ.

## Daten und Datenschutz
`activity_log` speichert `{id, job_id, type, at}` mit den Typen `screened`, `applied` und `follow_up`. Alle Ereignisse sind **persönliche Daten**, nicht Bestandteil von `jobs.json`.

Das Protokoll wird in lokale, freiwillig aktivierte IndexedDB-Speicherung sowie in die private Gesamtsicherung und Statusdatei aufgenommen. Frühere Sicherungen ohne das neue optionale Feld bleiben lesbar; die bestehende Schema-Version 0.3.0 der Gesamtsicherung und 0.2.0 der Statusdatei bleibt aus Kompatibilitätsgründen gleich. Live-Feed-Updates mit stabilen Inserat-IDs lassen Status, Notizen und das Protokoll unangetastet.

**Wichtig:** Im öffentlichen GitHub-Repository und im von GitHub Pages ausgelieferten Dashboard liegen keine persönlichen Status- oder Quest-Ereignisse. Ohne aktivierte Gerätespeicherung sind die Daten nach einem Reload nur über einen vorherigen privaten Export rekonstruierbar. Es findet keine automatische Erkennung versendeter E-Mails statt.

## Prüfplan
- JS-Parser- und Status-Unit-Tests, inklusive Wochenquests, Follow-up-Rücknahme, ungültigem Aktivitätsprotokoll und Sicherungsformat.
- Bestehende Python-Vertragstests, Schemavalidierung und IndexedDB-Adaptertest.
- Vor Merge: Desktop-/Mobile-Browsertest, Tastaturbedienung, `prefers-reduced-motion`, Leerzustand und Wiederherstellung einer bestehenden Gesamtsicherung.
- Die veröffentlichten GitHub-Pages-Inhalte ändern sich durch diesen Branch **nicht**. Veröffentlichung erfolgt erst nach Review und Merge in `main`.

## Spätere Ideen (noch nicht umgesetzt)
- Individuell konfigurierbare Quests und realistische Wiedervorlagen.
- Ereignishistorie pro Bewerbung und optionaler Kalenderbezug.
- Auswahl zwischen Space-, Pixel-Abenteuer- und Minimal-Thema.
- Avatar-Kosmetik nur als rein dekorative Option ohne algorithmisches Ranking.
