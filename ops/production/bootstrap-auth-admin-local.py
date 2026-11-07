#!/usr/bin/env python3
"""Run the interactive admin bootstrap without shell-evaluating the SMTP secret file."""
import os
import shlex
import stat
import sys
from pathlib import Path

ENVFILE=Path("/etc/careeragency/auth.env")
BASE=Path("/opt/careeragency/auth-current")
REQUIRED={"CAREER_AUTH_DATABASE_URL","CAREER_AUTH_PUBLIC_ORIGIN","CAREER_AUTH_TOTP_KEY",
          "CAREER_AUTH_MAIL_FROM","CAREER_AUTH_SMTP_HOST","CAREER_AUTH_SMTP_USER",
          "CAREER_AUTH_SMTP_PASS"}

def main():
    if os.geteuid()!=0 or not sys.stdin.isatty() or not sys.stdout.isatty():
        raise SystemExit("Interactive sudo terminal required")
    fs=ENVFILE.lstat()
    if not stat.S_ISREG(fs.st_mode) or fs.st_uid!=0 or stat.S_IMODE(fs.st_mode)!=0o600:
        raise SystemExit("auth.env must be root-owned 0600 regular file")
    env=os.environ.copy()
    for line in ENVFILE.read_text(encoding="utf-8").splitlines():
        key,sep,value=line.partition("=")
        if not sep or key not in REQUIRED | {"CAREER_AUTH_SMTP_PORT"}:
            raise SystemExit("Invalid auth.env format")
        parts=shlex.split(value)
        if len(parts)!=1:
            raise SystemExit("Invalid auth.env value")
        env[key]=parts[0]
    if not REQUIRED.issubset(env):
        raise SystemExit("Incomplete auth configuration")
    env["CAREER_AUTH_ALLOW_ADMIN_BOOTSTRAP"]="YES_ONCE"
    os.chdir(BASE)
    python=BASE/".venv/bin/python"
    if not python.exists():
        raise SystemExit("Runtime missing")
    # exec preserves TTY for getpass while using the unprivileged peer-auth role.
    os.execvpe("runuser",["runuser","-u","careeragency_auth","--",
                         str(python),"-m","authservice.bootstrap_admin"],env)

if __name__=="__main__":
    main()
