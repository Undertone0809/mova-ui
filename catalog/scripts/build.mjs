import { build } from 'esbuild';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
rmSync('.build', { recursive: true, force: true });
mkdirSync('.build', { recursive: true });
await build({ entryPoints: manifest.components, outdir: '.build/components', outbase: 'components', bundle: true, packages: 'external', platform: 'browser', format: 'esm', jsx: 'automatic', sourcemap: false, logLevel: 'warning' });
execFileSync(process.execPath, ['node_modules/@tailwindcss/cli/dist/index.mjs', '-i', 'styles.css', '-o', '.build/styles.css', '--minify'], { stdio: 'inherit' });
console.log(`Built ${manifest.components.length} public catalog modules and standalone CSS (standalone verification only).`);
