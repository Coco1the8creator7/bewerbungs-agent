"""Real Postgres ownership, conflict, app-gate and durable email tests."""
import os,uuid,unittest,tempfile
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
from fastapi.testclient import TestClient
from authservice import asgi
from auth.security import hash_password
from authservice.outbox import queue_mail,deliver_batch

@unittest.skipUnless(os.getenv('CAREER_AUTH_TEST_DATABASE_URL'),'requires isolated PostgreSQL')
class PrivateStateTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  from cryptography.fernet import Fernet
  os.environ['CAREER_AUTH_DATABASE_URL']=os.environ['CAREER_AUTH_TEST_DATABASE_URL']
  os.environ['CAREER_AUTH_PUBLIC_ORIGIN']='https://testserver'
  os.environ['CAREER_AUTH_TOTP_KEY']=Fernet.generate_key().decode()
  cls.tmp=tempfile.TemporaryDirectory();os.environ['CAREER_APP_ROOT']=cls.tmp.name
  Path(cls.tmp.name,'index.html').write_text('<script src="./github-sync.js"></script><h1>Approved</h1>')
  Path(cls.tmp.name,'storage.js').write_text('/* test */')
  Path(cls.tmp.name,'feedback.json').write_text('{"private":true}')
 @classmethod
 def tearDownClass(cls):cls.tmp.cleanup()
 def connect(self):return psycopg.connect(os.environ['CAREER_AUTH_DATABASE_URL'],row_factory=dict_row)
 def setUp(self):
  with self.connect() as con:
   con.execute('TRUNCATE career_auth.users,career_auth.rate_counters,career_auth.mail_outbox CASCADE')
  self.a,self.aid=self.account('a');self.b,self.bid=self.account('b')
 def account(self,name,status='active'):
  uid=uuid.uuid4()
  with self.connect() as con:
   con.execute("INSERT INTO career_auth.users(id,email,first_name,last_name,residence,password_hash,status,email_verified_at) VALUES(%s,%s,'Test','User','ZH',%s,%s,now())",(uid,name+'@example.com',hash_password('long test password'),status))
  client=TestClient(asgi.app,base_url='https://testserver')
  r=client.post('/api/auth/login',json={'email':name+'@example.com','password':'long test password'},headers={'Origin':'https://testserver'})
  self.assertEqual(r.status_code,200,r.text)
  return client,uid
 def put(self,c,key,data,revision=0):return c.put('/api/user/state/'+key,json={'revision':revision,'data':data},headers={'Origin':'https://testserver'})
 def test_two_accounts_are_isolated_and_conflicts_preserve_data(self):
  self.assertEqual(self.put(self.a,'profile',{'preference':'A'}).status_code,200)
  self.assertEqual(self.b.get('/api/user/state/profile').json(),{'data':None,'revision':0})
  self.assertEqual(self.put(self.b,'profile',{'preference':'B'}).status_code,200)
  self.assertEqual(self.a.get('/api/user/state/profile').json()['data'],{'preference':'A'})
  self.assertEqual(self.put(self.a,'profile',{'stale':'write'}).status_code,409)
  self.assertEqual(self.a.get('/api/user/state/profile').json()['data'],{'preference':'A'})
  bad=self.a.put('/api/user/state/profile',json={'revision':1,'data':{},'user_id':str(self.bid)},headers={'Origin':'https://testserver'})
  self.assertEqual(bad.status_code,422)
 def test_noop_does_not_increment_revision_and_block_revokes_api(self):
  self.assertEqual(self.put(self.a,'swipes',[]).json()['revision'],1)
  self.assertEqual(self.put(self.a,'swipes',[],1).json()['revision'],1)
  with self.connect() as con:con.execute("UPDATE career_auth.users SET status='blocked' WHERE id=%s",(self.aid,))
  self.assertEqual(self.a.get('/api/user/state/swipes').status_code,401)
 def test_direct_assets_require_approved_session_and_data_files_never_serve(self):
  anon=TestClient(asgi.app,base_url='https://testserver')
  for path in ['/app/','/app/storage.js','/app/feedback.json','/api/user/state/workspace']:
   self.assertEqual(anon.get(path).status_code,401,path)
  pending,_=self.account('pending','pending')
  self.assertEqual(pending.get('/app/storage.js').status_code,403)
  self.assertEqual(self.a.get('/app/storage.js').status_code,200)
  self.assertEqual(self.a.get('/app/feedback.json').status_code,404)
  html=self.a.get('/app/').text
  self.assertIn(str(self.aid),html);self.assertNotIn(str(self.bid),html)
 def test_ratings_retry_idempotent_atomic_and_unrelated_records_preserved(self):
  base={'type':'bewerbungs-agent-feedback','schema_version':'1.0.0','annotations':[{'id':'other','note':'private'}]}
  self.assertEqual(self.put(self.a,'feedback',base).status_code,200)
  def rate(score,time):return self.a.patch('/api/user/ratings',json={'relevance_ratings':{'job':{'id':'job','score':score,'updated_at':time}}},headers={'Origin':'https://testserver'})
  self.assertEqual(rate(80,'2026-11-07T12:00:00Z').status_code,200)
  self.assertTrue(rate(80,'2026-11-07T12:00:00Z').json()['unchanged'])
  self.assertEqual(rate(10,'2026-11-07T11:00:00Z').status_code,409)
  data=self.a.get('/api/user/state/feedback').json()['data']
  self.assertEqual(data['annotations'],base['annotations']);self.assertEqual(data['relevance_ratings'][0]['score'],80)
  self.assertIsNone(self.b.get('/api/user/state/feedback').json()['data'])
 def test_database_policy_restricts_a_non_superuser_even_without_owner_where(self):
  self.put(self.a,'profile',{'account':'A'});self.put(self.b,'profile',{'account':'B'})
  with self.connect() as con:
   con.execute('SET LOCAL ROLE career_test_runtime')
   self.assertEqual(con.execute('SELECT count(*) AS n FROM career_private.user_state').fetchone()['n'],0)
   con.execute("SELECT set_config('career.user_id',%s,true)",(str(self.aid),))
   rows=con.execute('SELECT user_id FROM career_private.user_state').fetchall()
   self.assertEqual([r['user_id'] for r in rows],[self.aid])
   with self.assertRaises(psycopg.errors.InsufficientPrivilege):
    con.execute("INSERT INTO career_private.user_state(user_id,key,data) VALUES(%s,'radar','{}')",(self.bid,))
 def test_mail_rollback_retry_and_encrypted_payload(self):
  with self.assertRaises(RuntimeError):
   with self.connect() as con:
    queue_mail(con,'synthetic@example.com','Test','secret token');raise RuntimeError('rollback')
  with self.connect() as con:self.assertEqual(con.execute('SELECT count(*) AS n FROM career_auth.mail_outbox').fetchone()['n'],0)
  with self.connect() as con:queue_mail(con,'synthetic@example.com','Test','secret token')
  with self.connect() as con:self.assertNotIn(b'secret token',bytes(con.execute('SELECT payload FROM career_auth.mail_outbox').fetchone()['payload']))
  def failed(*_):raise OSError('must not appear in logs')
  self.assertEqual(deliver_batch(self.connect,failed),{'sent':0,'failed':1})
  with self.connect() as con:
   self.assertEqual(con.execute('SELECT last_error FROM career_auth.mail_outbox').fetchone()['last_error'],'delivery_failed')
   con.execute('UPDATE career_auth.mail_outbox SET next_attempt_at=now()')
  sent=[]
  self.assertEqual(deliver_batch(self.connect,lambda *data:sent.append(data)),{'sent':1,'failed':0})
  self.assertEqual(len(sent),1)

