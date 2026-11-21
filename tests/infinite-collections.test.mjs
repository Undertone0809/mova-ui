import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InfiniteMenu, InfiniteCardGrid } from '../dist/index.js';
import ts from 'typescript';
import vm from 'node:vm';

const item = { image: '/image.webp', title: 'A <portrait>', description: 'Gallery details', link: '/gallery' };
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

test('both collections ship portable sources, named exports, declarations, and explicit free metadata', () => {
  const manifest = JSON.parse(readFileSync('registry/manifest.json', 'utf8'));
  for (const [id, name, dependencies] of [['infinite-menu', 'InfiniteMenu', []], ['infinite-card-grid', 'InfiniteCardGrid', ['framer-motion']]]) {
    const entry = manifest.components.find(entry => entry.id === id);
    assert.ok(entry);
    assert.equal(Object.hasOwn(entry, 'license'), false);
    assert.equal(entry.tier, 'free');
    assert.ok(entry.exports.includes(name));
    assert.deepEqual(entry.dependencies, dependencies);
    assert.doesNotMatch(entry.content, /from ["'](?:@\/|\.\.?\/)|<iframe|dangerouslySetInnerHTML/);
    assert.match(readFileSync(`dist/ui/patterns/${id}.d.ts`, 'utf8'), new RegExp(`function ${name}`));
  }
});

test('collections provide real empty states, escape labels, preserve theme and height', () => {
  assert.match(render(InfiniteMenu), /No items available/);
  assert.match(render(InfiniteCardGrid), /No cards available/);
  const menu = render(InfiniteMenu, { items: [item], count: 6, height: 500 });
  assert.equal((menu.match(/data-sphere-tile=/g) ?? []).length, 6);
  assert.match(menu, /A &lt;portrait&gt;/);
  assert.match(menu, /height:500px/);
  assert.match(menu, /Use arrow keys/);
  assert.match(menu, /mova-infinite-menu__scene\{position:absolute;inset:0;z-index:0\}/);
  assert.match(menu, /mova-infinite-menu__info\{position:absolute;inset:0;z-index:1;/);
  const grid = render(InfiniteCardGrid, { items: [item], theme: 'dark' });
  assert.match(grid, /data-theme="dark"/);
  assert.match(grid, /Open A &lt;portrait&gt;/);
  assert.match(grid, /Escape closes details/);
});

test('unsafe item links cannot become executable action links', () => {
  for (const link of ['javascript:alert(1)', 'data:text/html,hello', 'vbscript:alert(1)']) {
    const html = render(InfiniteMenu, { items: [{ ...item, link }] });
    assert.doesNotMatch(html, /<a[ >]/);
  }
});

// Run the actual effect engine against a tiny DOM/RAF adapter. This verifies the
// drag lifecycle and motion trajectory without a browser timing dependency.
function mountMenu({ reduced = false, intro = false, count = 40, width = 800, height = 500 } = {}) {
  const effects = [], cleanups = [], updates = [], frames = new Map(), timers = new Map();
  let clock = 0, nextFrame = 1, nextTimer = 1;
  const listeners = new Map();
  class Element {
    constructor(type, props, children) {
      this.type = type; this.props = props ?? {}; this.children = children.flat(Infinity).filter(child => child && typeof child === 'object');
      this.dataset = {}; this.style = { ...this.props.style, setProperty(name, value) { this[name] = value; } };
      this.clientWidth = width; this.clientHeight = height; this.captured = new Set();
      this.events = new Map();
      for (const [key, value] of Object.entries(this.props)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
      if (this.props.ref) this.props.ref.current = this;
    }
    addEventListener(type, callback) { this.events.set(type, callback); }
    removeEventListener(type) { this.events.delete(type); }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
    contains() { return false; }
    closest(selector) { return selector === '[data-sphere-tile]' && this.dataset.sphereTile !== undefined ? this : null; }
  }
  const react = {
    createElement: (type, props, ...children) => new Element(type, props, children),
    useEffect: callback => effects.push(callback),
    useId: () => 'test-help',
    useRef: value => ({ current: value }),
    useState: value => [value, next => updates.push(next)],
  };
  react.default = react;
  const media = { matches: reduced, addEventListener() {}, removeEventListener() {} };
  const context = {
    exports: {}, require: () => react,
    window: { matchMedia: () => media, setTimeout: (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, delay }); return id; } },
    requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id), clearTimeout: id => timers.delete(id),
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
  };
  const source = readFileSync('source-registry/ui/patterns/infinite-menu.tsx', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled, context);
  const active = [];
  const root = context.exports.InfiniteMenu({ items: Array.from({ length: 8 }, (_, index) => ({ image: `/photo-${index}.webp`, title: `Photo ${index}` })), count, autoplay: 3, intro, onActiveChange: (_, index) => active.push(index) });
  effects.forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
  const scene = root.children.find(child => child.props['aria-hidden'] === 'true');
  return {
    root, scene, timers, active, updates,
    step(milliseconds) { clock += milliseconds; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(clock)); },
    event(type, extra = {}) { root.events.get(type)?.({ type, target: root, isPrimary: true, button: 0, pointerId: 1, timeStamp: clock, clientX: 200, clientY: 200, preventDefault() {}, ...extra }); },
    dispose() { cleanups.forEach(cleanup => cleanup()); assert.equal(frames.size, 0); assert.equal(timers.size, 0); },
  };
}

