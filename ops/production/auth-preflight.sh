#!/usr/bin/env bash
# Read-only preflight. No secrets, credentials, personal data or configuration contents.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
[[ "$EUID" == 0 && "${SUDO_USER:-}" == careeragency_runner ]] || exit 77

state() { printf '%s=%s\n' "$1" "$2"; }
state audit_time_utc "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
state auth_backend_service "$(systemctl is-active careeragency-auth.service 2>/dev/null || true)"
state auth_backend_unit_present "$([[ -f /etc/systemd/system/careeragency-auth.service ]] && echo yes || echo no)"
state auth_directory_present "$([[ -d /opt/careeragency/authservice ]] && echo yes || echo no)"
state postgres_active "$(systemctl is-active postgresql 2>/dev/null || true)"
state pg_dump_present "$(command -v pg_dump >/dev/null && echo yes || echo no)"
state python3_present "$(command -v python3 >/dev/null && echo yes || echo no)"
state caddy_active "$(systemctl is-active caddy 2>/dev/null || true)"
state caddy_config_present "$([[ -f /etc/caddy/Caddyfile ]] && echo yes || echo no)"
if [[ -r /etc/caddy/Caddyfile ]]; then
  for route in '/api/auth/' '/api/admin/' '/account/' '/admin' '/app/'; do
    label="$(printf '%s' "$route" | tr -cd '[:alpha:]')"
    if grep -Fq -- "$route" /etc/caddy/Caddyfile; then
      state "caddy_route_${label}_mentioned" yes
    else
      state "caddy_route_${label}_mentioned" no
    fi
  done
fi
state env_file_present "$([[ -f /etc/careeragency/auth.env ]] && echo yes || echo no)"
state backup_root_present "$([[ -d /var/backups/careeragency-ops ]] && echo yes || echo no)"
state backup_free_kb "$(df -Pk /var/backups/careeragency-ops 2>/dev/null | awk 'NR==2{print $4}')"
if command -v psql >/dev/null && id postgres >/dev/null 2>&1; then
  # Existence checks only; never report database names or row contents.
  if sudo -n -u postgres psql -XAtqc 'SELECT 1' postgres >/dev/null 2>&1; then
    state postgres_local_admin yes
  else
    state postgres_local_admin no
  fi
else
  state postgres_local_admin no
fi
state result inspection_only
