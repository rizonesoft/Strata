# Contributing to Strata

Strata is pre-alpha and is being built from a written plan. This page says how to take part without working against that plan.

## What is useful right now?

- **Read the plan and say what is wrong with it.** The [foundation plan](docs/plans/2026-11-16-strata-foundation.md), the [interface specification](design/SPEC.md) and the [implementation plan](todo/implementation-plan.md) are the product until code exists. A mistake found there is the cheapest one to fix.
- **Forensic knowledge.** A format detail the plan gets wrong, an artifact version it misses, a case where a parser assumption breaks: open an issue with the source.
- **Test evidence.** Descriptions of real-world image quirks (never the images themselves, and never data from a real case).

## What should wait?

Pull requests that build ahead of the plan. Each section of the plan is built, tested and reviewed in order, and a change that skips ahead usually has to be redone. If you want to build something, open an issue first and say which section it belongs to.

## How is a change made?

1. Find the section that owns the work in [`todo/`](todo). If none does, open an issue so one can be written.
2. Keep the change to that section's scope. A problem you notice elsewhere goes in an issue, not in the same pull request.
3. Every code change comes with a test that fails without it.
4. Run the checks the section names. For the plan itself: `python scripts/todo-graph.py validate` and `python scripts/todo-graph.py plan --check`.
5. Write commit messages in the imperative, with the section reference in the body.

## What are the rules for code?

- **Evidence is read-only.** No code opens an image for writing.
- **Parsers never panic.** Malformed input returns an error with its offset. `unsafe` is forbidden in the workspace.
- **Permissive dependencies only.** MIT, Apache-2.0, BSD, ISC, Zlib and Unicode. `cargo deny` enforces it.
- **The design is fixed.** The desktop app matches the mockups in [`design/ui`](design/ui) under the [design contract](design/CONTRACT.md). To change the look, change the mockup first.
- **Fix at the owning layer.** A setting in its setting, behaviour in the code that produces it. No output filter that hides a problem.

[AGENTS.md](AGENTS.md) has the full working rules, which apply to people and to coding agents alike.

## Licence of contributions

By contributing you agree that your contribution is licensed under the [Apache License, Version 2.0](LICENSE), as section 5 of that licence says.
