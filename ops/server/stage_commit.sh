#!/usr/bin/env bash
# Write a reviewed GitHub commit to a dedicated, persistent server workspace.
# This script is root-owned but runs ONLY as the unprivileged SSH user.
# Never modifies /var/www, /srv/careeragency-landing-feed, /etc, or databases.
set -euo pipefail
export PATH=/usr/bin:/bin
export GIT_TERMINAL_PROMPT=0
umask 077

die() { echo "workspace_stage=denied: $*" >&2; exit 65; }
[[ "$(id -un)" == careeragency_runner ]] || die "wrong operating system user"
[[ $# -eq 1 && "$1" =~ ^[0-9a-f]{40}$ ]] || die "requires full hexadecimal commit SHA"
SHA="$1"

HOME_DIR=/home/careeragency_runner
BASE="$HOME_DIR/careeragency-workspace"
RELEASES="$BASE/releases"
[[ -d "$HOME_DIR" && ! -L "$HOME_DIR" ]] || die "invalid home"
[[ -O "$HOME_DIR" ]] || die "home not owned by runner"
[[ -d "$BASE" && -d "$RELEASES" ]] || die "workspace directories not provisioned"
[[ ! -L "$BASE" && ! -L "$RELEASES" ]] || die "symlinked workspace directory"
[[ -O "$BASE" && -O "$RELEASES" ]] || die "workspace directories not owned by runner"

TARGET="$RELEASES/$SHA"
if [[ -e "$TARGET" || -L "$TARGET" ]]; then
  [[ -d "$TARGET" && ! -L "$TARGET" && -d "$TARGET/.git" ]] ||
    die "existing destination is invalid"
  [[ "$(git -C "$TARGET" rev-parse HEAD)" == "$SHA" ]] ||
    die "existing destination has another commit"
  [[ -z "$(git -C "$TARGET" status --porcelain)" ]] ||
    die "existing snapshot was modified; refuse to overwrite"
  echo "workspace_stage=already_present"
  echo "workspace_commit=$SHA"
  exit 0
fi

# Avoid unbounded accumulation of releases in the small Infomaniak VM.
existing="$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | wc -l)"
(( existing < 10 )) || die "release limit reached; manually review old workspace snapshots"

TMP="$(mktemp -d "$BASE/.stage.XXXXXXXX")"
trap 'rm -rf -- "$TMP"' EXIT

# Fetch from the public project repository only, with no SSH credentials.
timeout 100s git clone --quiet --no-checkout \
  https://github.com/Coco1the8creator7/bewerbungs-agent.git "$TMP/repo"
git -C "$TMP/repo" cat-file -e "$SHA^{commit}" ||
  die "SHA is not an object from the official repository"
if ! git -C "$TMP/repo" branch -r --contains "$SHA" \
    --format='%(refname:short)' | grep -q '^origin/'; then
  die "commit SHA is not reachable from a published repository branch"
fi
timeout 45s git -C "$TMP/repo" checkout --quiet --detach "$SHA"
[[ -f "$TMP/repo/AGENTS.md" ]] || die "repository project guidance missing"
[[ -d "$TMP/repo/dashboard" ]] || die "repository dashboard directory missing"

# Atomic move of ONLY the checked-out repository under the SSH user's home.
mv -- "$TMP/repo" "$TARGET"
[[ "$(git -C "$TARGET" rev-parse HEAD)" == "$SHA" ]] ||
  die "post-install commit mismatch"
[[ -z "$(git -C "$TARGET" status --porcelain)" ]] ||
  die "post-install working tree is not clean"
echo "workspace_stage=written"
echo "workspace_commit=$SHA"
echo "workspace_target=$TARGET"
echo "production_modified=false"