@unittest.skipUnless(os.getenv('CAREER_AUTH_TEST_DATABASE_URL'),'requires isolated PostgreSQL')
class CrawlerPersistenceTests(unittest.TestCase):
 def test_missing_requires_two_complete_runs_and_failed_scan_preserves_previous_data(self):
  from crawler.production import refresh
  from crawler.tests.test_production import listing,ClientFake
  with psycopg.connect(os.environ['CAREER_AUTH_TEST_DATABASE_URL'],autocommit=True,row_factory=dict_row) as con:
   con.execute('TRUNCATE career_pool.listings,career_pool.runs')
   con.execute("INSERT INTO career_pool.listings(id,source_listing_id,metadata,content_hash) VALUES('old','999','{}','hash')")
   def detail():
    return '<script type="application/ld+json">'+__import__('json').dumps({'@type':'JobPosting','title':'Koch EFZ','url':'https://www.yousty.ch/de-CH/lehrstellen/profile/1-koch','hiringOrganization':{'name':'Synthetic'},'jobLocation':{'address':{'addressLocality':'Zürich','addressRegion':'ZH','addressCountry':'CH'}},'jobStartDate':'2027-08-01'})+'</script>'
   settings={'max_pages':1,'max_details':5}
   refresh(con,settings,ClientFake([listing(1,['1']),detail()]))
   self.assertEqual(con.execute("SELECT missing_count FROM career_pool.listings WHERE id='old'").fetchone()['missing_count'],1)
   refresh(con,settings,ClientFake([listing(2,['1']),detail()]))
   self.assertEqual(con.execute("SELECT missing_count FROM career_pool.listings WHERE id='old'").fetchone()['missing_count'],1)
   refresh(con,settings,ClientFake([listing(1,['1']),detail()]))
   self.assertEqual(con.execute("SELECT status FROM career_pool.listings WHERE id='old'").fetchone()['status'],'unconfirmed')
   with self.assertRaises(ValueError):refresh(con,settings,ClientFake(['no valid data']))
   self.assertEqual(con.execute("SELECT status FROM career_pool.listings WHERE id='old'").fetchone()['status'],'unconfirmed')
   self.assertEqual(con.execute("SELECT count(*) AS n FROM career_pool.runs WHERE status='failed'").fetchone()['n'],1)
