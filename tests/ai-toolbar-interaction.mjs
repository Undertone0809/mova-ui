// Run with JSDOM_MODULE=/absolute/path/to/jsdom node tests/ai-toolbar-interaction.mjs.
// The DOM test dependency can live in an isolated temporary npm prefix.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
const require = createRequire(import.meta.url);
const { JSDOM } = require(process.env.JSDOM_MODULE || 'jsdom');
const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: 'http://localhost' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'FocusEvent']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
const React = require('react');
const { createRoot } = require('react-dom/client');
const result = buildSync({ entryPoints: ['source-registry/ui/ai/rudder-issue-board.tsx'], bundle: true, packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
const root = createRoot(document.getElementById('root'));
await React.act(() => root.render(React.createElement(module.exports.RudderIssueBoard, { initialIssues: [] })));
for (const [name, labelText, selector] of [['Filter issues by status', 'In progress', 'input[type="radio"]'], ['Sort issues', 'Title', 'input[type="radio"]'], ['Display fields', 'Identifier', 'input[type="checkbox"]']]) {
  const trigger = document.querySelector(`[aria-label="${name}"]`);
  await React.act(() => trigger.click());
  let panel = document.getElementById(trigger.getAttribute('aria-controls'));
  const label = [...panel.querySelectorAll('label')].find((item) => item.textContent.trim() === labelText);
  const input = label.querySelector(selector);
  const before = input.checked;
  // Native label pointer sequences can blur to body (null relatedTarget) before activation.
  await React.act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null })));
  assert.ok(label.isConnected, `${name}: null relatedTarget must not unmount the label before activation`);
  await React.act(() => label.click());
  assert.equal(input.checked, !before, `${name}: clicking label text must update the selected value`);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  await React.act(() => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, trigger, `${name}: Escape restores focus`);
}
// List view uses flat rows, preserves full titles, and retains creation without a page header.
await React.act(() => root.render(React.createElement(module.exports.RudderIssueBoard, { key: 'populated', initialIssues: [
  { id: 'TEST-1', title: 'A deliberately long issue title that must remain complete in the responsive list row', status: 'todo', priority: 'high', assignee: 'Sana', project: 'Project', labels: ['Feature'], created: 'Sep 23' },
] })));
await React.act(() => document.querySelector('[aria-label="List view"]').click());
await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); });
const row = document.querySelector('[data-testid="issue-row-TEST-1"]');
assert.ok(row, 'List view renders a dedicated flat row');
assert.match(row.querySelector('h3').textContent, /responsive list row$/);
assert.doesNotMatch(row.querySelector('h3').className, /truncate|line-clamp/);
assert.ok(row.querySelector('.rudder-list-meta'), 'Metadata has a separate responsive track');
const add = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Add issue');
await React.act(() => add.click());
assert.equal(document.activeElement.getAttribute('aria-label'), 'New issue title');
await React.act(() => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
assert.equal(document.activeElement, add, 'Cancel creation restores the list entry focus');
await React.act(() => root.unmount());
dom.window.close();
console.log('PASS: Filter, Sort, Display native labels and Escape; flat list full titles, metadata, and create focus restoration.');
