---
schema_version: 1
id: ingest-pipeline
domain: 05-timeline
status: active
title: "TODO-03 -- Ingest pipeline: evidence into the case"
track: M5
---

# TODO-03 -- Ingest pipeline: evidence into the case

> **Goal:** One ingest run takes a case from an evidence path to a full timeline: it verifies the image, walks every layer, stores file records, parses artifacts in each layer, carves unallocated space, reports progress throughout, can be cancelled cleanly and can be run again without duplicating anything.

> **Current state:** Measured 2026-11-16. `crates/strata-engine` does not exist yet; D00 T01 §2 creates it empty. The layer crates, the parsers and the case store are planned in D01 to D05 T02.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 4.3 (`ingest_runs`, deduplication) and section 4.4 (evidence unchanged, a parser error never ends a run, audit rows).
- `design/SPEC.md` A2 (`case ingest` options: `--layer`, `--no-snapshots`, `--no-carve`, `--hash-content`, `--threads`, clean cancel, additive rerun) and B4 (the stages and their states).
- `Case` from D05 T01; parsers from D05 T02; `scan` from D04 T01; `VssProvider` from D03 T01 §4.

## Outcome

- Ingesting the fixture yields file rows for the live layer and both snapshots, the manifest's expected events from every artifact, and carved records, in one case.
- An event from an unchanged artifact appears once with three layers recorded against it.
- Cancelling mid-run leaves a case that opens and reports the run as cancelled; a second run completes it; a third changes no count.
- The evidence image's SHA-256 is the same before and after a full ingest.

