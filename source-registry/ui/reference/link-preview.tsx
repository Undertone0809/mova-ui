'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';

export type LinkPreviewProps = {
  href: string;
  children: ReactNode;
  title: string;
  description?: string;
  image?: { src: string; alt: string };
  previewLabel?: string;
  className?: string;
  theme?: 'light' | 'dark';
};

/** An illustrated destination preview follows the pointer above its inline link. */
export function LinkPreview({
  href,
  children,
  title,
  description,
  image,
  previewLabel = 'Toggle link preview',
  className = '',
  theme = 'dark',
}: LinkPreviewProps) {
  const [open, setOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string>();
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ left: 0, width: 240, top: 0, bottom: 0, height: 0 });
  const [previewHeight, setPreviewHeight] = useState(190);
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const id = useId();
  const pointerX = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 100, damping: 15 });
  const reduced = useReducedMotion();
  function measureAnchor() {
    const bounds = anchor.current?.getBoundingClientRect();
    if (!bounds) return;
    const width = Math.min(240, window.innerWidth - 24);
    const left = Math.max(12, Math.min(bounds.left + bounds.width / 2 - width / 2, window.innerWidth - width - 12));
    setPosition({ left, width, top: bounds.top, bottom: bounds.bottom, height: window.innerHeight });
  }
  useEffect(() => {
    if (!open) return;
    const measurePreview = () => {
      if (panel.current) setPreviewHeight(panel.current.offsetHeight);
    };
    measurePreview();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measurePreview);
    if (panel.current) observer?.observe(panel.current);
    window.addEventListener('resize', measureAnchor);
    window.addEventListener('scroll', measureAnchor, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measureAnchor);
      window.removeEventListener('scroll', measureAnchor, true);
    };
  }, [open]);
  const above = position.top >= previewHeight + 24 || position.height - position.bottom < previewHeight + 24;
  const previewTop = above ? position.top - previewHeight - 12 : position.bottom + 12;

  function reveal() {
    clearTimeout(timer.current);
    measureAnchor();
    setOpen(true);
  }
  function dismiss() {
    clearTimeout(timer.current);
    if (!pinned) timer.current = setTimeout(() => setOpen(false), 100);
  }
  return (
    <span
      ref={anchor}
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        color: theme === 'dark' ? '#e6eee6' : '#294c3e',
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') reveal();
      }}
      onPointerLeave={dismiss}
      onFocus={reveal}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPinned(false);
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setPinned(false);
          setOpen(false);
        }
      }}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const shift = (event.clientX - bounds.left - bounds.width / 2) / 2;
        const min = Math.max(-35, 12 - position.left);
        const max = Math.min(35, window.innerWidth - position.left - position.width - 12);
        pointerX.set(reduced ? 0 : Math.max(min, Math.min(max, shift)));
      }}
    >
      <a
        href={href}
        aria-describedby={open ? id : undefined}
        style={{
          color: 'inherit',
          textDecoration: 'underline',
          textUnderlineOffset: 5,
        }}
      >
        {children}
      </a>
      <button
        type="button"
        aria-label={previewLabel}
        aria-expanded={open}
        onClick={() => {
          setPinned(!pinned);
          if (pinned) setOpen(false);
          else reveal();
        }}
        style={{
          padding: 8,
          border: 0,
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
        }}
      >
        ↗
      </button>
      {position.height > 0 && createPortal(<AnimatePresence>
        {open && (
          <span
            style={{
              position: 'fixed',
              zIndex: 1000,
              top: Math.max(12, Math.min(previewTop, position.height - previewHeight - 12)),
              left: position.left,
              width: position.width,
              pointerEvents: 'none',
              visibility: position.bottom < 0 || position.top > position.height ? 'hidden' : undefined,
            }}
          >
            <motion.span
              ref={panel}
              id={id}
              role="tooltip"
              initial={{
                opacity: 0,
                y: reduced ? 0 : 20,
                scale: reduced ? 1 : 0.6,
              }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: reduced ? 0 : 20,
                scale: reduced ? 1 : 0.6,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              style={{
                display: 'block',
                x,
                background: theme === 'dark' ? '#e0eadd' : '#f4f6ef',
                color: '#263b30',
                padding: 5,
                borderRadius: 15,
                boxShadow: '0 12px 35px #0005',
                transformOrigin: 'bottom center',
              }}
            >
              {image && image.src !== failedImage && (
                <img
                  src={image.src}
                  alt={image.alt}
                  onError={() => setFailedImage(image.src)}
                  style={{
                    display: 'block',
                    width: '100%',
                    aspectRatio: '1.6',
                    objectFit: 'cover',
                    borderRadius: 11,
                  }}
                />
              )}
              <span
                style={{
                  display: 'block',
                  padding: '7px 8px',
                  font: '600 12px/1.5 system-ui',
                }}
              >
                {title}
                {description && (
                  <span
                    style={{
                      display: 'block',
                      marginTop: 3,
                      fontWeight: 400,
                      opacity: 0.75,
                    }}
                  >
                    {description}
                  </span>
                )}
              </span>
            </motion.span>
          </span>
        )}
      </AnimatePresence>, document.body)}
    </span>
  );
}
export default LinkPreview;
