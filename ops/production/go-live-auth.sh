#!/usr/bin/env bash
# Canonical compatibility entry for the now consolidated non-dossier rollout.
set -euo pipefail
[[ $EUID == 0 && $# == 1 && "$1" =~ ^[a-f0-9]{40}$ && -t 0 && -t 1 ]] || exit 64
repo=$(cd "$(dirname "$0")/../.." && pwd -P)
[[ $(git -C "$repo" rev-parse HEAD) == "$1" ]] || exit 65
exec bash "$repo/ops/production/owner-setup.sh"
