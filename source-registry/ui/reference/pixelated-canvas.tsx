'use client';

import * as React from 'react';

export interface PixelatedCanvasProps {
  imageSrc?: string;
  imageAlt?: string;
  title?: string;
  description?: string;
  pixelSize?: number;
  cellSize?: number;
  distortionRadius?: number;
  distortionStrength?: number;
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}
type Dot = { x: number; y: number; color: string; seed: number };

/** Samples an illustration into individual dots that swirl around the pointer and settle on departure. */
export function PixelatedCanvas({
  imageSrc,
  imageAlt = '',
  title = 'A scene in small pieces',
  description = 'Move across the illustration to stir its pixels. Tap to hold the movement.',
  pixelSize,
  cellSize = 4,
  distortionRadius = 90,
  distortionStrength = 24,
  theme = 'light',
  className = '',
  style,
}: PixelatedCanvasProps) {
  const surface = React.useRef<HTMLCanvasElement>(null);
  const position = React.useRef<{ x: number; y: number } | null>(null);
  const pinned = React.useRef(false);
  const focused = React.useRef(false);
  const redraw = React.useRef<(() => void) | null>(null);
  const [held, setHeld] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const id = React.useId();
  const requestedCell = pixelSize ?? cellSize;
  const step = Number.isFinite(requestedCell) ? Math.max(2, Math.min(16, requestedCell)) : 4;
  React.useEffect(() => {
    setReady(false);
    setFailed(false);
    const canvas = surface.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !imageSrc) return;
    const sampling = document.createElement('canvas');
    const sampler = sampling.getContext('2d', { willReadFrequently: true });
    if (!sampler) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const image = new Image();
    image.crossOrigin = 'anonymous';
    let disposed = false;
    let frame = 0;
    let dots: Dot[] = [];
    let width = 0;
    let height = 0;
    let intensity = 0;
    let last = 0;
    let observer: ResizeObserver | undefined;
    function draw(now = 0) {
      frame = 0;
      if (disposed || !context || !canvas) return;
      const point = position.current ?? { x: 0.5, y: 0.5 };
      const target = !reduced.matches && (position.current || pinned.current || focused.current) ? 1 : 0;
      intensity += (target - intensity) * 0.12;
      if (Math.abs(intensity - target) < 0.002) intensity = target;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#111514';
      context.fillRect(0, 0, width, height);
      for (const dot of dots) {
        let x = dot.x;
        let y = dot.y;
        const dx = x - point.x * width;
        const dy = y - point.y * height;
        const distance = Math.hypot(dx, dy);
        const weight = Math.max(0, 1 - distance / Math.max(20, distortionRadius)) * intensity;
        if (weight > 0) {
          const angle = Math.atan2(dy, dx) + weight * 0.9;
          const wave = Math.sin(now * 0.003 + dot.seed) * 0.25;
          const radius = distance + weight * distortionStrength * (0.8 + wave);
          x += (Math.cos(angle) * radius - dx) * weight;
          y += (Math.sin(angle) * radius - dy) * weight;
        }
        context.fillStyle = dot.color;
        context.fillRect(x, y, Math.max(1, step * 0.65), Math.max(1, step * 0.65));
      }
      last = now;
      if (target || intensity > 0) frame = requestAnimationFrame(draw);
    }
    function start() {
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function sample() {
      if (disposed || !canvas || !context || !sampler || !image.naturalWidth) return;
      width = Math.max(1, Math.round(canvas.clientWidth));
      height = Math.max(1, Math.round(canvas.clientHeight));
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      sampling.width = width;
      sampling.height = height;
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      sampler.drawImage(
        image,
        (width - image.naturalWidth * scale) / 2,
        (height - image.naturalHeight * scale) / 2,
        image.naturalWidth * scale,
        image.naturalHeight * scale
      );
      try {
        const data = sampler.getImageData(0, 0, width, height).data;
        dots = [];
        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const offset =
              (Math.min(height - 1, Math.round(y)) * width + Math.min(width - 1, Math.round(x))) * 4;
            const [red, green, blue] = [data[offset], data[offset + 1], data[offset + 2]];
            let hash = Math.imul(Math.round(x) + 31, 73856093) ^ Math.imul(Math.round(y) + 17, 19349663);
            hash ^= hash >>> 13;
            const seed = (Math.imul(hash, 1274126177) >>> 0) / 4294967296;
            const brightness = (red + green + blue) / 765;
            if (seed < 0.08 + (1 - brightness) * 0.22) continue;
            dots.push({
              x,
              y,
              seed: seed * Math.PI * 8,
              color: `rgb(${red} ${green} ${blue})`,
            });
          }
        }
        setReady(true);
        cancelAnimationFrame(frame);
        draw(last);
      } catch {
        setFailed(true);
      }
    }
    redraw.current = start;
    image.onload = () => {
      if (disposed) return;
      sample();
      observer = new ResizeObserver(sample);
      observer.observe(canvas);
    };
    image.onerror = () => {
      if (!disposed) setFailed(true);
    };
    image.src = imageSrc;
    reduced.addEventListener('change', start);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      image.onload = null;
      image.onerror = null;
      redraw.current = null;
      reduced.removeEventListener('change', start);
    };
  }, [imageSrc, step, distortionRadius, distortionStrength]);
  return (
    <div className={`mova-pixelated-canvas ${className}`} data-theme={theme} style={style}>
      <style>{css}</style>
      <button
        className="mpc-reveal"
        type="button"
        aria-label={`${title}${imageAlt ? `. ${imageAlt}` : ''}`}
        aria-describedby={id}
        aria-pressed={held}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          position.current = {
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height,
          };
          redraw.current?.();
        }}
        onPointerLeave={() => {
          if (!pinned.current) position.current = null;
          redraw.current?.();
        }}
        onFocus={(event) => {
          focused.current = event.currentTarget.matches(':focus-visible');
          redraw.current?.();
        }}
        onBlur={() => {
          focused.current = false;
          redraw.current?.();
        }}
        onClick={() => {
          pinned.current = !pinned.current;
          setHeld(pinned.current);
          redraw.current?.();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            pinned.current = false;
            focused.current = false;
            position.current = null;
            setHeld(false);
            redraw.current?.();
          }
        }}
      >
        {imageSrc && (!ready || failed) && <img src={imageSrc} alt="" onError={() => setFailed(true)} />}
        <canvas
          ref={surface}
          aria-hidden="true"
          data-ready={ready}
          style={{ opacity: ready && !failed ? 1 : 0 }}
        />
        {!imageSrc && <span className="mpc-fallback">Choose an illustration</span>}
        {failed && <span className="mpc-failure">Pixel preview unavailable</span>}
      </button>
      <p id={id}>{description}</p>
    </div>
  );
}
const css = `
.mova-pixelated-canvas{width:400px;max-width:100%;font:12px/1.5 Inter,system-ui,sans-serif;color:#626e65}
.mova-pixelated-canvas[data-theme='dark']{color:#929d95}
.mpc-reveal{position:relative;display:block;padding:0;width:100%;aspect-ratio:4/5;background:#111514;border:1px solid #6666;border-radius:8px;overflow:hidden;cursor:crosshair;touch-action:pan-y}
.mpc-reveal:focus-visible{outline:3px solid #a6b9ac;outline-offset:5px}.mpc-reveal>img,.mpc-reveal>canvas,.mpc-fallback{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}.mpc-fallback{display:grid;place-items:center;color:#c1ccbc;font:inherit}
.mpc-failure{position:absolute;bottom:12px;left:12px;right:12px;padding:8px;background:#111d;color:#ddd;font:11px/1.4 Inter,system-ui,sans-serif}
.mova-pixelated-canvas>p{margin:14px 0 0;font-size:11px;opacity:.75}
`;
