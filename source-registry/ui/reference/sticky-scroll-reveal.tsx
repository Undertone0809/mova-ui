'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface StickyScrollRevealItem {
  id: string;
  title: string;
  description: ReactNode;
  content: ReactNode;
}
export interface StickyScrollRevealProps {
  items: readonly StickyScrollRevealItem[];
  height?: number;
  label?: string;
  backgroundColors?: readonly string[];
  className?: string;
  style?: CSSProperties;
  onActiveChange?: (index: number) => void;
}

/** Scroll progress selects chapters while a fixed visual stays beside the reading column. */
export function StickyScrollReveal({
  items,
  height = 480,
  label = 'Scroll story',
  backgroundColors = ['#171717', '#0b0b0b', '#202020'],
  className,
  style,
  onActiveChange,
}: StickyScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [compact, setCompact] = useState(false);
  const reduced = useReducedMotion();
  const viewportHeight = Math.max(240, height);
  const current = Math.min(active, Math.max(0, items.length - 1));
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setCompact(element.clientWidth < 560);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  function select(index: number) {
    if (index !== active) {
      setActive(index);
      onActiveChange?.(index);
    }
  }
  function selectFromScroll(element: HTMLDivElement) {
    const distance = element.scrollHeight - element.clientHeight;
    const progress = distance > 0 ? element.scrollTop / distance : 0;
    select(Math.max(0, Math.min(items.length - 1, Math.round(progress * items.length))));
  }
  return (
    <motion.div
      ref={ref}
      className={className}
      tabIndex={0}
      role="region"
      aria-label={label}
      onScroll={(event) => selectFromScroll(event.currentTarget)}
      animate={{
        backgroundColor: backgroundColors.length ? backgroundColors[current % backgroundColors.length] : 'transparent',
      }}
      transition={{ duration: reduced ? 0 : 0.3 }}
      style={{
        height: viewportHeight,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        outlineOffset: 3,
        borderRadius: 8,
        ...style,
      }}
    >
      {items.length === 0 ? (
        <p style={{ padding: 24 }}>No chapters to display.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(0, 1fr)',
            gap: compact ? 0 : 40,
            alignItems: 'start',
            padding: compact ? '24px' : '40px',
          }}
        >
          <div>
            {items.map((item, index) => (
              <motion.section
                key={item.id}
                animate={{ opacity: index === current ? 1 : 0.3 }}
                transition={{ duration: reduced ? 0 : 0.3 }}
                style={{ margin: '64px 0 80px', minHeight: 180 }}
              >
                <h3 style={{ margin: 0 }}>
                  <button
                    type="button"
                    aria-current={index === current ? 'step' : undefined}
                    onClick={() => {
                      const element = ref.current;
                      if (!element) return;
                      const top = (index / Math.max(1, items.length)) * (element.scrollHeight - element.clientHeight);
                      element.scrollTo({ top, behavior: reduced ? 'instant' : 'smooth' });
                    }}
                    style={{
                      appearance: 'none',
                      border: 0,
                      background: 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      fontWeight: 700,
                      fontSize: compact ? 22 : 24,
                      lineHeight: 1.25,
                      textAlign: 'left',
                      padding: '4px 0',
                      cursor: 'pointer',
                      outlineOffset: 4,
                    }}
                  >
                    {item.title}
                  </button>
                </h3>
                <div style={{ fontSize: 16, lineHeight: 1.65, marginTop: 32 }}>{item.description}</div>
              </motion.section>
            ))}
            <div style={{ height: 160 }} aria-hidden="true" />
          </div>
          {!compact && (
            <div style={{ position: 'sticky', top: 40, minWidth: 0, height: 240, overflow: 'hidden', borderRadius: 8 }}>
              {items[current].content}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
