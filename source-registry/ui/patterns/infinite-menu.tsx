"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface InfiniteMenuItem {
  image: string;
  title?: string;
  description?: string;
  link?: string;
}

export interface InfiniteMenuProps {
  items?: InfiniteMenuItem[];
  count?: number;
  tileSize?: number;
  roundness?: number;
  zoom?: number;
  pullBack?: number;
  stretch?: number;
  inertia?: number;
  /** Seconds between automatic selections. Zero disables autoplay. */
  autoplay?: number;
  grayscale?: boolean;
  dim?: number;
  intro?: boolean;
  showInfo?: boolean;
  renderInfo?: (item: InfiniteMenuItem, index: number, moving: boolean) => ReactNode;
  theme?: "dark" | "light";
  accentColor?: string;
  backgroundColor?: string;
  onActiveChange?: (item: InfiniteMenuItem, index: number) => void;
  onItemClick?: (item: InfiniteMenuItem, index: number) => void;
  className?: string;
  style?: CSSProperties;
  height?: CSSProperties["height"];
  label?: string;
}

type Vector = [number, number, number];
type Quaternion = [number, number, number, number];
const bounded = (n: number, lo: number, hi: number, fallback: number) => Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
const perpendicular = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function turn(q: Quaternion, axis: Vector, angle: number): Quaternion {
  const length = Math.hypot(...axis);
  if (length < 1e-8 || !angle) return q;
  const half = angle / 2;
  const [x, y, z] = axis.map(value => value / length * Math.sin(half));
  const w = Math.cos(half);
  const result: Quaternion = [w * q[0] + x * q[3] + y * q[2] - z * q[1], w * q[1] - x * q[2] + y * q[3] + z * q[0], w * q[2] + x * q[1] - y * q[0] + z * q[3], w * q[3] - x * q[0] - y * q[1] - z * q[2]];
  const norm = Math.hypot(...result);
  return result.map(value => value / norm) as Quaternion;
}
function position(q: Quaternion, point: Vector): Vector {
  const imaginary: Vector = [q[0], q[1], q[2]];
  const first = perpendicular(imaginary, point);
  const second = perpendicular(imaginary, first);
  return point.map((value, i) => value + 2 * q[3] * first[i] + 2 * second[i]) as Vector;
}
function coordinates(total: number): Vector[] {
  return Array.from({ length: total }, (_, index) => {
    const y = 1 - 2 * (index + 0.5) / total;
    const radius = Math.sqrt(1 - y * y);
    const longitude = index * Math.PI * (3 - Math.sqrt(5));
    return [Math.cos(longitude) * radius, y, Math.sin(longitude) * radius];
  });
}

