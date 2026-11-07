#!/usr/bin/env bash
# One-time operator-controlled installation; does not modify Caddy, databases or services.
set -euo pipefail
[[ "$EUID" == 0 ]] || { echo "Run with sudo"; exit 77; }
src="$(cd "$(dirname "$0")" && pwd)"
runner=/usr/local/bin/careeragency-ops-command
target=/usr/local/sbin/careeragency-auth-preflight
test -f "$runner"
test -f "$src/auth-preflight.sh"
id careeragency_runner >/dev/null
install -d -o root -g root -m 0700 /var/backups/careeragency-ops
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$runner" "/var/backups/careeragency-ops/forced-command-before-auth-preflight-$stamp"
install -o root -g root -m 0750 "$src/auth-preflight.sh" "$target"
bash -n "$target"
sudoers=/etc/sudoers.d/careeragency-auth-preflight
printf '%s\n' 'careeragency_runner ALL=(root) NOPASSWD: /usr/local/sbin/careeragency-auth-preflight' > "$sudoers"
chmod 0440 "$sudoers"
visudo -cf "$sudoers"
python3 - <<'PY'
from pathlib import Path
p = Path('/usr/local/bin/careeragency-ops-command')
s = p.read_text()
case = '  auth-preflight)\n    exec sudo -n /usr/local/sbin/careeragency-auth-preflight\n    ;;\n'
if case in s:
    print('Gateway command already installed')
else:
    needle = '  *)\n    echo "Denied: SSH command is not on the Career.Agency allowlist."'
    if needle not in s:
        raise SystemExit('Unrecognized gateway format; no changes made')
    candidate = s.replace(needle, case + needle)
    staged = p.with_name(p.name + '.auth-preflight.new')
    staged.write_text(candidate)
    import subprocess
    subprocess.run(['bash','-n',str(staged)],check=True)
    staged.chmod(p.stat().st_mode & 0o777)
    staged.replace(p)
PY
chown root:root "$runner"
chmod 0755 "$runner"
sudo -n -u careeragency_runner env SSH_ORIGINAL_COMMAND=auth-preflight "$runner"
echo "Auth preflight installed; production application and database unchanged."
