# Mova Component Design Contract

This document defines the design contract for components whose source is owned by Mova Library. Website chrome, preview stages, catalog cards, SEO presentation, and account surfaces are maintained separately by the consuming website. Site styling must not silently change a component's source geometry or interaction contract.

## API and Source Fidelity

- Keep component APIs explicit, portable, and typed.
- Preserve the source component's states, default behavior, composition model, and meaningful prop names.
- A copied component must run without imports from Mova Site, private aliases, or unpublished packages.
- Every component has a stable public ID, source path, version, dependency list, exports, and preview mode in the generated manifest.
- Do not publish a component only because a Site demo imports it. Promote it deliberately through `source-registry/` or the reviewed public catalog allowlist.

## Geometry and Density

- Use a 4px base spacing unit; compact controls generally use 4, 8, 12, or 16px gaps.
- Keep fixed-format controls, boards, grids, toolbars, and tiles dimensionally stable with explicit tracks, aspect ratios, minimum sizes, or overflow behavior.
- Preserve source-defined geometry when adapting an existing component. Do not replace fixed dimensions with viewport-scaled typography or layout that shifts during hover, focus, or content changes.
- Component surfaces normally use restrained radii of 8px or less unless the source interaction needs a larger radius.
- Do not make the component palette a single hue family or rely on decorative gradients and orbs.

## Motion

- Motion must explain a state change or establish a spatial relationship.
- Support `prefers-reduced-motion: reduce` by removing or shortening movement, rotation, scaling, and infinite loops while preserving the state and task.
- Prefer transform and opacity animation over layout thrashing.
- Hover motion needs an equivalent focus-visible state. Static status glyphs must not spin to imply activity.
- Use stable timing: short feedback is generally 150-250ms; longer transitions should be justified by the spatial move.
- In Sidebar Nav, keep the Chats scroll viewport at its expanded height during the reveal. Clipping the viewport lets short histories open without a transient scrollbar and leaves long histories scrollable.

## Accessibility

- Every interactive element must be keyboard reachable and have a visible focus state.
- Icon-only controls need an accessible name; toolbars and composite widgets need an appropriate role and state attributes.
- Provide keyboard alternatives for pointer-only interactions, and announce meaningful drag or status changes through an accessible live region.
- Do not make color the only signal for focus, success, warning, failure, or progress.
- Check reduced motion, zoom, narrow viewports, long labels, empty states, and error states in a real browser.

## Dependencies and Licensing

- Declare every runtime dependency in the package.
- Avoid hidden CDN, Site, workspace, or environment dependencies.
- Keep generated catalog bundles clearly identified and do not claim generated JavaScript has the same source-level type fidelity as maintained TypeScript.

## Acceptance

A public component is complete only when:

- Its source is in the canonical Library boundary and appears exactly once in the public artifact.
- Its ID is in the explicit allowlist and its manifest entry is `tier: free`.
- The manifest entry has version, exports, dependencies, preview mode, and a deterministic artifact hash.
- The component passes strict declaration generation, package scans, CLI copy checks, and independent consumer installation.
- Keyboard, focus, reduced-motion, responsive geometry, and real-browser behavior have been checked.
- Site preview and copy output read the Library artifact rather than a parallel Site source file.

For a supplied reference component, acceptance includes a source-to-implementation
comparison and real-browser checks of the initial state and each meaningful
interaction state. Check submitted input, repeat actions, navigation, empty
states, scroll position, and animation completion against the reference. Record
the states actually checked and unresolved differences; a build or a screenshot
of the initial state alone does not establish visual or behavioral fidelity.
