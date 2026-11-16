---
schema_version: 1
id: cross-layer
domain: 06-analysis
status: active
title: "TODO-01 -- Cross-layer analysis: history, comparison and view queries"
track: M6
---

# TODO-01 -- Cross-layer analysis: history, comparison and view queries

> **Goal:** An examiner can follow one file across the live volume, every shadow copy and carved remnants and see what changed between each, and can compare any two layers to list what was added, removed and modified.

> **Current state:** Measured 2026-11-16. Nothing exists. D05 T03 fills the `files` table with one row per file record per layer, which is all this file reads.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 1 (cross-layer comparison is the differentiator) and section 4.3 (`files`, `layers`).
- `design/SPEC.md` A2 (`history`, `diff`), B10 (History) and B11 (Compare): the columns and groupings these functions must return.
- `Case::files_by_path`, `files_by_ref` and `layers` from D05 T01 §2 and §3.

## Outcome

- History for a fixture file modified between the snapshots returns one row per layer in time order, each flagged with what changed from the row before, matching the manifest.
- Comparing snapshot 1 with the live layer returns exactly the manifest's added, removed and modified sets.
- The queries behind the Deleted files, Recent activity, Overview and Disk map views return what the manifest predicts.

**Adjacency:** list=applicable @ §1; document=applicable @ D06 T02 §3; settings=not-applicable (the analysis has no tunable and takes its inputs as arguments); reporting=applicable @ §5; notifications=not-applicable (a single user offline tool has no recipients to notify); permissions=not-applicable (one examiner per case with no roles in version 1); audit=applicable @ §6; exchange=not-applicable (results are exported through the timeline export and the report); reverse=not-applicable (read-only queries create no record to undo)

**Adjacency rationale:** Both functions are pure reads. Their output reaches a document through the HTML report and reaches the screen through the History and Compare views.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | File history across layers | D05 T03 §5 | [ ] |
| 2 | §2 | Layer comparison | D05 T03 §5 | [ ] |
| 3 | §3 | Deleted files query and summaries | D05 T03 §7 | [ ] |
| 4 | §4 | Recent activity by day | D05 T03 §5 | [ ] |
| 5 | §5 | Overview aggregates | D05 T03 §5 | [ ] |
| 6 | §6 | Disk map queries and raw region reads | D05 T03 §8 | [ ] |

## 1. File history across layers

The same file is identified across layers by its MFT entry and sequence number, which survive a rename, and falls back to its path when the reference was reused.

**Phase:** 6
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the query in `crates/strata-engine/src/history.rs`. Done when: versions come back in layer time order.
2. Compute the differences. Done when: each row says what changed.

- [ ] Implement `history(case, FileSelector::Path(p) | FileSelector::Ref(entry, sequence)) -> FileHistory` resolving a path to its reference in the newest layer that has it, then collecting the `files` row for that reference from every layer, ordered oldest snapshot first and live last. Done when: a test over the fixture case returns three rows for a file present throughout.
- [ ] Add a row with `exists = false` for a layer where the file is absent or the reference belongs to a different file (sequence mismatch), so gaps are visible. Done when: a file created after snapshot 1 shows `exists = false` for `vss1`.
- [ ] Compute `changes: Vec<Change>` per row against the previous row: `Created`, `Deleted`, `Renamed { from }`, `Resized { from, to }`, `Modified` (any `si` or `fn` time differs), `ContentChanged` (hashes differ, only when both are stored). Done when: a test asserts the changes for the manifest's modified, renamed and deleted files.
- [ ] Attach carved records with the same MFT entry as `carved: Vec<FileRow>`, listed apart because their place in time is not known (SPEC B10). Done when: a test with a synthetic carved row for the entry returns it there.
- [ ] Return `NotFound` naming the selector when no layer holds the file. Done when: a test with an unknown path gets it.
- [ ] Commit: `engine: file history across layers`

