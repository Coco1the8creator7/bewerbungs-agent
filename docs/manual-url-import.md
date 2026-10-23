# Manueller Stellen-URL-Import

## Audit (20.10.2026)
Basis: main 8c77d89. PRs #16/#17 sind integriert; #15 (Enrichment) ist ein offener Entwurf.
Der JSON-LD-Parser aus #15 wird hier übernommen und für beide Eingänge erweitert.
#15 nicht anschliessend unverändert mergen: Überschneidungen in Importer/Schema abstimmen.

Dashboard-Bewertungen befinden sich in Maps im Browser, optional in IndexedDB
(bewerbungs-agent-local-v1, snapshots/current) und privaten Exportdateien.
Keine automatische Rückübertragung nach GitHub. Speicher-Opt-in und private Sicherung
bleiben notwendig. Browserwechsel oder Löschen der Browserdaten kann lokale Daten verlieren.
IDs und öffentliche Original-URLs bleiben bei eindeutigen Dubletten erhalten.
Der Import verändert weder Dashboard-Speicher noch Exporte.

## Beschlüsse
- Gmail und URLs sind Eingangsadapter für normalize.make_job und pipeline.process.
- Bestehende Daten gewinnen; nur fehlende öffentliche Metadaten werden ergänzt.
  Unbekannte/manuelle Felder bleiben erhalten. Vor öffentlicher Ausgabe erzwingt
  eine Schema-/Provenienzprüfung einen Abbruch bei privaten Zusatzfeldern.
- Eindeutige Identität: ID, Quelle+Quell-ID oder normalisierte URL/validierte Weiterleitung.
- Ähnliche Titel/Arbeitgeber oder mehrere Identitätstreffer: needs_review, kein neuer Datensatz.
  Prüfung anhand request index und candidate_ids; kein automatisches Zusammenführen.
- Kein zusätzlicher Server, API-Schlüssel oder Dashboard-Token.
- Chat-Schnittstelle: einzelne öffentliche JSON-Aufträge als Commit.
  Workflow-Dispatch zusätzlich möglich; aktuelle Chat-GitHub-Werkzeuge unterstützen
  Datei-Commits, aber keinen neuen Workflow-Dispatch.
- Keine generische HTML-Heuristik: genau ein JobPosting mit Titel und brauchbarer
  Beschreibung erforderlich. JS-only, gesperrte, abgelaufene oder uneindeutige
  Seiten ergeben einen sichtbaren Fehler und keinen erfundenen Datensatz.

## Verwendung nach Merge
Im Chat: „Importiere folgende Stellen: …URLs…“.
Der ausführende Assistent:
1. Entfernt bekannte Trackingparameter und prüft, dass es öffentliche Stellenlinks sind.
   Keine Login-, Bewerbungsformular-, personalisierten Token- oder privaten URLs committen.
2. Liest zuerst docs/manual-url-import.md und importer/pipeline.py.
3. Erstellt auf main importer/url-requests/<eindeutige-auftrags-id>.json
   mit ausschliesslich {"urls": ["https://…", "https://…"]}, maximal 20 URLs.
   Keine Notizen, Bewertungen, Gmail-Metadaten oder persönlichen Angaben.
4. Wartet auf „Import Stellen-URLs“ und liest anschliessend den gespeicherten
   importer/url-results/<eindeutige-auftrags-id>.json sowie dashboard/jobs.json von main.
5. Bestätigt „importiert“ nur für added mit nachgewiesenem Feed-Datensatz.
   existing bedeutet bereits vorhanden, needs_review bedeutet noch nicht aufgenommen,
   fetch_or_parse_failed/invalid_url bedeutet fehlgeschlagen.
   Ein erfolgreich gespeicherter Auftrag allein ist KEIN erfolgreicher Stellenimport.
6. Prüft den Pages-Deploy separat, bevor er „im Dashboard verfügbar“ bestätigt.

