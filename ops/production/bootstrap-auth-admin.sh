#!/usr/bin/env bash
# Launch isolated interactive one-off admin bootstrap; no secret output.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
[[ "$EUID" -eq 0 && $# -eq 0 && -t 0 && -t 1 ]] || exit 64
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
exec python3 "$repo/ops/production/bootstrap-auth-admin-local.py"
