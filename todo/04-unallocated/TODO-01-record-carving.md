---
schema_version: 1
id: record-carving
domain: 04-unallocated
status: active
title: "TODO-01 -- Unallocated space: scanning and record carving"
track: M4
---

# TODO-01 -- Unallocated space: scanning and record carving

> **Goal:** The free clusters of a live NTFS volume are scanned in parallel for three kinds of structured record (MFT records, USN records, EVTX chunks), and each hit is validated, decoded and returned with the byte offset it was found at.

> **Current state:** Measured 2026-11-16. `crates/strata-carve` does not exist yet; D00 T01 §2 creates it empty. D02 T01 §9 provides the free runs this file scans.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 2 (structured record carving in scope, file carving by signature out), section 3 (`rayon`, `memchr`) and section 4.4.
- Microsoft's `FILE_RECORD_SEGMENT_HEADER` and `USN_RECORD_V2` layouts; the EVTX chunk header (`ElfChnk`) as the `evtx` crate documents it.
- `Bitmap::free_runs` from D02 T01 §9 and `FileRecord` decoding from D02 T01 §3.
- The fixture: files deleted after snapshot 2 leave MFT records and USN records, some of which fall in free clusters.

## Outcome

- A scan of the fixture's unallocated space finishes, reports progress, can be cancelled, and returns carved records each with an image offset where the record's signature is found.
- A scan never returns a record from an allocated cluster.
- Malformed candidates are counted and dropped without a panic.

**Adjacency:** all=not-applicable (library layer with no user records, whose surfaces are owned by the CLI and desktop files)

**Adjacency rationale:** Carved records enter the case through D05 T03 §4 and are shown by the timeline and the History view. The `--no-carve` option and the app's checkbox that switch this off are owned by D07 T01 §5 and D08 T01 §7.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | Unallocated layer over free runs | D02 T01 §9 | [ ] |
| 2 | §2 | Parallel scan engine with progress and cancel | §1 | [ ] |
| 3 | §3 | MFT record carver | §2, D02 T01 §3 | [ ] |
| 4 | §4 | USN record carver | §2 | [ ] |
| 5 | §5 | EVTX chunk carver | §2 | [ ] |

## 1. Unallocated layer over free runs

Unallocated space is the free runs of the bitmap laid end to end. Presenting it as a layer keeps offsets honest: an offset in the unallocated layer maps to exactly one cluster of the volume.

**Phase:** 4
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the layer in `crates/strata-carve/src/unallocated.rs`. Done when: its length is free clusters times cluster size.
2. Map offsets back. Done when: an unallocated offset resolves to the right volume offset.

- [ ] Implement `UnallocatedLayer` with kind `Unallocated` and id `<volume>/unalloc`, built from `Bitmap::free_runs()` with a prefix-sum table of run lengths. Done when: a unit test over three synthetic runs reports the summed length.
- [ ] Implement `read_at` by binary search over the prefix sums, reading each part from the volume layer. Done when: a unit test reads across a run boundary and matches the concatenated volume bytes.
- [ ] Implement `to_volume_offset(offset)` and fill `Provenance` with both the volume and image offsets. Done when: a test over the fixture reads 512 bytes at a mapped image offset and gets the same bytes as through the layer.
- [ ] Expose `runs()` so the scan engine can split work at run boundaries. Done when: the iterator yields the same runs the bitmap did.
- [ ] Commit: `carve: unallocated layer over free runs`

**Test checkpoint:** `cargo test -p strata-carve unallocated` passes; the boundary test fails if the prefix-sum lookup is off by one.

## 2. Parallel scan engine with progress and cancel

All carvers share one pass over the data. The engine reads large chunks, hands each to every carver, and deals once with the three hard parts: records that straddle a chunk boundary, progress, and stopping when asked.

**Phase:** 4
**Needs:** none
**Surface:** no

**Build order:**

1. Define the carver contract in `crates/strata-carve/src/engine.rs`. Done when: a test carver finds planted signatures.
2. Parallelise with overlap. Done when: a signature planted across a chunk boundary is found exactly once.

- [ ] Define `trait Carver: Sync { fn signature(&self) -> &[u8]; fn signature_offset(&self) -> usize; fn max_record_len(&self) -> usize; fn alignment(&self) -> u64; fn try_carve(&self, data: &[u8], at: usize) -> Option<(Carved, usize)>; }` and `Carved { kind, offset, provenance, payload }`. Done when: the crate compiles with a test carver for the signature `TEST`.
- [ ] Implement `scan(layer, carvers, options, progress, cancel) -> ScanReport` splitting each run into 8 MB chunks processed with `rayon`, each chunk extended by the largest `max_record_len` so a record starting near the end is whole, and accepting a hit only when it starts inside the chunk proper. Done when: a test plants `TEST` records at a chunk boundary and inside the overlap and finds each exactly once.
- [ ] Find candidates with `memchr::memmem` per signature and check `alignment` before calling `try_carve`. Done when: a test plants a signature at an odd offset and a carver with alignment 512 ignores it.
- [ ] Report progress as bytes scanned through an `AtomicU64`, calling `progress` at most ten times a second from the calling thread. Done when: a test over a 64 MB synthetic layer receives monotonic progress ending at the total.
- [ ] Check the cancel flag between chunks and return `Error::Cancelled` with the partial `ScanReport`. Done when: a test that sets the flag from the progress callback stops before the end. Cheaper substitute: checking only between runs, which leaves a single 500 GB run uncancellable.
- [ ] Count candidates rejected by `try_carve` in `ScanReport.rejected` per carver, and send carved records through a bounded channel of 4096 so memory stays flat. Done when: a test with one million planted records peaks under 256 MB.
- [ ] Commit: `carve: parallel scan engine`

