"""Exercise the actual recovery functions against disposable release directories."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'update-active-runtime.sh'


class ActiveUpdateRollbackTests(unittest.TestCase):
    def test_failure_restores_previous_runtime_and_public_entry(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ('old', 'new', 'backup', 'live'):
                (root / name).mkdir()
            (root / 'auth-current').symlink_to(root / 'new')
            (root / 'backup/index.html').write_text('previous entry')
            (root / 'backup/dossier-studio.html').write_text('previous dossier')
            (root / 'live/index.html').write_text('broken release')
            source = SOURCE.read_text()
            functions = source[source.index('switch_runtime() {'):source.index('trap rollback ERR INT TERM')]
            functions = functions.replace('/opt/careeragency/', folder + '/')
            script = '''set -euo pipefail
systemctl() { printf '%s\\n' "$*" >> "$record"; }
curl() { return 0; }
''' + functions + '\nrollback\n'
            result = subprocess.run(['bash', '-c', script], env={**os.environ,
                'previous': str(root / 'old'), 'backup': str(root / 'backup'),
                'live': str(root / 'live'), 'record': str(root / 'restart')},
                capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertEqual((root / 'auth-current').resolve(), root / 'old')
            self.assertEqual((root / 'live/index.html').read_text(), 'previous entry')
            self.assertEqual((root / 'live/dossier-studio.html').read_text(), 'previous dossier')
            self.assertIn('restart careeragency-auth.service', (root / 'restart').read_text())
            self.assertIn('recovery_status=0', result.stdout)
