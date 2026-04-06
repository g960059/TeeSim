# Change Lifecycle

`Discussion → Issue → changes/<issue-id>-slug/ → branch → PR → merge → retire change pack`

## When to Use a Change Pack

Create a `changes/` folder for any work that:
- Requires more than one PR
- Involves a non-obvious design decision
- Touches multiple systems (data pipeline + browser + docs)

Skip a change pack for single-file typo fixes, dependency bumps, and trivial documentation edits.

## Steps

1. **Create an Issue** — use the appropriate issue template (feature, bug, research)
2. **Create a branch** — `feat/<slug>` or `fix/<slug>`
3. **Copy the change pack template**
   ```
   cp -r changes/_template changes/<issue-id>-short-name
   ```
4. **Fill in the change pack** — requirements, design, plan before writing code
5. **Implement** — check off tasks in `tasks.md` as you go
6. **Open a PR** — reference the Issue and change pack; fill in the PR template
7. **Merge** — squash or merge commit per project convention
8. **Retire the change pack** — remove `changes/<issue-id>-slug/` in the final PR

## When to Write an ADR

Write `docs/decisions/ADR-NNNN-slug.md` when a decision is:
- Hard to reverse (e.g., rendering engine choice, data format, framework)
- Likely to be questioned later (e.g., why VTK.js over Three.js)
- Made under constraints that future contributors won't remember

Mark ADRs as **Proposed** when drafted, **Accepted** when the team agrees, **Superseded** with a link to the replacement when overridden.
