import unittest
from importer.github_daily import listings,merge

class JobmailTests(unittest.TestCase):
    def test_jobs_ch_real_layout_multiple_and_tracking_cleaned(self):
        text = """20 neue Jobs
[Company logo](https://www.jobs.ch/de/stellenangebote/detail/eba1bee3-5ef8-4e83-a5cc-3c51b7d8a186/?utm_source=mail)
[Projektleiter Energie 80-100%](https://www.jobs.ch/de/stellenangebote/detail/eba1bee3-5ef8-4e83-a5cc-3c51b7d8a186/?utm_source=mail)

Fiktiv AG, Zürich

[Company logo](https://www.jobs.ch/de/stellenangebote/detail/3188fcd6-91ac-479b-8194-31711e087d96/?utm_source=mail)
[Energieberater](https://www.jobs.ch/de/stellenangebote/detail/3188fcd6-91ac-479b-8194-31711e087d96/?utm_source=mail)

Test GmbH, Zug
Nicht verpassen! Diese Jobs sind immer noch online:
[Andere Stelle](https://www.jobs.ch/de/stellenangebote/detail/f46f2776-c738-426b-b38e-57e49422a1dc/)
"""
        result=listings("jobs.ch","20 neue Stellen",text,"","2026-10-19T05:00:00+00:00")
        self.assertEqual(len(result),2)
        self.assertEqual(result[0]["company"],"Fiktiv AG")
        self.assertEqual(result[0]["location"],"Zürich")
        self.assertEqual(result[0]["workload_pct_min"],80)
        self.assertEqual(result[0]["workload_pct_max"],100)
        self.assertEqual(result[0]["categories"],["Projektleitung","Fachbereich Energie"])
        self.assertNotIn("utm_source",result[0]["url"])
        self.assertIsNone(result[0]["provenance"]["source_message_id"])

    def test_publicjobs_redirect_links_and_footer_exclusion(self):
        text="""[Umweltingenieur/in](http://opn.publicjobs.ch/jmultn/4ztpBNR23gaVag7c)

Kanton Nidwalden - Stans

[Projektleiter:in Kraftwerke](http://opn.publicjobs.ch/jmultn/U7ZU9jY82rSpm3Dl)

Kraftwerke Oberhasli AG - Innertkirchen

[Jobmail abbestellen.](http://opn.publicjobs.ch/jmultn/Ph2Jbqq8koZqTkVW)
"""
        result=listings("publicjobs.ch","Dein Jobmail",text,"","2026-10-17T20:00:00+00:00")
        self.assertEqual(len(result),2)
        self.assertEqual(result[0]["company"],"Kanton Nidwalden")
        self.assertEqual(result[0]["location"],"Stans")

    def test_merge_preserves_first_seen(self):
        one=listings("publicjobs.ch","Jobmail","[Umweltingenieur/in](http://opn.publicjobs.ch/jmultn/abc123)\n\nKanton Zürich - Zürich","","2026-10-17T01:00:00+00:00")
        later=listings("publicjobs.ch","Jobmail","[Umweltingenieur/in](http://opn.publicjobs.ch/jmultn/abc123)\n\nKanton Zürich - Zürich","","2026-10-19T01:00:00+00:00")
        merged=merge(one,later)
        self.assertEqual(len(merged),1)
        self.assertEqual(merged[0]["first_seen_at"],"2026-10-17T01:00:00+00:00")

if __name__=="__main__":
    unittest.main()
