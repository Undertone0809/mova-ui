import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarDayCard } from '../dist/index.js';

const render = props => renderToStaticMarkup(createElement(CalendarDayCard, props));
const markup = html => html.replace(/<style>[\s\S]*?<\/style>/g, '');

test('calendar defaults retain the five-day agenda, photos, and selected Thursday tab', () => {
  const html = markup(render());
  assert.equal((html.match(/role="tab"/g) || []).length, 5);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 5);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.match(html, /aria-label="Thursday, March 14" tabindex="0"/);
  assert.match(html, /11:30 – 12:30<\/span> · Room 2/);
  assert.match(html, /Attendees: Jade Wu, Leo Park, Tom Hale/);
  assert.equal((html.match(/ inert=""/g) || []).length, 4);
  assert.doesNotMatch(html, /Previous day|Next day|disabled=""/);
});

test('custom agendas select the first available day for an invalid initial id and keep event actions optional', () => {
  const days = [
    { id: 'a', weekday: 'Monday', day: 1, dateLabel: 'April 1', events: [{ id: 'e', title: '<Review>', time: '09:00', attendees: [{ name: 'Ada Lee' }] }] },
    { id: 'b', weekday: 'Tuesday', day: 2, dateLabel: 'April 2', events: [] },
  ];
  const passive = markup(render({ days, defaultSelectedDay: 'missing' }));
  assert.match(passive, /aria-label="Monday, April 1" tabindex="0"/);
  assert.match(passive, /&lt;Review&gt;/);
  assert.match(passive, /mcd-initials[^>]*>AL</);
  assert.doesNotMatch(passive, /<button[^>]*class="mcd-event-main"/);
  const interactive = markup(render({ days, onEventClick: () => {} }));
  assert.match(interactive, /<button[^>]*class="mcd-event-main"/);
  const empty = markup(render({ days: [] }));
  assert.match(empty, /No days available/);
  assert.match(empty, /Nothing scheduled/);
  assert.doesNotMatch(empty, /role="tab"|role="tabpanel"/);
});
