"use client";

/**
 * Adapted from Reacticx's Blur Carousel.
 * https://reacticx.com/components/blur-carousel
 * https://github.com/rit3zh/reacticx/blob/main/src/components/molecules/blur-carousel/index.tsx
 */

import React, { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";

export type BlurCarouselProps<Item> = {
  data: readonly Item[];
  renderItem: (info: { item: Item; index: number }) => ReactNode;
  keyExtractor?: (item: Item, index: number) => string;
  spacing?: number;
  itemWidth?: number;
  horizontalSpacing?: number;
  className?: string;
  style?: CSSProperties;
  label?: string;
};

type CarouselSlideProps = {
  children: ReactNode;
  index: number;
  total: number;
  position: MotionValue<number>;
  reducedMotion: boolean;
};

function CarouselSlide({ children, index, total, position, reducedMotion }: CarouselSlideProps) {
  const distance = useTransform(position, (value) => Math.min(1, Math.abs(value - index)));
  const scale = useTransform(distance, (value) => 1 - value * 0.15);
  const opacity = useTransform(distance, (value) => 1 - value * 0.5);
  const filter = useTransform(distance, (value) => `blur(${value * 7}px)`);

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}`}
      data-mova-blur-slide={index}
      style={{
        flex: "0 0 var(--mova-blur-width)",
        minWidth: 0,
        boxSizing: "border-box",
        paddingInline: "var(--mova-blur-gap)",
        scrollSnapAlign: "start",
        display: "grid",
        alignItems: "center",
      }}
    >
      <motion.div
        style={{
          overflow: "hidden",
          minWidth: 0,
          borderRadius: 20,
          boxShadow: "0 8px 12px rgb(0 0 0 / 20%)",
          opacity,
          scale: reducedMotion ? 1 : scale,
        }}
      >
        <motion.div style={{ filter: reducedMotion ? "none" : filter }}>{children}</motion.div>
      </motion.div>
    </div>
  );
}

type MouseDrag = {
  pointerId: number;
  startX: number;
  startLeft: number;
  moved: boolean;
};

const carouselCss = `
  [data-mova-blur-viewport] { scroll-snap-type: x mandatory; }
  [data-mova-blur-viewport][data-dragging] { scroll-snap-type: none; }
  [data-mova-blur-viewport]::-webkit-scrollbar { display: none; }
  [data-mova-blur-viewport]:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: -2px;
  }
  @media (pointer: fine) {
    [data-mova-blur-viewport][tabindex] { cursor: grab; }
    [data-mova-blur-viewport][data-dragging] { cursor: grabbing; }
  }
