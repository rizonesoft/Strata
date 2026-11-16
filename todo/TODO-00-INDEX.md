# TODO-00 -- Root Index

Governing documents: [docs/plans/2026-11-16-strata-foundation.md](../docs/plans/2026-11-16-strata-foundation.md) for architecture, technology and milestones, and [design/SPEC.md](../design/SPEC.md) for the interface. Generated plan: [implementation-plan.md](./implementation-plan.md).

## Active TODOs

| Domain | File | Scope |
| ------ | ---- | ----- |
| 00 | 00-workspace/TODO-01-repo-and-toolchain.md | Toolchain, Cargo workspace, checks, fixture image, test kit |
| 01 | 01-evidence/TODO-01-image-access.md | Layer model, raw, split raw, VHD and E01 readers, hashing |
| 01 | 01-evidence/TODO-02-volumes.md | MBR and GPT parsers, volume layers, the layer tree |
| 02 | 02-ntfs/TODO-01-ntfs-layer.md | Volume open, MFT, metadata, content, LZNT1, ADS, deleted, bitmap |
| 03 | 03-shadow/TODO-01-shadow-copies.md | VSS header, catalog, stores, snapshot layer, snapshots in the tree |
| 04 | 04-unallocated/TODO-01-record-carving.md | Unallocated layer, scan engine, MFT, USN and EVTX carvers |
| 05 | 05-timeline/TODO-01-case-store.md | DuckDB case store: schema, appends, audit log, bookmarks, queries |
| 05 | 05-timeline/TODO-02-artifact-parsers.md | MFT, USN, EVTX, registry, prefetch and LNK parsers into events |
| 05 | 05-timeline/TODO-03-ingest-pipeline.md | Ingest plan, per-layer stages, carving, progress, cancel, rerun |
| 06 | 06-analysis/TODO-01-cross-layer.md | File history across layers and layer comparison |
| 06 | 06-analysis/TODO-02-export-report.md | Timeline export, file extraction and the HTML report |
| 07 | 07-cli/TODO-01-cli.md | Every command of SPEC part A, with output, refusals and exit codes |
| 08 | 08-desktop/TODO-01-app-shell.md | Scaffold, tokens, bridge, frame, settings, start, new case, ingest |
| 08 | 08-desktop/TODO-02-views.md | Overview, Layers, Files, Timeline, History, Compare, Bookmarks, Audit |
| 09 | 09-release/TODO-01-release.md | Acceptance run, installer, user guide, licence, code signing |

## Completed TODOs
