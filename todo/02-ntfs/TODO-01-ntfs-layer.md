---
schema_version: 1
id: ntfs-layer
domain: 02-ntfs
status: active
title: "TODO-01 -- NTFS: records, content, deleted files and the bitmap"
track: M2
---

# TODO-01 -- NTFS: records, content, deleted files and the bitmap

> **Goal:** Any layer holding an NTFS volume, live or snapshot, can be opened to enumerate every MFT record with its full path and timestamps, read any stream's content, recover deleted records, and report which clusters are free.

> **Current state:** Measured 2026-11-16. `crates/strata-ntfs` does not exist yet; D00 T01 §2 creates it empty. D01 T02 §3 provides the volume layer this file opens.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 2 (NTFS scope: deleted records, alternate data streams, LZNT1), section 3 (the `ntfs` crate) and section 4.4 (a parser never panics).
- Microsoft's `FILE_RECORD_SEGMENT_HEADER`, attribute and data run layouts, and the LZNT1 description in `[MS-XCA]` section 2.5.
- The fixture manifest's `files`, `deleted` and stream expectations from D00 T01 §4, through `strata-testkit`.

## Outcome

- Every file in the manifest is found at its path with its size, and its content hashes to the manifest's SHA-256, including the compressed file and the alternate data stream.
- Every name in the manifest's `deleted` list is found as a deleted record.
- The count of free clusters is within 1 percent of the volume's own count recorded in the manifest, and no cluster of a live manifest file is reported free.

**Adjacency:** all=not-applicable (library layer with no user records, whose surfaces are owned by the CLI and desktop files)

**Adjacency rationale:** `strata fs ls` and `fs stat` (D07 T01 §4), `fs extract` (D07 T01 §9) and the desktop Files view (D08 T02 §3 and §4) present what this file reads.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | NTFS volume open and boot sector facts | D01 T02 §3 | [ ] |
| 2 | §2 | MFT enumeration with full paths | §1 | [ ] |
| 3 | §3 | File record metadata model | §2 | [ ] |
| 4 | §4 | Stream content reads with provenance | §2 | [ ] |
| 5 | §5 | LZNT1 compressed stream reads | §4 | [ ] |
| 6 | §6 | Alternate data streams | §4 | [ ] |
| 7 | §7 | Deleted record recovery | §3 | [ ] |
| 8 | §8 | Directory listing and path lookup | §3 | [ ] |
| 9 | §9 | Cluster allocation bitmap | §4 | [ ] |

## 1. NTFS volume open and boot sector facts

Opening the volume validates the boot sector and locates the MFT. The same call must work over a snapshot layer later, so it takes any `Arc<dyn Layer>` and nothing volume-specific.

**Phase:** 2
**Needs:** none
**Surface:** no

**Build order:**

1. Wrap the `ntfs` crate in `crates/strata-ntfs/src/volume.rs`. Done when: the fixture volume opens.
2. Expose the boot sector facts. Done when: they match the manifest.

- [ ] Add the `ntfs` crate at its latest release to `[workspace.dependencies]` and confirm `cargo deny check licenses` passes. Done when: both exit 0 and `Cargo.lock` records the version.
- [ ] Implement `NtfsVolume::open(layer: Arc<dyn Layer>)` using `strata_core::LayerReader` as the crate's `Read + Seek` source. Done when: a test opens `img0/p1` of the fixture.
- [ ] Expose `NtfsInfo { cluster_size, sector_size, mft_lcn, mft_record_size, total_clusters, serial }`. Done when: a test compares `cluster_size` and `serial` with the manifest's `volume` object.
- [ ] Map every `ntfs` crate error to `strata_core::Error::Corrupt` or `Unsupported` with the offset when the crate supplies one, and refuse a layer whose boot sector is not NTFS with an error naming the layer id and its kind (SPEC A3). Done when: opening a zeroed layer returns that error and does not panic.
- [ ] Commit: `ntfs: open a volume over any layer`

**Test checkpoint:** `cargo test -p strata-ntfs volume` passes with the fixture built; the zeroed-layer test fails if the open path unwraps the crate's result.

## 2. MFT enumeration with full paths

The timeline, the file table and the diff all start from one pass over the MFT. Walking the directory tree misses orphans and deleted records, so this iterates record numbers and rebuilds paths from parent references.

