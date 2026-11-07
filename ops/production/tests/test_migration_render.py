"""Capture generated SQL without a DB; catches malformed psql control flow."""
import os,tempfile,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class MigrationRenderTests(unittest.TestCase):
 def test_generated_psql_has_balanced_conditionals_and_no_escape_character(self):
  with tempfile.TemporaryDirectory() as folder:
   # Source the renderer after its root check, using a stub for the single executor.
   # No production SQL is run. Paths and checksums are from this checkout.
   script=(ROOT/'ops/production/migrate-production.sh').read_text()
   script=script.replace('[[ $EUID == 0 && $# -ge 1 && $# -le 2 ]] || exit 64','true')
   capture=Path(folder,'query.sql')
   script=script.replace('runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -v target_db="$db" -d "$db" < "$work" >/dev/null', 'cp "$work" "$MIGRATION_CAPTURE"')
   subprocess.run(['bash','-c',script,'render',str(ROOT)],env={**os.environ,'MIGRATION_CAPTURE':str(capture)},check=True,capture_output=True)
   sql=capture.read_text()
   self.assertNotIn('\x1b',sql)
   controls=[line for line in sql.splitlines() if line.startswith('\\')]
   self.assertEqual(sum(line.startswith('\\if ') for line in controls),controls.count('\\endif'))
   self.assertEqual(controls.count('\\endif'),7)
   self.assertIn('career_pool.listings',sql)
