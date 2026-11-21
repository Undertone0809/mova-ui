import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';

function renderSource(name, props, exportName = 'default') {
  const importStatement = exportName === 'default'
    ? `import Component from './.generated/ui/ai/${name}.tsx';`
    : `import { ${exportName} as Component } from './.generated/ui/ai/${name}.tsx';`;
  const { outputFiles } = buildSync({
    stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; ${importStatement} export default renderToStaticMarkup(React.createElement(Component, ${JSON.stringify(props)}));`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports.default;
}

test('issue board exposes working toolbar and create entry points even when empty', () => {
  const html = renderSource('rudder-issue-board', { initialIssues: [] });
  assert.doesNotMatch(html, /Issue Tracker|Search issues|Create Issue/);
  assert.match(html, /Show working issues/);
  for (const name of ['List view', 'Board view', 'Filter issues by status', 'Sort issues', 'Display fields']) assert.ok(html.includes(`aria-label="${name}"`), name);
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 3);
  assert.doesNotMatch(html.match(/<section[^>]*>/)?.[0] ?? '', /overflow-hidden/);
  assert.equal((html.match(/kanban-hidden-column-/g) ?? []).length, 7);
  assert.equal((html.match(/aria-label="Create issue in /g) ?? []).length, 7);
});

test('open sources keeps both header favicons and expanded source links mounted', () => {
  const html = renderSource('ai-sources', { defaultOpen: true, sources: [{ id: 'one', title: 'One', url: 'https://example.com' }, { id: 'two', title: 'Two', url: 'https://example.org' }] });
  assert.equal((html.match(/lucide-globe/g) ?? []).length, 4);
  assert.equal((html.match(/target="_blank"/g) ?? []).length, 2);
  assert.match(html, /aria-expanded="true"/);
});

test('AI code block centers view controls and reflows its header within narrow component widths', () => {
  const source = readFileSync('source-registry/ui/ai/ai-code-block.tsx', 'utf8');
  const html = renderSource('ai-code-block', {
    filename: 'a-very-long-generated-component-source-file.tsx',
    labels: { copy: 'Copy this component source to the clipboard', copied: 'Component source copied' },
  }, 'AICodeBlock');
  assert.match(html, /class="mova-ai-code-header grid[^\"]*grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(html, /class="mova-ai-code-filename inline-flex min-w-0/);
  assert.match(html, /role="group" aria-label="Code view" class="mova-ai-code-view-controls[^\"]*justify-self-center/);
  assert.match(html, /class="mova-ai-code-actions col-start-3 flex min-w-0 flex-wrap/);
  assert.match(html, /mova-ai-code-copy-button flex min-h-6 min-w-0 max-w-full/);
  assert.match(html, /<span class="min-w-0 break-words">Copy this component source to the clipboard<\/span>/);
  assert.match(html, /a-very-long-generated-component-source-file\.tsx/);
  assert.match(html, /Copy this component source to the clipboard/);
  assert.match(source, /\.mova-ai-code-block\{container-type:inline-size\}/);
  assert.match(source, /@container \(max-width:360px\)/);
  assert.match(source, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(source, /grid-column:1\/-1;grid-row:2/);
});

test('AI code block keeps a fixed diff variant with counts and copy action on the right', () => {
  const html = renderSource('ai-code-block', { variant: 'Diff' }, 'AICodeBlock');
  assert.doesNotMatch(html, /aria-label="Code view"/);
  assert.match(html, /aria-label="Copy diff"/);
  assert.match(html, /aria-hidden="false" class="inline-flex shrink-0 items-center gap-2 font-mono text-\[12px\] leading-none tabular-nums visible"><span[^>]*>\+2<\/span><span[^>]*>-1<\/span>/);
});

test('task progress and rendered tasks agree at arbitrary nesting depth', () => {
  const html = renderSource('ai-task-list', { tasks: [{ id: 'one', label: 'First', status: 'done', children: [{ id: 'two', label: 'Second', status: 'done', children: [{ id: 'three', label: 'Third', status: 'running' }] }] }] });
  assert.match(html, /2\/3/);
  assert.match(html, /Third/);
  assert.match(html, /running/);
  assert.equal((html.match(/<li/g) ?? []).length, 3);
});
