---
schema_version: 1
id: export-report
domain: 06-analysis
status: active
title: "TODO-02 -- Export, extraction and the HTML report"
track: M6
---

# TODO-02 -- Export, extraction and the HTML report

> **Goal:** Findings leave Strata in three forms an examiner can hand over: the timeline as CSV or JSONL, a file's content extracted from any layer, and a self-contained HTML report. Each output is hashed and the hash is written to the audit log.

> **Current state:** Measured 2026-11-16. Nothing exists. D05 T01 §7 provides the timeline query and D02 T01 §4 the stream reads these build on.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 4.4 (every export and extraction is hashed and audited).
- `design/SPEC.md` A1 (no overwrite without `--force`), A2 (`export`, `report`, `fs extract`) and B12 (Export and Report dialogs: scope, format, audit excerpt).
- `Case::timeline`, `bookmarks`, `audit` from D05 T01; `open_stream` from D02 T01 §4 and §6.

## Outcome

- An exported CSV of the fixture timeline has one row per event in the filter, opens in a spreadsheet with no broken rows, and its SHA-256 is in the audit log.
- A file extracted from snapshot 1 hashes to the manifest's value for that snapshot.
- The report opens offline in a browser, with no external request, and lists evidence hashes, bookmarks and the chosen events.

**Adjacency:** list=not-applicable (outputs are files in a folder the user chose and are listed by the audit log); document=applicable @ §3; settings=not-applicable (format and scope are arguments of each export and nothing is stored); reporting=applicable @ §1; notifications=not-applicable (a single user offline tool has no recipients to notify); permissions=applicable @ §1; audit=applicable @ §1; exchange=applicable @ §1; reverse=not-applicable (an exported file is the user's own and deleting it is the undo)

**Adjacency rationale:** The permission surface here is the refusal to overwrite an existing file and the refusal to write inside the evidence path. Every output writes an audit row with its hash, which is the record an examiner cites.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | CSV and JSONL timeline export | D05 T01 §7 | [ ] |
| 2 | §2 | File extraction with hash and audit | D02 T01 §6, D05 T01 §5 | [ ] |
| 3 | §3 | Self-contained HTML report | §1, D05 T01 §6 | [ ] |

## 1. CSV and JSONL timeline export

Export streams the filtered timeline to a file without holding it in memory, since a full timeline can be tens of millions of rows.

**Phase:** 6
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the safe writer in `crates/strata-engine/src/export/output.rs`. Done when: the overwrite and evidence-path refusals work.
2. Implement both formats in `crates/strata-engine/src/export/timeline.rs`. Done when: the fixture timeline exports and reads back.

- [ ] Implement `OutputFile::create(path, force, evidence_path)`: refuse an existing file unless `force` (SPEC A1), refuse a path equal to the evidence image or any of its segments, write to `<path>.partial`, and on `finish()` flush, rename over the target and return bytes written and SHA-256 computed while writing. Done when: tests cover the two refusals, and a writer dropped without `finish()` leaves no file at the target. Cheaper substitute: writing straight to the target, which leaves a truncated file that looks complete after a crash.
- [ ] Implement `export_timeline(case, filter, ExportFormat::Csv, out, progress, cancel)` paging through `Case::timeline` 50000 rows at a time, with columns id, time (ISO 8601 UTC), kind, source, summary, path, layers, image_offset, detail (JSON), RFC 4180 quoting and a UTF-8 byte order mark. Done when: a test exports the fixture timeline and a CSV reader gets the same number of records as `timeline_count`.
- [ ] Guard against spreadsheet formula injection by prefixing a single quote to any cell that starts with `=`, `+`, `-` or `@`, since file names come from evidence. Done when: a test with an event whose summary is `=cmd|'/c calc'!A1` finds the cell prefixed.
- [ ] Implement `ExportFormat::Jsonl` writing one JSON object per line with the same fields, `detail` as a nested object. Done when: a test parses every line and counts them.
- [ ] Write an `export.timeline` audit row with the filter, format, path, row count and SHA-256, and a row with the error when the export fails or is cancelled. Done when: a test finds the row and its hash equals a hash of the file computed independently.
- [ ] Commit: `engine: CSV and JSONL timeline export`

**Test checkpoint:** `cargo test -p strata-engine export::timeline export::output` passes with the fixture built; the injection test fails if cells are written unescaped.

## 2. File extraction with hash and audit

Extraction copies one stream's content from a layer to a file the examiner chooses. It is how a document is taken out of a shadow copy for review.

**Phase:** 6
**Needs:** none
**Surface:** no

**Build order:**

1. Implement extraction in `crates/strata-engine/src/export/extract.rs`. Done when: an extracted fixture file hashes correctly.
2. Audit it. Done when: the log holds the source and the hash.

- [ ] Implement `extract(case, layer, path_or_ref, stream: Option<&str>, out: OutputFile, progress, cancel) -> Extracted { bytes, sha256, recoverability }` opening the layer through the case's evidence, reading the stream in 1 MB chunks through `OutputFile`. Done when: a test extracts a file from `img0/p1/vss1` and its SHA-256 equals the manifest's value for that file in snapshot 1.
- [ ] Extract a named stream when `stream` is given. Done when: the fixture's `secret` stream extracts to its manifest hash.
- [ ] For a deleted record, extract what the runs point at and return its `Recoverability`, refusing `Overwritten` unless `allow_overwritten` is set, since the bytes then belong to another file. Done when: a unit test with a stubbed `Overwritten` record is refused with that explanation.
- [ ] Write an `extract.file` audit row with the layer, MFT reference, path, stream, output path, bytes, SHA-256 and recoverability. Done when: a test finds the row.
- [ ] Commit: `engine: file extraction with hash and audit`

**Test checkpoint:** `cargo test -p strata-engine export::extract` passes with the fixture built; the snapshot test fails if extraction reads the live layer regardless of the layer asked for.

## 3. Self-contained HTML report

The report is the document an examiner files: one HTML file with everything inline, readable offline for as long as browsers exist.

**Phase:** 6
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` B12 (Report dialog: title, scope, audit excerpt). The document's own layout is the Treatment line below; it has no other design source.
**Job:** Hand a reader who does not have Strata the evidence identity, the events that matter, the notes on them and how they were produced.
**Treatment:** A single column document: title block, evidence table, layer table, bookmarked or filtered events as a table with a details row each, audit excerpt, and a footer with the Strata version and generation time. Print stylesheet included.
**Chrome:** None beyond the document itself: no navigation, no scripts, no external assets.

**Build order:**

1. Implement the renderer in `crates/strata-engine/src/export/report.rs`. Done when: a report renders from the fixture case.
2. Prove it is self-contained and safe. Done when: no URL, script or unescaped evidence text appears in the output.

- [ ] Define `ReportOptions { title, scope: Bookmarked | Filter(TimelineFilter), include_audit: bool, tz }` and implement `report(case, options, out: OutputFile) -> ReportResult` writing HTML by hand with a small escaping writer, no template engine dependency. Done when: a test renders the fixture case with two bookmarks and finds both event summaries and both notes in the output.
- [ ] Render the evidence section (path, format, size, MD5, SHA-256, verification result), the layer table and, per event, time in the chosen zone, kind, summary, path, layers, image offset, note and detail JSON in a collapsed `details` element. Done when: the test finds the evidence SHA-256 and a snapshot's creation time.
- [ ] Escape every value from evidence or from the user (summaries, paths, notes, detail) for HTML text and attributes. Done when: a test with a bookmark note `<script>alert(1)</script>` finds it escaped and finds no `<script` in the file. Cheaper substitute: escaping only notes, which leaves file names from evidence as an injection path.
- [ ] Cap a filter-scoped report at 50000 events, stating in the report that it was capped and how many matched. Done when: a test with a cap of 10 for speed finds the notice.
- [ ] Assert the output contains no `http://`, `https://`, `<script`, `<link` or `url(` so it makes no request. Done when: the test passes.
- [ ] Write a `report.generate` audit row with options, path, event count and SHA-256, generated before the audit excerpt is rendered so the excerpt does not have to include itself. Done when: a test finds the row.
- [ ] Commit: `engine: self-contained HTML report`

**Test checkpoint:** `cargo test -p strata-engine export::report` passes with the fixture built; the escaping test fails if any evidence-derived string is written raw.

## Verification

- A CSV export, a JSONL export, an extraction from a snapshot and a report are produced from the fixture case, and each one's SHA-256 in the audit log equals a hash of the file.
- `cargo test -p strata-engine export` passes.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