**Phase:** 2
**Needs:** none
**Surface:** no

**Build order:**

1. Iterate records by number in `crates/strata-ntfs/src/mft.rs`. Done when: every manifest file's record is yielded once.
2. Resolve paths. Done when: every manifest path is produced.

- [ ] Implement `NtfsVolume::records() -> impl Iterator<Item = Result<RawRecord>>` reading record 0 upward through the `$MFT` data runs, applying the update sequence fixup, and yielding a per-record error instead of stopping when one record is corrupt. Done when: a test finds record 0 named `$MFT`, and the record of every manifest file exactly once.
- [ ] Implement `PathResolver` in `crates/strata-ntfs/src/path.rs`: a map from record number to `(parent reference, name)` built in the same pass, preferring the Win32 name over the DOS 8.3 name, resolving on demand with memoisation. Done when: a test resolves every path in `manifest().files`.
- [ ] Mark a path whose parent's sequence number no longer matches as `orphan`, placing it under `$OrphanFiles/<record>/<name>`, and stop a parent chain after 4096 steps with `Corrupt`. Done when: a unit test over a synthetic map with a parent loop returns the error, and one with a stale parent returns an orphan path.
- [ ] Record `Provenance` for each record: the layer id, the record's byte offset in the layer and in the image. Done when: a test reads 1024 bytes at the reported image offset of one record and finds the `FILE` signature.
- [ ] Commit: `ntfs: MFT enumeration with full paths`

**Test checkpoint:** `cargo test -p strata-ntfs mft path` passes with the fixture built; the manifest path test fails if DOS names are preferred over Win32 names.

## 3. File record metadata model

Each record carries two sets of four timestamps: `$STANDARD_INFORMATION`, which user tools can alter, and `$FILE_NAME`, which they usually cannot. Keeping all eight is what later lets an examiner see timestamp tampering.

**Phase:** 2
**Needs:** none
**Surface:** no

**Build order:**

1. Define the model in `crates/strata-ntfs/src/record.rs`. Done when: one record decodes to it.
2. Check it against the fixture. Done when: sizes and modified times match the manifest.

- [ ] Define `FileRecord { reference: MftRef { entry, sequence }, parent, path, name, flags: { in_use, directory, compressed, sparse, reparse }, logical_size, allocated_size, si: Times, fn_: Times, hard_links, provenance }` where `Times` holds created, modified, mft_modified and accessed as UTC microseconds (foundation plan section 4.3). Done when: the crate compiles with `serde` derives on every type.
- [ ] Implement `filetime_to_micros` converting Windows FILETIME (100 ns ticks from 1601) to UTC microseconds, returning `None` for zero and for values beyond year 9999. Done when: tests cover the Unix epoch, a known date and both edge cases.
- [ ] Decode a `RawRecord` into `FileRecord`, taking sizes from the unnamed `$DATA` attribute and choosing the `$FILE_NAME` in the Win32 namespace when several exist. Done when: a test compares `logical_size` and `si.modified` for every manifest file, within the manifest's stated tolerance of zero.
- [ ] Decode a record with no `$FILE_NAME` or no `$STANDARD_INFORMATION` to a `FileRecord` with those fields `None`, never an error. Done when: a unit test over `crates/strata-ntfs/tests/data/record-no-filename.bin` decodes.
- [ ] Commit: `ntfs: file record metadata with both timestamp sets`

**Test checkpoint:** `cargo test -p strata-ntfs record` passes with the fixture built; the timestamp test fails if `$FILE_NAME` times are copied from `$STANDARD_INFORMATION`.

## 4. Stream content reads with provenance

Content reads back resident data from inside the record and non-resident data through data runs. Sparse runs read as zeros. Each run is known by its cluster, which is what makes a byte of file content traceable to a byte of the image.

**Phase:** 2
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the stream reader in `crates/strata-ntfs/src/stream.rs`. Done when: fixture files hash correctly.
2. Expose the run list. Done when: `fs stat` has what it needs to print runs.

