#!/usr/bin/env bash
# One-time administrator setup for a narrowly constrained landing publisher.
# No website, Caddy, PostgreSQL or feed files are changed during setup.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
die() { echo "publish_setup=failed: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "Must be run with sudo"
[[ $# -eq 0 ]] || die "No arguments permitted"
HERE="$(cd -- "$(dirname "$0")" && pwd -P)"
[[ -f "$HERE/publish_lehrstellen.py" && -f "$HERE/feed_audit.py" && -f "$HERE/ca-ops-command" ]] ||
  die "Missing reviewed release files"
id careeragency_runner >/dev/null || die "Restricted runner missing"
[[ "$(id -u careeragency_runner)" != 0 ]] || die "Unsafe runner UID"
[[ -f /home/careeragency_runner/.ssh/authorized_keys ]] || die "Restricted key missing"
grep -Fq 'restrict,command="/usr/local/bin/careeragency-ops-command"' \
  /home/careeragency_runner/.ssh/authorized_keys || die "Expected forced-command SSH key missing"
[[ "$(stat -c %U:%G /usr/local/bin/careeragency-ops-command)" == root:root ]] ||
  die "Existing forced-command dispatcher not root-owned"
[[ -f /srv/careeragency-landing-feed/jobs.json ]] || die "Verified source feed absent"
[[ -f /var/www/careeragency/current/index.html ]] || die "Live landing absent"

bash -n "$HERE/ca-ops-command"
python3 - "$HERE/publish_lehrstellen.py" "$HERE/feed_audit.py" <<'PY'
import ast, pathlib, sys
for path in sys.argv[1:]:
    ast.parse(pathlib.Path(path).read_text(encoding="utf-8"))
print("publish_setup_python_syntax=valid")
PY

install -d -o root -g root -m 0755 /usr/local/lib/careeragency-ops
install -o root -g root -m 0644 "$HERE/feed_audit.py" \
  /usr/local/lib/careeragency-ops/feed_audit.py
install -o root -g root -m 0755 "$HERE/publish_lehrstellen.py" \
  /usr/local/sbin/careeragency-publish-lehrstellen

# Allow only this argument-free executable, not a shell or arbitrary sudo.
SUDOERS_TMP="$(mktemp /etc/sudoers.d/.careeragency-publisher.XXXXXX)"
trap 'rm -f -- "$SUDOERS_TMP"' EXIT
printf '%s\n' \
  'careeragency_runner ALL=(root) NOPASSWD: /usr/local/sbin/careeragency-publish-lehrstellen' \
  > "$SUDOERS_TMP"
chmod 0440 "$SUDOERS_TMP"
visudo -cf "$SUDOERS_TMP" >/dev/null || die "Invalid restricted sudo policy"
install -o root -g root -m 0440 "$SUDOERS_TMP" \
  /etc/sudoers.d/careeragency-publisher
visudo -cf /etc/sudoers.d/careeragency-publisher >/dev/null ||
  die "Restricted sudo policy verification failed"

# One canonical dispatcher preserves other previously installed SSH commands.
bash "$HERE/install-ops-dispatcher.sh"

echo "publish_setup=installed"
echo "next_operation=CA-OPS: publish-lehrstellen"
echo "production_files_changed=false"
echo "caddy_modified=false"
echo "existing_ui_modified=false"
