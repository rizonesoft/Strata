---
schema_version: 1
id: app-shell
domain: 08-desktop
status: active
title: "TODO-01 -- Desktop app shell: scaffold, bridge, frame and case entry"
track: M7
---

# TODO-01 -- Desktop app shell: scaffold, bridge, frame and case entry

> **Goal:** The desktop app starts, creates or opens a case, runs an ingest with visible progress, and presents the main window frame with navigation, settings and every error state, ready for the views in T02 to fill.

> **Current state:** Measured 2026-11-16. `apps/desktop` does not exist. Node 24.22.2 and pnpm 11.10.0 are installed; Rust is installed by D00 T01 §1. The engine the app calls is complete by the end of phase 6.

## Inputs

- `design/SPEC.md` B1 (rules for every screen), B2 (Start), B3 (New case), B4 (Ingest progress), B5 (frame), B13 (Settings) and B14 (error states).
- `docs/plans/2026-11-16-strata-foundation.md` section 3 (Tauri 2, React, TypeScript, Vite, pnpm, TanStack, Vitest, Playwright) and section 4.2 (the app calls `strata-engine` only).
- `ingest`, `IngestEvent`, `Case` and `relocate_evidence` from D05; the fixture from D00 T01 §4.

## Outcome

- `pnpm --dir apps/desktop tauri dev` opens the Start screen; a case created there over the fixture ingests with live stage progress and lands on the main window.
- Every control in SPEC B2, B3, B4, B5 and B13 works, and every situation in B14 shows its message and its way forward.
- An end-to-end suite drives the built app, not a mock, against a case ingested from the fixture.

**Adjacency:** list=applicable @ §7; document=not-applicable (the shell produces no document and reports are owned by the views file); settings=applicable @ §6; reporting=not-applicable (summaries belong to the Overview in the views file); notifications=not-applicable (a single user offline tool has no recipients to notify); permissions=applicable @ §10; audit=not-applicable (the shell calls engine functions that write their own audit rows); exchange=not-applicable (export is owned by the views file); reverse=applicable @ §7

**Adjacency rationale:** The list surface is the recent cases list, whose reverse is Remove from recents. Creating a case is reversed by Cancel before creation and by deleting the folder after, which is the user's own act. Every setting in SPEC B13 has a named consumer in §6. The permission surface is the set of refusals in §10.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | Tauri and React app scaffold | D00 T01 §3 | [ ] |
| 2 | §2 | Design styles, fonts, icons and base components | §1 | [ ] |
| 3 | §3 | Typed command bridge to the engine | §1, D06 T02 §3, D06 T01 §2, D05 T01 §8 | [ ] |
| 4 | §4 | Window frame, module sidebar and status bar | §2, §3 | [ ] |
| 5 | §5 | End-to-end harness against the built app | §4 | [ ] |
| 6 | §6 | Settings store and dialog | §4, §5, T03 §2 | [ ] |
| 7 | §7 | Start screen and recent cases | §4, §5, T03 §2 | [ ] |
| 8 | §8 | New case dialog | §7, §6, T03 §2 | [ ] |
| 9 | §9 | Ingest progress screen | §8, T03 §2 | [ ] |
| 10 | §10 | Case error and evidence relocation states | §7, T03 §2 | [ ] |
| 11 | §11 | Core column and shared layer state | §4 | [ ] |
| 12 | §12 | Chart components | §2 | [ ] |

## 1. Tauri and React app scaffold

The scaffold fixes the frontend toolchain: one pnpm project, strict TypeScript, lint and unit tests, and a Tauri shell crate that joins the Cargo workspace.

**Phase:** 7
**Needs:** windows-host
**Surface:** no

**Build order:**

1. Create the app in `apps/desktop`. Done when: the dev build opens a window.
2. Add the checks. Done when: lint, type check and unit tests run from one command each.

