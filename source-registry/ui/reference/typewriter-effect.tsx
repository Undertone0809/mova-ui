'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

export interface TypewriterEffectProps {
  text: string;
  /** Milliseconds between characters. */
  speed?: number;
  delay?: number;
  cursor?: boolean;
  accentText?: string;
  accentColor?: string;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
  onComplete?: () => void;
}

/** Types a phrase on entering the viewport with individual character fades and a blinking caret. */
export function TypewriterEffect({
  text,
  speed = 100,
  delay = 0,
  cursor = true,
  accentText,
  accentColor = 'currentColor',
  paused = false,
  className,
  style,
  onComplete,
}: TypewriterEffectProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const characters = Array.from(text);
  const accentOffset = accentText ? text.lastIndexOf(accentText) : -1;
  const accentStart = accentOffset >= 0 ? Array.from(text.slice(0, accentOffset)).length : -1;
  const accentLength = Array.from(accentText ?? '').length;
  const notified = useRef(false);
  useEffect(() => {
    setCount(0);
    notified.current = false;
  }, [text]);
  useEffect(() => {
    if (!inView || paused) return;
    if (reduced) {
      setCount(characters.length);
      return;
    }
    if (count >= characters.length) return;
    const timer = window.setTimeout(
      () => setCount((value) => Math.min(value + 1, characters.length)),
      count === 0 ? Math.max(0, delay) : Math.max(10, speed)
    );
    return () => window.clearTimeout(timer);
  }, [text, count, characters.length, speed, delay, inView, paused, reduced]);
  useEffect(() => {
    if (count !== characters.length || notified.current || !inView) return;
    const timer = window.setTimeout(
      () => {
        notified.current = true;
        complete.current?.();
      },
      reduced ? 0 : 300
    );
    return () => window.clearTimeout(timer);
  }, [count, characters.length, inView, reduced]);
  return (
    <span
      ref={ref}
      className={className}
      aria-label={text}
      style={{ display: 'inline-grid', whiteSpace: 'pre-wrap', ...style }}
    >
      <span aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden' }}>
        {text}
        <span style={{ display: 'inline-block', width: '.2em' }} />
      </span>
      <span aria-hidden="true" style={{ gridArea: '1 / 1' }}>
        {characters.slice(0, reduced ? characters.length : count).map((letter, index) => (
          <motion.span
            key={`${text}-${index}`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.3, ease: 'easeInOut' }}
            style={{
              color:
                accentStart >= 0 && index >= accentStart && index < accentStart + accentLength
                  ? accentColor
                  : undefined,
            }}
          >
            {letter}
          </motion.span>
        ))}
        {cursor && (
          <motion.span
            animate={reduced || paused ? { opacity: 1 } : { opacity: [0, 1] }}
            transition={{ duration: 0.8, repeat: reduced || paused ? 0 : Infinity, repeatType: 'reverse' }}
            style={{
              display: 'inline-block',
              width: 4,
              height: '1em',
              borderRadius: 2,
              background: 'currentColor',
              marginLeft: '.12em',
              verticalAlign: '-.12em',
            }}
          />
        )}
      </span>
    </span>
  );
}
