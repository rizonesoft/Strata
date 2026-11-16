---
schema_version: 1
id: desktop-views
domain: 08-desktop
status: active
title: "TODO-02 -- Desktop views: every screen of an open case"
track: M7
---

# TODO-02 -- Desktop views: every screen of an open case

> **Goal:** Each of the eight views of an open case, and the Export and Report dialogs, works on real case data exactly as `design/SPEC.md` part B describes, stays responsive on a timeline of millions of events, and is fully usable from the keyboard.

> **Current state:** Measured 2026-11-16. Nothing exists. T01 provides the frame (each view route renders a placeholder empty state), the bridge, settings and the end-to-end harness over a case ingested from the fixture.

## Inputs

- `design/SPEC.md` B1 (rules for every screen), B6 (Overview), B7 (Layers), B8 (Files), B9 (Timeline), B10 (History), B11 (Compare) and B12 (Bookmarks, Audit log, Export, Report).
- `docs/plans/2026-11-16-strata-foundation.md` section 3 (TanStack Table, Virtual and Query).
- The bridge mechanism, `ApiError`, `SettingsProvider.formatTime`, base components and `DialogHost` from T01 §2 to §6; the engine and case functions from D05 and D06.

## Outcome

- Every control listed in SPEC B6 to B12 and B15 to B17 is present and working against the fixture case, proven by an end-to-end test on the rendered app.
- Every screen matches its mockup under the parity test of `design/CONTRACT.md` section 7.
- Scrolling the Timeline grid over a ten-million-event case stays smooth, with rows fetched by page.
- An automated accessibility scan of every view reports no serious or critical violation.

**Adjacency:** list=applicable @ §5; document=applicable @ §12; settings=applicable @ T01 §6; reporting=applicable @ §1; notifications=not-applicable (a single user offline tool has no recipients to notify); permissions=applicable @ §4; audit=applicable @ §11; exchange=applicable @ §12; reverse=applicable @ §10

**Adjacency rationale:** The Timeline is the list surface for events and Files for file records. The only records a user creates are bookmarks, added in §7 and removed in §7 and §10. The permission surface is the refusal to read evidence when it is missing (§4) and the overwrite refusal in the save dialogs (§12).

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | Overview view | T01 §9, T01 §12, D06 T01 §5, T03 §2 | [ ] |
| 2 | §2 | Layers view | T01 §7, T01 §11, T03 §2 | [ ] |
| 3 | §3 | Files view: tree, breadcrumb and table | T01 §7, T01 §11 | [ ] |
| 4 | §4 | Files view: details pane, hex preview and extract | §3, T01 §10, T03 §2 | [ ] |
| 5 | §5 | Timeline grid with paged virtual scrolling | T01 §7, T01 §11 | [ ] |
| 6 | §6 | Timeline filters, lane chart and density chart | §5, T01 §12 | [ ] |
| 7 | §7 | Event detail pane and bookmark toggle | §5, T03 §2 | [ ] |
| 8 | §8 | History view | §4, T03 §2 | [ ] |
| 9 | §9 | Compare view | §8, T01 §11, T01 §12, T03 §2 | [ ] |
| 10 | §10 | Bookmarks view | §7, T03 §2 | [ ] |
| 11 | §11 | Audit log view | T01 §7, T03 §2 | [ ] |
| 12 | §12 | Export and Report dialogs | §6, §10, T03 §2 | [ ] |
| 13 | §13 | Navigation, keyboard and accessibility pass | §1, §2, §9, §11, §12, §14, §15, §16 | [ ] |
| 14 | §14 | Deleted files view | T01 §12, D06 T01 §3, §4, T03 §2 | [ ] |
| 15 | §15 | Recent activity view | T01 §12, D06 T01 §4, §7, T03 §2 | [ ] |
| 16 | §16 | Disk map view | T01 §11, T01 §12, D06 T01 §6, §4, T03 §2 | [ ] |

## 1. Overview view

The landing page of a case: what the evidence is, whether it verified, what the case holds, and how it was built.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B6. Visual source: `design/ui/overview.html` and `design/ui/reference/overview.png`, bound by `design/CONTRACT.md`.
**Job:** Confirm at a glance that this is the right evidence, that it verified, and what the ingest found.
**Treatment:** A grid of cards: evidence (wide), layer summary, event counts as a horizontal bar chart, and the ingest runs table across the bottom.
**Chrome:** Copy buttons on the two hashes, Run ingest again.

**Build order:**

1. Add `overview_get` in `apps/desktop/src-tauri/src/commands/overview.rs`. Done when: it returns evidence, layer counts, kind counts and runs in one call.
2. Build `apps/desktop/src/views/Overview.tsx`. Done when: it shows the fixture case's real figures.

