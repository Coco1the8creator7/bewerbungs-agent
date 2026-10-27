# Radar / Meine Stärken — Interessen-Explorer (Prototyp v0.3)

## Ziel und UX
Eigenständiger, an der **Interessen-Sortierung** von berufsberatung.ch orientierter
Interessen-Explorer. Keine Übernahme fremder Fotos, Illustrationen, Layouts oder
Berufsdaten. 37 Interessenthemen des SDBB-Berufe-Explorers, eigenständig formuliert,
für die Schweizer Lehrstellen-Vorschau,
16 für den bestehenden Berufsstellen-Testbereich. Zu jedem der 37
Interessenthemen ist ein originales SVG-Piktogramm im Career.Agency-Stil
implementiert (`dashboard/radar-interest-pictograms.js`), auch in den mobilen
Karten und in den bereits eingeordneten Interessen. Keine externen Bild- oder
Icon-Abhängigkeiten. Inhaltliche Referenz:
https://www.berufsberatung.ch/de/berufe-explorer (Stand 27.10.2026).
Desktop: Drag-and-drop oder Buttons.
Smartphone/Tastatur: drei sichtbare Buttons (Gefällt mir / Später / Eher nicht).
Einschätzungen sind änderbar; «Später» speichert kein Urteil.

## Technisches Verhalten
- Bestehende Gmail-Abos und URL-Importe laufen unverändert weiter.
- Bestehende Job-IDs, CRM-Notizen, Bewertungen und Importfilter bleiben unangetastet.
- UI liegt in `dashboard/radar-explorer-ui.js`; reine, testbare Aktivitäten und
  Beispiel-Berufsfelder in `dashboard/radar-explorer-model.js`.
- Vorhandene Bewertungen aus dem bisherigen 32-Interessen-Prototyp werden
  über eindeutige Aliase (z. B. `repair` → `technical`) in den 37er Katalog
  migriert. Explizite neue Antworten haben Vorrang.
- Interessen werden unter `profile.explorer.choices` / `profile.explorer.favorites`
  im bisherigen lokalen Radar-Profil gespeichert; separat nach `career` und
  `apprentice`. Migration historischer Profile über `normalizedProfile`.
- Nur bei aktivierter Gerätespeicherung im lokalen IndexedDB persistiert.
  Kein Upload, keine automatischen Rückwirkungen auf Matching oder öffentliche GitHub-Dateien.
- Beim JSON-Profil-Export sind die Interessen enthalten; Daten vor einem späteren
  Einsatz in Dossiers immer von der bewerbenden Person bestätigen lassen.

## Umfang und Rechte
- Übernommen wurde nur die **thematische Interessentaxonomie** (37 allgemein
  beschreibbare Tätigkeitsbereiche), nicht der SDBB-Algorithmus, die Fotos,
  Originalgrafiken oder die Formulierungen der Fragekarten.
- SVG-Piktogramme sind unabhängig erstellt, mit eigenen Vektorpfaden und
  einheitlichen erdigen Farbwerten. Keine bild- oder markenrechtliche
  Zugehörigkeit zum SDBB behauptet.
- Die nicht offiziell validierten Berufsvorschläge der Plattform bleiben
  ausdrücklich eigenständig.

## Prototyp-Matching
Ab drei positiv gewerteten Tätigkeiten werden aus einer kleinen, *redaktionell
zusammengestellten* Liste beispielhafte Berufsideen angezeigt. Jede Berufsidee
besitzt thematische Tags. Überlappungen positiver Aktivitäten erhöhen die
Sortierung; überlappende negative Aktivitäten reduzieren sie. Nicht bewertete
Aktivitäten haben keinen Einfluss. Resultate sind ausdrücklich **keine**
Wahrscheinlichkeit, Eignungsprüfung, Aufnahmeempfehlung oder Berufsberatung.

## Vor produktiver Verwendung
1. Berufs- und Tätigkeitsdaten mit lizenziertem oder offiziell freigegebenem
   Schweizer Berufsdatensatz verifizieren und aktualisieren.
2. Zuordnung durch Berufsberatungs-Fachpersonen und Jugendliche evaluieren;
   Kontraindikationen und Verzerrungen prüfen.
3. Datenschutz-/Jugendschutz-Konzept und mandantenfähiges Backend abschliessen.
4. Erst nach fachlicher Validierung Interessen und Stellen-/Dossier-Matching
   miteinander verbinden. Bis dahin sind Ergebnisse reine Anregungen.

## Verworfen
- Direkte Übernahme von Fotos oder vollständigem Inhalt der Referenzseite:
  Urheber- und Lizenzklärung fehlt.
- «Fit-Prozent» für Berufseignung: die Datenbasis rechtfertigt keine quantitative
  Aussage; offengelegte Treffergründe sind angemessener.
