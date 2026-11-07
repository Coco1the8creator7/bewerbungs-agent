"""Conservative Caddy patch and environment validation. Never print secret values."""
import os, re, json, hashlib, stat
from pathlib import Path

def patch_caddy(text):
    marker='# Career.Agency private API v1'
    if marker in text:return text
    matches=list(re.finditer(r'(?m)^careeragency\.ch\s*\{\s*$',text))
    if len(matches)!=1:raise ValueError('Expected exactly one standalone careeragency.ch site block; review current Caddyfile')
    if re.search(r'(?m)^\s*(rewrite|try_files|uri|method|redir|forward_auth|basic_auth)\s',text):
        # Such directives can run before handles and bypass/shadow a path matcher.
        # Narrow legacy /jobs.json basic_auth is supported by operator review only.
        raise ValueError('Existing request transformation/auth directive needs explicit route review')
    for path in ['/api/auth','/api/user','/api/admin','/account','/app','/admin']:
        if path in text:raise ValueError('Existing private routes require review')
    insertion='''
    # Career.Agency private API v1
    @ca_legacy path /feedback.json /jobs.json
    handle @ca_legacy {
        respond 404
    }
    @ca_private path /app /app/* /account /account/* /admin /admin/* /api/auth /api/auth/* /api/user /api/user/* /api/admin /api/admin/*
    handle @ca_private {
        request_body {
            max_size 5MB
        }
        reverse_proxy 127.0.0.1:8765
    }
'''
    at=matches[0].end()
    return text[:at]+insertion+text[at:]

def read_env(path):
    path=Path(path)
    if path.is_symlink() or not path.is_file() or path.stat().st_uid!=0 or stat.S_IMODE(path.stat().st_mode)!=0o600:
        raise ValueError('auth.env must be root-owned, mode 0600, regular file')
    values={}
    for line in path.read_text().splitlines():
        if not line or line.startswith('#'):continue
        key,sep,value=line.partition('=')
        if not sep or not re.fullmatch(r'CAREER_[A-Z_]+',key):raise ValueError('Invalid environment entry')
        if value.startswith('"'):value=json.loads(value)
        values[key]=value
    return values

def verify_env(values):
    if any(any(c in value for c in "\x00\n\r") for value in values.values()):raise ValueError("Control characters in environment")
    for key in ['CAREER_AUTH_DATABASE_URL','CAREER_AUTH_TOTP_KEY','CAREER_AUTH_MAIL_FROM','CAREER_AUTH_SMTP_HOST','CAREER_AUTH_SMTP_USER','CAREER_AUTH_SMTP_PASS']:
        if not values.get(key):raise ValueError('Missing '+key)
    if values.get('CAREER_AUTH_PUBLIC_ORIGIN')!='https://careeragency.ch':raise ValueError('Unexpected public origin')
    if values.get('CAREER_APP_ROOT')!='/opt/careeragency/auth-current/dashboard':raise ValueError('Unexpected app root')
    if values.get('CAREER_PUBLIC_FEED')!='/srv/careeragency-public/lehrstellen.json':raise ValueError('Unexpected feed path')
    return values
if __name__=='__main__':
    import sys
    if sys.argv[1]=='caddy':Path(sys.argv[3]).write_text(patch_caddy(Path(sys.argv[2]).read_text()))
    elif sys.argv[1]=='env':verify_env(read_env(sys.argv[2]));print('auth_environment=complete')
    else:raise SystemExit(64)
