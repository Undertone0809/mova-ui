'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
export type VanishInputProps = {
  label?: string;
  placeholders?: readonly string[];
  placeholderInterval?: number;
  actionLabel?: string;
  disabled?: boolean;
  onSubmit?: (value: string) => void | Promise<void>;
  className?: string;
  theme?: 'light' | 'dark';
};

type Pixel = {
  x: number;
  y: number;
  originalX: number;
  size: number;
  life: number;
};

/** Rasterizes the submitted line, then disintegrates its pixels from right to left. */
export function VanishInput({
  label = 'Your message',
  placeholders = ['What are you making?', 'Collect a little inspiration…'],
  placeholderInterval = 3000,
  actionLabel = 'Send',
  disabled = false,
  onSubmit,
  className = '',
  theme = 'dark',
}: VanishInputProps = {}) {
  const [value, setValue] = useState('');
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'pending' | 'vanishing'>('idle');
  const [status, setStatus] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const composing = useRef(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const frame = useRef(0);
  const id = useId();
  const reduced = useReducedMotion();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelAnimationFrame(frame.current);
    };
  }, []);
  useEffect(() => {
    if (value || reduced || placeholders.length < 2) return;
    const timer = setInterval(
      () => {
        if (document.visibilityState === 'visible')
          setIndex((previous) => (previous + 1) % placeholders.length);
      },
      Math.max(1000, placeholderInterval),
    );
    return () => clearInterval(timer);
  }, [value, reduced, placeholders.length, placeholderInterval]);
  function dissolve(text: string) {
    const field = input.current;
    const surface = canvas.current;
    const context = surface?.getContext('2d');
    function complete() {
      if (alive.current) {
        setValue('');
        setPhase('idle');
        busy.current = false;
      }
    }
    if (!field || !surface || !context || reduced) {
      complete();
      return;
    }
    const width = Math.ceil(field.clientWidth * 2);
    const height = 96;
    surface.width = width;
    surface.height = height;
    const computed = getComputedStyle(field);
    context.font = `${parseFloat(computed.fontSize) * 2}px ${computed.fontFamily}`;
    context.fillStyle = computed.color;
    context.textBaseline = 'middle';
    context.fillText(text, 40 - field.scrollLeft * 2, height / 2);
    const pixels = context.getImageData(0, 0, width, height).data;
    const particles: Pixel[] = [];
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width - 100; x += 2) {
        if (pixels[(y * width + x) * 4 + 3] > 50)
          particles.push({ x, y, originalX: x, size: 2, life: 1 });
      }
    }
    const right = particles.reduce((max, pixel) => Math.max(max, pixel.x), 0);
    const start = performance.now();
    let previous = start;
    function paint(now: number) {
      if (!alive.current || !context) return;
      const delta = Math.min(2.5, (now - previous) / 16.67);
      previous = now;
      const edge = right - (now - start) * 0.65;
      context.clearRect(0, 0, width, height);
      let remaining = 0;
      for (const pixel of particles) {
        if (pixel.originalX >= edge) {
          pixel.x += (Math.random() - 0.5) * 4 * delta;
          pixel.y += (Math.random() - 0.5) * 4 * delta;
          pixel.life -= 0.035 * delta;
        }
        if (pixel.life > 0) {
          remaining++;
          context.globalAlpha = Math.min(1, pixel.life * 2);
          context.fillRect(
            pixel.x,
            pixel.y,
            pixel.size * pixel.life,
            pixel.size * pixel.life,
          );
        }
      }
      context.globalAlpha = 1;
      if (remaining) frame.current = requestAnimationFrame(paint);
      else complete();
    }
    setPhase('vanishing');
    frame.current = requestAnimationFrame(paint);
  }
  async function submit() {
    if (!value.trim() || disabled || busy.current || composing.current) return;
    busy.current = true;
    setPhase('pending');
    setStatus('');
    try {
      await onSubmit?.(value.trim());
      if (alive.current) {
        setStatus('Saved to your Mova space.');
        dissolve(value);
      }
    } catch {
      if (alive.current) {
        busy.current = false;
        setPhase('idle');
        setStatus('Could not send. Your message is still here. Try again.');
      }
    }
  }
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      style={{
        width: '100%',
        maxWidth: 576,
        color: theme === 'dark' ? '#e8eee7' : '#243d32',
        font: '14px/1.5 system-ui',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 50,
          borderRadius: 28,
          background: theme === 'dark' ? '#273530' : '#f6f8f0',
          boxShadow: '0 2px 8px #0002, inset 0 0 0 1px #82947a40',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvas}
          aria-hidden="true"
          style={{
            display: phase === 'vanishing' ? 'block' : 'none',
            position: 'absolute',
            width: '100%',
            height: 48,
            left: 0,
            top: 1,
            pointerEvents: 'none',
          }}
        />
        <input
          ref={input}
          aria-label={label}
          aria-describedby={id}
          value={value}
          disabled={disabled}
          readOnly={phase !== 'idle'}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onChange={(event) => {
            setValue(event.target.value);
            setStatus('');
          }}
          style={{
            position: 'relative',
            boxSizing: 'border-box',
            width: '100%',
            height: '100%',
            padding: '0 62px 0 20px',
            background: 'transparent',
            border: 0,
            borderRadius: 28,
            color: phase === 'vanishing' ? 'transparent' : 'inherit',
            font: 'inherit',
            outlineOffset: -3,
          }}
        />
        {!value && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '0 60px 0 20px',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              opacity: 0.6,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={index}
                initial={{ opacity: 0, y: reduced ? 0 : 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -14 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {placeholders[index % Math.max(1, placeholders.length)]}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
        <button
          type="submit"
          aria-label={actionLabel}
          disabled={disabled || phase !== 'idle' || !value.trim()}
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            width: 34,
            height: 34,
            border: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: value ? '#c2dac0' : '#6d7e7140',
            color: value ? '#263b30' : 'inherit',
            cursor: 'pointer',
            transition: 'background 200ms',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <p
        id={id}
        role="status"
        style={{
          fontSize: 12,
          minHeight: 20,
          margin: '8px 16px 0',
          opacity: 0.7,
        }}
      >
        {status}
      </p>
    </form>
  );
}
export default VanishInput;
