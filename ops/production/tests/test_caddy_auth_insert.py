import importlib.util
from pathlib import Path
import unittest

SRC=Path(__file__).resolve().parents[1] / "caddy-auth-insert.py"
spec=importlib.util.spec_from_file_location("ca_caddy_auth_insert",SRC)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class CaddyInsertTest(unittest.TestCase):
    def test_clean_site_keeps_landing_and_feed(self):
        original="""{
    email ops@example.com
}
careeragency.ch {
    encode zstd gzip
    root * /var/www/careeragency/current
    file_server
    @feed path /jobs.json
    respond @feed "restricted" 401
}
"""
        updated=module.insert_routes(original)
        self.assertIn("reverse_proxy 127.0.0.1:8765",updated)
        self.assertIn("root * /var/www/careeragency/current",updated)
        self.assertIn("respond @feed",updated)
        self.assertIn("handle /app/*",updated)
        self.assertEqual(updated.count("handle /admin {"),1)
        self.assertEqual(module.brace_pairs(updated).__len__(),8)
    def test_invalid_or_ambiguous(self):
        for original in ("", "other.example.com { respond ok }",
                         "careeragency.ch { respond ok", 
                         "careeragency.ch { route { file_server } }",
                         "careeragency.ch { import other.caddy }",
                         "careeragency.ch { rewrite * /index.html }",
                         "careeragency.ch { respond ok }\ncareeragency.ch { respond ok }"):
            with self.subTest(text=original), self.assertRaises(ValueError):
                module.insert_routes(original)
    def test_mixed_handler_existing(self):
        original="""careeragency.ch {
    handle /jobs.json {
        respond "feed" 401
    }
    handle {
        root * /var/www/careeragency/current
        file_server
    }
}
"""
        result=module.insert_routes(original)
        self.assertIn("handle /account/*",result)
        self.assertIn('respond "feed" 401',result)
        self.assertIn("handle {",result)
    def test_reject_duplicate(self):
        with self.assertRaises(ValueError):
            module.insert_routes("careeragency.ch { handle /account/* { respond ok } }")
