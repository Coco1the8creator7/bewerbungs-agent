#!/usr/bin/env bash
# One interactive operator bootstrap after the owner merges reviewed code.
set -euo pipefail
[[ $EUID == 0 && $# == 0 ]] || exit 77
here=$(cd "$(dirname "$0")" && pwd -P)
bash "$here/install-production-gateway.sh"
bash "$here/apply-production.sh" lockdown
bash "$here/apply-production.sh" prepare
python3 "$here/configure-auth.py"
python3 "$here/bootstrap-admin.py"
bash "$here/apply-production.sh" activate
