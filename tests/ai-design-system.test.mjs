import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('registry/manifest.json', 'utf8'));
const components = new Map(manifest.components.map((entry) => [entry.id, entry]));
const aiIds = [
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
];

test('AI component theme CSS is allowlisted, hashed, and scoped', () => {
  assert.equal(manifest.sharedStyles.length, 1);
  const [{ path, sourceHash }] = manifest.sharedStyles;
  assert.equal(path, 'ui/ai/ai-design-tokens.css');
  const css = readFileSync(`source-registry/${path}`, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(sourceHash, createHash('sha256').update(css).digest('hex'));
  assert.match(css, /^\/\* Shared public tokens[\s\S]*?\.mova-ai-theme\s*\{/);
  assert.match(css, /\.mova-ai-theme\[data-theme="dark"\]\s*\{/);
  assert.doesNotMatch(css, /(^|[}\s])(?:html|body|:root)\s*[{,]/m);
  assert.match(css, /--mova-ai-success:/);
  assert.match(css, /--mova-ai-warning:/);
  assert.match(css, /--mova-ai-danger:/);
  assert.match(css, /--mova-ai-info:/);
  assert.ok(readFileSync('dist/styles.css', 'utf8').includes(css.trim()));
});

test('all ten AI source entries are portable with embedded light and dark tokens', () => {
  for (const id of aiIds) {
    const entry = components.get(id);
    assert.ok(entry, `missing manifest entry ${id}`);
    assert.match(entry.content, /\.mova-ai-theme\s*\{/);
    assert.ok(entry.content.includes('--mova-ai-page: #f7f7f7;'));
    assert.ok(entry.content.includes('--mova-ai-page: #181818;'));
    assert.doesNotMatch(entry.content, /__MOVA_AI_DESIGN_TOKENS__/);
  }

  for (const id of aiIds.slice(0, 4)) {
    const { content } = components.get(id);
    assert.match(content, /theme\?: "light" \| "dark"/);
    assert.match(content, /theme = "light"/);
  }

  assert.match(components.get('ai-context-meter').content, /left-1\/2[^\n]*-translate-x-1\/2/);
  assert.match(components.get('ai-context-meter').content, /transformOrigin: "bottom center"/);

  for (const id of ['ai-sidebar-nav', 'rudder-issue-board']) {
    assert.match(components.get(id).content, /theme = "dark"/);
  }
});
