# Dossier-Studio – Layout und Textumbruch (Stand 04.11.2026)

## Beschluss und technische Zielsetzung

Alle bearbeitbaren Inhalte in **Lebenslauf** und **Motivationsschreiben** werden als frei positionierbare, an die bestehende Dokumentdatenquelle gebundene Rahmen dargestellt. Dazu gehören Name, Kontaktdaten, Titel, Anrede, alle vorhandenen Abschnittsbausteine, das Foto und zusätzliche freie Felder. Die Bewerbungs-E-Mail bleibt vorerst ein normaler Texteditor und keine A4-Seite.

Für Kollisionen gelten per Rahmen auswählbare Umbruchmodi:
- **Rechteck**: Text in einem weiter hinten liegenden Rahmen wird neben einer rechteckigen Ausschlussfläche in die grössere freie Seite umbrochen.
- **Nur oben / unten**: Text fliesst ober- und unterhalb des Hindernisses.
- **Vor dem Text**: Absichtliche Überlagerung, ohne Umbruch.
- **Hinter dem Text**: Dekoratives Element ohne Textverdrängung.

Die Positionen und Stapelreihenfolgen werden als prozentuale A4-Koordinaten in den bestehenden Dossier- und Vorlagendaten persistiert. Die geometrische Migration älterer Entwürfe wird beim ersten Rendern **aus deren vorhandener, vom Browser gemessener Layoutdarstellung** abgeleitet; historische Positionen sollen nicht rekonstruiert oder geraten werden. Änderungen am Vorschau-Zoom werden nicht in den Dokumentdaten gespeichert. Bei der Textänderung bleiben die fachlichen Datenfelder und Abschnittstexte die führenden Datenquellen.

### Technischer Ansatz

- `dashboard/dossier-studio-modules.js`: Datenmodell, sichere Normalisierung, Rechteckkollisionen und Umbruchberechnung.
- `dashboard/dossier-studio.html`: Quellelemente als `layoutBoxes`, ergänzende Felder als `freeBoxes`, DOM-Rendering, Drag/Resize, Stapelreihenfolge, speicherbare Einstellungen und Prüfung.
- Der tatsächliche Zeilenumbruch erfolgt durch **native CSS-Floats mit `shape-outside: polygon(...)`** in derselben Textformatierungsumgebung wie der Text. Der Polygon-Ausschnitt beginnt erst auf Höhe des kollidierenden Elements. Ein einfaches Float mit `margin-top` ist ungeeignet, weil es bereits frühere Zeilen verkürzt. Diese Unterscheidung wurde in Chromium isoliert geprüft.
- `tests/dossier-studio-wrap.test.cjs`: Regressionstests für Umbruchgeometrie, Moduswahl, Datenbindung und Feldmigration.

## Bewusste Grenzen – noch kein vollständiger Microsoft-Word-Editor

**Die neue Umsetzung bietet einen funktionierenden rechteckigen Textumbruch, ist aber kein Word-kompatibler Layoutmotor.**

Nicht vollständig umgesetzt oder auf allen Zielbrowsern nachgewiesen:
1. Exakter mehrseitiger Zeilen- und Seitenumbruch bei beliebig verschachtelten oder vielen kollidierenden Rahmen (inkl. Absatzregeln, Witwen/Waisen, Tabellen, Spalten).
2. Word-Modus «beidseitig um ein Objekt» mit getrennten Textkorridoren, konturgenauer Umbruch, Text- und Objektanker an Absätze.
3. Vollständige DOCX-Kompatibilität, Absatz-/Zeichenformate, Tastaturbefehle, Revisionen, Undo-/Redo-Historie und PDF-Ausgabe mit gleicher Layoutberechnung.
4. Browser-E2E-/Drucktests für Safari/iPad, Mobilgeräte im Querformat und problematische umfangreiche Lebensläufe.
5. Der bestehende ZIP/PDF-Generator enthält die Texte, berechnet aber weiterhin **nicht dieselbe Rahmenpositionierung**. Für die layoutgetreue Ausgabe das Studio-A4-Druckverfahren benutzen.

### Bevorzugter nächster Architekturentscheid

Wenn **«Niveau Word»** im Sinne exakter Seitenumbrüche, fortgeschrittener Umflussregeln und DOCX-/PDF-Parität eine verbindliche Produkteigenschaft ist, sollte vor weiterer Eigenentwicklung ein dedizierter Dokumentenmotor wie **ONLYOFFICE Docs** oder **Collabora Online** in einem kleinen technischen Spike bewertet werden. Beide benötigen eine dokumentierte Anbindung an die spätere private Benutzerablage; diese ist mit dem bisherigen öffentlichen GitHub-Pages-Prototyp nicht vollständig gegeben. Eine eigene Office-kompatible Layoutengine zu entwickeln wäre ein hoher langfristiger Kosten- und Wartungsfaktor.

**Keine Entscheidung zur Integration ist getroffen.** Zu klären: Hosting-Aufwand, Lizenz-/Einbettungsbedingungen, Benutzerrechte, Vorlagenmodell, Dateiversionierung, Kollaboration, Dateilöschung und ein Browser-/PDF-Vergleichstest.

## Pädagogik und Datenschutz

Bei Lehrstellensuchenden ist grenzenlose Layoutfreiheit nicht automatisch ein Vorteil. Für einen produktiven MVP sollen einfache, professionelle Vorlagen als Standard und die erweiterte Gestaltung als bewusst wählbarer Modus geprüft werden. Die Foto-Vorlage ist sichtbar, aber kein echtes Bewerbungsfoto muss verpflichtend hochgeladen werden.

Öffentliche GitHub-Demo-Sicherung weiterhin nur für fiktive Daten. Produktive Dossiers mit personenbezogenen Daten gehören in die später vorgesehene private, benutzergebundene Host-Ablage.
