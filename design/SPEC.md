# Strata interface specification

Decided 2026-11-16, part B revised 2026-11-17 for the chosen design. This is the governing document for both interfaces: the `strata` command line (part A) and the desktop app (part B). Architecture and technology are in [the foundation plan](../docs/plans/2026-11-16-strata-foundation.md). A control listed here is either working or owned by a named TODO section; nothing ships disabled without an owner.

## A. Command line

### A1. Rules for every command

- Form: `strata <command> [subcommand] [arguments] [options]`.
- `--json` prints one JSON document on stdout instead of text. Errors under `--json` are a JSON object with `error` and `code` on stderr.
- `--quiet` prints nothing but the result. `--verbose` adds progress and timing on stderr.
- `--help` on every command and subcommand, `--version` on the root.
- Times print as UTC in ISO 8601 unless `--tz <IANA name>` is given.
- A layer is named by its id, for example `img0/p2/vss1`.
- Exit codes: `0` success, `1` a result that is a negative answer (a hash mismatch, no rows), `2` bad usage, `3` evidence unreadable or unsupported, `4` case store error, `5` cancelled.
- No command writes to an evidence image. A command that writes a file refuses to overwrite one unless `--force` is given.

### A2. Commands

| Command | Does | Output |
| ------- | ---- | ------ |
| `strata image info <image>` | Reads format, size, segments, hashes | Format, bytes, segments, stored MD5 or SHA-1 |
| `strata image verify <image>` | Hashes it, compares to stored | Hashes, `match`, `mismatch` or `no stored hash` |
| `strata layers <image>` | Walks volumes, file systems, snapshots | A tree of layer ids with kind, offset, size |
| `strata fs ls <image> <layer> [path]` | Lists a directory | Name, size, modified, flags; `--deleted` |
| `strata fs stat <image> <layer> <path>` | Shows one file record | MFT reference, eight timestamps, streams, runs |
| `strata fs extract <image> <layer> <path> -o <file>` | Copies content out | Bytes and SHA-256; `--stream <name>` |
| `strata case create <dir> --image <image>` | Creates a case folder | Case path; `--name`, `--examiner` |
| `strata case ingest <dir>` | Runs the ingest | Stage progress, then counts; options below |
| `strata case info <dir>` | Summarises a case | Evidence, hashes, layers, counts, ingest runs |
| `strata timeline <dir>` | Queries events | Rows; filters and formats below |
| `strata history <dir> <path-or-mft-ref>` | Follows one file across layers | One row per layer with what differs |
| `strata diff <dir> <layer-a> <layer-b>` | Compares two layers | Added, removed, modified files; `--path` narrows |
| `strata bookmark add <dir> <event-id>` | Bookmarks an event | Bookmark id; `--note <text>` |
| `strata bookmark list <dir>` | Lists bookmarks | Id, event time, summary, note |
| `strata bookmark remove <dir> <bookmark-id>` | Removes a bookmark | Confirmation |
| `strata export <dir> -o <file>` | Writes the filtered timeline | Rows written and SHA-256; `--format csv` or `jsonl` |
| `strata report <dir> -o <file.html>` | Writes the HTML report | Path and SHA-256; `--bookmarked-only` |
| `strata audit <dir>` | Prints the audit log | Time, actor, action, result |

