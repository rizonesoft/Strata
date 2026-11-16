---
schema_version: 1
id: cli
domain: 07-cli
status: active
title: "TODO-01 -- The strata command line"
track: M1
---

# TODO-01 -- The strata command line

> **Goal:** Every command in `design/SPEC.md` part A works as specified: the same arguments, text and `--json` output, exit codes and refusals, so the whole engine can be driven and tested from a terminal or a script.

> **Current state:** Measured 2026-11-16. D00 T01 §2 creates `crates/strata-cli` with a binary that prints its version. No command exists. Sections here are spread across phases 1 to 6 so each milestone ends with a command an examiner can run.

## Inputs

- `design/SPEC.md` part A in full: A1 (rules for every command), A2 (the command table, `case ingest` options, `timeline` and `export` filters) and A3 (refusals and exit codes).
- `docs/plans/2026-11-16-strata-foundation.md` section 3 (`clap` derive, `serde_json`, `anyhow` in binaries) and section 4.2 (no interface code reaches below `strata-engine`, except the read-only image, layer and file system commands that exist before the engine does).
- The engine, case and layer crates from D01 to D06.

## Outcome

- Each of the eighteen commands in SPEC A2 runs against the fixture and its output matches the manifest.
- Every refusal in SPEC A3 produces its message and exit code.
- `--json` output of every command parses as JSON and carries the same facts as the text output.

**Adjacency:** list=applicable @ §6; document=applicable @ §9; settings=not-applicable (the command line takes options per call and stores no settings); reporting=applicable @ §9; notifications=not-applicable (a single user offline tool has no recipients to notify); permissions=applicable @ §1; audit=applicable @ §9; exchange=applicable @ §9; reverse=applicable @ §7

**Adjacency rationale:** The command line stores nothing of its own. Its permission surface is the refusal set of SPEC A3 with the exit codes that §1 defines. The reverse of `bookmark add` is `bookmark remove` in §7; the reverse of `case create` is deleting the case folder, which is the user's own act and is not a command.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | CLI skeleton, global flags, errors and exit codes | D01 T01 §5 | [ ] |
| 2 | §2 | image info and image verify commands | §1, D01 T01 §6 | [ ] |
| 3 | §3 | layers command | §1, D01 T02 §3 | [ ] |
| 4 | §4 | fs ls and fs stat commands | §3, D02 T01 §8, D02 T01 §7, D02 T01 §6 | [ ] |
| 5 | §5 | case create, case info and case ingest commands | §1, D05 T03 §6, D05 T01 §8 | [ ] |
| 6 | §6 | timeline command | §5, D05 T01 §7 | [ ] |
| 7 | §7 | bookmark add, list and remove commands | §5, D05 T01 §6 | [ ] |
| 8 | §8 | history and diff commands | §5, D06 T01 §1, D06 T01 §2 | [ ] |
| 9 | §9 | export, report, audit and fs extract commands | §6, D06 T02 §3, D06 T02 §2 | [ ] |

## 1. CLI skeleton, global flags, errors and exit codes

The rules in SPEC A1 apply to every command, so they are built once: argument parsing, the two output modes, error rendering and the exit code map.

