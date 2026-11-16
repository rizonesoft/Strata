---
schema_version: 1
id: repo-and-toolchain
domain: 00-workspace
status: active
title: "TODO-01 -- Repository, toolchain and fixture image"
track: M0
---

# TODO-01 -- Repository, toolchain and fixture image

> **Goal:** The repository builds as one Cargo workspace with every crate from the foundation plan in place, one set of commands checks it, and a fixture disk image with a manifest of ground truth exists for every later integration test.

> **Current state:** Measured 2026-11-16. The repository holds the Conclave kits (`base`, `todo`, `reviewer`), `docs/plans/2026-11-16-strata-foundation.md`, `design/SPEC.md` and `idea.txt`. There is no source code. `rustc`, `cargo`, `rustup` and the MSVC compiler `cl` are not installed on this machine. Node 24.22.2, pnpm 11.10.0 and Python 3.14.10 are installed.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 3 (technology stack and dependency rules), section 4.2 (workspace layout), section 5 (test evidence) and section 7 (verification commands).
- `AGENTS.md`: the working rules every section follows.

## Outcome

- `cargo build --workspace` and `cargo test --workspace` succeed on a clean checkout.
- `cargo deny check licenses` passes and fails when a crate with a licence outside the allowed list is added.
- `fixtures/out/strata-fixture.vhd` and `fixtures/out/manifest.json` exist after one elevated run of `fixtures/build-fixture.ps1`, and the manifest states every fact later tests assert.

**Adjacency:** all=not-applicable (build tooling and test evidence only, with no record a user lists, exports or reverses)

**Adjacency rationale:** Nothing here is a product feature. The fixture image is rebuilt by running the script again, and the toolchain is removed with `rustup self uninstall`.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | Rust and MSVC toolchain on the workstation | -- | [ ] |
| 2 | §2 | Cargo workspace with every crate skeleton | §1 | [ ] |
| 3 | §3 | Format, lint and licence checks | §2 | [ ] |
| 4 | §4 | Fixture image build script and manifest | §2 | [ ] |
| 5 | §5 | Test kit that loads the fixture and manifest | §4 | [ ] |

## 1. Rust and MSVC toolchain on the workstation

Nothing can compile until Rust and a C++ compiler exist. The `duckdb` crate with its `bundled` feature compiles DuckDB from C++ source, so the MSVC build tools are required, not optional. Their installer raises a UAC prompt, which is why a person must be present.

**Phase:** 0
**Needs:** windows-host, attended
**Surface:** no

**Build order:**

1. Install the toolchains with `winget`. Done when: `rustc --version` and `cl` both run in a new PowerShell session.
2. Pin the toolchain in the repository. Done when: `rustup show` inside the repository names the pinned channel.

- [ ] Install rustup with `winget install Rustlang.Rustup` and the stable MSVC toolchain with `rustup default stable-x86_64-pc-windows-msvc`. Done when: `rustc --version` and `cargo --version` print versions. Cheaper substitute: the GNU toolchain, which cannot link the bundled DuckDB the same way and must not be used.
- [ ] Install the C++ build tools with `winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"`. Done when: `cargo new` plus `cargo build` of a crate depending on `cc` compiles a C file in a scratch folder.
- [ ] Add the components with `rustup component add rustfmt clippy`. Done when: `cargo fmt --version` and `cargo clippy --version` print versions.
- [ ] Write `rust-toolchain.toml` at the repository root naming channel `stable` with components `rustfmt` and `clippy`. Done when: `rustup show active-toolchain` in the repository reports it comes from `rust-toolchain.toml`.
- [ ] Install `cargo-deny` with `cargo install cargo-deny --locked`. Done when: `cargo deny --version` prints a version.
- [ ] Commit: `build: pin the stable Rust toolchain`

**Test checkpoint:** `rustc --version; cargo deny --version` prints two versions in a new PowerShell session; it fails when rustup is not on PATH.

## 2. Cargo workspace with every crate skeleton

The crate boundaries in the foundation plan are the architecture: dependencies point one way and no interface code reaches below the engine. Creating every crate now, empty, makes each later section a change inside one named crate.

**Phase:** 0
**Needs:** none
**Surface:** no

**Build order:**

1. Create the workspace manifest and the crates. Done when: `cargo metadata` lists all twelve members.
2. Prove the one-way dependency rule. Done when: the test in `xtask` fails when a lower crate depends on a higher one.

