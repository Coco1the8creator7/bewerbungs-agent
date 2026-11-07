# SSH command gateway: central source and deployment

## Architecture

- **Only** `ops/server/ca-ops-command` defines the SSH command allowlist.
- **Only** `ops/server/install-ops-dispatcher.sh` may replace
  `/usr/local/bin/careeragency-ops-command`.
- The bootstrap, workspace, crawler publisher, diagnostics, auth preflight, and
  static release installers all invoke that shared installer. Never insert
  command branches into the live dispatcher or copy an older local wrapper over it.
- `authorized_keys` retains `restrict,command="/usr/local/bin/careeragency-ops-command"`.
  The runner never receives unrestricted shell or general-purpose sudo access.
- The shared installer performs syntax and rejection checks, then atomically installs
  the root-owned dispatcher and saves the previous version under
  `/var/backups/careeragency-ops/dispatchers/`.
- A dispatcher update does **not** install optional backends. Their separate
  executables/sudoers must exist for their respective action to succeed.

## Canonical SSH operations

| SSH request | Effective action |
| --- | --- |
| `status`, `tests`, `feed-audit`, `crawler-probe` | Restricted read/diagnostic paths |
| `stage <40-character lowercase SHA>` | Clone reviewed commit into private runner workspace |
| `publish-lehrstellen` | Invoke narrowly scoped privileged feed publisher |
| `release-check` (no argument) | Legacy read-only index.html comparison |
| `auth-preflight` | Invoke read-only privileged auth preflight |
| `release-check <40-character lowercase SHA>` | Privileged static index release validation |
| `release-deploy <40-character lowercase SHA>` | Privileged static index deployment with backup |
| `release-rollback <YYYYMMDDTHHMMSSZ>-<12 lowercase hex>` | Restore earlier static index release |

All unspecified commands and malformed arguments are rejected; no command
string is passed to `bash -c`, `eval`, or an unrestricted `sudo`.

## First rollout after merge

1. Review the installed dispatcher and compare it with the **reviewed, merged**
   canonical file; the server may contain local extensions absent from GitHub.
   An unknown extension must be reviewed and migrated **before** replacement.
2. Run the relevant capability installer from the verified current `main`
   checkout; it now invokes the common dispatcher installer. Alternatively run:
   `sudo bash ops/server/install-ops-dispatcher.sh`.
3. Confirm `dispatcher_install=installed` (or `unchanged`) and save the
   printed `previous_dispatcher_backup` path.
4. Confirm the required actions through the existing GitHub Actions workflows.
   Test read-only diagnostics first; exercise deployment/rollback only with a
   separately approved release plan.

**Rollback of the dispatcher itself** (not an application rollback):

```bash
sudo bash -n /usr/local/bin/careeragency-ops-command
# Replace BACKUP with the exact path printed during installation:
sudo install -o root -g root -m 0755 BACKUP /usr/local/bin/careeragency-ops-command
sudo bash -n /usr/local/bin/careeragency-ops-command
```

The prior file is preserved as a root-only backup. This procedure is not a
server-side deployment, not a Caddy edit, and not a database migration.
Do not merge or run the first rollout until the branch's regression checks pass.
