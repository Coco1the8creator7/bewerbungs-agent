import unittest
from unittest.mock import patch
from importer.enrich import clean_description, parse_jobposting, enrich_one, enrich_jobs
from importer.github_daily import merge

class EnrichmentTests(unittest.TestCase):
    def setUp(self):
        self.job = {"id": "keep-me", "source": "jobs.ch", "title": "Projektleiter Fernwärme 80-100%", "url": "https://www.jobs.ch/de/stellenangebote/detail/example/", "description": None}
        self.description = ("Aufgaben: Planung und Realisierung thermischer Netze. "
                            "Sie koordinieren Projektbeteiligte und begleiten Bauausführungen. "
                            "Anforderungen: Technische Ausbildung und Erfahrung in der Projektleitung. "
                            "Wir bieten flexible Arbeitszeiten und Zusammenarbeit im Team. ") * 2

    def markup(self, title="Projektleiter Fernwärme 80-100%", description=None):
        import json
        posting={"@context":"https://schema.org","@type":"JobPosting","title":title,
                 "description":description or self.description}
        return "<html><head><script type='application/ld+json'>" + json.dumps(posting) + "</script></head><body><nav>Cookie Einstellungen</nav></body></html>"

    def test_extract_matching_jsonld(self):
        result = parse_jobposting(self.markup(), self.job)
        self.assertIn("Planung und Realisierung", result["description"])
        self.assertNotIn("Cookie Einstellungen", result["description"])

    def test_reject_mismatched_title(self):
        self.assertIsNone(parse_jobposting(self.markup("Pflegefachperson Chirurgie"), self.job))

    def test_malformed_and_too_short_description(self):
        self.assertIsNone(parse_jobposting("<script type='application/ld+json'>{bad</script>", self.job))
        self.assertIsNone(clean_description("<nav>Cookie</nav><p>Zu kurz.</p>"))

    def test_does_not_overwrite_known_description(self):
        old=dict(self.job,description="Already researched")
        result,status=enrich_one(old,fetch=lambda url: self.fail("No fetch expected"))
        self.assertEqual(status,"already_present")
        self.assertEqual(result["description"],"Already researched")

    def test_enrich_keeps_id_and_preserves_on_merge(self):
        updated,status=enrich_one(self.job,fetch=lambda url:self.markup())
        self.assertEqual(status,"enriched")
        self.assertEqual(updated["id"],self.job["id"])
        incoming=dict(self.job,first_seen_at="2026-10-20T00:00:00+00:00",last_seen_at="2026-10-20T00:00:00+00:00",company=None,location=None)
        enriched=dict(updated,first_seen_at="2026-10-19T00:00:00+00:00",last_seen_at="2026-10-19T00:00:00+00:00",company="Test AG",location="Zürich")
        result=merge([enriched],[incoming])
        self.assertEqual(result[0]["description"],updated["description"])
        self.assertEqual(result[0]["description_source"],"jsonld_jobposting")
        self.assertEqual(result[0]["first_seen_at"],"2026-10-19T00:00:00+00:00")

    def test_reject_local_network_target(self):
        result,status=enrich_one(dict(self.job,url="http://127.0.0.1/secret"),fetch=lambda url:self.markup())
        self.assertEqual(status,"invalid_url")
        self.assertIsNone(result["description"])

if __name__=="__main__":
    unittest.main()
