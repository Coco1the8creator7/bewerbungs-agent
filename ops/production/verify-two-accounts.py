"""Bounded production acceptance test. Only newly created synthetic rows are removed.

Run as postgres from the staged runtime. Passwords/cookies never leave this process.
The public HTTPS login and private API are exercised without privileged HTTP bypass.
"""
import hashlib
import json
import secrets
import uuid
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

import psycopg
from auth.security import hash_password

ORIGIN = 'https://careeragency.ch'
DSN = 'dbname=careeragency_auth user=postgres host=/var/run/postgresql'


class Client:
    def __init__(self, account=None):
        self.account = account
        self.cookies = CookieJar()
        self.http = build_opener(HTTPCookieProcessor(self.cookies))

    def request(self, path, expected, method='GET', data=None, account=None):
        headers = {'Origin': ORIGIN, 'Content-Type': 'application/json'}
        if self.account:
            headers['X-Career-Account'] = str(account or self.account)
        body = None if data is None else json.dumps(data).encode()
        request = Request(ORIGIN + path, data=body, headers=headers, method=method)
        try:
            response = self.http.open(request, timeout=20)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            assert response.code == expected, f'{method} {path}: {response.code}, expected {expected}'
            return raw

    def state(self, key):
        return json.loads(self.request('/api/user/state/' + key, 200))


def main():
    anonymous = Client()
    protected = ['/app', '/app/', '/app/index.html', '/app/private-state.js',
                 '/app/mission-control.html', '/app/dossier-studio.html',
                 '/api/user/state/workspace', '/api/user/state/profile', '/admin']
    for path in protected:
        anonymous.request(path, 401)
    print('PASS anonymous HTML, assets, private state and admin denied')
    ids = [uuid.uuid4(), uuid.uuid4()]
    emails = ['release-test-' + str(uid) + '@example.com' for uid in ids]
    passwords = [secrets.token_urlsafe(32), secrets.token_urlsafe(32)]
    try:
        with psycopg.connect(DSN) as con:
            for uid, email, password in zip(ids, emails, passwords):
                con.execute("""INSERT INTO career_auth.users
                    (id,email,first_name,last_name,residence,password_hash,status,email_verified_at)
                    VALUES (%s,%s,'Release','Test','Synthetic',%s,'active',now())""",
                    (uid, email, hash_password(password)))
        clients = [Client(uid) for uid in ids]
        for client, email, password, other in zip(clients, emails, passwords, reversed(ids)):
            client.request('/api/auth/login', 200, 'POST', {'email': email, 'password': password})
            html = client.request('/app/', 200).decode()
            assert str(client.account) in html and str(other) not in html
            assert '<script src="./storage.js"></script>' not in html
            adapter = client.request('/app/private-state.js', 200)
            assert adapter == Path('dashboard/private-state.js').read_bytes()
            client.request('/admin', 403)
        print('PASS two real HTTPS logins, gated app and matching private adapter')
        a, b = clients
        values = {
            'workspace': {'type': 'bewerbungs-agent-workspace', 'jobs': [], 'annotations': []},
            'swipes': [{'id': 'synthetic-release', 'signal': 'saved'}],
            'radar': {'synthetic': 'A'}, 'profile': {'synthetic': 'A'},
            'last-visit': '2026-11-20T00:00:00Z',
            'feedback': {'type': 'bewerbungs-agent-feedback', 'schema_version': '1.0.0',
                         'annotations': [{'id': 'synthetic-release', 'note': 'only A'}]}
        }
        for key, value in values.items():
            a.request('/api/user/state/' + key, 200, 'PUT', {'revision': 0, 'data': value})
            assert b.state(key) == {'data': None, 'revision': 0}
            assert a.state(key)['data'] == value
        b.request('/api/user/state/profile', 200, 'PUT', {'revision': 0, 'data': {'synthetic': 'B'}})
        assert a.state('profile')['data'] == {'synthetic': 'A'}
        assert b.state('profile')['data'] == {'synthetic': 'B'}
        for reader, foreign in [(a, ids[1]), (b, ids[0])]:
            reader.request('/api/user/state/profile', 409, account=foreign)
            reader.request('/api/user/state/profile', 409, 'PUT',
                           {'revision': 1, 'data': {'synthetic': 'foreign'}}, account=foreign)
            reader.request('/api/user/state/profile', 422, 'PUT',
                           {'revision': 1, 'data': {}, 'user_id': str(foreign)})
        print('PASS all six state stores isolated, cross-account headers and owner injection denied')
        # Same cookie jar after switching accounts models an old tab with A's identity.
        a.request('/api/auth/logout', 200, 'POST', {})
        a.request('/app/', 401)
        a.request('/api/auth/login', 200, 'POST', {'email': emails[1], 'password': passwords[1]})
        a.request('/api/user/state/profile', 409)
        a.request('/api/user/state/profile', 409, 'PUT', {'revision': 1, 'data': {'stale': True}})
        a.account = ids[1]
        assert a.state('profile')['data'] == {'synthetic': 'B'}
        a.request('/api/auth/logout', 200, 'POST', {})
        a.request('/api/auth/login', 200, 'POST', {'email': emails[0], 'password': passwords[0]})
        a.account = ids[0]
        assert a.state('profile')['data'] == {'synthetic': 'A'}
        a.request('/api/auth/logout', 200, 'POST', {})
        a.request('/app/', 401)
        print('PASS logout revocation, same-browser account switch and persisted A data')
    finally:
        with psycopg.connect(DSN) as con:
            for uid, email in zip(ids, emails):
                con.execute('DELETE FROM career_auth.users WHERE id=%s AND email=%s', (uid, email))
            assert con.execute('SELECT count(*) FROM career_auth.users WHERE id = ANY(%s)', (ids,)).fetchone()[0] == 0
        print('PASS synthetic accounts, sessions and private data removed')
    print('production_two_accounts=passed')


if __name__ == '__main__':
    main()
