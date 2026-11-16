---
schema_version: 1
id: release
domain: 09-release
status: active
title: "TODO-01 -- Release: acceptance run, installer, guide and licence"
track: M8
---

# TODO-01 -- Release: acceptance run, installer, guide and licence

> **Goal:** Strata version 1 can be handed to an examiner: one acceptance run proves the plan's acceptance bar end to end in both interfaces, an installer puts the app and the `strata` command on a clean Windows machine, a user guide explains every feature and every limit, and the licence position is recorded.

> **Current state:** Measured 2026-11-16. Nothing exists. Corrected 2026-11-17: the owner chose Apache-2.0, `LICENSE` and `NOTICE` are at the repository root, and the public repository is `rizonesoft/Strata` on GitHub. There is no signing certificate.

## Inputs

- `todo/plan.json`: the acceptance bar this file proves.
- `docs/plans/2026-11-16-strata-foundation.md` section 2 (the limits the guide must state), section 3 (Tauri bundler with the NSIS target, the dependency licence rule) and section 6 (phase 8 and phase 99).
- `design/SPEC.md` parts A and B: the surfaces the guide documents.
- The finished CLI (D07 T01) and desktop app (D08 T01, D08 T02).

## Outcome

- `scripts/acceptance.ps1` runs the acceptance bar on the fixture E01 through the CLI and through the desktop app and exits 0.
- A per-user installer installs the app and puts `strata` on PATH on a machine with no Rust or Node, and uninstalls cleanly.
- `docs/user-guide.md` covers every command and screen and states every version 1 limit.
- `LICENSE` and `THIRD-PARTY-NOTICES.md` exist and match the owner's decision and the dependency tree.

**Adjacency:** all=not-applicable (release packaging and documentation, with no record a user lists, exports or reverses)

**Adjacency rationale:** Installing is reversed by the uninstaller that §2 proves. Nothing here adds a product feature.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | End-to-end acceptance run | D07 T01 §9, D08 T02 §13 | [ ] |
| 2 | §2 | Windows installer with the CLI on PATH | §1 | [ ] |
| 3 | §3 | User guide | §1 | [ ] |
| 4 | §4 | Project licence and third-party notices | D00 T01 §3, D08 T01 §6 | [ ] |
| 5 | §5 | Code signing of the installer and binaries | §2 | [ ] |

## 1. End-to-end acceptance run

The plan's acceptance bar is one sentence. This section turns it into one script that either passes or names what failed, using the real binaries on the fixture.

**Phase:** 8
**Needs:** windows-host, display-session
**Surface:** no

**Build order:**

1. Write the CLI half in `scripts/acceptance.ps1`. Done when: it asserts the acceptance bar from the terminal.
2. Add the desktop half. Done when: the same facts are asserted on the rendered app.

- [ ] Write `scripts/acceptance.ps1` to build release binaries, then run on `fixtures/out/strata-fixture.E01`: `image verify` (expects `match`), `case create`, `case ingest`, and `timeline --json` queries asserting at least one event from the live layer only, one seen in a snapshot only, and one with `detail.carved` true. Done when: the script exits 0 and prints each assertion as it passes.
- [ ] Assert provenance: for three events (one per origin above) read the bytes at the event's image offset straight from the raw fixture VHD with PowerShell and check they hold the expected signature or name. Done when: all three match. Cheaper substitute: asserting only that an offset field is present, which proves nothing about its truth.
- [ ] Run the same case creation on the raw fixture VHD and assert the file, event and layer counts equal the E01 run's. Done when: the counts are equal.
- [ ] Add `apps/desktop/e2e/acceptance.spec.ts`: New case over the fixture E01 in the release build, ingest to completion, then on the Timeline assert the same three events are present, open one's detail pane and read its image offset. Done when: it passes and the script runs it as its second half.
- [ ] Run a size check on something larger than the fixture: build a 20 GB volume with `pwsh fixtures/build-fixture.ps1 -SizeGB 20 -ExtraFiles 1000000 -OutName big` (D00 T01 §4), ingest it, and record wall time and peak memory. Done when: the ingest completes with peak memory under 4 GB and the figures are written into this section as a dated note.
- [ ] Stop every process the script starts, by tree, on exit and on failure. Done when: a forced failure midway leaves no `strata` or app process.
- [ ] Commit: `release: end-to-end acceptance run`

