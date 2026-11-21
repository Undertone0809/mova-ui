'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

export interface ContainerScrollAnimationProps {
  children: ReactNode;
  header?: ReactNode;
  /** Optional ancestor scroll viewport, useful for nested panels. */
  scrollContainer?: RefObject<HTMLElement | null>;
  height?: number;
  cardHeight?: number;
  className?: string;
  style?: CSSProperties;
}

/** A scroll-linked tablet frame flattens while its title rises away from the surface. */
export function ContainerScrollAnimation({
  children,
  header,
  scrollContainer,
  height = 1280,
  cardHeight = 640,
  className,
  style,
}: ContainerScrollAnimationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setCompact(element.clientWidth <= 600);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scrollYProgress = useMotionValue(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const container = scrollContainer?.current;
    function updateProgress() {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const scrollTop = container ? container.scrollTop : window.scrollY;
      const viewportHeight = container ? container.clientHeight : window.innerHeight;
      const origin = container ? container.getBoundingClientRect().top + container.clientTop : 0;
      const targetTop = rect.top - origin + scrollTop;
      const distance = Math.max(1, rect.height - viewportHeight);
      scrollYProgress.set(Math.max(0, Math.min(1, (scrollTop - targetTop) / distance)));
    }
    const viewport = container ?? window;
    viewport.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    const observer = new ResizeObserver(updateProgress);
    observer.observe(element);
    if (container) observer.observe(container);
    updateProgress();
    return () => {
      viewport.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
      observer.disconnect();
    };
  }, [scrollContainer, scrollYProgress]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], compact ? [0.7, 0.9] : [1.05, 1]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        minHeight: height,
        boxSizing: 'border-box',
        padding: compact ? '80px 8px' : '120px 48px',
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
    >
      <div style={{ width: '100%', perspective: 1000 }}>
        {header && (
          <motion.div style={{ y: reduced ? 0 : titleY, textAlign: 'center', paddingBottom: 72 }}>{header}</motion.div>
        )}
        <motion.div
          style={{
            rotateX: reduced ? 0 : rotateX,
            scale: reduced ? 1 : scale,
            transformOrigin: 'center center',
            minWidth: 0,
            width: '100%',
            height: compact ? Math.min(cardHeight, 420) : cardHeight,
            marginTop: -48,
            padding: compact ? 8 : 20,
            border: '4px solid #6c6c6c',
            borderRadius: 30,
            background: '#222',
            boxSizing: 'border-box',
            boxShadow: '0 9px 20px #0005, 0 37px 37px #0004, 0 84px 50px #0002, 0 149px 60px #0001',
          }}
        >
          <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 16, background: '#121212' }}>
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
