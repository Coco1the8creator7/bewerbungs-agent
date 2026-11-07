import subprocess,tempfile,unittest
from pathlib import Path
SCRIPT=Path(__file__).resolve().parents[1]/'check-runtime-source.sh'
class RuntimeSourceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.repo=Path(self.tmp.name)
  self.git('init','-q');self.git('config','user.name','Synthetic Test');self.git('config','user.email','test@example.invalid')
  self.file('authservice/app.py','approved');self.file('docs/map.md','old');self.baseline=self.commit()
 def tearDown(self):self.tmp.cleanup()
 def git(self,*args):return subprocess.check_output(['git','-C',str(self.repo),*args],text=True).strip()
 def file(self,name,text):
  p=self.repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
 def commit(self):self.git('add','.');self.git('commit','-qm','fixture');return self.git('rev-parse','HEAD')
 def check(self):return subprocess.run(['bash',str(SCRIPT),str(self.repo),self.baseline,self.git('rev-parse','HEAD')],capture_output=True,text=True)
 def test_docs_only_update_is_accepted(self):
  self.file('docs/map.md','verified live state');self.commit()
  result=self.check();self.assertEqual(result.returncode,0,result.stdout)
 def test_changed_backend_is_rejected(self):
  self.file('authservice/app.py','different');self.commit();self.assertEqual(self.check().returncode,65)
 def test_changed_migrations_or_units_are_rejected(self):
  for path in ['db/migrations/006_new.sql','ops/production/careeragency-auth.service','ops/production/careeragency-mail.timer']:
   self.file(path,'changed');self.commit();self.assertEqual(self.check().returncode,65)
 def test_old_or_unknown_current_argument_is_rejected(self):
  self.file('docs/map.md','new');current=self.commit()
  result=subprocess.run(['bash',str(SCRIPT),str(self.repo),current,self.baseline],capture_output=True)
  self.assertEqual(result.returncode,65)
