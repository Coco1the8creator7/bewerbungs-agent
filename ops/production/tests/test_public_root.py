import importlib.util,os,tempfile,unittest
from pathlib import Path
SRC=Path(__file__).resolve().parents[1]/'public_root.py'
spec=importlib.util.spec_from_file_location('public_root',SRC);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class PublicRootTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.base=Path(self.tmp.name)/'app';self.base.mkdir()
 def tearDown(self):self.tmp.cleanup()
 def resolve(self):return module.resolve_public_root(self.base,{os.getuid()})
 def test_direct_current_directory(self):
  current=self.base/'current';current.mkdir();(current/'index.html').write_text('approved')
  self.assertEqual(self.resolve(),current)
 def test_current_release_symlink_is_pinned(self):
  releases=self.base/'releases';releases.mkdir();release=releases/'legacy-hidden-20261106';release.mkdir();(release/'index.html').write_text('approved')
  (self.base/'current').symlink_to('releases/legacy-hidden-20261106')
  self.assertEqual(self.resolve(),release)
 def test_external_target_is_denied(self):
  (self.base/'releases').mkdir();outside=Path(self.tmp.name)/'outside';outside.mkdir();(outside/'index.html').write_text('bad')
  (self.base/'current').symlink_to(outside)
  with self.assertRaises(ValueError):self.resolve()
 def test_symlinked_asset_is_denied(self):
  current=self.base/'current';current.mkdir();(current/'index.html').write_text('approved');(current/'github-sync.js').symlink_to('/etc/passwd')
  with self.assertRaises(ValueError):self.resolve()
 def test_group_writable_or_untrusted_directory_is_denied(self):
  current=self.base/'current';current.mkdir();(current/'index.html').write_text('approved')
  current.chmod(0o775)
  with self.assertRaises(ValueError):self.resolve()
  current.chmod(0o755)
  with self.assertRaises(ValueError):module.resolve_public_root(self.base,{-1})
