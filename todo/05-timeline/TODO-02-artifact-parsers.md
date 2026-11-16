---
schema_version: 1
id: artifact-parsers
domain: 05-timeline
status: active
title: "TODO-02 -- Artifact parsers: bytes into timeline events"
track: M5
---

# TODO-02 -- Artifact parsers: bytes into timeline events

> **Goal:** Six kinds of Windows artifact (MFT timestamps, the USN journal, EVTX logs, registry hives, prefetch files and LNK shortcuts) each parse into timeline events with a stable deduplication key and provenance, and none of them can panic on damaged input.

> **Current state:** Measured 2026-11-16. `crates/strata-artifacts` does not exist yet; D00 T01 §2 creates it empty. D02 T01 supplies file records and stream content.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 2 (artifacts in scope and the stated limits), section 3 (`evtx`, `notatin`, own prefetch and LNK parsers), section 4.3 (dedupe key) and section 8 (`[MS-XCA]`, `[MS-SHLLINK]`, the libscca prefetch format).
- `FileRecord` from D02 T01 §3; `Provenance` from D01 T01 §1.
- The fixture manifest's `artifacts` object (each artifact's path, expected event count and one sample event) and `usn_expected` from D00 T01 §4.

## Outcome

- Each parser, run on its fixture artifact, yields the manifest's expected event count and its sample event.
- The same artifact parsed from two layers yields identical dedupe keys.
- A fuzz-style test feeds each parser truncated and bit-flipped copies of its sample and none panics.

**Adjacency:** all=not-applicable (library layer with no user records, whose surfaces are owned by the CLI and desktop files)

**Adjacency rationale:** Events reach users through the timeline (D07 T01 §6, D08 T02 §5). Event kinds defined here are the values the kind filter lists.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | Event model and artifact parser contract | D01 T01 §1 | [ ] |
| 2 | §2 | MFT timestamp events | §1, D02 T01 §3 | [ ] |
| 3 | §3 | USN journal parser | §1, D04 T01 §4 | [ ] |
| 4 | §4 | EVTX event parser | §1 | [ ] |
| 5 | §5 | Registry key last-write events | §1 | [ ] |
| 6 | §6 | Xpress Huffman decompressor | D00 T01 §3 | [ ] |
| 7 | §7 | Prefetch run events | §1, §6 | [ ] |
| 8 | §8 | LNK shortcut events | §1 | [ ] |
| 9 | §9 | Malformed input test across every parser | §2, §3, §4, §5, §7, §8 | [ ] |

## 1. Event model and artifact parser contract

One event shape lets a single table and a single grid hold everything. The dedupe key is defined here once so every parser builds it the same way.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Define the model in `crates/strata-artifacts/src/event.rs`. Done when: an event serialises and its key is stable.
2. Define the parser contract in `crates/strata-artifacts/src/parser.rs`. Done when: a test parser emits events through it.

- [ ] Define `Event { time: i64, kind: EventKind, source: ArtifactKind, summary: String, path: Option<String>, file_ref: Option<MftRef>, detail: serde_json::Value, provenance: Provenance }` with times in UTC microseconds (foundation plan section 4.3). Done when: the crate compiles with `serde` derives.
- [ ] Define `EventKind` as a closed enum with a stable string form (`file.created`, `file.modified`, `file.mft_modified`, `file.accessed`, `usn.change`, `log.event`, `registry.key_written`, `program.run`, `shortcut.target`), and a test that the string forms never change. Done when: the test compares against a committed list in `crates/strata-artifacts/tests/data/event-kinds.txt`.
- [ ] Implement `Event::dedupe_key() -> [u8; 32]` as BLAKE3 over kind, time, source and a parser-supplied identity byte string, excluding the layer id and offsets. Done when: a test shows two events differing only in provenance share a key, and two differing in time do not.
- [ ] Define `trait ArtifactParser { fn kind(&self) -> ArtifactKind; fn parse(&self, input: ArtifactInput, sink: &mut dyn FnMut(Event)) -> ParseReport; }` where `ParseReport { events, errors: Vec<ParseError { offset, message }> }` collects recoverable errors instead of stopping. Done when: a test parser that hits two bad records reports two errors and still emits the good events.
- [ ] Commit: `artifacts: event model and parser contract`