- [ ] Implement `overview_get` returning the evidence row, layer counts by kind, event counts by kind and the `ingest_runs` rows. Done when: a Rust test over the fixture case finds two snapshots and a non-zero `file.modified` count.
- [ ] Build the evidence card: path, format, size, MD5, SHA-256, a verification badge and a copy button per hash. Done when: an end-to-end test reads the SHA-256 on screen and it equals the manifest's.
- [ ] Build the layer summary card and the event count chart as plain styled bars with the count as text beside each, using tokens only. Done when: a test finds one bar per event kind present, each with an accessible label of kind and count.
- [ ] Build the ingest runs table: started, duration, options, result, warnings; a row with warnings expands to list them. Done when: a test over a case with a cancelled and a completed run shows both results.
- [ ] Implement Run ingest again: a small dialog with the four ingest checkboxes, then navigate to `/ingest`. Done when: an end-to-end test starts a second run and sees every stage `skipped`.
- [ ] Show an empty state when the case has no completed ingest, with Run ingest as its action. Done when: a test over a created-but-not-ingested case sees it.
- [ ] Add the Start here tiles (Browse files, Deleted files, Timeline, Recent activity, Compare layers, Disk map) as `LaunchTile` links. Done when: a test activates each by keyboard and lands on its view.
- [ ] Draw Events per day with `ActivityArea`, Events by family with `Donut` and its counted legend, When activity happens with `HourHeat` and its notice, and What each layer adds with `BarList`, from the aggregates of D06 T01 §5 through one `overview_charts` command. Done when: an end-to-end test on the fixture case reads the two snapshot markers and a family count that equals `strata case info`'s.
- [ ] Write the heat map's notice from the data: name the busiest cell outside 07:00 to 18:00 on weekdays when it is in the top one percent, and show no notice otherwise. Done when: tests cover both.
- [ ] Build this screen from `design/ui/overview.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/overview.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g overview` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: overview view`

**Test checkpoint:** `pnpm --dir apps/desktop e2e overview` passes with the fixture built; the hash test fails if the card shows the stored hash in place of the computed SHA-256.

## 2. Layers view

The structure of the evidence as a tree, and the way into the other views for one layer.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B7. Visual source: `design/ui/layers.html` and `design/ui/reference/layers.png`, bound by `design/CONTRACT.md`.
**Job:** See what the image contains, inspect one layer, and jump to its files or events.
**Treatment:** A tree on the left with an icon per kind; a details panel on the right as a key and value list.
**Chrome:** Tree (expand, collapse, select), Browse files, Show events, Copy layer id.

**Build order:**

1. Add `layers_list` in `apps/desktop/src-tauri/src/commands/layers.rs`. Done when: it returns the stored tree with per-layer counts.
2. Build `apps/desktop/src/views/Layers.tsx`. Done when: the fixture's layers show with their details.

- [ ] Implement `layers_list` returning each layer's id, parent, kind, offset, size, descriptor and its file and event counts. Done when: a Rust test finds `img0/p1/vss1` with a creation time in its descriptor.
- [ ] Build an accessible tree (`role="tree"`, arrow keys expand, collapse and move) with all nodes expanded at first. Done when: a Vitest test moves through the fixture-shaped tree by keyboard.
- [ ] Build the details panel: kind, id, offset, size; for a snapshot its creation time (through `formatTime`) and store size; for a file system its cluster size and MFT location; for the unallocated layer its free cluster count. Done when: an end-to-end test selects `vss1` and sees the manifest's creation time.
- [ ] Implement Browse files (enabled for NTFS layers; navigates to Files with that layer selected), Show events (navigates to Timeline with the layer filter set) and Copy layer id. Done when: an end-to-end test clicks each and lands in the right view with the layer applied.
- [ ] Draw the image to scale as a bar of its volumes with offsets, and the tree as nested blocks with the selected one outlined. Done when: a test finds one bar segment per volume with widths in proportion to their sizes.
- [ ] Show, for a snapshot, the meter of blocks read from shadow storage against the current volume, from a `layer_block_sources` command. Done when: the two shares sum to 100 percent on the fixture's `vss1`.
- [ ] Build this screen from `design/ui/layers.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/layers.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g layers` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: layers view`

**Test checkpoint:** `pnpm --dir apps/desktop e2e layers` passes with the fixture built; the navigation test fails if Browse files opens the live layer regardless of selection.

## 3. Files view: tree, breadcrumb and table

Browsing the file system of any layer, including deleted files, from stored file rows, so it works even when the evidence is not attached.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B8 rows: Layer selector, Directory tree, Breadcrumb, File table, Show deleted toggle, Filter box. Visual source: `design/ui/files.html` and `design/ui/reference/files.png`, bound by `design/CONTRACT.md`.
**Job:** Find a file in a chosen layer by walking folders or filtering names.
**Treatment:** Three columns: directory tree, file table, and the details pane built in §4. A toolbar above the table holds the layer selector, breadcrumb, deleted toggle and filter box.
**Chrome:** Layer selector, tree, breadcrumb, table (sortable columns), Show deleted, Filter box.

**Build order:**

1. Add the file commands in `apps/desktop/src-tauri/src/commands/files.rs`. Done when: a directory lists from the case.
2. Build `apps/desktop/src/views/Files.tsx`. Done when: the fixture's folders browse in each layer.

- [ ] Implement `files_list(layer, parent_ref, include_deleted, name_filter, sort, page)` and `files_children_dirs(layer, parent_ref)` over `Case::list_dir`. Done when: Rust tests list `\docs` in the live layer and in `vss1` and get the manifest's differing sets.
- [ ] Read the browsed layer from the core column's one-layer mode (T01 §11) in place of a selector, keeping the folder when the layer changes and showing an empty state naming the layer when the folder does not exist in it. Done when: a test focuses `vss1` on the core and the table lists that layer's `\docs`.
- [ ] Build the lazy directory tree: children load on expand, and a folder with no subfolders shows no expander. Done when: an end-to-end test expands `\Users` and sees `fixture`.
- [ ] Build the virtualised file table with columns name, size, modified, created and flags, sortable by each, with folders first. Done when: a test sorts by size both ways and checks the first row.
- [ ] Build the breadcrumb, each part navigating to that folder. Done when: a test clicks the root part from three levels down.
- [ ] Implement Show deleted: deleted records appear struck through with a `deleted` label for screen readers. Done when: an end-to-end test finds a manifest deleted file only with the toggle on.
- [ ] Implement the Filter box narrowing the current folder by name, debounced by 200 ms, with a clear button. Done when: a test types part of a name and sees only matches.
- [ ] Keep the layer, folder and selection in the URL so Back and cross-view links restore them. Done when: a test reloads the route and lands on the same folder and file.
- [ ] Add the layer glyph and the type icon as the first two columns, and show Created only when the table is 640 px wide or more. Done when: tests find a glyph whose label names the layers holding the file, and the column appearing at 640 px.
- [ ] Commit: `desktop: files view tree and table`

