---
schema_version: 1
id: image-access
domain: 01-evidence
status: active
title: "TODO-01 -- Image access: the layer model and image readers"
track: M1
---

# TODO-01 -- Image access: the layer model and image readers

> **Goal:** Any supported evidence image opens as a read-only `Layer` with exact offsets, its format is detected from its bytes, and its content can be hashed and checked against the hash the image stores.

> **Current state:** Measured 2026-11-16. `crates/strata-core` and `crates/strata-image` do not exist yet; D00 T01 §2 creates them empty. No image can be read.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 2 (image formats in scope), section 3 (the `ewf` crate, hashing crates), section 4.1 (the layer model and provenance) and section 4.4 (integrity rules).
- `design/SPEC.md` A3: the refusals for a missing image, an unrecognised format and a missing E01 segment, whose facts the error types here must carry.
- The fixture image and manifest from D00 T01 §4, through `strata-testkit` (D00 T01 §5).

## Outcome

- `strata_image::open(path)` returns a `Layer` for raw, split raw, fixed VHD and E01 images, and a typed error naming the cause for anything else.
- Hashing the fixture VHD content and the fixture E01 gives the same MD5 and SHA-256, equal to the manifest's.
- No function in either crate can open a file for writing.

**Adjacency:** all=not-applicable (library layer with no user records, whose surfaces are owned by the CLI and desktop files)

**Adjacency rationale:** The CLI commands `image info` and `image verify` (D07 T01 §2) and the desktop Overview (D08 T02 §1) present what this file computes. Nothing here creates a record, so nothing needs listing or reversing.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | Layer trait, layer ids, provenance and error types | D00 T01 §2 | [ ] |
| 2 | §2 | Raw and split raw image reader | §1 | [ ] |
| 3 | §3 | Fixed VHD reader | §2 | [ ] |
| 4 | §4 | E01 reader over the ewf crate | §1, D00 T01 §5 | [ ] |
| 5 | §5 | Format detection and one open function | §2, §3, §4 | [ ] |
| 6 | §6 | Streaming hashing and stored hash verification | §5 | [ ] |

## 1. Layer trait, layer ids, provenance and error types

Every later crate reads through one abstraction. Getting its shape right once (positional reads, a parent, a stable id) is what lets NTFS open a shadow copy exactly as it opens a live volume.

**Phase:** 1
**Needs:** none
**Surface:** no

**Build order:**

1. Define the trait and its companions in `crates/strata-core`. Done when: an in-memory layer passes the trait's contract tests.
2. Add the adapter to `Read + Seek`. Done when: a crate expecting `Read + Seek` reads through a `Layer`.

- [ ] Define `trait Layer: Send + Sync` in `crates/strata-core/src/layer.rs` with `id(&self) -> &LayerId`, `kind(&self) -> LayerKind`, `len(&self) -> u64`, `read_at(&self, offset: u64, buf: &mut [u8]) -> Result<usize>` and `parent(&self) -> Option<&Arc<dyn Layer>>` (foundation plan section 4.1). Done when: the crate compiles and the trait is object safe, proven by a test holding `Arc<dyn Layer>`.
- [ ] Define `LayerId` in `crates/strata-core/src/id.rs` as a validated path of segments (`img0`, `img0/p2`, `img0/p2/vss1`) with `parse`, `child(segment)`, `parent()` and `Display`. Done when: tests cover a round trip, a rejected empty segment and a rejected segment with a slash.
- [ ] Define `LayerKind` (`Image`, `Volume`, `FileSystem`, `Snapshot`, `Unallocated`) and `Provenance { layer: LayerId, offset: u64, image_offset: Option<u64>, source: BlockSource }` in `crates/strata-core/src/provenance.rs`, with `serde` derives. Done when: a test serialises one to JSON and reads it back equal.
- [ ] Define `enum Error` in `crates/strata-core/src/error.rs` with `thiserror`: `Io { path, source }`, `UnsupportedFormat { path, first_bytes }`, `MissingSegment { expected }`, `OutOfBounds { offset, len }`, `Corrupt { what, offset }`, `Unsupported { what }`, `NotFound { what, nearest }` and `Cancelled` (SPEC A3). Done when: each variant's `Display` text names the facts SPEC A3 lists for it.
- [ ] Add `LayerReader`, a cursor over `Arc<dyn Layer>` implementing `std::io::Read` and `Seek`, in `crates/strata-core/src/reader.rs`. Done when: a test reads an in-memory layer through it in pieces and gets the same bytes.
- [ ] Add `read_exact_at` as a provided method that loops until the buffer is full and returns `OutOfBounds` past the end. Done when: a test reading across the end gets `OutOfBounds` with the offset and length, never a short silent read.
- [ ] Commit: `core: Layer trait, layer ids, provenance and errors`

