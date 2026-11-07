#!/usr/bin/env bash
# Run ONCE on the Infomaniak host after reviewing the PR:
# sudo bash ops/server/bootstrap.sh PUBLIC_SSH_HOST
#
# Creates an unprivileged SSH account with a forced-command key.
# Never paste the private key into a chat, issue, or commit.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077

die() { echo "ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run using sudo."
[[ $# -eq 1 ]] || die "Usage: sudo bash ops/server/bootstrap.sh HOST_OR_IP"
HOST="$1"
[[ "$HOST" =~ ^[a-zA-Z0-9.-]+$ ]] || die "Invalid hostname/IP"
[[ -f /etc/ssh/ssh_host_ed25519_key.pub ]] || die "Missing server Ed25519 SSH host key."
[[ -f "$(dirname "$0")/ca-ops-command" ]] || die "Run from the reviewed repo checkout."

ACCOUNT=careeragency_runner
if ! id "$ACCOUNT" >/dev/null 2>&1; then
  useradd --create-home --user-group --shell /bin/bash --password '!' "$ACCOUNT"
fi
[[ "$(id -u "$ACCOUNT")" != "0" ]] || die "Runner must not be root."
for group in $(id -nG "$ACCOUNT"); do
  case "$group" in sudo|adm|docker|lxd|disk|root) die "Runner has unsafe membership: $group" ;; esac
done

install -o root -g root -m 0755 \
  "$(dirname "$0")/ca-ops-command" /usr/local/bin/careeragency-ops-command

KEY_DIR=/root/.config/careeragency-runner
install -d -o root -g root -m 0700 "$KEY_DIR"
KEY="$KEY_DIR/github_actions_ed25519"
if [[ ! -f "$KEY" ]]; then
  [[ ! -e "$KEY.pub" ]] || die "Orphaned public key. Investigate before continuing."
  ssh-keygen -q -t ed25519 -a 64 -N '' \
    -C careeragency-github-actions -f "$KEY"
  chmod 600 "$KEY"
fi
[[ -f "$KEY.pub" ]] || die "Missing matching public key."

HOME_DIR="$(getent passwd "$ACCOUNT" | cut -d: -f6)"
[[ "$HOME_DIR" == "/home/$ACCOUNT" ]] || die "Unexpected account home directory."
install -d -o "$ACCOUNT" -g "$ACCOUNT" -m 0700 "$HOME_DIR/.ssh"
AUTH="$HOME_DIR/.ssh/authorized_keys"
PUBLIC_KEY="$(cat "$KEY.pub")"
AUTH_LINE="restrict,command=\"/usr/local/bin/careeragency-ops-command\" $PUBLIC_KEY"
if [[ -e "$AUTH" ]]; then
  CURRENT="$(cat "$AUTH")"
  [[ "$CURRENT" == "$AUTH_LINE" ]] || die "Existing authorized_keys differs; refusing to overwrite."
else
  printf '%s\n' "$AUTH_LINE" > "$AUTH"
fi
chown "$ACCOUNT:$ACCOUNT" "$AUTH"
chmod 600 "$AUTH"

echo
echo "Bootstrap configured. No production data or services were changed."
echo "GitHub environment name: careeragency-ops"
echo
echo "Set these THREE environment secrets in GitHub:"
echo "CA_OPS_HOST:"
echo "$HOST"
echo
echo "CA_OPS_KNOWN_HOSTS (public host key, pin verified via the server):"
printf '%s %s\n' "$HOST" "$(cat /etc/ssh/ssh_host_ed25519_key.pub)"
echo
echo "CA_OPS_SSH_PRIVATE_KEY: open the following file LOCALLY and copy"
echo "its COMPLETE contents directly into GitHub's secret editor:"
echo "  sudo cat $KEY"
echo "Never share the private key in ChatGPT or a public issue."
echo
echo "Server host fingerprint:"
ssh-keygen -l -f /etc/ssh/ssh_host_ed25519_key.pub