`;

export function BlurCarousel<Item>({
  data,
  renderItem,
  keyExtractor,
  spacing = 20,
  itemWidth,
  horizontalSpacing,
  className,
  style,
  label = "Carousel",
}: BlurCarouselProps<Item>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<MouseDrag | null>(null);
  const suppressClick = useRef(false);
  const targetIndex = useRef<number | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const position = useMotionValue(0);
  const reducedMotion = useReducedMotion() ?? false;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const firstSlide = viewport?.querySelector("[data-mova-blur-slide]");
    if (!viewport || !firstSlide) return;

    const sync = () => {
      const width = firstSlide.getBoundingClientRect().width;
      const current = width ? Math.abs(viewport.scrollLeft) / width : 0;
      position.set(current);
      setActiveIndex(Math.min(data.length - 1, Math.round(current)));
    };
    const observer = new ResizeObserver(sync);
    observer.observe(viewport);
    observer.observe(firstSlide);
    sync();

    return () => {
      observer.disconnect();
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    };
  }, [data.length, itemWidth, horizontalSpacing, position]);

  const slideWidth = (viewport: HTMLDivElement) =>
    viewport.querySelector("[data-mova-blur-slide]")?.getBoundingClientRect().width ?? 0;

  const direction = (viewport: HTMLDivElement) => getComputedStyle(viewport).direction === "rtl" ? -1 : 1;
  const clampIndex = (index: number) => Math.max(0, Math.min(data.length - 1, index));

  const scrollToSlide = (viewport: HTMLDivElement, index: number, instant = false) => {
    const next = clampIndex(index);
    const left = direction(viewport) * next * slideWidth(viewport);
    if (Math.abs(viewport.scrollLeft - left) < 1) return;
    targetIndex.current = next;
    viewport.scrollTo({ left, behavior: instant || reducedMotion ? "instant" : "smooth" });
  };

  const handleScroll = (viewport: HTMLDivElement) => {
    const width = slideWidth(viewport);
    if (!width) return;
    const current = Math.abs(viewport.scrollLeft) / width;
    position.set(current);
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      targetIndex.current = null;
      setActiveIndex(clampIndex(Math.round(position.get())));
    }, 150);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || data.length < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
    const viewport = event.currentTarget;
    const current = targetIndex.current ?? Math.round(position.get());
    let next: number;

    switch (event.key) {
      case "ArrowLeft": next = current - direction(viewport); break;
      case "ArrowRight": next = current + direction(viewport); break;
      case "Home": next = 0; break;
      case "End": next = data.length - 1; break;
      default: return;
    }

    event.preventDefault();
    scrollToSlide(viewport, next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    targetIndex.current = null;
    if (data.length < 2 || event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    const viewport = event.currentTarget;
    if (!drag.moved) {
      if (Math.abs(delta) < 5) return;
      drag.moved = true;
      viewport.dataset.dragging = "";
      viewport.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    viewport.scrollLeft = drag.startLeft - delta;
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;

    const viewport = event.currentTarget;
    const width = slideWidth(viewport);
    suppressClick.current = true;
    delete viewport.dataset.dragging;
    if (width) scrollToSlide(viewport, Math.round(Math.abs(viewport.scrollLeft) / width));
  };

  if (!data.length) return null;

  const width = itemWidth === undefined ? "75%" : `min(100%, ${Math.max(1, itemWidth)}px)`;
  const sideSpace = horizontalSpacing === undefined
    ? "calc((100% - var(--mova-blur-width)) / 2)"
    : `min(${Math.max(0, horizontalSpacing)}px, calc(100% - var(--mova-blur-width)))`;
  const viewportStyle = {
    "--mova-blur-width": width,
    "--mova-blur-side": sideSpace,
    "--mova-blur-gap": `min(${Math.max(0, spacing)}px, calc(var(--mova-blur-width) / 4))`,
    display: "flex",
    width: "100%",
    minWidth: 0,
    overflowX: "auto",
    overscrollBehaviorX: "contain",
    scrollbarWidth: "none",
    paddingBlock: 12,
    scrollPaddingInlineStart: "var(--mova-blur-side)",
    userSelect: "none",
    WebkitUserSelect: "none",
  } satisfies CSSProperties & Record<`--${string}`, string>;

  return (
    <section aria-label={label} aria-roledescription="carousel" className={className} style={style}>
      <style>{carouselCss}</style>
      <div
        ref={viewportRef}
        data-mova-blur-viewport=""
        tabIndex={data.length > 1 ? 0 : undefined}
        aria-label={data.length > 1 ? "Slides" : undefined}
        aria-keyshortcuts={data.length > 1 ? "ArrowLeft ArrowRight Home End" : undefined}
        onKeyDown={handleKeyDown}
        onScroll={(event) => handleScroll(event.currentTarget)}
        onWheel={() => { targetIndex.current = null; }}
        onFocusCapture={(event) => {
          const slide = event.target.closest<HTMLElement>("[data-mova-blur-slide]");
          if (slide) scrollToSlide(event.currentTarget, Number(slide.dataset.movaBlurSlide), true);
        }}
        onDragStart={(event) => {
          if (dragRef.current) event.preventDefault();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onPointerLeave={(event) => {
          if (!dragRef.current?.moved) finishDrag(event);
        }}
        onClickCapture={(event) => {
          if (!suppressClick.current || event.detail === 0) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        style={viewportStyle}
      >
        <span aria-hidden="true" style={{ flex: "0 0 var(--mova-blur-side)" }} />
        {data.map((item, index) => (
          <CarouselSlide
            key={keyExtractor?.(item, index) ?? index}
            index={index}
            total={data.length}
            position={position}
            reducedMotion={reducedMotion}
          >
            {renderItem({ item, index })}
          </CarouselSlide>
        ))}
        <span aria-hidden="true" style={{ flex: "0 0 calc(100% - var(--mova-blur-width) - var(--mova-blur-side))" }} />
      </div>
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", width: 1, height: 1, padding: 0, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}
      >
        {Math.min(activeIndex + 1, data.length)} of {data.length}
      </span>
    </section>
  );
}
