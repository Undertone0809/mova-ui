import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Exercise canonical source without rebuilding unrelated catalog artifacts.
const path = resolve('source-registry/ui/patterns/animated-mega-menu.tsx');
const { code } = await transform(readFileSync(path, 'utf8'), {
  format: 'cjs', jsx: 'automatic', loader: 'tsx', platform: 'node', target: 'node20',
});
const module = { exports: {} };
vm.runInThisContext(`(function (exports, require, module) {${code}\n})`, { filename: path })(
  module.exports, createRequire(path), module,
);
const { AnimatedMegaMenu } = module.exports;
const items = [{ label: 'Components', links: [{ label: 'Buttons', href: '/buttons' }] }];
const render = (props = {}) => renderToStaticMarkup(React.createElement(AnimatedMegaMenu, { items, ...props }));
const headerStyle = html => html.match(/<header[^>]*style="([^"]*)"/)[1];

test('glass presentation has useful defaults in both themes', () => {
  const dark = headerStyle(render());
  assert.match(dark, /--mova-mega-surface:rgb\(8 8 8 \/ 0.7\)/);
  assert.match(dark, /--mova-mega-blur:24px/);
  assert.match(dark, /--mova-mega-saturation:1.4/);
  assert.match(dark, /--mova-mega-radius:8px/);
  assert.match(headerStyle(render({ theme: 'light' })), /--mova-mega-surface:rgb\(255 255 255 \/ 0.7\)/);
});

test('glass controls permit clear and opaque surfaces, custom borders, and square corners', () => {
  const clear = headerStyle(render({ blur: 0, opacity: 0, saturation: 0, borderRadius: 0, borderColor: 'transparent' }));
  assert.match(clear, /--mova-mega-surface:rgb\(8 8 8 \/ 0\)/);
  assert.match(clear, /--mova-mega-blur:0px/);
  assert.match(clear, /--mova-mega-saturation:0/);
  assert.match(clear, /--mova-mega-radius:0px/);
  assert.match(clear, /--mova-mega-border:transparent/);
  const opaque = headerStyle(render({ opacity: 1, blur: 40, saturation: 2, borderRadius: 20, borderColor: '#f00' }));
  assert.match(opaque, /--mova-mega-surface:rgb\(8 8 8 \/ 1\)/);
  assert.match(opaque, /--mova-mega-blur:40px/);
  assert.match(opaque, /--mova-mega-saturation:2/);
  assert.match(opaque, /--mova-mega-radius:20px/);
  assert.match(opaque, /--mova-mega-border:#f00/);
});

test('out of range presentation inputs clamp to valid CSS values', () => {
  const style = headerStyle(render({ blur: -5, opacity: -1, saturation: -2, borderRadius: -5 }));
  assert.match(style, /--mova-mega-blur:0px/);
  assert.match(style, /--mova-mega-surface:rgb\(8 8 8 \/ 0\)/);
  assert.match(style, /--mova-mega-saturation:0/);
  assert.match(style, /--mova-mega-radius:0px/);
  assert.match(headerStyle(render({ opacity: 2 })), /--mova-mega-surface:rgb\(8 8 8 \/ 1\)/);
});

test('server rendering preserves a single action, named navigation, and collapsed menu controls', () => {
  const html = render({
    brand: React.createElement('a', { href: '/' }, 'Mova'),
    actions: React.createElement('a', { href: '/browse' }, 'Browse components'),
    label: 'Product navigation',
  });
  assert.equal((html.match(/href="\/browse"/g) ?? []).length, 1);
  assert.match(html, /aria-label="Product navigation"/);
  assert.match(html, /aria-label="Open navigation" aria-expanded="false"/);
  assert.doesNotMatch(html, /aria-expanded="true"/);
});