const menuStyles = `
.mova-infinite-menu{position:relative;overflow:hidden;isolation:isolate;container-type:inline-size;touch-action:none;outline:none;user-select:none;-webkit-user-select:none}
.mova-infinite-menu:focus-visible{outline:2px solid var(--mova-sphere-ink);outline-offset:-3px}
.mova-infinite-menu__scene{position:absolute;inset:0;z-index:0}
.mova-infinite-menu__tile{position:absolute;left:50%;top:50%;will-change:transform;transform-style:preserve-3d;overflow:hidden;backface-visibility:hidden;contain:layout paint;border-radius:var(--mova-sphere-roundness,10%);cursor:grab;background:#787878;border:0;padding:0}
.mova-infinite-menu__shade{position:absolute;inset:0;background:#000;will-change:opacity;pointer-events:none}
.mova-infinite-menu[data-grayscale=true] .mova-infinite-menu__tile img{filter:grayscale(1)}
.mova-infinite-menu[data-grayscale=true] .mova-infinite-menu__tile[data-focused=true] img{filter:none}
.mova-infinite-menu__tile:active{cursor:grabbing}.mova-infinite-menu__tile img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.mova-infinite-menu__info{position:absolute;inset:0;z-index:1;pointer-events:none;color:var(--mova-sphere-ink)}
.mova-infinite-menu__title,.mova-infinite-menu__description,.mova-infinite-menu__action{transition:opacity .25s,transform .35s cubic-bezier(.2,.7,.2,1)}
.mova-infinite-menu__title{position:absolute;top:50%;right:calc(50% + var(--mova-sphere-tile)/2 + 24px);max-width:calc(50% - var(--mova-sphere-tile)/2 - 40px);margin:0;transform:translateY(-50%);font-size:clamp(20px,3.5cqw,48px);line-height:1.05;letter-spacing:-.04em;text-align:right;text-wrap:balance}
.mova-infinite-menu__description{position:absolute;top:50%;left:calc(50% + var(--mova-sphere-tile)/2 + 24px);max-width:calc(50% - var(--mova-sphere-tile)/2 - 40px);margin:0;transform:translateY(-50%);font-size:clamp(12px,1.4cqw,16px);line-height:1.6;opacity:.7}
.mova-infinite-menu__action{position:absolute;bottom:7%;left:50%;transform:translateX(-50%);display:grid;place-items:center;width:52px;height:52px;border:1px solid currentColor;border-radius:50%;background:var(--mova-sphere-accent);color:var(--mova-sphere-accent-ink);pointer-events:auto;cursor:pointer;text-decoration:none;font-size:26px}
.mova-infinite-menu__action:focus-visible{outline:2px solid var(--mova-sphere-ink);outline-offset:4px}
.mova-infinite-menu__info[data-moving=true]{opacity:0;pointer-events:none}.mova-infinite-menu__info[data-moving=true] .mova-infinite-menu__action{visibility:hidden}
.mova-infinite-menu[data-stacked=true] .mova-infinite-menu__title{inset:auto 84px 52px 20px;max-width:none;text-align:left;transform:none;font-size:clamp(20px,5cqw,30px)}
.mova-infinite-menu[data-stacked=true] .mova-infinite-menu__description{inset:auto 84px 20px 20px;max-width:none;transform:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mova-infinite-menu[data-stacked=true] .mova-infinite-menu__action{inset:auto 20px 20px auto;transform:none}
@media(prefers-reduced-motion:reduce){.mova-infinite-menu *{transition:none!important}}
`;

