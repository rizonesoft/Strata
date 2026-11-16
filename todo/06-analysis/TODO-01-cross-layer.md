---
schema_version: 1
id: cross-layer
domain: 06-analysis
status: active
title: "TODO-01 -- Cross-layer analysis: file history and layer comparison"
track: M6
---

# TODO-01 -- Cross-layer analysis: file history and layer comparison

> **Goal:** An examiner can follow one file across the live volume, every shadow copy and carved remnants and see what changed between each, and can compare any two layers to list what was added, removed and modified.

> **Current state:** Measured 2026-11-16. Nothing exists. D05 T03 fills the `files` table with one row per file record per layer, which is all this file reads.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 1 (cross-layer comparison is the differentiator) and section 4.3 (`files`, `layers`).
- `design/SPEC.md` A2 (`history`, `diff`), B10 (History) and B11 (Compare): the columns and groupings these functions must return.
- `Case::files_by_path`, `files_by_ref` and `layers` from D05 T01 §2 and §3.

## Outcome

- History for a fixture file modified between the snapshots returns one row per layer in time order, each flagged with what changed from the row before, matching the manifest.
- Comparing snapshot 1 with the live layer returns exactly the manifest's added, removed and modified sets.

**Adjacency:** list=applicable @ §1; document=applicable @ D06 T02 §3; settings=not-applicable (the analysis has no tunable and takes its inputs as arguments); reporting=applicable @ §2; notifications=not-applicable (a single user offline tool has no recipients to notify); permissions=not-applicable (one examiner per case with no roles in version 1); audit=not-applicable (both functions are read-only queries over stored rows and write nothing); exchange=not-applicable (results are exported through the timeline export and the report); reverse=not-applicable (read-only queries create no record to undo)

**Adjacency rationale:** Both functions are pure reads. Their output reaches a document through the HTML report and reaches the screen through the History and Compare views.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | File history across layers | D05 T03 §5 | [ ] |
| 2 | §2 | Layer comparison | D05 T03 §5 | [ ] |

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

## Verification

- `history` and `diff` over the fixture case return what the manifest predicts.
- `cargo test -p strata-engine history diff` passes.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