test('menu settles, sleeps between autoplay steps, and pauses the timer while focused', () => {
  const menu = mountMenu();
  for (let frame = 0; frame < 360; frame++) menu.step(1000 / 60);
  assert.equal(menu.timers.size, 1);
  assert.equal([...menu.timers.values()][0].delay, 3000);
  menu.event('focusin');
  assert.equal(menu.timers.size, 0);
  menu.event('focusout', { relatedTarget: null });
  menu.step(1000 / 60);
  assert.equal(menu.timers.size, 1);
  assert.ok(menu.scene.children.some(tile => tile.style.visibility === 'hidden'));
  assert.ok(menu.scene.children.some(tile => tile.style.visibility === 'visible'));
  assert.ok(menu.scene.children.every(tile => !tile.style.filter));
  assert.ok(menu.scene.children.some(tile => tile.children[1].style.opacity !== undefined));
  menu.dispose();
});

test('menu keyboard selects a new item and reduced motion never schedules autoplay', () => {
  const menu = mountMenu({ reduced: true });
  menu.step(1000 / 60);
  menu.event('keydown', { key: 'End' });
  for (let frame = 0; frame < 3; frame++) menu.step(1000 / 60);
  assert.ok(menu.active.includes(7));
  assert.equal(menu.timers.size, 0);
  menu.dispose();
});

test('menu toss trajectory is stable across 60Hz and 144Hz animation clocks', () => {
  const trajectory = rate => {
    const menu = mountMenu();
    menu.step(16);
    menu.event('pointerdown');
    menu.step(16);
    menu.event('pointermove', { clientX: 300, timeStamp: 32 });
    menu.event('pointerup', { clientX: 300, timeStamp: 32 });
    for (let frame = 0; frame < rate / 4; frame++) menu.step(1000 / rate);
    const values = menu.scene.children.map(tile => ({ visible: tile.style.visibility === 'visible', transform: [...(tile.style.transform ?? '').matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)].map(match => Number(match[0])) }));
    menu.dispose();
    return values;
  };
  const a = trajectory(60), b = trajectory(144);
  let checked = 0;
  for (let tile = 0; tile < a.length; tile++) {
    if (!a[tile].visible || !b[tile].visible) continue;
    checked++;
    assert.equal(a[tile].transform.length, b[tile].transform.length);
    for (let index = 0; index < a[tile].transform.length; index++) assert.ok(Math.abs(a[tile].transform[index] - b[tile].transform[index]) < 1.5, `tile ${tile}, transform value ${index}: ${a[tile].transform[index]} vs ${b[tile].transform[index]}`);
  }
  assert.ok(checked > 10);
});

