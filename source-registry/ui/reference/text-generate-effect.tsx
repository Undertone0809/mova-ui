'use client';

import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface TextGenerateEffectProps {
  text: string;
  stagger?: number;
  duration?: number;
  blur?: number;
  once?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Resolves a phrase word by word while retaining its natural line wrapping. */
export function TextGenerateEffect({
  text,
  stagger = 0.2,
  duration = 0.5,
  blur = 10,
  once = true,
  className,
  style,
}: TextGenerateEffectProps) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className={className}
      aria-label={text}
      style={{ whiteSpace: 'pre-wrap', ...style }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
    >
      <span aria-hidden="true">
        {text.split(/(\s+)/).map((word, index) =>
          /^\s+$/.test(word) ? (
            word
          ) : (
            <motion.span
              key={`${index}-${word}`}
              style={{ display: 'inline-block' }}
              variants={{
                hidden: {
                  opacity: reduced ? 1 : 0,
                  filter: reduced ? 'none' : `blur(${Math.max(0, blur)}px)`,
                },
                visible: { opacity: 1, filter: 'blur(0px)' },
              }}
              transition={{
                duration: reduced ? 0 : Math.max(0, duration),
                delay: reduced ? 0 : Math.floor(index / 2) * Math.max(0, stagger),
              }}
            >
              {word}
            </motion.span>
          )
        )}
      </span>
    </motion.span>
  );
}