**Adjacency:** list=applicable @ §1; document=not-applicable (an ingest run produces case rows, not a document a user carries); settings=applicable @ §1; reporting=applicable @ D06 T02 §3; notifications=not-applicable (a single user offline tool has no recipients to notify); permissions=not-applicable (one examiner per case with no roles in version 1); audit=applicable @ §5; exchange=not-applicable (ingest reads evidence only and import of other tools' output is not in version 1); reverse=applicable @ §5

**Adjacency rationale:** Ingest runs are listed from `ingest_runs` (shown by `case info` and the Overview). The options are the run's settings, recorded with it. The reverse of a run is cancellation plus the transactional replace per layer, so a stopped run never leaves half a layer.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | Ingest options, plan and run record | T01 §2, D03 T01 §4 | [ ] |
| 2 | §2 | File record ingest per layer | §1, T01 §3, D02 T01 §7 | [ ] |
| 3 | §3 | Artifact discovery and ingest per layer | §2, T01 §4, T02 §9, D02 T01 §6 | [ ] |
| 4 | §4 | Carved record ingest | §3, D04 T01 §3, D04 T01 §5 | [ ] |
| 5 | §5 | Progress, cancellation and rerun | §4, T01 §5 | [ ] |
| 6 | §6 | Optional content hashing | §2 | [ ] |

## 1. Ingest options, plan and run record

Before any work, the run decides what it will do and writes that down. The plan is data, so the CLI can print it and the app can show its stages before they start.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Define options and the plan in `crates/strata-engine/src/ingest/plan.rs`. Done when: the fixture yields the expected stage list.
2. Record the run in `crates/strata-engine/src/ingest/run.rs`. Done when: a row exists before the first stage starts.

- [ ] Define `IngestOptions { layers: Option<Vec<LayerId>>, snapshots: bool, carve: bool, hash_content: bool, threads: Option<usize>, verify: bool }` with defaults matching SPEC A2 (every layer, snapshots on, carve on, hashing off, verify on). Done when: a test asserts the defaults.
- [ ] Implement `plan(case, options) -> IngestPlan` building the layer tree with `VssProvider` when `snapshots` is on, saving it with `Case::save_layers`, and listing stages `verify`, `layers`, `files`, `artifacts`, `carving`, `indexing` with the layers each applies to (SPEC B4). Done when: a test over the fixture gets three NTFS layers under `files` and one volume under `carving`, and `snapshots: false` gets one.
- [ ] Refuse a `layers` entry that is not in the tree, naming the ids that exist (SPEC A3). Done when: a test with `img0/p9` gets the error before any stage runs.
- [ ] Implement `Run::start(case, &plan, &options)` inserting an `ingest_runs` row with options JSON, every stage `pending` and a start time, and `Run::set_stage(stage, state, counts)`. Done when: a test reads the row back with six pending stages.
- [ ] Set the `rayon` pool size from `threads` for the run only, through a local `ThreadPool`, never the global pool. Done when: a test with `threads: 2` observes at most two worker threads in a parallel stage.
- [ ] Commit: `engine: ingest options, plan and run record`

**Test checkpoint:** `cargo test -p strata-engine ingest::plan ingest::run` passes with the fixture built; the unknown-layer test fails if validation is deferred to stage time.

## 2. File record ingest per layer

For each NTFS layer, one pass over the MFT writes every record, live and deleted, into `files`. This is the table history and comparison read.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the stage in `crates/strata-engine/src/ingest/files.rs`. Done when: the fixture's live layer is stored.
2. Run it for every planned layer. Done when: both snapshots are stored too.

- [ ] Implement `ingest_files(case, layer, ctx)` opening `NtfsVolume` on the layer, iterating `records()`, and appending through `Case::replace_layer_files`, counting records, deleted records and per-record errors. Done when: a test over the fixture's live layer finds every manifest path in `files`.
- [ ] Record a per-record error as a warning on the run (record number, offset, message) and continue. Done when: a unit test with a volume stub that fails every tenth record stores the other nine tenths and reports the failures.
- [ ] Run the stage for each layer in the plan, live first, then snapshots oldest first, setting the stage state and counts after each. Done when: a test finds three layer ids in `files`, and a file modified after snapshot 1 has a different `logical_size` or `si_modified` in `vss1` than in the live layer, as the manifest says.
- [ ] Skip a layer whose file rows already exist from a completed earlier run unless `options.layers` names it explicitly. Done when: a second run reports the stage `skipped` for all three layers and row counts are unchanged.
- [ ] Commit: `engine: file record ingest per layer`

**Test checkpoint:** `cargo test -p strata-engine ingest::files` passes with the fixture built; the snapshot difference test fails if every layer is read through the live volume.

## 3. Artifact discovery and ingest per layer

Artifacts are found by where Windows keeps them. Each is read from its layer, parsed, and its events staged for that layer, so deduplication can tell what the layers share.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement discovery in `crates/strata-engine/src/ingest/discover.rs`. Done when: the fixture's artifacts are all found.
2. Implement the stage in `crates/strata-engine/src/ingest/artifacts.rs`. Done when: events from every parser are in the case.

- [ ] Implement `discover(case, layer) -> Vec<ArtifactRef>` querying `files` for: every record (MFT events), `\$Extend\$UsnJrnl` stream `$J`, `\Windows\System32\winevt\Logs\*.evtx`, the hives `SYSTEM`, `SOFTWARE`, `SAM`, `SECURITY` and `DEFAULT` under `\Windows\System32\config` plus every `NTUSER.DAT` and `UsrClass.dat` under `\Users`, `\Windows\Prefetch\*.pf`, and every `*.lnk`. Done when: a test over the fixture case finds each artifact the manifest lists.
- [ ] Implement `ingest_artifacts(case, layer, ctx)`: emit MFT events straight from the layer's `files` rows, and for each other artifact open its stream, run its parser, and send events to an `EventAppender` for the layer. Done when: a test finds the manifest's sample event for each of the six artifact kinds.
- [ ] Parse artifacts in parallel on the run's thread pool with one writer thread owning the appender, connected by a bounded channel of 8192 events. Done when: a test with `threads: 4` produces the same event count as `threads: 1`.
- [ ] Record each artifact's `ParseReport` errors as run warnings naming the artifact path and layer, and continue (SPEC B14: a parser rejected an artifact). Done when: a test that corrupts one `.lnk` in a scratch copy of the fixture still completes with one warning.
- [ ] Commit the appender once per layer and prove deduplication: an event from the unchanged registry hive has all three layers in `event_layers`, and the USN events for a file created after snapshot 2 have only the live layer. Done when: both assertions pass.
- [ ] Commit: `engine: artifact discovery and ingest per layer`

**Test checkpoint:** `cargo test -p strata-engine ingest::artifacts` passes with the fixture built; the deduplication test fails if events are committed with the layer id in their key.

## 4. Carved record ingest

Carved records join the same tables: MFT records as file rows in the unallocated layer with their timestamp events, USN records and EVTX chunks as events. Each is marked as carved so nobody mistakes it for a record the file system vouches for.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the stage in `crates/strata-engine/src/ingest/carving.rs`. Done when: carved records from the fixture are stored.
2. Relate carved to live. Done when: a carved record that duplicates a live one adds a layer, not a row.

- [ ] Implement `ingest_carved(case, volume, ctx)` building `UnallocatedLayer`, running `scan` with the three carvers, and saving the layer `<volume>/unalloc` to `layers`. Done when: a test over the fixture completes and `layers` holds the unallocated layer.
- [ ] Store each carved MFT record as a `files` row in the unallocated layer with `carved = true`, and stage its timestamp events through `mft_events`. Done when: carved file rows exist and each has a provenance image offset where the bytes `FILE` are found.
- [ ] Stage each carved USN record as a `usn.change` event and each EVTX chunk's events through `parse_chunk`, with `detail.carved = true`. Done when: a test finds carved events whose dedupe keys equal those of the same records still present in the live `$J`, proving they merged.
- [ ] Skip the stage when `options.carve` is off, marking it `skipped`. Done when: a run with `carve: false` adds no unallocated layer.
- [ ] Commit: `engine: carved record ingest`

**Test checkpoint:** `cargo test -p strata-engine ingest::carving` passes with the fixture built; the offset test fails if provenance holds the unallocated-layer offset in place of the image offset.

## 5. Progress, cancellation and rerun

A real ingest runs for hours. The examiner must see it moving, be able to stop it without damaging the case, and pick it up again.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the driver in `crates/strata-engine/src/ingest/mod.rs`. Done when: one call runs every stage with progress.
2. Prove the three guarantees. Done when: cancel, rerun and evidence integrity each have a passing test.

- [ ] Implement `ingest(case, options, events: &dyn Fn(IngestEvent), cancel: &AtomicBool) -> IngestSummary` running the stages in order and emitting `StageStarted`, `Progress { stage, done, total, unit }`, `Warning`, `StageFinished { state, counts }` and `Finished`. Done when: a test collects the events from a fixture run and sees each stage start and finish once.
- [ ] Check `cancel` in every stage's inner loop, finish or roll back the current layer's transaction, mark the stage and the run `cancelled`, and return `Error::Cancelled`. Done when: a test that cancels during `files` reopens the case, finds the run `cancelled` and no partial layer in `files`.
- [ ] Make a rerun additive: completed stages per layer are skipped, the rest run. Done when: after the cancelled run, a second run completes and its final counts equal those of an uninterrupted run on a fresh case; a third run changes no count.
- [ ] Run the `verify` stage first when `options.verify` is on, storing the result in `evidence`, and continue on `Mismatch` with a warning, since a mismatch is a finding for the examiner, not a reason to refuse analysis. Done when: a test over a scratch E01 with a flipped byte completes with the warning and `evidence.result = mismatch`.
- [ ] Build the indexes in the `indexing` stage after all appends. Done when: `duckdb_indexes()` lists them after a run.
- [ ] Write `ingest.start` and `ingest.finish` audit rows with options and counts. Done when: both rows exist after a run, and a cancelled run's finish row says `cancelled`.
- [ ] Write `crates/strata-engine/tests/evidence_unchanged.rs`: hash the fixture VHD file, run a full ingest, hash it again, and compare the file's modified time as well. Done when: both are equal (foundation plan section 4.4).
- [ ] Commit: `engine: ingest driver with progress, cancel and rerun`

**Test checkpoint:** `bosun run -- cargo test -p strata-engine --test ingest_end_to_end --test evidence_unchanged` passes with the fixture built; the cancel test fails if a layer's rows are appended outside a transaction.

## 6. Optional content hashing

With `--hash-content`, every file's content is hashed so history can say "same bytes" or "different bytes" with certainty instead of inferring from size and time. It is off by default because it reads the whole volume once per layer.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement hashing in `crates/strata-engine/src/ingest/hashing.rs`. Done when: fixture files carry their manifest hashes.
2. Avoid rehashing shared content. Done when: an unchanged file in a snapshot is not read twice.

- [ ] Hash each in-use file's unnamed stream with SHA-256 during the `files` stage when `hash_content` is on, in parallel, storing the result in `files.content_sha256`. Done when: a test compares every live manifest file's stored hash with the manifest's.
- [ ] Reuse the live layer's hash for a snapshot record whose MFT reference, sizes, timestamps and every run's `BlockSource` is `CurrentVolume`. Done when: a test counts stream opens on snapshot 2 and finds only the files the manifest says differ.
- [ ] Record a file whose content cannot be read (encrypted, damaged runs) with a null hash and a run warning. Done when: a unit test with a stream stub that errors stores null and one warning.
- [ ] Commit: `engine: optional content hashing`

**Test checkpoint:** `cargo test -p strata-engine ingest::hashing` passes with the fixture built; the reuse test fails if every snapshot file is rehashed.

## Verification

- A full ingest of the fixture VHD and of the fixture E01 produces the same counts of files, events and layers.
- Cancel, rerun and evidence-unchanged tests pass.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
