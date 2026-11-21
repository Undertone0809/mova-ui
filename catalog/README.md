# Mova source catalog

This is the canonical public catalog of reusable React UI. It contains no website application, routes, sponsor/payment flow, analytics, deployment configuration, or private infrastructure. It can also be copied out of this repository and verified on its own.

## Two distinct surfaces

- The root package's versioned manifest defines public CLI IDs independently from catalog module paths. Do not infer CLI availability from a module export.
- The root public inventory has 217 explicit `sourceRegistry` paths, 220 explicit `catalogEntries` records, and 66 `registry-bindings.json` entries. The bindings generate standalone CLI source from canonical catalog modules and explicit preset props. All inputs must have unique IDs; the root build rejects overlaps instead of silently choosing a winner. The resulting 503 IDs are the CLI/source-copy surface.
- `catalog/` preserves **153 TSX component modules and 16 supporting source files**. These are file counts, not a count of unique visual variants: some files export multiple components; `simple-comp/` retains alternate implementations. Three TSX modules are chart rendering helpers. The root `0.8.0` build includes these explicit modules at `@mova-ui/react/catalog/...`, plus declarations and hashed source records. The folder's private development package remains independently verifiable. Publication still requires an explicit release.

`manifest.json` is the complete machine-readable inventory. Catalog files may overlap registry designs; do not add these counts together as unique components.

| Group | TSX modules |
| --- | ---: |
| Cards and carousels | 13 |
| Metrics and dashboards | 29 |
| Monochrome charts | 29 |
| Dither charts and rendering helpers | 25 |
| Alternate simple chart implementations | 22 |
| CSS experiments, whimsical animation and UI kits | 26 |
| Form, text and toggle animation renderers | 3 |
| Shared button, icon, visibility and transition UI | 6 |

## Use the source

A consuming application imports the package artifact directly, for example `import { CardArc5 } from '@mova-ui/react/catalog/components/cards/CardArc5'`. A Tailwind host must scan the installed `dist/catalog/` and `dist/catalog-chunks/` directories, or include the package's generated utility stylesheet. Use the package artifact or deliberately copy source with its dependencies.

Copy the desired file and its relative imports, preserving the directory structure. The manifest lists supporting hooks, configuration data and utilities. Install the external dependencies used by those files (declared in this folder's `package.json`); there are no imports back into the website or the root package.

```tsx
import { CardArc5 } from './catalog/components/cards/CardArc5';

export function Example() {
  return <CardArc5 hovered={true} />;
}
```

Use React and Tailwind CSS v4. Scan the copied source directories in your Tailwind configuration. `styles.css` is an optional standalone Tailwind input with only the shared UI utilities; it has no website font imports or global site styling. It includes Tailwind's standard reset, so an existing host application may prefer its own Tailwind entry instead. Motion/CSS animations generally need client rendering; Recharts needs a sized container, and canvas components need browser canvas APIs. Set component theme props as appropriate; no application theme context is required.

Configuration data retains CLI commands only for supported root registry IDs. In the root artifact, that support set is derived from `registry/manifest.json` component IDs during the build. Unsupported examples point to the published `@mova-ui/react/catalog/...` exports and manifest source records, not an unpublished `catalog/` path or a nonexistent CLI install.

## Verify independently

```sh
cd catalog
npm ci --include=dev
npm run verify
```

Verification runs strict TypeScript checking, inventory/import/privacy tests, a server-render smoke across cards, metrics, text effects and charts, then bundles all 153 component modules and generates CSS. Output goes to ignored `.build/` solely as a compilation check, not a published build. Tests do not claim comprehensive browser interaction or animation fidelity coverage.

## External demo content

Some original examples intentionally use public remote images (Unsplash, Pravatar, Pinterest and Transparent Textures). `GitHubActivity` fetches public GitHub/contribution data. These are not private website services, but rendering those examples can make network requests. Replace demo imagery and review its licensing before shipping; remote images have their own usage terms. No remote media was downloaded into this catalog.

## Maintenance

Keep this catalog separate from `source-registry/`: adding a module requires an explicit catalog allowlist change and package-consumer verification; creating a CLI ID additionally requires the public registry allowlist. Update the manifest and inventory tests whenever adding files. The preserved React 19 ref initializers, Motion transition literals and Recharts tooltip typing have been repaired without disabling strict checking.