- [ ] Scaffold with `pnpm create tauri-app` (React, TypeScript, Vite) into `apps/desktop`, then add `apps/desktop/src-tauri` to the root `Cargo.toml` workspace members and make it depend on `strata-engine`. Done when: `pnpm --dir apps/desktop tauri dev` opens a window and `cargo build --workspace` still succeeds.
- [ ] Set `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` in `apps/desktop/tsconfig.json`. Done when: `pnpm --dir apps/desktop exec tsc --noEmit` exits 0.
- [ ] Add ESLint with the TypeScript and React hooks rule sets and a `lint` script. Done when: `pnpm --dir apps/desktop lint` exits 0 and fails on an unused variable.
- [ ] Add Vitest and Testing Library with a `test` script and one test rendering `App`. Done when: `pnpm --dir apps/desktop test` passes.
- [ ] Set the window in `apps/desktop/src-tauri/tauri.conf.json`: title `Strata`, minimum size 1100 by 700 (SPEC B1), and a content security policy of `default-src 'self'` with no remote origin. Done when: the window cannot be resized below the minimum, and a `fetch` to an external URL from the dev console is blocked.
- [ ] Remove every Tauri plugin and capability the scaffold enabled that the app does not use, leaving `dialog` (file and folder pickers) and `opener` (open a folder) with scoped permissions in `apps/desktop/src-tauri/capabilities/default.json`. Done when: the capability file lists only those.
- [ ] Commit `pnpm-lock.yaml` and add the frontend commands to `AGENTS.md`. Done when: `git ls-files apps/desktop/pnpm-lock.yaml` prints the path.
- [ ] Commit: `desktop: Tauri and React scaffold`

**Test checkpoint:** `pnpm --dir apps/desktop lint; pnpm --dir apps/desktop test; pnpm --dir apps/desktop exec tsc --noEmit` all exit 0; lint fails when an unused variable is added.

## 2. Design styles, fonts, icons and base components

The look is decided: `design/tokens/tokens.css`, `design/ui/ui.css`, the icon map in `design/ui/ui.js` and the fonts in `assets/fonts` already exist and the owner approved them on 2026-11-17. This section brings them into the app unchanged, so the app matches the mockups by construction (`design/CONTRACT.md` section 2).

**Phase:** 7
**Needs:** none
**Surface:** yes
**Fidelity:** `design/CONTRACT.md` sections 1, 2 and 4, and `design/SPEC.md` B1. Visual source: `design/ui/components.html` and `design/ui/reference/components.png`.
**Job:** Give every screen the approved visual language without restating a single value of it.
**Treatment:** The design's own stylesheets, imported. React components that render the mockups' elements and class names.
**Chrome:** None of its own; it styles every other surface.

**Build order:**

1. Import the design's files into the app. Done when: a page using the mockups' classes renders like the mockup.
2. Build the base components and the drift checks. Done when: each component in the contract's table exists and the sync check passes.

- [ ] Add a Vite alias `@design` to the repository's `design` folder and `@assets` to `assets`, and import `@design/tokens/tokens.css` then `@design/ui/ui.css` from `apps/desktop/src/main.tsx`. Done when: `pnpm --dir apps/desktop build` succeeds and the built CSS contains `--color-accent`. Cheaper substitute: copying the two files into `apps/desktop/src`, which lets them drift from the design.
- [ ] Write `apps/desktop/src/fonts.css` with `@font-face` rules for Space Grotesk, Inter and JetBrains Mono from `@assets/fonts`, matching `design/ui/fonts.css`. Done when: `document.fonts.check('13px Inter')` is true in the running app with the network disabled.
- [ ] Write `scripts/design-sync.py`: it reads the `ICONS` map out of `design/ui/ui.js` and writes `apps/desktop/src/components/icons.generated.ts` (a typed record of name to path data), and with `--check` exits 1 when that file is stale, when `main.tsx` does not import the two design stylesheets, or when a reference PNG is older than its mockup. Done when: `python scripts/design-sync.py --check` exits 0, and exits 1 after an icon path is edited in a scratch copy.
- [ ] Build `Icon` in `apps/desktop/src/components/Icon.tsx` rendering the `.ico` SVG from the generated record, with `sm` and `lg` sizes and `aria-hidden` unless a label is given. Done when: a Vitest test renders every icon name and none falls back.
- [ ] Implement `applyTheme(mode: "system" | "light" | "dark")` in `apps/desktop/src/lib/theme.ts`, setting `data-theme` on the root and following `prefers-color-scheme` under `system`. Done when: a test toggles each mode and reads `data-theme`.
- [ ] Add Stylelint with a rule refusing hex, `rgb` and `hsl` literals and pixel font sizes anywhere under `apps/desktop/src`, wired into the `lint` script. Done when: a `color: #333` in a component stylesheet fails lint.
- [ ] Build the base components of `design/CONTRACT.md` section 4 in `apps/desktop/src/components`: `Button`, `TextField`, `Select`, `FilterChip`, `Checkbox`, `Tag`, `LayerGlyph`, `Card`, `KeyValue`, `Well`, `HexView`, `Notice`, `Meter`, `ProgressBar`, `LaunchTile`, `Dialog` (focus trapped, Escape closes), `Tabs`, `EmptyState`, each emitting the mockup's class names and each state the table lists. Done when: a Vitest test per component checks its classes, role, accessible name and keyboard activation.
- [ ] Add a test-only route `/design/components` that lays the components out as `design/ui/components.html` does. Done when: the route renders with no console error; D08 T03 §2 compares it with the reference.
- [ ] Check contrast by a Vitest test that parses `tokens.css` and computes WCAG contrast for text on each surface and for the focus ring, in both themes (`design/CONTRACT.md` section 8). Done when: it passes, and fails when `--color-text-muted` is lightened in a scratch copy.
- [ ] Commit: `desktop: design styles, fonts, icons and base components`

