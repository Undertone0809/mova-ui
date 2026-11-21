/**
 * Adapted from Magic UI Blur Fade at a1ed938c4cf12986c0a10b6e16b894e9a95c4dd8.
 */
import type { ReactNode } from 'react';
import { useRef } from 'react';
import {
  motion,
  useInView,
  useReducedMotion,
  type HTMLMotionProps,
  type UseInViewOptions,
  type Variants,
} from 'framer-motion';

export interface BlurFadeProps extends Omit<HTMLMotionProps<'div'>, 'children' | 'ref'> {
  children: ReactNode;
  variant?: { hidden: Variants[string]; visible: Variants[string] };
  duration?: number;
  delay?: number;
  offset?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  inView?: boolean;
  inViewMargin?: UseInViewOptions['margin'];
  blur?: string;
}

export function BlurFade({
  children,
  variant,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = 'down',
  inView = false,
  inViewMargin = '-50px',
  blur = '6px',
  ...props
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasEntered = useInView(ref, { once: true, margin: inViewMargin });
  const reducedMotion = useReducedMotion();
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const start = direction === 'down' || direction === 'right' ? -offset : offset;
  const variants = variant ?? {
    hidden: { [axis]: start, opacity: 0, filter: `blur(${blur})` },
    visible: { [axis]: 0, opacity: 1, filter: 'blur(0px)' },
  };

  return (
    <motion.div
      ref={ref}
      initial={reducedMotion ? false : 'hidden'}
      animate={reducedMotion || !inView || hasEntered ? 'visible' : 'hidden'}
      exit={reducedMotion ? undefined : 'hidden'}
      variants={variants}
      transition={reducedMotion ? { duration: 0 } : {
        delay: 0.04 + delay,
        duration,
        ease: 'easeOut',
        filter: { duration },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
