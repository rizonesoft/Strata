# Strata design contract

Decided 2026-11-17. This contract binds the desktop app to the design in this folder. The app is finished only when every screen matches its mockup 1:1 under the test in section 7. Behaviour (what each control does) is in [SPEC.md](./SPEC.md) part B; this document governs how it looks and how that is proved.

## 1. What is authoritative

| For | The source is |
| --- | ------------- |
| Every colour, size, radius, font and frame measure | `design/tokens/tokens.css` |
| Every component's shape and every layout | `design/ui/ui.css` and the screen files in `design/ui/` |
| Every icon | The `ICONS` map in `design/ui/ui.js` |
| The frame (top bar, sidebar, core column, status bar) | The `frame()` and `core()` functions in `design/ui/ui.js` |
| What a finished screen looks like | `design/ui/reference/<screen>.png`, rendered by `python scripts/design-shots.py` |
| The brand mark, wordmark and palette | `assets/brand/`, built by `python scripts/brand-assets.py` |
| The typefaces | `assets/fonts/` (Space Grotesk, Inter, JetBrains Mono, all SIL Open Font License) |

Where the SPEC and a mockup disagree about appearance, the mockup wins. Where they disagree about behaviour, the SPEC wins and the mockup is corrected in the same commit.

## 2. The rules

1. **One stylesheet, shared.** The app imports `design/tokens/tokens.css` and `design/ui/ui.css` themselves, through a Vite alias, as its base styles. It does not copy, restate or re-implement them. A component may add styles of its own only for behaviour the mockups cannot show (virtual scrolling, drag, resize).
2. **Same structure.** Each React component renders the same elements and class names as the mockup it implements. The table in section 4 maps class to component.
3. **Tokens only.** No colour literal, pixel font size or radius appears outside `design/tokens/tokens.css`. Stylelint enforces it.
4. **Fonts are bundled.** The three families load from the files in `assets/fonts` through `@font-face`, never from the network: the app's content security policy allows no remote origin.
5. **Icons are generated.** `apps/desktop/src/components/icons.generated.ts` is written from the `ICONS` map by `python scripts/design-sync.py`, and a test fails when the two differ. No icon library is added.
6. **Charts are components, not a library.** The seven chart kinds in section 5 are hand-built SVG components that reproduce the mockup geometry. The seeded generators in `ui.js` only stand in for data.
7. **Nothing ships that the design does not show.** A control, column, panel or state that is not in a mockup or in section 6 is added to the mockup first.
8. **Changing the look.** Edit the mockup, run `python scripts/design-shots.py`, and commit the mockup, its reference image and any contract change together. The app follows in the same or the next commit, and the parity test keeps the two honest.

## 3. Frame and breakpoints

| Measure | Token | Value |
| ------- | ----- | ----- |
| Top bar height | `--size-topbar` | 48 px |
| Sidebar width, and collapsed | `--size-sidebar`, `--size-sidebar-collapsed` | 196 px, 56 px |
| Core column width, and collapsed | `--size-core`, `--size-core-collapsed` | 176 px, 44 px |
| Detail pane width | `--size-pane` | 360 px |
| Status bar height | `--size-statusbar` | 26 px |
| Table row height | `--size-row` | 32 px |
| Control height, and large | `--size-control`, `--size-control-lg` | 32 px, 40 px |

- Minimum window: 1100 by 700. Reference renders are 1440 by 900 at device scale 1.
- At a window width of 1240 px or less the sidebar collapses to icons and the core column to slim bands. The `timeline-narrow` reference shows it.
- The core column shows one band per layer, newest on top, unallocated last. With more than three snapshots the snapshot bands share the middle of the column equally and take `--layer-snap-1` to `--layer-snap-3` in order, repeating the last.
- The core column has three modes: all layers on (lists that merge layers), one layer in focus (Files, Disk map), and a pair marked A and B (Compare). The Audit log hides it. A band keeps its place and size in every mode, so the column never jumps.

## 4. Components

| Mockup class | React component | States that must exist |
| ------------ | --------------- | ---------------------- |
| `.topbar`, `.case-switch` | `TopBar`, `CaseMenu` | menu open and closed |
| `.sidebar`, `.nav-item` | `Sidebar`, `NavItem` | default, hover, current, collapsed, with count |
| `.core`, `.band` | `CoreColumn`, `LayerBand` | on, off, focus, A, B, unallocated, collapsed |
| `.statusbar` | `StatusBar` | verified, mismatch, not verified, no stored hash, evidence missing |
| `.btn` | `Button` | primary, secondary, ghost, icon, large, hover, focus, disabled |
| `.field` | `TextField`, `Select` | placeholder, value, focus, error, disabled |
| `.chip` | `FilterChip` | off, on, open |
| `.check` | `Checkbox` | off, on, focus, disabled |
| `.tag`, `.dot` | `Tag` | plain, accent, ok, danger, with dot |
| `.glyph` | `LayerGlyph` | any set of layers, with its text label for screen readers |
| `.thead`, `.tr` | `DataGrid` | hover, selected, deleted row, loading row, empty |
| `.pane` | `DetailPane` | filled, empty, resizing |
| `.card`, `.kv`, `.well`, `.hex` | `Card`, `KeyValue`, `Well`, `HexView` | as shown |
| `.notice` | `Notice` | as shown |
| `.meter`, `.progress` | `Meter`, `ProgressBar` | 0 to 100 percent, indeterminate for `ProgressBar` |
| `.tile` | `LaunchTile` | default, hover, focus |
| `.dialog`, `.scrim` | `Dialog` | open, with focus trapped and returned on close |
| `.empty` | `EmptyState` | with and without an action |
| `.tabs`, `.tab` | `Tabs` | selected, unselected, focus |