**Test checkpoint:** `pnpm --dir apps/desktop e2e files-browse` passes with the fixture built; the snapshot test fails if the table ignores the layer selector.

## 4. Files view: details pane, hex preview and extract

Everything about one file record, a look at its first bytes, and the way to take its content out.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B8 rows: Details pane, Hex preview, Extract button, History button, Show events button; B14 for missing evidence. Visual source: `design/ui/files.html` and `design/ui/reference/files.png`, bound by `design/CONTRACT.md`.
**Job:** Inspect a file's record and content, and extract it with a hash.
**Treatment:** A right-hand pane with sections: identity, timestamps as a two-column table (`$STANDARD_INFORMATION` beside `$FILE_NAME`, differing cells marked), streams, data runs, provenance, then a hex and ASCII preview in the mono font.
**Chrome:** Stream selector for the preview, Extract, History, Show events, copy buttons on path and MFT reference.

**Build order:**

1. Add `file_detail`, `file_preview` and `file_extract` to `apps/desktop/src-tauri/src/commands/files.rs`. Done when: each returns real data for a fixture file.
2. Build `apps/desktop/src/views/FileDetails.tsx`. Done when: the pane shows a fixture file fully.

- [ ] Implement `file_detail(layer, mft_ref)` returning the stored row plus, when evidence is attached, streams and data runs read live. Done when: a Rust test for the fixture's ADS file returns the `secret` stream.
- [ ] Implement `file_preview(layer, mft_ref, stream, length)` reading up to the Hex preview size setting, and `file_extract(layer, mft_ref, stream, out_path, force)` as a long operation through the engine's `extract`. Done when: a Rust test extracts from `vss1` and gets the manifest's snapshot 1 hash.
- [ ] Build the timestamps table marking any cell where the two sets differ with a warning colour token and the text `differs`. Done when: a Vitest test with one differing time sees exactly one marked cell.
- [ ] Build the hex preview: offset column, 16 bytes per row in hex, ASCII column, with a stream selector when the file has named streams. Done when: an end-to-end test selects a fixture text file and reads its first line in the ASCII column.
- [ ] Implement Extract: a save dialog, progress, then the bytes written and SHA-256 with a copy button; an existing target asks before replacing. Done when: an end-to-end test extracts a file and the shown hash equals the manifest's.
- [ ] For a deleted record show its recoverability, and for `Overwritten` require a second confirmation naming that the bytes belong to another file. Done when: a Vitest test with that state sees the confirmation.
- [ ] Disable preview and Extract when the evidence is missing, each with a tooltip naming the image and the Locate action (B14). Done when: an end-to-end test on a case opened without evidence finds both disabled with that text.
- [ ] Implement History (navigates to History for this file) and Show events (navigates to Timeline with the path filter set). Done when: a test clicks each and lands with the file applied.
- [ ] Build This file through the core: one line per layer from `history_get`, the browsed layer set out in the accent, each saying what happened there. Done when: a test on the manifest's modified file reads a different size on two lines.
- [ ] Show the notice when the two modified times differ by more than a minute, stating the difference. Done when: tests cover a differing and an agreeing file.
- [ ] Build this screen from `design/ui/files.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/files.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g files` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: file details, hex preview and extract`

**Test checkpoint:** `pnpm --dir apps/desktop e2e files-detail` passes with the fixture built; the extract test fails if extraction reads the live layer when a snapshot is selected.

## 5. Timeline grid with paged virtual scrolling

The central view. It must scroll through millions of rows without loading them, so rows are fetched a page at a time as they come into view.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B9 rows: Event grid, Result count; B1 keyboard rules. Visual source: `design/ui/timeline.html` and `design/ui/reference/timeline.png`, bound by `design/CONTRACT.md`.
**Job:** Read what happened in order, and move through a very large timeline quickly.
**Treatment:** A dense full-height grid: time, kind (as a coloured tag), summary, path, layers (as small tags). The selected row is highlighted and drives the detail pane in §7.
**Chrome:** Column headers (time sorts ascending or descending, with the time zone shown), row selection, result count.

**Build order:**

1. Add `timeline_page` and `timeline_count` in `apps/desktop/src-tauri/src/commands/timeline.rs`. Done when: pages return from the case.
2. Build `apps/desktop/src/views/Timeline.tsx` with the virtual grid. Done when: the fixture timeline scrolls end to end.

- [ ] Implement `timeline_page(filter, page)` and `timeline_count(filter)` over `Case::timeline`. Done when: a Rust test pages through the fixture timeline and the pages concatenate to the full ordered result.
- [ ] Build the grid with TanStack Virtual over `timeline_count` rows, fetching pages of 500 through TanStack Query keyed by filter, sort and page index, keeping at most 20 pages cached and showing a skeleton row until its page arrives. Done when: a Vitest test with a mocked API scrolls to row 100000 and sees exactly the page holding it requested.
- [ ] Cancel requests for pages scrolled past before they return. Done when: a test flinging the scroll position sees no more than three requests in flight.
- [ ] Render times through `formatTime` with the zone in the column header, kinds as tags with a text label, and layers as tags. Done when: an end-to-end test changes the time zone setting and sees the header and cells change.
- [ ] Implement time sort ascending and descending from the header. Done when: an end-to-end test toggles it and compares the first row with the manifest's earliest and latest events.
- [ ] Implement keyboard navigation: Up, Down, Page Up, Page Down, Home and End move the selection and scroll it into view. Done when: a test presses End and the last event is selected and visible.
- [ ] Show the result count as matching and total, and an empty state with Clear filters when nothing matches. Done when: a test with a no-match filter sees `0 of N` and the action.
- [ ] Measure on the ten-million-event case from D05 T01 §7: record frames during a ten-second scripted scroll. Done when: the 95th percentile frame time is under 33 ms and the figure is written into this section as a dated note.
- [ ] Add the layer glyph as the first column and render each kind as a tag with its family dot. Done when: a test finds a glyph labelled with the row's layers and a dot in the family token.
- [ ] Commit: `desktop: timeline grid with paged virtual scrolling`

**Test checkpoint:** `pnpm --dir apps/desktop test Timeline` and `pnpm --dir apps/desktop e2e timeline-grid` pass with the fixture built; the paging test fails if the grid requests every page up front.

## 6. Timeline filters, lane chart and density chart

Narrowing the timeline, and seeing where in time the activity is.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B9 rows: Time range, Kind filter, Layer filter, Path filter, Text filter, Bookmarked only, Clear filters, Density strip. Visual source: `design/ui/timeline.html` and `design/ui/reference/timeline.png`, bound by `design/CONTRACT.md`.
**Job:** Cut the timeline down to the period, kinds, layers and files that matter.
**Treatment:** A filter bar above the grid: time range with a presets menu, two multi-select popovers showing counts, two text boxes, a toggle and Clear. Under it, a 48 px histogram strip spanning the filtered range.
**Chrome:** From, To, presets (All, Last day, Last week, Last month of evidence), Kind multi-select, Layer multi-select, Path glob, Text, Bookmarked only, Clear filters, density strip with drag selection.

**Build order:**

1. Add `timeline_facets` and `timeline_density` to the timeline commands. Done when: counts per kind and buckets return for a filter.
2. Build `apps/desktop/src/views/TimelineFilters.tsx` and `DensityStrip.tsx`. Done when: each control narrows the grid.

- [ ] Implement `timeline_facets(filter)` (counts per kind and per layer, each computed with that facet's own filter lifted) and `timeline_density(filter, buckets)`. Done when: Rust tests check facet counts sum correctly and buckets sum to the count.
- [ ] Hold the filter in the URL query so it survives navigation and can be set by links from other views. Done when: a test loads a URL with a layer and path and sees both controls filled and the grid filtered.
- [ ] Build From and To as date-time fields in the display time zone, with presets computed from the evidence's latest event, and refuse From later than To with a message under the field. Done when: a test picks Last week and sees the range end at the latest event.
- [ ] Build the Kind multi-select with counts, select all and none, and take the layer filter from the core column's all-layers mode (T01 §11), kept in the same URL query. Done when: an end-to-end test selects `program.run` alone and the grid count equals the manifest's prefetch run count.
- [ ] Build Path and Text boxes, debounced by 300 ms, with a hint for glob syntax under Path. Done when: a test types `\docs\*` and sees only events under that folder.
- [ ] Build Bookmarked only and Clear filters. Done when: a test sets every filter, clears, and the URL query is empty.
- [ ] Place `LaneChart` over `DensityChart` (T01 §12) above the grid, both spanning the filtered range, the lane cursor following the selected event; dragging across the density chart sets From and To, and a double click resets the range. Done when: an end-to-end test drags over the tallest region and the result count drops.
- [ ] Commit: `desktop: timeline filters and density strip`

**Test checkpoint:** `pnpm --dir apps/desktop e2e timeline-filters` passes with the fixture built; the kind test fails if a facet count is computed with its own filter applied.

## 7. Event detail pane and bookmark toggle

One event in full, where it came from down to the byte, and the examiner's mark on it.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B9 rows: Detail pane, Bookmark toggle, Copy row, Go to file. Visual source: `design/ui/timeline.html` and `design/ui/reference/timeline.png`, bound by `design/CONTRACT.md`.
**Job:** Understand one event completely, and mark it with a note.
**Treatment:** A resizable pane beside the grid: header with time and kind, a field list, the detail JSON as a collapsible tree, a provenance block (layers seen in, layer offset, image offset, block source), and the bookmark control with its note.
**Chrome:** Bookmark toggle, note field, Copy row, Go to file, pane resize handle.

**Build order:**

1. Add `event_get`, `bookmark_add`, `bookmark_set_note` and `bookmark_remove` in `apps/desktop/src-tauri/src/commands/events.rs`. Done when: each round-trips on the fixture case.
2. Build `apps/desktop/src/views/EventDetail.tsx`. Done when: selecting a row fills the pane.

- [ ] Implement the four commands over the case store. Done when: Rust tests add, edit and remove a bookmark and find three audit rows.
- [ ] Build the field list and the JSON tree, with long strings wrapped and a copy button per value. Done when: an end-to-end test selects the manifest's sample EVTX event and reads its event data in the tree.
- [ ] Build the provenance block showing every layer the event was seen in, the layer offset and image offset in decimal and hex, and whether a snapshot block came from the shadow store. Done when: a test over an event seen in three layers lists all three.
- [ ] Build the bookmark toggle and note field: toggling on adds a bookmark, the note saves on blur and on Enter, toggling off asks before removing a bookmark that has a note. Done when: an end-to-end test bookmarks an event with a note, reloads the case and sees both.
- [ ] Mark bookmarked rows in the grid with an icon that has an accessible label. Done when: the row shows the mark immediately after toggling, without a refetch of the page.
- [ ] Implement Copy row (the event as JSON to the clipboard) and Go to file (navigates to Files at the event's file in the event's first layer, disabled with a reason when the event has no file). Done when: tests cover both, including the disabled case.
- [ ] Build Where it is in the core: one line per layer saying present or not present, the layer that holds the event set out in the accent with its image offset. Done when: a test over an event seen only in unallocated space finds three not present lines and one accent line.
- [ ] Bind `B` to toggle the bookmark of the selected event. Done when: a test presses `B` twice and the mark appears and goes.
- [ ] Compare Timeline in the light theme and at 1100 by 700 as well (`timeline-light` and `timeline-narrow`). Done when: both parity cases pass.
- [ ] Build this screen from `design/ui/timeline.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/timeline.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g timeline` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: event detail pane and bookmark toggle`

