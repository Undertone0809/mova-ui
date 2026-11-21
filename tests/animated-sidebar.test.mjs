import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const sourcePath = resolve('source-registry/ui/animated-sidebar.tsx');

async function loadComponent() {
  const source = readFileSync(sourcePath, 'utf8');
  const result = await transform(source, {
    format: 'cjs',
    jsx: 'automatic',
    loader: 'tsx',
    platform: 'node',
    target: 'node20',
  });
  const module = { exports: {} };
  const localRequire = createRequire(sourcePath);
  const wrapper = vm.runInThisContext(`(function (exports, require, module, __filename, __dirname) {${result.code}\n})`, {
    filename: sourcePath,
  });
  wrapper(module.exports, localRequire, module, sourcePath, dirname(sourcePath));
  return module.exports;
}

test('renders a dark sidebar with the default destination selected', async () => {
  const { AnimatedSidebar, default: defaultExport } = await loadComponent();
  assert.equal(defaultExport, AnimatedSidebar);

  const html = renderToStaticMarkup(React.createElement(AnimatedSidebar));
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /Mova Workbench/);
  assert.match(html, /Work queue/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-controls="mova-sidebar-section-[^"]+"/);
  assert.match(html, /prefers-reduced-motion/);
});

test('honors the initial destination and light theme in SSR output', async () => {
  const { AnimatedSidebar } = await loadComponent();
  const html = renderToStaticMarkup(React.createElement(AnimatedSidebar, {
    className: 'catalog-preview',
    initialActiveItem: 'events',
    theme: 'light',
  }));

  assert.match(html, /class="mova-sidebar catalog-preview"/);
  assert.match(html, /data-theme="light"/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  const activeButton = html.match(/<button[^>]+aria-current="page"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(activeButton, 'initial events destination is marked current');
  assert.match(activeButton[1], /class="mova-sidebar__item-label">Activity log<\/span>/);
});

test('keeps the collapse control wired to its destination region', async () => {
  const { AnimatedSidebar } = await loadComponent();
  const html = renderToStaticMarkup(React.createElement(AnimatedSidebar));
  const control = html.match(/<button[^>]+aria-controls="([^"]+)"[^>]+aria-expanded="true"[^>]*>/);
  const region = html.match(/<div[^>]+aria-hidden="false"[^>]+id="([^"]+)"/);

  assert.ok(control, 'collapse control has ARIA state');
  assert.ok(region, 'destination region has an id and ARIA state');
  assert.equal(control[1], region[1]);
});

test('source stays portable and does not contain restricted navigation patterns', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(source, /(?:Reloop|ReactEmail|email|inbox|svg.*connector)/i);
  assert.doesNotMatch(source, /(?:https?:\/\/|fetch\s*\()/i);
  assert.doesNotMatch(source, /from\s+["'](?:@\/|~\/|\.\.\/|(?:mova-site|site)\/)/i);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /aria-controls=/);
  assert.match(source, /aria-expanded=/);
});
