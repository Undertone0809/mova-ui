import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, symlinkSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const cli = resolve('bin/mova.mjs');
const run = (cwd, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
function project(t) { const dir = mkdtempSync(join(tmpdir(), 'mova-cli-')); t.after(() => rmSync(dir, {recursive:true,force:true})); writeFileSync(join(dir, 'package.json'), '{}'); return dir; }
test('automatically installs dependencies with each project package manager, and aborts on failure', t => {
  for (const manager of ['npm', 'pnpm', 'yarn', 'bun']) {
    const dir = project(t);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({packageManager: `${manager}@1.0.0`}));
    const bin = join(dir, 'bin'); mkdirSync(bin);
    const executable = join(bin, manager);
    writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' "$@" > manager-args\nexit 0\n`); chmodSync(executable, 0o755);
    const env = {...process.env, PATH: `${bin}:${process.env.PATH}`};
    let result = spawnSync(process.execPath, [cli, 'add', 'glow-button'], {cwd: dir, env, encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(dir, 'manager-args'), 'utf8'), `${manager === 'npm' ? 'install' : 'add'}\nframer-motion@^12.23.24\n`);
    writeFileSync(executable, '#!/bin/sh\nexit 1\n');
    result = spawnSync(process.execPath, [cli, 'add', 'gooey-popover'], {cwd: dir, env, encoding:'utf8'});
    assert.notEqual(result.status, 0); assert.match(result.stderr, /files were not written/);
    assert.equal(existsSync(join(dir, 'src/components/mova/gooey-popover.tsx')), false);
  }
});
test('rejects traversal, absolute paths, unknown flags, missing project and symlinks', t => {
  const dir = project(t);
  for (const args of [['add','../evil'], ['add','glow-button','--dir','../outside'], ['add','glow-button','--dir','/tmp/outside'], ['add','glow-button','--typo']]) assert.notEqual(run(dir, ...args).status, 0, args.join(' '));
  mkdirSync(join(dir, 'linked')); symlinkSync(join(dir, 'linked'), join(dir, 'link'));
  assert.notEqual(run(dir, 'add', 'glow-button', '--dir', 'link').status, 0);
  mkdirSync(join(dir, 'dest')); symlinkSync(join(dir, 'package.json'), join(dir, 'dest/glow-button.tsx'));
  assert.notEqual(run(dir, 'add', 'glow-button', '--dir', 'dest', '--overwrite').status, 0);
  assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), '{}');
  mkdirSync(join(dir, 'empty')); assert.notEqual(run(join(dir, 'empty'), 'add', 'glow-button').status, 0);
});
test('refuses clobber without overwrite and preflights every target', t => {
  const dir = project(t); const out = join(dir, 'src/components/mova'); mkdirSync(out, {recursive:true});
  writeFileSync(join(out, 'glow-button.tsx'), 'user code');
  assert.notEqual(run(dir, 'add', 'glow-button').status, 0);
  assert.equal(readFileSync(join(out, 'glow-button.tsx'), 'utf8'), 'user code');
  assert.ok(!existsSync(join(out, 'styles.css')));
  assert.equal(run(dir, 'add', 'glow-button', '--overwrite', '--skip-install').status, 0);
  assert.match(readFileSync(join(out, 'glow-button.tsx'), 'utf8'), /GlowButton/);
  assert.equal(run(dir, 'add', 'fade-in', '--skip-install').status, 0, 'unchanged shared CSS can be reused');
});
test('offline CLI help/list and real add include dependencies and usable CSS', t => {
  const dir = project(t);
  let r = run(dir, '--help'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /@mova-ui\/react add/);
  r = run(dir, 'list'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /glow-button/); assert.match(r.stdout, /classic-toggle/);
  r = run(dir, 'add', 'glow-button', '--skip-install'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /Skipped dependencies: framer-motion/); assert.match(r.stdout, /styles.css/);
  assert.match(readFileSync(join(dir, 'src/components/mova/glow-button.tsx'), 'utf8'), /export function GlowButton/);
  assert.match(readFileSync(join(dir, 'src/components/mova/styles.css'), 'utf8'), /rounded-xl/);
  assert.equal(existsSync(join(dir, 'src/components/mova/LICENSE.mova')), false);
  assert.equal(existsSync(join(dir, 'src/components/mova/LICENSE.third-party')), false);
  assert.doesNotMatch(r.stdout, /MIT|LICENSE/);
  r = run(dir, 'add', 'category-select', '--skip-install'); assert.equal(r.status, 0, r.stderr);
  const bindingSource = readFileSync(join(dir, 'src/components/mova/category-select.tsx'), 'utf8');
  assert.match(bindingSource, /^\/\/ @ts-nocheck[^\n]*\n"use client";/);
  assert.match(bindingSource, /MovaComponentAdapter|export\s*\{[^}]*default/);
  assert.doesNotMatch(bindingSource, /motion\/react|mova-sidebar-child-hover|mova-sidebar-parent-hover|mova-sidebar-active-indicator|ReactEmailIcon|React Email supported|reloop-labs\/reloop/i);
});