**Test checkpoint:** `pnpm --dir apps/desktop e2e event-detail` passes with the fixture built; the reload test fails if the note is held in frontend state only.

## 8. History view

One file followed through every layer: the view that shows what the shadow copies remember.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B10. Visual source: `design/ui/history.html` and `design/ui/reference/history.png`, bound by `design/CONTRACT.md`.
**Job:** See every version of a file that the evidence holds and what changed between them.
**Treatment:** A picker row on top; below it a table with one row per layer, oldest first, where each cell that changed from the row above is highlighted and a Changes column names the changes in words; carved records in a separate table underneath.
**Chrome:** File picker (path or MFT reference), Open in Files per row, Show events, the carved records table.

**Build order:**

1. Add `history_get` in `apps/desktop/src-tauri/src/commands/history.rs`. Done when: it returns the engine's `FileHistory`.
2. Build `apps/desktop/src/views/History.tsx`. Done when: a fixture file's versions show with changes marked.

- [ ] Implement `history_get(selector)` over the engine's `history`. Done when: a Rust test returns three rows for a manifest file present throughout.
- [ ] Build the picker accepting a path or `entry-sequence`, prefilled from the URL when opened from Files, with a not-found message naming the input. Done when: tests cover both forms and the miss.
- [ ] Build the versions table: layer, layer time, exists, size, modified, content hash (or `not hashed` with a hint about the Hash file content option), changes. Done when: an end-to-end test on a manifest file modified between snapshots sees `Modified` on the right row and its size cell highlighted.
- [ ] Mark changed cells with a background token and a text marker, never colour alone. Done when: a Vitest test finds the marker text in a changed cell.
- [ ] Build the carved records table under the main one, with a line explaining that their position in time is unknown. Done when: a test with one carved row sees the table and the explanation; with none, the section is absent.
- [ ] Implement Open in Files per row (that layer, that file) and Show events (Timeline filtered to the path). Done when: tests click each and land correctly.
- [ ] Show an empty state before a file is chosen, saying how to pick one. Done when: a test opening History directly sees it.
- [ ] Build the version track: one card per layer on a line, oldest first, changed values marked with `.chg`, cards for layers without the file dashed, and the notice when content changed while the modified time did not. Done when: an end-to-end test on the manifest's modified file finds the marked size on the second card.
- [ ] Build this screen from `design/ui/history.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/history.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g history` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: history view`

**Test checkpoint:** `pnpm --dir apps/desktop e2e history` passes with the fixture built; the highlight test fails if changes are computed against the live layer instead of the previous row.

## 9. Compare view

Two layers side by side as three lists: what appeared, what vanished, what changed.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B11. Visual source: `design/ui/compare.html` and `design/ui/reference/compare.png`, bound by `design/CONTRACT.md`.
**Job:** Find out what happened on the volume between two points in time.
**Treatment:** Two layer selectors and a Compare button on top; three tabs with counts; each tab a virtualised table of path, size and modified in A and in B.
**Chrome:** Layer A, Layer B, Compare, tabs Added, Removed, Modified, Path filter, History for the selected row.

**Build order:**

1. Add `diff_get` in `apps/desktop/src-tauri/src/commands/diff.rs`. Done when: it returns the engine's `LayerDiff` by page.
2. Build `apps/desktop/src/views/Compare.tsx`. Done when: the fixture's snapshot and live layers compare.

- [ ] Implement `diff_get(a, b, filter, set, page)` over the engine's `diff`. Done when: a Rust test comparing `vss1` with the live layer returns the manifest's counts.
- [ ] Build the two selectors as chips tagged A and B, in step with the core column's pair mode (T01 §11), defaulting to the oldest snapshot and the live layer, with Compare disabled while both are the same layer. Done when: a test sees the defaults and the disabled state.
- [ ] Build the three tabs with counts and paged virtual tables. Done when: an end-to-end test compares `vss1` with live and finds a manifest added file under Added, a removed one under Removed and a modified one under Modified.
- [ ] Build the Path filter applied to all three tabs and their counts. Done when: a test filters to `\docs\*` and the counts fall.
- [ ] Implement History for the selected row. Done when: a test selects a modified row and lands on History for that file.
- [ ] Show the engine's not-ingested refusal as a panel with a Run ingest action. Done when: a test with that error code sees the panel and action.
- [ ] Build the summary bar (added, removed, modified, unchanged, with its not to scale note) and the Folders that changed most `BarList` from a `diff_summary` command. Done when: the four counts equal the tab counts plus the unchanged total.
- [ ] Build this screen from `design/ui/compare.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/compare.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g compare` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: compare view`

