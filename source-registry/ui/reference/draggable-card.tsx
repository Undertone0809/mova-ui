'use client';

import * as React from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';

export interface DraggableCardProps {
  children?: React.ReactNode;
  title?: string;
  description?: string;
  imageSrc?: string;
  imageAlt?: string;
  maxOffset?: number;
  rotation?: number;
  showControls?: boolean;
  onPositionChange?: (position: { x: number; y: number }) => void;
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}

/** The entire illustrated sheet is draggable. Release momentum and tilt settle through springs. */
export function DraggableCard({
  children,
  title = 'Keep this thought',
  description = 'Good ideas rarely arrive in order.',
  imageSrc,
  imageAlt = '',
  maxOffset = 160,
  rotation = -3,
  showControls = true,
  onPositionChange,
  theme = 'light',
  className = '',
  style,
}: DraggableCardProps) {
  const reduced = useReducedMotion();
  const limit = Number.isFinite(maxOffset) ? Math.max(0, maxOffset) : 160;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  useMotionValueEvent(x, 'change', () => onPositionChange?.({ x: x.get(), y: y.get() }));
  useMotionValueEvent(y, 'change', () => onPositionChange?.({ x: x.get(), y: y.get() }));
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, { stiffness: 160, damping: 20 });
  const rotateY = useSpring(tiltY, { stiffness: 160, damping: 20 });
  const glare = useTransform(rotateY, [-15, 0, 15], [0.16, 0, 0.16]);
  const [dragging, setDragging] = React.useState(false);
  const [front, setFront] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState('');
  const id = React.useId();
  function reset() {
    x.stop();
    y.stop();
    x.set(0);
    y.set(0);
    tiltX.set(0);
    tiltY.set(0);
    setAnnouncement('Card returned to its starting position.');
  }
  return (
    <div className={`mova-draggable-card ${className}`} data-theme={theme} style={style}>
      <style>{css}</style>
      <motion.article
        className="mdc-paper"
        tabIndex={0}
        role="button"
        aria-label={`Move ${title}`}
        aria-describedby={id}
        drag
        dragConstraints={{
          left: -limit,
          right: limit,
          top: -limit,
          bottom: limit,
        }}
        dragElastic={0.12}
        dragMomentum={!reduced}
        dragTransition={{
          power: 0.18,
          timeConstant: 240,
          bounceStiffness: 220,
          bounceDamping: 24,
        }}
        style={{
          x,
          y,
          rotate: rotation,
          rotateX: reduced ? 0 : rotateX,
          rotateY: reduced ? 0 : rotateY,
          zIndex: front ? 10 : 1,
        }}
        animate={{ scale: dragging && !reduced ? 1.06 : 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        onPointerDown={() => setFront(true)}
        onDragStart={() => {
          setDragging(true);
          setFront(true);
        }}
        onDragEnd={() => {
          setDragging(false);
          tiltX.set(0);
          tiltY.set(0);
          setAnnouncement(`Card placed at ${Math.round(x.get())}, ${Math.round(y.get())}.`);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === 'touch' || reduced) return;
          const rect = event.currentTarget.getBoundingClientRect();
          tiltX.set((0.5 - (event.clientY - rect.top) / rect.height) * 20);
          tiltY.set(((event.clientX - rect.left) / rect.width - 0.5) * 20);
        }}
        onPointerLeave={() => {
          tiltX.set(0);
          tiltY.set(0);
        }}
        onKeyDown={(event) => {
          const move: Record<string, [number, number]> = {
            ArrowLeft: [-12, 0],
            ArrowRight: [12, 0],
            ArrowUp: [0, -12],
            ArrowDown: [0, 12],
          };
          if (event.key === 'Home' || event.key === 'Escape') {
            event.preventDefault();
            reset();
          }
          if (move[event.key]) {
            event.preventDefault();
            setFront(true);
            const [dx, dy] = move[event.key];
            x.set(Math.max(-limit, Math.min(limit, x.get() + dx * (event.shiftKey ? 3 : 1))));
            y.set(Math.max(-limit, Math.min(limit, y.get() + dy * (event.shiftKey ? 3 : 1))));
            setAnnouncement(`Card at ${Math.round(x.get())}, ${Math.round(y.get())}.`);
          }
        }}
      >
        {imageSrc ? (
          <img className="mdc-image" src={imageSrc} alt={imageAlt} draggable={false} />
        ) : (
          <div className="mdc-image mdc-art" aria-hidden="true">
            ✳
          </div>
        )}
        <div className="mdc-copy">
          <h3>{title}</h3>
          <p>{description}</p>
          {children}
        </div>
        <motion.span className="mdc-glare" aria-hidden="true" style={{ opacity: reduced ? 0 : glare }} />
      </motion.article>
      {showControls && (
        <div className="mdc-controls">
          <p id={id}>Drag the card. Arrow keys move it. Home returns it.</p>
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>
      )}
      {!showControls && (
        <span id={id} className="mdc-sr">
          Drag this card or use the arrow keys. Home returns it.
        </span>
      )}
      <span className="mdc-sr" role="status">
        {announcement}
      </span>
    </div>
  );
}
const css = `
.mova-draggable-card{position:relative;width:280px;max-width:100%;perspective:1600px;font:13px/1.5 Inter,system-ui,sans-serif;color:#272b28}
.mdc-paper{position:relative;box-sizing:border-box;padding:16px;border-radius:8px;background:#eae7dd;box-shadow:0 16px 36px #0005;touch-action:none;user-select:none;cursor:grab;transform-style:preserve-3d;outline-offset:5px;will-change:transform}
.mdc-paper:active{cursor:grabbing}.mdc-paper:focus-visible{outline:3px solid #9fbaab}
.mova-draggable-card[data-theme='dark']{color:#eae9e3}.mova-draggable-card[data-theme='dark'] .mdc-paper{background:#272c29}
.mdc-image{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:4px;pointer-events:none}.mdc-art{display:grid;place-items:center;background:#a2afa5;color:#e6e2cc;font-size:90px}
.mdc-copy{padding:18px 0 4px}.mdc-copy h3{font-size:19px;line-height:1.2;font-weight:500;letter-spacing:-.4px;margin:0 0 8px}.mdc-copy p{font-size:11px;opacity:.65;margin:0}
.mdc-glare{position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:#fff}
.mdc-controls{display:flex;align-items:center;gap:16px;margin-top:28px;font-size:10px}.mdc-controls p{flex:1;opacity:.6;margin:0}.mdc-controls button{background:transparent;color:inherit;border:1px solid #8886;padding:4px 8px;border-radius:4px;font:inherit;cursor:pointer}
.mdc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
`;
