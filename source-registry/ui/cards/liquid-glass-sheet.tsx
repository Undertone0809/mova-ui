"use client";

/** Original Mova implementation; visual reference documented in docs/provenance/interactive-cards.md. */
import * as React from "react";

export interface LiquidGlassSheetProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  link?: string;
  linkLabel?: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaveChange?: (saved: boolean) => void;
  /** Reserved for applications that previously supplied this callback. */
  onPlay?: () => void;
  onShare?: () => void;
  theme?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
}

const FOREST_IMAGE = "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?auto=format&fit=crop&q=80&w=800";
const DEFAULT_LINK = "https://liquid-glass-react-studio.vercel.app/components";

/* The red and green channels encode the surface normal of a rounded pane.
 * Its narrow curved rim bends the backdrop more strongly than its flat face. */
function refractionMap(width: number, height: number, radius: number, depth: number) {
  const resolution = Math.min(1, 280 / Math.max(width, height));
  const w = Math.max(8, Math.round(width * resolution));
  const h = Math.max(8, Math.round(height * resolution));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const pixels = context.createImageData(w, h);
  const halfW = w / 2, halfH = h / 2;
  const corner = Math.min(radius * resolution, halfW - 1, halfH - 1);
  const rimWidth = Math.max(3, (4 + depth / 100 * Math.min(w, h) * .42) * resolution);
  const distance = (x: number, y: number) => {
    const qx = Math.abs(x) - halfW + corner;
    const qy = Math.abs(y) - halfH + corner;
    return Math.hypot(Math.max(0, qx), Math.max(0, qy)) + Math.min(0, Math.max(qx, qy)) - corner;
  };
  for (let index = 0; index < w * h; index++) {
    const x = index % w + .5 - halfW;
    const y = Math.floor(index / w) + .5 - halfH;
    const d = distance(x, y);
    let red = 128, green = 128;
    if (d <= .5) {
      const edge = Math.pow(1 - Math.min(1, Math.max(0, -d) / rimWidth), .72);
      const curved = edge * edge * (3 - 2 * edge);
      const dx = distance(x + 1, y) - distance(x - 1, y);
      const dy = distance(x, y + 1) - distance(x, y - 1);
      const length = Math.hypot(dx, dy) || 1;
      const face = .18 * (1 - curved);
      red = Math.round(128 + 127 * (dx / length * curved + x / halfW * face));
      green = Math.round(128 + 127 * (dy / length * curved + y / halfH * face));
    }
    pixels.data.set([Math.max(0, Math.min(255, red)), Math.max(0, Math.min(255, green)), 128, 255], index * 4);
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

function GlassMaterial({ id, width, height, radius, depth, refraction, dispersion, liquidity }: {
  id: string; width: number; height: number; radius: number; depth: number;
  refraction: number; dispersion: number; liquidity: number;
}) {
  const [map, setMap] = React.useState("");
  React.useEffect(() => { setMap(refractionMap(width, height, radius, depth)); }, [width, height, radius, depth]);
  const bend = refraction / 100 * .36;
  const spread = bend * dispersion / 100 * .4;
  const wobble = liquidity / 100 * .06;
  const channelMap = wobble > .002 ? "warped" : "normal";
  return <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
    <filter id={id} x="-.08" y="-.08" width="1.16" height="1.16" filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
      {map && <>
        <feImage href={map} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="normal" />
        {wobble > .002 && <><feTurbulence type="fractalNoise" baseFrequency=".012 .016" numOctaves={1} seed={7} result="noise" /><feDisplacementMap in="normal" in2="noise" scale={wobble} xChannelSelector="R" yChannelSelector="G" result="warped" /></>}
        <feDisplacementMap in="SourceGraphic" in2={channelMap} scale={Math.max(0, bend - spread)} xChannelSelector="R" yChannelSelector="G" result="red" />
        <feColorMatrix in="red" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="redOnly" />
        <feDisplacementMap in="SourceGraphic" in2={channelMap} scale={bend} xChannelSelector="R" yChannelSelector="G" result="green" />
        <feColorMatrix in="green" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="greenOnly" />
        <feDisplacementMap in="SourceGraphic" in2={channelMap} scale={bend + spread * 1.15} xChannelSelector="R" yChannelSelector="G" result="blue" />
        <feColorMatrix in="blue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blueOnly" />
        <feComposite in="redOnly" in2="greenOnly" operator="arithmetic" k2="1" k3="1" result="redGreen" />
        <feComposite in="redGreen" in2="blueOnly" operator="arithmetic" k2="1" k3="1" />
      </>}
    </filter>
  </svg>;
}

function Icon({ kind, className = "", strokeWidth = 2.25, draw = false }: { kind: "share" | "save" | "check" | "globe" | "copy"; className?: string; strokeWidth?: number; draw?: boolean }) {
  const paths = {
    share: "M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z",
    save: "M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z",
    check: "M5.25 12.7033 9.40385 17.37 18.75 6.87",
    globe: "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
    copy: "M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75",
  };
  return <svg className={`mgs-icon ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} aria-hidden="true"><path className={draw ? "mgs-tick" : undefined} pathLength={kind === "check" ? 1 : undefined} d={paths[kind]} /></svg>;
}

async function copyText(text: string) {
  // Synchronous selection also works in embedded previews without Clipboard API permission.
  const previous = document.activeElement as HTMLElement | null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  Object.assign(textarea.style, { position: "fixed", top: "0", left: "0", opacity: "0", pointerEvents: "none" });
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { /* Try the modern API below. */ }
  textarea.remove();
  previous?.focus({ preventScroll: true });
  if (copied) return true;
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function LiquidGlassSheet({ title = "Autumn forest", subtitle = "Liquid glass sheet", backgroundImage = FOREST_IMAGE, link = DEFAULT_LINK, linkLabel = "liquid-glass-react-studio", defaultOpen = true, onOpenChange, onSaveChange, onShare, theme = "light", className = "", style }: LiquidGlassSheetProps = {}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [mounted, setMounted] = React.useState(defaultOpen);
  const [saved, setSaved] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "copied" | "failed">("idle");
  const [touched, setTouched] = React.useState(false);
  const [highlight, setHighlight] = React.useState<number | null>(null);
  const [drag, setDrag] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  const dragStart = React.useRef<number | null>(null);
  const dragOffset = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frames = React.useRef<number[]>([]);
  const attempt = React.useRef(0);
  const id = `mgs-${React.useId().replace(/:/g, "")}`;
  const wasOpened = React.useRef(false);
  React.useEffect(() => {
    if (open && wasOpened.current) list.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    wasOpened.current = true;
  }, [open]);
  React.useEffect(() => () => { clearTimeout(timer.current); clearTimeout(closeTimer.current); frames.current.forEach(cancelAnimationFrame); attempt.current++; }, []);
  function changeOpen(next: boolean) {
    if (next === open) return;
    clearTimeout(closeTimer.current);
    if (next) { setMounted(true); setClosing(false); }
    else { setClosing(true); setHighlight(null); closeTimer.current = setTimeout(() => { setMounted(false); setClosing(false); }, 350); }
    setOpen(next); setDrag(0); dragOffset.current = 0; dragStart.current = null; setDragging(false);
    onOpenChange?.(next);
    if (!next) requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }
  async function copy() {
    const current = ++attempt.current;
    clearTimeout(timer.current);
    frames.current.forEach(cancelAnimationFrame);
    const copied = await copyText(link);
    if (current !== attempt.current) return;
    setTouched(true); setStatus("idle");
    frames.current = [requestAnimationFrame(() => {
      frames.current.push(requestAnimationFrame(() => {
        if (current !== attempt.current) return;
        setStatus(copied ? "copied" : "failed");
        timer.current = setTimeout(() => setStatus("idle"), copied ? 1800 : 1400);
      }));
    })];
  }
  function keys(event: React.KeyboardEvent<HTMLElement>) {
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); changeOpen(false); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();
    buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  }
  function endDrag(cancelled = false) {
    if (dragStart.current === null) return;
    dragStart.current = null; setDragging(false);
    if (!cancelled && dragOffset.current > 90) changeOpen(false);
    dragOffset.current = 0; setDrag(0);
  }
  const copied = status === "copied", failed = status === "failed";
  const filterStyle = { "--mgs-pane-filter": `url(#${id}-pane)`, "--mgs-trigger-filter": `url(#${id}-trigger)` } as React.CSSProperties;
  return <section className={`mova-glass-sheet${open ? " is-open" : ""} ${className}`} data-theme={theme} onKeyDown={keys} style={{ ...filterStyle, backgroundImage: `url(${JSON.stringify(backgroundImage)})`, ...style }} aria-label={title}>
    <style>{css}</style>
    <GlassMaterial id={`${id}-pane`} width={304} height={244} radius={28} depth={30} refraction={78} dispersion={42} liquidity={6} />
    <GlassMaterial id={`${id}-trigger`} width={132} height={44} radius={22} depth={26} refraction={60} dispersion={30} liquidity={4} />
    <div className={`mgs-scrim mgs-t-modal${open ? " is-open" : ""}${closing ? " is-closing" : ""}`} onClick={() => changeOpen(false)} aria-hidden="true" />
    <button type="button" className="mgs-trigger" ref={trigger} aria-label="Open sheet" aria-expanded={open} aria-controls={`${id}-sheet`} aria-hidden={open} tabIndex={open ? -1 : 0} onClick={() => changeOpen(true)}><span>Open sheet</span></button>
    <div className={`mgs-sheet${dragging ? " is-dragging" : ""}`} role="dialog" aria-labelledby={`${id}-title`} aria-hidden={!open} inert={!open} id={`${id}-sheet`} style={{ "--drag": `${drag}px` } as React.CSSProperties}>
      <div className="mgs-glass" data-open={open} />
      <div className="mgs-t-panel-slide mgs-panel" data-open={open}>
        {mounted && <div className="mgs-body">
          <button type="button" className="mgs-grab" aria-label="Drag down to close" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); dragStart.current = event.clientY; setDragging(true); }} onPointerMove={event => {
            if (dragStart.current === null) return;
            const delta = event.clientY - dragStart.current;
            dragOffset.current = delta >= 0 ? delta : -Math.pow(-delta, .6) * 2;
            setDrag(dragOffset.current);
          }} onPointerUp={() => endDrag()} onPointerCancel={() => endDrag(true)} onClick={event => { if (event.detail === 0) changeOpen(false); }}><span /></button>
          <header className="mgs-head"><h2 id={`${id}-title`} className="mgs-title">{title}</h2><p className="mgs-meta">{subtitle}</p></header>
          <div className="mgs-list" ref={list} onMouseLeave={() => setHighlight(null)}>
            <span className="mgs-hl" style={{ transform: `translateY(${(highlight ?? 0) * 44}px)`, opacity: highlight === null ? 0 : 1 }} />
            <button type="button" className="mgs-row" onMouseEnter={() => setHighlight(0)} onFocus={() => setHighlight(0)} onBlur={() => setHighlight(null)} onClick={() => { onShare?.(); changeOpen(false); }}><Icon kind="share" /><span className="mgs-label">Share</span></button>
            <button type="button" className={`mgs-row${saved ? " mgs-saved" : ""}`} aria-pressed={saved} onMouseEnter={() => setHighlight(1)} onFocus={() => setHighlight(1)} onBlur={() => setHighlight(null)} onClick={() => { setSaved(!saved); onSaveChange?.(!saved); }}><span className="mgs-slot"><Icon kind="save" className="mgs-icon-a" /><Icon kind="check" className="mgs-icon-b" strokeWidth={3} /></span><span className="mgs-label">{saved ? "Saved" : "Save"}</span></button>
            <div className={`mgs-linkrow${copied ? " is-copied" : ""}${failed ? " is-failed" : ""}`} onMouseEnter={() => setHighlight(2)} onFocus={() => setHighlight(2)} onBlur={() => setHighlight(null)}>
              <button type="button" className="mgs-row mgs-linkmain" aria-label={copied ? "Link copied" : failed ? "Copy blocked" : "Copy link"} onClick={() => void copy()}><span className="mgs-slot"><Icon kind="globe" className="mgs-icon-a" /><Icon kind="check" className="mgs-icon-b" strokeWidth={3} draw /></span><span key={status} className={`mgs-label${touched ? " mgs-label-anim" : ""}`}>{copied ? "Link copied" : failed ? "Copy blocked" : linkLabel}</span></button>
              <button type="button" className="mgs-copy" aria-label="Copy link" onClick={() => void copy()}><Icon kind="copy" /></button>
            </div>
          </div>
        </div>}
      </div>
    </div>
    <span className="mgs-status" role="status" aria-live="polite">{copied ? "Link copied" : failed ? "Copy blocked" : ""}</span>
  </section>;
}

const css = `
.mova-glass-sheet{
  --panel-open-dur: 400ms;
  --panel-close-dur: 350ms;
  --panel-translate-y: 100px;
  --panel-blur: 2px;
  --panel-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --modal-open-dur: 250ms;
  --modal-close-dur: 150ms;
  --modal-scale: 0.96;
  --modal-scale-close: 0.96;
  --modal-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --scrim-dur:150ms;
  --hl-dur:250ms;
  --hl-ease:cubic-bezier(0.22,1,0.36,1);
  --icon-dur:250ms;
  --press-scale:0.97;
  --press-dur:150ms;
  --ease-smooth-out:cubic-bezier(0.22,1,0.36,1);
  --ease-spring:cubic-bezier(0.34, 1.56, 0.64, 1);
  --mgs-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --mgs-ease-liquid: cubic-bezier(0.16, 1, 0.3, 1);
  --mgs-press: 160ms;
}

.mova-glass-sheet{position:relative;box-sizing:border-box;width:320px;max-width:100%;height:360px;font:400 13px/20px Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;border-radius:24px;overflow:hidden;background-size:cover;background-position:center;box-shadow:0 0 0 1px rgba(0,0,0,.04),0 8px 32px -4px rgba(0,0,0,.06),0 1px 3px 0 rgba(0,0,0,.04);color:#fff}
.mova-glass-sheet :is(button,a){font:inherit;color:inherit;text-decoration:none}
.mova-glass-sheet :where(button){border:0;background:none;padding:0;cursor:pointer}
.mgs-scrim{position:absolute;inset:0;background:rgba(0,0,0,.28)}

/* ───────── Compact iOS 26 glass trigger (44px full-round capsule) ───────── */
.mova-glass-sheet .mgs-trigger{
  position:absolute;
  left:50%;
  bottom:28px;
  translate:-50% 0;
  isolation:isolate;
  overflow:hidden;
  box-sizing:border-box;
  width:auto;
  height:44px;
  padding:0 22px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  white-space:nowrap;
  color:#fff;
  font-size:15px;
  line-height:20px;
  font-weight:600;
  letter-spacing:-0.01em;
  text-shadow:0 1px 2px rgb(0 0 0 / 0.25);
  background:rgb(255 255 255 / 0.10);
  -webkit-backdrop-filter:var(--mgs-trigger-filter) blur(2px) saturate(170%);
  backdrop-filter:var(--mgs-trigger-filter) blur(2px) saturate(170%);
  box-shadow:
    inset 1.5px 1.5px 0.5px -0.5px rgb(255 255 255 / 0.12),
    inset -1px -1px 0.5px -0.5px rgb(255 255 255 / 0.04),
    inset 0 0 0 1px rgb(255 255 255 / 0.18),
    0 0 0 0.5px rgb(255 255 255 / 0.22),
    0 8px 24px rgb(0 0 0 / 0.18);
  transition:
    transform 380ms var(--ease-spring),
    box-shadow var(--mgs-press) var(--mgs-ease-out),
    opacity var(--scrim-dur) var(--ease-smooth-out);
}
.mgs-trigger::before{
  content:"";
  position:absolute;
  inset:0;
  z-index:-1;
  border-radius:inherit;
  pointer-events:none;
  background:radial-gradient(70% 55% at 69.8% 30.2%, rgb(255 255 255 / 0.035) 0%, transparent 46%);
  mix-blend-mode:plus-lighter;
  opacity:0;
  transition:opacity 240ms var(--mgs-ease-out);
}
.mgs-trigger:hover::before{opacity:1}
.mgs-trigger::after{
  content:"";
  position:absolute;
  inset:0;
  z-index:-1;
  border-radius:inherit;
  pointer-events:none;
  background:radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.95) 0%, rgb(255 255 255 / 0.48) 22%, rgb(255 255 255 / 0.1) 48%, transparent 65%);
  mix-blend-mode:plus-lighter;
  opacity:0;
  transform:scale(0.65);
  transition:opacity var(--mgs-press) var(--mgs-ease-out), transform var(--mgs-press) var(--mgs-ease-out);
}
.mgs-trigger:active{transform:scale(0.94)}
.mgs-trigger:active::before{opacity:1}
.mgs-trigger:active::after{opacity:0.110;transform:scale(1)}
.mova-glass-sheet.is-open .mgs-trigger{opacity:0;pointer-events:none}

@supports not (backdrop-filter: url(#mgs-filter)){
  .mova-glass-sheet .mgs-trigger{
    -webkit-backdrop-filter:blur(25px) saturate(160%) brightness(1.06);
    backdrop-filter:blur(25px) saturate(160%) brightness(1.06);
    background:linear-gradient(145deg, rgb(255 255 255 / 0.015) 0%, rgb(255 255 255 / 0.004) 45%, rgb(255 255 255 / 0.096) 100%);
    box-shadow:
      inset 2px 2px 1px -0.5px rgb(255 255 255 / 0.066),
      inset -1.5px -1.5px 1px -0.5px rgb(255 255 255 / 0.025),
      inset 0 0 0 1.2px rgb(255 255 255 / 0.224),
      0 20px 48px rgb(0 0 0 / 0.24);
  }
  .mgs-trigger::before{opacity:0.75}
}
@media (prefers-reduced-transparency: reduce){
  .mova-glass-sheet .mgs-trigger{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgb(255 255 255 / 0.88);color:#111;text-shadow:none}
}

/* ───────── Sheet ───────── */
.mgs-sheet{position:absolute;left:8px;right:8px;bottom:8px;height:244px;border-radius:28px;transform:translateY(var(--drag,0px));transition:transform var(--panel-open-dur) var(--panel-ease);touch-action:none;pointer-events:none}
.mova-glass-sheet.is-open .mgs-sheet{pointer-events:auto}
.mgs-panel{position:absolute;inset:0}
.mgs-sheet.is-dragging{transition:none!important}

/* ───────── REAL LIQUID GLASS MATERIAL ───────── */
.mgs-glass{
  position:absolute;
  inset:0;
  isolation:isolate;
  overflow:hidden;
  border-radius:28px;
  corner-shape:squircle;
  pointer-events:none;
  background:rgb(255 255 255 / 0.080);
  -webkit-backdrop-filter:var(--mgs-pane-filter) blur(3px) saturate(160%);
  backdrop-filter:var(--mgs-pane-filter) blur(3px) saturate(160%);
  box-shadow:
    inset 1.5px 1.5px 0.5px -0.5px rgb(255 255 255 / 0.055),
    inset -1px -1px 0.5px -0.5px rgb(255 255 255 / 0.018),
    inset 0 0 0 1.2px rgb(255 255 255 / 0.140),
    0 0 0 0.5px rgb(255 255 255 / 0.22),
    0 18px 40px rgb(0 0 0 / 0.2);
  transform:translateY(var(--panel-translate-y));
  opacity:0;
  transition:
    transform var(--panel-close-dur) var(--panel-ease),
    opacity var(--panel-close-dur) var(--panel-ease),
    box-shadow var(--mgs-press) var(--mgs-ease-out);
}
.mgs-glass[data-open="true"]{
  transform:none;
  opacity:1;
  transition:
    transform var(--panel-open-dur) var(--panel-ease),
    opacity var(--panel-open-dur) var(--panel-ease),
    box-shadow var(--mgs-press) var(--mgs-ease-out);
}
.mgs-glass::before{
  content:"";
  position:absolute;
  inset:0;
  z-index:-1;
  border-radius:inherit;
  pointer-events:none;
  background:radial-gradient(70% 55% at 69.8% 30.2%, rgb(255 255 255 / 0.035) 0%, transparent 46%);
  mix-blend-mode:plus-lighter;
  opacity:0;
  transition:opacity 240ms var(--mgs-ease-out);
}
.mgs-sheet:hover .mgs-glass::before{opacity:1}
.mgs-glass::after{
  content:"";
  position:absolute;
  inset:0;
  z-index:-1;
  border-radius:inherit;
  pointer-events:none;
  background:radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.95) 0%, rgb(255 255 255 / 0.48) 22%, rgb(255 255 255 / 0.1) 48%, transparent 65%);
  mix-blend-mode:plus-lighter;
  opacity:0;
  transform:scale(0.65);
  transition:opacity var(--mgs-press) var(--mgs-ease-out), transform var(--mgs-press) var(--mgs-ease-out);
}
.mgs-sheet:active .mgs-glass::before{opacity:1}
.mgs-sheet:active .mgs-glass::after{opacity:0.110;transform:scale(1)}

@supports not (backdrop-filter: url(#mgs-filter)){
  .mgs-glass{
    -webkit-backdrop-filter:blur(25px) saturate(160%) brightness(1.06);
    backdrop-filter:blur(25px) saturate(160%) brightness(1.06);
    background:linear-gradient(145deg, rgb(255 255 255 / 0.015) 0%, rgb(255 255 255 / 0.004) 45%, rgb(255 255 255 / 0.096) 100%);
    box-shadow:
      inset 2px 2px 1px -0.5px rgb(255 255 255 / 0.066),
      inset -1.5px -1.5px 1px -0.5px rgb(255 255 255 / 0.025),
      inset 0 0 0 1.2px rgb(255 255 255 / 0.224),
      0 20px 48px rgb(0 0 0 / 0.24);
  }
  .mgs-glass::before{opacity:0.75}
}
@media (prefers-reduced-transparency: reduce){
  .mgs-glass{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgb(255 255 255 / 0.88)}
}

/* ───────── Body / grabber / header ───────── */
.mgs-body{position:relative;padding:0 8px 8px}
.mgs-grab{display:flex;justify-content:center;width:100%;height:24px;align-items:center;cursor:grab;touch-action:none}
.mgs-grab:is(:active,.is-pressed){cursor:grabbing}
.mgs-grab span{width:36px;height:5px;border-radius:5px;background:rgba(255,255,255,.7)}
.mgs-head{padding:0 12px 8px}
.mgs-title{margin:0;font-size:16px;line-height:22px;font-weight:500}
.mgs-meta{margin:0;font-size:12px;line-height:16px;color:rgba(255,255,255,.85)}

/* ───────── List / rows / highlight ───────── */
.mgs-list{position:relative;display:flex;flex-direction:column;margin-top:4px}
.mgs-hl{position:absolute;left:0;right:0;top:0;height:44px;border-radius:16px;background:rgba(255,255,255,.2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);opacity:0;transition:transform var(--hl-dur) var(--hl-ease),opacity var(--hl-dur) var(--hl-ease);pointer-events:none}
.mgs-row{box-sizing:border-box;position:relative;display:flex;align-items:center;gap:8px;height:44px;padding:0 12px 0 10px;border-radius:16px;font-size:13px;line-height:20px;text-align:left;width:100%;outline:none}
.mgs-row .mgs-label{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mgs-row:focus-visible{box-shadow:0 0 0 2px rgba(255,255,255,.9)}
.mgs-row .mgs-icon{flex:none}
.mgs-slot{position:relative;width:16px;height:16px;flex:none}
.mgs-slot .mgs-icon{position:absolute;inset:0;transition:opacity var(--icon-dur) ease-in-out,transform var(--icon-dur) ease-in-out,filter var(--icon-dur) ease-in-out}
.mgs-slot .mgs-icon-b{opacity:0;transform:scale(.25);filter:blur(2px)}
.mgs-saved .mgs-slot .mgs-icon-a{opacity:0;transform:scale(.25);filter:blur(2px)}
.mgs-saved .mgs-slot .mgs-icon-b{opacity:1;transform:scale(1);filter:blur(0)}

/* ───────── Link row ───────── */
.mgs-linkrow{position:relative;display:flex;align-items:center;height:44px;border-radius:16px}
.mgs-linkrow .mgs-row{flex:1;min-width:0;width:auto;padding-right:6px}

/* the link itself: soft flash when copied, shake when blocked */
.mgs-linkmain{cursor:pointer;transition:transform 380ms var(--ease-spring)}
.mgs-linkmain:active{transform:scale(var(--press-scale))}
.mgs-linkrow.is-copied .mgs-linkmain{animation:mgs-row-flash 700ms var(--mgs-ease-out)}
.mgs-linkrow.is-failed .mgs-linkmain{animation:mgs-copy-shake 420ms var(--mgs-ease-out)}

/* link icon: globe -> drawn checkmark */
.mgs-linkrow.is-copied .mgs-linkmain .mgs-slot .mgs-icon-a{opacity:0;transform:scale(.25) rotate(-25deg);filter:blur(2px)}
.mgs-linkrow.is-copied .mgs-linkmain .mgs-slot .mgs-icon-b{opacity:1;transform:scale(1);filter:blur(0)}
.mgs-tick{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 380ms var(--mgs-ease-out)}
.mgs-linkrow.is-copied .mgs-linkmain .mgs-tick{stroke-dashoffset:0;transition-delay:140ms}

/* corner copy icon: static, no copied/failed animation */
.mgs-linkrow .mgs-copy{
  position:relative;
  display:grid;
  place-items:center;
  flex:none;
  width:32px;
  height:32px;
  margin-right:6px;
  border-radius:11px;
  corner-shape:squircle;
  outline:none;
  color:rgba(255,255,255,.85);
  background:transparent;
}
@media (hover: hover) and (pointer: fine){
  .mgs-linkrow .mgs-copy:hover{background:rgba(255,255,255,.18);color:#fff}
}
.mgs-linkrow .mgs-copy:focus-visible{box-shadow:0 0 0 2px rgba(255,255,255,.9)}

/* label swaps with a soft blur-in */
.mgs-label-anim{animation:mgs-label-in 320ms var(--mgs-ease-out)}

@keyframes mgs-copy-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
@keyframes mgs-label-in{from{opacity:0;transform:translateY(6px);filter:blur(3px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes mgs-row-flash{0%{background:rgba(255,255,255,.26)}100%{background:rgba(255,255,255,0)}}

/* ───────── Motion helpers ───────── */
.mgs-t-panel-slide{transform:translateY(var(--panel-translate-y));opacity:0;filter:blur(var(--panel-blur));pointer-events:none;transition:transform var(--panel-close-dur) var(--panel-ease),opacity var(--panel-close-dur) var(--panel-ease),filter var(--panel-close-dur) var(--panel-ease)}
.mgs-t-panel-slide[data-open="true"]{transform:translateY(0);opacity:1;filter:none;pointer-events:auto;transition:transform var(--panel-open-dur) var(--panel-ease),opacity var(--panel-open-dur) var(--panel-ease),filter var(--panel-open-dur) var(--panel-ease)}
.mgs-t-modal{transform-origin:center;transform:scale(var(--modal-scale));opacity:0;pointer-events:none;transition:transform var(--modal-open-dur) var(--modal-ease),opacity var(--modal-open-dur) var(--modal-ease)}
.mgs-t-modal.is-open{transform:scale(1);opacity:1;pointer-events:auto}
.mgs-t-modal.is-closing{transform:scale(var(--modal-scale-close));opacity:0;pointer-events:none;transition:transform var(--modal-close-dur) var(--modal-ease),opacity var(--modal-close-dur) var(--modal-ease)}
@media (prefers-reduced-motion:reduce){
  .mgs-sheet,.mgs-t-panel-slide,.mgs-t-modal,.mgs-hl,.mgs-scrim,.mgs-trigger,.mgs-trigger::before,.mgs-trigger::after,.mgs-slot .mgs-icon,.mgs-glass,.mgs-glass::before,.mgs-glass::after,.mgs-linkmain,.mgs-tick{transition:none!important}
  .mgs-label-anim,.mgs-linkrow.is-copied .mgs-linkmain,.mgs-linkrow.is-failed .mgs-linkmain{animation:none!important}
}

.mgs-icon-play{translate:1px 0}.mgs-icon-heart{translate:0 1px}

.mova-glass-sheet :where(button,[role="button"],[role="tab"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="switch"],summary,.t-pressable){-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}

.mova-glass-sheet *{box-sizing:border-box}.mgs-trigger:focus-visible,.mgs-grab:focus-visible{outline:2px solid #fff;outline-offset:-3px}.mgs-status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
`;
