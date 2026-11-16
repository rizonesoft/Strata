# AGENTS.md

This repository follows the Conclave-SDK 3-agent conventions. Adapt this file to the project: say where the code lives and which commands verify it.

## Goal

Build Strata, a read-only Windows digital forensics suite that drills through the layers of a disk image (volumes, NTFS, volume shadow copies, unallocated space) and reconstructs a provenance-backed timeline of events an examiner can query, compare across layers and report on.

## Governing documents

- [docs/plans/2026-11-16-strata-foundation.md](./docs/plans/2026-11-16-strata-foundation.md): scope of version 1, the technology stack, the architecture, the case store, integrity rules and milestones. Read it before any change.
- [design/SPEC.md](./design/SPEC.md): every command of the `strata` command line and every screen and control of the desktop app.
- [design/CONTRACT.md](./design/CONTRACT.md): binds the desktop app to the approved mockups in `design/ui/` 1:1, and says how that is proved. The design is fixed: to change the look, change the mockup first.
- [todo/implementation-plan.md](./todo/implementation-plan.md): the generated plan. The TODO files under `todo/` carry the documents above out.

## Technology stack

- Engine and command line: Rust (stable, MSVC target) in one Cargo workspace, crates under `crates/`. The layering is one way: `strata-core`, `strata-image`, `strata-volume`, `strata-ntfs`, `strata-vss`, `strata-carve`, `strata-artifacts`, `strata-case`, `strata-engine`, then `strata-cli`.
- Case store: DuckDB through the `duckdb` crate with the `bundled` feature, one `case.duckdb` per case folder.
- Desktop app: Tauri 2 with React, TypeScript, Vite and pnpm in `apps/desktop`. It calls `strata-engine` only.
- Dependencies carry permissive licences only (MIT, Apache-2.0, BSD, ISC, Zlib, Unicode). No GPL or AGPL crate.
- Evidence is read-only. No code opens an image for writing, and no parser may panic on malformed input.
- Integration tests read the fixture image built by `fixtures/build-fixture.ps1`. A test that needs it fails when it is missing; it never skips.
- Strata is licensed under Apache-2.0. The brand is in `assets/brand` (built by `scripts/brand-assets.py`) and the bundled fonts in `assets/fonts`.

## Campaign runs

- A campaign is started by its operator with `pwsh scripts/start-run.ps1` or the desktop shortcuts it installs (`Strata Claude campaign`, `Strata Carbon campaign`). Nothing restarts a run.
- The launcher starts the run elevated (owner decision 2026-11-17), because D00 T01 §4 builds the fixture image and that needs administrator rights. The plan marks such sections with the Need `elevated`, probed in `todo/plan.json`.
- An elevated session uses its rights only for what a plan section names (mounting the fixture VHD, creating its shadow copies). It changes nothing else outside the repository, installs nothing system-wide that a section does not name, and never disables a security control.
- The unattended kit's tmux runner (`scripts/unattended-run.py`) is installed but runs in WSL, which lacks the Windows toolchain this project builds with. Use the launcher above.

## Working rules

- Verify files, routes, schemas, tools, and commands before relying on them. A path someone mentions is a hypothesis until it is on disk.
- Inspect existing patterns, imports, the package manager, the framework, and the test commands before editing. Do not infer architecture or tool schemas from memory when the repository can answer.
- Resolve a tool by capability before path. Prefer explicit config, then discovery, then a setup-required state. Store discovered paths only in ignored local config and never hardcode user-specific absolute paths.
- Prefer global or user-level tool installs. Add repo-scoped wrappers only when they encode project-specific behavior or reproducible commands.
- Real data only. Demo or seed data stays behind an explicit demo mode and is labeled as such.
- Run the relevant typecheck, lint, and tests after a change.
- Fix at the owning layer: a setting in its setting, behaviour in the code that produces it, data in the data. No output filters that hide a problem. Code changes end the report with a `Layer:` line.
- Markdown prose is never hard-wrapped: one line per paragraph and per list item. Every Markdown table row stays `<= 120` characters so raw `.md` files never wrap.
- Never use em dashes or en dashes anywhere: prose, code, comments, commit messages and generated files.
- Temporary files and full logs go to scratch, never the repository: the session scratchpad when one is given, otherwise the folder `paths.scratch` names in `.conclave/local.toml`, otherwise the operating system's temporary folder.

## Operating directive

How to work without waiting to be told. When to ask the operator is listed under Safety, and only there.

