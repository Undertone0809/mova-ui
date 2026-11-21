"use client";

// Adapted from SmoothUI's ai-tool-call.
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";

const SPRING_DEFAULT = { bounce: 0.1, duration: 0.25, type: "spring" as const };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const BADGE_VIEWBOX = 24;
const BADGE_CENTER = BADGE_VIEWBOX / 2;
const RING_RADIUS = 8;
const CHECK_PATH = "M 8.5 12.2 L 11 14.8 L 15.8 9.6";
const CROSS_PATHS = ["M 9 9 L 15 15", "M 15 9 L 9 15"] as const;
const SPIN_SECONDS = 0.9;
const PENDING_PULSE_SECONDS = 1.6;
const AI_THEME_STYLES = "__MOVA_AI_DESIGN_TOKENS__";

export type AIToolCallStatus = "pending" | "running" | "success" | "error";
export type AIToolCallProps = {
  args?: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  name: string;
  result?: ReactNode;
  status?: AIToolCallStatus;
  summary?: string;
  theme?: "light" | "dark";
};

const STATUS_LABEL: Record<AIToolCallStatus, string> = {
  error: "Failed",
  pending: "Queued",
  running: "Running",
  success: "Done",
};

function AIToolCallBadge({ status, shouldReduceMotion }: { shouldReduceMotion: boolean; status: AIToolCallStatus }) {
  const isRunning = status === "running";
  const isPending = status === "pending";
  const ringColor = status === "success" ? "var(--mova-ai-success,#28734d)" : status === "error" ? "var(--mova-ai-danger,#a33c3c)" : "currentColor";

  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center text-muted-foreground">
      <svg aria-hidden="true" className="size-5 overflow-visible" viewBox={`0 0 ${BADGE_VIEWBOX} ${BADGE_VIEWBOX}`}>
        <motion.g
          animate={shouldReduceMotion || !isRunning ? undefined : { rotate: 360 }}
          style={{ transformBox: "view-box", transformOrigin: "center" }}
          transition={{ duration: SPIN_SECONDS, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
        >
          <motion.circle
            animate={{
              stroke: ringColor,
              strokeDasharray: isRunning ? "0.68 0.32" : "1 0",
              strokeOpacity: isPending && !shouldReduceMotion ? [0.35, 1, 0.35] : 1,
            }}
            cx={BADGE_CENTER}
            cy={BADGE_CENTER}
            fill="none"
            pathLength={1}
            r={RING_RADIUS}
            strokeLinecap="round"
            strokeWidth={2}
            transition={{
              stroke: shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT },
              strokeDasharray: shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT },
              strokeOpacity: shouldReduceMotion ? { duration: 0 } : { duration: PENDING_PULSE_SECONDS, repeat: Number.POSITIVE_INFINITY },
            }}
          />
        </motion.g>
        <AnimatePresence initial={false}>
          {status === "success" ? (
            <motion.path
              animate={{ opacity: 1, pathLength: 1 }}
              d={CHECK_PATH}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              fill="none"
              initial={shouldReduceMotion ? { opacity: 1, pathLength: 1 } : { opacity: 1, pathLength: 0 }}
              key="check"
              stroke={ringColor}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.2}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT }}
            />
          ) : null}
          {status === "error" ? CROSS_PATHS.map((path, index) => (
            <motion.path
              animate={{ opacity: 1, pathLength: 1 }}
              d={path}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              fill="none"
              initial={shouldReduceMotion ? { opacity: 1, pathLength: 1 } : { opacity: 1, pathLength: 0 }}
              key={path}
              stroke={ringColor}
              strokeLinecap="round"
              strokeWidth={2.2}
              transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.06, duration: 0.16, ease: EASE_OUT }}
            />
          )) : null}
        </AnimatePresence>
      </svg>
    </span>
  );
}

export function AIToolCall({ args, className = "", defaultOpen = false, name, result, status = "pending", summary, theme = "light" }: AIToolCallProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasDetail = Boolean(args || result);

  return (
    <div className={`mova-ai-theme w-full overflow-hidden rounded-lg border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-surface,#fff)] text-[color:var(--mova-ai-ink,#202020)] ${className}`} data-theme={theme}>
      <style>{AI_THEME_STYLES}</style>
      <button
        aria-expanded={hasDetail ? isOpen : undefined}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--mova-ai-accent,#454545)] hover:bg-[color-mix(in_srgb,var(--mova-ai-hover,#f1f1f1)_70%,transparent)]"
        disabled={!hasDetail}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <AIToolCallBadge shouldReduceMotion={Boolean(shouldReduceMotion)} status={status} />
        <span className="min-w-0 flex-1"><span className="block truncate font-medium font-mono text-[color:var(--mova-ai-ink,#202020)] text-xs">{name}</span></span>
        {summary ? <span className="max-w-[40%] truncate text-[color:var(--mova-ai-ink-secondary,#666)] text-xs">{summary}</span> : null}
        <span className="sr-only">{STATUS_LABEL[status]}</span>
        {hasDetail ? (
          <motion.span animate={{ rotate: isOpen ? 90 : 0 }} className="flex size-4 shrink-0 items-center justify-center text-[color:var(--mova-ai-ink-secondary,#666666)]" transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}>
            <ChevronRight aria-hidden="true" size={14} />
          </motion.span>
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && hasDetail ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={shouldReduceMotion ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            initial={shouldReduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { height: SPRING_DEFAULT, opacity: { duration: 0.18, ease: EASE_OUT } }}
          >
            <div className="space-y-2 border-[var(--mova-ai-border,#dedede)] border-t px-3 py-2.5 text-xs">
              {args ? <div><p className="mb-1 text-[10px] text-[color:var(--mova-ai-ink-secondary,#666666)] uppercase tracking-wide">Arguments</p><div className="overflow-x-auto font-mono text-[color:var(--mova-ai-ink,#202020)]">{args}</div></div> : null}
              {result ? <div><p className="mb-1 text-[10px] text-[color:var(--mova-ai-ink-secondary,#666666)] uppercase tracking-wide">Result</p><div className="overflow-x-auto text-[color:var(--mova-ai-ink,#202020)]">{result}</div></div> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default AIToolCall;
