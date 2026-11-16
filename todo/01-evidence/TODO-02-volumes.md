---
schema_version: 1
id: volumes
domain: 01-evidence
status: active
title: "TODO-02 -- Volumes: partition tables and the layer tree"
track: M1
---

# TODO-02 -- Volumes: partition tables and the layer tree

> **Goal:** An opened image yields a tree of layers: one volume layer per partition from an MBR or GPT table, or one volume for an image with no table, each with a stable id and what kind of file system it appears to hold.

> **Current state:** Measured 2026-11-16. `crates/strata-volume` does not exist yet; D00 T01 §2 creates it empty. D01 T01 provides the image layer this file reads.

## Inputs

- `docs/plans/2026-11-16-strata-foundation.md` section 2 (MBR, GPT and unpartitioned volumes in scope), section 4.1 (layer ids) and section 8 (UEFI Specification chapter 5 for GPT, the classic MBR layout).
- `strata_core::Layer` and `strata_image::open` from D01 T01 §1 and §5.
- The fixture image (one GPT partition holding NTFS) from D00 T01 §4.

## Outcome

- `strata_volume::tree(image)` returns the image, its volumes and, for each, the detected file system kind.
- The fixture image yields exactly one volume `img0/p1` whose first sector is an NTFS boot sector.
- A corrupt table is reported with its offset and never panics.

**Adjacency:** all=not-applicable (library layer with no user records, whose surfaces are owned by the CLI and desktop files)

**Adjacency rationale:** The `strata layers` command (D07 T01 §3) and the desktop Layers view (D08 T02 §2) present this tree.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | MBR partition table parser | T01 §1 | [ ] |
| 2 | §2 | GPT partition table parser | T01 §1 | [ ] |
| 3 | §3 | Volume layers and the layer tree | §1, §2, T01 §5, D00 T01 §5 | [ ] |

## 1. MBR partition table parser

The MBR is one sector: four 16-byte entries at byte 446 and the signature `55 AA` at byte 510. Extended partitions chain further tables and must be followed, with a bound so a malicious loop cannot hang the parser.

**Phase:** 1
**Needs:** none
**Surface:** no

**Build order:**

1. Parse the primary table in `crates/strata-volume/src/mbr.rs`. Done when: a hand-built sector yields its four entries.
2. Follow extended partitions. Done when: a chain of three logical partitions is listed and a loop is refused.

- [ ] Define `MbrEntry { boot, kind: u8, first_lba: u32, sectors: u32 }` with `binrw` and parse the four entries after checking the `55 AA` signature. Done when: a test over the committed fixture `crates/strata-volume/tests/data/mbr-two-partitions.bin` yields two entries with the expected LBAs.
- [ ] Follow extended partitions (kinds `0x05`, `0x0F`, `0x85`) through their EBR chain, numbering logical partitions from 5, and stop after 128 links with `Corrupt { what: "EBR chain loop" }`. Done when: a test with a self-referencing EBR returns the error instead of looping.
- [ ] Reject entries that start beyond the image or overlap the table sector, reporting `Corrupt` with the entry's byte offset. Done when: a test with an out-of-range `first_lba` asserts the offset in the error.
- [ ] Recognise the protective MBR (one entry of kind `0xEE`) and return `Protective` so the caller reads GPT. Done when: a test over a protective sector asserts the variant.
- [ ] Commit: `volume: MBR partition table parser`

**Test checkpoint:** `cargo test -p strata-volume mbr` passes; the loop test fails if the link bound is removed.

## 2. GPT partition table parser

GPT keeps a header at LBA 1 and a backup at the last LBA, each with a CRC32. When the primary is damaged the backup is the evidence, so both are read and the result says which was used.

**Phase:** 1
**Needs:** none
**Surface:** no

**Build order:**

1. Parse and check the header in `crates/strata-volume/src/gpt.rs`. Done when: a valid header's CRC verifies.
2. Parse the entry array and fall back to the backup. Done when: a damaged primary still lists partitions.

- [ ] Parse the header (`EFI PART` signature, revision, header size, header CRC32, entry array LBA, entry count, entry size, array CRC32) and verify the header CRC with the CRC field zeroed (UEFI Specification 5.3.2). Done when: a test over `crates/strata-volume/tests/data/gpt-primary.bin` verifies, and a one-bit change fails the CRC.
- [ ] Parse the entry array into `GptEntry { type_guid, unique_guid, first_lba, last_lba, attributes, name }`, decoding the name from UTF-16LE, skipping all-zero type GUIDs, and verifying the array CRC. Done when: the test fixture yields one entry named `Basic data partition`.
- [ ] Bound the entry count at 1024 and the entry size to 128 through 512 bytes before allocating. Done when: a header claiming 4 billion entries is refused with `Corrupt` and the test's peak allocation stays small.
- [ ] Read the backup header at the last LBA when the primary fails its signature or CRC, and return `GptTable { entries, source: Primary | Backup, sector_size }`. Done when: a test that zeroes the primary header of a scratch copy gets the same entries with `source: Backup`.
- [ ] Support 512 and 4096 byte sectors by trying the header at byte 512 and then at byte 4096. Done when: a 4096-byte-sector test image parses.
- [ ] Commit: `volume: GPT partition table parser`

**Test checkpoint:** `cargo test -p strata-volume gpt` passes; the backup test fails if the fallback is removed.

## 3. Volume layers and the layer tree

This is where partitions become layers with ids, and where the tree that every interface shows is built. File system detection here is only a look at the boot sector; opening NTFS belongs to D02 T01.

**Phase:** 1
**Needs:** none
**Surface:** no

**Build order:**

1. Implement the slice layer in `crates/strata-volume/src/volume.rs`. Done when: a read at offset 0 of the volume returns the partition's first byte.
2. Build the tree in `crates/strata-volume/src/tree.rs`. Done when: the fixture gives the expected tree.

- [ ] Implement `VolumeLayer` as a bounded window over its parent with id `<parent>/p<n>`, translating offsets and filling `Provenance.image_offset`. Done when: a test reads the fixture's partition start through the volume and through the image at the computed offset and gets equal bytes.
- [ ] Implement `detect_fs(volume) -> FsKind` returning `Ntfs` when bytes 3 to 10 of the first sector are `NTFS    `, else `Unknown { first_bytes }`. Done when: the fixture volume is `Ntfs` and a zeroed volume is `Unknown`.
- [ ] Implement `tree(image) -> LayerTree`: try GPT when the MBR is protective, else MBR, else treat the whole image as volume `img0/p1` when its first sector is a file system boot sector. Done when: the fixture yields one `Volume` node `img0/p1` of kind `Ntfs`, and a raw NTFS volume with no table yields the same shape.
- [ ] Give `LayerTree` `get(&LayerId)`, `children(&LayerId)` and a depth-first iterator, and make `get` on an unknown id return the list of ids that exist (SPEC A3). Done when: a test asserts the error for `img0/p9` names `img0/p1`.
- [ ] Define `trait LayerProvider { fn children(&self, parent: &LayerNode) -> Result<Vec<LayerNode>> }` and let `tree` accept extra providers, so D03 T01 §4 can add snapshots without this crate depending on it. Done when: a test provider adds a fake child under the volume and it appears in the iterator.
- [ ] Commit: `volume: volume layers and the layer tree`

**Test checkpoint:** `cargo test -p strata-volume tree` passes with the fixture built; the offset test fails if the volume layer forgets to add the partition start.

## Verification

- `strata_volume::tree` on the fixture VHD and the fixture E01 gives the same tree.
- `cargo test -p strata-volume` passes.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
