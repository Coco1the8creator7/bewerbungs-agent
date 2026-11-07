"""Offline security regression checks for the bounded server-ops proof of concept."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
WRAPPER = ROOT / "ops/server/ca-ops-command"
BOOTSTRAP = ROOT / "ops/server/bootstrap.sh"
WORKFLOW = ROOT / ".github/workflows/controlled-server-ops.yml"


class ServerOpsSecurityTests(unittest.TestCase):
    def test_shell_syntax(self):
        for script in (WRAPPER, BOOTSTRAP):
            with self.subTest(script=script.name):
                subprocess.run(["bash", "-n", str(script)], check=True)

    def test_dangerous_ssh_commands_denied(self):
        for command in (
            "", "bash", "/bin/sh", "sudo id", "status;id",
            "tests;id", "test", "status\nwhoami", "deploy", "crawler-import",
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
        self.assertIn("github.repository == 'Coco1the8creator7/bewerbungs-agent'", yaml_text)
        self.assertIn("permissions:\n  contents: read", yaml_text)
        self.assertNotIn("pull_request_target:", yaml_text)
        self.assertNotIn("GITHUB_TOKEN:", yaml_text)
        self.assertIn("StrictHostKeyChecking=yes", yaml_text)
        self.assertIn("ssh-keygen -F", yaml_text)
        self.assertIn("environment: careeragency-ops", yaml_text)

    def test_forced_command_without_sudo(self):
        bootstrap = BOOTSTRAP.read_text()
        wrapper = WRAPPER.read_text()
        self.assertIn('AUTH_LINE="restrict,command=', bootstrap)
        self.assertIn("careeragency_runner", bootstrap)
        executable_lines = "\n".join(line for line in wrapper.splitlines()\n                                     if not line.lstrip().startswith("#"))\n        self.assertNotIn("sudo ", executable_lines)
        self.assertNotIn("eval ", wrapper)
        self.assertNotIn("exec $", wrapper)
        self.assertNotIn("workflow_dispatch:", wrapper)
        self.assertNotIn("systemctl reload", wrapper)
        self.assertNotIn("reset --hard", wrapper)


if __name__ == "__main__":
    unittest.main()