function mountGrid() {
  const effects = [], cleanups = [], globalEvents = new Map(), active = [];
  class Element {
    constructor(type, props, children) {
      props = props ?? {};
      this.type = type; this.props = props; this.children = children.flat(Infinity).filter(child => child && typeof child === 'object');
      this.dataset = {}; this.style = { ...props.style }; this.events = new Map(); this.clientWidth = 320; this.clientHeight = 240; this.captured = new Set();
      this.src = props.src; this.textContent = children.filter(child => typeof child === 'string').join('');
      if (props.ref) props.ref.current = this;
    }
    addEventListener(type, callback) { this.events.set(type, callback); }
    removeEventListener(type) { this.events.delete(type); }
    setAttribute(key, value) { this.props[key] = value; }
    getAttribute(key) { return key === 'src' ? this.src : this.props[key]; }
    matches() { return true; }
    querySelector(selector) { for (const child of this.children) { if (selector === 'img' && child.type === 'img' || selector.startsWith('.') && child.props.className === selector.slice(1)) return child; const nested = child.querySelector(selector); if (nested) return nested; } return null; }
    getBoundingClientRect() { const x = Number(this.dataset.x ?? 0), y = Number(this.dataset.y ?? 0); return { x, y, width: this.style.width ?? 320, height: this.style.height ?? 240 }; }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
  }
  const react = { createElement: (type, props, ...children) => new Element(type, props, children), useEffect: callback => effects.push(callback), useRef: value => ({ current: value }), useState: value => [value && typeof value === 'object' && value.width === 1000 ? { width: 320, height: 240 } : value, () => {}], useId: () => 'grid-test' };
  react.default = react;
  const context = {
    exports: {}, require: name => name === 'react' ? react : { motion: { div: 'div' }, AnimatePresence: 'fragment', useReducedMotion: () => false },
    window: { addEventListener: (type, callback) => globalEvents.set(type, callback), removeEventListener: type => globalEvents.delete(type) },
    document: { activeElement: null }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
  };
  const source = readFileSync('source-registry/ui/patterns/infinite-card-grid.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, context);
  const items = Array.from({ length: 40 }, (_, index) => ({ image: `/photo-${index}.webp`, title: `Photo ${index}` }));
  const root = context.exports.InfiniteCardGrid({ items, onItemClick: (_, index) => active.push(index) });
  effects.forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
  const plane = root.children.find(child => child.props.className === 'mova-infinite-grid__plane');
  return { root, plane, active, globalEvents, refresh: () => effects.at(-1)(), dispose: () => cleanups.forEach(cleanup => cleanup()) };
}

test('grid recycling makes all supplied items reachable beyond the viewport cell count', () => {
  const grid = mountGrid();
  assert.ok(grid.plane.children.length < 40);
  const seen = new Set();
  for (let step = 0; step < 50; step++) {
    grid.plane.children.forEach(card => seen.add(Number(card.dataset.itemIndex)));
    grid.root.props.onKeyDown({ target: grid.root, currentTarget: grid.root, key: 'ArrowRight', preventDefault() {} });
  }
  assert.equal(seen.size, 40);
  const card = grid.plane.children[0];
  const currentIndex = Number(card.dataset.itemIndex);
  card.props.onClick({ currentTarget: card, detail: 0 });
  assert.equal(grid.active.at(-1), currentIndex);
  grid.dispose();
});

test('narrow grid exposes keyboard cards and pans a partially visible card into view', () => {
  const grid = mountGrid();
  const card = grid.plane.children.find(card => card.tabIndex === 0 && Number(card.dataset.x) < 0);
  assert.ok(card, 'partially visible card is keyboard reachable at 320px');
  card.props.onFocus({ currentTarget: card });
  assert.ok(Number(card.dataset.x) >= 0);
  assert.ok(Number(card.dataset.x) + 260 <= 320);
  grid.dispose();
});

test('release outside the grid clears a pending drag before the pointer returns', () => {
  const grid = mountGrid();
  const start = { isPrimary: true, button: 0, pointerId: 1, clientX: 319, clientY: 120, timeStamp: 1 };
  grid.plane.props.onPointerDown(start);
  const before = grid.plane.children.map(card => card.style.transform);
  grid.globalEvents.get('pointerup')({ ...start, type: 'pointerup', clientX: 400, timeStamp: 20 });
  grid.root.events.get('pointermove')({ ...start, type: 'pointermove', clientX: 200, timeStamp: 30 });
  assert.deepEqual(grid.plane.children.map(card => card.style.transform), before);
  grid.dispose();
});


test('grid refresh repairs React-committed content after tile recycling', () => {
  const grid = mountGrid();
  for (let step = 0; step < 5; step++) grid.root.props.onKeyDown({ target: grid.root, currentTarget: grid.root, key: 'ArrowRight', preventDefault() {} });
  const card = grid.plane.children[0];
  const mapped = Number(card.dataset.itemIndex);
  assert.notEqual(mapped, 0);
  // Simulate a React commit of changed original-index JSX after the tile recycled.
  card.querySelector('img').src = '/changed-original-item.webp';
  card.querySelector('.mova-infinite-grid__caption').textContent = 'Changed original item';
  card.setAttribute('aria-label', 'Open Changed original item');
  grid.refresh();
  assert.equal(card.querySelector('img').src, `/photo-${mapped}.webp`);
  assert.equal(card.querySelector('.mova-infinite-grid__caption').textContent, `Photo ${mapped}`);
  assert.equal(card.getAttribute('aria-label'), `Open Photo ${mapped}`);
  grid.dispose();
});


test('menu culls front-facing tiles outside the viewport before painting their transforms', () => {
  const menu = mountMenu({ count: 160, width: 800, height: 500 });
  for (let frame = 0; frame < 240; frame++) menu.step(1000 / 60);
  const visible = menu.scene.children.filter(tile => tile.style.visibility === 'visible');
  assert.ok(visible.length > 0);
  assert.ok(visible.length < 60, `only viewport-adjacent tiles should paint, saw ${visible.length}`);
  for (const tile of visible) {
    const values = [...tile.style.transform.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)].map(match => Number(match[0]));
    const x = values[2], y = values[3], size = values[6] * 100, stretch = values[7];
    const extent = size * .8 * stretch;
    assert.ok(x + extent >= -400 && x - extent <= 400 && y + extent >= -250 && y - extent <= 250);
  }
  menu.dispose();
});