`case ingest` options: `--layer <id>` (repeatable, default every layer), `--no-snapshots`, `--no-carve`, `--hash-content` (SHA-256 of every file's content), `--threads <n>`. Ctrl+C cancels cleanly with exit code 5 and leaves the case consistent. Running it again adds only what is missing.

`fs ls --deleted` adds deleted records. `fs extract --stream <name>` reads an alternate data stream. `case create --no-verify` skips the hash check. `fs extract` also accepts a case folder in place of the image, which records the extraction in the audit log. `report` also takes `--title <text>` and `--no-audit` (leave out the audit excerpt). `audit --verify` checks the log's hash chain and exits 1 naming the first broken row. Any case command takes `--image <new path>` to relocate moved evidence.

`timeline` and `export` filters: `--from <time>`, `--to <time>`, `--kind <kind>` (repeatable), `--layer <id>` (repeatable), `--path <glob>`, `--text <substring>`, `--bookmarked`. `timeline` also takes `--limit <n>` (default 1000), `--offset <n>` and `--format table|csv|jsonl`.

### A3. Refusals

| Situation | Message names | Exit |
| --------- | ------------- | ---- |
| Image path missing or unreadable | The path and the OS error | 3 |
| Image format not recognised | The first bytes seen and the supported formats | 3 |
| E01 segment missing | The segment file expected | 3 |
| Layer id not found | The id and the ids that exist | 2 |
| Layer is not NTFS | The layer and its kind | 3 |
| Path not found in the layer | The path and the deepest part that exists | 1 |
| Case folder already holds a case | The folder | 4 |
| Case made by a newer Strata | The case schema version and this build's | 4 |
| Evidence moved since the case was created | The recorded path and `--image <new path>` to relocate it | 3 |
| Output file exists | The path and `--force` | 2 |

## B. Desktop app

### B0. The design this part describes

The owner chose the Core direction on 2026-11-17 and approved the full set of screens as presented: a module sidebar with icons, a launch pad on the Overview, the layer stack always on screen, and charts on every analytical view. Its mockups are in `design/ui/`, its tokens in `design/tokens/tokens.css`, and [CONTRACT.md](./CONTRACT.md) binds the app to them 1:1. This part says what each control does; the mockups say what it looks like.

### B1. Rules for every screen

- One window. Minimum size 1100 by 700. The layout is a top bar, a module sidebar, the core column (B18), a content area and a status bar. At 1240 px wide or less the sidebar and the core column collapse.
- Colours, spacing, type sizes and radii come only from `design/tokens/tokens.css`. No raw colour value appears on a control.
- Dark and light themes, following the system by default. Dark is the reference theme.
- Every table is keyboard navigable (arrows, Home, End, Page Up, Page Down) and every control has a visible focus state and an accessible name.
- Every long operation shows progress and can be cancelled. Every failure shows what failed, why, and what to do next.
- Times display in the time zone from Settings, with the zone shown in the column header.
- Empty states say what the view will hold and which action fills it.
- `Ctrl+1` to `Ctrl+9` switch to the first nine views, and `?` opens an overlay listing every shortcut.

### B2. Start screen

Shown when no case is open.

| Control | Behaviour |
| ------- | --------- |
| New case button | Opens the New case dialog (B3) |
| Open case button | Folder picker; opens the case or shows why it cannot (B14) |
| Recent cases list | Up to 10: name, folder, last opened. Click opens. Missing folders are marked |
| Remove from recents | Per row; removes the entry only, never the case |
| Settings button | Opens Settings (B13) |

### B3. New case dialog

| Control | Behaviour |
| ------- | --------- |
| Case name | Required text |
| Examiner | Optional text, remembered for next time |
| Case folder | Folder picker; must be empty or new |
| Evidence image | File picker for raw, split raw, VHD, E01; shows detected format and size |
| Verify image hash | Checkbox, on by default |
| Include shadow copies | Checkbox, on by default |
| Carve unallocated space | Checkbox, on by default |
| Hash file content | Checkbox, off by default; notes that it is slower |
| Create and ingest | Enabled when the form is valid; creates the case and opens Ingest (B4) |
| Cancel | Closes with nothing created |

Validation messages appear under the field they concern.

### B4. Ingest progress

| Control | Behaviour |
| ------- | --------- |
| Stage list | Verify, layers, files, artifacts, carving, indexing: each pending, running, done, failed, skipped |
| Progress bar | Per running stage, with counts and rate |
| Log panel | Collapsible; warnings and errors per artifact |
| Cancel button | Confirms, then stops cleanly; the case stays openable |
| Open case button | Appears when the run ends; goes to Overview (B6) |

### B5. Main window frame

| Control | Behaviour |
| ------- | --------- |
| Sidebar, group Case | Overview, Layers |
| Sidebar, group Examine | Files, Deleted files (with count), Timeline, Recent activity, History, Compare, Disk map |
| Sidebar, group Record | Bookmarks (with count), Audit log |
| Core column | One band per layer; behaviour in B18 |
| Top bar: case name | Shows the open case; menu with Close case and Open case folder |
| Top bar: Export | Opens the Export dialog (B12) |
| Top bar: Report | Opens the Report dialog (B12) |
| Top bar: Settings | Opens Settings (B13) |
| Status bar | Evidence file name, hash verification state, layer count, event count, time zone |

### B6. Overview

Evidence card (path, format, size, MD5, SHA-256 with copy buttons, verification badge). Start here: six launch tiles (Browse files, Deleted files, Timeline, Recent activity, Compare layers, Disk map). Events per day as an area chart with a marker at each shadow copy and at acquisition. Events by family as a donut with counts. When activity happens: a weekday by hour heat map with a notice naming the busiest unusual period. What each layer adds: bars for records in every layer, only in shadow copies, deleted with an intact record, and carved. Ingest runs table (started, duration, options, result, warnings; a row with warnings expands). A Run ingest again button opens the ingest options and then B4.

### B7. Layers

A bar showing the image's volumes to scale, then the layer tree as nested blocks; selecting one shows kind, id, offset, size and descriptor on the right, and for a snapshot a meter of how many blocks come from shadow storage (for a snapshot: creation time and store size; for a file system: cluster size and MFT location). Buttons: Browse files (goes to Files on that layer), Show events (goes to Timeline filtered to that layer), Copy layer id.

### B8. Files

| Control | Behaviour |
| ------- | --------- |
| Layer selector | The core column in one-layer mode: clicking a band browses that layer, keeping the folder |
| Directory tree | Lazy loaded; selecting a folder fills the table |
| Breadcrumb | The current path; each part is clickable |
| File table | Layer glyph, type icon, name, size, modified, flags; Created shows from 640 px of table width |
| Show deleted toggle | Adds deleted records, shown struck through |
| Filter box | Narrows the table by name |
| Details pane | The file through the core (a line per layer), a notice when the time sets disagree, both sets |
| Hex preview | First bytes of the selected stream (size from Settings) |
| Extract button | Save dialog; writes the content and shows its SHA-256 |
| History button | Opens History (B10) for this file |
| Show events button | Opens Timeline filtered to this path |

### B9. Timeline

| Control | Behaviour |
| ------- | --------- |
| Event grid | Layer glyph, time, kind tag, summary, path, bookmark mark; virtualised; sortable by time |
| Lane chart | One lane per event family over the filtered range, with a cursor at the selected event |
| Time range | From and to fields, plus presets (all, last day, week, month of evidence) |
| Kind filter | Multi-select of event kinds with counts |
| Layer filter | Multi-select of layers |
| Path filter | Glob text |
| Text filter | Substring over summary and detail |
| Bookmarked only | Toggle |
| Clear filters | Resets every filter |
| Density chart | Events over time stacked by layer; drag selects a time range, double click resets it |
| Result count | Rows matching, and total |
| Detail pane | Where the event is in the core (a line per layer), every field, detail JSON as a tree, offsets |
| Bookmark toggle | Adds or removes a bookmark on the selected event; note field |
| Copy row | Copies the event as JSON |
| Go to file | Opens Files at the event's file, in the event's layer |

### B10. History

A file picker (path or MFT reference, prefilled when opened from Files). A version track: one card per layer, oldest first, on a line, each naming the file, its size and hash with changed values marked, and a notice when content changed while the modified time did not. Below it a table with one row per layer the file appears in, ordered by layer time: layer, exists, size, modified, content hash when hashed, and what changed from the previous row (highlighted). Carved records for the same MFT reference are listed under the table. Buttons: Open in Files, Show events.

### B11. Compare

Two layer selectors and a Compare button; the core column marks the pair A and B. A summary bar of added, removed, modified and unchanged counts, and bars for the folders that changed most. Three tabs with counts: Added, Removed, Modified. Each is a virtualised table (path, size, modified in A, modified in B). A path filter narrows all three. Selecting a row and pressing History opens B10.

### B12. Bookmarks, Audit log, Export and Report

Bookmarks: a strip showing where the bookmarks fall in time, a Report from bookmarks button, and a table (layer glyph, event time, kind, summary, note). Edit note inline, Remove with confirmation, Go to event (opens Timeline at that event).

Audit log: a read-only virtualised table (time, actor, action, parameters, result) with a text filter, an Export button that writes it as CSV, and a status line saying whether the log's hash chain is intact.

Export dialog: scope (current Timeline filters, or everything), format (CSV or JSONL), output path, Export. Shows rows written and SHA-256 when done.

Report dialog: title, scope (bookmarked events only, or current Timeline filters), include audit log excerpt (checkbox), output path, Generate. Shows the path and SHA-256, with an Open button.

### B13. Settings

| Setting | Values | Used by |
| ------- | ------ | ------- |
| Time zone | UTC, system, or an IANA name | Every displayed time |
| Timestamp format | ISO 8601, or locale | Every displayed time |
| Theme | System, light, dark | The whole app |
| Worker threads | 1 to the number of cores | Ingest |
| Hex preview size | 256 bytes to 64 KB | Files details pane |
| Default examiner | Text | New case dialog |

Settings are per user, stored in the app's config folder, applied without a restart, and each has a Reset to default. An About link in the dialog shows the Strata version, its licence and the third-party notices.

### B14. Error states

| Situation | The app shows |
| --------- | ------------- |
| Case folder is not a case | The folder and what is missing |
| Case made by a newer Strata | Both versions and that an update is needed |
| Evidence image moved | The recorded path, Locate (accepted only when the hash matches) and Continue without evidence |
| Image unreadable or unsupported | The reason and the supported formats |
| Ingest stage failed | The stage, the error, and Retry stage |
| A parser rejected an artifact | A warning row in the ingest log; the run continues |

A case opened with Continue without evidence shows everything stored in the case. Actions that read the image (hex preview, extract, ingest) are disabled, each with a tooltip naming the missing image and the Locate action.

### B15. Deleted files

Every deleted record with a name, from every layer, plus records carved from free space.

| Control | Behaviour |
| ------- | --------- |
| Recoverability donut | Counts of intact, partly recoverable and overwritten content |
| Where deletions happened | Bars for the folders with the most deletions |
| When deletions happened | Density chart of deletion times from the change journal |
| Filters | Recoverable only, type, folder, name contains |
| Table | Layer glyph, name, folder, size, deleted time, content meter with percent, last seen in |
| Extract selected | Extracts the selected files through the Extract flow of B8, refusing overwritten content |
| Row actions | History (B10), Show events (B9), Open in Files (B8) in the layer that last held the file |

### B16. Recent activity

What happened on one day, read from stored events.

| Control | Behaviour |
| ------- | --------- |
| Day strip | The last 14 days with events; selecting a day fills the four cards |
| Programs run | Bars by run count from prefetch; programs in no shadow copy take the accent and say first seen |
| Logons | Time, account, logon type and source address from Security event 4624; remote ones take the accent |
| Files opened | Time, target path and volume from shortcuts; targets on removable volumes take the accent |
| Services and start-up changes | Service installs (7045), Run key writes and log clears (104, 1102) |
| Any row | Opens the Timeline at that event |

### B17. Disk map

The volume as a grid of cluster groups, for one layer at a time.

| Control | Behaviour |
| ------- | --------- |
| Cluster grid | Squares of equal cluster runs: allocated, free, MFT, shadow storage, free with carved records |
| Legend and toggles | Names each colour with its share; toggles for carved records, shadow storage, deleted content |
| Go to offset | Accepts an image offset or a cluster number and selects its square |
| Selection pane | Cluster range, image offset, state in this layer and in each snapshot, what was carved there |
| Hex view | The bytes at the selected offset with previous and next, and a notice decoding a recognised record |
| Show its event | Opens the Timeline at the event carved from that offset |
| Save region | Saves the selected cluster range to a file, with its SHA-256, through the Extract flow |

The view needs the evidence image. Without it the grid shows from the stored map and the hex view is disabled as B14 says.

### B18. The core column

The layers of the open case as a column of bands, newest on top, unallocated last. Each band names its layer, its time and its event count.

| Mode | Used by | Clicking a band |
| ---- | ------- | --------------- |
| All layers | Every case view not named below | Hides or shows that layer |
| One layer | Files, Disk map | Browses that layer, keeping the folder or offset |
| Pair | Compare | Sets side A, then side B |
| Hidden | Audit log | Not shown |

The layer set chosen in all-layers mode is the Timeline's layer filter: the two stay in step and are kept in the URL. At least one layer is always on.

### B19. Keyboard shortcuts added by the design

`B` bookmarks the selected event. `[` and `]` step the focused layer down and up the core in one-layer mode. `G` then a letter goes to a view (`G T` Timeline, `G F` Files, `G O` Overview).