/** A draggable spherical image menu with front snapping and keyboard navigation. */
export function InfiniteMenu({ items = [], count = 160, tileSize = .63, roundness = .2, zoom = 1.65, pullBack = 1, stretch = .6, inertia = .6, autoplay = 3, grayscale = true, dim = .5, intro = true, showInfo = true, renderInfo, theme = "dark", accentColor, backgroundColor, onActiveChange, onItemClick, className = "", style, height = "100%", label = "Infinite menu" }: InfiniteMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const engine = useRef<{ select: (index: number) => void; wake: () => void } | null>(null);
  const options = useRef({ tileSize, zoom, pullBack, stretch, inertia, autoplay, grayscale, dim, roundness, onActiveChange, onItemClick, items });
  options.current = { tileSize, zoom, pullBack, stretch, inertia, autoplay, grayscale, dim, roundness, onActiveChange, onItemClick, items };
  const [active, setActive] = useState(0);
  const [moving, setMoving] = useState(false);
  const instructions = useId();
  const total = bounded(Math.round(count), 6, 400, 160);
  const ink = theme === "light" ? "#151515" : "#fff";

  useEffect(() => {
    const host = root.current;
    const layer = scene.current;
    if (!host || !layer || !items.length) return;
    const tiles = Array.from(layer.children) as HTMLElement[];
    const points = coordinates(total);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = preference.matches;
    let orientation: Quaternion = [0, 0, 0, 1];
    let velocity: Vector = [0, intro && !reduce ? .9 : 0, 0];
    let width = 1, height = 1, frame = 0, previous = 0, selected = 0, target = 0;
    let timer = 0, previousTileSize = -1, previousRoundness = -1;
    let hover = false, focused = false, visible = true, alive = true, wasMoving = false;
    let camera = 0;
    let drag: { id: number; x: number; y: number; time: number; distance: number; tile: number; } | null = null;
    // Put the first item in front before the initial paint; later changes preserve orientation.
    orientation = turn(orientation, perpendicular(points[0], [0, 0, 1]), Math.acos(points[0][2]));
    const wake = () => { clearTimeout(timer); if (!frame && alive && visible) frame = requestAnimationFrame(draw); };
    const select = (index: number) => { target = ((index % total) + total) % total; velocity = [0, 0, 0]; wake(); };
    engine.current = { select, wake };
    const activate = (tile: number) => {
      const index = tile % options.current.items.length;
      const item = options.current.items[index];
      if (!item) return;
      if (options.current.onItemClick) options.current.onItemClick(item, index);
      else if (item.link && /^(https?:\/\/|\/|#|\.\.?\/)/i.test(item.link)) window.open(item.link, /^https?:/i.test(item.link) ? "_blank" : "_self", "noopener,noreferrer");
    };
    const draw = (time: number) => {
      frame = 0;
      if (!alive || !visible) return;
      const dt = previous ? Math.min((time - previous) / 1000, .05) : 1 / 60;
      previous = time;
      const props = options.current;
      if (host.dataset.grayscale !== String(props.grayscale)) host.dataset.grayscale = String(props.grayscale);
      const speed = Math.hypot(...velocity);
      if (!drag && speed > .0001 && !reduce) {
        const damping = 7 - 5.8 * bounded(props.inertia, 0, 1, .6);
        const fade = Math.exp(-damping * dt);
        orientation = turn(orientation, velocity, speed * (1 - fade) / damping);
        velocity = velocity.map(value => value * fade) as Vector;
      }
      const transformed = points.map(point => position(orientation, point));
      let front = 0;
      transformed.forEach((point, index) => { if (point[2] > transformed[front][2]) front = index; });
      if (target < 0 && !drag && speed < .5) target = front;
      const destination = transformed[target >= 0 ? target : front];
      const error = Math.acos(Math.max(-1, Math.min(1, destination[2])));
      if (target >= 0 && !drag && speed < .5 && error > .00001) {
        orientation = turn(orientation, perpendicular(destination, [0, 0, 1]), reduce ? error : error * (1 - Math.exp(-8 * dt)) * Math.max(0, 1 - speed * 2));
      }
      const isMoving = !!drag || speed > .06 || error > .008;
      if (isMoving !== wasMoving) { wasMoving = isMoving; setMoving(isMoving); }
      if (!isMoving && selected !== front) { selected = front; setActive(front % props.items.length); props.onActiveChange?.(props.items[front % props.items.length], front % props.items.length); }
      const radius = 2;
      const tileRadius = Math.sqrt(4 * Math.PI / total) * bounded(props.tileSize, .2, 1.2, .63);
      const lens = Math.min(width, height) * 1.55;
      const rest = radius + tileRadius * 1.55 / (.23 * bounded(props.zoom, .2, 4, 1.65));
      const desired = rest + bounded(props.pullBack, 0, 3, 1) * Math.min(1, speed / 1.4 + (drag ? .45 : 0)) * 1.6;
      if (!camera || reduce) camera = desired;
      camera += (desired - camera) * (1 - Math.exp(-5 * dt));
      const frontSize = 2 * tileRadius * lens / (rest - radius);
      if (Math.abs(frontSize - previousTileSize) > .05) { host.style.setProperty("--mova-sphere-tile", `${frontSize}px`); previousTileSize = frontSize; }
      const cornerRadius = bounded(props.roundness, 0, 1, .2);
      if (cornerRadius !== previousRoundness) { host.style.setProperty("--mova-sphere-roundness", `${cornerRadius * 50}%`); previousRoundness = cornerRadius; }
      const stacked = width / 2 - frontSize / 2 < 120;
      if (host.dataset.stacked !== String(stacked)) host.dataset.stacked = String(stacked);
      const yShift = stacked ? -Math.min(36, height * .07) : 0;
      for (let index = 0; index < points.length; index++) {
        const point = position(orientation, points[index]);
        const tile = tiles[index];
        const depth = camera - point[2] * radius;
        const scale = lens / depth;
        const size = tileRadius * 2 * scale;
        const opacity = Math.min(1, Math.max(0, (point[2] - .02) / .25));
        const x = point[0] * radius * scale;
        const y = -point[1] * radius * scale + yShift;
        const sweep = reduce ? 1 : 1 + Math.min(.7, speed * bounded(props.stretch, 0, 3, .6) * .12);
        // Include the rotated corners and motion stretch before rejecting offscreen tiles.
        const extent = size * .8 * sweep;
        const outside = x + extent < -width / 2 || x - extent > width / 2 || y + extent < -height / 2 || y - extent > height / 2;
        if (opacity <= .005 || outside) { if (tile.style.visibility !== "hidden") tile.style.visibility = "hidden"; continue; }
        if (tile.style.visibility !== "visible") tile.style.visibility = "visible";
        tile.style.opacity = String(opacity);
        tile.style.zIndex = String(Math.round(point[2] * 1000) + 1000);
        tile.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) rotateY(${Math.asin(point[0])}rad) rotateX(${Math.asin(point[1])}rad) scale(${size / 100}) scaleX(${sweep})`;
        const distance = 1 - Math.max(0, point[2]) ** 8;
        const focusedTile = !isMoving && index === front;
        if (tile.dataset.focused !== String(focusedTile)) tile.dataset.focused = String(focusedTile);
        (tile.children[1] as HTMLElement).style.opacity = String(bounded(props.dim, 0, 1, .5) * distance);
      }
      const busy = isMoving || Math.abs(camera - desired) > .001;
      if (busy) wake();
      else {
        previous = 0;
        const interval = bounded(props.autoplay, 0, 3600, 3);
        if (!hover && !focused && !reduce && interval > 0) timer = window.setTimeout(() => select((front + 1) % total), interval * 1000);
      }
    };
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest("a,button")) return;
      const tile = (event.target as Element).closest<HTMLElement>("[data-sphere-tile]");
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, distance: 0, tile: tile ? Number(tile.dataset.sphereTile) : -1 };
      host.setPointerCapture(event.pointerId);
      velocity = [0, 0, 0]; target = -1; wake();
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const x = event.clientX - drag.x, y = event.clientY - drag.y;
      const elapsed = Math.max(.008, (event.timeStamp - drag.time) / 1000);
      const unit = 2.8 / Math.min(width, height);
      const delta: Vector = [y * unit, x * unit, 0];
      orientation = turn(orientation, delta, Math.hypot(...delta));
      velocity = reduce ? [0, 0, 0] : delta.map((value, i) => velocity[i] * .3 + value / elapsed * .7) as Vector;
      drag.x = event.clientX; drag.y = event.clientY; drag.time = event.timeStamp; drag.distance += Math.hypot(x, y);
      wake();
    };
    const finish = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const ended = drag; drag = null;
      if (event.type === "pointerup" && ended.distance < 6 && ended.tile >= 0) { if (ended.tile === selected) activate(ended.tile); else select(ended.tile); }
      if (event.timeStamp - ended.time > 100 || event.type !== "pointerup") velocity = [0, 0, 0];
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
      wake();
    };
    const key = (event: KeyboardEvent) => {
      if (event.target !== host || event.altKey || event.ctrlKey || event.metaKey) return;
      const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      if (directions[event.key]) {
        event.preventDefault();
        const origin = position(orientation, points[target >= 0 ? target : selected]);
        const [dx, dy] = directions[event.key];
        let next = -1, score = Infinity;
        points.forEach((point, index) => {
          const value = position(orientation, point);
          const x = value[0] - origin[0], y = value[1] - origin[1];
          const forward = x * dx + y * dy;
          const metric = Math.hypot(x, y) + Math.abs(x * dy - y * dx) * 2;
          if (forward > .01 && value[2] > 0 && metric < score) { next = index; score = metric; }
        });
        if (next >= 0) select(next);
      } else if (event.key === "Home") { event.preventDefault(); select(0); }
      else if (event.key === "End") { event.preventDefault(); select(Math.min(total, options.current.items.length) - 1); }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(selected); }
    };
    const enter = () => { hover = true; clearTimeout(timer); }; const leave = () => { hover = false; wake(); };
    const focus = () => { focused = true; clearTimeout(timer); }; const blur = (event: FocusEvent) => { if (!host.contains(event.relatedTarget as Node)) { focused = false; wake(); } };
    const resize = () => { width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight); wake(); };
    const changePreference = () => { reduce = preference.matches; velocity = [0, 0, 0]; wake(); };
    const visibility = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); previous = 0; clearTimeout(timer); if (visible) wake(); });
    const observer = new ResizeObserver(resize); observer.observe(host); visibility.observe(host);
    host.addEventListener("pointerdown", down); host.addEventListener("pointermove", move); host.addEventListener("pointerup", finish); host.addEventListener("pointercancel", finish); host.addEventListener("lostpointercapture", finish); host.addEventListener("keydown", key); host.addEventListener("pointerenter", enter); host.addEventListener("pointerleave", leave); host.addEventListener("focusin", focus); host.addEventListener("focusout", blur); preference.addEventListener("change", changePreference);
    setActive(0); options.current.onActiveChange?.(options.current.items[0], 0); resize();
    return () => {
      alive = false; cancelAnimationFrame(frame); clearTimeout(timer); engine.current = null; observer.disconnect(); visibility.disconnect();
      host.removeEventListener("pointerdown", down); host.removeEventListener("pointermove", move); host.removeEventListener("pointerup", finish); host.removeEventListener("pointercancel", finish); host.removeEventListener("lostpointercapture", finish); host.removeEventListener("keydown", key); host.removeEventListener("pointerenter", enter); host.removeEventListener("pointerleave", leave); host.removeEventListener("focusin", focus); host.removeEventListener("focusout", blur); preference.removeEventListener("change", changePreference);
    };
  }, [total, items.length, intro]);
  useEffect(() => { engine.current?.wake(); });
  const current = items[active % items.length];
  const action = () => { if (current) onItemClick?.(current, active % items.length); };
  const safeLink = current?.link && /^(https?:\/\/|\/|#|\.\.?\/)/i.test(current.link) ? current.link : undefined;
  return <div ref={root} className={`mova-infinite-menu ${className}`} tabIndex={items.length ? 0 : undefined} role="group" aria-roledescription="carousel" aria-label={label} aria-describedby={instructions} style={{ width: "100%", height, minHeight: 240, background: backgroundColor ?? (theme === "light" ? "#f5f5f3" : "#080808"), "--mova-sphere-ink": ink, "--mova-sphere-accent": accentColor ?? ink, "--mova-sphere-accent-ink": theme === "light" ? "#fff" : "#111", ...style } as CSSProperties}>
    <style>{menuStyles}</style>
    <div ref={scene} className="mova-infinite-menu__scene" aria-hidden="true">{items.length ? Array.from({ length: total }, (_, index) => <div key={index} data-sphere-tile={index} className="mova-infinite-menu__tile" style={{ visibility: "hidden", width: 100, height: 100 }}><img src={items[index % items.length].image} alt="" draggable={false} /><span className="mova-infinite-menu__shade" /></div>) : null}</div>
    {!items.length && <p style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: ink }}>No items available</p>}
    {showInfo && current && (renderInfo ? <div className="mova-infinite-menu__info">{renderInfo(current, active % items.length, moving)}</div> : <div className="mova-infinite-menu__info" data-moving={moving}>
      {current.title && <h2 className="mova-infinite-menu__title">{current.title}</h2>}
      {current.description && <p className="mova-infinite-menu__description">{current.description}</p>}
      {(safeLink || onItemClick) && (safeLink ? <a className="mova-infinite-menu__action" href={safeLink} target={/^https?:/i.test(safeLink) ? "_blank" : undefined} rel="noopener noreferrer" onClick={action} aria-label={`Open ${current.title ?? "item"}`}>↗</a> : <button className="mova-infinite-menu__action" type="button" onClick={action} aria-label={`Open ${current.title ?? "item"}`}>↗</button>)}
    </div>)}
    <span id={instructions} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>Drag to rotate. Use arrow keys to choose an item, Home for the first item, and Enter to open.</span>
    <span aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>{current ? `${active % items.length + 1} of ${items.length}: ${current.title ?? "Image"}` : ""}</span>
  </div>;
}