**Test checkpoint:** `cargo test -p strata-core` passes; the out-of-bounds test fails if `read_exact_at` is changed to return a short read.

## 2. Raw and split raw image reader

A raw image is the bytes of the disk. A split raw image is the same bytes cut into numbered files. Both must present one continuous address space.

**Phase:** 1
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the single-file reader in `crates/strata-image/src/raw.rs`. Done when: reads at arbitrary offsets match the file.
2. Implement segment discovery and the spanning reader. Done when: a read crossing a segment boundary returns the right bytes.

- [ ] Implement `RawImage` over one file opened with `File::open` (read-only), using positional reads (`FileExt::seek_read` on Windows, `read_at` on Unix) so concurrent readers share no cursor. Done when: a test reads three ranges of a generated 1 MB file and compares them. Cheaper substitute: a shared `File` behind a mutex with seek then read, which serialises every parallel scan.
- [ ] Implement `SplitRawImage` in `crates/strata-image/src/split.rs`: given the first segment (`.001`), discover `.002` onward until one is missing, record each length, and map an offset to a segment by binary search. Done when: a test over a file split into three uneven parts reads a range spanning all three.
- [ ] Refuse a gap in the numbering after later segments exist (for example `.001`, `.003`) with `MissingSegment` naming `.002`. Done when: a test asserts the error and the expected file name.
- [ ] Add a test in `crates/strata-image/tests/readonly.rs` asserting that the source tree of `strata-image` and `strata-core` contains no `OpenOptions` call with `write` or `append` and no `File::create` (foundation plan section 4.4). Done when: adding `File::create` to `raw.rs` in a scratch copy makes it fail.
- [ ] Commit: `image: raw and split raw readers`

**Test checkpoint:** `cargo test -p strata-image raw split readonly` passes; the boundary test fails if the segment lookup is off by one.

## 3. Fixed VHD reader

A fixed VHD is a raw image followed by a 512-byte footer that starts with `conectix`. Treating the footer as disk content would add a phantom sector and change the hash, and the fixture image is a fixed VHD.

**Phase:** 1
**Needs:** none
**Surface:** no

**Build order:**

1. Recognise the footer in `crates/strata-image/src/vhd.rs`. Done when: the layer length excludes it.
2. Refuse the VHD types that are out of scope. Done when: a dynamic VHD gives `Unsupported`.

- [ ] Implement `FixedVhdImage`: read the last 512 bytes, check the `conectix` cookie and disk type 2 (fixed), and expose a layer whose length is the file length minus 512. Done when: a test over a generated file with a hand-built footer reports the shorter length and refuses a read into the footer with `OutOfBounds`.
- [ ] Return `Unsupported { what: "dynamic or differencing VHD" }` for disk type 3 or 4 (foundation plan section 2 limits). Done when: a test with a type 3 footer asserts the error text.
- [ ] Commit: `image: fixed VHD reader`

**Test checkpoint:** `cargo test -p strata-image vhd` passes; the length test fails if the footer is counted as content.

## 4. E01 reader over the ewf crate

Most real evidence arrives as E01. The `ewf` crate gives `Read + Seek` over the decompressed content; this section wraps it as a `Layer` and surfaces the hashes the image stores.

**Phase:** 1
**Needs:** none
**Surface:** no

**Build order:**

1. Wrap the crate in `crates/strata-image/src/e01.rs`. Done when: the fixture E01 reads identically to the fixture VHD content.
2. Expose stored metadata. Done when: the stored MD5 equals the manifest's.

