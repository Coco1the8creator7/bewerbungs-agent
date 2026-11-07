# Career.Agency – controlled server operations from ChatGPT via GitHub

## Goal / decision
The existing connected ChatGPT GitHub app can create repository issues but
currently has NO built-in SSH command executor or GitHub workflow_dispatch
action. We therefore route **exact-title requests from the repository owner's
GitHub identity** through an Actions workflow to a restricted Infomaniak SSH
user. The assistant can request execution and inspect GitHub workflow results,
without the user manually typing every SSH command.

Minimal test version is deliberately limited to two fixed commands:
`CA-OPS: status` and `CA-OPS: tests`. This is an executor, not an open shell,
server agent, full deployment system or persistent ChatGPT Work session.

## 0 – Prerequisites / explicit human acceptance
- Review and merge this PR into `main` **after** examining the workflow,
  bootstrap script and forced SSH wrapper.
- Strongly recommended BEFORE provisioning any secrets: configure GitHub
  Settings > Rules > Rulesets to protect `main` (require pull requests,
  restrict force-push; require checks as appropriate). The repository is
  PUBLIC. Anyone who can modify main/workflow can expose environment secrets
  in their own workflow, so authorisation matters.
- The workflow's `issues` trigger only takes effect when the workflow is
  on the default branch. Merge alone does **not** connect the server.
- Do not add the operations SSH private key to the Git repo, to the ChatGPT
  conversation, public GitHub issues or Actions log.
- Existing SFTP deploy and Career.Agency frontend are NOT touched by this PR.

## 1 – One-time Ubuntu bootstrap (requires your already-working SSH session)

Use a new clone of the reviewed `main`; do not overwrite the ongoing
Yousty POC checkout.

```bash
git clone --depth 1 --branch main \
  https://github.com/Coco1the8creator7/bewerbungs-agent.git \
  /tmp/careeragency-server-ops-bootstrap
cd /tmp/careeragency-server-ops-bootstrap
sudo bash ops/server/bootstrap.sh YOUR_SERVER_HOST_OR_IP
```

This installs only:
- `careeragency_runner`, an unprivileged Linux account without sudo.
- `/usr/local/bin/careeragency-ops-command`, root-owned dispatcher.
- An SSH key with `restrict,command="..."` forced-command restriction.
- An Ed25519 Actions SSH private key, initially stored root-only at
  `/root/.config/careeragency-runner/github_actions_ed25519`.

No Caddy restart, database migration, firewall change, file deletion, sudo
rule, new daemon or background process is performed.

## 2 – GitHub environment and three secrets

Open repository Settings > Environments > New environment:
`careeragency-ops`. For the initial read-only/status/test POC, use no
required reviewer if you want the user-requested automatic execution.
**Never share production/root credentials with this environment.**

Set these three **environment secrets** (NOT repository public variables):
- `CA_OPS_HOST`: exactly the server hostname/IP used for the bootstrap.
- `CA_OPS_KNOWN_HOSTS`: the full public host-key line printed by bootstrap.
- `CA_OPS_SSH_PRIVATE_KEY`: paste the ENTIRE private key content directly
  into GitHub's secret editor. Obtain it locally via:
  `sudo cat /root/.config/careeragency-runner/github_actions_ed25519`.

SSH authenticates with a pinned host key. Verify the printed Ed25519
fingerprint against the SSH host key read locally on the real server.
No blind ssh-keyscan and no disabled host-key verification.

## 3 – Initiate an actual server command

From ChatGPT, request `Career.Agency Serverstatus prüfen`. The assistant can
create a new issue through its connected GitHub tool with exact title
`CA-OPS: status`. The issue must be created by GitHub user ID `343900642`.
That event starts `.github/workflows/controlled-server-ops.yml` on `main`.

Or manually: Actions > Career.Agency - controlled SSH server operations >
Run workflow > operation `status` (or `tests`).

`status` reads the Caddy service state, existence of the current website
index and staged Yousty JSON; no private content is printed.

`tests` makes an isolated, disposable HTTPS clone of
`poc/lehrstellen-crawler-isolated` **as careeragency_runner** and runs the
existing Node.js/Python test suites. It does not modify production files
or connect to PostgreSQL. The code from the public repo is executed under
the dedicated no-sudo account, not `ubuntu` or `root`.

Results are visible in GitHub Actions logs and can be inspected by ChatGPT.
Expected first test: the status workflow completes with
`careeragency_operations=connected`. Do not claim SSH is connected before
this observed result.

## 4 – Future operations / security boundaries

Adding a new operation such as a read-only DB health-check, controlled
Yousty export or approved deployment requires a separately reviewed
**explicit allowlist** entry in BOTH the GitHub workflow and the root-owned
server dispatcher. Do not implement arbitrary `command`, `script`,
`args`, base64 shell payloads, broad `sudo`, GitHub issue body
interpretation, or an unrestricted remote shell.

GitHub issues and Actions logs are **public** in this public repository.
Never pass keys, passwords, user application dossiers or sensitive database
data through titles, bodies, outputs or logs.

Production changes (Caddy/service/restart, DB migration, user records,
releases) need a separate operator, protected environment and manual
approval; do not enable such actions in this initial environment.

Existing deployment `.github/workflows/deploy-infomaniak.yml` still pushes
the frontend automatically from `main`. This PR does not fix that
separate production approval/branch-protection risk.

## Rollback
Disable the new workflow in GitHub Actions, revoke/delete the three
`careeragency-ops` environment secrets, then on the server:

```bash
sudo usermod --expiredate 1 careeragency_runner
sudo rm -f /home/careeragency_runner/.ssh/authorized_keys
sudo rm -f /usr/local/bin/careeragency-ops-command
sudo rm -f /root/.config/careeragency-runner/github_actions_ed25519*
```

Do not remove the account's home automatically; inspect it first.
No frontend or production PostgreSQL changes should require rollback.

## Acceptance
- Static checks pass in GitHub CI for the new branch and PR.
- Human creates the dedicated server account/key and configures secrets.
- Live issue-triggered operation `status` succeeds end-to-end.
- Separate `tests` operation succeeds.
- Unapproved command returns code 64 (negative regression test).