**Test checkpoint:** `pnpm --dir apps/desktop test components theme contrast`, `pnpm --dir apps/desktop lint` and `python scripts/design-sync.py --check` pass; the sync check fails when the generated icons are stale.

## 3. Typed command bridge to the engine

The frontend never touches evidence or the database. It calls named commands on the Rust side, which hold the open case and call the engine. Types cross the boundary by generation, so the two sides cannot drift.

**Phase:** 7
**Needs:** none
**Surface:** no

**Build order:**

1. Build the Rust side in `apps/desktop/src-tauri/src`. Done when: a command returns case info to the frontend.
2. Generate the types and the long-operation channel. Done when: progress events arrive typed and a running operation can be cancelled.

- [ ] Implement `AppState` in `apps/desktop/src-tauri/src/state.rs` holding `Mutex<Option<OpenCase>>` and a map of running operations to their cancel flags. Done when: a Rust unit test opens and closes a case through it.
- [ ] Define `ApiError { code, message, hint, details }` in `apps/desktop/src-tauri/src/error.rs`, mapping every engine and case error class to a stable `code` string (`evidence_moved`, `newer_case`, `not_a_case`, `unsupported_image`, `cancelled`, and so on). Done when: a table-driven test covers every variant of `strata_core::Error` and the case store's error type, so a new variant fails the test until mapped.
- [ ] Implement the case commands in `apps/desktop/src-tauri/src/commands/case.rs`: `case_create`, `case_open`, `case_close`, `case_info`, `image_probe` (format and size for the New case dialog) and `evidence_relocate`. Done when: Rust tests call each against a temp case.
- [ ] Derive TypeScript types with `ts-rs` for every type crossing the bridge, exported to `apps/desktop/src/bindings/`, and add a test that regenerates them and fails when the committed files differ. Done when: changing a field on the Rust side without regenerating fails `cargo test -p strata-desktop bindings`.
- [ ] Write `apps/desktop/src/lib/api.ts`: one typed function per command wrapping `invoke`, converting a rejected call to a typed `ApiError`. Done when: a Vitest test with a mocked `invoke` checks one success and one error path.
- [ ] Implement long operations: a command starts the work on a blocking thread, returns an operation id, streams typed progress through a Tauri `Channel`, and `operation_cancel(id)` sets the flag. Done when: a Rust test starts a stub operation, receives progress, cancels it and sees it end with `cancelled`.
- [ ] Run every command body on `tauri::async_runtime::spawn_blocking` so a slow query never freezes the window. Done when: a test holding a command for two seconds still gets a reply from a second command within 100 ms.
- [ ] Commit: `desktop: typed command bridge to the engine`

**Test checkpoint:** `cargo test -p strata-desktop` and `pnpm --dir apps/desktop test api` pass; the bindings test fails if a bridged type changes without regeneration.

## 4. Window frame, module sidebar and status bar

The frame is what stays on screen while views change: where the user is, which case is open, and whether the evidence is verified.

