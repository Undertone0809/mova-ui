/*
React web adaptation of https://kinetik-ui.dev/components/compare-slider
*/
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ChevronsLeftRight } from 'lucide-react';

export interface CompareSliderProps {
  before: ReactNode;
  after: ReactNode;
  initial?: number;
  beforeLabel?: string;
  afterLabel?: string;
  aspectRatio?: number;
  hint?: boolean;
  onPositionChange?: (position: number) => void;
  accessibilityLabel: string;
  className?: string;
  style?: CSSProperties;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = { type: 'spring', stiffness: 210, damping: 27, mass: 1 } as const;
const fullFrame = { position: 'absolute', inset: 0, pointerEvents: 'none' } as const;

export function CompareSlider({
  before, after, initial = 0.5, beforeLabel = 'Before', afterLabel = 'After', aspectRatio = 4 / 3,
  hint = true, onPositionChange, accessibilityLabel, className, style,
}: CompareSliderProps) {
  const [start] = useState(() => Number.isFinite(initial) ? clamp(initial) : 0.5);
  const [value, setValue] = useState(start);
  const [held, setHeld] = useState(false);
  const gesture = useRef<{ id: number; x: number; moved: boolean } | null>(null);
  const hasInteracted = useRef(false);
  const position = useMotionValue(start);
  const reduced = useReducedMotion();
  const left = useTransform(position, (p) => `${clamp(p) * 100}%`);
  const clipPath = useTransform(position, (p) => `inset(0 ${(1 - clamp(p)) * 100}% 0 0)`);
  const leftTagOpacity = useTransform(position, [0.12, 0.32], [0, 1]);
  const rightTagOpacity = useTransform(position, [0.68, 0.88], [1, 0]);

  useEffect(() => {
    if (!hint || reduced || hasInteracted.current) return;
    let playing = true;
    const timer = window.setTimeout(async () => {
      if (hasInteracted.current) return;
      const nudge = start > 0.8 ? start - 0.12 : Math.min(0.92, start + 0.12);
      await animate(position, nudge, { duration: 0.42, ease: 'easeInOut' });
      if (playing && !hasInteracted.current) animate(position, start, smooth);
    }, 500);
    return () => {
      playing = false;
      window.clearTimeout(timer);
      position.stop();
      if (!hasInteracted.current) position.set(start);
    };
  }, [hint, reduced, position, start]);

  function report(next: number, spring: boolean) {
    setValue(next);
    if (spring && !reduced) animate(position, next, smooth);
    else position.set(next);
    onPositionChange?.(next);
  }

  function fraction(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return rect.width > 0 ? clamp((event.clientX - rect.left) / rect.width) : value;
  }

  function begin(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return;
    hasInteracted.current = true;
    position.stop();
    gesture.current = { id: event.pointerId, x: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType !== 'touch') event.currentTarget.focus({ preventScroll: true });
    setHeld(true);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    if (!active.moved && Math.abs(event.clientX - active.x) < 4) return;
    active.moved = true;
    position.set(fraction(event));
  }

  function finish(event: PointerEvent<HTMLDivElement>, canceled = false) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    gesture.current = null;
    setHeld(false);
    if (canceled) position.set(value);
    else report(fraction(event), !active.moved);
  }

  const tag: CSSProperties = {
    position: 'absolute', top: 12, borderRadius: 999, background: 'rgba(0,0,0,.55)',
    color: '#ededed', padding: '4px 10px', fontSize: 12, lineHeight: '16px',
    fontWeight: 600, pointerEvents: 'none', maxWidth: '45%', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };
  const percent = Math.round(value * 100);

  return (
    <div
      role="slider"
      aria-label={accessibilityLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}% ${beforeLabel.toLowerCase()}`}
      tabIndex={0}
      className={`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${className ?? ''}`}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={(event) => finish(event)}
      onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => finish(event, true)}
      onKeyDown={(event) => {
        const steps: Record<string, number> = { ArrowLeft: -0.1, ArrowDown: -0.1, ArrowRight: 0.1, ArrowUp: 0.1 };
        if (event.key !== 'Home' && event.key !== 'End' && !(event.key in steps)) return;
        event.preventDefault();
        hasInteracted.current = true;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : clamp(Math.round((value + steps[event.key]) * 10) / 10);
        report(next, true);
      }}
      style={{
        position: 'relative', width: '100%', aspectRatio, overflow: 'hidden', isolation: 'isolate',
        borderRadius: 28, background: '#050505', cursor: 'ew-resize', touchAction: 'pan-y pinch-zoom',
        userSelect: 'none', ...style,
      }}
    >
      <div style={fullFrame} aria-hidden="true">{after}</div>
      <motion.div style={{ ...fullFrame, clipPath }} aria-hidden="true">{before}</motion.div>
      {beforeLabel && <motion.span aria-hidden="true" style={{ ...tag, left: 12, opacity: leftTagOpacity }}>{beforeLabel}</motion.span>}
      {afterLabel && <motion.span aria-hidden="true" style={{ ...tag, right: 12, opacity: rightTagOpacity }}>{afterLabel}</motion.span>}
      <motion.div aria-hidden="true" style={{
        position: 'absolute', insetBlock: 0, left, width: 2, x: -1, background: '#fff',
        display: 'grid', placeItems: 'center', pointerEvents: 'none',
      }}>
        <motion.div
          animate={{ scale: held && !reduced ? 1.12 : 1 }}
          transition={reduced ? { duration: 0 } : smooth}
          style={{
            position: 'absolute', display: 'grid', placeItems: 'center', width: 40, height: 40,
            borderRadius: '50%', background: '#fff', color: '#000', boxShadow: '0 5px 14px #0005',
          }}
        >
          <ChevronsLeftRight size={24} strokeWidth={2} />
        </motion.div>
      </motion.div>
    </div>
  );
}
