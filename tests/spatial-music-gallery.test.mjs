import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpatialMusicGallery } from '../dist/index.js';
import ts from 'typescript';
import vm from 'node:vm';

const tracks = Array.from({ length: 24 }, (_, index) => ({ id: `track-${index}`, title: `Song ${index}`, artist: 'Mova ensemble', album: `Volume ${index % 3 + 1}`, image: `/cover-${index}.webp`, duration: 18 }));

test('music gallery ships a portable typed API and a meaningful empty state', () => {
  const manifest = JSON.parse(readFileSync('registry/manifest.json', 'utf8'));
  const entry = manifest.components.find(item => item.id === 'spatial-music-gallery');
  assert.equal(entry.tier, 'free');
  assert.equal(Object.hasOwn(entry, 'license'), false);
  assert.deepEqual(entry.dependencies, []);
  assert.ok(entry.exports.includes('SpatialMusicGallery'));
  assert.doesNotMatch(entry.content, /from ["'](?:@\/|\.\.?\/)|fetch\(|<iframe|dangerouslySetInnerHTML/);
  assert.match(readFileSync('dist/ui/patterns/spatial-music-gallery.d.ts', 'utf8'), /onTrackChange\?: \(track: SpatialMusicTrack, index: number\)/);
  const empty = renderToStaticMarkup(createElement(SpatialMusicGallery, { items: [], title: 'Quiet <room>', subtitle: 'My collection' }));
  assert.match(empty, /No tracks in this collection/);
  assert.match(empty, /Quiet &lt;room&gt;/);
  assert.match(empty, /My collection/);
  assert.doesNotMatch(empty, /aria-label="Back to collection"/);
});

// Stateful React/DOM adapter: real component hooks and effect engines run while
// the clock, browser geometry and audio calls remain deterministic.
function mount(props = {}, { reduced = false, width = 1000, height = 720 } = {}) {
  let now = 0, cursor = 0, dirty = true, tree, nextId = 1;
  const hooks = [], effects = [], frames = new Map(), intervals = new Map(), timers = new Map(), globals = new Map();
  const document = { activeElement: null };
  class Element {
    constructor(type) { this.type = type; this.children = []; this.attrs = {}; this.dataset = {}; this.style = {}; this.events = new Map(); this.text = ''; this.clientWidth = width; this.clientHeight = height; this.captured = new Set(); this.currentTime = 0; this.volume = 1; this.playCalls = 0; this.pauseCalls = 0; this.isConnected = true; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.text = value; this.children = []; }
    getAttribute(key) { return this.attrs[key] ?? null; }
    setAttribute(key, value) { this.attrs[key] = String(value); if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value); }
    set src(value) { this.attrs.src = value; } get src() { return this.attrs.src; }
    matches(selector) { if (selector === ':focus-visible') return true; if (selector.startsWith('[')) return selector.split(',').some(part => this.attrs[part.slice(1, -1)] !== undefined); return this.type === selector || selector.startsWith('.') && (this.attrs.class ?? '').split(' ').includes(selector.slice(1)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    querySelectorAll(selector) { const found = []; for (const child of this.children) { if (child.matches(selector)) found.push(child); found.push(...child.querySelectorAll(selector)); } return found; }
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
    addEventListener(type, callback) { this.events.set(type, callback); } removeEventListener(type) { this.events.delete(type); }
    setPointerCapture(id) { this.captured.add(id); } hasPointerCapture(id) { return this.captured.has(id); } releasePointerCapture(id) { this.captured.delete(id); }
    focus() { document.activeElement = this; }
    play() { this.playCalls++; return Promise.resolve(); } pause() { this.pauseCalls++; }
    getBoundingClientRect() { return { left: 0, top: 0, right: width, bottom: height, width, height }; }
  }
  const react = {
    createElement: (type, props, ...children) => typeof type === 'function' ? type({ ...props, children }) : ({ type, props: props ?? {}, children: children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false) }),
    useRef(value) { const index = cursor++; return hooks[index] ??= { current: value }; },
    useState(initial) { const index = cursor++; if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial }; return [hooks[index].value, value => { const next = typeof value === 'function' ? value(hooks[index].value) : value; if (!Object.is(next, hooks[index].value)) { hooks[index].value = next; dirty = true; } }]; },
    useId() { const index = cursor++; return (hooks[index] ??= 'music-test'); },
    useEffect(callback, dependencies) { const index = cursor++; const before = hooks[index]; if (!before || !dependencies || dependencies.some((value, position) => !Object.is(value, before.dependencies?.[position]))) { effects.push(() => { before?.cleanup?.(); const cleanup = callback(); hooks[index] = { dependencies, cleanup }; }); } },
  };
  react.default = react;
  const context = { exports: {}, require: () => react, document, performance: { now: () => now }, window: { matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }), addEventListener: (type, callback) => globals.set(type, callback), removeEventListener: type => globals.delete(type), setInterval: callback => { const id = nextId++; intervals.set(id, callback); return id; }, setTimeout: callback => { const id = nextId++; timers.set(id, callback); return id; } }, requestAnimationFrame: callback => { const id = nextId++; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id), clearInterval: id => intervals.delete(id), clearTimeout: id => timers.delete(id), ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} } };
  const source = readFileSync('source-registry/ui/patterns/spatial-music-gallery.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, context);
  function commit(vnode, old) {
    if (typeof vnode !== 'object') { const node = old?.type === '#text' ? old : new Element('#text'); node.text = String(vnode); return node; }
    const node = old?.type === vnode.type ? old : new Element(vnode.type);
    const before = node.props ?? {}; node.props = vnode.props;
    for (const [key, value] of Object.entries(vnode.props)) {
      if (key === 'ref') { if (value) value.current = node; }
      else if (key === 'style') { for (const [name, next] of Object.entries(value)) if (!Object.is(before.style?.[name], next)) node.style[name] = next; }
      else if (!key.startsWith('on') && key !== 'key' && !Object.is(before[key], value)) node.setAttribute(key === 'className' ? 'class' : key, value);
    }
    node.children = vnode.children.map((child, index) => commit(child, node.children[index])); node.children.forEach(child => { child.parent = node; });
    return node;
  }
  const settings = { items: tracks, ...props };
  function flush() { let attempts = 0; while (dirty || effects.length) { if (++attempts > 20) throw new Error('Effect render loop'); if (dirty) { dirty = false; cursor = 0; tree = commit(context.exports.SpatialMusicGallery(settings), tree); } const pending = effects.splice(0); pending.forEach(effect => effect()); } }
  flush();
  return {
    get root() { return tree; },
    find(label) { return [tree, ...tree.querySelectorAll('button'), ...tree.querySelectorAll('input')].find(node => node.getAttribute('aria-label') === label); },
    cards() { return tree.querySelectorAll('[data-music-card]'); },
    click(node) { node.props.onClick?.({ currentTarget: node, target: node, detail: 0 }); flush(); },
    wheel(x, y) { tree.querySelector('.mova-music__wall').events.get('wheel')({ deltaX: x, deltaY: y, deltaMode: 0, preventDefault() {} }); },
    step(milliseconds) { now += milliseconds; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); flush(); },
    elapse(milliseconds) { now += milliseconds; [...intervals.values()].forEach(callback => callback()); flush(); },
    key(key) { tree.props.onKeyDown({ target: tree, currentTarget: tree, key, preventDefault() {} }); flush(); },
    seek(seconds) { this.find('Track position').props.onChange({ target: { value: String(seconds) } }); flush(); },
    get activeElement() { return document.activeElement; },
    pointer(type, x, y) {
      const target = tree.querySelector('.mova-music__wall');
      const event = { type, target, isPrimary: true, button: 0, pointerId: 1, clientX: x, clientY: y, timeStamp: now };
      if (type === 'pointerdown') target.props.onPointerDown(event);
      else tree.events.get(type)?.(event);
      flush();
    },
    get frameCount() { return frames.size; },
    dispose() { hooks.forEach(hook => hook?.cleanup?.()); assert.equal(frames.size, 0); assert.equal(intervals.size, 0); assert.equal(globals.size, 0); },
  };
}

