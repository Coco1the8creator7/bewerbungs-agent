# Gmail-Importer (noch nicht implementiert)

Der spätere lokale Importer soll E-Mails mit Job-Alerts abrufen, **nicht** Aktivierungsnachrichten als Stellen interpretieren, je Nachricht mehrere Stellen extrahieren, nach \`../schemas/job.schema.json\` normalisieren und ohne Dubletten in eine lokale \`../data/jobs.json\` schreiben.

**Geplante Verarbeitung:** erst Quelladapter für tatsächliche Jobmails (jobs.ch / publicjobs / ewz / Energie 360°), anschliessend KI-gestützte Extraktion für uneinheitliche Layouts. Parser-Fehler oder fehlende URLs führen zu \`processing.state = "needs_review"\` statt zum Verwerfen.

Die Gmail-Verbindung in ChatGPT ist separat vom lokalen OAuth-Zugang eines Mac-Skripts. Hier existieren absichtlich noch keine Zugangsdaten oder angebliche Hintergrund-Automation.

Die erste E-Mail-Analyse findet in ChatGPT statt, nachdem reguläre Jobmails eingetroffen sind.