- [ ] Implement `NtfsVolume::open_stream(&FileRecord, name: Option<&str>) -> Result<Stream>` where `Stream` implements `Layer` semantics (`len`, `read_at`) over the attribute's value, following `$ATTRIBUTE_LIST` when an attribute spans records. Done when: a test hashes every uncompressed manifest file and compares SHA-256.
- [ ] Expose `Stream::runs() -> Vec<Run { vcn, lcn: Option<u64>, clusters }>` with `lcn: None` for sparse runs, and `Stream::locate(offset) -> Provenance`. Done when: for the 5 MB fixture file, bytes read at `locate(n)`'s image offset equal the stream's bytes at `n` for three values of `n`.
- [ ] Bound reads by the attribute's initialised size, returning zeros between initialised and logical size. Done when: a unit test over a synthetic attribute with initialised size below logical size reads zeros in the gap.
- [ ] Refuse an encrypted stream (`$EFS`) with `Unsupported { what: "EFS encrypted stream" }`. Done when: a unit test over a record flagged encrypted returns it.
- [ ] Commit: `ntfs: stream content reads with provenance`

**Test checkpoint:** `cargo test -p strata-ntfs stream` passes with the fixture built; the hash test fails if sparse runs are skipped instead of read as zeros.

## 5. LZNT1 compressed stream reads

NTFS compression stores a stream in compression units of 16 clusters, each LZNT1 compressed when that saves space. The fixture holds one compressed file. If the `ntfs` crate already decompresses, this section proves it and adds nothing; if not, it supplies the decompressor.

**Phase:** 2
**Needs:** none
**Surface:** no

**Build order:**

1. Measure what the crate does with the fixture's compressed file. Done when: the result is written into this section as a dated note.
2. Make compressed reads correct in `crates/strata-ntfs/src/lznt1.rs`. Done when: the compressed fixture file hashes to the manifest's value.

- [ ] Write a test hashing the manifest's compressed file through `open_stream`. Done when: it fails or passes, and a `**Corrected <date> (build):**` note in this section records which.
- [ ] Implement `lznt1::decompress_chunk(input, output)` per `[MS-XCA]` section 2.5 (chunk header, flag bytes, the displacement and length split that depends on the output position), returning `Corrupt` on a back-reference before the start of the buffer. Done when: unit tests decompress the specification's example and reject a bad back-reference. If the first item passed through the crate, this item and the next are ticked with that evidence instead of code.
- [ ] Read a compressed stream unit by unit: a unit whose runs cover 16 clusters is stored raw, one with a trailing sparse run is decompressed, one fully sparse is zeros. Done when: the first item's test passes.
- [ ] Commit: `ntfs: read LZNT1 compressed streams`

**Test checkpoint:** `cargo test -p strata-ntfs lznt1 compressed` passes with the fixture built; the hash test fails if a compressed unit is returned without decompression.

## 6. Alternate data streams

A file can carry named streams beside its content. They hide data, and the USN journal itself lives in one (`$Extend\$UsnJrnl:$J`), so they are both evidence and plumbing.

**Phase:** 2
**Needs:** none
**Surface:** no

**Build order:**

1. List streams in `crates/strata-ntfs/src/stream.rs`. Done when: the fixture file's `secret` stream is listed.
2. Read a named stream. Done when: its content hashes to the manifest's value.

- [ ] Implement `NtfsVolume::streams(&FileRecord) -> Vec<StreamInfo { name: Option<String>, logical_size, resident }>`, following `$ATTRIBUTE_LIST`. Done when: a test finds the unnamed stream and `secret` on the manifest's ADS file.
- [ ] Read `secret` through `open_stream(record, Some("secret"))`. Done when: its SHA-256 equals the manifest's `streams.secret.sha256`.
- [ ] Read a large sparse named stream without allocating its logical size: open `$Extend\$UsnJrnl:$J` and iterate only its allocated runs. Done when: a test reads the first allocated run and peak memory stays under 64 MB, measured by reading in 1 MB buffers.
- [ ] Commit: `ntfs: alternate data streams`

**Test checkpoint:** `cargo test -p strata-ntfs ads` passes with the fixture built; the test fails if `streams` returns only the unnamed stream.

## 7. Deleted record recovery

A deleted file's MFT record stays until reused: the in-use flag is cleared but the name, timestamps and data runs remain. Its clusters may have been reused, so recovered content is marked by how trustworthy it is.

**Phase:** 2
**Needs:** none
**Surface:** no

**Build order:**

1. Yield deleted records from the enumeration. Done when: every manifest deleted name is found.
2. Classify recoverability. Done when: each deleted record says whether its clusters are still free.

