"""Exercise the actual installer validator without root or server mutations."""
import subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
INSTALLER=ROOT/'ops/server/install-ops-dispatcher.sh'
WRAPPER=ROOT/'ops/server/ca-ops-command'
def validate(content):
    # Run the installer's exact embedded validator; no installation commands.
    code=INSTALLER.read_text().split('python3 - "$dest" <<\'PY\'\n',1)[1].split('\nPY\n',1)[0]
    with tempfile.TemporaryDirectory() as folder:
        path=Path(folder,'dispatcher');path.write_text(content)
        return subprocess.run(['python3','-',str(path)],input=code,text=True,capture_output=True)
class DispatcherUpgradeTests(unittest.TestCase):
    def test_current_dispatcher_with_nested_release_case_is_accepted(self):
        result=validate(WRAPPER.read_text())
        self.assertEqual(result.returncode,0,result.stderr)
    def test_exact_reported_old_nested_labels_are_not_ssh_actions(self):
        content='''case "${SSH_ORIGINAL_COMMAND:-}" in
  status)
    echo ok
    ;;
  release-check\\ [0-9a-f]*|release-deploy\\ [0-9a-f]*|release-rollback\\ *)
    case "$mode" in
      release-check|release-deploy)
        echo checked
        ;;
      release-rollback)
        echo rollback
        ;;
      *)
        exit 64
        ;;
    esac
    ;;
  *)
    exit 64
    ;;
esac
'''
        result=validate(content)
        self.assertEqual(result.returncode,0,result.stderr)
    def test_unknown_outer_action_is_rejected_at_any_indentation(self):
        for indent in ['', '  ', '      ', '\t']:
            with self.subTest(indent=indent):
                text=WRAPPER.read_text().replace('  status)',indent+'unreviewed-root-command)\n    ;;\n  status)',1)
                result=validate(text)
                self.assertEqual(result.returncode,65)
                self.assertIn('unreviewed-root-command',result.stderr)
    def test_unknown_inline_outer_action_is_rejected(self):
        text=WRAPPER.read_text().replace('  status)','  unreviewed) echo unsafe ;;\n  status)',1)
        result=validate(text)
        self.assertEqual(result.returncode,65)
        self.assertIn('unreviewed',result.stderr)
    def test_missing_default_or_changed_outer_dispatch_fails_closed(self):
        text=WRAPPER.read_text()
        for mutated in [text.rsplit('  *)',1)[0]+'esac\n',text.replace('case "${SSH_ORIGINAL_COMMAND:-}" in','case "$OTHER" in',1)]:
            self.assertEqual(validate(mutated).returncode,65)
