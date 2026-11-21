# Animated Sidebar provenance review

Status: the historical adaptation has been removed from the current release inputs. Its provenance is not cleared. Version 0.4.0 uses a newly authored implementation at `source-registry/ui/animated-sidebar.tsx` under the same `animated-sidebar` ID.

The historical committed input was `install-catalog/animated-sidebar.json`. Its deletion from the current tree does not make previously public source private or eligible for Pro. No previously published npm version has been removed.

## Replacement evidence

The replacement was authored from a functional brief: collapsible workspace navigation, three destinations, selected state, light/dark themes, visible keyboard focus, reduced motion, and the existing selection callback API. The implementing agent read the project instructions, design contract and this provenance finding, but did not read the previous component, generated registry implementation, or upstream source/UI.

The new implementation uses generic workspace labels, Lucide icons, ordinary CSS grid disclosure, and a selected row indicator. It contains none of the former product copy, custom ReactEmail icon, SVG tree connector, path morphing or associated geometry. Source tests cover initial selection, theme, disclosure ARIA wiring and prohibited legacy references; strict TypeScript also passes. Browser verification is recorded separately and is not implied by these checks. This documents the implementation process and concrete differences; it is not a formal legal certification.

The artifact audit also found the historical Sidebar embedded in 66 animation inputs that bundled a former application preview page. Those inputs are removed from `install-catalog/`. Their existing public IDs now map through `catalog/registry-bindings.json` to individual canonical Library modules and explicit preview props. The Library build generates their standalone CLI source without scanning a consuming application. Release validation must reject the historical Sidebar signatures across every generated registry entry, not only the `animated-sidebar` entry.

## Historical finding

On 2026-09-23, the upstream Reloop repository's LICENSE was read through the GitHub API. Blob `31afbaf86555e7c12a773192e26044621094e77b` contains an Apache-2.0 notice followed by additional restrictions on commercial redistribution and hosted services. GitHub did not identify it as an unmodified SPDX license. The prior description of the source as simply Apache-2.0 was incomplete.

References:

- [Upstream license](https://github.com/reloop-labs/reloop/blob/main/LICENSE), Git blob `31afbaf86555e7c12a773192e26044621094e77b`.
- [Referenced navigation implementation](https://github.com/reloop-labs/reloop/blob/main/apps/frontend/web/src/app/%28home%29/components/email-system.tsx), Git blob `993dd99f0d828fe701a142dd05ca7f319444d1c6`.

The source comparison found matching product labels, icon construction, submenu structure, connector geometry and motion parameters. Mova adds palette, callbacks, focus behavior and other changes. These changes support an adaptation classification; the evidence does not establish independent origin or remove the upstream restrictions. This is a factual provenance finding, not a legal conclusion about liability.

Do not restore the historical implementation to a public release without resolving its rights through an appropriate grant or clarification. Merely changing its license label, adding an attribution comment or moving it to a different repository does not establish redistribution rights. The current migration replaces that implementation rather than claiming the old restrictions have disappeared.
