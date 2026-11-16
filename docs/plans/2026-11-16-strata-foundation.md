# Strata foundation plan

Decided 2026-11-16. This is the governing document for architecture, technology and milestones. The interface is in [design/SPEC.md](../../design/SPEC.md). The executable plan is the `todo/` tree, which carries this document out and never restates it.

## 1. What Strata is

Strata is a read-only digital forensics suite for Windows evidence. It opens a disk image and drills through its layers (image, volume, file system, volume shadow copies, unallocated space), then reconstructs one timeline of events. Every event carries its provenance: the chain of layers it was read through and the byte offset in the image.

The differentiator is cross-layer comparison. The same file is followed across the live file system, each shadow copy and carved remnants in unallocated space, so an examiner sees what changed and when.

## 2. Scope of version 1

In scope:

- Dead-box analysis of one disk image per case, on a single examiner workstation, fully offline.
- Images: raw (`.dd`, `.raw`, `.img`), split raw (`.001`, `.002`), fixed VHD, and Expert Witness Format (`.E01` with its segments).
- Partition tables: MBR and GPT. A volume with no partition table is also accepted.
- File system: NTFS, including deleted records, alternate data streams and LZNT1 compressed files.
- Volume shadow copies: every snapshot on an NTFS volume becomes a layer that the NTFS reader opens like a live volume.
- Unallocated space: structured record carving for MFT records, USN records and EVTX chunks.
- Artifacts: MFT timestamps, the USN journal, EVTX event logs, registry key last-write times, prefetch and LNK shortcuts.
- A case store, timeline queries, file history across layers, layer comparison, bookmarks, an audit log, CSV and JSONL export, an HTML report.
- Two interfaces over one engine: the `strata` command line and a desktop app for Windows.

Not in version 1 (each is a limit to state in the user guide, not a hidden gap):

- Live acquisition, memory analysis and any write to evidence.
- BitLocker, VHDX, VMDK, AFF4, and file systems other than NTFS.
- `$LogFile` transaction parsing, registry value interpretation beyond key last-write times, and file carving by content signature.
- Multiple images per case, multiple users on one case, and a server or web deployment.
- macOS and Linux builds of the desktop app. The engine and CLI are written portably and tested on Windows only.

## 3. Technology stack

| Layer | Choice | Reason |
| ----- | ------ | ------ |
| Engine language | Rust, stable toolchain, MSVC target on Windows | Memory safe on hostile input, fast, single binary |
| Raw and split images | Own code in `strata-image` | Trivial formats; own code keeps exact offsets |
| E01 images | `ewf` crate (MIT, pure Rust) | Read plus Seek over E01 with stored hashes |
| Partition tables | Own parsers with `binrw` | Two small documented formats |
| NTFS | `ntfs` crate (MIT or Apache-2.0), read-only | Works over any Read plus Seek source |
| Shadow copies | Own reader in `strata-vss` | Needs block-level provenance; avoids an AGPL dependency |
| Carving | Own carvers, `rayon` for parallel scans, `memchr` for search | Structured records, not file signatures |
| Event logs | `evtx` crate (MIT or Apache-2.0) | Mature EVTX parser |
| Registry | `notatin` crate (Apache-2.0) | Hive parser with recovery of deleted cells |
| Prefetch and LNK | Own parsers with `binrw`, own Xpress Huffman decompressor | Small documented formats |
| Case store | DuckDB through the `duckdb` crate, `bundled` feature | Columnar store for tens of millions of events |
| Hashing | `sha2`, `md-5`, `blake3` | SHA-256 and MD5 for court, BLAKE3 for internal dedupe |
| CLI | `clap` (derive), `serde_json` for `--json` output | Standard, scriptable |
| Errors and logs | `thiserror` in libraries, `anyhow` in binaries, `tracing` | Typed errors where callers branch |
| Desktop shell | Tauri 2 | Calls the Rust engine in-process, small installer |
| Desktop frontend | React, TypeScript, Vite, pnpm | Mainstream, strong virtualised grid support |
| Grid and state | TanStack Table, TanStack Virtual, TanStack Query | Million-row timelines stay responsive |
| Frontend tests | Vitest, Testing Library, Playwright against the built app | Unit plus real rendered checks |
| Installer | Tauri bundler, NSIS target | Per-user install, no admin needed |

