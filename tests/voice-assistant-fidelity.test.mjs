import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoiceAssistantCard } from '../dist/index.js';

const render = props => renderToStaticMarkup(createElement(VoiceAssistantCard, props));

test('voice assistant starts on its chat and keeps the inactive conversation controls inert', () => {
  const html = render();
  assert.match(html, /aria-label="Aria voice assistant"/);
  assert.match(html, /aria-label="Your conversations" aria-hidden="true" inert=""/);
  assert.match(html, /aria-label="Chat with Aria" aria-hidden="false"/);
  assert.match(html, /aria-label="Start voice preview" aria-pressed="false"/);
  for (const text of ['Found 3 spots with good wifi', 'Weekend in Lisbon', 'Dinner for four', 'Morning run playlist', 'Type, or tap the lines to speak']) {
    assert.ok(html.includes(text), text);
  }
});

test('voice assistant respects a supplied name, conversation list, and an empty list', () => {
  const html = render({ name: '<Ari>', chats: [{ id: 'custom', title: 'A <trip>', preview: '<private>', time: 'Now' }], theme: 'dark' });
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /aria-label="Message &lt;Ari&gt;"/);
  assert.match(html, /A &lt;trip&gt;/);
  assert.match(html, /&lt;private&gt;/);
  assert.doesNotMatch(html, /Weekend in Lisbon|Morning run playlist/);
  const empty = render({ chats: [] });
  assert.match(empty, /New conversation/);
  assert.doesNotMatch(empty, /class="mvc-row"/);
});
