#!/usr/bin/env bash
# Read-only: permit docs/ops-only commits without silently activating changed app code.
set -euo pipefail
[[ $# == 3 ]] || exit 64
src=$1; staged=$2; current=$3
[[ "$staged" =~ ^[a-f0-9]{40}$ && "$current" =~ ^[a-f0-9]{40}$ ]] || exit 64
[[ $(git -C "$src" rev-parse HEAD) == "$current" ]] || exit 65
git -C "$src" merge-base --is-ancestor "$staged" "$current" || {
 echo 'runtime_source=denied (staged revision is not an ancestor of current main)'; exit 65;
}
if ! git -C "$src" diff --quiet "$staged" "$current" -- auth authservice crawler dashboard db/migrations ':(glob)ops/production/*.service' ':(glob)ops/production/*.timer'; then
 echo 'runtime_source=denied (application, migrations or units changed; prepare current main again)'
 exit 65
fi
printf 'runtime_source=verified staged_commit=%s current_commit=%s\n' "$staged" "$current"
