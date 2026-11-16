---
schema_version: 1
id: shadow-copies
domain: 03-shadow
status: active
title: "TODO-01 -- Shadow copies: catalog, stores and snapshot layers"
track: M3
---

# TODO-01 -- Shadow copies: catalog, stores and snapshot layers

> **Goal:** Every volume shadow copy on an NTFS volume appears as a snapshot layer that reads the volume as it was when the snapshot was taken, with each block's origin (shadow store or current volume) known, so the NTFS reader opens it like a live volume.

> **Current state:** Measured 2026-11-16. `crates/strata-vss` does not exist yet; D00 T01 §2 creates it empty. No Rust crate is used for this: the `vshadow` crate is AGPL-3.0 from 0.2.0 and exposes no per-block origin, so the reader is written here from the published format.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 3 (own reader in `strata-vss`), section 4.1 (snapshot provenance) and section 8 (Joachim Metz, "Volume Shadow Snapshot (VSS) format", libvshadow documentation: the source for every structure below).
- The volume layer and `LayerProvider` trait from D01 T02 §3; `NtfsVolume` from D02 T01.
- The fixture manifest's `snapshots` array (two snapshots with ids, creation times and full expected file lists) from D00 T01 §4.

## Outcome

- The fixture volume lists two snapshots with the manifest's ids and creation times.
- Opening NTFS on each snapshot layer and hashing every file gives the manifest's expected content for that snapshot, including files since modified or deleted on the live volume.
- A volume with no shadow copies yields no snapshot and no error.

**Adjacency:** all=not-applicable (library layer with no user records, whose surfaces are owned by the CLI and desktop files)

**Adjacency rationale:** Snapshots surface through `strata layers` (D07 T01 §3), the desktop Layers view (D08 T02 §2) and every view that takes a layer selector.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | VSS volume header and catalog parser | D01 T02 §3 | [ ] |
| 2 | §2 | Store block lists and bitmaps | §1 | [ ] |
| 3 | §3 | Snapshot layer with block resolution and provenance | §2 | [ ] |
| 4 | §4 | Snapshots in the layer tree | §3, D02 T01 §8, D07 T01 §4 | [ ] |

## 1. VSS volume header and catalog parser

The volume header sits at byte 7680 (0x1E00) of the volume and points at the catalog, a chain of 16384-byte blocks listing each snapshot and where its store lives.

**Phase:** 3
**Needs:** none
**Surface:** no

**Build order:**

1. Parse the header in `crates/strata-vss/src/header.rs`. Done when: the fixture's header yields a catalog offset.
2. Parse the catalog in `crates/strata-vss/src/catalog.rs`. Done when: two snapshots are listed with the manifest's times.

- [ ] Parse the volume header at offset `0x1E00`: check the VSS identifier GUID `3808876B-C176-4E48-B7AE-04046E6CC752`, read the version, record type and catalog offset (Metz, section "Volume header"). Done when: a test over the fixture volume returns a non-zero catalog offset, and a zeroed volume returns `Ok(None)`, meaning no shadow copies.
- [ ] Walk the catalog block chain: each block has a 128-byte header (identifier GUID, record type 2, relative offset, offset, next block offset) followed by 128-byte entries, and the chain ends when the next offset is zero. Bound the chain at 4096 blocks. Done when: a unit test with a block whose next offset points at itself returns `Corrupt` instead of looping.
- [ ] Decode catalog entry type 2 (volume size, store GUID, sequence number, flags, creation time as FILETIME) and type 3 (store block list offset, store GUID, store header offset, block range list offset, bitmap offset, previous bitmap offset), pairing them by store GUID into `SnapshotDescriptor`. Done when: a test asserts the fixture's two descriptors carry the manifest's snapshot ids and creation times.
- [ ] Order descriptors by sequence number, oldest first, and expose `catalog(volume) -> Result<Vec<SnapshotDescriptor>>`. Done when: a test asserts the order matches the manifest's.
- [ ] Commit: `vss: volume header and catalog parser`

**Test checkpoint:** `cargo test -p strata-vss header catalog` passes with the fixture built; the manifest comparison fails if entries are paired by position instead of by store GUID.

## 2. Store block lists and bitmaps

Each store lists the 16384-byte blocks it preserved: where the block was on the volume, and where its old content now sits in the store. Bitmaps record which blocks were in use when the snapshot was taken.

**Phase:** 3
**Needs:** none
**Surface:** no

**Build order:**

1. Parse the block list in `crates/strata-vss/src/store.rs`. Done when: descriptors load into a lookup map.
2. Parse the bitmaps. Done when: an unused block is distinguishable from an unchanged one.

- [ ] Parse the store block list chain (record type 3): 32-byte descriptors holding the original data block offset, the relative store data block offset, the store data block offset, flags and an allocation bitmap, skipping descriptors flagged not used (`0x4`). Done when: a test over the fixture's first store loads at least one descriptor, since the fixture script modified files after the snapshot.
- [ ] Build `BlockMap`: a map from original offset to descriptor, applying the format's rules for a later descriptor at the same offset (a regular descriptor replaces, an overlay descriptor with flag `0x2` merges its bitmap) as Metz, section "Block descriptor", states them. Done when: unit tests over hand-built descriptor lists cover replace, overlay merge and a forwarder (`0x1`).
- [ ] Parse the store bitmap and previous bitmap chains (record type 6) into `StoreBitmap` with `in_use(block_index)`. Done when: a unit test over a hand-built bitmap block answers three known bits.
- [ ] Parse the block range list (record type 5) and keep it for the store's own extent, so reads of the store's file area can be recognised. Done when: a test asserts the fixture store's ranges lie inside the volume.
- [ ] Bound every chain at a block count derived from the volume size and return `Corrupt` with the offset on overflow. Done when: a unit test with a looped chain returns the error.
- [ ] Commit: `vss: store block lists and bitmaps`