- [ ] Write the root `Cargo.toml` with `[workspace]`, `resolver = "2"`, members `crates/*` and `xtask`, and `[workspace.package]` (edition 2021, version 0.1.0) plus `[workspace.dependencies]` for shared crates (foundation plan section 4.2). Done when: `cargo metadata --no-deps --format-version 1` exits 0.
- [ ] Create library crates `strata-core`, `strata-image`, `strata-volume`, `strata-ntfs`, `strata-vss`, `strata-carve`, `strata-artifacts`, `strata-case`, `strata-engine` and `strata-testkit` under `crates/`, each with `src/lib.rs` holding one crate-level doc comment that states its responsibility from the plan's table. Done when: `cargo build --workspace` succeeds.
- [ ] Create the binary crate `crates/strata-cli` with `[[bin]] name = "strata"` and a `main` that prints the version. Done when: `cargo run -p strata-cli` prints `strata 0.1.0`.
- [ ] Create `xtask` as a binary crate with a `layering` subcommand that reads `cargo metadata` and fails when a crate depends on one above it in the order core, image, volume, ntfs, vss, carve, artifacts, case, engine, cli. Done when: `cargo run -p xtask -- layering` exits 0, and exits 1 after `strata-core` is given a temporary dependency on `strata-engine` in a scratch copy.
- [ ] Extend the existing `.gitignore` with `/target`, `/fixtures/out`, `node_modules` and `/apps/desktop/dist`. Done when: `git status --short` shows no file under `target`.
- [ ] Commit `Cargo.lock`. Done when: `git ls-files Cargo.lock` prints the path.
- [ ] Commit: `build: Cargo workspace with the crate skeletons`

**Test checkpoint:** `cargo build --workspace` succeeds and `cargo run -p xtask -- layering` exits 0; the second fails when a lower crate depends on a higher one.

## 3. Format, lint and licence checks

One command set decides whether the tree is clean. The licence check exists because two crates considered for this stack are copyleft (`vshadow` 0.2.0 is AGPL-3.0, `nt-hive` is GPL-2.0-or-later), and a transitive dependency could bring one in unseen.

**Phase:** 0
**Needs:** none
**Surface:** no

**Build order:**

1. Configure the three checks. Done when: each passes on the skeleton workspace.
2. Record the commands. Done when: `AGENTS.md` lists them under a verification heading.

- [ ] Write `deny.toml` with `[licenses] allow` listing MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Zlib and Unicode-3.0, and nothing copyleft (foundation plan section 3). Done when: `cargo deny check licenses` exits 0. Cheaper substitute: a `README` note asking people to check licences, which fails nothing.
- [ ] Prove the licence check can fail by adding `nt-hive` to `strata-core` in a scratch copy of the tree. Done when: `cargo deny check licenses` exits non-zero naming GPL-2.0-or-later, and the repository itself is unchanged.
- [ ] Add `[workspace.lints]` to the root `Cargo.toml` with `unsafe_code = "forbid"` for rust and `unwrap_used = "deny"` and `panic = "deny"` for clippy, and `[lints] workspace = true` in every crate (foundation plan section 4.4: a parser never panics). Write `clippy.toml` with `allow-unwrap-in-tests = true` and `allow-panic-in-tests = true`, and allow `panic` in `strata-testkit` alone, whose locators panic on purpose. Done when: `cargo clippy --workspace --all-targets -- -D warnings` exits 0, and a temporary `.unwrap()` in `strata-core` library code makes it fail.
- [ ] Write `rustfmt.toml` with `max_width = 110`. Done when: `cargo fmt --all --check` exits 0.
- [ ] Add a `## Verification commands` section to `AGENTS.md` listing the commands of foundation plan section 7 and where the code lives. Done when: the section names `cargo fmt`, `cargo clippy`, `cargo deny` and `cargo test` with their exact arguments.
- [ ] Commit: `build: format, lint and licence checks`

**Test checkpoint:** `cargo fmt --all --check; cargo clippy --workspace --all-targets -- -D warnings; cargo deny check licenses` all exit 0; an `.unwrap()` in library code makes the second fail.

## 4. Fixture image build script and manifest

Integration tests need one image whose every fact is known: which files exist, which were deleted, what each shadow copy held. Building it by script from an elevated prompt makes the ground truth reproducible. The image is about 1 GB because Windows will not create a shadow copy on a much smaller volume, so it is built locally and never committed.

**Phase:** 0
**Needs:** windows-host, attended
**Surface:** no

**Build order:**

1. Write the script that builds the VHD and the manifest. Done when: one elevated run leaves both files in `fixtures/out`.
2. Convert the image to E01 as a second fixture. Done when: `fixtures/out/strata-fixture.E01` exists and its stored hash equals the VHD content hash.