test('card selection, demo progress, pause, seeking and previous restart work together', () => {
  const changed = [], play = [];
  const gallery = mount({ onTrackChange: track => changed.push(track.id), onPlayChange: value => play.push(value) });
  gallery.click(gallery.find('Play Song 0 by Mova ensemble'));
  assert.equal(changed.at(-1), 'track-0'); assert.ok(gallery.find('Pause'));
  gallery.elapse(1250); assert.equal(Number(gallery.find('Track position').props.value), 1.25);
  gallery.seek(5); gallery.click(gallery.find('Pause')); gallery.elapse(1000);
  assert.equal(Number(gallery.find('Track position').props.value), 5);
  gallery.click(gallery.find('Previous track')); assert.equal(Number(gallery.find('Track position').props.value), 0);
  assert.equal(play.at(-1), false);
  gallery.dispose();
});

test('queue membership deduplicates, next consumes it, and favorites expose visible state', () => {
  const queues = [], favorites = [], changed = [];
  const gallery = mount({ defaultQueue: ['track-1', 'track-1', 'missing'], onQueueChange: ids => queues.push([...ids]), onFavoriteChange: ids => favorites.push([...ids]), onTrackChange: track => changed.push(track.id) });
  assert.deepEqual(queues.at(-1), ['track-1']);
  gallery.click(gallery.find('Next track')); assert.equal(changed.at(-1), 'track-1'); assert.deepEqual(queues.at(-1), []);
  const card = gallery.cards().find(card => card.dataset.trackId === 'track-0' && card.style.visibility === 'visible');
  gallery.click(card.querySelector('[data-track-add]')); assert.deepEqual(queues.at(-1), ['track-0']);
  assert.equal(card.querySelector('[data-track-add]').getAttribute('aria-pressed'), 'true');
  gallery.click(card.querySelector('[data-track-favorite]')); assert.deepEqual(favorites.at(-1), ['track-0']);
  assert.equal(card.querySelector('[data-track-favorite]').getAttribute('aria-pressed'), 'true');
  gallery.dispose();
});

