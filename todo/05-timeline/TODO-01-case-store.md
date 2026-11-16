---
schema_version: 1
id: case-store
domain: 05-timeline
status: active
title: "TODO-01 -- Case store: schema, appends, audit log and queries"
track: M5
---

# TODO-01 -- Case store: schema, appends, audit log and queries

> **Goal:** A case is a folder holding one DuckDB file that stores the evidence reference, the layers, every file record, every deduplicated event, bookmarks and an append-only audit log, and answers timeline queries over tens of millions of events with filters and paging.

> **Current state:** Measured 2026-11-16. `crates/strata-case` does not exist yet; D00 T01 §2 creates it empty. Nothing is persisted anywhere.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 3 (DuckDB through the `duckdb` crate, `bundled`), section 4.3 (tables, deduplication, UTC microseconds) and section 4.4 (audit rules).
- `design/SPEC.md` A2 (the `timeline` filters this file's query must serve), A3 (refusals for an existing case, a newer case and moved evidence) and B14.
- `LayerTree` from D01 T02 §3; `verify` from D01 T01 §6.

## Outcome

- `Case::create` and `Case::open` work on a folder, and a case written by a newer schema is refused with both versions named.
- Ten million synthetic events append in under two minutes and a filtered page of 1000 returns in under one second on the development machine, with the measured figures recorded in §7.
- Every bookmark change and evidence relocation leaves an audit row, and no API can update or delete an audit row.

**Adjacency:** list=applicable @ §7; document=applicable @ D06 T02 §3; settings=not-applicable (the store has no tunable of its own and display settings belong to the desktop app); reporting=applicable @ D06 T02 §1; notifications=not-applicable (a single user offline tool has no recipients to notify); permissions=not-applicable (one examiner per case with no roles in version 1); audit=applicable @ §5; exchange=applicable @ D06 T02 §1; reverse=applicable @ §6

**Adjacency rationale:** Events and file records are derived from evidence and are never edited, so the only user-created records are bookmarks, whose undo is removal in §6. The audit log is deliberately not reversible. Export is the exchange surface; import of another tool's timeline is not in version 1.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | Case folder, schema and version check | D00 T01 §3 | [ ] |
| 2 | §2 | Evidence and layer tables | §1, D01 T02 §3 | [ ] |
| 3 | §3 | File table with bulk append | §2 | [ ] |
| 4 | §4 | Event tables with deduplication | §2 | [ ] |
| 5 | §5 | Append-only audit log | §1 | [ ] |
| 6 | §6 | Bookmarks with notes | §4, §5 | [ ] |
| 7 | §7 | Timeline query with filters and paging | §4, §6 | [ ] |
| 8 | §8 | Evidence relocation with hash check | §2, §5, D01 T01 §6 | [ ] |

## 1. Case folder, schema and version check

The case folder is the unit an examiner archives and hands over. It must open years later or say exactly why it cannot.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Create and open in `crates/strata-case/src/case.rs`. Done when: a created case reopens.
2. Enforce the schema version. Done when: a newer case is refused.

- [ ] Add the `duckdb` crate with the `bundled` feature at its latest release to `[workspace.dependencies]` and confirm it builds with the MSVC tools and passes `cargo deny check licenses`. Done when: `cargo build -p strata-case` succeeds and `Cargo.lock` records the version.
- [ ] Write the schema as one SQL file, `crates/strata-case/src/schema/v1.sql`, creating `meta`, `evidence`, `layers`, `files`, `events`, `event_layers`, `bookmarks`, `audit_log` and `ingest_runs` exactly as foundation plan section 4.3 lists them, with every time column `BIGINT` microseconds UTC. Done when: a test applies it to a new database and lists the nine tables.
- [ ] Implement `Case::create(dir, CaseInfo { name, examiner })`: refuse a folder that already holds `case.duckdb` (SPEC A3), create the folder and `exports`, apply the schema, write `meta` with `schema_version = 1` and the Strata version. Done when: a test creates a case in a temp folder, and a second `create` on it returns `CaseExists` naming the folder. Cheaper substitute: overwriting the existing database, which destroys an examiner's case.
- [ ] Implement `Case::open(dir)`: refuse a folder without `case.duckdb` with `NotACase` naming what is missing, and a `schema_version` above this build's with `NewerCase { case, supported }` (SPEC A3, B14). Done when: a test that sets the version to 99 in a scratch case gets `NewerCase { case: 99, supported: 1 }`.
- [ ] Implement `Case::info()` returning the `meta` row. Done when: the name and examiner read back equal to what `create` was given.
- [ ] Commit: `case: case folder, schema and version check`

**Test checkpoint:** `cargo test -p strata-case case` passes; the existing-case test fails if `create` opens the database without checking for one.

## 2. Evidence and layer tables

The case names its evidence by path and hash, never by copy, and stores the layer tree so every later row can point at a layer by id.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Write evidence in `crates/strata-case/src/evidence.rs`. Done when: path, size and hashes read back.
2. Write layers in `crates/strata-case/src/layers.rs`. Done when: the fixture tree round-trips.

- [ ] Implement `Case::set_evidence(ImageInfo, Verification)` storing path, format, size, MD5, SHA-256, the stored hash and the result, allowing exactly one evidence row (foundation plan section 2: one image per case). Done when: a second call returns `EvidenceAlreadySet`.
- [ ] Implement `Case::save_layers(&LayerTree)` upserting by layer id with parent, kind, offset, size and descriptor JSON, and `Case::layers() -> Vec<LayerRow>` ordered live first, then snapshots by creation time. Done when: a test saves the fixture tree twice and reads back the same four rows (image, volume, two snapshots) with no duplicates.
- [ ] Implement `Case::evidence()` and `Case::layer(&LayerId)`, the latter returning the ids that exist on a miss (SPEC A3). Done when: a miss on `img0/p9` names the stored ids.
- [ ] Commit: `case: evidence and layer tables`

**Test checkpoint:** `cargo test -p strata-case evidence layers` passes; the round-trip test fails if `save_layers` inserts instead of upserting.

## 3. File table with bulk append

One row per file record per layer is what makes history and comparison plain SQL. A real volume has millions of records, so rows go in through the DuckDB appender, never one `INSERT` at a time.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the appender in `crates/strata-case/src/files.rs`. Done when: one million rows append in seconds.
2. Add lookups. Done when: rows are found by path and by MFT reference.

- [ ] Implement `FileAppender` wrapping `duckdb::Appender` for `files`, taking `(&LayerId, &FileRecord, content_sha256: Option<[u8; 32]>)` and flushing every 100000 rows. Done when: a test appends one million synthetic records and `SELECT count(*)` returns one million. Cheaper substitute: a prepared `INSERT` per row, which is orders of magnitude slower and must fail the timing in §7.
- [ ] Implement `Case::replace_layer_files(layer, f)` that deletes the layer's rows and appends new ones inside one transaction, so a cancelled ingest leaves the old rows. Done when: a test that returns an error from `f` finds the previous rows intact.
- [ ] Implement `Case::files_by_path(path)`, `Case::files_by_ref(entry, sequence)` and `Case::list_dir(layer, parent_ref, include_deleted)`. Done when: tests over the fixture-shaped synthetic rows return the expected sets.
- [ ] Create indexes on `(layer_id, parent_entry)` and `(path)` after the bulk load, not before. Done when: `list_dir` on a one-million-row table returns in under 100 ms, asserted in the test.
- [ ] Commit: `case: file table with bulk append`

**Test checkpoint:** `cargo test -p strata-case files` passes; the rollback test fails if the delete and the append are not in one transaction.

## 4. Event tables with deduplication

An unchanged file in a snapshot produces the same events as the live volume. Storing each once, with the set of layers it was seen in, keeps the timeline readable and makes "only in the snapshot" a query.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the staged append in `crates/strata-case/src/events.rs`. Done when: duplicates across layers collapse to one row.
2. Read events back. Done when: an event returns with every layer it was seen in.

- [ ] Define `EventRow { time, kind, source, summary, path, file_ref, detail: serde_json::Value, dedupe_key: [u8; 32], provenance }` and `EventAppender` that appends to a temporary staging table `events_stage` with the layer id. Done when: a test stages 1000 rows.
- [ ] Implement `EventAppender::commit()`: in one transaction insert into `events` the staged rows whose `dedupe_key` is new, assigning ids from a sequence, then insert `(event_id, layer_id)` into `event_layers` for every staged row, ignoring pairs already present. Done when: a test staging the same 1000 keys for two layers ends with 1000 `events` rows and 2000 `event_layers` rows.
- [ ] Make a rerun idempotent: staging the same rows for the same layer again changes neither table. Done when: the counts are unchanged after a second commit.
- [ ] Implement `Case::event(id) -> EventWithLayers`. Done when: a test reads an event seen in two layers and gets both ids.
- [ ] Create indexes on `events(time)`, `events(kind)` and `event_layers(layer_id)` after load. Done when: the indexes exist in `duckdb_indexes()`.
- [ ] Commit: `case: event tables with deduplication across layers`

**Test checkpoint:** `cargo test -p strata-case events` passes; the two-layer test fails if deduplication is by `(dedupe_key, layer_id)` instead of `dedupe_key`.

## 5. Append-only audit log

The audit log is what lets an examiner show how a result was produced. It records actions, never evidence content, and nothing in the API can rewrite it.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the writer in `crates/strata-case/src/audit.rs`. Done when: an action appends a row.
2. Prove it is append-only. Done when: no public function updates or deletes.

- [ ] Implement `Case::audit(action: &str, params: serde_json::Value, result: AuditResult)` writing time, actor (`examiner` from `meta`, else the OS user name), action, parameters and result, with a hash chain: each row stores the SHA-256 of the previous row's hash plus its own fields. Done when: a test appends three rows and each `prev_hash` matches.
- [ ] Implement `Case::audit_log(filter, page)` and `Case::verify_audit_chain() -> Result<(), BrokenAt>`. Done when: a test that edits one row with raw SQL makes `verify_audit_chain` return the row's id.
- [ ] Add a test in `crates/strata-case/tests/audit_append_only.rs` scanning the crate's source for `UPDATE audit_log` and `DELETE FROM audit_log`. Done when: it passes, and fails when such a statement is added in a scratch copy.
- [ ] Record `case.create` and `case.open` through `audit` from §1's functions. Done when: a new case's log holds one `case.create` row.
- [ ] Commit: `case: append-only audit log with a hash chain`

**Test checkpoint:** `cargo test -p strata-case audit` passes; the chain test fails if `prev_hash` is not included in the row hash.

## 6. Bookmarks with notes

Bookmarks are the examiner's own marks on the timeline and the only records in a case a person creates, so they carry the full lifecycle: add, edit, remove.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the three operations in `crates/strata-case/src/bookmarks.rs`. Done when: each reads back.
2. Audit each. Done when: the log holds a row per change.

- [ ] Implement `Case::add_bookmark(event_id, note) -> BookmarkId`, refusing an unknown event id and returning the existing id when the event is already bookmarked. Done when: tests cover the three cases.
- [ ] Implement `Case::set_bookmark_note(id, note)` and `Case::remove_bookmark(id)`, each refusing an unknown id with the id in the error. Done when: a note reads back after a reopen of the case, and a removed bookmark is gone.
- [ ] Implement `Case::bookmarks() -> Vec<BookmarkRow>` joined to its event's time, kind and summary. Done when: a test lists two bookmarks in event time order.
- [ ] Write `bookmark.add`, `bookmark.note` and `bookmark.remove` audit rows with the bookmark and event ids. Done when: a test asserts one row per operation.
- [ ] Commit: `case: bookmarks with notes`

**Test checkpoint:** `cargo test -p strata-case bookmarks` passes; the reopen test fails if the note is held in memory only.

## 7. Timeline query with filters and paging

This one query serves the CLI, the grid, the density strip, export and the report. It must stay fast at tens of millions of rows, which is the reason for a columnar store.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the filter model and query builder in `crates/strata-case/src/query.rs`. Done when: each filter narrows results correctly.
2. Measure at scale. Done when: the figures are recorded here.

- [ ] Define `TimelineFilter { from, to, kinds, layers, path_glob, text, bookmarked_only }` and `Page { limit, offset, order: TimeAsc | TimeDesc }` (SPEC A2). Done when: the types derive `serde` for use across the app bridge.
- [ ] Implement `Case::timeline(&filter, &page) -> Vec<EventWithLayers>` building one parameterised SQL statement, with `path_glob` through DuckDB `GLOB` and `text` through `ILIKE` on summary and detail text, never by string concatenation of user input. Done when: tests cover each filter alone and all together, and a `text` value containing a quote and `%` matches literally.
- [ ] Implement `Case::timeline_count(&filter)` and `Case::kind_counts(&filter)`. Done when: counts equal the lengths of unpaged results in the tests.
- [ ] Implement `Case::density(&filter, buckets) -> Vec<(bucket_start, count)>` with `time_bucket` computed from the filter's range. Done when: bucket counts sum to `timeline_count`.
- [ ] Write the scale test `crates/strata-case/tests/scale.rs`, ignored by default and run with `--ignored`: append ten million synthetic events over three layers, then time the append, a filtered page of 1000, a count and a 200-bucket density. Done when: the append is under 120 s and each query under 1 s, and the measured figures are written into this section as a dated note.
- [ ] Commit: `case: timeline query with filters and paging`

**Test checkpoint:** `cargo test -p strata-case query` passes, and `bosun run -- cargo test -p strata-case --test scale --release -- --ignored` meets the stated times; the literal-match test fails if `text` is interpolated into the SQL.

## 8. Evidence relocation with hash check

Evidence drives get remounted under other letters. A case must accept its image at a new path, but only the same image, which the hash proves.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Detect a moved image in `crates/strata-case/src/evidence.rs`. Done when: opening evidence names the recorded path when it is gone.
2. Relocate after a hash check. Done when: a different file is refused.

- [ ] Implement `Case::open_evidence() -> Result<OpenedImage>` returning `EvidenceMoved { recorded_path }` when the path is missing (SPEC A3, B14). Done when: a test that renames the image gets the error.
- [ ] Implement `Case::relocate_evidence(new_path, progress, cancel)`: open, check size first, then hash with SHA-256 and compare with the stored value; update the path only on a match. Done when: a test relocates to a copy successfully, and a copy with one flipped byte is refused with both hashes in the error. Cheaper substitute: comparing size and file name only, which accepts a different image.
- [ ] Write `evidence.relocate` to the audit log with the old path, new path and result, for refusals too. Done when: a test finds a row for the success and one for the refusal.
- [ ] Commit: `case: evidence relocation with hash check`

**Test checkpoint:** `cargo test -p strata-case relocate` passes; the flipped-byte test fails if the hash comparison is skipped when sizes match.

## Verification

- A case created over the fixture reopens with its evidence, layers and counts intact, and `verify_audit_chain` passes.
- `cargo test -p strata-case` passes, and the ignored scale test meets its times.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
