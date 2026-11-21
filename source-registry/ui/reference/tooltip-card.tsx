'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export interface TooltipCardProps {
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  imageSrc?: string;
  imageAlt?: string;
  side?: 'top' | 'bottom';
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}

/** A small illustrated card follows the pointer and unfolds vertically beside the annotated phrase. */
export function TooltipCard({
  trigger = 'A small preview',
  title = 'A place to begin',
  description = 'A closer look, without leaving your place.',
  imageSrc,
  imageAlt = '',
  side = 'bottom',
  theme = 'light',
  className = '',
  style,
}: TooltipCardProps) {
  const reduced = useReducedMotion();
  const anchor = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [point, setPoint] = React.useState({ x: 0, y: 0 });
  const [size, setSize] = React.useState({ width: 260, height: 280 });
  const id = React.useId();
  const visible = !dismissed && (hovered || focused || pinned);
  React.useEffect(() => setMounted(true), []);
  React.useLayoutEffect(() => {
    if (visible && panel.current)
      setSize({
        width: panel.current.scrollWidth,
        height: panel.current.scrollHeight,
      });
  }, [visible, imageSrc, title, description]);
  function position(event?: React.PointerEvent) {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    setPoint(
      event ? { x: event.clientX, y: event.clientY } : { x: rect.left + rect.width / 2, y: rect.bottom }
    );
  }
  const viewportWidth = mounted ? window.innerWidth : 1000;
  const viewportHeight = mounted ? window.innerHeight : 1000;
  const width = Math.min(260, viewportWidth - 24);
  const left = Math.max(12, Math.min(viewportWidth - width - 12, point.x + 16));
  const fitsBelow = point.y + 16 + size.height < viewportHeight - 12;
  const top = Math.max(
    12,
    (side === 'bottom' && fitsBelow) || point.y - size.height - 16 < 12
      ? point.y + 16
      : point.y - size.height - 16
  );
  return (
    <span
      className={`mova-tooltip-card ${className}`}
      data-theme={theme}
      style={style}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') {
          setDismissed(false);
          setHovered(true);
          position(event);
        }
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== 'touch') position(event);
      }}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setPinned(false);
          setFocused(false);
          setDismissed(true);
        }
      }}
    >
      <style>{css}</style>
      <button
        type="button"
        ref={anchor}
        className="mtc-trigger"
        aria-describedby={visible ? id : undefined}
        aria-expanded={pinned}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) {
            setDismissed(false);
            setFocused(true);
            position();
          }
        }}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        onClick={() => {
          position();
          setDismissed(pinned);
          setPinned(!pinned);
        }}
      >
        {trigger}
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {visible && (
              <motion.div
                key={id}
                id={id}
                className="mtc-panel"
                role="tooltip"
                data-theme={theme}
                initial={{ height: reduced ? 'auto' : 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: reduced ? 'auto' : 0, opacity: 0 }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26 }}
                style={{ left, top, width }}
              >
                <div ref={panel} className="mtc-content">
                  {imageSrc && <img src={imageSrc} alt={imageAlt} />}
                  <div className="mtc-copy">
                    <strong>{title}</strong>
                    <p>{description}</p>
                    <small>Mova / field notes</small>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </span>
  );
}
const css = `
.mova-tooltip-card{display:inline;color:inherit;font:inherit}.mtc-trigger{display:inline;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-weight:600;text-align:inherit;cursor:help;text-decoration:underline;text-decoration-color:#8d9d8c70;text-underline-offset:4px}.mtc-trigger:focus-visible{outline:2px solid #a1b0a2;outline-offset:4px;border-radius:2px}
.mtc-panel{position:fixed;z-index:1000;box-sizing:border-box;overflow:hidden;pointer-events:none;border:1px solid #c8d0c5;border-radius:8px;background:#f4f2e9;color:#303b32;box-shadow:0 8px 32px #1116;font:13px/1.5 Inter,system-ui,sans-serif}
.mtc-panel[data-theme='dark']{background:#242d28;color:#eeeee4;border-color:#48584d}.mtc-content{box-sizing:border-box;width:100%}.mtc-content>img{display:block;width:100%;height:144px;object-fit:cover}.mtc-copy{padding:16px}.mtc-copy strong{font-size:15px;line-height:1.3;font-weight:500}.mtc-copy p{font-size:12px;line-height:1.6;margin:8px 0 12px;opacity:.75}.mtc-copy small{font-size:9px;letter-spacing:.8px;text-transform:uppercase;opacity:.5}
`;
