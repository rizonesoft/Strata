---
schema_version: 1
id: design-parity
domain: 08-desktop
status: active
title: "TODO-03 -- Design parity: the app matches the mockups 1:1"
track: M7
---

# TODO-03 -- Design parity: the app matches the mockups 1:1

> **Goal:** Every screen of the desktop app is proved to match its approved mockup pixel for pixel within the bar of the design contract, by a test that runs with the rest of the suite and fails when either side drifts.

> **Current state:** Measured 2026-11-17. The owner approved the design as presented. In the repository: `design/tokens/tokens.css`, `design/ui/ui.css`, `design/ui/ui.js`, 18 screen mockups in `design/ui/*.html`, 20 reference renders in `design/ui/reference/` (made by `scripts/design-shots.py` with headless Edge at 1440 by 900), and `design/CONTRACT.md`. The app does not exist yet, so nothing is compared.

## Inputs

- `design/CONTRACT.md` in full: section 2 (the rules), section 6 (the screens, their mockups and routes) and section 7 (how 1:1 is proved, and the bar).
- `design/ui/*.html` and `design/ui/reference/*.png`: what each screen shows and looks like.
- `scripts/design-shots.py`: how the references are rendered, so the app is captured the same way.
- The end-to-end harness from T01 §5, the design stylesheets and components from T01 §2, the core column from T01 §11 and the charts from T01 §12.

## Outcome

- `pnpm --dir apps/desktop e2e parity` compares every route in `design/CONTRACT.md` section 6 with its reference and passes.
- Changing a token, a class or an icon on one side without the other fails a test.
- A failed comparison leaves a diff image that shows where the two differ.

**Adjacency:** all=not-applicable (a test harness and its data, with no record a user lists, exports or reverses)

**Adjacency rationale:** This file adds no product surface. It is the gate that the surface sections of T01 and T02 pass through.

## Implementation Order

| Order | Section | Deliverable | Depends On | Status |
| ----- | ------- | ----------- | ---------- | ------ |
| 1 | §1 | Design data and parity mode | T01 §5, T01 §11, T01 §12 | [ ] |
| 2 | §2 | Parity comparison and drift checks | §1 | [ ] |
| 3 | §3 | Full parity run across every screen, theme and size | §2, T02 §13 | [ ] |

## 1. Design data and parity mode

The mockups show one case, Harbour Freight, with exact rows and numbers. For a pixel comparison the app must show the same content, so the bridge can be switched to serve that content from files.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** no

**Build order:**

1. Add parity mode to the bridge. Done when: the app renders a screen from a data file with no case open.
2. Extract the chart numbers from the mockup generators. Done when: the app's charts are fed the same points the mockups draw.

- [ ] Add a `STRATA_DESIGN_DATA` environment variable read at start by `apps/desktop/src-tauri/src/design.rs`: when it names a folder, every bridge command answers from `<folder>/<screen>.json` keyed by command name, and no case or evidence is opened. Done when: a Rust test starts the bridge in this mode and `case_info` returns the file's case name. The mode is compiled only into debug builds, proven by a test that the release binary ignores the variable.
- [ ] Write `apps/desktop/e2e/design-data/_shared.json` with what every case screen shows in the frame: the case name, the four layers with their times and event counts, the evidence file name, the verified state, the sidebar counts (1,204 and 7) and the status bar totals, exactly as `design/ui/ui.js` writes them. Done when: the frame in parity mode shows each of those strings.
- [ ] Add `python scripts/design-sync.py --chart-data`, which evaluates the seeded generators of `design/ui/ui.js` (the `rng` function and the `WAVE` table, ported to Python in the script and checked against the JavaScript by a test that runs both through Node) and writes each chart's numbers to `apps/desktop/e2e/design-data/_charts.json`. Done when: the Node and Python outputs are equal for every generator.
- [ ] Freeze time and locale in parity mode: the clock reads 2026-03-15 11:42 UTC, the zone is UTC and the format ISO 8601, so relative labels such as Today match the mockups. Done when: the Start screen in parity mode reads `Today, 11:42` on the first recent case.
- [ ] Document the mode in `apps/desktop/e2e/README.md`: what it is for, that it is debug only, and how to add a screen's data. Done when: the file names the variable and the three steps.
- [ ] Commit: `desktop: design data and parity mode`

**Test checkpoint:** `cargo test -p strata-desktop design` and `python scripts/design-sync.py --chart-data --check` pass; the release-build test fails if parity mode is compiled into a release.

