"""Conservative Caddy patch and environment validation. Never print secret values."""
import os, re, json, hashlib, stat, subprocess
from pathlib import Path

def legacy_basic_auth_only(config):
    """Approve authentication only below exact, legacy JSON path matchers.

    Caddy match entries are OR alternatives. Every alternative must constrain
    the path; a restricted sibling never authorizes an unrestricted route.
    Adapted authentication providers are inspected in memory, never printed.
    """
    found = False
    def routes_safe(routes, bounded=False):
        nonlocal found
        for route in routes:
            matches = route.get('match', [])
            exact = bool(matches) and all(
                isinstance(match.get('path'), list) and bool(match['path'])
                and all(path in ('/jobs.json', '/feedback.json') for path in match['path'])
                for match in matches
            )
            restricted = bounded or exact
            for handler in route.get('handle', []):
                if handler.get('handler') == 'authentication':
                    found = True
                    if not restricted:
                        return False
                if handler.get('handler') == 'subroute':
                    if not routes_safe(handler.get('routes', []), restricted):
                        return False
        return True
    servers = config.get('apps', {}).get('http', {}).get('servers', {})
    safe = all(routes_safe(server.get('routes', [])) for server in servers.values())
    return safe and found

def patch_caddy(text, legacy_basic_auth_reviewed=False):
    marker='# Career.Agency private API v1'
    if marker in text:return text
    matches=list(re.finditer(r'(?m)^careeragency\.ch\s*\{\s*$',text))
    if len(matches)!=1:raise ValueError('Expected exactly one standalone careeragency.ch site block; review current Caddyfile')
    if re.search(r'(?m)^\s*(rewrite|try_files|uri|method|redir|forward_auth)\s',text):
        # Such directives can run before handles and bypass/shadow a path matcher.
        # Narrow legacy /jobs.json basic_auth is supported by operator review only.
        raise ValueError('Existing request transformation/auth directive needs explicit route review')
    if re.search(r'(?m)^\s*basic_auth\s', text) and not legacy_basic_auth_reviewed:
        raise ValueError('Existing authentication needs exact legacy path review')
    for path in ['/api/auth','/api/user','/api/admin','/account','/app','/admin']:
        if path in text:raise ValueError('Existing private routes require review')
    insertion='''
    # Career.Agency private API v1
    handle /account.html {
        redir /account/login 308
    }
    handle /lehrstellen.json {
        root * /srv/careeragency-public
        file_server
    }
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
    if sys.argv[1]=='caddy':
        text = Path(sys.argv[2]).read_text()
        approved = False
        if re.search(r'(?m)^\s*basic_auth\s', text):
            result = subprocess.run(
                ['caddy', 'adapt', '--config', sys.argv[2], '--adapter', 'caddyfile'],
                capture_output=True, timeout=15,
            )
            if result.returncode or len(result.stdout) > 2_000_000:
                raise SystemExit('Cannot verify existing Caddy authentication scope')
            approved = legacy_basic_auth_only(json.loads(result.stdout))
            if not approved:
                raise SystemExit('Existing authentication is not limited to legacy JSON paths')
        Path(sys.argv[3]).write_text(patch_caddy(text, legacy_basic_auth_reviewed=approved))
    elif sys.argv[1]=='env':verify_env(read_env(sys.argv[2]));print('auth_environment=complete')
    else:raise SystemExit(64)