**Test checkpoint:** `pnpm --dir apps/desktop e2e compare` passes with the fixture built; the test fails if the Added and Removed tabs are swapped.

## 10. Bookmarks view

Every mark the examiner has made, in one place, to review, annotate and prune before reporting.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B12, Bookmarks paragraph. Visual source: `design/ui/bookmarks.html` and `design/ui/reference/bookmarks.png`, bound by `design/CONTRACT.md`.
**Job:** Review and tidy bookmarks, and jump back to any of them.
**Treatment:** A table: event time, kind, summary, note (editable in place), created.
**Chrome:** Inline note edit, Remove with confirmation, Go to event.

**Build order:**

1. Add `bookmarks_list` to `apps/desktop/src-tauri/src/commands/events.rs`. Done when: it returns bookmarks with their events.
2. Build `apps/desktop/src/views/Bookmarks.tsx`. Done when: bookmarks made in the Timeline appear.

- [ ] Implement `bookmarks_list` over `Case::bookmarks`. Done when: a Rust test lists two in event time order.
- [ ] Build the table with inline note editing: Enter or blur saves, Escape reverts. Done when: an end-to-end test edits a note, switches view and back, and sees it kept.
- [ ] Implement Remove with a confirmation naming the event. Done when: a test confirms and the row is gone, and cancels and it stays.
- [ ] Implement Go to event: navigate to Timeline with filters cleared, sorted by time, scrolled to and selecting that event. Done when: an end-to-end test lands on the Timeline with the event selected and its detail pane open.
- [ ] Add `timeline_position(event_id, filter, sort)` returning the event's row index so the grid can scroll to it. Done when: a Rust test returns the right index for the first, a middle and the last event.
- [ ] Show an empty state explaining how to bookmark from the Timeline. Done when: a fresh case shows it.
- [ ] Build the strip showing where the bookmarks fall across their time span, and the Report from bookmarks button that opens the Report dialog with that scope. Done when: a test with three bookmarks finds three marks in time order and the dialog opening with Bookmarked chosen.
- [ ] Build this screen from `design/ui/bookmarks.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/bookmarks.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g bookmarks` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: bookmarks view`

**Test checkpoint:** `pnpm --dir apps/desktop e2e bookmarks` passes with the fixture built; the Go to event test fails if the grid scrolls to the wrong row index.

## 11. Audit log view

How the case was worked, readable by the examiner and exportable for the record.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B12, Audit log paragraph. Visual source: `design/ui/audit.html` and `design/ui/reference/audit.png`, bound by `design/CONTRACT.md`.
**Job:** Show what was done to the case, by whom and when.
**Treatment:** A read-only virtualised table: time, actor, action, parameters (truncated, expandable), result.
**Chrome:** Text filter, Export as CSV, a chain status line.

**Build order:**

1. Add `audit_page`, `audit_verify` and `audit_export` in `apps/desktop/src-tauri/src/commands/audit.rs`. Done when: the log pages and exports.
2. Build `apps/desktop/src/views/AuditLog.tsx`. Done when: actions taken in a test appear.

- [ ] Implement the three commands; `audit_export` writes CSV through the engine's `OutputFile` and itself writes an `audit.export` row. Done when: a Rust test exports and finds the new row and a file hash that matches.
- [ ] Build the table with newest first, a text filter over action and parameters, and expandable parameters. Done when: an end-to-end test adds a bookmark, opens the view and sees `bookmark.add` at the top.
- [ ] Show the chain status line from `audit_verify`: `log intact` or `log altered at row N`. Done when: a test with a broken-chain response shows the row number in a danger colour token with an icon.
- [ ] Implement Export as CSV with a save dialog, showing rows written and SHA-256. Done when: an end-to-end test exports and the file holds a header and at least one row.
- [ ] Offer no control that edits or deletes a row. Done when: a test asserts the table has no editable cell and no row action.
- [ ] Hide the core column on this view (`design/CONTRACT.md` section 6). Done when: a test on `/case/audit` finds no `.core` element.
- [ ] Build this screen from `design/ui/audit.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/audit.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g audit` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: audit log view`

