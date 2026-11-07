"""Fail closed unless adapted authentication has an exact legacy path bound."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('rollout', ROOT/'ops/production/production_rollout.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def config(routes):
    return {'apps': {'http': {'servers': {'srv0': {'routes': routes}}}}}


def auth_route(matches=None):
    route = {'handle': [{'handler': 'authentication'}]}
    if matches is not None:
        route['match'] = matches
    return route


class LegacyAuthScopeTests(unittest.TestCase):
    def test_nested_exact_jobs_scope(self):
        routes = [{'match': [{'host': ['careeragency.ch']}], 'handle': [
            {'handler': 'subroute', 'routes': [
                {'match': [{'path': ['/jobs.json']}], 'handle': [
                    {'handler': 'subroute', 'routes': [auth_route()]}
                ]}
            ]}
        ]}]
        self.assertTrue(module.legacy_basic_auth_only(config(routes)))

    def test_global_glob_or_expanded_scope_is_rejected(self):
        for matches in (None, [{'path': ['/*']}], [{'path': ['/jobs.json*']}],
                        [{'path': ['/jobs.json']}, {}],
                        [{'path': ['/jobs.json', '/app/*']}]):
            with self.subTest(matches=matches):
                self.assertFalse(module.legacy_basic_auth_only(config([auth_route(matches)])))

    def test_restricted_sibling_cannot_authorize_global_auth(self):
        self.assertFalse(module.legacy_basic_auth_only(config([
            auth_route([{'path': ['/jobs.json']}]), auth_route()
        ])))

    def test_patch_requires_review_and_preserves_legacy_rule(self):
        old = 'careeragency.ch {\n handle /jobs.json {\n basic_auth {\n fixture hash\n }\n file_server\n }\n handle {\n file_server\n }\n}\n'
        with self.assertRaises(ValueError):
            module.patch_caddy(old)
        new = module.patch_caddy(old, legacy_basic_auth_reviewed=True)
        self.assertIn('basic_auth {\n fixture hash', new)
        self.assertIn('reverse_proxy 127.0.0.1:8765', new)
        self.assertEqual(module.patch_caddy(new), new)

    def test_activation_preserves_independent_public_ui(self):
        activation = (ROOT/'ops/production/apply-production.sh').read_text().split('# Activate only', 1)[1]
        for name in ('index.html', 'mode-nav.js', 'radar.js', 'github-sync.js'):
            self.assertNotIn('"$live/' + name + '"\n', activation.replace('cmp -s "$src/dashboard/github-sync.js" "$live/github-sync.js" || {', ''))
        self.assertIn('cmp -s "$src/dashboard/github-sync.js" "$live/github-sync.js"', activation)

    def test_absent_auth_cannot_approve(self):
        self.assertFalse(module.legacy_basic_auth_only(config([])))
