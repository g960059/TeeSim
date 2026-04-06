# Release

> This runbook is a placeholder for an early-stage project. Update it when the first release process is established.

## Versioning

TeeSim uses semantic versioning: `MAJOR.MINOR.PATCH`.

- `MAJOR` — breaking change to the asset format or simulator API
- `MINOR` — new features (new views, new cases, new UI capabilities)
- `PATCH` — bug fixes, documentation, asset corrections

## Release Checklist

- [ ] All open Issues for the milestone are closed or deferred
- [ ] `docs-validate.yml` passes on the release branch
- [ ] All ADRs for decisions in this release are marked Accepted
- [ ] Asset bundle validated: all required GLB/VTI/JSON files present and loadable
- [ ] Visual snapshot tests pass for all anchor views
- [ ] Changelog updated
- [ ] Git tag created: `v<version>`
- [ ] GitHub Release created with changelog and asset download links

## Asset Publishing

In MVP, assets are served as static files. The publishing step is:

1. Build the asset bundle from the internal pipeline
2. Place assets in `public/cases/` following the case manifest schema
3. Deploy to hosting (TBD — GitHub Pages, Vercel, or CDN)

Update this runbook when a CI/CD deployment pipeline is established.