`design/ui/components.html` shows the base set. States the static mockups cannot show are fixed here: hover raises a surface one step (`surface` to `surface-2`, `surface-2` to `surface-3`); focus is a 2 px `--color-focus` outline offset 2 px; disabled is 45 percent opacity with no pointer events; a loading row is a `surface-2` bar at 60 percent row height; motion is limited to 120 ms ease-out on colour and opacity and is removed under `prefers-reduced-motion`.

## 5. Charts

| Chart | Component | Used on | Encodes |
| ----- | --------- | ------- | ------- |
| Lanes | `LaneChart` | Timeline | One lane per event family, a mark per burst, a cursor at the selected event |
| Density | `DensityChart` | Timeline, Deleted files | Events per bucket, stacked by layer; drag selects a range |
| Area | `ActivityArea` | Overview | Events per day, with a dashed marker at each shadow copy and at acquisition |
| Donut | `Donut` | Overview, Deleted files | Share by family, or by recoverability |
| Heat map | `HourHeat` | Overview | Events by weekday and hour; cells in the top one percent take the accent |
| Bars | `BarList` | Overview, Deleted files, Activity, Compare | A labelled bar per row, accent on rows called out |
| Clusters | `ClusterMap` | Disk map | The volume as a grid of cluster groups, coloured by state |

Every chart has a text alternative (`role="img"` and a label that states the finding), takes its colours from the `--layer-*` and `--kind-*` tokens, and never relies on colour alone: the legend names each series and the accent is always paired with a text call-out.

Event kinds group into six families for colour: Files (`file.*`), Journal (`usn.change`), Event log (`log.event`), Registry (`registry.key_written`), Programs (`program.run`), Shortcuts (`shortcut.target`).

## 6. Screens

| Screen | Mockup | App route | SPEC | Core mode |
| ------ | ------ | --------- | ---- | --------- |
| Start | `start.html` | `/start` | B2 | none |
| New case | `new-case.html` | dialog on `/start` | B3 | none |
| Ingest | `ingest.html` | `/ingest` | B4 | shown as progress |
| Overview | `overview.html` | `/case/overview` | B6 | all |
| Layers | `layers.html` | `/case/layers` | B7 | all |
| Files | `files.html` | `/case/files` | B8 | one |
| Deleted files | `deleted.html` | `/case/deleted` | B15 | all |
| Timeline | `timeline.html` | `/case/timeline` | B9 | all |
| Recent activity | `activity.html` | `/case/activity` | B16 | all |
| History | `history.html` | `/case/history` | B10 | all |
| Compare | `compare.html` | `/case/compare` | B11 | pair |
| Disk map | `diskmap.html` | `/case/diskmap` | B17 | one |
| Bookmarks | `bookmarks.html` | `/case/bookmarks` | B12 | all |
| Audit log | `audit.html` | `/case/audit` | B12 | hidden |
| Export and Report | `export.html` | dialogs | B12 | none |
| Settings and About | `settings.html` | dialogs | B13 | none |
| Error states | `errors.html` | `/start` | B14 | none |
| Components | `components.html` | test page only | B1 | none |

Also rendered: `timeline-light` (the light theme) and `timeline-narrow` (1100 by 700).

## 7. How 1:1 is proved

1. **Design data.** `apps/desktop/e2e/design-data/<screen>.json` holds exactly the content each mockup shows (the Harbour Freight case). In parity mode the app's bridge serves these files in place of a case, so the app and the mockup show the same rows, numbers and chart points.
2. **The comparison.** `apps/desktop/e2e/parity.spec.ts` opens each route in the built app at 1440 by 900, device scale 1, dark theme, waits for fonts and for network idle, takes a screenshot and compares it with `design/ui/reference/<screen>.png` using `pixelmatch` at threshold 0.1.
3. **The bar.** A screen passes when at most 0.5 percent of its pixels differ and no differing region is larger than 24 by 24 px. The test writes the diff image beside its report on failure.
4. **Themes and sizes.** Timeline is also compared in the light theme and at 1100 by 700.
5. **Drift tests.** `python scripts/design-sync.py --check` fails when the generated icon module differs from `ICONS`, when the app's stylesheet is not the design's own file, or when a reference image is older than its mockup.
6. **The gate.** No surface section of the plan is stamped until the parity test for its screen passes, and D08 T03 §3 runs the whole set as the last check of phase 7.

Parity proves the look on the design data. The same screens are also driven on a real case ingested from the fixture image by the end-to-end tests, which prove behaviour.

## 8. Accessibility the design commits to

- Text contrast of at least 4.5 to 1 in both themes, 3 to 1 for the focus ring and for chart marks against their ground.
- Every control reachable and operable from the keyboard, with a visible focus state.
- Colour is never the only signal: deleted rows are struck through and labelled, changed cells carry a text marker, layer membership has a text label on the glyph.
- No motion that is not a response to the user, and none at all under `prefers-reduced-motion`.