- [ ] Include records whose in-use flag is clear in `records()`, decoded to `FileRecord` with `flags.in_use = false`, and resolve their paths through the parent reference when the parent still matches. Done when: a test finds every name in `manifest().deleted` (the files the fixture script deletes last, after which it creates nothing, so their records are not reused).
- [ ] Add `Recoverability { Intact, PartlyOverwritten, Overwritten, Resident }` computed by checking each of the record's runs for reuse. Done when: a unit test over a synthetic record and bitmap returns each variant.
- [ ] Keep `recoverability()` in `crates/strata-ntfs/src/deleted.rs` independent of the bitmap reader by taking `is_allocated: &dyn Fn(u64) -> bool` as an argument, which the caller fills from §9. Done when: `deleted.rs` compiles with no reference to `bitmap.rs`.
- [ ] Commit: `ntfs: recover deleted records`

**Test checkpoint:** `cargo test -p strata-ntfs deleted` passes with the fixture built; the test fails if `records()` filters out records that are not in use.

## 8. Directory listing and path lookup

Browsing needs two cheap operations that do not scan the whole MFT: list one directory, and find one path. Both go through the directory index, with the enumeration as the source for deleted children.

**Phase:** 2
**Needs:** none
**Surface:** no

**Build order:**

1. Implement lookup and listing in `crates/strata-ntfs/src/dir.rs`. Done when: the fixture's directories list correctly.
2. Add deleted children. Done when: a deleted file appears in its former directory when asked for.

- [ ] Implement `NtfsVolume::lookup(path) -> Result<FileRecord>` walking `$INDEX_ROOT` and `$INDEX_ALLOCATION` case-insensitively, and on a miss returning `strata_core::Error::NotFound { what, nearest }` with the path and its deepest existing part (SPEC A3). Done when: a test looks up every manifest path, and a miss on `\docs\nope\x.txt` names `\docs` as the deepest part.
- [ ] Implement `NtfsVolume::list(dir: &FileRecord) -> Vec<FileRecord>` from the index, one entry per file (not one per name). Done when: a test lists `\docs` and compares names with the manifest.
- [ ] Implement `NtfsVolume::list_deleted(dir, index: &DeletedIndex)` where `DeletedIndex` maps a parent reference to deleted records, built once from `records()`. Done when: a test lists the former directory of a manifest deleted file and finds it.
- [ ] Commit: `ntfs: directory listing and path lookup`

**Test checkpoint:** `cargo test -p strata-ntfs dir` passes with the fixture built; the miss test fails if the error stops reporting the deepest existing part.

## 9. Cluster allocation bitmap

`$Bitmap` holds one bit per cluster. The free runs it describes are the unallocated layer that carving scans, and it decides whether a deleted file's content can still be trusted.

**Phase:** 2
**Needs:** none
**Surface:** no

**Build order:**

1. Read the bitmap in `crates/strata-ntfs/src/bitmap.rs`. Done when: the free cluster count matches the manifest.
2. Iterate free runs. Done when: runs are maximal and in order.

- [ ] Implement `NtfsVolume::bitmap() -> Bitmap` reading the unnamed stream of MFT record 6 through `open_stream`, with `is_allocated(lcn)` and `free_clusters()`. Done when: a test finds `free_clusters()` within 1 percent of `manifest().volume.free_clusters` (the volume writes a little at dismount), and every cluster of every manifest file's runs allocated.
- [ ] Implement `Bitmap::free_runs() -> impl Iterator<Item = ClusterRun { lcn, clusters }>` scanning eight bytes at a time and merging adjacent free bits into maximal runs. Done when: a unit test over a hand-built bitmap yields the expected runs, including one that crosses a 64-bit word boundary.
- [ ] Treat clusters beyond `total_clusters` in the last byte as allocated. Done when: a unit test with a volume of 13 clusters reports no run past cluster 12.
- [ ] Commit: `ntfs: cluster allocation bitmap and free runs`

**Test checkpoint:** `cargo test -p strata-ntfs bitmap` passes with the fixture built; the word-boundary test fails if runs are not merged across words.

## Verification

- Every manifest file is found, sized and hashed correctly, on the fixture VHD and the fixture E01.
- Every manifest deleted name not listed as reused is found as a deleted record.
- `cargo test -p strata-ntfs` passes and no test triggers a panic on the corrupt-input fixtures.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