**Test checkpoint:** `pnpm --dir apps/desktop e2e audit` passes with the fixture built; the test fails if an action taken in the app does not appear in the log.

## 12. Export and Report dialogs

The two ways findings leave the app, reachable from the top bar in every view.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B12, Export dialog and Report dialog paragraphs; B5 rows Export and Report. Visual source: `design/ui/export.html` and `design/ui/reference/export.png`, bound by `design/CONTRACT.md`.
**Job:** Write the timeline to a file, or produce the report, and get the file's hash.
**Treatment:** Two dialogs of the same shape: options at the top, an output path with a Browse button, a primary action, then a progress bar and a result block with the path, count and SHA-256.
**Chrome:** Export: scope (current Timeline filters, everything), format (CSV, JSONL), output path, Export, Cancel. Report: title, scope (bookmarked events, current Timeline filters), include audit log excerpt, output path, Generate, Open, Cancel.

**Build order:**

1. Add `export_timeline` and `report_generate` in `apps/desktop/src-tauri/src/commands/export.rs`. Done when: both run as long operations.
2. Build `apps/desktop/src/app/ExportDialog.tsx` and `ReportDialog.tsx` and register them in `DialogHost`. Done when: both produce files from the fixture case.

- [ ] Implement the two commands as long operations over the engine's `export_timeline` and `report`. Done when: Rust tests produce a CSV and a report and each returns a hash equal to the file's.
- [ ] Build the Export dialog; the "current Timeline filters" scope reads the filter from the Timeline's URL state and summarises it in words. Done when: an end-to-end test sets a kind filter, exports with that scope, and the CSV row count equals the grid's result count.
- [ ] Build the Report dialog with title defaulting to the case name, and the bookmarked scope disabled with a reason when the case has no bookmarks. Done when: an end-to-end test bookmarks two events, generates, and the file contains both summaries.
- [ ] Ask before replacing an existing output file and pass `force` only on confirmation. Done when: a test exports twice to the same path, sees the question, and the file is replaced only after confirming.
- [ ] Show progress with Cancel during the write, and on cancel leave no partial file at the target. Done when: a test cancels a slow export and the target path does not exist.
- [ ] Show the result block with copy buttons, and Open on the report result through the `opener` plugin. Done when: a test sees the SHA-256 and clicks Open with a mocked opener.
- [ ] Build the scope and format choices as `.opt` cards, as the mockup shows, each stating what it will write. Done when: a test selects each and reads its count line.
- [ ] Build this screen from `design/ui/export.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/export.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g export` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: export and report dialogs`

**Test checkpoint:** `pnpm --dir apps/desktop e2e export-report` passes with the fixture built; the count test fails if the export ignores the Timeline's filters.

## 13. Navigation, keyboard and accessibility pass

The rules in SPEC B1 apply to every screen. This section checks them across the finished app and fixes what the check finds.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B1 (keyboard navigation, focus states, accessible names, progress and cancel on long operations, actionable failures, empty states) and every cross-view link in B7 to B12.
**Job:** Use the whole app without a mouse, with a screen reader, and without ever meeting a dead end.
**Treatment:** No new surface: consistent focus order, focus returned to its origin when a dialog closes, and a live region announcing result counts and operation results.
**Chrome:** A shortcut help overlay on `?` listing every shortcut.

**Build order:**

1. Write the checks in `apps/desktop/e2e/a11y.spec.ts` and `links.spec.ts`. Done when: they run over every view.
2. Fix what they find. Done when: both pass.

- [ ] Add `@axe-core/playwright` and scan each of the eight views, the Start screen, the ingest screen and each dialog, in both themes, failing on serious or critical violations. Done when: the scan passes after fixing each finding at the component that caused it.
- [ ] Write a keyboard-only journey: open the fixture case, filter the Timeline to one kind, select an event, bookmark it with a note, open Bookmarks, go to the event, open Files for its file, extract it, generate a report. Done when: the test completes using key presses alone.
- [ ] Write a link test visiting every cross-view action in SPEC B7 to B12 (Browse files, Show events, History, Go to file, Open in Files, Go to event) and asserting the destination carries the right layer, path or event. Done when: every link passes.
- [ ] Return focus to the control that opened a dialog when it closes, and trap focus inside while open. Done when: a test opens and closes each dialog and checks `document.activeElement`.
- [ ] Add one `aria-live` region announcing result counts after a filter change and the result of exports, extractions and bookmark changes. Done when: a test changes a filter and reads the announced count.
- [ ] Build the shortcut help overlay listing the rail shortcuts, grid navigation and dialog keys. Done when: `?` opens it and Escape closes it.
- [ ] Read `design/SPEC.md` part B table by table and tick each control against a passing test in a checklist committed at `apps/desktop/e2e/SPEC-coverage.md`, one line per control naming its test. Done when: no control in B2 to B14 is without a named test.
- [ ] Commit: `desktop: navigation, keyboard and accessibility pass`

**Test checkpoint:** `bosun run -- pnpm --dir apps/desktop e2e a11y links keyboard` passes with the fixture built; the scan fails if a button loses its accessible name.

## 14. Deleted files view

Everything that was deleted, across every layer, with how much of it can still be read.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B15. Visual source: `design/ui/deleted.html` and `design/ui/reference/deleted.png`, bound by `design/CONTRACT.md`.
**Job:** Find deleted files worth recovering and take them out.
**Treatment:** Three summary cards (recoverability donut, folders, deletions over time), a filter row, then the table with a content meter per row.
**Chrome:** Recoverable only, type, folder and name filters; row selection; Extract selected; History, Show events and Open in Files per row.

**Build order:**

1. Add `deleted_page` and `deleted_summary` in `apps/desktop/src-tauri/src/commands/deleted.rs`. Done when: both return from the fixture case.
2. Build `apps/desktop/src/views/Deleted.tsx`. Done when: the manifest's deleted files are listed with their state.

- [ ] Implement the two commands over the engine's `deleted_files` and `deleted_summary`. Done when: a Rust test returns every manifest deleted file once.
- [ ] Build the three cards with `Donut`, `BarList` and `DensityChart`. Done when: an end-to-end test reads counts that sum to the row total.
- [ ] Build the filters, kept in the URL, each narrowing the table and the cards. Done when: Recoverable only hides the overwritten rows and the donut redraws.
- [ ] Build the virtualised table with the layer glyph, struck-through name, folder, size, deletion time, a content meter with its word (Intact, Resident, a percentage) and Last seen in. Done when: an end-to-end test finds a manifest deleted file marked Intact.
- [ ] Implement multi-selection (click, Shift click, Ctrl click, Space) and Extract selected into a chosen folder, refusing overwritten content with the reason per file in a result list. Done when: a test extracts two files and their hashes equal the manifest's.
- [ ] Implement the row actions History, Show events and Open in Files in the layer that last held the file. Done when: a test opens Files and lands in that layer on that file.
- [ ] Show the sidebar count from `deleted_summary`'s total. Done when: the count equals the unfiltered row total.
- [ ] Build this screen from `design/ui/deleted.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/deleted.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g deleted` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: deleted files view`