Alternativ: GitHub → Actions → Import Stellen-URLs → Run workflow → URLs.
Leere Eingabe verarbeitet offene Aufträge. Täglicher Lauf holt ausstehende Aufträge nach.
Bei fehlerhaftem git push: fehlgeschlagenen Lauf wiederholen; keine Force-Pushes.
Auftrag und Ergebnis sind öffentlich. Ausschliesslich öffentliche Stellen-URLs verwenden.

## Manuelle Dublettenprüfung
Der Ergebnisindex verweist auf die entsprechende URL im Auftrag.
Bei needs_review Originalanzeige und candidate_ids vergleichen. Eine bewusste
Auflösung wird separat als überprüfbare Änderung vorgenommen; es gibt absichtlich
keinen unsicheren „force merge“-Schalter. Fehlgeschlagene Aufträge nach Behebung
mit einer neuen Auftrags-ID erneut einstellen.

## Grenzen
Keine Garantie für alle Websites. JSON-LD ist die Minimalversion; weitere Adapter
können später denselben Normalisierer verwenden. Ähnliche Titel werden bewusst
konservativ zurückgehalten. publicjobs-Trackinglinks werden begrenzt aufgelöst.
Die neuen Tests prüfen auch Erhalt beliebiger künftiger Feedbackfelder.
Live-Prüfungen laufen ohne Feed-Commit auf dem PR; Produktivdaten ändern sich erst
durch den freigegebenen Import nach Merge.

Pro Lauf wird höchstens ein Auftrag verarbeitet, damit Netzwerkfehler die Laufzeit begrenzen.
Weitere Aufträge bleiben für den nächsten Push/manuellen oder täglichen Lauf offen.
Die frühere automatische Löschung vermeintlicher Footer-Datensätze wurde entfernt;
Bestandsbereinigung ist eine getrennte, ausdrücklich zu prüfende Migration.

## Verifikation
34 Offline-Tests und Live-Prüfung einer neuen jobs.ch-URL (fa2f1cae-3721-418f-8fd8-49a24629be31)
sowie der bestehenden ETH-URL (5f663686-f185-481e-89b7-3a3453ce6ed7) erfolgreich.
Neuimport, Bestandserhalt, wiederholter Import, Beschreibung und Scoring wurden im
Runner geprüft; kein Produktivfeed geschrieben. Der Live-Workflow läuft auf diesem
Feature-PR und später bei Bedarf manuell. Echte Stellen laufen ab; bei Wiederholung
die neue Test-URL gegebenenfalls ersetzen. Queue/Produktiv-Deploy erst nach Merge nutzbar.

## Inseratetexte im Pop-up (Erweiterung 22.10.2026)
- Dashboard-Pop-up liest `description` aus `dashboard/jobs.json`; der verlinkte Titel öffnet das Original.
- Manueller URL-Import speichert JobPosting-Beschreibungen unmittelbar. Gmail-Import probiert pro Lauf bis zu 10 eingehende URLs.
- Zusätzlich bearbeitet Gmail bis zu 8 Bestandsinserate ohne `description`, rotiert nach Job-ID
  und speichert seinen Fortschritt in `importer/import-state.json` als `description_backfill_cursor`.
  Unzugängliche Inserate bleiben unverändert und kommen in einer späteren Runde wieder.
- Eine Beschreibung wird nur übernommen, wenn sie zur Stelle gehört. Kein erfundener Text,
  keine Übernahme von Cookie-Bannern oder fremden Stellenanzeigen. Ohne geeignete JSON-LD-Daten
  wird im Pop-up weiterhin ein Hinweis angezeigt.
- Nach jeder erfolgreichen Anreicherung werden die unverbindlichen Relevanzvorschläge neu
  berechnet, ohne manuelle Bewertungen anzutasten. Weder ID noch URL noch bestehender Text
  werden ersetzt. Der Backfill benötigt einen funktionierenden Gmail-Importlauf.
- Die Abdeckung muss am echten Produktivbestand und in den Actions-Logs geprüft werden;
  100 % lassen sich bei gelöschten, gesperrten oder JavaScript-only Inseraten nicht garantieren.
