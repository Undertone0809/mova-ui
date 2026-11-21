import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = resolve('.');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'registry/manifest.json'), 'utf8'));
const catalogManifest = JSON.parse(readFileSync(join(root, 'catalog/manifest.json'), 'utf8'));
const registryBindings = JSON.parse(readFileSync(join(root, 'catalog/registry-bindings.json'), 'utf8'));
const publicConfig = JSON.parse(readFileSync(join(root, 'public-registry.json'), 'utf8'));
const packageDependencies = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]);

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function withoutExtension(path) {
  return path.replace(/\.tsx?$/, '');
}

function sourceRegistryComponentId(path) {
  if (path.endsWith('.json')) {
    const item = JSON.parse(readFileSync(join(root, 'source-registry', path), 'utf8'));
    const sourcePath = item.files?.[0]?.path;
    assert.equal(typeof sourcePath, 'string', `source registry JSON lacks a component path: ${path}`);
    return basename(sourcePath).replace(/\.tsx?$/, '');
  }
  return basename(path).replace(/\.tsx?$/, '');
}

test('catalog manifest and package outputs stay on the reviewed module allowlist', () => {
  assert.equal(catalogManifest.status, 'public-modules');
  const expected = [...catalogManifest.components, ...catalogManifest.supportFiles]
    .map(withoutExtension)
    .sort();
  const modules = manifest.catalogModules;
  assert.equal(modules.length, 169);
  const supportedIdsModule = modules.find((module) => module.path === 'data/supportedRegistryIds');
  assert.ok(supportedIdsModule);
  const supportedIds = [...supportedIdsModule.content.matchAll(/^\s+"([^"]+)",$/gm)].map((match) => match[1]);
  assert.deepEqual(supportedIds, manifest.components.map((component) => component.id).sort());
  assert.deepEqual(modules.map((module) => module.path).sort(), expected);

  const emitted = files(join(root, 'dist/catalog'))
    .map((path) => relative(join(root, 'dist/catalog'), path))
    .filter((path) => /\.(?:js|d\.ts)$/.test(path))
    .sort();
  assert.deepEqual(emitted, [
    ...expected.map((path) => `${path}.d.ts`),
    ...expected.map((path) => `${path}.js`),
  ].sort());

  for (const module of modules) {
    assert.equal(module.path, withoutExtension(module.sourcePath));
    assert.equal(module.tier, 'free', module.path);
    assert.equal(module.previewMode, 'client', module.path);
    assert.equal(Object.hasOwn(module, 'license'), false, module.path);
    assert.equal(module.sourceHash, sha256(module.content), module.path);
    for (const dependency of module.dependencies) {
      assert.ok(packageDependencies.has(dependency), module.path + ': undeclared dependency ' + dependency);
    }
    assert.equal(module.dependencies.includes('@mova-ui/react'), false, module.path + ': self-reference leaked from a snippet');
    assert.equal(module.dependencies.some((dependency) => dependency.startsWith('@/')), false, module.path + ': alias leaked from a snippet');
    assert.doesNotMatch(module.content, /from ['"]motion\/react['"]/, module.path);
    assert.doesNotMatch(module.content, /\/Users\/|\/private\/tmp|sourceMappingURL/, module.path);
    assert.ok(module.exports.length > 0, module.path);
    assert.ok(existsSync(join(root, 'dist/catalog', `${module.path}.js`)), module.path);
    assert.ok(existsSync(join(root, 'dist/catalog', `${module.path}.d.ts`)), module.path);
  }

  const { artifactHash, ...payload } = manifest;
  assert.equal(artifactHash, sha256(JSON.stringify(payload)));
  assert.equal(pkg.version, '0.8.0');
  assert.deepEqual(pkg.exports['./catalog/*'], {
    types: './dist/catalog/*.d.ts',
    import: './dist/catalog/*.js',
    require: './dist/catalog/*.js',
  });
});

test('source, catalog, and binding public allowlists are unique, disjoint, and complete', () => {
  const sourcePaths = publicConfig.sourceRegistry;
  const catalogFiles = publicConfig.catalogEntries;
  const sourceIds = sourcePaths.map(sourceRegistryComponentId);
  const catalogIds = catalogFiles.map((file) => (
    JSON.parse(readFileSync(join(root, 'install-catalog', file), 'utf8')).id
  ));
  const bindingIds = Object.keys(registryBindings);

  assert.equal(sourcePaths.length, 217);
  assert.equal(catalogFiles.length, 220);
  assert.equal(bindingIds.length, 66);
  assert.equal(new Set(sourcePaths).size, sourcePaths.length);
  assert.equal(new Set(catalogFiles).size, catalogFiles.length);
  assert.equal(new Set(sourceIds).size, sourceIds.length);
  assert.equal(new Set(catalogIds).size, catalogIds.length);
  assert.equal(new Set(bindingIds).size, bindingIds.length);

  const catalogIdSet = new Set(catalogIds);
  const bindingIdSet = new Set(bindingIds);
  assert.deepEqual(sourceIds.filter((id) => catalogIdSet.has(id)), []);
  assert.deepEqual(sourceIds.filter((id) => bindingIdSet.has(id)), []);
  assert.deepEqual(catalogIds.filter((id) => bindingIdSet.has(id)), []);
  assert.deepEqual(
    [...sourceIds, ...catalogIds, ...bindingIds].sort(),
    manifest.components.map((component) => component.id).sort(),
  );
});

test('canonical catalog bindings generate safe standalone CLI adapters', async () => {
  assert.equal(Object.keys(registryBindings).length, 66);
  const packageDependencies = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]);
  for (const [id, binding] of Object.entries(registryBindings)) {
    const entry = manifest.components.find((component) => component.id === id);
    assert.ok(entry, id);
    assert.equal(entry.file, `${id}.tsx`, id);
    assert.equal(entry.sourcePath, binding.sourcePath, id);
    assert.deepEqual(entry.exports, ['default'], id);
    assert.equal(entry.tier, 'free', id);
    assert.equal(Object.hasOwn(entry, 'license'), false, id);
    assert.equal(entry.previewMode, 'client', id);
    assert.match(entry.content, /MovaComponentAdapter|PRESET_PROPS/, id);
    assert.doesNotMatch(entry.content, /mova-sidebar-child-hover|mova-sidebar-parent-hover|mova-sidebar-active-indicator|ReactEmailIcon|React Email supported|reloop-labs\/reloop/i, id);
    assert.doesNotMatch(entry.content, /from ['"]motion\/react['"]/, id);
    for (const dependency of entry.dependencies) {
      assert.ok(packageDependencies.has(dependency), `${id}: undeclared dependency ${dependency}`);
      assert.notEqual(dependency, '@mova-ui/react', `${id}: self-reference`);
      assert.doesNotMatch(dependency, /^@\//, `${id}: private alias`);
    }
  }
  for (const entry of manifest.components) {
    assert.doesNotMatch(entry.content, /mova-sidebar-child-hover|mova-sidebar-parent-hover|mova-sidebar-active-indicator|ReactEmailIcon|React Email supported|reloop-labs\/reloop/i, entry.id);
  }

  async function loadAdapter(id) {
    const entry = manifest.components.find((component) => component.id === id);
    const result = await build({
      stdin: { contents: entry.content, resolveDir: root, loader: 'js' },
      bundle: true,
      format: 'cjs',
      platform: 'node',
      packages: 'external',
      write: false,
      logLevel: 'warning',
    });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    return module.exports.default;
  }

  const category = await loadAdapter('category-select');
  const categoryHtml = renderToStaticMarkup(React.createElement(category, { theme: 'light' }));
  assert.match(categoryHtml, /bg-white/);
  assert.doesNotMatch(categoryHtml, /bg-\[#181818\]/);

  const hoverLink = await loadAdapter('hover-link-card');
  const hoverLinkHtml = renderToStaticMarkup(React.createElement(hoverLink, { href: 'https://override.example' }));
  assert.match(hoverLinkHtml, /https:\/\/override\.example/);
});

test('catalog subpaths import through npm exports and render with SSR', async () => {
  const card = await import('@mova-ui/react/catalog/components/cards/CardArc5');
  const budget = await import('@mova-ui/react/catalog/components/metrics/Budget');
  const chart = await import('@mova-ui/react/catalog/components/mono-charts/MonoRoundedBarChart');
  assert.ok(card.CardArc5, 'CardArc5 exports a React element type');
  assert.equal(typeof budget.default, 'function');
  assert.equal(typeof chart.MonoRoundedBarChart, 'function');

  const html = renderToStaticMarkup(React.createElement('main', null,
    React.createElement(card.CardArc5, { hovered: true }),
    React.createElement(budget.default),
    React.createElement(chart.MonoRoundedBarChart, { compact: true }),
  ));
  assert.match(html, /w-\[8rem\]/);
  assert.match(html, /BUDGET/);
  assert.match(html, /Mono Pill Pillars/);
});

test('image-based catalog components render supplied artwork and handle single or empty sets', async () => {
  const { CardTimeMachine } = await import('@mova-ui/react/catalog/components/cards/CardTimeMachine');
  const { DitherBook } = await import('@mova-ui/react/catalog/components/dither-charts/DitherBook');
  const artwork = { id: 'ink', src: '/ink.webp', title: 'Ink drawing', alt: 'Ink drawing of a reading room' };
  const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

  const timeline = render(CardTimeMachine, { images: [{ ...artwork, date: 'Today' }] });
  assert.match(timeline, /src="\/ink\.webp"/);
  assert.match(timeline, /alt="Ink drawing of a reading room"/);
  assert.doesNotMatch(timeline, /images\.unsplash\.com/);
  assert.match(render(CardTimeMachine, { images: [] }), /alt="Sunset Beach"/);

  const book = render(DitherBook, { pages: [artwork] });
  assert.match(book, /background-image:url\(\/ink\.webp\)/);
  assert.match(book, /role="img" aria-label="Ink drawing of a reading room"/);
  assert.equal(book.match(/<button disabled=""/g)?.length, 2);
  assert.doesNotMatch(book, /i\.pinimg\.com/);
  assert.match(render(DitherBook, { pages: [] }), /SKETCH 01/);
});

test('catalog output keeps shared chunks private and rejects unknown modules', async () => {
  const chunkDir = join(root, 'dist/catalog-chunks');
  const chunks = files(chunkDir).filter((path) => path.endsWith('.js'));
  assert.ok(chunks.length > 0, 'shared catalog chunks were emitted');
  const chunkText = chunks.map((path) => readFileSync(path, 'utf8')).join('\n');
  assert.doesNotMatch(chunkText, /sourceMappingURL|\/Users\/|\/private\/tmp|motion\/react/);
  assert.match(chunkText, /rounded-2xl|bg-neutral|text-neutral/);
  const generatedStylesSource = readFileSync(join(root, '.generated/styles.css'), 'utf8');
  assert.doesNotMatch(generatedStylesSource, /install-catalog/);
  assert.match(generatedStylesSource, /tailwind-sources/);

  await assert.rejects(
    () => import('@mova-ui/react/catalog/components/unknown-module'),
    (error) => ['ERR_MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(error.code),
  );
});
