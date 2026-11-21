"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export interface InfiniteCardGridItem {
  id?: string;
  image: string;
  title: string;
  description?: string;
  link?: string;
}

export interface InfiniteCardGridProps {
  items?: InfiniteCardGridItem[];
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
  /** Zero stops on release; higher values preserve more drag momentum. */
  momentum?: number;
  height?: CSSProperties["height"];
  theme?: "dark" | "light";
  label?: string;
  className?: string;
  style?: CSSProperties;
  onItemClick?: (item: InfiniteCardGridItem, index: number) => void;
}

type Cell = { column: number; row: number; index: number; key: string };
type Selection = { item: InfiniteCardGridItem; index: number; key: string; x: number; y: number; width: number; height: number; trigger: HTMLButtonElement };
const finite = (value: number, minimum: number, maximum: number, fallback: number) => Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
const wrap = (value: number, period: number) => ((value % period) + period) % period;
const gridStyles = `
.mova-infinite-grid{position:relative;overflow:hidden;isolation:isolate;background:var(--mova-grid-background);color:var(--mova-grid-ink);outline:none}
.mova-infinite-grid:focus-visible{outline:2px solid currentColor;outline-offset:-3px}.mova-infinite-grid__plane{position:absolute;inset:0;cursor:grab;touch-action:none}.mova-infinite-grid[data-dragging=true] .mova-infinite-grid__plane{cursor:grabbing}
.mova-infinite-grid__card{position:absolute;left:0;top:0;overflow:hidden;border:0;padding:0;border-radius:12px;background:#ddd;cursor:inherit;text-align:left;will-change:transform;user-select:none;-webkit-user-select:none}
.mova-infinite-grid__card img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}.mova-infinite-grid__card:focus-visible{outline:3px solid #635bff;outline-offset:4px}
.mova-infinite-grid__shade{position:absolute;inset:0;background:linear-gradient(transparent 50%,#0009);opacity:0;transition:opacity .2s}.mova-infinite-grid__card:hover .mova-infinite-grid__shade,.mova-infinite-grid__card:focus-visible .mova-infinite-grid__shade{opacity:1}
.mova-infinite-grid__caption{position:absolute;bottom:16px;left:16px;right:16px;font-size:14px;font-weight:600;color:white}
.mova-infinite-grid__overlay{position:absolute;inset:0;z-index:2;display:grid;place-items:center;padding:24px;background:var(--mova-grid-overlay);backdrop-filter:blur(12px)}
.mova-infinite-grid__detail{position:relative;overflow:hidden;width:min(440px,100%);max-height:100%;overflow-y:auto;border-radius:16px;background:var(--mova-grid-surface);box-shadow:0 20px 80px #0002;outline:none}
.mova-infinite-grid__detail img{display:block;width:100%;height:clamp(120px,35cqh,280px);object-fit:cover}.mova-infinite-grid__copy{padding:24px}.mova-infinite-grid__copy h2{font-size:24px;line-height:1.2;letter-spacing:-.03em;margin:0 0 12px}.mova-infinite-grid__copy p{font-size:14px;line-height:1.6;color:var(--mova-grid-muted);margin:0}.mova-infinite-grid__copy a{display:inline-block;color:inherit;margin-top:16px;text-underline-offset:4px}
.mova-infinite-grid__close{position:absolute;top:12px;right:12px;width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:50%;background:#fff;color:#111;cursor:pointer;font-size:20px;box-shadow:0 2px 12px #0002}.mova-infinite-grid__close:focus-visible,.mova-infinite-grid__copy a:focus-visible{outline:2px solid #635bff;outline-offset:3px}
@media(prefers-reduced-motion:reduce){.mova-infinite-grid *{transition:none!important}}
`;

