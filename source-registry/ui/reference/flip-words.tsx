'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';

export interface FlipWordsProps {
  words: readonly string[];
  /** Time each phrase remains visible, in milliseconds. */
  interval?: number;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Blurred letters arrive in sequence, then the outgoing phrase drifts upward and dissolves. */
export function FlipWords({ words, interval = 3000, paused = false, className, style }: FlipWordsProps) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (words.length < 2 || paused || reduced || !visible) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % words.length), Math.max(600, interval));
    return () => window.clearTimeout(timer);
  }, [index, words.length, interval, paused, reduced, visible]);
  const current = words[index % Math.max(1, words.length)] ?? '';
  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-grid', position: 'relative', verticalAlign: 'baseline', ...style }}
    >
      <span aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden', display: 'inline-grid' }}>
        {(words.length ? words : ['\u00a0']).map((word, wordIndex) => (
          <span key={wordIndex} style={{ gridArea: '1 / 1' }}>
            {word}
          </span>
        ))}
      </span>
      <AnimatePresence>
        <motion.span
          key={`${index}-${current}`}
          aria-label={current}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: 40, y: -40, scale: 2, filter: 'blur(8px)' }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 100, damping: 10 }}
          style={{ gridArea: '1 / 1', position: 'relative', transformOrigin: 'left center', whiteSpace: 'nowrap' }}
        >
          <span aria-hidden="true">
            {current.split(' ').map((word, wordIndex) => (
              <span key={`${wordIndex}-${word}`} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                {Array.from(word).map((letter, letterIndex) => (
                  <motion.span
                    key={letterIndex}
                    initial={reduced ? false : { opacity: 0, y: 10, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{
                      duration: reduced ? 0 : 0.2,
                      delay: reduced ? 0 : wordIndex * 0.3 + letterIndex * 0.05,
                    }}
                    style={{ display: 'inline-block' }}
                  >
                    {letter}
                  </motion.span>
                ))}
                {wordIndex < current.split(' ').length - 1 ? '\u00a0' : null}
              </span>
            ))}
          </span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
