# Mova

**Make interfaces feel alive.**

React components for motion: entrance transitions, hover effects, text reveals, loading indicators, and scroll interactions. Import them as a library, or copy the source into your project with the bundled CLI.

This repository contains the complete reusable component library, catalog, offline source CLI, and interactive Blocks. Release candidates can be built and reviewed locally before publication.

## Install

Requires Node.js 20+ and React / React DOM 18.2+ or 19.

```bash
npm install @mova-ui/react
```

Import the CSS once in your app entry point. Mova ships compiled styles, so you do not need to configure Tailwind. The stylesheet includes component utilities without a global reset.

```tsx
import { FadeIn, GlowButton } from '@mova-ui/react';
import '@mova-ui/react/styles.css';

export function Welcome() {
  return (
    <FadeIn>
      <GlowButton onClick={() => console.log('Hello!')}>
        Try Mova
      </GlowButton>
    </FadeIn>
  );
}
```

The package includes TypeScript declarations and an ESM entry point. In frameworks with React Server Components, use interactive components inside a client boundary.

## Copy components

Run the CLI from a project directory containing `package.json`:

```bash
npx @mova-ui/react list
npx @mova-ui/react add glow-button
npx @mova-ui/react add fade-in --dir src/components/mova
npx @mova-ui/react --help
```

The CLI copies component source and `styles.css` into `src/components/mova` by default. Missing dependencies are installed automatically using your project's npm, pnpm, yarn, or bun. Import the copied CSS once.

Component sources are bundled with the package. Use `--skip-install` for offline source copying; otherwise dependency installation updates your package manifest and lockfile. It refuses symlink targets and paths outside your project. Existing component files stay untouched unless you pass `--overwrite`.

The extended site catalog is generated into standalone JavaScript bundles stored in `.tsx` files with an explicit typecheck exemption. Original library components retain their TypeScript source; generated catalog bundles do not preserve their original prop types.

See [Infinite collections](docs/infinite-collections.md) for the spherical menu and draggable card grid APIs, and [Spatial Music Gallery](docs/spatial-music-gallery.md) for the music collection and playback API.

## Blocks

Four self-contained interactive demos are available from a separate package entry point. They use fictional local data and need no backend, camera, microphone, or account service.

```tsx
import { CalendarBlock, CanvasBlock, CameraBlock, WrappedBlock } from '@mova-ui/react/blocks';
import '@mova-ui/react/blocks/styles.css';

export function CalendarDemo() {
  return <CalendarBlock />;
}
```

Each Block accepts `thumbnail?: boolean`. Calendar supports event editing, Canvas supports local notes and voting, Camera develops a fictional photograph, and Wrapped creates a downloadable recap. Images ship with the package. The shared stylesheet imports fonts from npm dependencies and works with an ESM bundler such as Vite.

For source copying, import `@mova-ui/react/blocks/sources.json`. Its `blocks` array contains each Block's `id`, `exportName`, `dependencies`, text `files` (`path`, `content`), and binary `assets` (`path`, `packagePath`). Install React DOM and the listed dependencies. Copy the text files and images with their relative paths, then import the component from its TSX file. The existing offline CLI inventory remains separate. Asset bytes are available through `@mova-ui/react/blocks/assets/*`.

## Development

This repository contains the component library and CLI only. See [CONTRIBUTING.md](CONTRIBUTING.md) for standalone setup, source boundaries, and verification, and [the design contract](docs/design.md) for component behavior and accessibility.

```bash
npm ci --include=dev
npm run build
npm test
npm run test:consumer
# Run all checks:
npm run verify
```

- `source-registry/` contains the editable components, hooks, and utilities. The classic toggle is stored as registry JSON.
- `scripts/build.mjs` compiles the ESM bundle, strict TypeScript declarations, CSS, and offline registry.
- `bin/mova.mjs` implements the source-copy CLI.
- `install-catalog/` contains the reviewed CLI inputs listed in `public-registry.json`. Maintain these canonical inputs in this repository.
- `tests/` covers package exports, CLI safety, and installation into a separate React consumer.

The public inventory is explicitly allowlisted in `public-registry.json`, `catalog/manifest.json`, and `catalog/registry-bindings.json`. Bindings generate standalone CLI source from canonical catalog modules and preset props. Duplicate paths or component IDs are rejected by the build, and the finalized `registry/manifest.json` is the source of truth for the artifact's CLI IDs.

The build recreates `dist/`, `registry/`, and `.generated/`. Do not edit those directories. Consumer verification packs the library, checks its file allowlist, installs it in a temporary project, then runs CLI commands, server rendering, strict typechecking, and a Vite production build.

## Source catalog

`catalog/` owns 153 reusable UI modules and 16 support files: cards, charts, metrics, forms, toggles, text effects, and CSS animation experiments. The package exports the explicit module allowlist through `@mova-ui/react/catalog/...` and includes canonical source records in its versioned manifest. These subpaths are separate from root exports and do not create additional CLI IDs. During the root build, `catalog/data/supportedRegistryIds.ts` is generated from the finalized `registry/manifest.json` component IDs; the checked-in catalog copy is only a standalone fallback. See [the catalog guide](catalog/README.md) for source development. Local artifact availability does not imply that this version has been published to npm.

```bash
npm ci --prefix catalog --include=dev
npm --prefix catalog run verify
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for build commands, independent consumer checks, source boundaries, and pull request guidance. Publication is a separate maintainer operation and requires an explicit release request.

## References

- [Magic UI](https://magicui.design/components/blur-fade)
- [Amicro](https://github.com/Subhan-code/Amicro--Micro-transitions-)
