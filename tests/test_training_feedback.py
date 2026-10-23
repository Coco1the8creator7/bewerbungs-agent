"""Synthetic fixtures only; no personal feedback committed to tests."""
import unittest

from selector.training_feedback import explicit_training_examples


class ExplicitTrainingFeedbackTests(unittest.TestCase):
    def test_legacy_export_has_overall_score_but_no_inferred_aspects(self):
        payload = {"type": "bewerbungs-agent-relevance-feedback", "schema_version": "1.0.0",
                   "ratings": [{"job_id": "a", "user_score": 72, "reason": "tasks",
                                "reasons": ["tasks", "field"], "suggested_score_at_rating": 45}]}
        self.assertEqual(explicit_training_examples(payload),
                         [{"job_id": "a", "labels": {"user_score": 72}}])

    def test_partial_feedback_does_not_invent_overall_or_missing_criteria(self):
        payload = {"type": "bewerbungs-agent-feedback", "relevance_ratings": [
            {"id": "a", "score": 40, "aspects": {"tasks": -60}},
            {"id": "b", "score": None, "aspects": {"distance": 0},
             "field_relation": "transferable", "seniority_assessment": None},
            {"id": "c", "score": None, "aspects": {}, "note": "Text only"}]}
        self.assertEqual(explicit_training_examples(payload), [
            {"job_id": "a", "labels": {"user_score": 40, "aspects": {"tasks": -60}}},
            {"job_id": "b", "labels": {"aspects": {"distance": 0}, "field_relation": "transferable"}},
        ])

    def test_new_export_keeps_unrated_criterion_feedback_separate(self):
        payload = {"type": "bewerbungs-agent-relevance-feedback", "schema_version": "1.1.0",
                   "ratings": [{"job_id": "a", "user_score": 1, "aspects": {},
                                "field_relation": "unrelated"}],
                   "unrated_feedback": [{"job_id": "b", "aspects": {"conditions": -75}}]}
        self.assertEqual(explicit_training_examples(payload), [
            {"job_id": "a", "labels": {"user_score": 1, "field_relation": "unrelated"}},
            {"job_id": "b", "labels": {"aspects": {"conditions": -75}}},
        ])

    def test_explicit_zero_is_not_same_as_absent(self):
        payload = {"type": "bewerbungs-agent-feedback", "relevance_ratings": [
            {"id": "a", "score": None, "aspects": {"employer": 0}},
            {"id": "b", "score": None, "aspects": {}}]}
        self.assertEqual(explicit_training_examples(payload),
                         [{"job_id": "a", "labels": {"aspects": {"employer": 0}}}])

    def test_bad_scores_or_aspects_are_rejected(self):
        for item in ({"id": "x", "score": False}, {"id": "x", "aspects": {"tasks": 101}},
                     {"id": "x", "aspects": {"distance": None}}):
            with self.subTest(item=item), self.assertRaises(ValueError):
                explicit_training_examples({"type": "bewerbungs-agent-feedback", "relevance_ratings": [item]})


if __name__ == "__main__":
    unittest.main()
