"""Security primitives for Career.Agency.

This is NOT an HTTP server or a complete authentication system. The database,
authorization, throttling, token consumption and audit operations must be added
before this module is used by a live endpoint.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_PASSWORD_HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

SESSION_STANDARD = timedelta(hours=72)
SESSION_REMEMBER = timedelta(days=45)
EMAIL_VERIFY_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(minutes=30)


def canonical_email(value: str) -> str:
    """Normalize surrounding spaces and case, without provider-specific rules."""
    if not isinstance(value, str):
        raise ValueError("Ungültige E-Mail-Adresse")
    result = value.strip().lower()
    if len(result) > 320 or not _EMAIL_RE.fullmatch(result):
        raise ValueError("Ungültige E-Mail-Adresse")
    return result


def hash_password(password: str) -> str:
    if not isinstance(password, str) or len(password) < 12 or len(password) > 1024:
        raise ValueError("Passwort muss 12 bis 1024 Zeichen enthalten")
    return _PASSWORD_HASHER.hash(password)


def password_matches(stored_hash: str, candidate: str) -> bool:
    if not isinstance(candidate, str) or not isinstance(stored_hash, str):
        return False
    try:
        return bool(_PASSWORD_HASHER.verify(stored_hash, candidate))
    except (VerifyMismatchError, VerificationError, InvalidHashError, ValueError, TypeError):
        return False


def password_needs_rehash(stored_hash: str) -> bool:
    return _PASSWORD_HASHER.check_needs_rehash(stored_hash)


def new_bearer_secret() -> tuple[str, bytes]:
    """Return an unpredictable opaque token and its 32-byte SHA-256 digest.

    Store ONLY the digest in the database. Send the plaintext once over TLS.
    """
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode("ascii")).digest()


def digest_bearer_secret(token: str) -> bytes:
    if not isinstance(token, str) or len(token) > 256:
        raise ValueError("Invalid token")
    return hashlib.sha256(token.encode("ascii")).digest()


def token_matches(stored_digest: bytes, supplied_token: str) -> bool:
    try:
        return hmac.compare_digest(stored_digest, digest_bearer_secret(supplied_token))
    except (TypeError, ValueError, UnicodeEncodeError):
        return False


def new_recovery_codes(count: int = 10) -> list[tuple[str, bytes]]:
    if not 1 <= count <= 20:
        raise ValueError("Invalid recovery code count")
    return [new_bearer_secret() for _ in range(count)]


@dataclass(frozen=True)
class AccountState:
    status: str
    email_verified: bool
    role: str
    admin_totp_enabled: bool = False


def permitted_area(account: AccountState) -> str:
    """Server-side authorization decision, never a frontend-only redirect.

    pending users may access only the waiting screen, blocked users nothing;
    administrators without enrolled TOTP may access only their 2FA setup.
    """
    if account.status == "blocked":
        return "denied"
    if account.status != "active" or not account.email_verified:
        return "waiting"
    if account.role == "admin":
        return "app" if account.admin_totp_enabled else "admin_2fa_setup"
    return "app"


def expiry_for_session(issued_at: datetime, remember: bool = False) -> datetime:
    if issued_at.tzinfo is None or issued_at.utcoffset() is None:
        raise ValueError("Time must be timezone aware")
    return issued_at + (SESSION_REMEMBER if remember else SESSION_STANDARD)


def valid_one_time_token(expires_at: datetime, consumed_at: datetime | None, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    if expires_at.tzinfo is None or now.tzinfo is None:
        raise ValueError("Time must be timezone aware")
    return consumed_at is None and now < expires_at
