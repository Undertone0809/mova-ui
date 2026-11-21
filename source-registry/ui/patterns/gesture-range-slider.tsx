/*!
 * Adapted for the web from Reacticx Range Slider.
 * https://github.com/rit3zh/reacticx/tree/main/src/components/molecules/range-slider
 */

"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";

export interface GestureRangeSliderProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showTicks?: boolean;
  disabled?: boolean;
  trackColor?: string;
  fillColor?: string;
  thumbColor?: string;
  tickColor?: string;
  style?: CSSProperties;
  accessibilityLabel?: string;
  className?: string;
  theme?: "dark" | "light";
}

const TRACK_HEIGHT = 40;
const THUMB_WIDTH = 6;
const THUMB_HEIGHT = 20;
const TICK_SIZE = 4;
const TICK_INSET = 18;
const SPRING_GLIDE = { stiffness: 700, damping: 50, mass: 0.5 };
const SPRING_BOUNCY = { type: "spring", stiffness: 500, damping: 14, mass: 0.7 } as const;
const PALETTE = {
  dark: { track: "rgba(120,120,128,0.22)", fill: "rgba(255,255,255,0.16)", thumb: "#ffffff", tick: "rgba(255,255,255,0.25)", focus: "#ffffff" },
  light: { track: "rgba(120,120,128,0.20)", fill: "rgba(0,0,0,0.14)", thumb: "#171717", tick: "rgba(0,0,0,0.32)", focus: "#171717" },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function decimalPlaces(value: number) {
  const [mantissa, exponent = "0"] = String(value).split("e");
  return Math.max(0, (mantissa.split(".")[1]?.length ?? 0) - Number(exponent));
}

function thumbPosition(fraction: number, extra = 0) {
  const ratio = clamp(fraction, 0, 1);
  return `max(${extra}px, calc(${ratio * 100}% + ${extra - ratio * THUMB_WIDTH}px))`;
}

const centerVertically = {
  position: "absolute",
  pointerEvents: "none",
  top: "50%",
} as const;

export function GestureRangeSlider({
  value,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  showTicks = true,
  disabled = false,
  trackColor,
  fillColor,
  thumbColor,
  tickColor,
  style,
  accessibilityLabel = "Value",
  className,
  theme = "dark",
}: GestureRangeSliderProps) {
  const minimum = Number.isFinite(min) ? min : 0;
  const maximum = Number.isFinite(max) ? Math.max(minimum, max) : Math.max(minimum, 100);
  const range = maximum - minimum;
  const increment = Number.isFinite(step) && step > 0 ? step : 1;
  const precision = Math.max(decimalPlaces(minimum), decimalPlaces(increment));
  const canAdjust = !disabled && range > 0 && Number.isFinite(range);
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  const pointerId = useRef<number | null>(null);
  const raw = value ?? internal;
  const current = clamp(Number.isFinite(raw) ? raw : minimum, minimum, maximum);
  const lastValue = useRef(current);
  const fraction = range > 0 && Number.isFinite(range) ? (current - minimum) / range : 0;
  const palette = PALETTE[theme];
  const reducedMotion = useReducedMotion();
  const position = useSpring(fraction, SPRING_GLIDE);
  const thumbLeft = useTransform(position, (ratio) => thumbPosition(ratio));
  const fillWidth = useTransform(position, (ratio) => thumbPosition(ratio, THUMB_WIDTH / 2));

  useEffect(() => {
    if (controlled || pointerId.current === null) lastValue.current = current;
    if (reducedMotion) position.jump(fraction);
    else position.set(fraction);
  }, [controlled, current, fraction, position, reducedMotion]);

  function commit(next: number) {
    if (lastValue.current === next) return;
    lastValue.current = next;
    if (!controlled) setInternal(next);
    onValueChange?.(next);
  }

  function valueFromStep(index: number) {
    const stepped = minimum + index * increment;
    const rounded = precision <= 100 ? Number(stepped.toFixed(precision)) : stepped;
    return clamp(rounded, minimum, maximum);
  }

  function updateFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    commit(valueFromStep(Math.round((ratio * range) / increment)));
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!canAdjust || event.button !== 0 || pointerId.current !== null) return;
    pointerId.current = event.pointerId;
    lastValue.current = current;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromPointer(event);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (canAdjust && pointerId.current === event.pointerId) updateFromPointer(event);
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (pointerId.current !== event.pointerId) return;
    if (canAdjust && event.type === "pointerup") updateFromPointer(event);
    pointerId.current = null;
    setDragging(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!canAdjust || pointerId.current !== null) return;
    const index = (current - minimum) / increment;
    const nearestIndex = Math.round(index);
    const onStep = valueFromStep(nearestIndex) === current;
    const nextIndex = onStep ? nearestIndex + 1 : Math.ceil(index);
    const previousIndex = onStep ? nearestIndex - 1 : Math.floor(index);
    let target: number;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp": target = valueFromStep(nextIndex); break;
      case "ArrowLeft":
      case "ArrowDown": target = valueFromStep(previousIndex); break;
      case "PageUp": target = valueFromStep(nextIndex + 9); break;
      case "PageDown": target = valueFromStep(previousIndex - 9); break;
      case "Home": target = minimum; break;
      case "End": target = maximum; break;
      default: return;
    }

    event.preventDefault();
    lastValue.current = current;
    commit(target);
  }

  const tickSteps = Math.floor(range / increment);
  const showMarkers = showTicks && tickSteps > 0 && tickSteps <= 50;

  return (
    <div
      role="slider"
      aria-label={accessibilityLabel}
      aria-orientation="horizontal"
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={current}
      aria-disabled={!canAdjust || undefined}
      tabIndex={canAdjust ? 0 : -1}
      data-mova-gesture-range=""
      className={className}
      onKeyDown={handleKeyDown}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      style={{
        position: "relative",
        width: "100%",
        height: TRACK_HEIGHT,
        boxSizing: "border-box",
        overflow: "hidden",
        borderRadius: 10,
        cursor: canAdjust ? "pointer" : "default",
        touchAction: canAdjust ? "none" : "auto",
        userSelect: "none",
        color: palette.focus,
        backgroundColor: trackColor ?? palette.track,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <style>{`[data-mova-gesture-range]:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }`}</style>
      <motion.span
        aria-hidden="true"
        style={{
          position: "absolute",
          pointerEvents: "none",
          top: 0,
          bottom: 0,
          left: 0,
          width: fillWidth,
          backgroundColor: fillColor ?? palette.fill,
        }}
      />
      {showMarkers && Array.from({ length: tickSteps + 1 }, (_, index) => {
        const ratio = index / tickSteps;
        return (
          <span
            key={index}
            aria-hidden="true"
            style={{
              ...centerVertically,
              width: TICK_SIZE,
              height: TICK_SIZE,
              marginTop: -TICK_SIZE / 2,
              left: `clamp(0px, calc(${ratio * 100}% + ${TICK_INSET * (1 - 2 * ratio) - TICK_SIZE / 2}px), 100%)`,
              borderRadius: "50%",
              backgroundColor: tickColor ?? palette.tick,
            }}
          />
        );
      })}
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ scaleY: dragging && canAdjust && !reducedMotion ? 1.35 : 1 }}
        transition={reducedMotion ? { duration: 0 } : SPRING_BOUNCY}
        style={{
          ...centerVertically,
          left: thumbLeft,
          width: THUMB_WIDTH,
          height: THUMB_HEIGHT,
          marginTop: -THUMB_HEIGHT / 2,
          borderRadius: 3,
          backgroundColor: thumbColor ?? palette.thumb,
        }}
      />
    </div>
  );
}

export default GestureRangeSlider;