**Test checkpoint:** `cargo test -p strata-artifacts event parser` passes; the key test fails if the layer id is included in the dedupe key.

## 2. MFT timestamp events

Each file record yields up to eight events: four from `$STANDARD_INFORMATION` and four from `$FILE_NAME`. Both sets are kept, because a difference between them is itself a finding.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the mapping in `crates/strata-artifacts/src/mft.rs`. Done when: one record yields its events.
2. Check against the fixture. Done when: a manifest file's modified time appears as an event.

- [ ] Implement `mft_events(&FileRecord, sink)` emitting one event per non-null timestamp with `detail` holding the attribute (`si` or `fn`), sizes, flags and whether the record is deleted or carved. Done when: a unit test over a record with all eight times emits eight events.
- [ ] Merge an `si` and `fn` timestamp of the same kind and equal value into one event with `detail.attributes = ["si", "fn"]`, to halve the row count for untouched files. Done when: a record whose two sets are equal emits four events, and one whose `si.modified` differs emits five.
- [ ] Build the identity from the MFT entry, sequence, kind and attribute set. Done when: the same record read from two layers yields equal keys.
- [ ] Commit: `artifacts: MFT timestamp events`

**Test checkpoint:** `cargo test -p strata-artifacts mft` passes; the merge test fails if differing `si` and `fn` times are collapsed.

## 3. USN journal parser

`$Extend\$UsnJrnl:$J` is a sparse stream of `USN_RECORD_V2` records padded with zeros between pages. It records every create, write, rename and delete, with the file name, long after the file is gone.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the stream parser in `crates/strata-artifacts/src/usn.rs`. Done when: records come out in order.
2. Emit events. Done when: the manifest's expected reasons appear per path.

- [ ] Implement `UsnParser` reading the stream in 1 MB windows, skipping zero-filled regions 8 bytes at a time and resynchronising at the next 4096-byte page after a record that fails validation. Done when: a unit test over `crates/strata-artifacts/tests/data/usn-sample.bin` (records, a zero gap, a corrupt record, more records) yields every valid record and one error.
- [ ] Reuse the carver's record type and validation (`strata_carve::usn::UsnRecord` and `validate`, from D04 T01 §4) by adding `strata-carve` as a dependency of `strata-artifacts`, which the layering order allows. Done when: `cargo run -p xtask -- layering` exits 0 and `crates/strata-artifacts/src/usn.rs` holds no second copy of the validation rules.
- [ ] Emit one `usn.change` event per record with the reason flags decoded to names in `detail.reasons`, the file name in `summary`, and identity from the USN number and the volume serial. Done when: a test over the fixture's `$J` finds, for each path in `manifest().usn_expected`, an event whose reasons include the expected ones.
- [ ] Accept `USN_RECORD_V3` (128-bit file references) and skip `V4` range records with a counted note. Done when: a unit test over a hand-built V3 record decodes its name.
- [ ] Commit: `artifacts: USN journal parser`

**Test checkpoint:** `cargo test -p strata-artifacts usn` passes with the fixture built; the gap test fails if the parser stops at the first zero region.

## 4. EVTX event parser

Event logs record logons, service installs, process starts and much else. The `evtx` crate decodes the binary XML; this section turns each record into an event and also accepts a single carved chunk.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Wrap the crate in `crates/strata-artifacts/src/evtx.rs`. Done when: the fixture log yields the manifest's count.
2. Accept a bare chunk. Done when: a carved chunk yields its events.

