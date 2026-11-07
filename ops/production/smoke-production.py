"""Read-only public deployment gates; no registrations or real mail are generated."""
import json
from urllib.request import urlopen
from urllib.error import HTTPError
checks={'/':{200},'/lehrstellen.json':{200},'/feedback.json':{401,403,404},'/jobs.json':{401,403,404},
 '/app/':{401,403},'/app/index.html':{401,403},'/app/storage.js':{401,403},'/app/private-state.js':{401,403},
 '/app/feedback.json':{401,403},'/admin':{401,403},'/api/user/state/workspace':{401,403},
 '/api/auth/me':{401},'/account/login':{200},'/account/register':{200}}
for path,expected in checks.items():
 try:
  with urlopen('https://careeragency.ch'+path,timeout=15) as r:
   code=r.status
   if path=='/lehrstellen.json':
    data=json.load(r)
    assert isinstance(data,list) and data and all(x.get('source')=='yousty.ch' and x.get('id','').startswith('apprenticeship-') for x in data)
 except HTTPError as error:code=error.code
 if code not in expected:raise SystemExit(f'FAIL {path}: {code}, expected {expected}')
 print(f'PASS {path}: {code}')

# Do not follow this legacy redirect: verify its actual status and target.
from urllib.request import build_opener, HTTPRedirectHandler
class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self, *args): return None
try:
 with build_opener(NoRedirect).open('https://careeragency.ch/account.html', timeout=15) as response:
  raise SystemExit(f'FAIL /account.html: {response.status}, expected 308 redirect')
except HTTPError as error:
 if error.code != 308 or error.headers.get('Location') != '/account/login':
  raise SystemExit('FAIL /account.html: unexpected redirect status or target')
print('PASS /account.html: 308 -> /account/login')