**Phase:** 7
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` B5 (every row of the frame table) and B1. Visual source: `design/ui/timeline.html` and `design/ui/reference/timeline.png`, bound by `design/CONTRACT.md`.
**Job:** Move between the eight views of an open case and reach Export, Report, Settings and Close case from anywhere.
**Treatment:** The frame of `design/ui/ui.js`: a top bar with the mark, the wordmark and the case menu on the left and Export, Report and Settings on the right; a sidebar of icon and label items in three groups (Case, Examine, Record) with counts on Deleted files and Bookmarks; a slim status bar.
**Chrome:** Sidebar items Overview, Layers, Files, Deleted files, Timeline, Recent activity, History, Compare, Disk map, Bookmarks, Audit log; case menu (Close case, Open case folder); Export; Report; Settings; status bar (evidence file name, verification state, layer count, event count, time zone).

**Build order:**

1. Build routing and the frame in `apps/desktop/src/app`. Done when: each rail item shows its route.
2. Wire the top bar and status bar to the open case. Done when: they show real case data.

- [ ] Add `react-router` with hash routes `/start`, `/ingest` and `/case/<view>` for the eleven views of `design/CONTRACT.md` section 6, redirecting `/case/*` to `/start` when no case is open. Done when: a Vitest test navigates each route and asserts the redirect.
- [ ] Build `Frame` in `apps/desktop/src/app/Frame.tsx` with the rail, top bar and status bar, each view route rendering an `EmptyState` naming the view until T02 fills it. Done when: a test clicks each of the eleven sidebar items and sees the matching heading and `aria-current` on the item.
- [ ] Implement the case name menu: Close case calls `case_close` and returns to Start; Open case folder opens the folder through the `opener` plugin. Done when: a test with a mocked API asserts both calls.
- [ ] Wire the Export, Report and Settings buttons to open dialogs by name through one `DialogHost` in `apps/desktop/src/app/DialogHost.tsx`; Settings opens the dialog from §6, and Export and Report register in T02 §12. Done when: a test opens Settings from the top bar.
- [ ] Collapse the sidebar to icons at a window width of 1240 px or less, keeping each item's accessible name and a tooltip. Done when: a test at 1100 px wide finds eleven icon buttons with names.
- [ ] Show in the status bar the evidence file name, the layer count, the event count, a verification badge (`verified`, `mismatch`, `not verified`, `no stored hash`) and the active time zone from settings. Done when: a test with each verification state sees its badge text and its semantic colour token.
- [ ] Make the rail and top bar fully keyboard operable: Tab order rail, top bar, content; arrow keys move within the rail; `Ctrl+1` to `Ctrl+9` jump to the first nine views. Done when: a test drives the rail by keyboard alone.
- [ ] Commit: `desktop: window frame, navigation and status bar`

**Test checkpoint:** `pnpm --dir apps/desktop test Frame` passes; the redirect test fails if case routes render with no case open.

## 5. End-to-end harness against the built app

Unit tests with a mocked bridge prove components. Only driving the real window over a real case proves the app. This harness is what every later surface section's checkpoint runs.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** no

**Build order:**

1. Build the launcher in `apps/desktop/e2e`. Done when: a test attaches to the running app.
2. Build the shared fixture case. Done when: tests open a case ingested from the fixture image.

- [ ] Add Playwright and write `apps/desktop/e2e/launch.ts`: start the debug build of the app with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<free port>` and an isolated config folder from `STRATA_CONFIG_DIR`, then attach with `chromium.connectOverCDP`. Done when: a test reads the window title `Strata`.
- [ ] Stop the app's whole process tree on teardown and on timeout with `taskkill /T /F /PID`, and assert afterwards that no `strata-desktop.exe` started by the test remains. Done when: a test that deliberately times out leaves no process. Cheaper substitute: killing only the launched process, which orphans the WebView2 children.
- [ ] Write `apps/desktop/e2e/global-setup.ts`: once per run, create a case over `fixtures/out/strata-fixture.E01` in a temp folder with the built `strata` binary (`case create`, then `case ingest`), and expose its path; fail with the fixture build command when the image is missing. Done when: the setup leaves a case whose `case info --json` shows two snapshot layers.
- [ ] Give each test a private copy of that case folder so bookmarks made by one test never reach another. Done when: two tests that each add a bookmark both see exactly one.
- [ ] Add the `e2e` script and document it in `AGENTS.md`. Done when: `pnpm --dir apps/desktop e2e` runs the smoke test and exits 0.
- [ ] Honour `STRATA_CONFIG_DIR` in `apps/desktop/src-tauri/src/config.rs` as an override of the per-user config folder. Done when: a Rust test sets it and settings are written there.
- [ ] Commit: `desktop: end-to-end harness against the built app`

**Test checkpoint:** `bosun run -- pnpm --dir apps/desktop e2e smoke` passes with the fixture built and leaves no app process; it fails with the build command in its message when the fixture is missing.

## 6. Settings store and dialog

Six settings, each with a consumer named in SPEC B13. They persist per user and apply at once.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B13 (every row of the settings table, applied without restart, Reset to default per setting). Visual source: `design/ui/settings.html` and `design/ui/reference/settings.png`, bound by `design/CONTRACT.md`.
**Job:** Choose how times are shown, the theme, how many threads ingest uses, how much of a file the hex preview shows, and a default examiner name.
**Treatment:** A dialog with one labelled row per setting, its control on the right and a Reset link beside it; changes apply immediately, with no Save button.
**Chrome:** Time zone (UTC, system, IANA name with search), Timestamp format (ISO 8601, locale), Theme (System, Light, Dark), Worker threads (1 to cores), Hex preview size (256 B to 64 KB), Default examiner, Reset per row, Close.

**Build order:**

1. Build the store on the Rust side in `apps/desktop/src-tauri/src/config.rs`. Done when: settings survive a restart.
2. Build the dialog and wire each consumer. Done when: each setting visibly changes its consumer.

- [ ] Define `Settings` with defaults (time zone UTC, ISO 8601, theme system, threads equal to cores, hex preview 4096, examiner empty) and commands `settings_get`, `settings_set(patch)` and `settings_reset(key)`, storing JSON in the app config folder with an atomic write (temp file then rename). Done when: a Rust test sets a value, reloads and reads it back, and a corrupt file falls back to defaults with the bad file kept as `settings.json.bad`.
- [ ] Validate on the Rust side: an unknown IANA zone, threads outside 1 to cores, or a preview size outside 256 to 65536 is refused with the reason. Done when: three tests get the refusal and the stored value is unchanged.
- [ ] Build `SettingsProvider` in `apps/desktop/src/lib/settings.tsx` exposing the values and `formatTime(micros)`, which every view uses for display. Done when: a Vitest test formats one instant under UTC, `Africa/Johannesburg` and locale format.
- [ ] Build `SettingsDialog` in `apps/desktop/src/app/SettingsDialog.tsx` with the six rows and a Reset per row. Done when: a test changes each control and sees `settings_set` called with that key alone.
- [ ] Wire the consumers: theme to `applyTheme`, time zone and format to `formatTime` and the status bar, threads to `IngestOptions.threads`, examiner to the New case dialog's default, preview size to the Files hex preview (consumed in T02 §4). Done when: an end-to-end test changes the theme and time zone and sees the root `data-theme` and the status bar zone change without a restart, and still set after relaunching the app.
- [ ] Build the About dialog opened from the Settings header: the mark, the wordmark, version and build, licence, case schema, engine version, and buttons for the third-party notices and the keyboard shortcuts. Done when: a test opens it and finds the version from the bridge.
- [ ] Build this screen from `design/ui/settings.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/settings.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g settings` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: settings store and dialog`

**Test checkpoint:** `pnpm --dir apps/desktop test settings` and `pnpm --dir apps/desktop e2e settings` pass; the relaunch test fails if settings are kept in frontend memory only.

## 7. Start screen and recent cases

The first thing a user sees: start a case, open one, or pick up a recent one.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B2 (every row of the Start table). Visual source: `design/ui/start.html` and `design/ui/reference/start.png`, bound by `design/CONTRACT.md`.
**Job:** Get into a case in one or two clicks.
**Treatment:** A centred column: product name, two primary buttons side by side, the recent cases list below with name, folder and last opened; a Settings button in the corner.
**Chrome:** New case, Open case, Recent cases list (click opens), Remove from recents per row, missing-folder mark, Settings.

**Build order:**

1. Build recents on the Rust side. Done when: opened cases are remembered, newest first.
2. Build the screen in `apps/desktop/src/views/Start.tsx`. Done when: each control works against real cases.

- [ ] Implement `recents_list`, `recents_touch(path)` and `recents_remove(path)` in `apps/desktop/src-tauri/src/commands/recents.rs`, storing up to 10 entries (name, folder, last opened) in the config folder and marking an entry whose folder no longer holds `case.duckdb` as `missing`. Done when: Rust tests cover the cap of 10, ordering and the missing mark.
- [ ] Build the Start screen with New case (opens the dialog from §8), Open case (folder picker, then `case_open`) and Settings. Done when: an end-to-end test opens the fixture case through Open case and lands on `/case/overview`.
- [ ] Render the recent list; clicking a row opens that case, and a `missing` row is shown muted with the reason and cannot be opened. Done when: an end-to-end test sees the fixture case in recents after reopening the app, and opens it from there.
- [ ] Implement Remove from recents per row, which removes the entry and never touches the case folder. Done when: a test removes an entry and asserts the folder still exists.
- [ ] Show the empty state when there are no recents, saying that cases opened here will be listed. Done when: a first-run test sees it.
- [ ] Route a failed open to the error states of §10. Done when: opening an empty folder shows the not-a-case panel.
- [ ] Store each recent case's layer count and event count when it is opened, and draw its mini layer stack (one bar per layer in the layer tokens) beside its name. Done when: a test with a five layer case renders five bars.
- [ ] Build the right-hand panel How Strata reads a disk: four bands with their one sentence each, the supported formats line and the version line, as the mockup words them. Done when: a test finds the four band names and the version from the bridge.
- [ ] Build this screen from `design/ui/start.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/start.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g start` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: start screen and recent cases`

**Test checkpoint:** `pnpm --dir apps/desktop e2e start` passes with the fixture built; the remove test fails if removing a recent deletes anything on disk.

## 8. New case dialog

Creating a case collects what the engine needs and validates it before anything is written.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B3 (every row of the New case table; validation under the field it concerns). Visual source: `design/ui/new-case.html` and `design/ui/reference/new-case.png`, bound by `design/CONTRACT.md`.
**Job:** Name a case, choose where it lives and which image it examines, choose the ingest options, and start.
**Treatment:** A dialog with a single column form: text fields, two pickers each showing the chosen path, a line under the image picker with detected format and size, four checkboxes, and Cancel and Create and ingest at the bottom right.
**Chrome:** Case name, Examiner, Case folder picker, Evidence image picker, Verify image hash, Include shadow copies, Carve unallocated space, Hash file content, Create and ingest, Cancel.

**Build order:**

1. Build the form in `apps/desktop/src/views/NewCaseDialog.tsx`. Done when: validation enables and disables the button correctly.
2. Wire creation. Done when: a case is created and the ingest screen opens.

- [ ] Build the form with the two text fields, the two pickers (through the `dialog` plugin, the image picker filtered to `.dd`, `.raw`, `.img`, `.001`, `.vhd`, `.E01` plus all files) and the four checkboxes with SPEC defaults (verify on, snapshots on, carve on, hash content off with the note that it is slower). Done when: a Vitest test asserts the defaults.
- [ ] Prefill Examiner from the Default examiner setting. Done when: a test with the setting filled sees it in the field.
- [ ] Call `image_probe` when an image is chosen and show its format and size, or the refusal reason under the field for an unsupported or unreadable file. Done when: an end-to-end test picks the fixture E01 and sees `E01` and its size, and a test with a text file sees the supported formats listed.
- [ ] Validate: name required; folder required and either absent or empty; image required and probed successfully. Show each message under its field and keep Create and ingest disabled until all pass. Done when: tests cover each rule, including a folder that already holds a case.
- [ ] On Create and ingest call `case_create`, then navigate to `/ingest` passing the options; on failure keep the dialog open with the error at the top and nothing created. Done when: an end-to-end test creates a case over the fixture E01 in a temp folder and reaches the ingest screen.
- [ ] On Cancel or Escape close with nothing created. Done when: a test fills the form, cancels and asserts `case_create` was never called and the folder does not exist.
- [ ] Build this screen from `design/ui/new-case.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/new-case.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g new-case` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: new case dialog`

**Test checkpoint:** `pnpm --dir apps/desktop test NewCaseDialog` and `pnpm --dir apps/desktop e2e new-case` pass; the cancel test fails if the folder is created before Create is pressed.

## 9. Ingest progress screen

A long run made legible: which stage is running, how far it is, what went wrong, and a way to stop.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B4 (every row of the Ingest table) and the B14 rows for a failed stage and a rejected artifact. Visual source: `design/ui/ingest.html` and `design/ui/reference/ingest.png`, bound by `design/CONTRACT.md`.
**Job:** Watch an ingest, stop it safely if needed, and enter the case when it ends.
**Treatment:** A vertical list of the six stages, each with a state icon and counts; the running stage expands to a progress bar with done, total and rate; a collapsible log panel below; Cancel at the bottom until the run ends, then Open case.
**Chrome:** Stage list (verify, layers, files, artifacts, carving, indexing), per-stage progress bar, log panel toggle, Cancel with confirmation, Retry stage on a failed stage, Open case.

**Build order:**

1. Add the ingest commands in `apps/desktop/src-tauri/src/commands/ingest.rs`. Done when: `IngestEvent`s stream to the frontend.
2. Build the screen in `apps/desktop/src/views/Ingest.tsx`. Done when: a fixture ingest shows every stage through to done.

- [ ] Implement `ingest_start(options) -> OperationId` as a long operation streaming `IngestEvent`s, taking `threads` from settings when the options leave it unset. Done when: a Rust test over the fixture case receives a started and finished event per stage.
- [ ] Render the six stages with states pending, running, done, failed and skipped, updating from events; a stage skipped by options shows `skipped` with the option that skipped it. Done when: a Vitest test replays a recorded event sequence and asserts each state.
- [ ] Render the running stage's progress bar with counts and a rate averaged over the last five seconds, updating at most ten times a second however fast events arrive. Done when: a test feeding 10000 events in one second counts at most ten renders.
- [ ] Append warnings to the log panel with their artifact path and layer, and show a warning count on the collapsed panel. Done when: a test with two warning events sees the count and both lines.
- [ ] Implement Cancel: confirm, call `operation_cancel`, show `cancelling` until the engine reports the run cancelled, then offer Open case and Run again. Done when: an end-to-end test cancels a fixture ingest during `files`, opens the case, and the Overview lists the run as cancelled.
- [ ] On a failed stage show the stage, the error and Retry stage, which starts a new run that skips completed work. Done when: a test with a failed-stage event sees the button and `ingest_start` called again on click.
- [ ] Show Open case when the run finishes, navigating to `/case/overview`. Done when: an end-to-end test runs the fixture ingest to the end and reaches the Overview.
- [ ] Warn before closing the window while a run is active, and cancel the run cleanly when the user confirms. Done when: an end-to-end test closes mid-run, confirms, relaunches and finds the case openable.
- [ ] Build the left panel The core, as it is read: one band per planned layer, each filling from the left as its stages complete and saying what it is doing (`files done`, `artifacts 62%`, `waiting`). Done when: a Vitest test replays a recorded event sequence and reads each band's fill and text at three moments.
- [ ] Build this screen from `design/ui/ingest.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/ingest.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g ingest` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: ingest progress screen`

**Test checkpoint:** `pnpm --dir apps/desktop test Ingest` and `bosun run -- pnpm --dir apps/desktop e2e ingest` pass with the fixture built; the cancel test fails if the app exits before the engine finishes its transaction.

## 10. Case error and evidence relocation states

Opening a case can fail in a small number of known ways. Each gets a message that says what happened and a way forward, never a raw error.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/SPEC.md` B14 rows: not a case, newer Strata, evidence moved, image unreadable or unsupported. Visual source: `design/ui/errors.html` and `design/ui/reference/errors.png`, bound by `design/CONTRACT.md`.
**Job:** Understand why a case did not open and recover when recovery is possible.
**Treatment:** A full-content panel with a title, the facts (paths, versions, hashes), and one primary action where there is one.
**Chrome:** Back to Start on every panel; Locate on the evidence moved panel, with a hashing progress bar and Cancel.

**Build order:**

1. Build `CaseErrorPanel` in `apps/desktop/src/views/CaseError.tsx`. Done when: each error code renders its panel.
2. Wire relocation. Done when: a moved image is accepted only when its hash matches.

- [ ] Map `ApiError.code` to a panel: `not_a_case` (the folder and what is missing), `newer_case` (both versions and that an update is needed), `unsupported_image` and `evidence_unreadable` (the reason and supported formats), and a generic panel showing the message and code for anything unmapped. Done when: a Vitest test renders each code and finds its facts.
- [ ] Build the evidence moved panel: recorded path, a Locate button opening the file picker, then `evidence_relocate` as a long operation with a progress bar and Cancel. Done when: an end-to-end test renames the fixture copy, opens the case, sees the panel, locates the renamed file and reaches the Overview.
- [ ] Refuse a different file: show both hashes and keep the panel, with the case unchanged. Done when: an end-to-end test locates a different image and sees the refusal, and the recorded path is unchanged on the next open.
- [ ] Open a case whose evidence is missing in a read-only state when the user chooses Continue without evidence: views over stored data work, and actions that read evidence (hex preview, extract, ingest) are disabled with a tooltip naming the missing image and the Locate action. Done when: an end-to-end test continues without evidence, browses the Timeline, and finds Extract disabled with that explanation.
- [ ] Build the wrong-image, not-a-case, newer-case and unsupported-image cards as the mockup shows them, beside the evidence moved panel on the design route only; in the app each shows alone for its error. Done when: a test renders each code and finds its heading.
- [ ] Build this screen from `design/ui/errors.html`: the same elements and class names, styled only by the shared stylesheet, with its design data at `apps/desktop/e2e/design-data/errors.json` (`design/CONTRACT.md` sections 2 and 7). Done when: `pnpm --dir apps/desktop e2e parity -g errors` passes at 0.5 percent or less. Cheaper substitute: a screen that looks close in new CSS, which the pixel comparison fails.
- [ ] Commit: `desktop: case error and evidence relocation states`

**Test checkpoint:** `pnpm --dir apps/desktop test CaseError` and `pnpm --dir apps/desktop e2e relocate` pass with the fixture built; the wrong-file test fails if relocation accepts a file by name alone.

## 11. Core column and shared layer state

The layer stack is on screen in every case view. It is both a picture of the evidence and the control that chooses which layers the views read (SPEC B18).

**Phase:** 7
**Needs:** none
**Surface:** yes
**Fidelity:** `design/SPEC.md` B18 and `design/CONTRACT.md` section 3. Visual source: the `core()` function of `design/ui/ui.js`, and `design/ui/reference/timeline.png` (all layers), `files.png` (one layer), `compare.png` (pair), `timeline-narrow.png` (collapsed).
**Job:** See the layers of the case at all times, and choose which ones a view reads.
**Treatment:** A column of bands, newest on top and unallocated last, each naming its layer, its time and its event count; the focused band is outlined in the accent and set out of line.
**Chrome:** One band button per layer; the mode note under the bands.

**Build order:**

1. Build the layer state in `apps/desktop/src/lib/layers.tsx`. Done when: views read one shared selection.
2. Build `CoreColumn` in `apps/desktop/src/app/CoreColumn.tsx`. Done when: each mode renders as its reference shows.

- [ ] Implement `LayerProvider` holding the case's layers and three pieces of state kept in the URL: the set of layers on (all-layers mode), the focused layer (one-layer mode) and the pair A and B. Done when: a Vitest test changes each and reads it back from the URL after a reload.
- [ ] Build `CoreColumn` and `LayerBand` rendering `.core` and `.band` with the mockup's classes, taking its mode from the current route (`design/CONTRACT.md` section 6). Done when: tests render the four modes and find the `focus`, `off` and A and B states on the right bands.
- [ ] Implement clicking a band: toggle the layer in all-layers mode (refusing to turn the last one off, with a tooltip saying why), focus it in one-layer mode, and set A then B in pair mode. Done when: tests cover each, including the refusal.
- [ ] Give each band the snapshot colour by its order (`--layer-snap-1` to `--layer-snap-3`, repeating the last) and share the middle of the column equally among more than three snapshots. Done when: a test with five snapshots renders five snapshot bands of equal height.
- [ ] Collapse to slim bands at 1240 px or less, each keeping its accessible name. Done when: a test at 1100 px finds four named buttons 44 px wide.
- [ ] Bind `[` and `]` to step the focused layer in one-layer mode. Done when: a test presses `]` on Files and the next newer layer is focused with the folder kept.
- [ ] Commit: `desktop: core column and shared layer state`

**Test checkpoint:** `pnpm --dir apps/desktop test CoreColumn layers` passes; the last-layer test fails if every layer can be turned off.

## 12. Chart components

Seven chart kinds carry the design's visuals. They are small SVG components with no chart library, so their geometry is ours and matches the mockups (`design/CONTRACT.md` section 5).

**Phase:** 7
**Needs:** none
**Surface:** yes
**Fidelity:** `design/CONTRACT.md` section 5. Visual source: the `CHARTS` generators of `design/ui/ui.js`, as they appear in `design/ui/reference/overview.png`, `timeline.png`, `deleted.png`, `activity.png`, `compare.png` and `diskmap.png`.
**Job:** Show where activity is, what kind it is and which layer holds it, at a glance.
**Treatment:** Flat marks in the layer and family tokens, mono 10 px axis labels, no gridlines beyond a lane's baseline, the accent reserved for what is called out.
**Chrome:** Density and Clusters are interactive (drag to select a range, click to select a cell); the rest are read-only.

**Build order:**

1. Build the read-only charts in `apps/desktop/src/components/charts`. Done when: each renders the mockup's geometry from the same numbers.
2. Build the two interactive ones. Done when: a drag and a click report what was selected.

- [ ] Build `LaneChart`, `ActivityArea`, `Donut`, `HourHeat` and `BarList`, each taking plain data props and reproducing the geometry of its generator in `design/ui/ui.js` (the same viewBox, bar widths, radii and label positions). Done when: a Vitest snapshot per chart, fed the generator's numbers, equals the SVG the generator emits, attribute for attribute.
- [ ] Build `DensityChart` with stacked bars per bucket and a drag that reports a time range, a double click that resets it, and keyboard selection with the arrow keys and Shift. Done when: a test drags across three buckets and receives their start and end times.
- [ ] Build `ClusterMap` drawing up to 4096 cells on a `canvas` (an SVG of that size is slow), with click and arrow key selection and a hit test that returns the cell index. Done when: a test clicks a known coordinate and receives the expected index, and drawing 4096 cells takes under 16 ms.
- [ ] Give every chart `role="img"` with a label prop that states the finding, and a visually hidden table of its data for screen readers. Done when: a test finds the label and the table for each.
- [ ] Take every colour from the `--layer-*` and `--kind-*` tokens, read once per theme change for the canvas chart. Done when: switching the theme repaints `ClusterMap` in the light values.
- [ ] Commit: `desktop: chart components`

**Test checkpoint:** `pnpm --dir apps/desktop test charts` passes; the snapshot test fails if a chart's geometry departs from its generator.

## Verification

- From a cold start: New case over the fixture E01, ingest to completion, land on the Overview, close, reopen from recents.
- Every control in SPEC B2, B3, B4, B5 and B13 has a passing test, and every B14 situation owned here has one.
- `pnpm --dir apps/desktop lint`, `test` and `e2e` pass, and no app process remains after the suite.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