**Test checkpoint:** `pnpm --dir apps/desktop e2e deleted` passes with the fixture built; the extract test fails if an overwritten file is written out.

## 15. Recent activity view

One day of what the user and the system did, without writing a filter.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B16. Visual source: `design/ui/activity.html` and `design/ui/reference/activity.png`, bound by `design/CONTRACT.md`.
**Job:** See quickly what ran, who logged on, what was opened and what was set to start, on a chosen day.
**Treatment:** A strip of 14 day buttons, then four cards in a two by two grid, each with its icon in its family colour.
**Chrome:** Day strip; rows that open the Timeline at their event.

**Build order:**

1. Add `activity_days` and `activity_day` in `apps/desktop/src-tauri/src/commands/activity.rs`. Done when: a day returns its four lists.
2. Build `apps/desktop/src/views/Activity.tsx`. Done when: the fixture's day shows its known program and shortcut.

- [ ] Implement the two commands over the engine's activity queries, passing the display time zone from settings. Done when: a Rust test returns the fixture's prefetch executable on its run day.
- [ ] Build the day strip as a listbox, the newest day selected at first, with arrow key movement. Done when: a test moves two days back by keyboard and the cards refill.
- [ ] Build Programs run with `BarList`, the accent and the words first seen on programs in no snapshot. Done when: a test with one such program finds the accent bar and the words.
- [ ] Build Logons, Files opened and Services and start-up changes as lists, the accent on remote logons and on targets on removable volumes. Done when: a test finds the accent on a type 10 logon and not on a type 2.
- [ ] Make every row a link to the Timeline at that event. Done when: an end-to-end test follows one and lands with the event selected.
- [ ] Show an empty state per card when the day has none of that kind, and for the view when the case has no events. Done when: tests cover both.
- [ ] Build this screen from `design/ui/activity.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/activity.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g activity` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: recent activity view`

**Test checkpoint:** `pnpm --dir apps/desktop e2e activity` passes with the fixture built; the link test fails if a row opens the Timeline unfiltered at the top.

## 16. Disk map view

The volume drawn whole, with a way to look at any byte of it.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B17 and B14. Visual source: `design/ui/diskmap.html` and `design/ui/reference/diskmap.png`, bound by `design/CONTRACT.md`.
**Job:** See where data, free space, shadow storage and carved records lie, and read the raw bytes at any offset.
**Treatment:** A legend with shares and toggles, the cluster grid with its cluster axis, and a pane with the selected region's facts and a hex view.
**Chrome:** Go to offset; three toggles; cell selection; previous and next sector; Show its event; Save region.

**Build order:**

1. Add the disk map commands in `apps/desktop/src-tauri/src/commands/diskmap.rs`. Done when: cells, a cell's detail and a region's bytes return.
2. Build `apps/desktop/src/views/DiskMap.tsx`. Done when: the fixture volume draws and a carved offset decodes.

- [ ] Implement `diskmap_get`, `diskmap_locate`, `diskmap_cell`, `region_read`, `region_decode` and `region_save` over the engine's functions of D06 T01 §6. Done when: Rust tests cover each on the fixture case.
- [ ] Draw the grid with `ClusterMap` for the layer focused on the core column, with the legend's shares from the summary. Done when: an end-to-end test changes the focused layer and the free share changes.
- [ ] Implement the three toggles, each showing or hiding its overlay. Done when: a test turns Carved records off and no accent cell remains.
- [ ] Implement Go to offset accepting `0x` hex, decimal, and `c` followed by a cluster number, selecting the cell and scrolling it into view, with the refusal for an offset outside the volume under the field. Done when: tests cover the three forms and the refusal.
- [ ] Build the selection pane: cluster range, image offset, state in this layer and each snapshot, what was carved there. Done when: a test selects a cell with a carved record and reads its kind.
- [ ] Build the hex view with offset, hex and ASCII columns, previous and next sector, and the notice from `region_decode` when the bytes are a known record. Done when: an end-to-end test goes to a carved USN record's offset and reads its file name in the notice.
- [ ] Implement Show its event and Save region (save dialog, progress, SHA-256). Done when: a test saves one cell and the hash shown equals the file's.
- [ ] Disable the hex view, Go to offset's read and Save region when the evidence is missing, with the tooltip of B14, while the grid still draws from the stored map. Done when: a test on a case opened without evidence finds the grid and the disabled controls.
- [ ] Build this screen from `design/ui/diskmap.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/diskmap.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g diskmap` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: disk map view`

**Test checkpoint:** `pnpm --dir apps/desktop e2e diskmap` passes with the fixture built; the decode test fails if the hex view reads the live layer when a snapshot is focused.

## Verification

- Every control in SPEC B6 to B12 has a named passing test in `apps/desktop/e2e/SPEC-coverage.md`.
- The keyboard-only journey and the accessibility scan pass in both themes.
- `pnpm --dir apps/desktop lint`, `test` and `e2e` pass, and no app process remains after the suite.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
