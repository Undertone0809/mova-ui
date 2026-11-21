import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import ts from 'typescript';
import { buildBlocks } from './build-blocks.mjs';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const registrySource = resolve(pkg, 'source-registry');
const catalogSource = resolve(pkg, 'catalog');
const source = resolve(pkg, '.generated');
const publicConfig = JSON.parse(await readFile(resolve(pkg, 'public-registry.json'), 'utf8'));
const catalogManifest = JSON.parse(await readFile(resolve(catalogSource, 'manifest.json'), 'utf8'));
const registryBindings = JSON.parse(await readFile(resolve(catalogSource, 'registry-bindings.json'), 'utf8'));
const sharedStylePaths = publicConfig.sharedStyles ?? [];
if (!Array.isArray(sharedStylePaths) || sharedStylePaths.some((path) => typeof path !== 'string' || !/^ui\/[\w./-]+\.css$/.test(path) || path.includes('..'))) {
  throw new Error('Shared styles must use explicit, safe UI CSS paths');
}
if (new Set(sharedStylePaths).size !== sharedStylePaths.length) throw new Error('Duplicate shared style path in public allowlist');
const sharedStyles = await Promise.all(sharedStylePaths.map(async (path) => ({
  path,
  content: (await readFile(resolve(registrySource, path), 'utf8')).replace(/\r\n/g, '\n'),
})));
const sharedStyleSources = sharedStyles.map(({ path, content }) => ({
  path,
  sourceHash: createHash('sha256').update(content).digest('hex'),
}));
const AI_DESIGN_SYSTEM_COMPONENTS = new Set([
  'ai-context-meter',
  'ai-sources',
  'ai-tool-call',
  'ai-task-list',
  'ai-approval-card',
  'ai-prompt-bar',
  'ai-sidebar-nav',
  'ai-code-block',
  'ai-fine-tune-card',
  'rudder-issue-board',
]);
const aiDesignTokens = sharedStyles.find(({ path }) => path === 'ui/ai/ai-design-tokens.css')?.content;
if (AI_DESIGN_SYSTEM_COMPONENTS.size && !aiDesignTokens) {
  throw new Error('AI component design tokens must be included in the shared style allowlist');
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => (
    entry.isDirectory() ? walk(resolve(dir, entry.name)) : resolve(dir, entry.name)
  )))).flat().sort();
}

function componentId(path) {
  return basename(path).replace(/\.tsx?$/, '').replace(/\.json$/, '');
}

function packageName(name) {
  return name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
}

function moduleSource(content, fileName = 'catalog-module.tsx') {
  return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function moduleSpecifiers(content, fileName = 'catalog-module.tsx') {
  const file = moduleSource(content, fileName);
  return file.statements.flatMap((statement) => {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
      && statement.moduleSpecifier
      && ts.isStringLiteral(statement.moduleSpecifier)) {
      return [statement.moduleSpecifier.text];
    }
    return [];
  });
}

function dependencyNames(content) {
  return [...new Set(moduleSpecifiers(content)
    .filter((name) => !name.startsWith('.') && !name.startsWith('/') && !['react', 'react-dom'].includes(packageName(name)))
    .map(packageName)
    .map(normalizeDependencyName))].sort();
}

