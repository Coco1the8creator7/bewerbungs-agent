# Career.Agency – Quellenprüfung für den ersten Live-Import (06.11.2026)

## Entscheidungsvorschlag
LSR/SDBB ist **bevorzugter Pilotkandidat**, nicht bereits freigegebene Quelle. Kein automatisierter Live-Crawl bis zur Klärung von technischer Schnittstelle, Datenübernahme und Wiederveröffentlichung. Die eigene Import-, Normalisierungs-, Persistenz- und Zeitsteuerungslogik aus Variante C bleibt bestehen.

## Nachweise
- Das SDBB-LSR liefert offene Lehrstellen an Publikationsportale; aus einer 2024 publizierten Datenaustauschübersicht: Datenzugang für Dritte auf Anfrage, möglicherweise kostenlos, mit Datennutzungsvertrag. Keine Aussage, dass Career.Agency bereits zugangsberechtigt wäre.
  https://edudoc.ch/record/230708/files/Kurzuebersicht_Datenaustauschprojekte-und-dienste_d.pdf?version=1
- Datenfluss Kanton -> LSR -> Publikationsportale:
  https://www.sdbb.ch/fileadmin/redaktion-seviceseiten/04-datenmanagement/haka-ech/HAKA_SOLL-Datenaustauschprozesse_V3.0_de.pdf
- Offizielle LENA-Lehrstellensuche:
  https://www.berufsberatung.ch/de/suche/lehrstellen
- `https://www.berufsberatung.ch/robots.txt` liefert User-Agent: * / Allow: /. Dies bedeutet **keine** pauschale Erlaubnis zu kommerzieller Wiederveröffentlichung.

## Quellenauswahl
- LSR: strukturierter Datenzugang plausibel, aber Format, Authentifizierung, Konditionen, Änderungssignale und technische Dokumentation **ungeklärt**.
- berufsberatung.ch-Weboberfläche: technisch sichtbar, aber HTML/JS-Struktur der Ergebnisdaten, Zugriffslimits und Nutzungsbedingungen nicht abschliessend geprüft.
- Yousty / gateway.one: kein freigegebener automatisierter Datenbezug nachgewiesen. Keine automatisierten Requests im POC.

## Vor dem ersten Live-Adapter zu klären
1. Zulässigkeit kommerzieller Anzeige und Speicherung durch Career.Agency, Quellenhinweis/Verlinkung, Umfang der zulässigen Felder, Aufbewahrung und Löschung.
2. API-Endpunkt, Authentifizierung, Datenschema, Beispielantworten, Pagination, Rate-Limits, Delta-/Entfernungsinformationen.
3. Prüfen, ob `Lehrstellen offen` eine Anzahl und nicht zwingend genau ein Inserat je Beruf/Betrieb ist: die Identitätsstrategie muss mehrere Lehrplätze und verschiedene Lehrjahre korrekt abbilden.
4. Schriftliche Freigabe und dokumentierte Testbedingungen vor dem ersten automatisierten Produktionsabruf.
5. Der bestehende POC verarbeitet nur synthetische HTML-Fixtures, keine reale LSR-Antwort. Ein spezifischer Parser kann erst mit einem authentischen, freigegebenen Beispiel implementiert und verifiziert werden.

## Ressourcen und Betrieb
PostgreSQL 18.6 lokal erreichbar, 2 vCPU und ca. 1.9 GiB RAM. Python-Persistence-Integration (synthetisch, Test-DB) wurde am 06.11.2026 auf dem Infomaniak-Server laut Terminalausgabe mit 1/1 Test erfolgreich geprüft. Für echte Quellen sind Laufzeit, Last und Fehlerbehandlung nicht geprüft. systemd-Timer zweimal täglich bleibt deaktiviert.

## Gate für nächsten Schritt
Ein realer Parser wird erst auf Grundlage einer legitimen Beispielantwort oder ausdrücklich erlaubten Testseite implementiert. Danach 10-20 echte Datensätze in isolierter DB testen, Rücklauf und Statusänderungen prüfen, keine stillen Löschungen.