**Test checkpoint:** `cargo test -p strata-engine history` passes with the fixture built; the rename test fails if files are matched by path alone.

## 2. Layer comparison

Comparison answers "what happened on this volume between these two moments" in one result, as three sets.

**Phase:** 6
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the comparison as SQL in `crates/strata-engine/src/diff.rs`. Done when: three sets come back.
2. Page and filter it. Done when: a large result stays bounded in memory.

- [ ] Implement `diff(case, a, b, DiffFilter { path_glob }, page) -> LayerDiff { added, removed, modified, counts }` with one full outer join of the two layers' in-use `files` rows on MFT entry and sequence: only in `b` is added, only in `a` is removed, in both with differing size, `si_modified`, path or content hash is modified. Done when: a test comparing `img0/p1/vss1` with `img0/p1` returns the manifest's three sets exactly.
- [ ] Return counts for all three sets regardless of paging, and page each set by `limit` and `offset` ordered by path. Done when: a test with `limit: 1` gets one row per set and the full counts.
- [ ] Refuse a layer that has no file rows with an error saying the layer was not ingested and naming the command that ingests it, and refuse comparing a layer with itself. Done when: tests cover both.
- [ ] Apply `path_glob` inside the SQL, before paging. Done when: a test with `\docs\*` gets only that folder's changes and matching counts.
- [ ] Commit: `engine: layer comparison`

**Test checkpoint:** `cargo test -p strata-engine diff` passes with the fixture built; the exact-set test fails if deleted records are included in the join.

## 3. Deleted files query and summaries

One query serves the Deleted files view (SPEC B15): the rows, and the three summaries above them.

**Phase:** 6
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the row query in `crates/strata-engine/src/deleted.rs`. Done when: each deleted file appears once with where it was last seen.
2. Implement the summaries. Done when: their totals equal the row count.

- [ ] Implement `deleted_files(case, DeletedFilter { recoverable_only, extension, folder_glob, name }, page)` returning one row per deleted MFT reference: name, folder, size, layer set, the newest layer holding it in use (`last_seen`), recoverability and recoverable bytes. Done when: a test over the fixture case returns every manifest deleted file once.
- [ ] Join the deletion time from the `usn.change` event whose reasons include `FILE_DELETE` for that file reference, leaving it null when the journal has none. Done when: a manifest deleted file carries the time the manifest recorded, and a carved record's is null.
- [ ] Implement `deleted_summary(case, filter)` returning counts by recoverability, the ten folders with the most deletions, and a 60 bucket histogram of deletion times. Done when: each total equals `deleted_files`' count for the same filter.
- [ ] Commit: `engine: deleted files query and summaries`

**Test checkpoint:** `cargo test -p strata-engine deleted` passes with the fixture built; the once-only test fails if a file deleted in two layers is returned twice.

## 4. Recent activity by day

The Recent activity view (SPEC B16) reads a day's programs, logons, opened files and start-up changes out of events already stored.

**Phase:** 6
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the day list and the four queries in `crates/strata-engine/src/activity.rs`. Done when: the fixture's day returns its known events.
2. Flag what is new. Done when: a program in no snapshot is marked first seen.

- [ ] Implement `activity_days(case)` returning the last 14 days that hold events, with a count each, in the case's display time zone passed as an argument. Done when: a test with events on three days returns three.
- [ ] Implement `programs(case, day)` from `program.run` events grouped by executable with run counts, and `first_seen = true` when the executable has no event in any snapshot layer. Done when: the fixture's prefetch executable is listed with the manifest's run count.
- [ ] Implement `logons(case, day)` from `log.event` rows with provider `Microsoft-Windows-Security-Auditing` and event id 4624, reading account, logon type and source address from `detail`, and `remote = true` for types 3 and 10. Done when: a unit test over three synthetic events returns their fields and flags.
- [ ] Implement `opened_files(case, day)` from `shortcut.target` events with the target path, the volume serial and `removable = true` when the drive type in `detail` says so. Done when: the fixture's shortcut is returned with the manifest's target.
- [ ] Implement `startup_changes(case, day)` from System event 7045, Run and RunOnce `registry.key_written` events, and log clears (104 and 1102). Done when: a unit test over one synthetic event of each kind returns four rows in time order.
- [ ] Commit: `engine: recent activity by day`

