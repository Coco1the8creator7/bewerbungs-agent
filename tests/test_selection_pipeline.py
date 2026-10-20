import unittest
from importer.github_daily import listings,merge
from selector.score import suggest,apply

DATE="2026-10-20T05:00:00+00:00"

class RealLayoutRegressionTests(unittest.TestCase):
    def test_publicjobs_footer_never_becomes_job(self):
        body = """publicjobs.ch: Neue passende Jobs für dich!
Wir haben neue, passende Jobs für dich gefunden:
[Projektleiter:in Kraftwerke](http://opn.publicjobs.ch/jmultn/Aa1234567BBbcCde)
Kraftwerke Oberhasli AG - Innertkirchen
[Umweltingenieur/in](http://opn.publicjobs.ch/jmultn/Bb1234567CCcdDef)
Kanton Nidwalden - Stans
Wir wünschen dir viel Erfolg bei der Jobsuche mit publicjobs.ch!
[Instagram](http://opn.publicjobs.ch/jmultn/Cc1234567DDdeEfg)
[Swiss Public Services AG](http://opn.publicjobs.ch/jmultn/Dd1234567EEefFgh)
[Jobs suchen](http://opn.publicjobs.ch/jmultn/Ee1234567FFfgGhi)
"""
        rows=listings("publicjobs.ch","Publicjobs.ch - Dein Jobmail",body,"",DATE)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]["company"],"Kraftwerke Oberhasli AG")
        self.assertEqual(rows[0]["location"],"Innertkirchen")
        self.assertEqual(rows[1]["title"],"Umweltingenieur/in")

    def test_jobs_ch_logos_ignored_but_actual_jobs_included(self):
        body="""Hier sind die top ausgewählten Jobs:
[Company logo](https://www.jobs.ch/de/stellenangebote/detail/eba1bee3-5ef8-4e83-a5cc-3c51b7d8a186/?uid=SECRET)
[Projektleitung Wärme 80-100%](https://www.jobs.ch/de/stellenangebote/detail/eba1bee3-5ef8-4e83-a5cc-3c51b7d8a186/?uid=SECRET)
Energie Muster AG, Zürich
Nicht verpassen! Diese Jobs sind immer noch online:
[Technischer Berater](https://www.jobs.ch/de/stellenangebote/detail/3188fcd6-91ac-479b-8194-31711e087d96/?uid=SECRET)
Test AG, Zug
"""
        rows=listings("jobs.ch","216 neue Stellenangebote",body,"",DATE)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]["company"],"Energie Muster AG")
        self.assertEqual(rows[0]["location"],"Zürich")
        self.assertEqual(rows[0]["workload_pct_min"],80)
        self.assertNotIn("SECRET",str(rows))
        self.assertNotIn("uid=",str(rows))

    def test_repeated_import_keeps_identity_without_ghost_entries(self):
        original=listings("publicjobs.ch","alert","[Projektleiter](http://opn.publicjobs.ch/jmultn/J0B123456)\nTest AG - Bern","",DATE)
        previous=original+[{"id":"footer","title":"Swiss Public Services AG","source":"publicjobs.ch"}]
        merged=merge(previous,original)
        self.assertEqual(len(merged),1)

    def test_employer_link_without_real_fixture_is_conservative(self):
        body="[Projektleiter Fernwärme](https://jobs.example.org/career/positions/12345678-projektleiter)\n"
        self.assertEqual(len(listings("ewz","Offene Positionen",body,"",DATE)),1)
        self.assertEqual(len(listings("energie360.ch","Offene Positionen",body,"",DATE)),1)
        self.assertEqual(len(listings("ewz","Offene Positionen","[LinkedIn](https://linkedin.com/company/ewz)","",DATE)),0)

    def test_suggestion_is_never_a_filter(self):
        jobs=[{"id":"one","title":"Fernwärme Projektleiter"},{"id":"two","title":"Fashion Retail"}]
        result=apply(jobs)
        self.assertEqual(len(result),2)
        self.assertTrue(all(x["selection"]["exclusion"] is False for x in result))
        self.assertGreater(result[0]["selection"]["suggested_score"],result[1]["selection"]["suggested_score"])
        self.assertEqual(suggest({"title":""})["mode"],"suggestion_only")

if __name__=="__main__":
    unittest.main()
