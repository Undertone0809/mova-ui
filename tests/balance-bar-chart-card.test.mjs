import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Exercise the canonical component independently of another worker's artifact rebuild.
const require = createRequire(import.meta.url);
const compiled = await build({
  entryPoints: [new URL('../source-registry/ui/cards/balance-bar-chart-card.tsx', import.meta.url).pathname],
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'shared-react', setup(build) {
    build.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, ({ path }) => ({
      path: pathToFileURL(require.resolve(path)).href,
      external: true,
    }));
  } }],
});
const { BalanceBarChartCard } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const render = props => renderToStaticMarkup(createElement(BalanceBarChartCard, props));
const markup = html => html.replace(/<style>[\s\S]*?<\/style>/g, '');

test('balance defaults match the reference data, separated cents, and 72px chart scale', () => {
  const html = markup(render());
  assert.match(html, /class="mbc-cents">\.<\/span><span class="mbc-cents">50/);
  assert.match(html, /\+8\.2%/);
  assert.match(html, /\$940\.20/);
  assert.equal((html.match(/class="mbc-column"/g) || []).length, 7);
  assert.deepEqual([...html.matchAll(/class="mbc-bar" style="height:(\d+)px/g)].map(match => Number(match[1])), [33, 49, 30, 72, 60, 41, 37]);
  assert.match(html, /aria-label="M: \$96\.00"/);
  assert.equal((html.match(/data-current="true"/g) || []).length, 1);
  assert.match(html, /role="tab" aria-selected="true" aria-controls="[^"]+" tabindex="0">Week/);
  assert.equal((html.match(/tabindex="-1"/g) || []).length, 2);
});

test('month and year keep the exact reference percentages, detail, labels, and values', () => {
  const month = markup(render({ defaultPeriod: 'month' }));
  assert.match(month, /\+12\.4%/); assert.match(month, /\$4,220\.60/);
  assert.deepEqual([...month.matchAll(/class="mbc-soft mbc-axis">([^<]*)</g)].map(match => match[1]), ['1', '5', '10', '15', '20', '25', '30']);
  assert.match(month, /aria-label="1: \$420\.00"/); assert.match(month, /aria-label="30: \$640\.00"/);
  assert.deepEqual([...month.matchAll(/class="mbc-bar" style="height:(\d+)px/g)].map(match => Number(match[1])), [34, 49, 31, 58, 45, 72, 52]);
  const year = markup(render({ defaultPeriod: 'year' }));
  assert.match(year, /\+18\.6%/); assert.match(year, /\$32,520\.00/);
  assert.match(year, /aria-label="Jun: \$3,120\.00"/); assert.match(year, /aria-label="Dec: \$6,140\.00"/);
  assert.deepEqual([...year.matchAll(/class="mbc-bar" style="height:(\d+)px/g)].map(match => Number(match[1])), [37, 49, 43, 59, 52, 69, 72]);
});

test('custom signed, empty, localized, and invalid-period input remains supported', () => {
  const periods = [{ id: 'week', label: 'Custom week', balance: -15, change: '-5%', detail: 'Down this week', points: [{ label: 'Returned', value: -20 }, { label: 'Added', value: 5 }] }];
  const html = markup(render({ periods, defaultPeriod: 'missing' }));
  assert.match(html, /data-negative="true"/); assert.match(html, /data-signed="true"/);
  assert.match(html, /top:50%;bottom:auto/); assert.match(html, /Returned: -\$20\.00/);
  assert.match(html, /class="mbc-soft mbc-axis">Returned/);
  assert.match(markup(render({ periods, currency: 'EUR', locale: 'de-DE' })), /20,00/);
  assert.match(markup(render({ periods: [] })), /No balance data/);
  assert.match(markup(render({ periods: [{ ...periods[0], points: [] }] })), /Custom week/);
});

test('motion retains reference timing, a moving tooltip, visible focus, and reduced-motion guards', () => {
  const html = render();
  assert.match(html, /--mbc-chart-dur:400ms/); assert.match(html, /--mbc-tabs-dur:250ms/);
  assert.match(html, /--mbc-text-dur:200ms/); assert.match(html, /--mbc-text-resize-dur:240ms/);
  assert.match(html, /opacity 150ms ease-out 80ms/); assert.match(html, /translate 160ms/);
  assert.match(html, /opacity 50ms ease-out/); assert.match(html, /button:focus-visible/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html, /role="tooltip" class="mbc-tooltip" data-show="false" aria-hidden="true"/);
  assert.doesNotMatch(html, /mbc-rise|ArrowUpRight|ArrowDownRight/);
});
