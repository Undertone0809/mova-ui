'use client';

import * as React from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

export interface CometCardProps {
  children?: React.ReactNode;
  title?: string;
  description?: string;
  eyebrow?: string;
  imageSrc?: string;
  imageAlt?: string;
  rotateDepth?: number;
  translateDepth?: number;
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}

/** A spring-driven card lifts, tilts, and catches light as the pointer crosses its surface. */
export function CometCard({
  children,
  title = 'Follow your curiosity',
  description = 'A small invitation to see something new.',
  eyebrow = 'MOVA / FIELD NOTES',
  imageSrc,
  imageAlt = '',
  rotateDepth = 17.5,
  translateDepth = 20,
  theme = 'light',
  className = '',
  style,
}: CometCardProps) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 180, damping: 24 });
  const springY = useSpring(y, { stiffness: 180, damping: 24 });
  const rotateX = useTransform(springY, [-1, 1], [rotateDepth, -rotateDepth]);
  const rotateY = useTransform(springX, [-1, 1], [-rotateDepth, rotateDepth]);
  const translateX = useTransform(springX, [-1, 1], [-translateDepth, translateDepth]);
  const translateY = useTransform(springY, [-1, 1], [-translateDepth, translateDepth]);
  const lightX = useTransform(springX, [-1, 1], ['0%', '100%']);
  const lightY = useTransform(springY, [-1, 1], ['0%', '100%']);
  const [active, setActive] = React.useState(false);
  function reset() {
    x.set(0);
    y.set(0);
    setActive(false);
  }
  return (
    <div className={`mova-comet-card ${className}`} data-theme={theme} style={style}>
      <style>{css}</style>
      <motion.div
        className="mcc-surface"
        tabIndex={0}
        onPointerMove={(event) => {
          if (event.pointerType === 'touch' || reduced) return;
          const rect = event.currentTarget.parentElement!.getBoundingClientRect();
          x.set(Math.max(-1, Math.min(1, (2 * (event.clientX - rect.left)) / rect.width - 1)));
          y.set(Math.max(-1, Math.min(1, (2 * (event.clientY - rect.top)) / rect.height - 1)));
          setActive(true);
        }}
        onPointerLeave={reset}
        onPointerCancel={reset}
        onFocus={() => setActive(true)}
        onBlur={reset}
        animate={{
          scale: active && !reduced ? 1.04 : 1,
          z: active && !reduced ? 40 : 0,
        }}
        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        style={{
          rotateX: reduced ? 0 : rotateX,
          rotateY: reduced ? 0 : rotateY,
          x: reduced ? 0 : translateX,
          y: reduced ? 0 : translateY,
        }}
      >
        {children ?? (
          <>
            <div className="mcc-art">
              {imageSrc ? (
                <img src={imageSrc} alt={imageAlt} draggable={false} />
              ) : (
                <span aria-hidden="true">✳</span>
              )}
            </div>
            <div className="mcc-copy">
              <small>{eyebrow}</small>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <div className="mcc-foot">
              <span>Mova Library</span>
              <span aria-hidden="true">↗</span>
            </div>
          </>
        )}
        <motion.span
          className="mcc-glare"
          aria-hidden="true"
          animate={{ opacity: active ? 0.38 : 0 }}
          style={{ left: lightX, top: lightY }}
        />
      </motion.div>
    </div>
  );
}
const css = `
.mova-comet-card{width:320px;max-width:100%;perspective:1200px;font:14px/1.5 Inter,system-ui,sans-serif;color:#292a25}
.mcc-surface{position:relative;transform-style:preserve-3d;border-radius:12px;padding:12px;background:#eeece4;box-shadow:0 24px 48px #0004;outline-offset:5px;overflow:hidden;will-change:transform}
.mova-comet-card[data-theme='dark']{color:#eeece5}.mova-comet-card[data-theme='dark'] .mcc-surface{background:#232723}
.mcc-surface:focus-visible{outline:3px solid #b6b2a1}
.mcc-art{aspect-ratio:3/4;position:relative;border-radius:8px;overflow:hidden;background:#8e9b96}
.mcc-art img{display:block;width:100%;height:100%;object-fit:cover}.mcc-art>span{display:grid;place-items:center;height:100%;font-size:100px;color:#ddd7c4}
.mcc-copy{padding:20px 8px 16px}.mcc-copy small{font-size:9px;letter-spacing:1.4px;opacity:.65}.mcc-copy h3{font-size:21px;line-height:1.2;margin:8px 0;font-weight:500;letter-spacing:-.4px}.mcc-copy p{font-size:12px;margin:0;opacity:.65}
.mcc-foot{display:flex;justify-content:space-between;border-top:1px solid #8885;padding:12px 8px 2px;font-size:10px}
.mcc-glare{position:absolute;pointer-events:none;width:450px;height:450px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff9,transparent 70%);mix-blend-mode:overlay}
`;
