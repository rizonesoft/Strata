"""scripts/start-run.ps1 carries every operator option across its restart as administrator (dry run only)."""
import base64
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "start-run.ps1"
PWSH = shutil.which("pwsh")
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def dry_run(*args):
    return subprocess.run([PWSH, "-NoLogo", "-NoProfile", "-File", str(SCRIPT), "-DryRun", *args], capture_output=True,
                          text=True, timeout=120, creationflags=NO_WINDOW).stdout


@unittest.skipUnless(PWSH and sys.platform == "win32", "the launcher is a Windows PowerShell 7 script")
class ElevationArgumentTests(unittest.TestCase):
    def test_custom_goal_guard_and_env_key_survive(self):
        out = dry_run("-Goal", "Process phase 0 only", "-GuardFile", r"R:\scratch\guard.json", "-UserEnvKey", r"HKCU:\Other")
        import ctypes
        if ctypes.windll.shell32.IsUserAnAdmin():
            self.skipTest("this session is already elevated, so the launcher does not restart")
        line = next((x for x in out.splitlines() if x.startswith("would restart elevated:")), None)
        self.assertIsNotNone(line, "a standard-user dry run must show the elevated restart and its arguments")
        self.assertIn(base64.b64encode("Process phase 0 only".encode()).decode(), line)
        self.assertIn(r"R:\scratch\guard.json", line)
        self.assertIn(r"HKCU:\Other", line)

    def test_default_start_names_no_goal(self):
        out = dry_run()
        for line in out.splitlines():
            if line.startswith("would restart elevated:"):
                self.assertNotIn("-GoalBase64", line)
        self.assertIn("/goal Finish the Strata implementation plan", out)


if __name__ == "__main__":
    unittest.main()
