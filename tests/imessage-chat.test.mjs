import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IMessageChat } from '../dist/index.js';

const render = props => renderToStaticMarkup(createElement(IMessageChat, props));

test('chat starts with the reference portrait, audio action and complete read conversation', () => {
  const html = render();
  assert.match(html, /photo-1580489944761-15a19d654956/);
  assert.match(html, /aria-label="Audio call"/);
  assert.doesNotMatch(html, /Restart conversation/);
  const thread = html.slice(html.indexOf('class="mic-messages"'), html.indexOf('</form>'));
  const expected = ['Are we still on for Saturday?', 'Yes! Trail at 9?', "Perfect. I&#x27;ll bring coffee", 'The good kind this time', 'You&#x27;re the best', 'Read'];
  let position = -1;
  for (const text of expected) {
    const next = thread.indexOf(text);
    assert.ok(next > position, `${text} follows the preceding message`);
    position = next;
  }
  assert.doesNotMatch(thread, /class="[^"]*mic-new|class="[^"]*mic-typing/);
  assert.match(html, /aria-label="Send" aria-disabled="true"/);
});

test('chat retains caller content and receipt without interpreting message markup', () => {
  const html = render({ name: 'Riley', avatar: '', initialMessages: [{ id: 'one', text: '<img onerror="bad()">', direction: 'incoming' }], deliveryStatus: 'Queued offline' });
  assert.match(html, /Conversation with Riley/);
  assert.match(html, /&lt;img onerror=&quot;bad\(\)&quot;&gt;/);
  assert.match(html, /Queued offline/);
  assert.doesNotMatch(html, /<img[^>]*onerror|photo-1580489944761-15a19d654956/);
});

test('an empty conversation still has accessible message entry and a supplied receipt', () => {
  const html = render({ initialMessages: [], deliveryStatus: 'Ready' });
  assert.match(html, /role="log" aria-label="Messages" aria-live="polite"/);
  assert.match(html, /role="status"[^>]*><span[^>]*>Ready</);
  assert.match(html, /aria-label="Message"/);
  assert.doesNotMatch(html, /class="mic-bubble /);
});

test('optional video action preserves the source audio control and theme contract', () => {
  const html = render({ name: 'Riley', avatar: '/riley.png', theme: 'dark', onVideoCall() {} });
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /src="\/riley.png" alt="Riley"/);
  assert.match(html, /aria-label="Audio call"/);
  assert.match(html, /aria-label="Video call Riley"/);
});