**Phase:** 1
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` A1 and the exit column of A3.
**Job:** Give every command the same flags, the same error shape and predictable exit codes, so scripts can rely on them.
**Treatment:** Plain text to stdout for results, progress and errors to stderr, one JSON document under `--json`.
**Chrome:** `--help` on every level, `--version` on the root, `--json`, `--quiet`, `--verbose`, `--tz`.

**Build order:**

1. Build the parser and output layer in `crates/strata-cli/src`. Done when: `strata --help` lists the command groups.
2. Build the error and exit code map. Done when: each error class exits with its SPEC code.

- [ ] Define the `clap` derive tree in `crates/strata-cli/src/cli.rs` with groups `image`, `layers`, `fs`, `case`, `timeline`, `history`, `diff`, `bookmark`, `export`, `report`, `audit` and global flags `--json`, `--quiet`, `--verbose`, `--tz <IANA>`; commands not yet built are omitted, not stubbed. Done when: `strata --help` and `strata --version` print and exit 0. Cheaper substitute: registering every command now with a "not implemented" body, which ships a command that looks present and is not.
- [ ] Implement `Output` in `crates/strata-cli/src/output.rs` with `result<T: Serialize + TextRender>(&T)` printing text or JSON by mode, and `progress(...)` writing to stderr only when `--verbose` or when stderr is a terminal. Done when: a test runs a sample command both ways and parses the JSON.
- [ ] Implement `exit_code(&anyhow::Error) -> i32` in `crates/strata-cli/src/errors.rs` mapping by downcast: usage 2, `strata_core::Error` evidence classes 3, case store errors 4, `Cancelled` 5, a negative answer 1 (SPEC A1). Done when: a table-driven test covers each class.
- [ ] Render errors as `error: <message>` plus a `hint:` line when the error carries one, and as `{"error": ..., "code": ...}` on stderr under `--json`. Done when: a test for an unreadable image path sees the path and OS error in both modes and exit code 3.
- [ ] Implement time rendering in `crates/strata-cli/src/time.rs`: UTC ISO 8601 by default, the `--tz` zone with its offset otherwise, refusing an unknown zone name with exit 2. Done when: tests cover UTC, `Africa/Johannesburg` and an invalid name.
- [ ] Install a Ctrl+C handler that sets one shared cancel flag and, on a second press, exits at once with code 5. Done when: an integration test sends the signal to a long-running stub command and observes exit code 5.
- [ ] Add the integration test harness `crates/strata-cli/tests/common/mod.rs` that runs the built binary with `assert_cmd`, with a timeout that kills the whole process tree. Done when: a test that runs `strata --version` passes through it.
- [ ] Commit: `cli: skeleton, global flags, errors and exit codes`

**Test checkpoint:** `cargo test -p strata-cli skeleton` passes; the exit code test fails if every error maps to 1.

## 2. image info and image verify commands

The first two commands an examiner runs on new evidence: what is this file, and is it intact.

**Phase:** 1
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` A2 rows `image info` and `image verify`, and A3 rows for a missing image, an unrecognised format and a missing segment.
**Job:** Identify an image and prove its hash matches the one recorded at acquisition.
**Treatment:** `info` prints a short key and value block. `verify` shows a progress line on stderr and ends with the hashes and one word: `match`, `mismatch` or `no stored hash`.
**Chrome:** The global flags only.

**Build order:**

1. Implement `image info` in `crates/strata-cli/src/commands/image.rs`. Done when: both fixtures print their facts.
2. Implement `image verify`. Done when: the three results each give their exit code.

- [ ] Implement `strata image info <image>` printing format, size in bytes and human form, segment files, and stored MD5 and SHA-1 when present. Done when: a test over the fixture E01 finds the manifest's MD5 in the text output and in the `--json` field `stored.md5`.
- [ ] Implement `strata image verify <image>` calling `strata_image::verify` with a progress line (percent, MB per second, time remaining) updated at most four times a second. Done when: the fixture E01 prints `match` and exits 0, and the fixture VHD prints `no stored hash` and exits 0.
- [ ] Exit 1 on `mismatch`, printing both the stored and computed hash. Done when: a test over a scratch E01 with a flipped byte exits 1 or 3 (corrupt chunk) and never prints `match`.
- [ ] Cover the three A3 refusals with tests: a missing path, a file with a `vhdxfile` header, an E01 with its second segment removed. Done when: each prints the facts A3 lists and exits 3.
- [ ] Commit: `cli: image info and image verify`

**Test checkpoint:** `cargo test -p strata-cli image` passes with the fixture built; the mismatch test fails if `verify` exits 0 on a mismatch.

## 3. layers command

One command shows everything Strata can see inside an image, and gives the ids every other command takes.

**Phase:** 1
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` A2 row `layers`.
**Job:** Show the image's structure and the id of each layer.
**Treatment:** An indented tree, one layer per line: id, kind, offset, size, and for a snapshot its creation time.
**Chrome:** The global flags only.

**Build order:**

1. Implement the command in `crates/strata-cli/src/commands/layers.rs`. Done when: the fixture tree prints.
2. Add the provider registry. Done when: the tree is built with the registry's list, so D03 T01 §4 adds snapshots by adding one entry.

- [ ] Implement `strata layers <image>` printing the tree from `strata_volume::tree`, with `--json` emitting nested objects. Done when: a test over the fixture finds `img0` and `img0/p1` with kind `volume` and file system `ntfs`.
- [ ] Add `crates/strata-cli/src/providers.rs` returning the list of `LayerProvider`s this build has, empty for now. Done when: `tree` is called with that list.
- [ ] Print a layer that carries an error (a damaged table, a damaged catalog) with the error on its line, and still print the rest. Done when: a test over a scratch image with a corrupt GPT primary header prints the volume from the backup with a note saying so.
- [ ] Commit: `cli: layers command`

**Test checkpoint:** `cargo test -p strata-cli layers` passes with the fixture built; the test fails if the id column is dropped from the output.

## 4. fs ls and fs stat commands

Browsing a file system from the terminal, in any NTFS layer. Snapshot layers become browsable when D03 T01 §4 registers the shadow copy provider; nothing in this section changes for that.

**Phase:** 2
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` A2 rows `fs ls` and `fs stat`, and A3 rows for an unknown layer, a non-NTFS layer and a path not found.
**Job:** List a directory and inspect one file's record, including deleted files, in a chosen layer.
**Treatment:** `ls` prints a table: name, size, modified, flags (`d` directory, `x` deleted, `c` compressed, `s` has streams). `stat` prints a block: MFT reference, both timestamp sets side by side, streams, data runs.
**Chrome:** `--deleted` on `ls`; the global flags.

