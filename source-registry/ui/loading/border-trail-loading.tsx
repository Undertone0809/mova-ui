import React from 'react';
import { motion, type Transition, useReducedMotion } from 'motion/react';

// Adapted from Motion-Primitives' Border Trail Card example.
// Source: https://github.com/ibelick/motion-primitives/blob/main/components/core/border-trail.tsx
// Example: https://motion-primitives.com/e/border-trail-card-1.json

type BorderTrailProps = {
  className?: string;
  size?: number;
  transition?: Transition;
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
};

function BorderTrail({
  className = '',
  size = 100,
  transition,
  onAnimationComplete,
  style,
}: BorderTrailProps) {
  const defaultTransition: Transition = {
    repeat: Infinity,
    duration: 5,
    ease: 'linear',
  };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
    >
      <motion.div
        className={'absolute aspect-square bg-zinc-500 ' + className}
        style={{
          width: size,
          offsetPath: 'rect(0 auto auto 0 round ' + size + 'px)',
          ...style,
        }}
        animate={{
          offsetDistance: ['0%', '100%'],
        }}
        transition={transition || defaultTransition}
        onAnimationComplete={onAnimationComplete}
      />
    </div>
  );
}

type BorderTrailLoadingProps = React.ComponentProps<'div'> & {
  theme?: 'dark' | 'light';
  trailSize?: number;
  trailTransition?: Transition;
};

export function BorderTrailLoading({
  className = '',
  style,
  theme = 'light',
  trailSize = 100,
  trailTransition,
  ...props
}: BorderTrailLoadingProps) {
  const reducedMotion = useReducedMotion();
  const isDark = theme === 'dark';
  const motionTransition = reducedMotion
    ? { duration: 0, repeat: 0 }
    : trailTransition;

  return (
    <div
      className={
        'relative flex aspect-[3/2] h-auto min-h-0 w-[300px] max-w-full flex-col items-center justify-center rounded-md px-5 py-2 ' +
        (isDark ? 'bg-zinc-800' : 'bg-zinc-200') +
        ' ' +
        className
      }
      style={style}
      {...props}
    >
      <BorderTrail
        size={trailSize}
        transition={motionTransition}
        style={{
          boxShadow:
            '0px 0px 60px 30px rgb(255 255 255 / 50%), 0 0 100px 60px rgb(0 0 0 / 50%), 0 0 140px 90px rgb(0 0 0 / 50%)',
        }}
      />
      <div
        className="flex h-full animate-pulse motion-reduce:animate-none flex-col items-start justify-center space-y-2"
        role="status"
        aria-label="Loading..."
      >
        <div className="h-1 w-4 rounded-[4px] bg-zinc-600" />
        <div className="h-1 w-10 rounded-[4px] bg-zinc-600" />
        <div className="h-1 w-12 rounded-[4px] bg-zinc-600" />
        <div className="h-1 w-12 rounded-[4px] bg-zinc-600" />
        <div className="h-1 w-12 rounded-[4px] bg-zinc-600" />
      </div>
    </div>
  );
}