Dependency rules:

- Every dependency is pinned by `Cargo.lock` and `pnpm-lock.yaml`, both committed. The exact version of each crate is chosen when its section is built, from the latest release at that time, and recorded by the lock file.
- Only permissive licences (MIT, Apache-2.0, BSD, ISC, Zlib, Unicode) are allowed. `cargo deny check licenses` enforces it. Two near misses decided this rule: the `vshadow` crate moved to AGPL-3.0 at 0.2.0, and `nt-hive` is GPL-2.0-or-later.
- The project's own licence is the owner's decision and is recorded in D09 T01 §4.

## 4. Architecture

### 4.1 The layer model

Everything readable is a `Layer`: a named, sized, read-only, random-access byte source with a parent. A read at an offset in a layer resolves to a read in its parent, down to the image file.

```text
image (raw, split raw, fixed VHD, E01)
  volume (a partition from MBR or GPT, or the whole image)
    file system (NTFS on the live volume)
    snapshot (one per shadow copy; a volume as it was at that time)
      file system (NTFS on the snapshot)
    unallocated (the clusters NTFS marks free on the live volume)
```

Each layer has a stable id that is a path of short segments: `img0`, `img0/p2`, `img0/p2/vss1`. The id is what the CLI, the case store and the app use to name a layer.

Provenance is a value attached to every file record and event: the layer id, the byte offset within that layer, and the resolved byte offset in the image. For a snapshot read, provenance also says whether each block came from the shadow store or from the current volume.

### 4.2 Workspace

One Cargo workspace at the repository root, one pnpm project for the frontend.

| Path | Holds |
| ---- | ----- |
| `crates/strata-core` | `Layer` trait, layer ids, `Provenance`, error types, hashing |
| `crates/strata-image` | Raw, split raw, fixed VHD and E01 readers, format detection |
| `crates/strata-volume` | MBR and GPT parsers, volume layers, the layer tree |
| `crates/strata-ntfs` | NTFS volume, MFT enumeration, content reads, deleted records, bitmap |
| `crates/strata-vss` | Shadow copy catalog, stores and the snapshot layer |
| `crates/strata-carve` | Unallocated run iterator, scan engine, record carvers |
| `crates/strata-artifacts` | Artifact parsers that turn bytes into events |
| `crates/strata-case` | The DuckDB case store: schema, appends, queries, audit log |
| `crates/strata-engine` | Ingest pipeline, file history, layer diff, export, report |
| `crates/strata-cli` | The `strata` binary |
| `crates/strata-testkit` | Test-only: finds the fixture image and loads its manifest |
| `apps/desktop` | Tauri 2 app: `src-tauri` (Rust commands) and `src` (React) |
| `xtask` | Developer tasks: fixture conversion to E01, licence notices |
| `fixtures` | The fixture build script and its manifest schema; built images are not committed |
| `design` | `SPEC.md` and `tokens/` |

Dependencies point one way: `strata-core` at the bottom, then the layer crates, then `strata-artifacts` and `strata-case`, then `strata-engine`, then the two interfaces. No interface code reaches below `strata-engine`.

### 4.3 The case store

A case is a folder holding `case.duckdb` and an `exports` folder. The evidence image is referenced by path and hash and is never copied or modified.

