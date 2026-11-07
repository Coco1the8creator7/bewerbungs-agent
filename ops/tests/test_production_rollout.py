import importlib.util,tempfile,unittest,subprocess,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('rollout',ROOT/'ops/production/production_rollout.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ProductionRolloutTests(unittest.TestCase):
 def test_caddy_patch_preserves_original_site_and_is_idempotent(self):
  old='other.example {\n respond 200\n}\ncareeragency.ch {\n root * /var/www/careeragency/current\n file_server\n}\n'
  new=module.patch_caddy(old)
  self.assertIn('root * /var/www/careeragency/current',new)
  self.assertIn('other.example {\n respond 200\n}',new)
  self.assertIn('/feedback.json /jobs.json',new)
  self.assertIn('/api/user/*',new)
  self.assertIn('reverse_proxy 127.0.0.1:8765',new)
  self.assertEqual(module.patch_caddy(new),new)
 def test_unknown_routes_and_rewrites_fail_closed(self):
  for old in ['careeragency.ch, www.careeragency.ch {\n}\n','careeragency.ch {\n try_files {path} /index.html\n}\n','careeragency.ch {\n handle /app/* {\n file_server\n }\n}\n']:
   with self.assertRaises(ValueError):module.patch_caddy(old)
 def test_production_commands_reject_injection_before_sudo(self):
  for command in ['production-prepare main','production-activate '+('a'*40)+';id','production-lockdown ../','production-plan '+('a'*39)]:
   p=subprocess.run(['bash',str(ROOT/'ops/server/ca-ops-command')],env={**os.environ,'SSH_ORIGINAL_COMMAND':command},capture_output=True)
   self.assertEqual(p.returncode,64,command)
 def test_rollout_has_no_dossier_mutation_or_secret_output(self):
  script=(ROOT/'ops/production/apply-production.sh').read_text()
  self.assertNotIn('install -m 0644 "$src/dashboard/dossier',script)
  self.assertIn('pg_restore --exit-on-error',script)
  self.assertIn('trap rollback ERR',script)
  self.assertIn('source_approval_missing=true',script)
  self.assertNotIn('set -x',script)