/** An endless, two-dimensional draggable gallery with a reversible detail view. */
export function InfiniteCardGrid({ items = [], cardWidth = 260, cardHeight = 180, gap = 28, momentum = .35, height = "100%", theme = "light", label = "Infinite card grid", className = "", style, onItemClick }: InfiniteCardGridProps) {
  const root = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const engine = useRef<{ pan: (x: number, y: number) => void; stop: () => void; refresh: () => void } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; distance: number; vx: number; vy: number } | null>(null);
  const blockedClick = useRef(false);
  const [size, setSize] = useState({ width: 1000, height: 600 });
  const [selected, setSelected] = useState<Selection | null>(null);
  const itemsRef = useRef(items); itemsRef.current = items;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const reduce = useReducedMotion() ?? false;
  const reducedRef = useRef(reduce); reducedRef.current = reduce;
  const momentumRef = useRef(momentum); momentumRef.current = momentum;
  const [dragging, setDragging] = useState(false);
  const id = useId();
  const width = finite(cardWidth, 80, 800, 260), tileHeight = finite(cardHeight, 60, 800, 180), spacing = finite(gap, 0, 200, 28);
  const xStep = width + spacing, yStep = tileHeight + spacing;
  const columns = Math.ceil(size.width / xStep) + 2;
  const rows = Math.ceil(size.height / yStep) + 2;
  const cells: Cell[] = items.length ? Array.from({ length: columns * rows }, (_, index) => ({ column: index % columns, row: Math.floor(index / columns), index: index % items.length, key: `${index % columns}:${Math.floor(index / columns)}` })) : [];

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const observer = new ResizeObserver(() => setSize({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) }));
    observer.observe(host); setSize({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const layer = plane.current;
    if (!layer || !items.length) return;
    const elements = Array.from(layer.children) as HTMLElement[];
    let offset = { x: -width / 2, y: -tileHeight / 2 }, velocity = { x: 0, y: 0 }, frame = 0, last = 0;
    let visible = true;
    const paint = () => {
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index], element = elements[index];
        const x = wrap(cell.column * xStep + offset.x + xStep, columns * xStep) - xStep;
        const y = wrap(cell.row * yStep + offset.y + yStep, rows * yStep) - yStep;
        const worldColumn = cell.column - Math.floor((cell.column * xStep + offset.x + xStep) / (columns * xStep)) * columns;
        const worldRow = cell.row - Math.floor((cell.row * yStep + offset.y + yStep) / (rows * yStep)) * rows;
        const itemIndex = wrap(worldRow * columns + worldColumn, itemsRef.current.length);
        const item = itemsRef.current[itemIndex];
        const image = element.querySelector("img");
        const caption = element.querySelector(".mova-infinite-grid__caption");
        // React may have committed new JSX content since the last recycled paint.
        if (element.dataset.itemIndex !== String(itemIndex) || image?.getAttribute("src") !== item.image || caption?.textContent !== item.title || element.getAttribute("aria-label") !== `Open ${item.title}`) {
          element.dataset.itemIndex = String(itemIndex);
          element.setAttribute("aria-label", `Open ${item.title}`);
          if (image) image.src = item.image;
          if (caption) caption.textContent = item.title;
        }
        element.style.transform = `translate3d(${x}px,${y}px,0)`;
        element.tabIndex = x + width > 0 && y + tileHeight > 0 && x < size.width && y < size.height ? 0 : -1;
        element.dataset.x = String(x); element.dataset.y = String(y);
      }
    };
    const tick = (time: number) => {
      frame = 0;
      if (!visible) return;
      const dt = last ? Math.min(.05, (time - last) / 1000) : 1 / 60; last = time;
      if (!drag.current && !selectedRef.current && !reducedRef.current) {
        const damping = 18 - finite(momentumRef.current, 0, 1, .35) * 16;
        const fade = Math.exp(-damping * dt);
        offset.x += velocity.x * (1 - fade) / damping; offset.y += velocity.y * (1 - fade) / damping;
        velocity.x *= fade; velocity.y *= fade;
      }
      paint();
      if (Math.hypot(velocity.x, velocity.y) > 2 && !drag.current && !selectedRef.current && !reducedRef.current) frame = requestAnimationFrame(tick);
      else last = 0;
    };
    const wake = () => { if (!frame && visible) frame = requestAnimationFrame(tick); };
    engine.current = { refresh: paint, pan: (x, y) => { offset.x += x; offset.y += y; velocity = { x: 0, y: 0 }; paint(); }, stop: () => { velocity = { x: 0, y: 0 }; } };
    const release = (event: globalThis.PointerEvent) => {
      if (!drag.current || drag.current.id !== event.pointerId) return;
      const ended = drag.current; drag.current = null; setDragging(false);
      blockedClick.current = ended.distance > 5;
      if (!reducedRef.current && momentumRef.current > 0 && event.type === "pointerup" && event.timeStamp - ended.t < 100) velocity = { x: ended.vx, y: ended.vy };
      last = event.timeStamp;
      if (root.current?.hasPointerCapture(event.pointerId)) root.current.releasePointerCapture(event.pointerId);
      wake();
    };
    const move = (event: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      const x = event.clientX - current.x, y = event.clientY - current.y;
      const dt = Math.max(.008, (event.timeStamp - current.t) / 1000);
      current.vx = current.vx * .25 + x / dt * .75; current.vy = current.vy * .25 + y / dt * .75;
      current.distance += Math.hypot(x, y); current.x = event.clientX; current.y = event.clientY; current.t = event.timeStamp;
      offset.x += x; offset.y += y;
      if (current.distance > 5) { setDragging(true); root.current?.setPointerCapture(event.pointerId); }
      paint();
    };
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); last = 0; if (visible) wake(); });
    observer.observe(layer);
    // Capture is held on the root after the drag threshold, so release/move must also reach it.
    const host = root.current;
    host?.addEventListener("pointermove", move); host?.addEventListener("pointerup", release); host?.addEventListener("pointercancel", release); host?.addEventListener("lostpointercapture", release); window.addEventListener("pointerup", release); window.addEventListener("pointercancel", release);
    paint();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); engine.current = null; host?.removeEventListener("pointermove", move); host?.removeEventListener("pointerup", release); host?.removeEventListener("pointercancel", release); host?.removeEventListener("lostpointercapture", release); window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); };
  }, [columns, rows, size.width, size.height, width, tileHeight, spacing, items.length]);

  useEffect(() => {
    if (!selected) return;
    const node = detail.current;
    const focusedBefore = document.activeElement as HTMLElement | null;
    node?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { if (selected.trigger.isConnected) selected.trigger.focus({ preventScroll: true }); else focusedBefore?.focus({ preventScroll: true }); };
  }, [selected]);
  useEffect(() => { if (reduce) engine.current?.stop(); }, [reduce]);
  useEffect(() => { engine.current?.refresh(); }, [items]);

  const close = () => setSelected(null);
  const open = (event: React.MouseEvent<HTMLButtonElement>, cell: Cell) => {
    if (blockedClick.current && event.detail !== 0) { blockedClick.current = false; return; }
    engine.current?.stop();
    const trigger = event.currentTarget, rect = trigger.getBoundingClientRect(), bounds = root.current!.getBoundingClientRect();
    const itemIndex = Number(trigger.dataset.itemIndex ?? cell.index);
    const item = items[itemIndex];
    setSelected({ item, index: itemIndex, key: cell.key, x: rect.x - bounds.x, y: rect.y - bounds.y, width: rect.width, height: rect.height, trigger });
    onItemClick?.(item, itemIndex);
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || selected) return;
    blockedClick.current = false; engine.current?.stop();
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, distance: 0, vx: 0, vy: 0 };
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (selected) {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const nodes = Array.from(detail.current?.querySelectorAll<HTMLElement>("button,a[href]") ?? []);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [xStep, 0], ArrowRight: [-xStep, 0], ArrowUp: [0, yStep], ArrowDown: [0, -yStep] };
    if (directions[event.key]) { event.preventDefault(); engine.current?.pan(...directions[event.key]); }
  };
  const selectedWidth = Math.min(440, size.width - 48);
  const centerX = size.width / 2 - (selected?.x ?? 0) - (selected?.width ?? width) / 2;
  const centerY = size.height / 2 - (selected?.y ?? 0) - (selected?.height ?? tileHeight) / 2;
  const safeLink = selected?.item.link && /^(https?:\/\/|\/|#|\.\.?\/)/i.test(selected.item.link) ? selected.item.link : undefined;
  return <div ref={root} className={`mova-infinite-grid ${className}`} data-theme={theme} data-dragging={dragging} tabIndex={items.length ? 0 : undefined} role="region" aria-label={label} aria-describedby={`${id}-help`} onKeyDown={keyDown} style={{ width: "100%", height, minHeight: 240, containerType: "size", "--mova-grid-background": theme === "dark" ? "#101010" : "#f5f5f3", "--mova-grid-ink": theme === "dark" ? "#fafafa" : "#171717", "--mova-grid-overlay": theme === "dark" ? "#101010cc" : "#f5f5f3cc", "--mova-grid-surface": theme === "dark" ? "#202020" : "#fff", "--mova-grid-muted": theme === "dark" ? "#aaa" : "#666", ...style } as CSSProperties}>
    <style>{gridStyles}</style>
    <div ref={plane} className="mova-infinite-grid__plane" onPointerDown={pointerDown} onDragStart={event => event.preventDefault()} inert={selected ? true : undefined}>
      {cells.map(cell => <button key={cell.key} type="button" className="mova-infinite-grid__card" aria-label={`Open ${items[cell.index].title}`} onClick={event => open(event, cell)} onFocus={event => {
        const node = event.currentTarget;
        if (!node.matches(":focus-visible")) return;
        const x = Number(node.dataset.x), y = Number(node.dataset.y);
        const dx = width > size.width ? size.width / 2 - x - width / 2 : x < 0 ? -x : x + width > size.width ? size.width - x - width : 0;
        const dy = tileHeight > size.height ? size.height / 2 - y - tileHeight / 2 : y < 0 ? -y : y + tileHeight > size.height ? size.height - y - tileHeight : 0;
        engine.current?.pan(dx, dy);
      }} style={{ width, height: tileHeight, visibility: selected?.key === cell.key ? "hidden" : undefined }}><img src={items[cell.index].image} alt="" draggable={false} /><span className="mova-infinite-grid__shade"><span className="mova-infinite-grid__caption">{items[cell.index].title}</span></span></button>)}
    </div>
    {!items.length && <p style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>No cards available</p>}
    <AnimatePresence>
      {selected && <motion.div className="mova-infinite-grid__overlay" key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
        <motion.div ref={detail} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} tabIndex={-1} className="mova-infinite-grid__detail" initial={reduce ? false : { x: -centerX, y: -centerY, scale: width / selectedWidth }} animate={{ x: 0, y: 0, scale: 1 }} exit={reduce ? { opacity: 0 } : { x: -centerX, y: -centerY, scale: width / selectedWidth, opacity: 0 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}>
          <img src={selected.item.image} alt={selected.item.title} /><button className="mova-infinite-grid__close" type="button" onClick={close} aria-label="Close card">×</button>
          <div className="mova-infinite-grid__copy"><h2 id={`${id}-title`}>{selected.item.title}</h2>{selected.item.description && <p>{selected.item.description}</p>}{safeLink && <a href={safeLink} target={/^https?:/i.test(safeLink) ? "_blank" : undefined} rel="noopener noreferrer">View project ↗</a>}</div>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
    <span id={`${id}-help`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>Drag in any direction, or focus the grid and use the arrow keys to pan. Tab to a card and press Enter to open it. Escape closes details.</span>
  </div>;
}