- A task assigned is a task authorised: do it, then report what was done, with the evidence.
- Never end a turn with a question or an offer when the next step is known and unblocked: take the step.
- Finish the follow-ups this session can do safely (a config value, a setup step, a check to run again) and report them done, never as a list left for the operator.
- Ask the operator only for what Safety lists: once, with the options and the one you recommend, and keep working on everything the answer does not change.
- Fix forward: a risk found later is filed as ordinary work that blocks nothing, and a red check is fixed at its cause, never skipped or bypassed.
- Build the simplest design that meets the request in full, and add a check, gate or prerequisite only for a failure that has happened or one that would lose data, spend money or expose something.
- An unattended run never asks the operator: it takes the industry-standard option, records the decision and what reversing it would cost in the run file and files an owner item; it halts only through the run's own pause mechanism, and pauses instead of proceeding only for data loss, a credential, shared infrastructure or a calculation that looks wrong.

## Safety

- Local reversible work in the repository needs no confirmation, and neither does work outside it that the task authorised and that can be undone (a config value, a setup step, a deploy the task asked for).
- Ask the operator once before anything that destroys or exposes something, or that needs business context the repository lacks: dropping or overwriting data, a force-push, deleting outside the repository, creating, rotating or exposing a credential, sending mail or a message to a person, a SQL write or a production change with real blast radius.
- When a command needs sudo, give the operator the exact command to run with `! sudo ...`. Never store the sudo password.
- Never print, log, or commit a secret value.

## Git

A project with a branch workflow replaces the first rule with its own; the others hold everywhere.

- Develop on the main branch: commit there, with no feature branch, unless the operator asks for a branch in that task.
- Before staging, read `git status --short` and enough of the diff to understand every dirty file: another session or a person may be editing.
- Commit a safe side change (small, not secret, not generated, not in conflict) with the next coherent commit; stop and say why before touching one that conflicts, holds a secret or looks unsafe or generated.
- Never discard changes with `git reset`, `checkout`, `restore` or `clean` unless asked for that exact cleanup.
- After a commit, confirm it landed with `git log --oneline -1` and `git status --short`, and never filter hook output in a way that hides an error.
- When work is finished, remove the worktrees you or a subagent created, delete branches that are merged or whose content is verifiably on main, and prune dead worktree records.
- Never delete an unmerged branch whose content is not verifiably on main without asking.

## Skills

- Antigravity skills live in `.agents/skills/<name>/`, Claude skills in `.claude/skills/<name>/`, and Codex skills in `.codex/skills/<name>/`, all as real files, never symlinks. Change all three together.
- Follow [Agent Skills and Rules Structure](./docs/agent-skills-and-rules-structure.md) before adding or moving skills.
- Name a skill for its capability, not with a project prefix.
- Each agent reads and runs only its own directory (`.agents/` for Antigravity, `.claude/` for Claude Code, `.codex/` for Codex) and never edits another agent's skills unless asked.

## Subagents

- Delegate mechanical subtasks to subagents. Claude subagents pin an explicit `model:`: Sonnet by default, and Opus (with a `model_rationale:`) only where judgment quality needs it.
- Subagents read and run; they never write. Every Claude subagent declares an explicit `tools:` list without Edit, Write, MultiEdit, NotebookEdit or `*`. The main loop makes every change and verifies what subagents return.
- Antigravity uses native `Orchestrator (Carbon)` (`gemini-pro-orchestrator`), which plans on Carbon (`<plan_execute_protocol>`), hands execution to Hydrogen via `exit_plan_mode`, manages its own effort (rejecting `--effort`), and provides built-in subagents (`self`, `research`, `image-generator`) without custom `.agents/agents/*.md` files or wrapper scripts. Codex has no subagent definitions: it runs mechanical subtasks in the main session.
- Haiku is only for near-mechanical work, at least 90% mechanical (read-only lookups, inventories, structural checks), whose output a script or the main loop verifies. Pin `claude-haiku-5-5` or later, declare `mechanical_share:` (90 to 100), point `haiku_replay:` at a record of a known-answer replay that showed no loss against Sonnet, and give it no edit tools. Never use Haiku for review, audit, research, security, debugging, diagnosis, planning or design.
- Run `node scripts/verify-agent-tiers.mjs` after adding or changing a Claude agent definition in `.claude/agents/`; it enforces these rules.

## TODO workflow

Plan and build through the TODO system: [docs/todo-workflow.md](./docs/todo-workflow.md).
