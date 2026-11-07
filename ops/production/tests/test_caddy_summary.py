import importlib.util,json,unittest
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'caddy-routing-summary.py'
spec=importlib.util.spec_from_file_location('summary',p);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class CaddySummaryTests(unittest.TestCase):
 def test_routing_preserved_and_credentials_headers_and_bodies_never_exported(self):
  data={'apps':{'http':{'servers':{'srv0':{'routes':[{'match':[{'host':['careeragency.ch']}],'handle':[{'handler':'subroute','routes':[{'match':[{'path':['/jobs.json']}],'handle':[{'handler':'authentication','providers':{'http_basic':{'accounts':[{'username':'PRIVATE_USER','password':'PRIVATE_HASH'}]}}}]}]},{'handler':'static_response','status_code':308,'headers':{'Location':['PRIVATE_URL']},'body':'PRIVATE_BODY'}]}]}}}}}
  output=json.dumps(module.summarize(data))
  for value in ['PRIVATE_USER','PRIVATE_HASH','PRIVATE_URL','PRIVATE_BODY']:self.assertNotIn(value,output)
  for value in ['careeragency.ch','/jobs.json','authentication','308']:self.assertIn(value,output)
 def test_other_matcher_values_are_not_output(self):
  data={'apps':{'http':{'servers':{'srv':{'routes':[{'match':[{'header':{'Authorization':['PRIVATE_TOKEN']}}]}]}}}}}
  output=json.dumps(module.summarize(data));self.assertNotIn('PRIVATE_TOKEN',output);self.assertIn('other_matchers',output)
