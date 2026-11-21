'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface SvgMaskEffectProps {
  /** Mark the central expansion target with data-mask-expand to match a custom layout. */
  children: ReactNode;
  reveal: ReactNode;
  radius?: number;
  expandedRadius?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** A small cursor aperture expands across the content, with an equivalent full-view toggle. */
export function SvgMaskEffect({
  children,
  reveal,
  radius = 5,
  expandedRadius = 300,
  label = 'Reveal alternate view',
  className,
  style,
}: SvgMaskEffectProps) {
  const id = `mova-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(event) => {
        if (expanded || event.pointerType === 'touch') return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setPoint({ x, y });
        const target = event.currentTarget.querySelector('[data-mask-expand]');
        const bounds = target?.getBoundingClientRect();
        setHovered(
          bounds
            ? event.clientX >= bounds.left &&
                event.clientX <= bounds.right &&
                event.clientY >= bounds.top &&
                event.clientY <= bounds.bottom
            : x > rect.width * 0.1 && x < rect.width * 0.9 && y > rect.height * 0.2 && y < rect.height * 0.8
        );
      }}
      onPointerLeave={() => {
        setHovered(false);
        setPoint(null);
      }}
      style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', ...style }}
    >
      <div aria-hidden={expanded || undefined}>{children}</div>
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id={id} clipPathUnits="userSpaceOnUse">
            <motion.circle
              initial={false}
              animate={{
                cx: expanded || !point ? size.width / 2 : point.x,
                cy: expanded || !point ? size.height / 2 : point.y,
                r: expanded
                  ? Math.hypot(size.width, size.height)
                  : point
                    ? Math.max(0, hovered ? expandedRadius : radius)
                    : 0,
              }}
              transition={{
                cx: { duration: reduced ? 0 : 0.15, ease: 'linear' },
                cy: { duration: reduced ? 0 : 0.15, ease: 'linear' },
                r: { duration: reduced ? 0 : 0.3, ease: 'easeInOut' },
              }}
            />
          </clipPath>
        </defs>
      </svg>
      <div
        aria-hidden={!expanded}
        style={{ position: 'absolute', inset: 0, clipPath: `url(#${id})`, pointerEvents: 'none' }}
      >
        {reveal}
      </div>
      <button
        type="button"
        aria-label={label}
        aria-pressed={expanded}
        onClick={() => setExpanded((value) => !value)}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          border: '1px solid CanvasText',
          borderRadius: 6,
          color: 'CanvasText',
          background: 'Canvas',
          minHeight: 36,
          padding: '6px 12px',
          font: 'inherit',
          fontSize: 12,
          cursor: 'pointer',
          outlineOffset: 3,
        }}
      >
        {expanded ? 'Restore view' : 'Reveal view'}
      </button>
    </div>
  );
}