**Test checkpoint:** `cargo test -p strata-engine activity` passes with the fixture built; the first-seen test fails if snapshot layers are ignored.

## 5. Overview aggregates

The Overview (SPEC B6) shows four charts. Each is one aggregate over the events and files tables, fast enough to load with the page.

**Phase:** 6
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the aggregates in `crates/strata-engine/src/overview.rs`. Done when: each returns in under a second on the ten million event case.
2. Implement the family mapping once. Done when: every event kind maps to a family.

- [ ] Define `Family { Files, Journal, EventLog, Registry, Programs, Shortcuts }` and `EventKind::family()` in `crates/strata-artifacts/src/event.rs` (`design/CONTRACT.md` section 5). Done when: a test maps all nine kinds and fails when a kind is added without a family.
- [ ] Implement `events_per_day(case)` with the snapshot creation times and the acquisition time as markers. Done when: the day counts sum to the event total and the fixture's two snapshot times are returned.
- [ ] Implement `events_by_family(case)` and `hour_heat(case, tz)` (a 7 by 24 grid of counts). Done when: both sum to the event total, and a test with all events at one hour fills one cell.
- [ ] Implement `layer_contribution(case)`: file references present in every layer, present only in snapshots, deleted with an intact record, and carved. Done when: the fixture's counts equal those derived from the manifest.
- [ ] Add the three calls to the ignored scale test of D05 T01 §7. Done when: each runs in under one second and the figures are written into this section as a dated note.
- [ ] Commit: `engine: overview aggregates`

**Test checkpoint:** `cargo test -p strata-engine overview` passes with the fixture built; the family test fails if an event kind has no family.

## 6. Disk map queries and raw region reads

The Disk map (SPEC B17) reads the stored map, and reads bytes straight from the evidence for its hex view.

**Phase:** 6
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the map query in `crates/strata-engine/src/diskmap.rs`. Done when: 4096 cells return for a layer.
2. Implement the raw read and record decode. Done when: bytes at a carved offset decode to their record.

- [ ] Implement `diskmap(case, layer) -> Vec<Cell { first_cluster, clusters, allocated, mft, shadow_storage, carved }>` and `diskmap_summary` (share allocated and free). Done when: a test over the fixture case returns 4096 cells whose cluster counts sum to the volume's.
- [ ] Implement `locate(case, layer, Offset::Image(n) | Offset::Cluster(n)) -> CellIndex`, refusing an offset outside the volume with both bounds named. Done when: tests cover a hit, the first and last cluster, and the refusal.
- [ ] Implement `read_region(case, layer, image_offset, len)` bounded at 64 KB, reading through the layer so a snapshot returns its own bytes. Done when: 512 bytes at a manifest file's first cluster equal the file's first 512 bytes.
- [ ] Implement `decode_at(case, image_offset)` trying the three carvers' validators at that offset and returning the record kind and a one line summary. Done when: the offset of a carved USN record in the fixture case returns its file name and reasons.
- [ ] Implement `cell_detail(case, layer, index)`: state in each layer and the events carved inside the cell. Done when: a cell holding a carved record returns that event's id.
- [ ] Write a `region.save` audit row when a region is saved through `extract`'s `OutputFile`. Done when: a test saves one cluster and finds the row with its SHA-256.
- [ ] Commit: `engine: disk map queries and raw region reads`

**Test checkpoint:** `cargo test -p strata-engine diskmap` passes with the fixture built; the snapshot read test fails if `read_region` ignores the layer.

## Verification

- `history` and `diff` over the fixture case return what the manifest predicts.
- `cargo test -p strata-engine history diff` passes.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
