# AGENTS

Read: `README.md` → `docs/product/` → `docs/decisions/` → `docs/runbooks/` → active Issue/PR → active `changes/<issue-id>-slug/` when present.

Source of truth: code, tests, schemas, CI, ADRs. `changes/` and dated research are working notes.

For non-trivial work, plan first; if the plan breaks, stop and re-plan.

Use subagents for focused research and parallel verification when useful, one task each.

Prefer root-cause fixes over patches. No silent fallbacks, no hidden errors, unless explicitly required.

For non-trivial changes, choose the simpler cleaner design; avoid over-engineering simple fixes.

Require concrete proof before done: run relevant tests, inspect logs/output, and verify behavior.

Keep diffs small, update tests with behavior changes, promote durable knowledge before merge, and remove `changes/<issue-id>-slug/` in the final PR that completes the work.

## Domain Context

See `CLAUDE.md` for TEE domain vocabulary, tech stack, and data governance rules.

## Commit Convention

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `chore:` tooling, CI, config

## Branch Naming

`feat/<slug>`, `fix/<slug>`, `docs/<slug>`