- [ ] Write `fixtures/build-fixture.ps1` to create a 1 GB fixed VHD at `fixtures/out/strata-fixture.vhd` with `New-VHD -Fixed`, mount it, initialise it GPT, create one partition and format it NTFS with label `STRATAFIX` (foundation plan section 5). Done when: the script refuses with a clear message when not elevated, and otherwise the mounted volume appears in `Get-Volume`.
- [ ] Add stage one to the script: write a fixed tree under `\docs`, `\data` and `\Users\fixture` (20 text files with known content, one 5 MB binary of a seeded pattern, one file with an alternate data stream `secret`, one NTFS-compressed file made with `compact /c`), recording each path, size and SHA-256. Done when: the manifest's `files` array lists every one.
- [ ] Add the known artifacts at standard paths: a registry hive saved with `reg save` from a key the script creates and populates, written to `\Windows\System32\config\SOFTWARE`; an event log exported with `wevtutil epl` filtered to events the script wrote with source `StrataFixture`, written to `\Windows\System32\winevt\Logs\Application.evtx`; one LNK made through `WScript.Shell` under `\Users\fixture\Desktop`; one `.pf` file copied from `C:\Windows\Prefetch` to `\Windows\Prefetch`. Done when: the manifest's `artifacts` object records each path with its expected event count and one sample event.
- [ ] Add the snapshot stages: create shadow copy 1 with `Invoke-CimMethod -ClassName Win32_ShadowCopy -MethodName Create`, then modify three files, delete two and add two; create shadow copy 2, then delete three more files and overwrite one. Done when: the manifest's `snapshots` array holds each snapshot's id, creation time and the full expected file list with hashes as of that moment.
- [ ] Add the finish stage: record under `deleted` the three files deleted after shadow copy 2 (the script creates no file after them, so their MFT records are not reused), record the volume facts under `volume` (`cluster_size`, `serial` and `free_clusters`, from `fsutil fsinfo ntfsinfo` and `Get-Volume`), enable and query the USN journal with `fsutil usn` so `usn_expected` holds the reasons expected per path, dismount the VHD, and write `fixtures/out/manifest.json` with a `schema` number and the MD5 and SHA-256 of the VHD content without its 512-byte footer (`image_md5`, `image_sha256`). Done when: a second run of the script rebuilds both files without manual cleanup.
- [ ] Write `fixtures/manifest.schema.json` describing the manifest, and validate against it at the end of the script with `Test-Json`. Done when: removing a required key from a scratch copy of the manifest makes `Test-Json` fail.
- [ ] Add an `e01` subcommand to `xtask` that writes `fixtures/out/strata-fixture.E01` from the VHD content using the `ewf-image` crate as a dev-only dependency, storing the MD5 in the image. Done when: the file opens with the `ewf` crate in a test and its stored MD5 equals the MD5 of the VHD content. Cheaper substitute: FTK Imager by hand, which no one can rerun from the repository.
- [ ] Give the script `-SizeGB` (default 1) and `-ExtraFiles` (default 0, writes that many small seeded files under `\bulk`) parameters and an `-OutName` so a larger image never replaces the fixture; the manifest is written only for the default fixture. Done when: `-SizeGB 2 -ExtraFiles 1000 -OutName big` writes `fixtures/out/big.vhd` and leaves `strata-fixture.vhd` and its manifest untouched.
- [ ] Write `fixtures/README.md` with the two commands to build both fixtures and what the manifest holds. Done when: following it on a clean checkout produces both files.
- [ ] Commit: `fixtures: script that builds the fixture image and its manifest`

**Test checkpoint:** `pwsh fixtures/build-fixture.ps1; cargo run -p xtask -- e01` from an elevated prompt leaves the VHD, the E01 and a manifest that passes `Test-Json -SchemaFile fixtures/manifest.schema.json`; run without elevation, the script exits 1 with a message naming elevation.

## 5. Test kit that loads the fixture and manifest

Every integration test asks the same two questions: where is the fixture, and what should be in it. One test-only crate answers both, and fails loudly with the build command when the fixture is missing, so a test never passes by skipping.

**Phase:** 0
**Needs:** none
**Surface:** no

**Build order:**

1. Model the manifest in `crates/strata-testkit`. Done when: the real manifest deserialises into typed structs.
2. Add the locator. Done when: a missing fixture panics with the build command in the message.

- [ ] Define `Manifest`, `FixtureFile`, `Snapshot` and `ArtifactExpectation` in `crates/strata-testkit/src/manifest.rs` with `serde`, matching `fixtures/manifest.schema.json`. Done when: a unit test deserialises a small sample manifest committed at `crates/strata-testkit/tests/data/manifest-sample.json`.
- [ ] Add `fixture_vhd()`, `fixture_e01()` and `manifest()` to `crates/strata-testkit/src/lib.rs`, resolving `fixtures/out` from `CARGO_MANIFEST_DIR`. Done when: with the fixture built, a test reads the manifest and asserts `files` is not empty.
- [ ] Make each locator panic with `fixture missing: run pwsh fixtures/build-fixture.ps1 from an elevated prompt` when its file is absent. Done when: a test that renames nothing but points the locator at an empty folder asserts the panic message. Cheaper substitute: returning `None` and letting tests skip, which hides every later failure.
- [ ] Commit: `testkit: fixture locator and manifest model`

**Test checkpoint:** `cargo test -p strata-testkit` passes with the fixture built; its missing-fixture test fails if the locator is changed to return without panicking.

## Verification

- A clean checkout builds with `cargo build --workspace` and passes `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings` and `cargo deny check licenses`.
- `fixtures/out/strata-fixture.vhd`, `fixtures/out/strata-fixture.E01` and `fixtures/out/manifest.json` exist and the manifest validates against its schema.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
