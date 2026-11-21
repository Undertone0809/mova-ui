import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const sources = JSON.parse(readFileSync('dist/blocks/sources.json', 'utf8'));
const manifest = JSON.parse(readFileSync('registry/manifest.json', 'utf8'));

test('all four Blocks import independently and retain their declared assets and source-copy contract', async () => {
  const blocks = await import('@mova-ui/react/blocks');
  assert.deepEqual(Object.keys(blocks).sort(), ['CalendarBlock', 'CameraBlock', 'CanvasBlock', 'WrappedBlock']);
  assert.deepEqual(sources.blocks.map(block => block.id), ['calendar', 'canvas', 'camera', 'wrapped']);
  const cssPath = import.meta.resolve('@mova-ui/react/blocks/styles.css');
  const css = readFileSync(new URL(cssPath), 'utf8');
  for (const [, path] of css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)) {
    assert.ok(existsSync(resolve(dirname(new URL(cssPath).pathname), path)), path);
  }
  for (const dependency of ['@fontsource-variable/dm-sans', '@fontsource/instrument-serif', '@fontsource/anton']) {
    assert.ok(css.includes(dependency));
    assert.ok(import.meta.resolve(dependency));
  }
  assert.doesNotMatch(css, /url\(['"]?\/blocks\//);
  for (const block of sources.blocks) {
    assert.equal(typeof blocks[block.exportName], 'function');
    assert.ok(block.files.some(file => file.path === `${block.exportName}.tsx`));
    assert.ok(block.files.some(file => file.path === 'blocks-shared.css'));
    assert.deepEqual(block.dependencies, ['react', 'lucide-react', '@fontsource-variable/dm-sans', '@fontsource/instrument-serif', '@fontsource/anton']);
    assert.ok(block.files.some(file => file.path === 'assets/ASSETS.txt'));
    assert.equal(block.files.some(file => /(?:license|OFL)/i.test(file.path)), false);
    assert.equal(block.assets.length, 4);
    for (const file of block.files) {
      assert.doesNotMatch(file.path, /^\/|\.\./);
      assert.doesNotMatch(file.content, /\/Users\/|\/private\/tmp\/|from ['"]@\/|sourceMappingURL/);
    }
    const metadata = manifest.blocks.find(entry => entry.id === block.id);
    assert.equal(metadata.sourceHash, sha256(JSON.stringify(block.files)));
    assert.equal(Object.hasOwn(metadata, 'license'), false);
    for (const asset of block.assets) {
      const bytes = readFileSync(new URL(import.meta.resolve(asset.packagePath)));
      assert.equal(sha256(bytes), asset.sha256);
      assert.doesNotMatch(asset.path, /^\/|\.\./);
    }
    const html = renderToStaticMarkup(React.createElement(blocks[block.exportName], { thumbnail: true }));
    assert.ok(html.length > 1000);
    assert.doesNotMatch(html, /src="\/blocks\//);
  }
});
