/*!
 * Adapted for the web from Reacticx Split View.
 * https://github.com/rit3zh/reacticx/tree/main/src/components/molecules/split-view
 */

"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

export interface SplitViewProps {
  top: ReactNode;
  bottom: ReactNode;
  initialTopHeight?: number;
  minTopHeight?: number;
  minBottomHeight?: number;
  snapPoints?: readonly number[];
  gap?: number;
  height?: number;
  theme?: "dark" | "light";
  className?: string;
  style?: CSSProperties;
  onTopHeightChange?: (height: number) => void;
}

const INSET = 8;
const FADE_DISTANCE = 60;
const FLING_THRESHOLD = 500;
const SNAP_BIAS = 20;
const KEYBOARD_STEP = 10;
const SPRING = { type: "spring", damping: 12, stiffness: 150, mass: 0.5 } as const;
const PALETTE = {
  dark: { root: "#121212", pane: "#1a1a1a", handle: "rgba(255,255,255,0.35)", text: "#f2f2f5" },
  light: { root: "#eaeaea", pane: "#fafafa", handle: "rgba(0,0,0,0.35)", text: "#171717" },
};

type Drag = {
  pointerId: number;
  originY: number;
  originHeight: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function dimension(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function previousPoint(points: readonly number[], before: number) {
  for (let index = points.length - 1; index >= 0; index--) {
    if (points[index] < before) return points[index];
  }
  return undefined;
}

function resolveSnap(current: number, velocity: number, points: readonly number[]) {
  if (velocity > FLING_THRESHOLD) {
    return points.find((point) => point > current + SNAP_BIAS) ?? points[points.length - 1];
  }
  if (velocity < -FLING_THRESHOLD) {
    return previousPoint(points, current - SNAP_BIAS) ?? points[0];
  }
  return points.reduce((nearest, point) =>
    Math.abs(point - current) < Math.abs(nearest - current) ? point : nearest,
  );
}

const paneStyle: CSSProperties = {
  borderRadius: 22,
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
};

export function SplitView({
  top,
  bottom,
  initialTopHeight = 300,
  minTopHeight = 50,
  minBottomHeight = 50,
  snapPoints,
  gap = 28,
  height = 480,
  theme = "dark",
  className,
  style,
  onTopHeightChange,
}: SplitViewProps) {
  const topId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const animationRef = useRef<{ stop(): void } | null>(null);
  const reducedMotion = useReducedMotion();
  const palette = PALETTE[theme];
  const shellHeight = dimension(height, 480);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const availableHeight = measuredHeight ?? Math.max(0, shellHeight - INSET * 2);
  const handleHeight = Math.min(dimension(gap, 28), availableHeight);
  const panesHeight = availableHeight - handleHeight;
  const maxTop = Math.max(0, panesHeight - dimension(minBottomHeight, 50));
  const minTop = Math.min(dimension(minTopHeight, 50), maxTop);
  const constrained = minTop === maxTop;
  const customPoints = snapPoints?.filter(Number.isFinite).map((point) => clamp(point, minTop, maxTop));
  const points = customPoints?.length
    ? [...new Set(customPoints)].sort((a, b) => a - b)
    : [minTop, (minTop + maxTop) / 2, maxTop];

  const initialHeight = clamp(dimension(initialTopHeight, 300), minTop, maxTop);
  const topHeight = useMotionValue(initialHeight);
  const [reportedHeight, setReportedHeight] = useState(initialHeight);
  const currentHeight = clamp(reportedHeight, minTop, maxTop);
  const topOpacity = useTransform(topHeight, [minTop, minTop + FADE_DISTANCE], [0.2, 1]);
  const bottomOpacity = useTransform(topHeight, [maxTop - FADE_DISTANCE, maxTop], [1, 0.2]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const computed = window.getComputedStyle(root);
      const padding = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
      setMeasuredHeight(Math.max(0, root.clientHeight - padding));
    };

    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(([entry]) => setMeasuredHeight(entry.contentRect.height));
      observer.observe(root);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [shellHeight]);

  useEffect(() => {
    animationRef.current?.stop();
    const bounded = clamp(topHeight.get(), minTop, maxTop);
    topHeight.jump(bounded);
    setReportedHeight(bounded);
    return () => animationRef.current?.stop();
  }, [maxTop, minTop, topHeight]);

  function settle(target: number, announce = false) {
    const from = topHeight.get();
    animationRef.current?.stop();
    setReportedHeight(target);
    if (announce) setAnnouncement(`Top pane: ${Math.round(target)} pixels`);

    if (reducedMotion || from === target) {
      topHeight.jump(target);
    } else {
      const down = from < target;
      animationRef.current = animate(from, target, {
        ...SPRING,
        onUpdate(latest) {
          const reached = down ? latest >= target : latest <= target;
          topHeight.set(reached ? target : latest);
          if (reached) animationRef.current?.stop();
        },
      });
    }
    onTopHeightChange?.(target);
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || dragRef.current || constrained) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      originY: event.clientY,
      originHeight: topHeight.get(),
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    setAnnouncement("");
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    const distance = event.clientY - drag.originY;
    if (!drag.moved) {
      if (Math.abs(distance) < 2) return;
      animationRef.current?.stop();
      drag.originHeight = topHeight.get();
      drag.moved = true;
      setDragging(true);
    }

    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) {
      const velocity = (1000 * (event.clientY - drag.lastY)) / elapsed;
      drag.velocity = elapsed > 80 ? velocity : drag.velocity * 0.25 + velocity * 0.75;
      drag.lastTime = event.timeStamp;
      drag.lastY = event.clientY;
    }
    topHeight.set(clamp(drag.originHeight + distance, minTop, maxTop));
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    const released = event.type === "pointerup";
    if (released && event.clientY !== drag.lastY) moveDrag(event);
    dragRef.current = null;
    if (!drag.moved) return;

    setDragging(false);
    const velocity = released && event.timeStamp - drag.lastTime < 100 ? drag.velocity : 0;
    settle(resolveSnap(topHeight.get(), velocity, points), true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (constrained || dragRef.current) return;
    const current = currentHeight;
    let target: number;

    switch (event.key) {
      case "ArrowUp": target = current - KEYBOARD_STEP; break;
      case "ArrowDown": target = current + KEYBOARD_STEP; break;
      case "PageUp": target = previousPoint(points, current) ?? minTop; break;
      case "PageDown": target = points.find((point) => point > current) ?? maxTop; break;
      case "Home": target = minTop; break;
      case "End": target = maxTop; break;
      default: return;
    }

    event.preventDefault();
    const bounded = clamp(target, minTop, maxTop);
    if (bounded !== current) settle(bounded);
  }

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        width: "100%",
        height: shellHeight,
        padding: INSET,
        overflow: "hidden",
        borderRadius: 34,
        color: palette.text,
        backgroundColor: palette.root,
        ...style,
      }}
    >
      <style>{`
        [data-mova-split-handle]::before { position: absolute; inset: -12px 0; content: ""; }
        [data-mova-split-handle]:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
      `}</style>
      <motion.div
        id={topId}
        style={{ ...paneStyle, flexShrink: 0, backgroundColor: palette.pane, height: topHeight, opacity: constrained ? 1 : topOpacity }}
      >
        {top}
      </motion.div>
      <div
        role="separator"
        tabIndex={constrained ? -1 : 0}
        aria-label="Resize top pane"
        aria-orientation="horizontal"
        aria-controls={topId}
        aria-valuemin={minTop}
        aria-valuemax={maxTop}
        aria-valuenow={currentHeight}
        aria-valuetext={`${Math.round(currentHeight)} pixels`}
        aria-disabled={constrained || undefined}
        data-mova-split-handle=""
        onKeyDown={handleKeyDown}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          placeItems: "center",
          flex: `0 0 ${handleHeight}px`,
          borderRadius: 6,
          cursor: constrained ? "default" : "row-resize",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ scale: dragging && !reducedMotion ? 1.18 : 1 }}
          transition={reducedMotion ? { duration: 0 } : SPRING}
          style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: palette.handle }}
        />
      </div>
      <motion.div style={{ ...paneStyle, flex: "1 1 0", backgroundColor: palette.pane, opacity: constrained ? 1 : bottomOpacity }}>
        {bottom}
      </motion.div>
      <span role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
        {announcement}
      </span>
    </div>
  );
}

export default SplitView;