test('queue opens with focus, Escape closes it and restores the queue control', () => {
  const gallery = mount();
  gallery.click(gallery.find('Play queue'));
  assert.equal(gallery.activeElement.getAttribute('aria-label'), 'Close queue');
  gallery.key('Escape');
  assert.equal(gallery.activeElement.getAttribute('aria-label'), 'Play queue');
  assert.equal(gallery.root.querySelector('[role]')?.getAttribute('role') === 'dialog', false);
  gallery.dispose();
});

test('locate centers the actual current track after it leaves the painted viewport', () => {
  const gallery = mount();
  gallery.wheel(-650, -360); gallery.step(16);
  gallery.click(gallery.find('Locate Song 0'));
  for (let frame = 0; frame < 180; frame++) gallery.step(1000 / 60);
  const centered = gallery.cards().find(card => card.dataset.trackId === 'track-0' && card.style.visibility === 'visible' && Math.hypot(Number(card.dataset.x), Number(card.dataset.y)) < 1);
  assert.ok(centered, 'the real projection, rather than a stale hidden tile, reaches the center');
  gallery.dispose();
});

test('oversized center card retains play, add and favorite keyboard controls on narrow scenes', () => {
  const gallery = mount({ cardWidth: 240, focusScale: 1.6 }, { width: 310, height: 400, reduced: true });
  const centered = gallery.cards().find(card => card.dataset.trackId === 'track-0' && Math.hypot(Number(card.dataset.x), Number(card.dataset.y)) < 1);
  assert.ok(centered);
  assert.equal(centered.querySelector('[data-track-play]').tabIndex, 0);
  assert.equal(centered.querySelector('[data-track-add]').tabIndex, 0);
  assert.equal(centered.querySelector('[data-track-favorite]').tabIndex, 0);
  gallery.key('ArrowRight'); gallery.click(gallery.find('Locate Song 0')); gallery.step(16);
  assert.equal(gallery.frameCount, 0);
  gallery.dispose();
});

test('demo track completion advances once and preserves active playback', () => {
  const changed = [];
  const gallery = mount({ onTrackChange: track => changed.push(track.id) });
  gallery.click(gallery.find('Play'));
  gallery.elapse(19000);
  assert.equal(changed.at(-1), 'track-1'); assert.ok(gallery.find('Pause'));
  gallery.elapse(500); assert.equal(Number(gallery.find('Track position').props.value), .5);
  gallery.dispose();
});


test('native audio respects play, pause, volume and seek, and stops when a demo track is selected', () => {
  const withAudio = tracks.map((track, index) => index === 0 ? { ...track, src: '/local-track.mp3' } : track);
  const gallery = mount({ items: withAudio, volume: .4 });
  const audio = gallery.root.querySelector('audio');
  gallery.click(gallery.find('Play'));
  assert.equal(audio.volume, .4); assert.ok(audio.playCalls > 0);
  gallery.seek(7); assert.equal(audio.currentTime, 7);
  const pauses = audio.pauseCalls;
  gallery.click(gallery.find('Pause')); assert.ok(audio.pauseCalls > pauses);
  gallery.click(gallery.find('Play')); const before = audio.pauseCalls;
  gallery.click(gallery.find('Play Song 1 by Mova ensemble'));
  assert.ok(audio.pauseCalls > before, 'moving from audio to a local preview pauses native media');
  gallery.dispose();
});

test('pan toss uses elapsed seconds consistently at 60Hz and 144Hz', () => {
  const trajectory = rate => {
    const gallery = mount();
    gallery.step(16); gallery.pointer('pointerdown', 200, 200);
    gallery.step(16); gallery.pointer('pointermove', 300, 240); gallery.pointer('pointerup', 300, 240);
    for (let frame = 0; frame < rate / 4; frame++) gallery.step(1000 / rate);
    const points = gallery.cards().map(card => ({ visible: card.style.visibility === 'visible', x: Number(card.dataset.x), y: Number(card.dataset.y) }));
    gallery.dispose(); return points;
  };
  const a = trajectory(60), b = trajectory(144);
  let compared = 0;
  for (let index = 0; index < a.length; index++) if (a[index].visible && b[index].visible) {
    compared++;
    assert.ok(Math.abs(a[index].x - b[index].x) < .5);
    assert.ok(Math.abs(a[index].y - b[index].y) < .5);
  }
  assert.ok(compared > 3);
});


test('mobile keyboard panning to an exact half-pitch staggered row keeps cards reachable', () => {
  const gallery = mount({}, { width: 310, height: 400, reduced: true });
  gallery.key('ArrowDown');
  const centeredRow = gallery.cards().filter(card => card.style.visibility === 'visible' && Math.abs(Number(card.dataset.y)) < 1 && Math.abs(Math.abs(Number(card.dataset.x)) - 130) < 1);
  assert.ok(centeredRow.length >= 2);
  assert.ok(centeredRow.every(card => card.querySelector('[data-track-play]').tabIndex === 0));
  assert.ok(centeredRow.every(card => card.querySelector('[data-track-add]').tabIndex === 0));
  gallery.dispose();
});
