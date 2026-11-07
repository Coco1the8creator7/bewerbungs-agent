import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from crawler.production import config,discover,Client,validate_url

def listing(total,ids):
 return '<script type="application/ld+json">'+json.dumps({'@type':'CollectionPage','mainEntity':{'@type':'ItemList','numberOfItems':total,'itemListElement':[{'@type':'ListItem','name':'Koch EFZ','item':f'https://www.yousty.ch/de-CH/lehrstellen/profile/{i}-koch'} for i in ids]}})+'</script>'
class ClientFake:
 def __init__(self,pages):self.pages=iter(pages)
 def get(self,url):return next(self.pages)
class ProductionCrawlerTests(unittest.TestCase):
 def test_disabled_source_refuses_without_network(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder,'source.json');p.write_text('{"enabled":false}')
   with patch('crawler.production.read',side_effect=AssertionError('no network')):
    with self.assertRaises(PermissionError):config(p)
 def test_complete_snapshot_requires_matching_total_and_unique_ids(self):
  rows,complete=discover(ClientFake([listing(3,['1','2']),listing(3,['3'])]),{'max_pages':2})
  self.assertTrue(complete);self.assertEqual(len(rows),3)
  _,complete=discover(ClientFake([listing(3,['1','2'])]),{'max_pages':1})
  self.assertFalse(complete)
  with self.assertRaises(ValueError):discover(ClientFake([listing(3,['1']),listing(3,['1'])]),{'max_pages':2})
 def test_changed_total_rejects_completeness(self):
  with self.assertRaises(ValueError):discover(ClientFake([listing(3,['1']),listing(4,['2'])]),{'max_pages':2})
 def test_cross_origin_urls_and_robots_denial_never_fetch_details(self):
  for url in ['http://www.yousty.ch/a','https://evil.example/a','https://www.yousty.ch@evil.example/a','https://www.yousty.ch:444/a']:
   with self.assertRaises(ValueError):validate_url(url)
  calls=[]
  def reader(url,*args):calls.append(url);return 'User-agent: *\nDisallow: /'
  client=Client(reader=reader,sleeper=lambda _:None)
  with self.assertRaises(PermissionError):client.get('https://www.yousty.ch/de-CH/lehrstellen')
  self.assertEqual(len(calls),1)
