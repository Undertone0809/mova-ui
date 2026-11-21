import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IMessageChat, CalendarDayCard, BalanceBarChartCard, LiquidGlassSheet, DayTradingOrderTicket, VoiceAssistantCard } from '../dist/index.js';

const entries = [
  ['imessage-chat', IMessageChat, 'IMessageChat'],
  ['calendar-day-card', CalendarDayCard, 'CalendarDayCard'],
  ['balance-bar-chart-card', BalanceBarChartCard, 'BalanceBarChartCard'],
  ['liquid-glass-sheet', LiquidGlassSheet, 'LiquidGlassSheet'],
  ['day-trading-order-ticket', DayTradingOrderTicket, 'DayTradingOrderTicket'],
  ['voice-assistant-card', VoiceAssistantCard, 'VoiceAssistantCard'],
];
const manifest = JSON.parse(readFileSync('registry/manifest.json', 'utf8'));
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

test('all six cards ship complete portable, public React sources with named package exports', () => {
  for (const [id, component, exportName] of entries) {
    const entry = manifest.components.find(item => item.id === id);
    assert.ok(entry, id);
    assert.equal(entry.tier, 'free');
    assert.equal(Object.hasOwn(entry, 'license'), false);
    assert.equal(entry.previewMode, 'client');
    assert.ok(entry.exports.includes(exportName));
    assert.deepEqual(entry.dependencies, id === 'voice-assistant-card' ? ['lucide-react', 'voice-glow'] : ['imessage-chat', 'day-trading-order-ticket'].includes(id) ? ['lucide-react'] : []);
    assert.doesNotMatch(entry.content, /<iframe|dangerouslySetInnerHTML|https:\/\/esm\.sh|from ["']@\//);
    assert.match(entry.content, /prefers-reduced-motion/);
    for (const theme of ['light', 'dark']) {
      const html = render(component, { theme });
      assert.match(html, new RegExp(`data-theme="${theme}"`));
      assert.doesNotMatch(html, /NaN|undefined|<iframe/);
    }
  }
});

test('chat escapes application messages and permits supplied receipt state', () => {
  const html = render(IMessageChat, { name: 'Riley', initialMessages: [{ id: 'sent-1', text: '<script>alert(1)</script>', direction: 'incoming' }], deliveryStatus: 'Queued offline' });
  assert.match(html, /Conversation with Riley/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Queued offline/);
});

test('calendar and chart render meaningful empty states without invented data', () => {
  assert.match(render(CalendarDayCard, { days: [] }), /No days available/);
  assert.match(render(BalanceBarChartCard, { periods: [] }), /No balance data/);
});

test('chart represents negative amounts below a signed baseline and marks a decrease', () => {
  const html = render(BalanceBarChartCard, { periods: [{ id: 'loss', label: 'Loss', balance: -15, change: '-5%', detail: 'Down this week', points: [{ label: 'Returned', value: -20 }, { label: 'Added', value: 5 }] }] });
  assert.match(html, /data-negative="true"/);
  assert.match(html, /data-signed="true"/);
  assert.match(html, /top:50%;bottom:auto/);
  assert.match(html, /Returned: -\$20\.00/);
});

test('closed glass sheet does not leave hidden interactive actions in markup', () => {
  const html = render(LiquidGlassSheet, { defaultOpen: false });
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, />Share<|>Copy link<|>Save to favorites</);
});

test('order and voice demos cannot silently imply a real trade or microphone connection', () => {
  assert.match(render(DayTradingOrderTicket), /no real order/);
  assert.match(render(VoiceAssistantCard), /Start voice preview/);
  for (const id of ['day-trading-order-ticket', 'voice-assistant-card']) {
    const entry = manifest.components.find(item => item.id === id);
    assert.doesNotMatch(entry.content, /getUserMedia|fetch\(|XMLHttpRequest|SpeechRecognition|WebSocket/);
  }
});