| Table | Holds |
| ----- | ----- |
| `meta` | Schema version, case name, examiner, created time, Strata version |
| `evidence` | Image path, format, size, MD5, SHA-256, stored hash and its verification result |
| `layers` | Layer id, parent id, kind, offset, size, descriptor JSON (for a snapshot: its creation time) |
| `files` | One row per file record per layer: MFT reference, path, sizes, eight timestamps, flags, provenance |
| `events` | One row per distinct event: time, kind, source, summary, detail JSON, dedupe key, provenance |
| `event_layers` | Which layers each event was seen in |
| `bookmarks` | Event id, note, created time |
| `audit_log` | Append-only: time, actor, action, parameters, result |
| `ingest_runs` | One row per ingest: options, stage states, counts, start and end |

Deduplication: an unchanged file in a shadow copy yields the same events as the live volume. Each event has a dedupe key (a BLAKE3 hash of kind, time, source artifact identity and the fields that define it). One `events` row is kept and `event_layers` records every layer it was seen in.

All times are stored as UTC microseconds. Display time zone is a setting.

### 4.4 Integrity rules

- Evidence is opened read-only. No code path opens an image for writing, and a test proves the image hash is unchanged after a full ingest.
- A parser never panics on malformed input. It returns a typed error, the ingest records it against the artifact, and the run continues.
- Every action that reads evidence into the case, exports data or changes a bookmark writes an `audit_log` row.
- Every exported file and extracted file is hashed with SHA-256, and the hash is written to the audit log.

## 5. Test evidence

One fixture image carries the ground truth for integration tests. `fixtures/build-fixture.ps1` builds it on Windows from an elevated prompt: a fixed VHD holding one GPT partition with NTFS, a known set of files, two shadow copies taken between scripted changes, deleted files, and known artifacts at their standard Windows paths. The script writes `fixtures/out/manifest.json` beside the image with every expected fact (paths, sizes, SHA-256 hashes, which files were deleted, each snapshot's time and contents, the expected events).

The image is about 1 GB and is not committed. A test that needs it fails with the build command when it is missing: it never skips silently. Parser unit tests use small byte fixtures committed under each crate's `tests/data`.

## 6. Milestones

Each milestone is a phase of the plan in `todo/plan.json` and ends with something an examiner can run.

| Phase | Milestone | Ends with |
| ----- | --------- | --------- |
| 0 | Repository and tooling | A workspace that builds and a fixture image with its manifest |
| 1 | Evidence access | `strata image info`, `image verify` and `layers` on raw and E01 |
| 2 | NTFS | `strata fs ls` and `fs stat`, including deleted files |
| 3 | Shadow copies | Snapshots listed as layers and browsable with `fs ls` |
| 4 | Unallocated space | Carved MFT, USN and EVTX records from free clusters |
| 5 | Case store and timeline | `strata case ingest` and `strata timeline` over every layer |
| 6 | Cross-layer analysis and reporting | `history`, `diff`, export, extraction and the HTML report |
| 7 | Desktop app | Every screen in `design/SPEC.md` working on the fixture case |
| 8 | Release | An installer, a user guide and an end-to-end acceptance run |
| 99 | Manual, operator only | Code signing |

## 7. Commands that verify the work

```powershell
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo deny check licenses
bosun run -- cargo test --workspace
pnpm --dir apps/desktop lint
pnpm --dir apps/desktop test
python scripts/todo-graph.py validate
```

## 8. Sources

- Windows NT disk structures: Microsoft's NTFS and USN documentation (`USN_RECORD_V2`, `FILE_RECORD_SEGMENT_HEADER`), and `[MS-XCA]` for Xpress Huffman, `[MS-SHLLINK]` for LNK, `[MS-EVEN6]` for the event log model.
- Volume shadow copy on-disk format: Joachim Metz, "Volume Shadow Snapshot (VSS) format", in the libvshadow documentation.
- Expert Witness Format: Joachim Metz, "Expert Witness Compression Format (EWF)", in the libewf documentation.
- Prefetch format: Joachim Metz, "Windows Prefetch File (PF) format", in the libscca documentation.
- GPT: UEFI Specification, chapter 5. MBR: the classic partition table layout at sector 0, bytes 446 to 511.
