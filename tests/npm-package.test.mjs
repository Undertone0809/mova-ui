import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = resolve('.');
test('publishable package exposes real registry components, declarations and CSS', async () => {
  assert.ok(existsSync(`${pkg}/package.json`), 'standalone publishable package exists');
  const manifest = JSON.parse(readFileSync(`${pkg}/package.json`));
  assert.equal(manifest.name, '@mova-ui/react');
  assert.equal(manifest.private, false);
  assert.equal(Object.hasOwn(manifest, 'license'), false);
  assert.equal(manifest.repository.url, 'git+https://github.com/Undertone0809/mova-ui.git');
  const api = await import(`${pkg}/dist/index.js`);
  for (const name of ['GlowButton', 'FadeIn', 'ClassicSpinner', 'ClassicToggle', 'PageTransition', 'useWebHaptics']) assert.equal(typeof api[name], 'function', name);
  assert.ok(readFileSync(`${pkg}/dist/index.d.ts`, 'utf8').includes('glow-button'));
  const css = readFileSync(`${pkg}/dist/styles.css`, 'utf8');
  assert.ok(css.includes('.rounded-xl') && css.includes('.bg-neutral-900'));
  assert.ok(!css.includes('body{'), 'does not bundle site styles');
});
