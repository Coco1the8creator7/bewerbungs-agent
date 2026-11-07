#!/usr/bin/env bash
# Installed root-owned bridge; only reviewed current-main production operations.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export GIT_TERMINAL_PROMPT=0
umask 077
[[ $EUID == 0 && ${SUDO_USER:-} == careeragency_runner && $# == 2 ]] || exit 77
mode=$1;sha=$2
case "$mode" in plan|lockdown|prepare|activate) ;; *) exit 64 ;; esac
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 64
work=$(mktemp -d /tmp/careeragency-production.XXXXXXXX)
trap 'rm -rf "$work"' EXIT
timeout 120s git clone -q --no-checkout https://github.com/Coco1the8creator7/bewerbungs-agent.git "$work/repo"
[[ $(git -C "$work/repo" rev-parse origin/main) == "$sha" ]] || exit 65
git -C "$work/repo" checkout -q --detach "$sha"
logger -t careeragency-admin "START production=$mode commit=$sha user=$SUDO_USER"
bash "$work/repo/ops/production/apply-production.sh" "$mode"
logger -t careeragency-admin "END production=$mode commit=$sha result=success"