**Build order:**

1. Implement layer resolution and `fs ls` in `crates/strata-cli/src/commands/fs.rs`. Done when: a fixture directory lists.
2. Implement `fs stat`. Done when: all eight timestamps print.

- [ ] Implement `resolve_ntfs(image, layer_id) -> NtfsVolume` in `crates/strata-cli/src/commands/fs.rs`: build the tree, find the layer, and refuse an unknown id (exit 2, listing ids) or a layer that is not NTFS (exit 3, naming its kind). Done when: tests cover both refusals.
- [ ] Implement `strata fs ls <image> <layer> [path]` defaulting to the root, sorted by name with directories first. Done when: a test lists `\docs` on `img0/p1` and finds the manifest's names and sizes.
- [ ] Implement `--deleted` adding deleted records for that directory, flagged `x`. Done when: a test finds a manifest deleted file only when the flag is given.
- [ ] Implement `strata fs stat <image> <layer> <path>` printing the MFT reference, the four `$STANDARD_INFORMATION` and four `$FILE_NAME` times, each stream with its size, and the data runs with their image offsets. Done when: a test over the fixture's ADS file finds the `secret` stream and eight timestamps, and `--json` carries the same.
- [ ] Exit 1 for a path not found, naming the deepest part that exists. Done when: a test on `\docs\nope\x.txt` sees `\docs` in the message.
- [ ] Commit: `cli: fs ls and fs stat`

**Test checkpoint:** `cargo test -p strata-cli fs` passes with the fixture built; the deleted test fails if deleted records print without the flag.

## 5. case create, case info and case ingest commands

The three commands that take evidence into a case. `case ingest` is the long one: it shows the stages, can be stopped with Ctrl+C, and can be run again.

**Phase:** 5
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` A2 rows `case create`, `case ingest`, `case info`, the `case ingest` options paragraph, and A3 rows for an existing case, a newer case and moved evidence.
**Job:** Create a case over an image, fill it, and see what it holds.
**Treatment:** `create` prints the case path. `ingest` prints one line per stage as it starts, a live progress line on stderr, warnings as they occur, then a table of counts. `info` prints evidence, hashes, layers, counts by event kind and past runs.
**Chrome:** `--name`, `--examiner`, `--no-verify` on `create`; `--layer`, `--no-snapshots`, `--no-carve`, `--hash-content`, `--threads` on `ingest`; `--image` on any case command to relocate evidence.

**Build order:**

1. Implement `create` and `info` in `crates/strata-cli/src/commands/case.rs`. Done when: a created case reports its evidence.
2. Implement `ingest`. Done when: the fixture ingests end to end from the terminal.

- [ ] Implement `strata case create <dir> --image <image> [--name] [--examiner] [--no-verify]`: open the image, create the case, store evidence (verifying unless `--no-verify`), save the layer tree. Done when: a test creates a case over the fixture E01 and `case info --json` reports `verification: "match"`.
- [ ] Refuse a folder that already holds a case with exit 4. Done when: a second `create` on the same folder exits 4 naming it.
- [ ] Implement `strata case ingest <dir>` mapping its options to `IngestOptions`, printing stage lines from `IngestEvent`s and a final count table (files, deleted files, events by kind, carved records, warnings). Done when: a test over the fixture exits 0 and the counts match the manifest's expectations.
- [ ] Wire Ctrl+C to the ingest cancel flag, exit 5 and print that the case is consistent and the command can be run again. Done when: an integration test cancels during the `files` stage, sees exit 5, then runs `ingest` again to exit 0.
- [ ] Implement `strata case info <dir>` printing the evidence block, layer tree with file and event counts per layer, event counts by kind and the `ingest_runs` table. Done when: a test finds two snapshot layers and a non-zero count for each of the nine event kinds the fixture produces.
- [ ] Implement the global `--image <new path>` on case commands calling `Case::relocate_evidence`, and without it exit 3 naming the recorded path when the image has moved. Done when: a test renames the image, sees exit 3, then succeeds with `--image`, and is refused with a different file.
- [ ] Refuse a case with a newer schema with exit 4 naming both versions. Done when: a test on a scratch case with version 99 sees both numbers.
- [ ] Commit: `cli: case create, case info and case ingest`

**Test checkpoint:** `bosun run -- cargo test -p strata-cli case` passes with the fixture built; the cancel test fails if Ctrl+C kills the process without the engine finishing its transaction.

## 6. timeline command

The timeline query from the terminal, with every filter, in three formats.

**Phase:** 5
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` A2 row `timeline` and the filters paragraph.
**Job:** Ask the case what happened, narrowed by time, kind, layer, path and text.
**Treatment:** A table: id, time, kind, summary, layers, truncated to the terminal width. A final line on stderr gives rows shown and rows matching. The `--format csv` and `--format jsonl` forms are built in §9 on the engine's export writers.
**Chrome:** `--from`, `--to`, `--kind`, `--layer`, `--path`, `--text`, `--bookmarked`, `--limit`, `--offset`; `--format` arrives in §9.

