# Strata interface specification

Decided 2026-11-16. This is the governing document for both interfaces: the `strata` command line (part A) and the desktop app (part B). Architecture and technology are in [the foundation plan](../docs/plans/2026-11-16-strata-foundation.md). A control listed here is either working or owned by a named TODO section; nothing ships disabled without an owner.

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

### B1. Rules for every screen

- One window. Minimum size 1100 by 700. The layout is a left navigation rail, a top bar and a content area.
- Colours, spacing, type sizes and radii come only from `design/tokens/tokens.css`. No raw colour value appears on a control.
- Light and dark themes, following the system by default.
- Every table is keyboard navigable (arrows, Home, End, Page Up, Page Down) and every control has a visible focus state and an accessible name.
- Every long operation shows progress and can be cancelled. Every failure shows what failed, why, and what to do next.
- Times display in the time zone from Settings, with the zone shown in the column header.
- Empty states say what the view will hold and which action fills it.
- `Ctrl+1` to `Ctrl+8` switch views, and `?` opens an overlay listing every shortcut.

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
| Navigation rail | Overview, Layers, Files, Timeline, History, Compare, Bookmarks, Audit log |
| Top bar: case name | Shows the open case; menu with Close case and Open case folder |
| Top bar: Export | Opens the Export dialog (B12) |
| Top bar: Report | Opens the Report dialog (B12) |
| Top bar: Settings | Opens Settings (B13) |
| Status bar | Evidence file name, hash verification state, time zone in use |

### B6. Overview

Evidence card (path, format, size, MD5, SHA-256, verification result), layer summary (counts by kind), event counts by kind as a bar chart, ingest runs table (started, duration, options, result, warnings). A Run ingest again button opens the ingest options and then B4.

### B7. Layers

A tree of layers on the left; selecting one shows kind, id, offset, size and descriptor on the right (for a snapshot: creation time and store size; for a file system: cluster size and MFT location). Buttons: Browse files (goes to Files on that layer), Show events (goes to Timeline filtered to that layer), Copy layer id.

### B8. Files

| Control | Behaviour |
| ------- | --------- |
| Layer selector | Every NTFS layer, live first, then snapshots by time |
| Directory tree | Lazy loaded; selecting a folder fills the table |
| Breadcrumb | The current path; each part is clickable |
| File table | Name, size, modified, created, flags; sortable; virtualised |
| Show deleted toggle | Adds deleted records, shown struck through |
| Filter box | Narrows the table by name |
| Details pane | MFT reference, eight timestamps, streams, data runs, provenance |
| Hex preview | First bytes of the selected stream (size from Settings) |
| Extract button | Save dialog; writes the content and shows its SHA-256 |
| History button | Opens History (B10) for this file |
| Show events button | Opens Timeline filtered to this path |

### B9. Timeline

| Control | Behaviour |
| ------- | --------- |
| Event grid | Time, kind, summary, path, layers; virtualised; sortable by time |
| Time range | From and to fields, plus presets (all, last day, week, month of evidence) |
| Kind filter | Multi-select of event kinds with counts |
| Layer filter | Multi-select of layers |
| Path filter | Glob text |
| Text filter | Substring over summary and detail |
| Bookmarked only | Toggle |
| Clear filters | Resets every filter |
| Density strip | Histogram of events over time; drag selects a time range |
| Result count | Rows matching, and total |
| Detail pane | Every field of the selected event, detail JSON as a tree, provenance |
| Bookmark toggle | Adds or removes a bookmark on the selected event; note field |
| Copy row | Copies the event as JSON |
| Go to file | Opens Files at the event's file, in the event's layer |

### B10. History

A file picker (path or MFT reference, prefilled when opened from Files). A table with one row per layer the file appears in, ordered by layer time: layer, exists, size, modified, content hash when hashed, and what changed from the previous row (highlighted). Carved records for the same MFT reference are listed under the table. Buttons: Open in Files, Show events.

### B11. Compare

Two layer selectors and a Compare button. Three tabs with counts: Added, Removed, Modified. Each is a virtualised table (path, size, modified in A, modified in B). A path filter narrows all three. Selecting a row and pressing History opens B10.

### B12. Bookmarks, Audit log, Export and Report

Bookmarks: a table (event time, kind, summary, note, created). Edit note inline, Remove with confirmation, Go to event (opens Timeline at that event).

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
