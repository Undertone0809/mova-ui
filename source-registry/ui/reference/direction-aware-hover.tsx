'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface DirectionAwareHoverProps {
  imageSrc?: string;
  imageAlt?: string;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}

/** Image parallax and a caption respond to the edge through which the pointer entered. */
export function DirectionAwareHover({
  imageSrc,
  imageAlt = '',
  title = 'Room for a new idea',
  description = 'A small collection of things worth keeping.',
  children,
  theme = 'light',
  className = '',
  style,
}: DirectionAwareHoverProps) {
  const reduced = useReducedMotion();
  const [edge, setEdge] = React.useState('left');
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [selected, setSelected] = React.useState(false);
  const visible = hovered || focused || selected;
  const vectors: Record<string, { x: number; y: number }> = {
    left: { x: 20, y: 0 },
    right: { x: -20, y: 0 },
    top: { x: 0, y: 20 },
    bottom: { x: 0, y: -20 },
  };
  const offset = vectors[edge];
  return (
    <div
      className={`mova-direction-hover ${className}`}
      data-theme={theme}
      data-edge={edge}
      data-active={visible}
      role="button"
      tabIndex={0}
      aria-label={`${title}. ${description}`}
      aria-pressed={selected}
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setEdge(Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : y < 0 ? 'top' : 'bottom');
        setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={() => setSelected((value) => !value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setSelected(false);
          setFocused(false);
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelected((value) => !value);
        }
      }}
      style={style}
    >
      <style>{css}</style>
      <motion.div
        className="mdh-picture"
        animate={visible && !reduced ? offset : { x: 0, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={imageAlt} draggable={false} />
        ) : (
          <span className="mdh-fallback">✳</span>
        )}
      </motion.div>
      <motion.div
        className="mdh-shade"
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="mdh-caption"
        animate={{
          opacity: visible ? 1 : 0,
          x: visible && !reduced ? -offset.x : 0,
          y: visible && !reduced ? -offset.y : 0,
        }}
        transition={{ duration: reduced ? 0 : 0.45, ease: 'easeOut' }}
      >
        <h3>{title}</h3>
        <p>{description}</p>
        {children}
      </motion.div>
    </div>
  );
}
const css = `
.mova-direction-hover{position:relative;isolation:isolate;overflow:hidden;width:384px;max-width:100%;aspect-ratio:1;border-radius:8px;background:#d7d3c8;color:#fff;font:14px/1.5 Inter,system-ui,sans-serif;cursor:pointer;outline-offset:5px}
.mova-direction-hover:focus-visible{outline:3px solid #b4a98b}
.mdh-picture,.mdh-shade{position:absolute;inset:0}
.mdh-picture>img{display:block;width:100%;height:100%;object-fit:cover;transform:scale(1.16);pointer-events:none}
.mdh-fallback{display:grid;place-items:center;width:100%;height:100%;background:#a7b2a6;font-size:100px}
.mdh-shade{background:#161b225c;pointer-events:none}
.mdh-caption{position:absolute;left:24px;right:32px;bottom:28px;pointer-events:none;text-shadow:0 2px 8px #0008}
.mdh-caption h3{font-size:25px;line-height:1.2;font-weight:600;margin:0 0 8px;letter-spacing:-.5px}
.mdh-caption p{font-size:14px;margin:0;line-height:1.5;color:#fff}
@media(max-width:480px){.mdh-caption{left:20px;bottom:20px}.mdh-caption h3{font-size:22px}}
`;
