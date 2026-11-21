#!/usr/bin/env node
import { readFileSync, writeFileSync, lstatSync, realpathSync, mkdirSync, renameSync, unlinkSync, constants, openSync, closeSync } from 'node:fs';
import { resolve, dirname, join, isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageManifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
const help = `Mova — Make interfaces feel alive.

Usage:
  npx @mova-ui/react list
  npx @mova-ui/react add <id> [--dir src/components/mova] [--overwrite] [--skip-install]
  npx @mova-ui/react --help

Run add from your project root (must contain package.json).
Copies bundled TypeScript source and compiled styles.css.
Installs missing dependencies using your project's npm, pnpm, yarn, or bun.
Import the copied styles.css once in your app. --skip-install copies source only.
--dir must be a relative directory inside this project; symlinks are refused.
--overwrite explicitly replaces existing regular files (never symlinks).
`;
function stat(path) { try { return lstatSync(path); } catch (e) { if(e.code === 'ENOENT') return null; throw e; } }
function safePath(root, path) {
  const rel = relative(root, path);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Target must be inside this project');
  let current = root;
  const parts = rel.split(sep);
  for (let i=0; i<parts.length; i++) {
    current = join(current, parts[i]); const s = stat(current);
    if (s?.isSymbolicLink()) throw new Error('Symlink targets are not allowed');
    if (s && i < parts.length-1 && !s.isDirectory()) throw new Error('Target parent is not a directory');
    if (s && i === parts.length-1 && !s.isFile()) throw new Error('Target is not a regular file');
  }
}
function publicEntries() {
  const manifest = JSON.parse(readFileSync(join(pkg, 'registry', 'manifest.json'), 'utf8'));
  if (manifest.package !== '@mova-ui/react' || manifest.components?.some(item => item.tier !== 'free')) {
    throw new Error('Invalid public registry manifest');
  }
  return new Map(manifest.components.map(item => [item.id, item]));
}
function main(args) {
  if (!args.length || (args.length === 1 && ['--help','-h'].includes(args[0]))) { console.log(help); return; }
  if (args[0] === 'list' && args.length === 1) {
    console.log([...publicEntries().keys()].sort().join('\n')); return;
  }
  if (args[0] !== 'add' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args[1] ?? '')) throw new Error('Use add <id>, list, or --help');
  const id = args[1]; let dir = 'src/components/mova'; let overwrite = false; let skipInstall = false;
  for (let i=2;i<args.length;i++) {
    if (args[i] === '--overwrite' && !overwrite) overwrite = true;
    else if (args[i] === '--skip-install' && !skipInstall) skipInstall = true;
    else if (args[i] === '--dir' && args[i+1] && !args[i+1].startsWith('--')) dir = args[++i];
    else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  if (!dir || isAbsolute(dir) || dir.includes('\\') || dir.includes(':') || dir.split('/').some(p => p === '..' || p.startsWith('.git') || p === 'node_modules')) throw new Error('Directory must be a relative path inside this project');
  const root = realpathSync(process.cwd());
  if (!stat(join(root, 'package.json'))?.isFile()) throw new Error('Run add from a project root containing package.json');
  const project = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const item = publicEntries().get(id);
  if (!item) throw new Error(`Unknown component: ${id}. Run npx @mova-ui/react list`);
  if (!/^[a-z0-9-]+\.tsx?$/.test(item.file) || typeof item.content !== 'string') throw new Error('Invalid bundled registry entry');
  const out = resolve(root, dir);
  const files = [
    { name: item.file, content: item.content },
    { name: 'styles.css', content: readFileSync(join(pkg, 'dist/styles.css'), 'utf8') }
  ].map(f => ({...f, path: join(out, f.name)}));
  // Preflight the entire operation before creating directories or replacing files.
  for (const f of files) {
    safePath(root, f.path);
    const exists = stat(f.path);
    f.skip = exists && f.name !== item.file && readFileSync(f.path, 'utf8') === f.content;
    if (exists && !f.skip && !overwrite) throw new Error(`${relative(root, f.path)} already exists; use --overwrite to replace it`);
  }
  const dependencies = item.dependencies.filter(name => !project.dependencies?.[name] && !project.devDependencies?.[name]);
  if (dependencies.some(name => !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name))) throw new Error('Invalid registry dependency');
  const dependencySpecs = dependencies.map(name => {
    const version = packageManifest.dependencies?.[name];
    return version ? `${name}@${version}` : name;
  });
  if (!skipInstall && dependencies.length) {
    const declared = project.packageManager?.split('@')[0];
    const manager = ['npm', 'pnpm', 'yarn', 'bun'].includes(declared) ? declared
      : stat(join(root, 'pnpm-lock.yaml')) ? 'pnpm'
      : stat(join(root, 'yarn.lock')) ? 'yarn'
      : stat(join(root, 'bun.lock')) || stat(join(root, 'bun.lockb')) ? 'bun' : 'npm';
    console.log(`Installing ${dependencySpecs.join(', ')} with ${manager}…`);
    try { execFileSync(manager, [manager === 'npm' ? 'install' : 'add', ...dependencySpecs], { cwd: root, stdio: 'inherit' }); }
    catch { throw new Error(`Dependency installation failed (${manager}). Component files were not written. Resolve the package-manager error and retry.`); }
  }
  for (const f of files.filter(f => !f.skip)) {
    mkdirSync(dirname(f.path), { recursive: true });
    safePath(root, f.path);
    if (!overwrite) {
      const fd = openSync(f.path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
      try { writeFileSync(fd, f.content); } finally { closeSync(fd); }
    } else {
      // Rename a new inode instead of following existing symlinks or hardlinks.
      const temp = join(out, `.mova-${randomUUID()}.tmp`);
      try { writeFileSync(temp, f.content, {flag:'wx',mode:0o644}); safePath(root, f.path); renameSync(temp, f.path); }
      finally { if(stat(temp)) unlinkSync(temp); }
    }
  }
  console.log(`Added ${id} to ${dir}\nImport '${dir}/styles.css' once in your app (adjust the relative import).`);
  if (skipInstall && dependencies.length) console.log(`Skipped dependencies: ${dependencies.join(' ')}`);
  console.log('Requires React 18.2+ or 19 and React DOM.');
}
try { main(process.argv.slice(2)); } catch (error) { console.error(`Mova: ${error.message}`); process.exitCode = 1; }
