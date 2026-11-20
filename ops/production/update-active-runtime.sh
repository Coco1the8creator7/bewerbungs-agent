#!/usr/bin/env bash
# Called under apply-production.sh's lock, after current-main and clean-source checks.
set -euo pipefail
[[ $EUID == 0 && $# == 3 ]] || exit 64
src=$1; backup=$2; live=$3
sha=$(git -C "$src" rev-parse HEAD)
previous=$(readlink -e /opt/careeragency/auth-current)
[[ "$previous" =~ ^/opt/careeragency/auth-releases/([a-f0-9]{40})$ ]] || exit 65
old_sha=${BASH_REMATCH[1]}
[[ $(stat -c %u "$previous") == 0 && ! -L "$previous" ]] || exit 65
# This path deliberately supports only code updates with identical schema and units.
git -C "$src" merge-base --is-ancestor "$old_sha" "$sha"
git -C "$src" diff --exit-code "$old_sha" "$sha" -- db/migrations authservice/requirements.txt ':(glob)ops/production/*.service' ':(glob)ops/production/*.timer'
python3 "$src/ops/production/production_rollout.py" env /etc/careeragency/auth.env
printf 'previous_runtime=%s\nnext_runtime_commit=%s\n' "$previous" "$sha"
release=/opt/careeragency/auth-releases/$sha
[[ ! -e "$release" ]] || { echo 'Release exists; inspect before retry'; exit 73; }
install -d -m 0755 "$release"
cp -a "$src/auth" "$src/authservice" "$src/crawler" "$src/dashboard" "$release/"
# Resolve exactly the currently installed dependency versions into a fresh venv.
"$previous/.venv/bin/python" -m pip freeze > "$backup/requirements.lock"
python3 -m venv "$release/.venv"
"$release/.venv/bin/python" -m pip install --disable-pip-version-check -r "$backup/requirements.lock"
"$release/.venv/bin/python" -m pip check
"$release/.venv/bin/python" -m compileall -q "$release/auth" "$release/authservice"
for name in feedback.json jobs.json; do
  if [[ -f "$release/dashboard/$name" ]]; then mv "$release/dashboard/$name" "$backup/source-$name"; fi
done
chown -R root:root "$release"
find "$release" -type d -exec chmod 0755 {} +
find "$release" -type f -exec chmod 0644 {} +
find "$release/.venv/bin" -maxdepth 1 -type f -exec chmod 0755 {} +
cp -p "$live/index.html" "$backup/index.html"
cp -p /etc/careeragency/auth.env "$backup/auth.env"
printf '%s\n' "$previous" > "$backup/previous-auth-link"
# Back up data before test-account creation; the update never migrates schema.
runuser -u postgres -- pg_dump -Fc careeragency_auth > "$backup/auth-before.dump"
pg_restore --list "$backup/auth-before.dump" >/dev/null
for name in dossier-studio.html; do
  [[ ! -L "$live/$name" ]] || exit 65
  if [[ -f "$live/$name" ]]; then cp -p "$live/$name" "$backup/$name"; fi
done
switch_runtime() {
  local target=$1
  ln -s "$target" /opt/careeragency/.auth-update-next
  mv -Tf /opt/careeragency/.auth-update-next /opt/careeragency/auth-current
  systemctl restart careeragency-auth.service
  for attempt in {1..30}; do
    if curl -fsS http://127.0.0.1:8765/healthz >/dev/null; then return; fi
    sleep 1
  done
  return 1
}
rollback() {
  trap - ERR INT TERM
  set +e
  cp -p "$backup/index.html" "$live/.index-update-rollback"
  mv -Tf "$live/.index-update-rollback" "$live/index.html"
  if [[ -f "$backup/dossier-studio.html" ]]; then cp -p "$backup/dossier-studio.html" "$live/dossier-studio.html"; fi
  switch_runtime "$previous"
  recovered=$?
  echo "runtime_update=rolled_back recovery_status=$recovered backup=$backup"
  exit 1
}
trap rollback ERR INT TERM
switch_runtime "$release"
# Probe the actual public TLS endpoints with two temporary, non-admin accounts.
install -m 0644 "$src/ops/production/verify-two-accounts.py" "$release/verify-two-accounts.py"
(cd "$release" && runuser -u postgres -- "$release/.venv/bin/python" "$release/verify-two-accounts.py")
# Publish entry only after the private runtime has passed the ownership checks.
install -m 0644 "$src/dashboard/index.html" "$live/.index-update-next"
mv -Tf "$live/.index-update-next" "$live/index.html"
if [[ -f "$live/dossier-studio.html" ]]; then mv "$live/dossier-studio.html" "$backup/removed-dossier-studio.html"; fi
python3 "$src/ops/production/smoke-production.py"
python3 - "$src" <<'PY'
import hashlib, sys
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
expected = Path(sys.argv[1], 'dashboard/index.html').read_bytes()
for path in ['/', '/index.html']:
    with urlopen('https://careeragency.ch' + path, timeout=20) as response:
        assert response.read() == expected, 'Public entry differs from release'
try:
    urlopen('https://careeragency.ch/dossier-studio.html', timeout=20)
except HTTPError as error:
    assert error.code in (401, 403, 404)
else:
    raise AssertionError('Legacy dossier app remains public')
print('public_entry_sha256=' + hashlib.sha256(expected).hexdigest())
PY
trap - ERR INT TERM
printf 'runtime_update=complete commit=%s backup=%s\n' "$sha" "$backup"
systemctl show careeragency-auth.service --property=MainPID --property=ExecMainStartTimestamp
