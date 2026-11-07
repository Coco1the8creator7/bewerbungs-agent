#!/usr/bin/env python3
"""Configure auth SMTP and encryption secrets locally; never paste secrets into GitHub.
Must be run interactively with sudo on the Infomaniak host.
"""
import base64
import getpass
import os
import re
import secrets
import stat
import sys
import tempfile
from pathlib import Path

TARGET = Path("/etc/careeragency/auth.env")
DOMAIN = "https://careeragency.ch"
DSN = "postgresql:///careeragency_auth?user=careeragency_auth"

def quoted(value: str) -> str:
    if any(c in value for c in "\n\r\x00") or len(value) > 1024:
        raise ValueError("Invalid environment value")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"').replace("$", "$") + '"'

def main():
    if os.geteuid() != 0 or not sys.stdin.isatty() or not sys.stdout.isatty():
        raise SystemExit("Run interactively with sudo on the server; never through GitHub Actions.")
    if TARGET.exists() or TARGET.is_symlink():
        raise SystemExit("Existing auth.env detected: refusing to overwrite or rotate the MFA key.")
    if not Path("/opt/careeragency/auth-current").exists():
        raise SystemExit("Auth runtime must be staged first.")
    folder = TARGET.parent
    if not folder.is_dir() or folder.is_symlink():
        raise SystemExit("Missing protected /etc/careeragency directory")
    if stat.S_IMODE(folder.stat().st_mode) & 0o077:
        raise SystemExit("Auth config directory must not be accessible to other users")
    host = input("SMTP hostname (Infomaniak): ").strip()
    port = input("SMTP STARTTLS port [587]: ").strip() or "587"
    sender = input("Absenderadresse (z.B. noreply@careeragency.ch): ").strip()
    user = input("SMTP Benutzername: ").strip()
    password = getpass.getpass("SMTP Passwort (wird nicht angezeigt): ")
    confirmation = getpass.getpass("SMTP Passwort erneut: ")
    if not re.fullmatch(r"[A-Za-z0-9.-]{3,255}", host) or host.startswith("-"):
        raise SystemExit("Invalid SMTP host")
    if port != "587":
        raise SystemExit("Only verified SMTP STARTTLS port 587 supported")
    if "@" not in sender or any(c.isspace() for c in sender) or not user or not password or password != confirmation:
        raise SystemExit("Invalid SMTP settings")
    if not sender.lower().endswith("@careeragency.ch"):
        raise SystemExit("Sender must be under careeragency.ch")
    # Secret is generated on the host and must be backed up securely, never logged.
    key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii")
    values = {
        "CAREER_AUTH_DATABASE_URL": DSN,
        "CAREER_AUTH_PUBLIC_ORIGIN": DOMAIN,
        "CAREER_AUTH_TOTP_KEY": key,
        "CAREER_AUTH_MAIL_FROM": sender,
        "CAREER_AUTH_SMTP_HOST": host,
        "CAREER_AUTH_SMTP_PORT": port,
        "CAREER_AUTH_SMTP_USER": user,
        "CAREER_AUTH_SMTP_PASS": password,
    }
    fd, name = tempfile.mkstemp(prefix=".auth-env-", dir=folder)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            for k, v in values.items():
                out.write(k + "=" + quoted(v) + "\n")
            out.flush()
            os.fsync(out.fileno())
        # Exclusive destination creation prevents accidental loss of another secret set.
        os.link(name, TARGET)
    finally:
        if os.path.exists(name):
            os.unlink(name)
    print("auth_env=created")
    print("smtp_password_printed=false")
    print("fernet_key_printed=false")
    print("WARNING: Back up auth.env and Fernet key offline in a secure location.")

if __name__ == "__main__":
    main()