- [ ] Add the `ewf` crate at its latest release to `[workspace.dependencies]` and confirm `cargo deny check licenses` still passes. Done when: both commands exit 0 and `Cargo.lock` records the version.
- [ ] Implement `E01Image` holding a pool of `ewf` readers (one per thread, opened lazily) so `read_at` takes `&self` and parallel reads do not block each other. Done when: a test reading 64 random ranges from eight threads matches the same ranges read from the fixture VHD. Cheaper substitute: one reader behind a mutex, which the carving scan would serialise on.
- [ ] Expose `stored_hashes() -> StoredHashes { md5, sha1 }` and `segments() -> Vec<PathBuf>` from the image's metadata. Done when: a test asserts the stored MD5 equals `manifest().image_md5`.
- [ ] Map the crate's errors to `strata_core::Error`: a missing segment file to `MissingSegment` with the expected name, a bad section to `Corrupt` with its offset. Done when: a test that copies only the first of two segments to a scratch folder gets `MissingSegment`.
- [ ] Commit: `image: E01 reader`

**Test checkpoint:** `cargo test -p strata-image e01` passes with the fixture built; the comparison test fails if any read range differs from the VHD content.

## 5. Format detection and one open function

Callers should not choose a reader. Detection reads the bytes, never trusts the extension alone, and says what it saw when it refuses.

**Phase:** 1
**Needs:** none
**Surface:** no

**Build order:**

1. Implement detection in `crates/strata-image/src/detect.rs`. Done when: each supported format is identified from content.
2. Add `open`. Done when: one call returns the right reader as `Arc<dyn Layer>` with id `img0`.

- [ ] Implement `detect(path) -> ImageFormat` checking, in order: the EWF signature `EVF\x09\x0d\x0a\xff\x00` at offset 0, the `conectix` cookie in the last 512 bytes, a numeric extension with a following segment for split raw, then raw. Done when: tests identify one sample of each, including a raw file misnamed `.E01`, which is reported as raw.
- [ ] Refuse a file smaller than 512 bytes, and a file whose first bytes match a known unsupported container (`vhdxfile`, `KDMV`, `AFF4`), with `UnsupportedFormat` carrying the first 16 bytes (SPEC A3). Done when: a test with a `vhdxfile` header asserts the error names VHDX and lists the supported formats.
- [ ] Implement `open(path) -> Result<OpenedImage>` returning the layer plus `ImageInfo { format, size, segments, stored_hashes }`. Done when: a test opens the fixture VHD and E01 and both report the same `size`.
- [ ] Commit: `image: format detection and open`

**Test checkpoint:** `cargo test -p strata-image detect open` passes; the misnamed-file test fails if detection is changed to trust the extension.

## 6. Streaming hashing and stored hash verification

A hash that matches the acquisition hash is the first thing an examiner must be able to show. It is computed in one pass with bounded memory and reports progress so a multi-hour hash is visibly alive.

**Phase:** 1
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the hasher in `crates/strata-core/src/hash.rs`. Done when: MD5 and SHA-256 of a known buffer match published test vectors.
2. Implement verification in `crates/strata-image/src/verify.rs`. Done when: a matching, a mismatching and an absent stored hash each give their own result.

- [ ] Implement `hash_layer(layer, algorithms, progress, cancel)` reading 4 MB chunks and feeding `md-5`, `sha2` and `blake3` hashers in one pass, calling `progress(bytes_done, total)` per chunk and stopping with `Error::Cancelled` when the cancel flag is set. Done when: tests check the RFC 1321 and FIPS 180 vectors for `abc`, and a cancel set after the first chunk stops the run.
- [ ] Implement `verify(image) -> Verification { md5, sha256, stored, result }` where `result` is `Match`, `Mismatch` or `NoStoredHash`. Done when: the fixture E01 gives `Match` and the fixture VHD gives `NoStoredHash`.
- [ ] Prove `Mismatch`: copy the fixture E01 to scratch, flip one byte inside a data chunk, and verify. Done when: the result is `Mismatch` or a `Corrupt` error naming the chunk, never `Match`. Cheaper substitute: comparing the stored hash to itself, which always matches.
- [ ] Commit: `image: streaming hashes and stored hash verification`

**Test checkpoint:** `cargo test -p strata-core hash` and `cargo test -p strata-image verify` pass; the flipped-byte test fails if verification stops comparing computed against stored.

## Verification

- The fixture VHD content and the fixture E01 hash to the manifest's MD5 and SHA-256 through `strata_image::open` and `verify`.
- `cargo test -p strata-core -p strata-image` passes, including the read-only source test.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