**Build order:**

1. Implement filter parsing in `crates/strata-cli/src/commands/timeline.rs`. Done when: each flag fills its filter field.
2. Implement the table and JSON renderers. Done when: each prints the fixture timeline.

- [ ] Parse `--from` and `--to` as ISO 8601 dates or date-times, read in the `--tz` zone when no offset is given, and refuse `--from` later than `--to` with exit 2. Done when: tests cover a date, a date-time with offset and the refusal.
- [ ] Validate each `--kind` against `EventKind`'s string forms and each `--layer` against the case's layers, listing the valid values on a miss with exit 2. Done when: `--kind file.nope` prints the nine valid kinds.
- [ ] Implement the table renderer with width from the terminal (120 when not a terminal), and the count line on stderr. Done when: a test over the fixture case with `--kind program.run` shows the manifest's prefetch run count.
- [ ] Print the same rows as one JSON array under `--json`, each with every field including `detail` and `provenance`. Done when: the array parses and holds `--limit` objects.
- [ ] Exit 1 when no row matches. Done when: a filter far in the future exits 1 with `0 of N` on stderr.
- [ ] Commit: `cli: timeline command`

**Test checkpoint:** `cargo test -p strata-cli timeline` passes with the fixture built; the kind test fails if an unknown kind is passed to the query unchecked.

## 7. bookmark add, list and remove commands

Bookmarks from the terminal, so a scripted review can mark events and a report can pick them up.

**Phase:** 5
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` A2 rows `bookmark add`, `bookmark list` and `bookmark remove`.
**Job:** Mark an event with a note, see the marks, remove one.
**Treatment:** `add` prints the bookmark id. `list` prints a table: id, event time, kind, summary, note. `remove` prints a confirmation line.
**Chrome:** `--note <text>` on `add`.

**Build order:**

1. Implement the three subcommands in `crates/strata-cli/src/commands/bookmark.rs`. Done when: add, list and remove round-trip.
2. Cover the refusals. Done when: unknown ids exit 1 with the id named.

- [ ] Implement `strata bookmark add <dir> <event-id> [--note]`, printing the existing id when the event is already bookmarked. Done when: a test adds a bookmark to a fixture event and `bookmark list --json` returns it with its note.
- [ ] Implement `strata bookmark list <dir>`, exiting 0 with an empty table when there are none. Done when: a fresh case prints the header and `0 bookmarks`.
- [ ] Implement `strata bookmark remove <dir> <bookmark-id>`. Done when: the bookmark is gone from `list` and the audit log holds `bookmark.remove`.
- [ ] Exit 1 naming the id for an unknown event id on `add` and an unknown bookmark id on `remove`. Done when: both tests pass.
- [ ] Commit: `cli: bookmark commands`

**Test checkpoint:** `cargo test -p strata-cli bookmark` passes with the fixture built; the round-trip test fails if `remove` reports success without deleting.

## 8. history and diff commands

The two cross-layer questions from the terminal.

**Phase:** 6
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` A2 rows `history` and `diff`.
**Job:** Follow one file through time, and see what changed between two layers.
**Treatment:** `history` prints one row per layer: layer, time of the layer, exists, size, modified, hash prefix, changes. `diff` prints three headed groups with counts, each a table of path, size and modified in both layers.
**Chrome:** `--path <glob>`, `--limit` and `--offset` on `diff`.