**Test checkpoint:** `bosun run -- pwsh scripts/acceptance.ps1` exits 0 with the fixture built; it fails if the carved-event assertion is given a case ingested with `--no-carve`.

## 2. Windows installer with the CLI on PATH

One installer, per user, no administrator rights, carrying both the app and the command line.

**Phase:** 8
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `docs/plans/2026-11-16-strata-foundation.md` section 3 (Tauri bundler, NSIS target, per-user install).
**Job:** Install Strata on an examiner's workstation in under a minute and remove it without residue.
**Treatment:** The standard NSIS flow: welcome, licence, install location, progress, finish with a Launch option.
**Chrome:** A component checkbox "Add the strata command to PATH", on by default; Start menu shortcut; an entry in Apps and features with an uninstaller.

**Build order:**

1. Configure the bundle in `apps/desktop/src-tauri/tauri.conf.json`. Done when: `tauri build` produces an installer.
2. Prove install and uninstall on a clean machine. Done when: both work in Windows Sandbox.

- [ ] Configure the NSIS target with per-user install mode, the product name, version from the workspace, the app icon from `apps/desktop/src-tauri/icons`, and the embedded WebView2 bootstrapper. Done when: `pnpm --dir apps/desktop tauri build` writes `Strata_0.1.0_x64-setup.exe`.
- [ ] Bundle the release `strata.exe` as a resource and add an NSIS hook in `apps/desktop/src-tauri/nsis/hooks.nsh` that appends the install folder to the user PATH when the component is selected and removes it on uninstall. Done when: after install a new terminal runs `strata --version`.
- [ ] Draw the app icon as an original mark (stacked strata lines) in `design/icon.svg` and generate the icon set with `pnpm tauri icon`. Done when: the installer, the window and the taskbar show it.
- [ ] Write `scripts/sandbox-install.wsb` and `scripts/sandbox-install.ps1` to run the installer silently in Windows Sandbox, launch the app, run `strata --version`, uninstall, and check that the install folder and the PATH entry are gone. Done when: the script reports pass on each step.
- [ ] Record the installer's size and SHA-256 in `docs/releases/0.1.0.md` with the date and the commit. Done when: the file's hash equals a fresh hash of the installer.
- [ ] Commit: `release: Windows installer with the CLI on PATH`

**Test checkpoint:** `bosun run -- pnpm --dir apps/desktop tauri build` produces the installer and `pwsh scripts/sandbox-install.ps1` reports every step passed; the uninstall step fails if the PATH entry is left behind.

## 3. User guide

A person who has never seen Strata should be able to open evidence and reach a finding from this guide alone, and should learn from it exactly what Strata does not do.

**Phase:** 8
**Needs:** none
**Surface:** no

**Build order:**

1. Write `docs/user-guide.md`. Done when: it covers every command and screen.
2. Check it against the product. Done when: every command in it runs and every limit is stated.

- [ ] Write the guide with question-shaped headings: what Strata is, how to install it, how to open an image and verify it, how to read the layer tree, how to browse files and shadow copies, how to ingest, how to read and filter the timeline, how to follow a file's history, how to compare two layers, how to bookmark, export and report, how to read the audit log, and what each setting does. Done when: each heading's answer comes first, in short sentences, with one worked example on the fixture.
- [ ] Add a "What Strata does not do" section listing every item under "Not in version 1" in foundation plan section 2, each with what to use instead where there is a common answer. Done when: a test compares the list in the plan with the headings in this section and finds each one.
- [ ] Add a command reference generated from the binary: `cargo run -p xtask -- cli-docs` writes `docs/cli-reference.md` from `strata --help` of every command. Done when: a test regenerates it and fails when the committed file differs.
- [ ] Add a section on provenance explaining layer ids, image offsets and how to check one by hand with a hex viewer. Done when: the worked example's offset is taken from a real fixture event.
- [ ] Replace the kit's placeholder with a project `README.md` at the repository root: what Strata is in three sentences, install, a five-command quick start, links to the guide, the SPEC and the foundation plan. Done when: the quick start commands run as written on the fixture.
- [ ] Run every command shown in the guide in a test, `crates/strata-cli/tests/guide_commands.rs`, which extracts fenced `powershell` blocks marked `strata` and runs them against the fixture case. Done when: it passes and fails when a command in the guide is misspelt.
- [ ] Commit: `docs: user guide, command reference and README`

