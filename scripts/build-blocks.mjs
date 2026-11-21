import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const components = [
  ['calendar', 'CalendarBlock'], ['canvas', 'CanvasBlock'],
  ['camera', 'CameraBlock'], ['wrapped', 'WrappedBlock'],
];
const assetPaths = [
  'ASSETS.txt',
  'moon-headphones.webp', 'record-stack.webp', 'singer-portrait.webp', 'street-corner.webp',
];
const sourceDependencies = [
  'react', 'lucide-react', '@fontsource-variable/dm-sans', '@fontsource/instrument-serif', '@fontsource/anton',
];
const hash = value => createHash('sha256').update(value).digest('hex');
async function walk(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry =>
    entry.isDirectory() ? walk(resolve(dir, entry.name)) : resolve(dir, entry.name)))).flat();
}

export async function buildBlocks(pkg, generated, assertPublicContent) {
  const input = resolve(pkg, 'blocks');
  const output = resolve(pkg, 'dist/blocks');
  const expected = ['index.ts', 'blocks-shared.css', ...components.flatMap(([id, name]) => [`${name}.tsx`, `${id}-block.css`]), ...assetPaths.map(path => `assets/${path}`)].sort();
  const actual = (await walk(input)).map(path => relative(input, path)).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Blocks source differs from explicit public allowlist');
  await mkdir(output, { recursive: true });
  await mkdir(resolve(generated, 'blocks'), { recursive: true });
  await cp(resolve(input, 'assets'), resolve(output, 'assets'), { recursive: true });
  const assets = await Promise.all(assetPaths.filter(path => path.endsWith('.webp')).map(async path => ({
    path: `assets/${path}`, packagePath: `@mova-ui/react/blocks/assets/${path}`,
    sha256: hash(await readFile(resolve(input, 'assets', path))),
  })));
  const assetManifest = {
    path: 'assets/ASSETS.txt', content: await readFile(resolve(input, 'assets/ASSETS.txt'), 'utf8'),
  };
  const records = [];
  for (const [id, exportName] of components) {
    const files = await Promise.all([`${exportName}.tsx`, `${id}-block.css`, 'blocks-shared.css'].map(async path => {
      const content = await readFile(resolve(input, path), 'utf8');
      assertPublicContent(`blocks/${path}`, content);
      if (/from ['"]@\//.test(content) || /['"]\/blocks\//.test(content)) throw new Error(`Nonportable Block import: ${path}`);
      return { path, content };
    }));
    await writeFile(resolve(generated, 'blocks', `${exportName}.tsx`), '"use client";\n' + files[0].content);
    records.push({ id, exportName, dependencies: sourceDependencies, files: [...files, assetManifest], assets });
  }
  await cp(resolve(input, 'index.ts'), resolve(generated, 'blocks/index.ts'));
  await build({ entryPoints: [resolve(input, 'index.ts')], outfile: resolve(output, 'index.js'), bundle: true,
    format: 'esm', jsx: 'automatic', platform: 'browser', target: 'es2020', packages: 'external', loader: { '.css': 'empty' },
    banner: { js: '"use client";' }, sourcemap: false, legalComments: 'none', logLevel: 'warning' });
  const css = await Promise.all(['blocks-shared.css', ...components.map(([id]) => `${id}-block.css`)].map(path => readFile(resolve(input, path), 'utf8')));
  await writeFile(resolve(output, 'styles.css'), css.join('\n'));
  await writeFile(resolve(output, 'sources.json'), JSON.stringify({ schemaVersion: 1, blocks: records }, null, 2) + '\n');
  return records.map(({ id, exportName, files, assets }) => ({ id, exportName, tier: 'free',
    sourceHash: hash(JSON.stringify(files)), assets }));
}