- [ ] Add the `evtx` crate at its latest release with default features trimmed to what parsing needs, and confirm `cargo deny check licenses` passes. Done when: both exit 0 and `Cargo.lock` records the version.
- [ ] Implement `EvtxParser` emitting one `log.event` per record: time from `TimeCreated`, `summary` as `<Provider> <EventID>`, `detail` holding channel, computer, record id, level and the event data as JSON. Done when: a test over the fixture's `Application.evtx` yields `manifest().artifacts.evtx.count` events and finds the sample event's data.
- [ ] Build the identity from channel, computer and event record id. Done when: the same log parsed from the live layer and a snapshot yields equal keys for records present in both.
- [ ] Implement `parse_chunk(bytes: &[u8; 65536])` for carved chunks, using the crate's chunk-level API, and report a chunk that fails as a `ParseError`, not a panic. Done when: a test parses `crates/strata-carve/tests/data/evtx-chunk.bin` and yields at least one event.
- [ ] Run the crate's parse inside `std::panic::catch_unwind` at the artifact boundary, turning a panic in the dependency into a `ParseError`, since foundation plan section 4.4 forbids a parser panic ending an ingest. Done when: a test with a parser stub that panics reports an error and returns. WORKAROUND marker required on that line: the owning layer is a third-party crate.
- [ ] Commit: `artifacts: EVTX event parser`

**Test checkpoint:** `cargo test -p strata-artifacts evtx` passes with the fixture built; the count test fails if records with unparseable data are dropped silently instead of reported.

## 5. Registry key last-write events

Every registry key carries the time it was last written. Version 1 emits that time for every key and goes no further: interpreting particular keys is a stated limit in the foundation plan.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Wrap `notatin` in `crates/strata-artifacts/src/registry.rs`. Done when: the fixture hive's keys are walked.
2. Emit events. Done when: the manifest's sample key and time appear.

- [ ] Add the `notatin` crate at its latest release and confirm `cargo deny check licenses` passes. Done when: both exit 0 and `Cargo.lock` records the version.
- [ ] Implement `RegistryParser` walking every key of a hive and emitting `registry.key_written` with the key path in `summary`, the hive file's path in `path`, and `detail` holding the value count and value names (not value data). Done when: a test over the fixture's `SOFTWARE` hive yields `manifest().artifacts.registry.count` events and the sample key at its recorded time.
- [ ] Apply transaction logs (`.LOG1`, `.LOG2`) when the caller supplies them beside the hive, and record in `ParseReport` whether they were applied. Done when: a unit test with no logs parses and reports `logs_applied = false`.
- [ ] Build the identity from the hive's root name, the key path and the last-write time. Done when: equal keys come from the live layer and a snapshot for an unchanged key.
- [ ] Commit: `artifacts: registry key last-write events`

**Test checkpoint:** `cargo test -p strata-artifacts registry` passes with the fixture built; the count test fails if the walk stops at the first subkey level.

## 6. Xpress Huffman decompressor

Prefetch files on Windows 10 and later are wrapped in a `MAM` header and compressed with Xpress Huffman. Decompressing it in Rust keeps Strata able to read them on any platform, with no call into Windows.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the decoder in `crates/strata-artifacts/src/xpress_huffman.rs`. Done when: the specification's test vector decodes.
2. Bound it. Done when: hostile input cannot over-allocate or loop.

- [ ] Implement `decompress(input, expected_len) -> Result<Vec<u8>>` per `[MS-XCA]` section 2.2: for each 65536-byte output block read the 256-byte table of 512 four-bit code lengths, build the canonical Huffman decoding table, then decode literals and length and distance matches with the 16-bit refill rule. Done when: a unit test decodes the example in `[MS-XCA]` section 3.2 to its stated output.
- [ ] Refuse `expected_len` above 256 MB, a match distance beyond the output so far, and input that ends early, each with `Corrupt` and the input offset. Done when: three unit tests each get the error.
- [ ] Decode a real compressed prefetch payload: read the fixture's `.pf` out of the fixture image through `strata-testkit` (it comes from the build machine and names its local paths, so it is never committed) and check the result has the `SCCA` signature at byte 4. Done when: the test passes.
- [ ] Commit: `artifacts: Xpress Huffman decompressor`

**Test checkpoint:** `cargo test -p strata-artifacts xpress` passes; the distance test fails if the bounds check on match distance is removed.

## 7. Prefetch run events

A prefetch file records that a program ran: its name, a run count, up to eight last run times, and the files it loaded.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Parse the header and file information in `crates/strata-artifacts/src/prefetch.rs`. Done when: the sample's executable name and run count decode.
2. Emit events. Done when: one event per run time appears.