**Test checkpoint:** `cargo test -p strata-cli guide_commands` and `cargo test -p xtask cli_docs` pass with the fixture built; the first fails if the guide names a flag the binary does not have.

## 4. Project licence and third-party notices

The owner chose Apache-2.0 on 2026-11-17. The dependency notices follow mechanically from the lock files.

> **Owner decision 2026-11-17:** Strata is licensed under the Apache License, Version 2.0.

**Phase:** 8
**Needs:** none
**Surface:** no

**Build order:**

1. Confirm the licence files match the owner's decision recorded above. Done when: `LICENSE` holds the Apache-2.0 text and every manifest names it.
2. Write the licence and notices files. Done when: both exist and the notices match the lock files.

- [ ] Check `LICENSE` at the repository root is the unmodified Apache-2.0 text and `NOTICE` names Strata and its copyright holder, and set `license = "Apache-2.0"` in the workspace `Cargo.toml` and in `apps/desktop/package.json`. Done when: `cargo metadata` reports `Apache-2.0` for every crate, and a test compares the SHA-256 of `LICENSE` with the published Apache-2.0 text's.
- [ ] Add `cargo run -p xtask -- notices` generating `THIRD-PARTY-NOTICES.md` from `cargo metadata` and `pnpm licenses list --json`: each dependency's name, version, licence and licence text. Done when: a test regenerates it and fails when the committed file differs.
- [ ] Ship the notices in the installer and show them from an About dialog reached from the Settings dialog (version, licence, notices). Done when: an end-to-end test opens About and sees the Strata version and a dependency name.
- [ ] Confirm `cargo deny check licenses` still passes with the final tree and that no dependency's licence conflicts with the chosen one. Done when: the command exits 0 and its summary is quoted in this section.
- [ ] Commit: `release: project licence and third-party notices`

**Test checkpoint:** `cargo test -p xtask notices` and `cargo deny check licenses` pass; the first fails if a dependency is added without regenerating the notices.

## 5. Code signing of the installer and binaries

An unsigned installer is stopped by Windows SmartScreen. Signing needs a certificate that only the operator can obtain and hold.

**Phase:** 99
**Needs:** operator
**Surface:** no

**Build order:**

1. Obtain a code signing certificate and make it available to the build without storing it in the repository. Done when: `signtool` can sign with it on the build machine.
2. Sign and verify. Done when: Windows reports a valid signature on the installer.

- [ ] Obtain an organisation code signing certificate and record where it lives (the vault item's name, never its secret) in `docs/releases/signing.md`. Done when: the file names the item and the certificate's subject and expiry.
- [ ] Configure `bundle.windows.signCommand` in `apps/desktop/src-tauri/tauri.conf.json` to call `signtool` with a timestamp server, reading the certificate from the store by thumbprint. Done when: `pnpm --dir apps/desktop tauri build` signs `strata-desktop.exe`, `strata.exe` and the installer.
- [ ] Verify with `signtool verify /pa /v` on all three files. Done when: each reports a valid chain and timestamp.
- [ ] Commit: `release: sign the installer and binaries`

**Test checkpoint:** `signtool verify /pa Strata_0.1.0_x64-setup.exe` reports success; it fails on an unsigned build.

## Verification

- `pwsh scripts/acceptance.ps1` exits 0 on the fixture, through both interfaces.
- The installer installs, runs and uninstalls cleanly in Windows Sandbox.
- `docs/user-guide.md`, `docs/cli-reference.md`, `README.md`, `LICENSE` and `THIRD-PARTY-NOTICES.md` exist and their tests pass.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