**Test checkpoint:** `cargo test -p strata-vss store` passes with the fixture built; the overlay test fails if an overlay descriptor replaces instead of merging.

## 3. Snapshot layer with block resolution and provenance

A read of the snapshot at an offset resolves block by block: from this snapshot's store if it preserved the block, else from each newer store in turn, else from the current volume. That chain is what the format means by copy on write, and the answer to "where did this byte come from" is recorded.

**Phase:** 3
**Needs:** none
**Surface:** no

**Build order:**

1. Implement resolution in `crates/strata-vss/src/snapshot.rs`. Done when: a block changed after the snapshot reads its old content.
2. Record the origin. Done when: provenance names the store or the current volume.

- [ ] Implement `SnapshotLayer` implementing `Layer` with kind `Snapshot`, id `<volume>/vss<n>` (n from 1, oldest first) and length equal to the snapshot's volume size. Done when: a test opens both fixture snapshots and their lengths equal the volume's.
- [ ] Implement `resolve(block_offset) -> BlockSource { Store { snapshot, store_offset }, CurrentVolume, Zero }`: look in this snapshot's `BlockMap`, follow forwarders, then try each newer snapshot's map in order, then fall back to the current volume; return `Zero` when the bitmaps mark the block unused at snapshot time (Metz, section "Reading a snapshot"). Done when: unit tests over two hand-built stores cover each branch.
- [ ] Implement `read_at` by splitting the range at 16384-byte block boundaries and reading each part from its resolved source, applying overlay bitmaps at 512-byte granularity. Done when: a test reads a range spanning two blocks with different sources and matches a hand-computed expectation.
- [ ] Cache each store's `BlockMap` and bitmaps behind `OnceLock` so they load once and reads take `&self`. Done when: a test reading from eight threads returns identical bytes and the block list is parsed once, counted by a test-only counter.
- [ ] Fill `Provenance.source` from `resolve` for the first block of a read and expose `SnapshotLayer::locate(offset)`. Done when: a test finds a block of a file modified after snapshot 1 reported as `Store`, and a block of an untouched file reported as `CurrentVolume`.
- [ ] Commit: `vss: snapshot layer with block resolution`

**Test checkpoint:** `cargo test -p strata-vss snapshot` passes with the fixture built; the modified-file test fails if resolution skips the store and reads the current volume.

## 4. Snapshots in the layer tree

The proof that the snapshot layer is right is that NTFS opens on it and every file hashes to what the manifest recorded at that moment. Registering snapshots as a `LayerProvider` puts them in the tree every interface shows.

**Phase:** 3
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the provider in `crates/strata-vss/src/provider.rs`. Done when: the fixture tree shows two snapshots under the volume.
2. Prove content end to end. Done when: both snapshots match the manifest file by file.

- [ ] Implement `VssProvider: LayerProvider` returning one `Snapshot` node per descriptor under an NTFS volume, each with descriptor JSON holding the snapshot id, creation time and store size. Done when: a test builds the fixture tree with the provider and finds `img0/p1/vss1` and `img0/p1/vss2`.
- [ ] Write `crates/strata-vss/tests/snapshot_content.rs`: open `NtfsVolume` on each snapshot layer, and for every file in the manifest's expected list for that snapshot, look it up and compare its SHA-256. Done when: it passes for both snapshots, including the three files modified and two deleted between them. Cheaper substitute: checking only that the snapshot opens, which passes when every block falls through to the current volume.
- [ ] Assert in the same test that a file deleted on the live volume after snapshot 2 is found, in use, in snapshot 2. Done when: the assertion passes.
- [ ] Return an empty list, not an error, for a volume whose VSS header is absent, and a `Corrupt` error carried on the volume node (the tree still builds) when the catalog is damaged. Done when: a test over a scratch copy with the catalog offset pointed past the volume still lists the volume and reports the error on it.
- [ ] Add `VssProvider` to the registry in `crates/strata-cli/src/providers.rs` (D07 T01 §3). Done when: `strata layers` on the fixture prints `img0/p1/vss1` and `img0/p1/vss2` with their creation times, and `strata fs ls <image> img0/p1/vss1 \docs` lists the snapshot's files, both asserted in `crates/strata-cli/tests/snapshots.rs`.
- [ ] Commit: `vss: snapshots as layers in the tree`

**Test checkpoint:** `cargo test -p strata-vss --test snapshot_content` passes with the fixture built; it fails if `SnapshotLayer::read_at` is replaced by a read of the current volume.

## Verification

- Both fixture snapshots open as NTFS and match the manifest file by file, on the fixture VHD and the fixture E01.
- `cargo test -p strata-vss` passes, and `cargo deny check licenses` shows no AGPL or GPL crate.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