**Test checkpoint:** `cargo test -p strata-carve engine` passes; the boundary test fails if the chunk overlap is removed, and fails if overlap hits are not deduplicated.

## 3. MFT record carver

An MFT record freed and no longer inside `$MFT` (after a reformat, or from an old MFT location) still starts with `FILE`, carries an update sequence array, and decodes like any other record.

**Phase:** 4
**Needs:** none
**Surface:** no

**Build order:**

1. Implement validation in `crates/strata-carve/src/mft.rs`. Done when: random data containing `FILE` is rejected.
2. Decode accepted records. Done when: a carved record becomes a `FileRecord`.

- [ ] Implement `MftCarver` with signature `FILE`, alignment 512 and record length from the volume's `mft_record_size`. Done when: it compiles against the `Carver` trait.
- [ ] Validate a candidate: update sequence offset and count consistent with the record size, the fixup applies (each sector's last two bytes equal the sequence number), first attribute offset inside the record, used size not above allocated size. Done when: unit tests accept a real record from `crates/strata-carve/tests/data/mft-record.bin` and reject four corrupted variants, one per rule.
- [ ] Decode an accepted candidate with `strata_ntfs`'s record decoder into `FileRecord` with `carved = true` and a path of `$Carved/<entry>/<name>` when the parent cannot be resolved. Done when: a test over a synthetic layer holding the sample record returns its name and timestamps.
- [ ] Commit: `carve: MFT record carver`

**Test checkpoint:** `cargo test -p strata-carve mft` passes; the fixup rejection test fails if the fixup check is skipped.

## 4. USN record carver

The USN journal is trimmed from the front as it grows, and the freed clusters keep old change records. A USN record has no magic number, so it is recognised by its internal consistency.

**Phase:** 4
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the heuristic in `crates/strata-carve/src/usn.rs`. Done when: the false positive rate on random data is zero over 1 GB.
2. Decode records. Done when: carved records carry name, reason and time.

- [ ] Implement `UsnCarver` scanning at 8-byte alignment for the bytes `02 00 00 00` (major version 2, minor version 0) at offset 4 of a candidate, using that as the signature with a 4-byte lead. Done when: it compiles against the `Carver` trait and a planted record is offered to `try_carve`.
- [ ] Validate a candidate `USN_RECORD_V2`: record length a multiple of 8 between 60 and 600, file name offset equal to 60, file name length even and fitting inside the record, timestamp between 2000 and 2100, reason with no undefined bits. Done when: unit tests accept a real record from `crates/strata-carve/tests/data/usn-record.bin` and reject one variant per rule.
- [ ] Decode to `UsnRecord { usn, file_ref, parent_ref, timestamp, reason, source_info, attributes, name }`. Done when: a test asserts the sample record's name and reason.
- [ ] Measure false positives: scan 1 GB of seeded pseudo-random bytes. Done when: the test reports zero accepted records, and the measured count is written into this section as a dated note. Cheaper substitute: validating length only, which accepts thousands of fragments.
- [ ] Commit: `carve: USN record carver`

**Test checkpoint:** `cargo test -p strata-carve usn` passes; the random-data test fails if the timestamp range rule is removed.

## 5. EVTX chunk carver

Event logs are made of 64 KB chunks that each begin with `ElfChnk\0` and carry their own checksums and string tables, so a chunk found alone in free space can still be decoded into events.

**Phase:** 4
**Needs:** none
**Surface:** no

**Build order:**

1. Implement chunk validation in `crates/strata-carve/src/evtx.rs`. Done when: a real chunk is accepted and a damaged one rejected.
2. Hand the chunk to the parser. Done when: events come out of a carved chunk.

- [ ] Implement `EvtxChunkCarver` with signature `ElfChnk\0`, alignment 512 and length 65536. Done when: it compiles against the `Carver` trait.
- [ ] Validate the header: header size 128, last record number not below first, free space offset inside the chunk, and the header CRC32 over bytes 0 to 120 and 128 to 512 equal to the stored value. Done when: unit tests accept `crates/strata-carve/tests/data/evtx-chunk.bin` and reject a variant with one flipped header byte.
- [ ] Return the 64 KB chunk as `Carved { kind: EvtxChunk, payload }` without decoding events here; decoding belongs to D05 T02 §4, which accepts a bare chunk. Done when: a test over a synthetic layer holding the sample chunk returns one carved item whose payload equals the sample.
- [ ] Accept a chunk whose event data checksum fails but whose header checksum passes, marking it `partial = true`, since the tail of a freed chunk is often overwritten. Done when: a unit test with a damaged tail returns `partial`.
- [ ] Commit: `carve: EVTX chunk carver`

**Test checkpoint:** `cargo test -p strata-carve evtx` passes; the flipped-byte test fails if the header checksum is not checked.

## Verification

- `scan` over the fixture's unallocated layer with all three carvers completes, and every carved offset lies in a cluster the bitmap marks free.
- `cargo test -p strata-carve` passes.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
