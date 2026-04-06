# Documentation

The default branch keeps only durable documentation:

- [`docs/product/`](product/) — stable product intent: overview, personas, goals, principles, objectives
- [`docs/decisions/`](decisions/) — ADRs for long-lived architecture decisions
- [`docs/research/`](research/) — dated, non-authoritative research notes and dataset surveys
- [`docs/runbooks/`](runbooks/) — repeatable operating procedures

Active multi-step work belongs in `changes/<issue-id>-slug/` and is removed from the default branch after merge.

## ADR Format

`docs/decisions/ADR-NNNN-slug.md` — Date, Status (Proposed/Accepted/Superseded), Context, Decision, Consequences, Related artifacts.

## Research Note Format

`docs/research/YYYY-MM-DD-slug.md` — dated, exploratory, not authoritative. Link from ADRs when relevant.
