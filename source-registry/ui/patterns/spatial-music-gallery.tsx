"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";

export interface SpatialMusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  image: string;
  /** Duration in seconds. */
  duration: number;
  /** Optional audio URL. Without one, playback uses a local demonstration clock. */
  src?: string;
}

export interface SpatialMusicGalleryProps {
  items: SpatialMusicTrack[];
  title?: string;
  subtitle?: string;
  cardWidth?: number;
  gap?: number;
  focusScale?: number;
  edgeScale?: number;
  falloff?: number;
  dim?: number;
  momentum?: number;
  volume?: number;
  theme?: "dark" | "light";
  height?: CSSProperties["height"];
  initialTrackId?: string;
  defaultPlaying?: boolean;
  defaultQueue?: string[];
  defaultFavorites?: string[];
  defaultQueueOpen?: boolean;
  onTrackChange?: (track: SpatialMusicTrack, index: number) => void;
  onPlayChange?: (playing: boolean) => void;
  onQueueChange?: (trackIds: string[]) => void;
  onFavoriteChange?: (trackIds: string[]) => void;
  onBack?: () => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type WallEngine = { pan: (x: number, y: number) => void; center: (trackId: string, instant?: boolean) => void; refresh: () => void; stop: () => void };
type Drag = { pointer: number; x: number; y: number; time: number; distance: number; vx: number; vy: number };
const number = (value: number, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const lengthOf = (track?: SpatialMusicTrack) => track ? number(track.duration, 1, 86400, 180) : 1;
const clock = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
const uniqueIds = (ids: string[], items: SpatialMusicTrack[]) => [...new Set(ids)].filter(id => items.some(item => item.id === id));

function MusicIcon({ name, filled = false }: { name: "play" | "pause" | "previous" | "next" | "queue" | "locate" | "heart" | "back"; filled?: boolean }) {
  const paths = {
    play: "m9 5 10 7-10 7Z", pause: "M8 5v14M16 5v14", previous: "M6 5v14m12-14L8 12l10 7Z", next: "M18 5v14M6 5l10 7-10 7Z",
    queue: "M5 6h14M5 12h14M5 18h9", locate: "M12 3v3m0 12v3M3 12h3m12 0h3M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
    heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z", back: "m14 6-6 6 6 6",
  };
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

const musicCss = `
.mova-music{position:relative;isolation:isolate;overflow:hidden;container-type:inline-size;background:radial-gradient(ellipse at 50% 48%,#55422c24,transparent 68%),var(--music-bg);color:var(--music-ink);font-family:inherit;outline:none}
.mova-music:focus-visible{outline:2px solid var(--music-ink);outline-offset:-3px}
.mova-music__wall{position:absolute;inset:0;z-index:0;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
.mova-music[data-dragging=true] .mova-music__wall{cursor:grabbing}
.mova-music__card{position:absolute;left:50%;top:50%;transform-origin:center;will-change:transform,opacity;background:var(--music-card);border:1px solid var(--music-border);border-radius:6px;box-sizing:border-box;overflow:hidden;box-shadow:0 12px 28px #0002}
.mova-music__card:hover,.mova-music__card:focus-within{border-color:var(--music-hover)}
.mova-music__card[data-current=true]{border-color:var(--music-hover)}
.mova-music__track{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;box-sizing:border-box;width:100%;height:100%;border:0;padding:6px 6px 12px;background:none;color:inherit;text-align:left;font:inherit;cursor:inherit}
.mova-music__track:focus-visible{outline:2px solid var(--music-ink);outline-offset:-3px}
.mova-music__cover{display:block;flex:none;width:100%;aspect-ratio:1;object-fit:cover;border-radius:2px;pointer-events:none;background:var(--music-border)}
.mova-music__meta{display:block;padding:10px 6px 0}.mova-music__name{display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:14px;font-weight:650;line-height:1.25;letter-spacing:-.025em}
.mova-music__artist{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin-top:4px;font-size:10px;line-height:1.3;color:var(--music-muted)}
.mova-music__album{position:absolute;left:12px;bottom:13px;right:48px;display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:9px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.02em;color:var(--music-muted)}
.mova-music__add,.mova-music__favorite{position:absolute;display:grid;place-items:center;border:0;color:var(--music-ink);background:var(--music-button);cursor:pointer}
.mova-music__add{right:10px;bottom:12px;width:26px;height:26px;border-radius:50%;font-family:inherit;font-size:18px;line-height:1}.mova-music__add[aria-pressed=true]{background:var(--music-ink);color:var(--music-bg)}
.mova-music__favorite{right:12px;top:12px;width:28px;height:28px;border-radius:50%;opacity:0;transition:opacity .16s}
.mova-music__card:hover .mova-music__favorite,.mova-music__card:focus-within .mova-music__favorite,.mova-music__favorite[aria-pressed=true]{opacity:1}
.mova-music button:focus-visible,.mova-music input:focus-visible{outline:2px solid var(--music-ink);outline-offset:3px}
.mova-music__heading{position:absolute;z-index:2;top:20px;left:50%;transform:translateX(-50%);box-sizing:border-box;max-width:calc(100% - 112px);padding:12px 20px;text-align:center;border:1px solid var(--music-glass-border);border-radius:12px;background:var(--music-glass);backdrop-filter:blur(18px);pointer-events:none}
.mova-music__heading h2{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin:0;font-size:13px;line-height:1.4;font-weight:650;letter-spacing:-.02em}
.mova-music__heading p{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin:3px 0 0;color:var(--music-muted);font-size:10px;line-height:1.4}
.mova-music__back{position:absolute;top:24px;left:24px;z-index:3}
.mova-music__icon{display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;background:var(--music-button);color:var(--music-ink);cursor:pointer}
.mova-music__player{position:absolute;bottom:20px;left:50%;z-index:2;transform:translateX(-50%);box-sizing:border-box;width:min(410px,calc(100% - 48px));padding:12px 20px;border:1px solid var(--music-glass-border);border-radius:16px;background:var(--music-glass);backdrop-filter:blur(24px)}
.mova-music__transport{display:flex;align-items:center;justify-content:center;gap:20px}.mova-music__transport button{background:none}.mova-music__transport .mova-music__play{width:36px;height:36px;background:var(--music-ink);color:var(--music-bg)}
.mova-music__scrub{display:flex;align-items:center;gap:12px;margin-top:7px;font:9px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--music-muted)}
.mova-music__scrub input{width:100%;height:3px;margin:0;accent-color:var(--music-ink);cursor:pointer}
.mova-music__now{display:flex;align-items:center;gap:8px;position:absolute;right:20px;bottom:26px;z-index:2}.mova-music__now-track{display:flex;align-items:center;gap:8px;max-width:190px;border:0;background:var(--music-glass);border-radius:24px;padding:6px 12px 6px 6px;color:var(--music-ink);cursor:pointer;backdrop-filter:blur(16px)}
.mova-music__now-track img{width:24px;height:24px;border-radius:50%;object-fit:cover}.mova-music__now-track span{max-width:100px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:10px}
.mova-music__queue{position:absolute;z-index:4;top:92px;bottom:112px;right:20px;width:min(320px,calc(100% - 40px));box-sizing:border-box;display:flex;flex-direction:column;border:1px solid var(--music-glass-border);border-radius:14px;background:var(--music-queue);box-shadow:0 20px 70px #0004;backdrop-filter:blur(24px)}
.mova-music__queue-head{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px;border-bottom:1px solid var(--music-border)}.mova-music__queue-head h3{margin:0;font-size:13px;font-weight:600}
.mova-music__queue-list{overflow-y:auto;padding:8px;overscroll-behavior:contain}.mova-music__queue-empty{margin:20px 12px;font-size:12px;line-height:1.6;color:var(--music-muted)}
.mova-music__queue-row{display:flex;align-items:center;gap:8px;padding:4px;border-radius:8px}.mova-music__queue-song{display:flex;align-items:center;gap:10px;flex:1;min-width:0;border:0;padding:6px;background:none;color:inherit;text-align:left;cursor:pointer}.mova-music__queue-song img{width:36px;height:36px;border-radius:4px;object-fit:cover}.mova-music__queue-song span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px}.mova-music__queue-song small{display:block;margin-top:3px;font-size:10px;color:var(--music-muted)}
.mova-music__status{position:absolute;top:98px;left:50%;transform:translateX(-50%);z-index:3;max-width:calc(100% - 32px);padding:6px 12px;border-radius:20px;background:var(--music-glass);font-size:10px;pointer-events:none}
@container(max-width:760px){.mova-music__now{bottom:124px;right:20px}.mova-music__now-track span{max-width:82px}}
@container(max-width:420px){.mova-music__heading{top:16px;padding:10px 14px;max-width:calc(100% - 80px)}.mova-music__back{top:20px;left:12px}.mova-music__player{bottom:16px;width:calc(100% - 32px);padding:10px 16px}.mova-music__now{right:16px;bottom:116px}.mova-music__now-track{max-width:132px}.mova-music__now-track span{max-width:60px}.mova-music__queue{top:84px;right:16px;bottom:160px;width:calc(100% - 32px)}}
@media(prefers-reduced-motion:reduce){.mova-music *{transition:none!important}}
`;

export function SpatialMusicGallery({ items, title = "In rotation", subtitle = "A collection of good company", cardWidth = 220, gap = 40, focusScale = 1.35, edgeScale = .55, falloff = 1, dim = .6, momentum = .75, volume = .65, theme = "dark", height = 720, initialTrackId, defaultPlaying = false, defaultQueue = [], defaultFavorites = [], defaultQueueOpen = false, onTrackChange, onPlayChange, onQueueChange, onFavoriteChange, onBack, label = "Spatial music collection", className = "", style }: SpatialMusicGalleryProps) {
  const root = useRef<HTMLDivElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const queuePanel = useRef<HTMLElement>(null);
  const queueButton = useRef<HTMLButtonElement>(null);
  const engine = useRef<WallEngine | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const pan = useRef({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 1000, height: 720 });
  const [activeId, setActiveId] = useState(initialTrackId && items.some(item => item.id === initialTrackId) ? initialTrackId : items[0]?.id ?? "");
  const [playing, setPlaying] = useState(defaultPlaying && items.length > 0);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const [revision, setRevision] = useState(0);
  const [queue, setQueue] = useState(() => uniqueIds(defaultQueue, items));
  const [favorites, setFavorites] = useState(() => uniqueIds(defaultFavorites, items));
  const [queueOpen, setQueueOpen] = useState(defaultQueueOpen);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [status, setStatus] = useState("");
  const id = useId();
  const options = useRef({ items, activeId, queue, favorites, playing, focusScale, edgeScale, falloff, dim, momentum, reducedMotion, onTrackChange, onPlayChange, onQueueChange, onFavoriteChange });
  options.current = { items, activeId, queue, favorites, playing, focusScale, edgeScale, falloff, dim, momentum, reducedMotion, onTrackChange, onPlayChange, onQueueChange, onFavoriteChange };
  const transport = useRef({ next: (_direction: number) => {} });
  const width = number(cardWidth, 120, 360, 220);
  const cardHeight = width + 104;
  const stepX = width + number(gap, 8, 160, 40), stepY = cardHeight + number(gap, 8, 160, 40);
  const columns = Math.ceil(viewport.width / (width * .5)) + 4;
  const rows = Math.ceil(viewport.height / (cardHeight * .5) / 2) * 2 + 4;
  const cells = items.length ? Array.from({ length: columns * rows }, (_, index) => ({ column: index % columns, row: Math.floor(index / columns), index: index % items.length })) : [];
  const current = items.find(item => item.id === activeId) ?? items[0];
  const duration = lengthOf(current);

  const seek = (value: number) => {
    const next = number(value, 0, duration, 0);
    progressRef.current = next; setProgress(next);
    if (audio.current && current?.src) audio.current.currentTime = next;
  };
  const select = (trackId: string, startPlaying = true) => {
    const index = options.current.items.findIndex(item => item.id === trackId);
    if (index < 0) return;
    progressRef.current = 0; setProgress(0); setActiveId(trackId); setRevision(value => value + 1); setPlaying(startPlaying);
    engine.current?.center(trackId);
    options.current.onTrackChange?.(options.current.items[index], index);
  };
  const next = (direction: number) => {
    const settings = options.current;
    if (!settings.items.length) return;
    if (direction < 0 && progressRef.current > 3) { seek(0); return; }
    const queued = direction > 0 ? settings.queue.find(trackId => settings.items.some(item => item.id === trackId)) : undefined;
    const index = settings.items.findIndex(item => item.id === settings.activeId);
    const track = queued ? settings.items.find(item => item.id === queued)! : settings.items[modulo(index + direction, settings.items.length)];
    if (queued) setQueue(value => value.filter(trackId => trackId !== queued));
    select(track.id, settings.playing);
  };
  transport.current.next = next;
  const toggleQueued = (trackId: string) => {
    const track = options.current.items.find(item => item.id === trackId);
    if (!track) return;
    const queued = options.current.queue.includes(trackId);
    setQueue(value => queued ? value.filter(id => id !== trackId) : [...new Set([...value, trackId])]);
    setStatus(`${track.title} ${queued ? "removed from queue" : "added to queue"}`);
  };
  const toggleFavorite = (trackId: string) => {
    const favored = options.current.favorites.includes(trackId);
    setFavorites(value => favored ? value.filter(id => id !== trackId) : [...new Set([...value, trackId])]);
    const track = options.current.items.find(item => item.id === trackId);
    setStatus(`${track?.title ?? "Track"} ${favored ? "removed from favorites" : "saved to favorites"}`);
  };

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setReducedMotion(preference.matches); if (preference.matches) engine.current?.stop(); };
    sync(); preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const observer = new ResizeObserver(() => setViewport({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) }));
    observer.observe(host); setViewport({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = root.current, layer = wall.current;
    if (!host || !layer || !items.length) return;
    const tiles = Array.from(layer.children) as HTMLElement[];
    const parts = tiles.map(tile => ({
      buttons: Array.from(tile.querySelectorAll<HTMLButtonElement>("button")),
      image: tile.querySelector<HTMLImageElement>("img"),
      text: ["name", "artist", "album"].map(part => tile.querySelector(`[data-track-${part}]`)),
      play: tile.querySelector<HTMLButtonElement>("[data-track-play]"),
      add: tile.querySelector<HTMLButtonElement>("[data-track-add]"),
      favorite: tile.querySelector<HTMLButtonElement>("[data-track-favorite]"),
      heart: tile.querySelector("[data-track-favorite]")?.querySelector("svg"),
    }));
    let velocity = { x: 0, y: 0 }, destination: { x: number; y: number } | null = null;
    let frame = 0, last = 0, alive = true, visible = true;
    const plotted: { x: number; y: number; trackId: string }[] = [];
    const paint = () => {
      const settings = options.current;
      const periodX = columns * stepX, periodY = rows * stepY;
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index], tile = tiles[index], node = parts[index];
        const yRaw = cell.row * stepY + pan.current.y;
        const cycleY = Math.floor((yRaw + periodY / 2) / periodY);
        const worldRow = cell.row - cycleY * rows;
        const stagger = modulo(worldRow, 2) * stepX / 2;
        const xRaw = cell.column * stepX + stagger + pan.current.x;
        const cycleX = Math.floor((xRaw + periodX / 2) / periodX);
        const worldColumn = cell.column - cycleX * columns;
        const x = xRaw - cycleX * periodX, y = yRaw - cycleY * periodY;
        const track = settings.items[modulo(worldRow * columns + worldColumn, settings.items.length)];
        plotted[index] = { x, y, trackId: track.id };
        const distance = Math.hypot(x, y);
        const influence = Math.exp(-number(settings.falloff, .2, 4, 1) * (distance / (width * .85)) ** 2);
        const scale = number(settings.edgeScale, .25, 1, .55) + (number(settings.focusScale, .8, 2, 1.35) - number(settings.edgeScale, .25, 1, .55)) * influence;
        const extentX = width * scale / 2 + 6, extentY = cardHeight * scale / 2 + 6;
        if (x + extentX < -viewport.width / 2 || x - extentX > viewport.width / 2 || y + extentY < -viewport.height / 2 || y - extentY > viewport.height / 2) {
          if (tile.style.visibility !== "hidden") tile.style.visibility = "hidden";
          node.buttons.forEach(button => { if (button.tabIndex !== -1) button.tabIndex = -1; });
          continue;
        }
        tile.style.visibility = "visible";
        tile.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y}px,0) scale(${scale})`;
        tile.style.opacity = String(1 - number(settings.dim, 0, .9, .6) * (1 - influence));
        tile.style.zIndex = String(Math.round(influence * 100));
        tile.dataset.x = String(x); tile.dataset.y = String(y); tile.dataset.trackId = track.id;
        tile.dataset.current = String(track.id === settings.activeId);
        const image = node.image;
        if (image && image.getAttribute("src") !== track.image) image.src = track.image;
        const text: [string, string][] = [["name", track.title], ["artist", track.artist], ["album", `${track.album ?? "Single"} · ${clock(lengthOf(track))}`]];
        text.forEach(([, value], index) => { const element = node.text[index]; if (element && element.textContent !== value) element.textContent = value; });
        const button = node.play;
        if (button) { button.setAttribute("aria-label", `Play ${track.title} by ${track.artist}`); button.setAttribute("aria-pressed", String(track.id === settings.activeId)); }
        const add = node.add, favorite = node.favorite;
        if (add) { const queued = settings.queue.includes(track.id); add.setAttribute("aria-pressed", String(queued)); add.setAttribute("aria-label", `${queued ? "Remove" : "Add"} ${track.title} ${queued ? "from" : "to"} queue`); if (add.textContent !== (queued ? "✓" : "+")) add.textContent = queued ? "✓" : "+"; }
        if (favorite) { const favored = settings.favorites.includes(track.id); favorite.setAttribute("aria-pressed", String(favored)); favorite.setAttribute("aria-label", `${favored ? "Unfavorite" : "Favorite"} ${track.title}`); node.heart?.setAttribute("fill", favored ? "currentColor" : "none"); }
        const fullyVisible = x - extentX >= -viewport.width / 2 && x + extentX <= viewport.width / 2 && y - extentY >= -viewport.height / 2 && y + extentY <= viewport.height / 2;
        const centered = Math.abs(x) <= stepX / 2 + .01 && Math.abs(y) <= stepY / 2 + .01;
        node.buttons.forEach(control => { const tab = fullyVisible || centered ? 0 : -1; if (control.tabIndex !== tab) control.tabIndex = tab; });
      }
    };
    const wake = () => { if (!frame && alive && visible) frame = requestAnimationFrame(tick); };
    const tick = (time: number) => {
      frame = 0;
      if (!alive || !visible) return;
      const dt = last ? Math.min(.05, (time - last) / 1000) : 1 / 60; last = time;
      if (!drag.current) {
        if (destination) {
          const blend = options.current.reducedMotion ? 1 : 1 - Math.exp(-10 * dt);
          pan.current.x += (destination.x - pan.current.x) * blend;
          pan.current.y += (destination.y - pan.current.y) * blend;
          if (Math.hypot(destination.x - pan.current.x, destination.y - pan.current.y) < .2) { pan.current = destination; destination = null; }
        } else if (!options.current.reducedMotion && Math.hypot(velocity.x, velocity.y) > 1) {
          const damping = 15 - number(options.current.momentum, 0, 1, .75) * 13;
          const fade = Math.exp(-damping * dt);
          pan.current.x += velocity.x * (1 - fade) / damping; pan.current.y += velocity.y * (1 - fade) / damping;
          velocity.x *= fade; velocity.y *= fade;
        }
      }
      paint();
      if (destination || (!options.current.reducedMotion && Math.hypot(velocity.x, velocity.y) > 1)) wake(); else last = 0;
    };
    const center = (trackId: string, instant = false) => {
      paint();
      let best: { x: number; y: number; trackId: string } | undefined, distance = Infinity;
      for (const point of plotted) {
        if (point.trackId !== trackId) continue;
        const next = Math.hypot(point.x, point.y);
        if (next < distance) { best = point; distance = next; }
      }
      velocity = { x: 0, y: 0 }; destination = null;
      if (best) {
        const target = { x: pan.current.x - best.x, y: pan.current.y - best.y };
        velocity = { x: 0, y: 0 };
        if (instant || options.current.reducedMotion) { pan.current = target; destination = null; paint(); }
        else { destination = target; wake(); }
      } else {
        const index = options.current.items.findIndex(item => item.id === trackId);
        if (index >= 0) { const row = Math.floor(index / columns), column = index % columns; pan.current = { x: -column * stepX - modulo(row, 2) * stepX / 2, y: -row * stepY }; paint(); }
      }
    };
    const stop = () => { velocity = { x: 0, y: 0 }; destination = null; };
    engine.current = { refresh: paint, stop, center, pan: (x, y) => { stop(); pan.current.x += x; pan.current.y += y; paint(); } };
    const move = (event: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || current.pointer !== event.pointerId) return;
      const x = event.clientX - current.x, y = event.clientY - current.y;
      const dt = Math.max(.008, (event.timeStamp - current.time) / 1000);
      current.vx = current.vx * .25 + x / dt * .75; current.vy = current.vy * .25 + y / dt * .75;
      current.distance += Math.hypot(x, y); current.x = event.clientX; current.y = event.clientY; current.time = event.timeStamp;
      pan.current.x += x; pan.current.y += y;
      if (current.distance > 5) { suppressClick.current = true; setDragging(true); host.setPointerCapture(event.pointerId); }
      wake();
    };
    const release = (event: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || current.pointer !== event.pointerId) return;
      drag.current = null; setDragging(false);
      if (event.type === "pointerup" && event.timeStamp - current.time < 100 && !options.current.reducedMotion && options.current.momentum > 0) velocity = { x: current.vx, y: current.vy };
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
      last = event.timeStamp; wake();
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault(); stop();
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height : 1;
      pan.current.x -= (event.shiftKey ? event.deltaY : event.deltaX) * multiplier;
      if (!event.shiftKey) pan.current.y -= event.deltaY * multiplier;
      wake();
    };
    const visibility = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); last = 0; if (visible) wake(); });
    visibility.observe(host);
    host.addEventListener("pointermove", move); host.addEventListener("pointerup", release); host.addEventListener("pointercancel", release); host.addEventListener("lostpointercapture", release);
    window.addEventListener("pointerup", release); window.addEventListener("pointercancel", release); layer.addEventListener("wheel", wheel, { passive: false });
    paint();
    if (options.current.activeId) center(options.current.activeId, true);
    return () => { alive = false; cancelAnimationFrame(frame); visibility.disconnect(); engine.current = null; drag.current = null; host.removeEventListener("pointermove", move); host.removeEventListener("pointerup", release); host.removeEventListener("pointercancel", release); host.removeEventListener("lostpointercapture", release); window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); layer.removeEventListener("wheel", wheel); };
  }, [columns, rows, viewport.width, viewport.height, width, stepX, stepY, items.length]);
  useEffect(() => { engine.current?.refresh(); }, [items, activeId, queue, favorites, focusScale, edgeScale, falloff, dim, reducedMotion]);
  useEffect(() => { options.current.onPlayChange?.(playing); }, [playing]);
  useEffect(() => { options.current.onQueueChange?.(queue); }, [queue]);
  useEffect(() => { options.current.onFavoriteChange?.(favorites); }, [favorites]);
  useEffect(() => { if (!status) return; const timer = window.setTimeout(() => setStatus(""), 2200); return () => clearTimeout(timer); }, [status]);
  useEffect(() => {
    const valid = new Set(items.map(item => item.id));
    setQueue(value => value.every(id => valid.has(id)) ? value : value.filter(id => valid.has(id)));
    setFavorites(value => value.every(id => valid.has(id)) ? value : value.filter(id => valid.has(id)));
    if (!valid.has(activeId)) { setActiveId(items[0]?.id ?? ""); progressRef.current = 0; setProgress(0); if (!items.length) setPlaying(false); }
  }, [items, activeId]);
  useEffect(() => {
    if (!queueOpen) return;
    queuePanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => queueButton.current?.focus({ preventScroll: true });
  }, [queueOpen]);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    if (!current?.src) { element.pause(); return; }
    element.volume = number(volume, 0, 1, .65);
    let currentAttempt = true;
    if (playing) { const attempt = element.play(); attempt?.catch(() => { if (currentAttempt) { setPlaying(false); setStatus("Audio could not play. Try Play again."); } }); }
    else element.pause();
    return () => { currentAttempt = false; };
  }, [current?.src, playing, volume, revision]);
  useEffect(() => { const element = audio.current; return () => element?.pause(); }, []);
  useEffect(() => { if (audio.current) audio.current.currentTime = 0; }, [activeId, revision]);
  useEffect(() => {
    if (!playing || !current || current.src) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      progressRef.current = Math.min(lengthOf(current), progressRef.current + (now - previous) / 1000); previous = now;
      setProgress(progressRef.current);
      if (progressRef.current >= lengthOf(current)) transport.current.next(1);
    }, 250);
    return () => clearInterval(timer);
  }, [playing, activeId, current?.src, revision]);

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest("[data-track-add],[data-track-favorite]")) return;
    suppressClick.current = false; engine.current?.stop();
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, distance: 0, vx: 0, vy: 0 };
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && queueOpen) { event.preventDefault(); setQueueOpen(false); return; }
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction: Record<string, [number, number]> = { ArrowLeft: [stepX, 0], ArrowRight: [-stepX, 0], ArrowUp: [0, stepY], ArrowDown: [0, -stepY] };
    if (direction[event.key]) { event.preventDefault(); engine.current?.pan(...direction[event.key]); }
    else if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (items.length) setPlaying(value => !value); }
    else if (event.key.toLowerCase() === "q") { event.preventDefault(); setQueueOpen(value => !value); }
    else if (event.key === "Home" && current) { event.preventDefault(); engine.current?.center(current.id); }
  };
  const cardTrack = (element: HTMLElement) => element.closest<HTMLElement>("[data-music-card]")?.dataset.trackId;
  const revealControl = (element: HTMLButtonElement) => {
    if (!element.matches(":focus-visible") || !root.current) return;
    const control = element.getBoundingClientRect(), host = root.current.getBoundingClientRect();
    const x = control.left < host.left + 12 ? host.left + 12 - control.left : control.right > host.right - 12 ? host.right - 12 - control.right : 0;
    const y = control.top < host.top + 12 ? host.top + 12 - control.top : control.bottom > host.bottom - 12 ? host.bottom - 12 - control.bottom : 0;
    if (x || y) engine.current?.pan(x, y);
  };
  const dark = theme === "dark";
  return <section ref={root} data-theme={theme} data-dragging={dragging} className={`mova-music ${className}`} role="region" aria-label={label} aria-describedby={`${id}-help`} tabIndex={items.length ? 0 : undefined} onKeyDown={keyDown} style={{ width: "100%", height, minHeight: 400, "--music-bg": dark ? "#10110f" : "#e9e9e4", "--music-card": dark ? "#111210" : "#fff", "--music-ink": dark ? "#f4f4ef" : "#20211e", "--music-muted": dark ? "#979991" : "#686b61", "--music-border": dark ? "#ffffff0c" : "#00000012", "--music-hover": dark ? "#ffffff40" : "#00000055", "--music-button": dark ? "#ffffff0d" : "#0000000b", "--music-glass": dark ? "#191b17c9" : "#f8f9f3d9", "--music-glass-border": dark ? "#ffffff0b" : "#0000000d", "--music-queue": dark ? "#171914ed" : "#f8f9f4f2", ...style } as CSSProperties}>
    <style>{musicCss}</style>
    <div ref={wall} className="mova-music__wall" onPointerDown={pointerDown} onDragStart={event => event.preventDefault()} onClickCapture={event => { if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      {cells.map((cell, index) => { const track = items[cell.index]; return <article key={index} data-music-card="" className="mova-music__card" style={{ width, height: cardHeight, visibility: "hidden" }}>
        <button type="button" data-track-play="" className="mova-music__track" aria-label={`Play ${track.title} by ${track.artist}`} aria-pressed={track.id === activeId} onClick={event => { const trackId = cardTrack(event.currentTarget); if (trackId) select(trackId); }} onFocus={event => { if (!event.currentTarget.matches(":focus-visible")) return; const tile = event.currentTarget.closest<HTMLElement>("[data-music-card]"); if (tile?.dataset.trackId) engine.current?.center(tile.dataset.trackId); }}>
          <img className="mova-music__cover" src={track.image} alt="" draggable={false} /><span className="mova-music__meta"><strong className="mova-music__name" data-track-name="">{track.title}</strong><span className="mova-music__artist" data-track-artist="">{track.artist}</span><span className="mova-music__album" data-track-album="">{track.album ?? "Single"} · {clock(lengthOf(track))}</span></span>
        </button>
        <button type="button" data-track-add="" className="mova-music__add" onFocus={event => revealControl(event.currentTarget)} aria-label={`Add ${track.title} to queue`} aria-pressed={queue.includes(track.id)} onClick={event => { const trackId = cardTrack(event.currentTarget); if (trackId) toggleQueued(trackId); }}>{queue.includes(track.id) ? "✓" : "+"}</button>
        <button type="button" data-track-favorite="" className="mova-music__favorite" onFocus={event => revealControl(event.currentTarget)} aria-label={`Favorite ${track.title}`} aria-pressed={favorites.includes(track.id)} onClick={event => { const trackId = cardTrack(event.currentTarget); if (trackId) toggleFavorite(trackId); }}><MusicIcon name="heart" filled={favorites.includes(track.id)} /></button>
      </article>; })}
    </div>
    {onBack && <button type="button" className="mova-music__back mova-music__icon" onClick={onBack} aria-label="Back to collection"><MusicIcon name="back" /></button>}
    <header className="mova-music__heading"><h2>{title}</h2><p>{subtitle}</p></header>
    {!items.length && <p style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--music-muted)", fontSize: 14 }}>No tracks in this collection</p>}
    <div className="mova-music__player" role="group" aria-label="Playback controls">
      <div className="mova-music__transport"><button type="button" className="mova-music__icon" onClick={() => next(-1)} disabled={!items.length} aria-label="Previous track"><MusicIcon name="previous" /></button><button type="button" className="mova-music__icon mova-music__play" onClick={() => setPlaying(value => !value)} disabled={!items.length} aria-label={playing ? "Pause" : "Play"} aria-pressed={playing}><MusicIcon name={playing ? "pause" : "play"} filled={!playing} /></button><button type="button" className="mova-music__icon" onClick={() => next(1)} disabled={!items.length} aria-label="Next track"><MusicIcon name="next" /></button></div>
      <div className="mova-music__scrub"><time>{clock(progress)}</time><input type="range" min="0" max={duration} step="0.1" value={Math.min(progress, duration)} disabled={!current} onChange={event => seek(Number(event.target.value))} aria-label="Track position" aria-valuetext={`${clock(progress)} of ${clock(duration)}`} /><time>{clock(current ? duration : 0)}</time></div>
    </div>
    {current && <div className="mova-music__now"><button type="button" className="mova-music__now-track" onClick={() => engine.current?.center(current.id)} aria-label={`Locate ${current.title}`}><img src={current.image} alt="" /><span>{current.title}</span><MusicIcon name="locate" /></button><button ref={queueButton} type="button" className="mova-music__icon" onClick={() => setQueueOpen(value => !value)} aria-label="Play queue" aria-expanded={queueOpen} aria-controls={`${id}-queue`}><MusicIcon name="queue" /></button></div>}
    {queueOpen && <aside ref={queuePanel} id={`${id}-queue`} className="mova-music__queue" role="dialog" aria-modal="false" aria-labelledby={`${id}-queue-title`}><div className="mova-music__queue-head"><h3 id={`${id}-queue-title`}>Up next · {queue.length}</h3><button type="button" className="mova-music__icon" onClick={() => setQueueOpen(false)} aria-label="Close queue">×</button></div><div className="mova-music__queue-list">{queue.length ? queue.map(trackId => { const track = items.find(item => item.id === trackId); return track && <div className="mova-music__queue-row" key={trackId}><button type="button" className="mova-music__queue-song" onClick={() => { setQueue(value => value.filter(id => id !== trackId)); select(trackId); setQueueOpen(false); }}><img src={track.image} alt="" /><span>{track.title}<small>{track.artist}</small></span></button><button type="button" className="mova-music__icon" onClick={() => toggleQueued(trackId)} aria-label={`Remove ${track.title} from queue`}>×</button></div>; }) : <p className="mova-music__queue-empty">Your queue is empty. Add a track using the + on its card.</p>}</div></aside>}
    {status && <div className="mova-music__status" role="status">{status}</div>}
    <audio ref={audio} src={current?.src} preload="metadata" onTimeUpdate={event => { const value = event.currentTarget.currentTime; progressRef.current = value; setProgress(value); }} onEnded={() => transport.current.next(1)} onError={() => { setPlaying(false); setStatus("Audio is unavailable for this track."); }} />
    <span id={`${id}-help`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>Drag or scroll to explore. Focus the collection and use arrow keys to pan, Space to play or pause, Home to locate the current track, and Q for the queue. Escape closes the queue.</span>
    <span aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>{current ? `${current.title} by ${current.artist}${current.src ? "" : ". Local playback preview"}` : ""}</span>
  </section>;
}