- [ ] Detect the `MAM\x04` wrapper, read the uncompressed size and decompress with §6; pass an uncompressed file straight through. Done when: tests cover both a wrapped and a bare sample.
- [ ] Parse the header (version, `SCCA` signature, executable name as UTF-16, path hash) and the file information block for versions 23, 26, 30 and 31, reading the run count and the last run times (one for version 23, eight from 26 on) as the libscca format document lays them out. Done when: a test over the sample decodes the executable name and run count recorded in `manifest().artifacts.prefetch`.
- [ ] Parse the file name strings section into a list of loaded paths, bounded at 8192 entries. Done when: the sample's list contains its own executable's path.
- [ ] Emit one `program.run` event per non-zero run time with the executable in `summary` and `detail` holding run count, path hash, format version and the first 32 loaded paths. Done when: the count equals the sample's non-zero run times.
- [ ] Refuse an unknown version with `Unsupported` naming the version number. Done when: a unit test with version 99 gets it.
- [ ] Commit: `artifacts: prefetch run events`

**Test checkpoint:** `cargo test -p strata-artifacts prefetch` passes; the version test fails if an unknown version is parsed with the version 30 layout.

## 8. LNK shortcut events

A shortcut records the target it pointed at, the target's timestamps as they were when the shortcut was last updated, and often the volume serial and machine name.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Parse the structures in `crates/strata-artifacts/src/lnk.rs`. Done when: the fixture shortcut's target decodes.
2. Emit events. Done when: target times become events.

- [ ] Parse the `ShellLinkHeader` (size `0x4C`, the link CLSID, link flags, file attributes, three FILETIMEs, file size) per `[MS-SHLLINK]` section 2.1. Done when: a test over the fixture's `.lnk` decodes the three times.
- [ ] Skip the `LinkTargetIDList` by its size, then parse `LinkInfo` for the local base path, volume serial and volume label, and the `StringData` entries present by flag (name, relative path, working directory, arguments), handling both Unicode and code page strings. Done when: the test finds the target path recorded in `manifest().artifacts.lnk.target`.
- [ ] Parse the `TrackerDataBlock` extra data block for the machine name and the MAC address embedded in the droid file identifier. Done when: a unit test over a hand-built block returns the machine name.
- [ ] Emit `shortcut.target` events for the target's created, modified and accessed times, with the target path in `summary` and everything else in `detail`. Done when: three events come from the fixture shortcut.
- [ ] Bound every size field against the remaining input before reading. Done when: a unit test with an ID list size larger than the file returns `Corrupt`.
- [ ] Commit: `artifacts: LNK shortcut events`

**Test checkpoint:** `cargo test -p strata-artifacts lnk` passes with the fixture built; the bounds test fails if the ID list size is trusted.

## 9. Malformed input test across every parser

Evidence is hostile input by definition. One test drives every parser with damaged copies of its own sample and asserts the only outcomes are events and reported errors.

**Phase:** 5
**Needs:** none
**Surface:** no

**Build order:**

1. Write the harness in `crates/strata-artifacts/tests/malformed.rs`. Done when: it runs every parser over generated variants.
2. Fix what it finds. Done when: no variant panics or runs past its time bound.

- [ ] Generate, from a fixed seed, 500 variants of each parser's sample: truncations at random lengths, single and burst bit flips, and size fields set to `0`, `0xFFFF` and `0xFFFFFFFF`. Done when: the generator is deterministic, proven by hashing the variant set twice.
- [ ] Run each parser on each variant under `catch_unwind` with a five-second limit per variant, failing the test on any panic or timeout and printing the seed and variant index. Done when: the test passes for all six parsers.
- [ ] Fix each panic found at its cause in the parser (a missing bounds check, an unchecked subtraction), adding the failing variant to that parser's unit tests. Done when: the harness passes with no parser-level `catch_unwind` added beyond the one in §4.
- [ ] Commit: `artifacts: malformed input test for every parser`

**Test checkpoint:** `bosun run -- cargo test -p strata-artifacts --test malformed` passes; it fails if a bounds check added by this section is reverted.

## Verification

- Each parser yields its manifest count and sample event from the fixture, from the live layer and from a snapshot.
- `cargo test -p strata-artifacts` passes including `malformed`.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