// Keep the public artifact on the established Framer Motion dependency boundary.
// Some catalog sources use the newer `motion/react` entrypoint, which is API-compatible
// but would make consumers install two overlapping declaration trees.
function normalizeMotionImport(content) {
  return content.replace(/(['"])motion\/react\1/g, '$1framer-motion$1');
}

function normalizeDependencyName(name) {
  return name === 'motion' ? 'framer-motion' : name;
}

function exportedNames(content) {
  return [...new Set([
    ...[...content.matchAll(/export\s+(?:const|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/g)].map((match) => match[1]),
    ...[...content.matchAll(/export\s*\{([^}]+)\}/g)].flatMap((match) => (
      match[1].split(',').map((value) => value.trim().split(/\s+as\s+/).at(-1))
    )),
  ].filter(Boolean))].sort();
}

const defaultAliases = {
  'ai-context-meter': 'AIContextMeter',
  'ai-sources': 'AISources',
  'ai-suggestions': 'AISuggestions',
  'ai-task-list': 'AITaskList',
  'ai-tool-call': 'AIToolCall',
  'animated-tags': 'AnimatedTags',
  'gooey-popover': 'GooeyPopover',
  'rudder-issue-board': 'RudderIssueBoard',
};

function registryExports(id, content) {
  const names = exportedNames(content);
  const alias = defaultAliases[id];
  if (alias && !names.includes(alias)) names.push(alias);
  return names.sort();
}

function catalogExports(content) {
  const file = moduleSource(content);
  const names = new Set();
  const isExported = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  const isDefault = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);

  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) names.add(element.name.text);
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      names.add('default');
      if (ts.isIdentifier(statement.expression)) names.add(statement.expression.text);
      continue;
    }
    if (!isExported(statement)) continue;
    if (isDefault(statement)) names.add('default');
    if (statement.name) names.add(statement.name.text);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    }
  }
  return [...names].sort();
}

function catalogValueExports(content) {
  const file = moduleSource(content);
  const names = new Set();
  const isExported = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  const isDefault = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);

  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (!element.isTypeOnly) names.add(element.name.text);
        }
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      names.add('default');
      continue;
    }
    if (!isExported(statement)) continue;
    if (isDefault(statement)) names.add('default');
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
    if (statement.name) names.add(statement.name.text);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    }
  }
  return [...names].sort();
}

function catalogModulePath(sourcePath) {
  return sourcePath.replace(/\.tsx?$/, '');
}

function assertPublicArtifactContent(sourcePath, content) {
  if (/(?:\/Users\/|\/private\/tmp\/|(?:^|[^A-Za-z])sk-[A-Za-z0-9]{20,})/.test(content)) {
    throw new Error(`Private content is not allowed in catalog module: ${sourcePath}`);
  }
  if (/mova-sidebar-child-hover|mova-sidebar-parent-hover|mova-sidebar-active-indicator|ReactEmailIcon|React Email supported|reloop-labs\/reloop/i.test(content)) {
    throw new Error(`Historical Sidebar content is not allowed in public artifact: ${sourcePath}`);
  }
}

function bindingAdapterSource(binding) {
  return [
    '"use client";',
    `import { ${binding.exportName} as MovaComponent } from ${JSON.stringify(`./${binding.sourcePath}`)};`,
    `const PRESET_PROPS = ${JSON.stringify(binding.props)};`,
    'export default function MovaComponentAdapter(props = {}) {',
    '  return <MovaComponent {...PRESET_PROPS} {...props} />;',
    '}',
    '',
  ].join('\n');
}

