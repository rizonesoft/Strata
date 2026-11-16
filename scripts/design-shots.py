#!/usr/bin/env python3
"""Render every mockup in design/ui to design/ui/reference/<name>.png with headless Edge or Chrome.

These PNGs are the reference the desktop app's screens are compared against (design/CONTRACT.md).

    python scripts/design-shots.py            # every screen, 1440 by 900
    python scripts/design-shots.py timeline   # one screen
"""
import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "design" / "ui"
OUT = UI / "reference"
EXTRA = {"timeline-light": ("timeline.html#light", (1440, 900)), "timeline-narrow": ("timeline.html", (1100, 700))}
CANDIDATES = ["msedge", "chrome", "chromium", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Google\Chrome\Application\chrome.exe"]


def browser():
    for name in CANDIDATES:
        found = shutil.which(name) or (name if Path(name).is_file() else None)
        if found:
            return found
    sys.exit("no Edge or Chrome found: install one, then run this again")


def stop_tree(process):
    """End the browser and every process it started: a headless browser is a tree, and killing its parent alone
    leaves the children running."""
    if os.name == "nt":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)], stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, check=False, creationflags=subprocess.CREATE_NO_WINDOW)
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    process.wait()


def run_bounded(args, timeout):
    """Run a command to its end or to `timeout` seconds, then stop its whole tree. True when it finished by itself."""
    process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               start_new_session=os.name != "nt", creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        process.wait(timeout=timeout)
        return True
    except subprocess.TimeoutExpired:
        return False
    finally:
        if process.poll() is None:
            stop_tree(process)


def shoot(exe, name, page, size, timeout=120):
    target = OUT / f"{name}.png"
    target.unlink(missing_ok=True)
    args = [exe, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
            "--force-device-scale-factor=1", f"--window-size={size[0]},{size[1]}", "--virtual-time-budget=3000",
            f"--screenshot={target}", (UI / page.split("#")[0]).as_uri() + ("#" + page.split("#")[1] if "#" in page else "")]
    run_bounded(args, timeout)
    print(("wrote " if target.is_file() else "FAILED ") + target.relative_to(ROOT).as_posix())
    return target.is_file()


def main():
    OUT.mkdir(exist_ok=True)
    exe = browser()
    version = ""
    if os.name == "nt":  # the parity run warns when the app's WebView2 differs from the engine that drew the references
        version = subprocess.run(["powershell", "-NoProfile", "-Command", f"(Get-Item '{exe}').VersionInfo.ProductVersion"],
                                 capture_output=True, text=True, check=False, creationflags=subprocess.CREATE_NO_WINDOW).stdout.strip()
    (OUT / "RENDERED-WITH.txt").write_text(f"{Path(exe).name} {version}\n1440x900, device scale 1\n", encoding="utf-8")
    shots = {p.stem: (p.name, (1440, 900)) for p in sorted(UI.glob("*.html")) if p.stem != "index"}
    shots.update(EXTRA)
    wanted = sys.argv[1:] or sorted(shots)
    ok = all([shoot(exe, name, *shots[name]) for name in wanted])
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
