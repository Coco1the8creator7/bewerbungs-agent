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
WORKFLOW = ROOT / ".github/workflows/controlled-server-ops.yml"


class ServerOpsSecurityTests(unittest.TestCase):
    def test_shell_syntax(self):
        for script in (WRAPPER, BOOTSTRAP, UPGRADE, ENABLE_WRITE, STAGE_SCRIPT):
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
        ):
            with self.subTest(command=command):
                proc = subprocess.run(
                    ["bash", str(WRAPPER)],
                    env={**os.environ, "SSH_ORIGINAL_COMMAND": command},
                    text=True, capture_output=True, timeout=5,
                )
                self.assertEqual(proc.returncode, 64)
                self.assertIn("Denied", proc.stderr)

    def test_issue_titles_and_actor_are_hard_coded(self):
        yaml_text = WORKFLOW.read_text()
        self.assertIn("github.event.issue.user.id == 343900642", yaml_text)
        self.assertIn("github.event.issue.title == 'CA-OPS: status'", yaml_text)
        self.assertIn("github.event.issue.title == 'CA-OPS: tests'", yaml_text)
        for operation in ("feed-audit", "crawler-probe", "release-check"):
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
        self.assertNotIn("sudo ", "\\n".join(line for line in wrapper.splitlines()
                                           if not line.lstrip().startswith("#")))


if __name__ == "__main__":
    unittest.main()
