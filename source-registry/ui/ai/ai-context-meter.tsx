"use client";

// Adapted from SmoothUI's ai-context-meter.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

const SPRING_DEFAULT = { bounce: 0.1, duration: 0.25, type: "spring" as const };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const AI_THEME_STYLES = "__MOVA_AI_DESIGN_TOKENS__";
const VIEWBOX = 32;
const CENTER = VIEWBOX / 2;
const RADIUS = 13;
const STROKE_WIDTH = 3;
const DEFAULT_WARNING_AT = 0.8;
const DEFAULT_DANGER_AT = 0.95;
const WARNING_COLOR = "var(--mova-ai-warning,#986517)";
const DANGER_COLOR = "var(--mova-ai-danger,#a33c3c)";

export type AIContextBreakdownItem = { label: string; tokens: number };

export type AIContextMeterProps = {
  breakdown?: AIContextBreakdownItem[];
  className?: string;
  dangerAt?: number;
  limit: number;
  theme?: "light" | "dark";
  used: number;
  warningAt?: number;
};

const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 10_000) return `${Math.round(tokens / 1000)}k`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
};

export function AIContextMeter({
  breakdown,
  className = "",
  dangerAt = DEFAULT_DANGER_AT,
  limit,
  theme = "light",
  used,
  warningAt = DEFAULT_WARNING_AT,
}: AIContextMeterProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const fraction = limit > 0 ? Math.min(1, Math.max(0, used / limit)) : 0;
  const percent = Math.round(fraction * 100);
  const color = fraction >= dangerAt ? DANGER_COLOR : fraction >= warningAt ? WARNING_COLOR : "currentColor";
  const hasBreakdown = Boolean(breakdown?.length);

  return (
    <div className={`mova-ai-theme relative inline-block ${className}`} data-theme={theme}>
      <style>{AI_THEME_STYLES}</style>
      <button
        aria-expanded={hasBreakdown ? isOpen : undefined}
        aria-label={`Context window ${percent}% used, ${formatTokens(used)} of ${formatTokens(limit)} tokens`}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1 py-0.5 text-[color:var(--mova-ai-ink-secondary,#666)] text-xs transition-colors hover:text-[color:var(--mova-ai-ink,#202020)]"
        disabled={!hasBreakdown}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => hasBreakdown && setIsOpen(true)}
        onMouseEnter={() => hasBreakdown && setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4 -rotate-90" viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <circle cx={CENTER} cy={CENTER} fill="none" r={RADIUS} stroke="currentColor" strokeOpacity={0.2} strokeWidth={STROKE_WIDTH} />
          <motion.circle
            animate={{ stroke: color, strokeDasharray: `${fraction} ${1 - fraction}` }}
            cx={CENTER}
            cy={CENTER}
            fill="none"
            pathLength={1}
            r={RADIUS}
            strokeLinecap="round"
            strokeWidth={STROKE_WIDTH}
            transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
          />
        </svg>
        <span className="tabular-nums">{formatTokens(used)}/{formatTokens(limit)}</span>
      </button>

      <AnimatePresence>
        {isOpen && hasBreakdown ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-surface,#fff)] p-2.5 text-[color:var(--mova-ai-ink,#202020)] shadow-lg"
            exit={shouldReduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, y: 4 }}
            initial={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.96, y: 4 }}
            style={{ transformOrigin: "bottom center" }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT }}
          >
            <ul className="list-none space-y-1">
              {breakdown?.map((item) => (
                <li className="flex items-baseline justify-between gap-3 text-xs" key={item.label}>
                  <span className="truncate text-[color:var(--mova-ai-ink-secondary,#666)]">{item.label}</span>
                  <span className="shrink-0 text-[color:var(--mova-ai-ink,#202020)] tabular-nums">{formatTokens(item.tokens)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default AIContextMeter;
