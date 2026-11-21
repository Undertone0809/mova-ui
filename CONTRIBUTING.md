# Contributing to Mova

This repository contains the React component SDK, source catalog, and offline CLI. These instructions support a standalone checkout. Package publication and repository visibility remain separate maintainer operations.

## Set up and verify

Use Node.js 20 or newer and npm. Run from this repository's root:

```sh
npm ci --include=dev
npm run build
npm test
npm run test:consumer
# Runs build, tests, and the independent package consumer:
npm run verify
```

For catalog changes, also run its standalone checks:

```sh
npm ci --prefix catalog --include=dev
npm --prefix catalog run verify
```

The root consumer check packs the package, inspects its file allowlist, installs it into an independent React project, and checks CLI copying, server rendering, strict TypeScript, and a Vite production build. It does not prove browser interaction or animation fidelity. See [the catalog guide](catalog/README.md) for the catalog's additional checks.

## Edit the canonical inputs

- `blocks/` owns the four portable interactive Blocks, scoped CSS, and images.
- `source-registry/` owns component, hook, utility, and registry JSON source.
- `catalog/` owns catalog modules and supporting source. `catalog/manifest.json` explicitly lists modules; `catalog/registry-bindings.json` maps CLI IDs to canonical modules and preset props.
- `install-catalog/` contains reviewed CLI inputs. `public-registry.json` explicitly allows published inputs. Do not replace either allowlist with recursive discovery.
- `bin/mova.mjs` implements the offline CLI; `scripts/build.mjs` compiles package code, declarations, CSS, and the registry.
- `tests/` covers the package, CLI safety, artifact boundaries, and independent consumers.

The build recreates `dist/`, `.generated/`, and `registry/`; do not edit those outputs. Keep public IDs unique and manifest entries consistent with exports, dependencies, version, preview mode, and `tier: free`. A catalog module export does not automatically create a CLI ID. Copied components must work without Site imports, private aliases, unpublished dependencies, or a parent checkout.

Keep private Pro source, credentials, source maps, and private configuration or metadata out of source and package artifacts. Include only reviewed free-tier source. Check `npm pack --dry-run` when package contents change; inspect unexpected files.

## Design, accessibility, and provenance

Follow [the component design contract](docs/design.md). Preserve API behavior, source geometry, keyboard access, visible focus, responsive layout, and reduced motion. For interactive changes, compare initial and meaningful interaction states in a real browser; include the states checked and any unresolved differences in your pull request. Run the relevant root and catalog checks, and add regression coverage for API or behavior changes.

Read [Animated Sidebar provenance](docs/provenance/animated-sidebar.md) before changing that component; the historical implementation must not be restored without resolving its redistribution rights. [Interactive-card provenance](docs/provenance/interactive-cards.md) records additional source attribution.

## Submit a change

Keep changes focused. Describe the resulting behavior, relevant checks, and any API or usage changes. Update the root README or `docs/` when user-facing behavior changes. Reusable SDK source belongs here; website application, account, billing, and deployment code belong in the consuming website repository.

Use `package.json` as the command source of truth. Package publication, release version changes, and visibility changes are separate maintainer operations that need explicit authorization; routine contribution checks do not perform a release.