**Build order:**

1. Implement `history` in `crates/strata-cli/src/commands/history.rs`. Done when: a fixture file's three versions print.
2. Implement `diff` in `crates/strata-cli/src/commands/diff.rs`. Done when: the manifest's sets print.

- [ ] Implement `strata history <dir> <path-or-mft-ref>` accepting a path or `entry-sequence` (for example `1234-2`), printing the rows and, below them, carved records for the same entry. Done when: a test on a manifest file modified between snapshots sees `Modified` on the right row.
- [ ] Implement `strata diff <dir> <layer-a> <layer-b> [--path]` printing counts first, then each group. Done when: a test comparing `img0/p1/vss1` with `img0/p1` finds the manifest's added, removed and modified paths.
- [ ] Exit 2 for an unknown layer id, 4 for a layer not ingested (with the `case ingest --layer` command in the hint), and 1 when `history` finds no such file. Done when: three tests pass.
- [ ] Commit: `cli: history and diff commands`

**Test checkpoint:** `cargo test -p strata-cli history diff` passes with the fixture built; the diff test fails if the two layer arguments are swapped internally.

## 9. export, report, audit and fs extract commands

The commands that write files out of Strata, and the one that prints how everything was done.

**Phase:** 6
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` A2 rows `export`, `report`, `audit` and `fs extract`, A1 (no overwrite without `--force`) and the A3 row for an existing output file.
**Job:** Take the timeline, a report or a file's content out of the case, with a hash for each, and show the audit trail.
**Treatment:** Each writing command shows progress on stderr and ends with the path, bytes or rows, and SHA-256. `audit` prints a table: time, actor, action, result, and parameters under `--verbose`.
**Chrome:** `-o`, `--force`, `--format`, the timeline filters on `export`; `--bookmarked-only`, `--title`, `--no-audit` on `report`; `--stream` on `fs extract`; `--verify` on `audit`.

**Build order:**

1. Implement `export` and `report` in `crates/strata-cli/src/commands/export.rs`. Done when: both write files from the fixture case.
2. Implement `audit` and `fs extract`. Done when: the audit log lists the outputs with matching hashes.

- [ ] Implement `strata export <dir> -o <file> [--format csv|jsonl] [filters]`, defaulting the format from the file extension. Done when: a test exports the fixture timeline and the printed SHA-256 equals a hash of the file.
- [ ] Add `--format table|csv|jsonl` to `strata timeline`, writing CSV and JSONL rows to stdout through the engine's row writers from D06 T02 §1, so `timeline` and `export` cannot drift apart. Done when: `timeline --format jsonl --limit 5` prints five lines that each parse, with the same fields `export` writes.
- [ ] Implement `strata report <dir> -o <file.html> [--bookmarked-only] [--title] [--no-audit]`. Done when: a test with two bookmarks finds both summaries in the file.
- [ ] Implement `strata fs extract <image> <layer> <path> -o <file> [--stream]`, and the case form that takes `<dir>` in place of `<image>` so the extraction is audited. Done when: a test extracts a file from `img0/p1/vss1` and its hash equals the manifest's snapshot 1 value; the case form leaves an `extract.file` audit row.
- [ ] Refuse an existing output without `--force` with exit 2 on all three writing commands. Done when: three tests pass, and with `--force` the file is replaced.
- [ ] Implement `strata audit <dir> [--verify]` printing the log, and with `--verify` running `verify_audit_chain`, exiting 1 and naming the row when the chain is broken. Done when: a test on a scratch case with one edited audit row exits 1 naming that row.
- [ ] Confirm every SPEC A2 command exists by a test that reads the command table from `design/SPEC.md` and runs each with `--help`. Done when: all eighteen exit 0, and the test fails when a row is added to the table with no command.
- [ ] Commit: `cli: export, report, audit and fs extract`

**Test checkpoint:** `cargo test -p strata-cli export report audit extract spec_coverage` passes with the fixture built; the coverage test fails if any SPEC A2 command is missing.

## Verification

- Every SPEC A2 command runs against the fixture case, and every SPEC A3 refusal has a test asserting its message and exit code.
- `bosun run -- cargo test -p strata-cli` passes.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
