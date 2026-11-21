import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test('every editable component has a generated offline entry', () => {
  const source = files('source-registry').filter(path => /\.(?:tsx?|json)$/.test(path));
  const bindings = Object.keys(JSON.parse(readFileSync('catalog/registry-bindings.json', 'utf8')));
  const expected = [...new Set([...source.map(path => path.split('/').at(-1).replace(/\.(?:tsx?|json)$/, '')), ...readdirSync('install-catalog').filter(p => p.endsWith('.json')).map(p => p.replace(/\.json$/, '')), ...bindings])].sort();
  const generated = readdirSync('registry')
    .filter(p => p.endsWith('.json') && p !== 'manifest.json')
    .map(path => path.replace(/\.json$/, ''))
    .sort();
  assert.deepEqual(generated, expected);
  for (const id of generated) {
    const entry = JSON.parse(readFileSync(`registry/${id}.json`, 'utf8'));
    assert.equal(entry.id, id);
    assert.match(entry.content, /^(?:\/\/ @ts-nocheck[^\n]*\n)?"use client";/);
    assert.ok(Array.isArray(entry.dependencies));
  }
});

test('standalone package keeps the release version and explicit publish boundary', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  assert.equal(pkg.version, '0.8.0');
  assert.equal(Object.hasOwn(pkg, 'license'), false);
  assert.equal(Object.hasOwn(lock.packages[''], 'license'), false);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.deepEqual(pkg.files, ['dist/**/*.js', 'dist/**/*.d.ts', 'dist/styles.css', 'bin/mova.mjs', 'registry/manifest.json', 'registry/*.json', 'README.md', 'dist/blocks/**']);
  assert.equal(pkg.scripts.build, 'node scripts/build.mjs');
  assert.ok(!pkg.workspaces);
  assert.ok(!pkg.dependencies.next);
  assert.doesNotMatch(readFileSync('scripts/build.mjs', 'utf8'), /\.\.\/\.\.|packages\/ui/);
});

test('manifest preserves explicit per-entry metadata without SDK license declarations', () => {
  const config = JSON.parse(readFileSync('public-registry.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('registry/manifest.json', 'utf8'));
  assert.equal(Object.keys(config.entryMetadata).length, manifest.components.length);
  assert.equal(new Set(manifest.components.map(entry => entry.id)).size, manifest.components.length);
  for (const entry of manifest.components) {
    assert.deepEqual(config.entryMetadata[entry.id], {
      tier: entry.tier,
      previewMode: entry.previewMode,
    });
  }
  for (const entry of [...manifest.components, ...manifest.catalogModules, ...manifest.blocks]) {
    assert.equal(Object.hasOwn(entry, 'license'), false, entry.id ?? entry.path);
    assert.equal(Object.hasOwn(entry, 'licenses'), false, entry.id ?? entry.path);
  }
});

test('public artifacts use one animation dependency boundary', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('registry/manifest.json', 'utf8'));
  assert.equal(pkg.dependencies['framer-motion'], '^12.23.24');
  assert.equal(pkg.dependencies.motion, undefined);
  for (const entry of manifest.components) {
    assert.doesNotMatch(entry.content, /from ['"]motion\/react['"]/, entry.id);
    assert.ok(!entry.dependencies.includes('motion'), entry.id);
  }
});
