import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DayTradingOrderTicket } from '../dist/index.js';

const render = props => renderToStaticMarkup(createElement(DayTradingOrderTicket, props));
const form = html => html.slice(html.indexOf('<form'), html.indexOf('</form>'));

test('order ticket starts with source quote, horizontal fields, Limit and all four order choices', () => {
  const html = render();
  const initial = form(html);
  assert.match(initial, /NOVA/);
  assert.match(initial, /Novaline Robotics/);
  assert.match(initial, /\$184\.20/);
  assert.match(initial, /role="tab"[^>]*aria-selected="true"[^>]*>Buy</);
  assert.match(initial, /role="tab"[^>]*aria-selected="false"[^>]*>Sell</);
  assert.match(initial, /aria-haspopup="menu" aria-expanded="false"/);
  assert.equal((initial.match(/role="menuitemradio"/g) || []).length, 4);
  for (const label of ['Market', 'Limit', 'Stop market', 'Trailing stop']) assert.match(initial, new RegExp(`>${label}<`));
  assert.match(initial, /aria-checked="true"[^>]*><span>Limit</);
  assert.match(initial, /aria-label="One share less"/);
  assert.match(initial, /aria-label="One share more"/);
  assert.match(initial, /inputMode="numeric"[^>]*value="10"/);
  assert.match(initial, /inputMode="decimal"[^>]*value="184.20"/);
  assert.match(initial, /\$1,842\.00/);
});

test('hidden menu and confirmation are inert while the local preview is identified', () => {
  const html = render();
  assert.match(html, /Interactive preview · no real order/);
  assert.match(html, /role="menu"[^>]*aria-hidden="true" inert=""/);
  assert.match(html, /class="mot-t-page mot-page-done"[^>]*aria-hidden="true" inert=""/);
  assert.match(html, /class="mot-submit" aria-live="polite" aria-busy="false"/);
  assert.match(html, /Order preview ready/);
  assert.doesNotMatch(html, /Order placed|Bought|Sold/);
});

test('application props use escaped content and the supplied quote for the initial estimate', () => {
  const html = render({ symbol: '<TEST>', company: 'A & B', quote: 25.5, initialShares: 4, change: '-2%', theme: 'dark', onSubmit() {} });
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /&lt;TEST&gt;/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /data-negative="true"/);
  assert.match(html, /value="4"/);
  assert.match(html, /value="25.50"/);
  assert.match(html, /\$102\.00/);
  assert.match(html, /Order submitted/);
  assert.doesNotMatch(html, /no real order|<TEST>/);
});

test('initial share count is finite, whole and constrained to the supported range', () => {
  for (const [input, expected] of [[-3, 0], [2.9, 2], [12000, 9999], [NaN, 10]]) {
    const html = render({ initialShares: input });
    assert.match(form(html), new RegExp(`inputMode="numeric"[^>]*value="${expected}"`));
    assert.doesNotMatch(html, /NaN|undefined/);
  }
});
