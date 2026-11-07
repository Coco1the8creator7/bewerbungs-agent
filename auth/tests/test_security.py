"""Focused authentication primitive tests. Run: python -m unittest discover -s auth/tests -v"""
import unittest
from datetime import datetime, timedelta, timezone

from auth.security import (
    AccountState,
    SESSION_REMEMBER,
    SESSION_STANDARD,
    canonical_email,
    digest_bearer_secret,
    expiry_for_session,
    hash_password,
    new_bearer_secret,
    new_recovery_codes,
    password_matches,
    permitted_area,
    token_matches,
    valid_one_time_token,
)


class SecurityTests(unittest.TestCase):
    def test_email_is_canonical_and_invalid_rejected(self):
        self.assertEqual(canonical_email("  USER@Example.CH "), "user@example.ch")
        for value in ("", "bad@", "abc", "a b@example.ch"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                canonical_email(value)

    def test_password_hash_verify_and_mismatch(self):
        hashed = hash_password("a meaningful long passphrase")
        self.assertTrue(hashed.startswith("$argon2id$"))
        self.assertTrue(password_matches(hashed, "a meaningful long passphrase"))
        self.assertFalse(password_matches(hashed, "wrong password"))
        self.assertFalse(password_matches("not a hash", "anything"))

    def test_short_password_rejected(self):
        with self.assertRaises(ValueError):
            hash_password("12345678901")

    def test_tokens_are_random_and_only_digest_should_be_stored(self):
        t1, h1 = new_bearer_secret()
        t2, h2 = new_bearer_secret()
        self.assertNotEqual(t1, t2)
        self.assertEqual(len(h1), 32)
        self.assertNotEqual(t1.encode(), h1)
        self.assertTrue(token_matches(h1, t1))
        self.assertFalse(token_matches(h1, t2))
        self.assertEqual(digest_bearer_secret(t1), h1)

    def test_recovery_codes_unique(self):
        pairs = new_recovery_codes(10)
        self.assertEqual(len(pairs), 10)
        self.assertEqual(len({code for code, _ in pairs}), 10)

    def test_access_waiting_blocked_and_admin_enrollment(self):
        self.assertEqual(permitted_area(AccountState("pending", True, "user")), "waiting")
        self.assertEqual(permitted_area(AccountState("active", False, "user")), "waiting")
        self.assertEqual(permitted_area(AccountState("blocked", True, "admin", True)), "denied")
        self.assertEqual(permitted_area(AccountState("active", True, "admin", False)), "admin_2fa_setup")
        self.assertEqual(permitted_area(AccountState("active", True, "admin", True)), "app")
        self.assertEqual(permitted_area(AccountState("active", True, "user")), "app")

    def test_expiry_and_one_time_use(self):
        now = datetime(2026, 11, 7, tzinfo=timezone.utc)
        self.assertEqual(expiry_for_session(now) - now, SESSION_STANDARD)
        self.assertEqual(expiry_for_session(now, remember=True) - now, SESSION_REMEMBER)
        self.assertTrue(valid_one_time_token(now + timedelta(seconds=1), None, now))
        self.assertFalse(valid_one_time_token(now, None, now))
        self.assertFalse(valid_one_time_token(now + timedelta(seconds=1), now, now))

    def test_naive_datetimes_rejected(self):
        with self.assertRaises(ValueError):
            expiry_for_session(datetime(2026, 11, 7))


if __name__ == "__main__":
    unittest.main()