## 2. Parity comparison and drift checks

One test compares a route with a reference. It is proved first on the components page, which needs no data, so every later screen starts from a harness known to work.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** no

**Build order:**

1. Write the comparison in `apps/desktop/e2e/parity.spec.ts`. Done when: the components route passes and a deliberate change fails.
2. Wire the drift checks into the suite. Done when: `e2e parity` runs them first.

- [ ] Write `compareWithReference(page, name)` in `apps/desktop/e2e/parity.ts`: set the viewport to 1440 by 900 at device scale 1, wait for `document.fonts.ready` and for no pending bridge call, hide the text caret, take a screenshot, and compare with `design/ui/reference/<name>.png` using `pixelmatch` at threshold 0.1. Done when: the function returns the share of differing pixels and the bounding box of the largest differing region.
- [ ] Fail when more than 0.5 percent of pixels differ or a differing region exceeds 24 by 24 px (`design/CONTRACT.md` section 7), writing `<name>.actual.png` and `<name>.diff.png` into the test's output folder and naming both in the failure message. Done when: a test feeding two images that differ by one 30 px square fails and writes both files.
- [ ] Write `parity.spec.ts` as one test per row of the screens table, generated from a list in `apps/desktop/e2e/screens.ts` that a test checks against the table in `design/CONTRACT.md`. Done when: adding a row to the contract without a list entry fails that test.
- [ ] Prove the harness on `/design/components` against `components.png`. Done when: it passes, and fails after `--radius-md` is changed in a scratch copy of the tokens. Cheaper substitute: asserting the screenshot is non-empty, which passes on any page.
- [ ] Run `python scripts/design-sync.py --check` as the first step of the `e2e parity` script. Done when: a stale generated icon module stops the run before any browser starts.
- [ ] Capture with the same browser engine the references were rendered in: record the Edge version in `design/ui/reference/RENDERED-WITH.txt` when `scripts/design-shots.py` runs, and have the parity run warn when the WebView2 runtime's major version differs. Done when: the file exists and a test with a faked mismatch prints the warning.
- [ ] Commit: `desktop: parity comparison and drift checks`

**Test checkpoint:** `bosun run -- pnpm --dir apps/desktop e2e parity -g components` passes and leaves no app process; it fails when a token changes on one side only.

## 3. Full parity run across every screen, theme and size

The last check of phase 7: the whole set at once, in both themes where the contract asks, and at the minimum window.

**Phase:** 7
**Needs:** windows-host, display-session
**Surface:** yes
**Fidelity:** `design/CONTRACT.md` sections 6 and 7, and every file in `design/ui/reference/`.
**Job:** Know that the app the examiner opens is the design the owner approved.
**Treatment:** No new surface: this section changes app code only where a comparison still fails.
**Chrome:** None.

**Build order:**

1. Run the whole parity set. Done when: every screen is at or under the bar.
2. Record the result. Done when: the measured difference per screen is committed.

- [ ] Run `pnpm --dir apps/desktop e2e parity` over all 18 screens plus `timeline-light` and `timeline-narrow`. Done when: all 20 comparisons pass in one run.
- [ ] Fix each failing screen at the component that differs, never by loosening the bar, by adding a per-screen threshold or by regenerating a reference to match the app. Done when: the bar in `parity.ts` is still 0.5 percent and 24 px, checked by a test that reads the two constants. Cheaper substitute: raising the threshold for one stubborn screen, which is the drift this file exists to stop.
- [ ] Write `apps/desktop/e2e/PARITY.md` from the run: a table of screen, differing share and largest region, with the date, the commit and the WebView2 version. Done when: the file lists 20 rows and none is over the bar.
- [ ] Confirm every mockup element has a counterpart: for each screen, a test asserts the app's DOM holds the same set of class names as the mockup's, read from the mockup file. Done when: it passes for all 18 screens and fails when a class is removed from a component.
- [ ] Add the parity run to `scripts/acceptance.ps1` of D09 T01 §1 as a step that must pass. Done when: the acceptance script fails when a parity case fails.
- [ ] Commit: `desktop: full design parity across every screen`

**Test checkpoint:** `bosun run -- pnpm --dir apps/desktop e2e parity` passes all 20 comparisons with the fixture built; it fails if any screen differs by more than 0.5 percent.

## Verification

- All 20 parity comparisons pass, and `apps/desktop/e2e/PARITY.md` records them.
- `python scripts/design-sync.py --check` passes.
- No app process remains after the run.
- `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check` pass.
