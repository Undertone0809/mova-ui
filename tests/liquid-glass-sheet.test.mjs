import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiquidGlassSheet } from '../dist/index.js';

const render = props => renderToStaticMarkup(createElement(LiquidGlassSheet, props));

test('glass sheet starts with the reference three actions and independently scoped glass filters', () => {
  const html = render();
  assert.match(html, /width:320px;max-width:100%;height:360px/);
  assert.match(html, /photo-1523712999610-f77fbcfc3843/);
  assert.match(html, /role="dialog" aria-labelledby=/);
  assert.match(html, />Share<|>Save</);
  assert.match(html, />liquid-glass-react-studio</);
  assert.doesNotMatch(html, />Play preview<|>Save to favorites<|aria-label="Close sheet"/);
  assert.match(html, /aria-label="Drag down to close"/);
  assert.match(html, /aria-pressed="false"/);
  const ids = [...html.matchAll(/<filter id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 2);
  for (const id of ids) assert.ok(html.includes(`url(#${id})`));
  const pair = renderToStaticMarkup(createElement(Fragment, null, createElement(LiquidGlassSheet), createElement(LiquidGlassSheet)));
  const pairIds = [...pair.matchAll(/<filter id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(pairIds).size, 4, 'multiple sheets must not share SVG filter IDs');
});

test('initially closed sheet exposes its trigger and makes the panel inert without rendering its actions', () => {
  const html = render({ defaultOpen: false });
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-hidden="true" inert=""/);
  assert.doesNotMatch(html, />Share<|>Save<|class="mgs-linkmain"/);
});

test('glass sheet escapes supplied labels and honors presentation overrides', () => {
  const html = render({ title: '<private>', subtitle: 'One & two', linkLabel: '<link>', backgroundImage: 'https://example.com/photo.png', theme: 'dark', style: { height: 400 } });
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /&lt;private&gt;/);
  assert.match(html, /One &amp; two/);
  assert.match(html, /&lt;link&gt;/);
  assert.match(html, /height:400px/);
  assert.match(html, /background-image:url\(&quot;https:\/\/example.com\/photo.png&quot;\)/);
  assert.doesNotMatch(html, /<private>|<link>/);
});
