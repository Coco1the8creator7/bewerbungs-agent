"""Trusted, interactive bootstrap; database credentials never appear in arguments."""
import os,subprocess
from production_rollout import read_env,verify_env
if os.geteuid()!=0:raise SystemExit('Run with sudo')
values=verify_env(read_env('/etc/careeragency/auth.env'))
env={**os.environ,**values,'CAREER_AUTH_ALLOW_ADMIN_BOOTSTRAP':'YES_ONCE'}
raise SystemExit(subprocess.call(['runuser','-u','careeragency_auth','--','/opt/careeragency/auth-current/.venv/bin/python','-m','authservice.bootstrap_admin'],cwd='/opt/careeragency/auth-current',env=env))