async function buildBindingContent(id, binding) {
  const result = await build({
    stdin: {
      contents: bindingAdapterSource(binding),
      loader: 'tsx',
      resolveDir: catalogSource,
      sourcefile: `registry-bindings/${id}.tsx`,
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    packages: 'external',
    jsx: 'automatic',
    sourcemap: false,
    legalComments: 'none',
    write: false,
    logLevel: 'warning',
  });
  const output = result.outputFiles?.[0]?.text;
  if (!output) throw new Error(`Binding adapter produced no output: ${id}`);
  return `// @ts-nocheck -- Generated JavaScript bundle; edit the maintained catalog source to retain TypeScript types.\n"use client";\n${normalizeMotionImport(output.replace(/\r\n/g, '\n'))}`;
}

function generatedSupportedRegistrySource(ids) {
  const entries = ids.map((id) => `  ${JSON.stringify(id)},`).join('\n');
  return `// Generated from registry/manifest.json component IDs during the root package build.
// The checked-in catalog copy is a standalone fallback; the package artifact is authoritative.
export const supportedRegistryIds: readonly string[] = [
${entries}
];
`;
}

function metadataFor(id) {
  const metadata = publicConfig.entryMetadata?.[id];
  if (!metadata || typeof metadata !== 'object') {
    throw new Error(`Missing explicit public metadata for component: ${id}`);
  }
  if (metadata.tier !== 'free') throw new Error(`Public component must be free tier: ${id}`);
  if (!['client', 'server'].includes(metadata.previewMode)) {
    throw new Error(`Public component has an invalid preview mode: ${id}`);
  }
  return metadata;
}

function publicEntry({ id, file, sourcePath, content, dependencies, exports, usage, css, metadata }) {
  if (typeof content !== 'string') throw new Error(`Missing source content for public component: ${id}`);
  const entryMetadata = metadata ?? metadataFor(id);
  return {
    id,
    tier: entryMetadata.tier,
    version: packageJson.version,
    file,
    ...(sourcePath ? { sourcePath } : {}),
    registryFile: `${id}.json`,
    exports: exports ?? registryExports(id, content),
    dependencies: [...new Set((dependencies ?? dependencyNames(content)).map(normalizeDependencyName))].sort(),
    previewMode: entryMetadata.previewMode,
    ...(usage !== undefined ? { usage } : {}),
    ...(css !== undefined ? { css } : {}),
    content,
  };
}

const sourceAllowlist = new Set(publicConfig.sourceRegistry);
const catalogAllowlist = new Set(publicConfig.catalogEntries);
if (sourceAllowlist.size !== publicConfig.sourceRegistry.length) throw new Error('Duplicate source-registry path in public allowlist');
if (catalogAllowlist.size !== publicConfig.catalogEntries.length) throw new Error('Duplicate catalog entry in public allowlist');

const catalogModulePaths = [...(catalogManifest.components ?? []), ...(catalogManifest.supportFiles ?? [])];
const catalogModuleAllowlist = new Set(catalogModulePaths);
if (catalogManifest.status !== 'public-modules') throw new Error('Catalog manifest must declare public-modules status');
if (catalogModuleAllowlist.size !== catalogModulePaths.length) throw new Error('Duplicate catalog module path in catalog manifest');
if (catalogModulePaths.some((path) => typeof path !== 'string' || !/^\w[\w./-]*\.tsx?$/.test(path) || path.includes('..'))) {
  throw new Error('Catalog manifest contains an unsafe module path');
}

const catalogFiles = (await walk(catalogSource))
  .map((path) => relative(catalogSource, path))
  .filter((path) => /^(?:components|hooks|data|utils)\/.*\.tsx?$/.test(path));
if (catalogFiles.length !== catalogModulePaths.length || catalogFiles.some((path) => !catalogModuleAllowlist.has(path))) {
  throw new Error('Catalog manifest does not exactly cover the catalog source modules');
}

const catalogComponentAllowlist = new Set(catalogManifest.components ?? []);
if (!registryBindings || typeof registryBindings !== 'object' || Array.isArray(registryBindings)) {
  throw new Error('Catalog registry bindings must be an object');
}
const bindingEntries = Object.entries(registryBindings);
const bindingIds = new Set(bindingEntries.map(([id]) => id));
if (bindingIds.size !== bindingEntries.length) throw new Error('Duplicate catalog registry binding ID');
for (const [id, binding] of bindingEntries) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Catalog registry binding has an unsafe ID: ${id}`);
  }
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    throw new Error(`Catalog registry binding must be an object: ${id}`);
  }
  if (typeof binding.sourcePath !== 'string' || !catalogComponentAllowlist.has(binding.sourcePath)) {
    throw new Error(`Catalog registry binding points outside component allowlist: ${id}`);
  }
  if (typeof binding.exportName !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(binding.exportName)) {
    throw new Error(`Catalog registry binding has an unsafe export name: ${id}`);
  }
  if (!binding.props || typeof binding.props !== 'object' || Array.isArray(binding.props)) {
    throw new Error(`Catalog registry binding props must be an object: ${id}`);
  }
  if (Object.keys(binding.props).some((key) => ['__proto__', 'constructor', 'prototype'].includes(key))) {
    throw new Error(`Catalog registry binding props contain an unsafe key: ${id}`);
  }

  const canonicalContent = await readFile(resolve(catalogSource, binding.sourcePath), 'utf8');
  if (!catalogValueExports(canonicalContent).includes(binding.exportName)) {
    throw new Error(`Catalog registry binding export is not a value export: ${id} -> ${binding.exportName}`);
  }
}

for (const dir of ['dist', '.generated', 'registry']) {
  await rm(resolve(pkg, dir), { recursive: true, force: true });
  await mkdir(resolve(pkg, dir), { recursive: true });
}

const editableFiles = (await walk(registrySource)).map((path) => relative(registrySource, path));
for (const allowlistedPath of sourceAllowlist) {
  if (!editableFiles.includes(allowlistedPath)) {
    throw new Error(`Public source allowlist points to a missing file: ${allowlistedPath}`);
  }
}

const entries = [];
for (const allowlistedPath of publicConfig.sourceRegistry) {
  const sourcePath = resolve(registrySource, allowlistedPath);
  if (allowlistedPath.endsWith('.json')) {
    const item = JSON.parse(await readFile(sourcePath, 'utf8'));
    const sourceFile = item.files?.[0];
    if (!sourceFile?.path || typeof sourceFile.content !== 'string') {
      throw new Error(`Invalid source registry JSON: ${allowlistedPath}`);
    }
    entries.push({ path: sourceFile.path, source: sourcePath, content: sourceFile.content });
  } else {
    entries.push({ path: allowlistedPath, source: sourcePath });
  }
}

const index = [];
const ids = new Set();
const manifestEntries = [];

for (const entry of entries) {
  const id = componentId(entry.path);
  if (ids.has(id)) throw new Error(`Duplicate component ID: ${id}`);
  ids.add(id);

  let content = '"use client";\n' + normalizeMotionImport((entry.content ?? await readFile(entry.source, 'utf8')).replace(/\r\n/g, '\n'));
  if (AI_DESIGN_SYSTEM_COMPONENTS.has(id)) {
    const marker = JSON.stringify('__MOVA_AI_DESIGN_TOKENS__');
    if (!content.includes(marker)) throw new Error(`AI component is missing its embedded design token marker: ${id}`);
    content = content.replaceAll(marker, JSON.stringify(aiDesignTokens));
  }
  assertPublicArtifactContent(entry.path, content);
  if (entry.path.startsWith('ui/text/')) {
    content = content
      .replace('import { motion }', 'import { motion, type Variants }')
      .replace(/const (\w+Variants) =/g, 'const $1: Variants =');
  }
  if (id === 'progress-indicator') content = content.replace('      style={{ scaleX }}\n', '');
  if (id === 'text-shimmer') content = content.replaceAll('WebkitMask', 'mask');

  const target = resolve(source, entry.path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);

  const generatedPath = entry.path.replace(/\.tsx?$/, '.js');
  index.push(`export * from './${generatedPath}';`);
  if (defaultAliases[id]) index.push(`export { default as ${defaultAliases[id]} } from './${generatedPath}';`);

  const imports = moduleSpecifiers(content, entry.path);
  if (imports.some((name) => name.startsWith('.'))) throw new Error(`Unmapped internal import in ${id}`);

  const item = publicEntry({
    id,
    file: basename(entry.path),
    sourcePath: entry.path,
    content,
    metadata: metadataFor(id),
  });
  manifestEntries.push(item);
  await writeFile(resolve(pkg, 'registry', `${id}.json`), JSON.stringify(item, null, 2) + '\n');
}

const catalogDir = resolve(pkg, 'install-catalog');
const installCatalogFiles = new Set(await readdir(catalogDir));
const catalogCss = new Set();
const catalogTailwindSources = [];

for (const file of publicConfig.catalogEntries) {
  if (!installCatalogFiles.has(file)) throw new Error(`Public catalog allowlist points to a missing file: ${file}`);
  const item = JSON.parse(await readFile(resolve(catalogDir, file), 'utf8'));
  if (item.css !== undefined) catalogCss.add(item.css);
  if (ids.has(item.id)) {
    throw new Error(`Duplicate public component ID in source-registry/catalog allowlists: ${item.id}`);
  }
 const metadata = metadataFor(item.id);
  for (const field of ['tier', 'previewMode']) {
    if (item[field] !== undefined && item[field] !== null && item[field] !== metadata[field]) {
      throw new Error(`Catalog metadata disagrees with public metadata for ${item.id}: ${field}`);
    }
  }

  const normalized = publicEntry({
    id: item.id,
    file: item.file,
    content: normalizeMotionImport(item.content),
    dependencies: item.dependencies,
    exports: item.exports,
    usage: item.usage,
    css: item.css,
    metadata,
  });
  assertPublicArtifactContent(file, normalized.content);
  catalogTailwindSources.push({ file, content: normalized.content });
  ids.add(item.id);
  manifestEntries.push(normalized);
  await writeFile(resolve(pkg, 'registry', file), JSON.stringify(normalized, null, 2) + '\n');
}

const declaredDependencies = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
]);
for (const [id, binding] of bindingEntries) {
  if (ids.has(id)) throw new Error(`Duplicate public component ID in source-registry/catalog/bindings allowlists: ${id}`);

  const content = await buildBindingContent(id, binding);
  assertPublicArtifactContent(`registry-bindings/${id}`, content);
  const dependencies = dependencyNames(content);
  for (const dependency of dependencies) {
    if (!declaredDependencies.has(dependency)) {
      throw new Error(`Catalog registry binding has an undeclared dependency: ${id} -> ${dependency}`);
    }
  }
  if (dependencies.includes('@mova-ui/react') || dependencies.some((dependency) => dependency.startsWith('@/'))) {
    throw new Error(`Catalog registry binding has a private/self dependency: ${id}`);
  }

  const metadata = metadataFor(id);
  const normalized = publicEntry({
    id,
    file: `${id}.tsx`,
    sourcePath: binding.sourcePath,
    content,
    dependencies,
    exports: ['default'],
    metadata,
  });
  ids.add(id);
  manifestEntries.push(normalized);
  await writeFile(resolve(pkg, 'registry', `${id}.json`), JSON.stringify(normalized, null, 2) + '\n');
}

const publicComponentIds = manifestEntries.map((entry) => entry.id).sort();
const catalogModules = [];
for (const sourcePath of catalogModulePaths) {
  const filePath = resolve(catalogSource, sourcePath);
  const rawContent = sourcePath === 'data/supportedRegistryIds.ts'
    ? generatedSupportedRegistrySource(publicComponentIds)
    : await readFile(filePath, 'utf8');
  const content = '"use client";\n' + normalizeMotionImport(rawContent.replace(/\r\n/g, '\n'));
  assertPublicArtifactContent(sourcePath, content);

  const imports = moduleSpecifiers(content, sourcePath);
  for (const name of imports) {
    if (!name.startsWith('.')) continue;
    const base = resolve(catalogSource, dirname(sourcePath), name);
    const relativeBase = relative(catalogSource, base);
    const candidates = [
      relativeBase,
      `${relativeBase}.ts`,
      `${relativeBase}.tsx`,
      `${relativeBase}/index.ts`,
      `${relativeBase}/index.tsx`,
    ];
    if (!candidates.some((candidate) => catalogModuleAllowlist.has(candidate))) {
      throw new Error(`Catalog module import is outside the reviewed allowlist: ${sourcePath} -> ${name}`);
    }
  }

  const sourceHash = createHash('sha256').update(content).digest('hex');
  catalogModules.push({
    path: catalogModulePath(sourcePath),
    file: basename(sourcePath),
    sourcePath,
    tier: 'free',
    version: packageJson.version,
    exports: catalogExports(content),
    dependencies: dependencyNames(content),
    previewMode: 'client',
    sourceHash,
    content,
  });

  const target = resolve(source, 'catalog', sourcePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const unknownMetadata = Object.keys(publicConfig.entryMetadata ?? {}).filter((id) => !ids.has(id));
if (unknownMetadata.length) throw new Error(`Public metadata has unknown component IDs: ${unknownMetadata.join(', ')}`);

const blocks = await buildBlocks(pkg, source, assertPublicArtifactContent);
await writeFile(resolve(source, 'index.ts'), '"use client";\n' + index.sort().join('\n') + '\n');
await writeFile(resolve(source, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    jsx: 'react-jsx',
    declaration: true,
    emitDeclarationOnly: true,
    outDir: '../dist',
    rootDir: '.',
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  },
  include: ['**/*.ts', '**/*.tsx'],
}));

execFileSync(process.execPath, [resolve(pkg, 'node_modules/typescript/bin/tsc'), '-p', resolve(source, 'tsconfig.json')], { stdio: 'inherit' });
await build({
  entryPoints: [resolve(source, 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  packages: 'external',
  outfile: resolve(pkg, 'dist/index.js'),
  banner: { js: '"use client";' },
  legalComments: 'none',
  logLevel: 'warning',
});

await build({
  entryPoints: catalogModules.map((module) => resolve(source, 'catalog', module.sourcePath)),
  outdir: resolve(pkg, 'dist/catalog'),
  outbase: resolve(source, 'catalog'),
  bundle: true,
  splitting: true,
  chunkNames: '../catalog-chunks/[name]-[hash]',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  packages: 'external',
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
});

// Tailwind utilities and tokens only: deliberately no global preflight or site CSS.
const tailwindSourceDir = resolve(source, 'tailwind-sources');
await mkdir(tailwindSourceDir, { recursive: true });
for (const { file, content } of catalogTailwindSources) {
  await writeFile(resolve(tailwindSourceDir, file.replace(/\.json$/, '.html')), content);
}
await writeFile(resolve(source, 'styles.css'), '@layer theme, utilities;\n@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css" layer(utilities) source(none);\n@source "./";\n@source "./tailwind-sources";\n');
execFileSync(process.execPath, [resolve(pkg, 'node_modules/@tailwindcss/cli/dist/index.mjs'), '-i', resolve(source, 'styles.css'), '-o', resolve(pkg, 'dist/styles.css'), '--minify'], { cwd: pkg, stdio: 'inherit' });
await writeFile(resolve(pkg, 'dist/styles.css'), (await readFile(resolve(pkg, 'dist/styles.css'), 'utf8')) + '\n' + [...catalogCss].join('\n'));
await writeFile(resolve(pkg, 'dist/styles.css'), (await readFile(resolve(pkg, 'dist/styles.css'), 'utf8')) + '\n' + sharedStyles.map(({ content }) => content).join('\n'));

const components = manifestEntries.sort((a, b) => a.id.localeCompare(b.id));
const manifestPayload = {
  schemaVersion: publicConfig.schemaVersion,
  package: packageJson.name,
  version: packageJson.version,
  components,
  sharedStyles: sharedStyleSources,
  blocks,
  catalogModules: catalogModules.sort((a, b) => a.path.localeCompare(b.path)),
};
const artifactHash = createHash('sha256').update(JSON.stringify(manifestPayload)).digest('hex');
await writeFile(resolve(pkg, 'registry/manifest.json'), JSON.stringify({ ...manifestPayload, artifactHash }, null, 2) + '\n');
console.log(`Built ${packageJson.name} ${packageJson.version}: ${components.length} public registry entries and ${catalogModules.length} catalog modules, manifest ${artifactHash.slice(0, 12)}.`);
