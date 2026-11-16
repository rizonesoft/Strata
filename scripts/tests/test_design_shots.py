"""scripts/design-shots.py stops the whole browser tree when a render runs past its time."""
import importlib.util
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "design-shots.py"
spec = importlib.util.spec_from_file_location("design_shots", SCRIPT)
design_shots = importlib.util.module_from_spec(spec)
spec.loader.exec_module(design_shots)

# A stand-in browser: it starts a child, records the child's pid, and both sleep. Each is bounded at 60 seconds.
PARENT = """
import subprocess, sys, time
child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
open(sys.argv[1], "w").write(str(child.pid))
time.sleep(60)
"""


def alive(pid):
    if sys.platform == "win32":
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True,
                             creationflags=subprocess.CREATE_NO_WINDOW).stdout
        return str(pid) in out
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


class RunBoundedTests(unittest.TestCase):
    def test_timeout_stops_the_child_too(self):
        with tempfile.TemporaryDirectory() as folder:
            pid_file = Path(folder) / "child.pid"
            finished = design_shots.run_bounded([sys.executable, "-c", PARENT, str(pid_file)], timeout=5)
            self.assertFalse(finished)
            self.assertTrue(pid_file.is_file(), "the stand-in never started its child")
            child = int(pid_file.read_text())
            for _ in range(20):
                if not alive(child):
                    break
                time.sleep(0.25)
            self.assertFalse(alive(child), "the child outlived the timeout")

    def test_a_quick_command_finishes(self):
        self.assertTrue(design_shots.run_bounded([sys.executable, "-c", "pass"], timeout=30))


if __name__ == "__main__":
    unittest.main()
