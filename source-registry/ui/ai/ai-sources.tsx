"use client";

// Adapted from SmoothUI's ai-sources.
import { ChevronRight, Globe } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useId, useState } from "react";

const SPRING_DEFAULT = { bounce: 0.1, duration: 0.25, type: "spring" as const };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const STACK_LIMIT = 3;
const STACK_OVERLAP_PX = 8;
const FAN_GAP_PX = 3;
const ROW_STAGGER = 0.035;
const AI_THEME_STYLES = "__MOVA_AI_DESIGN_TOKENS__";

export type AISource = { favicon?: ReactNode; id: string; snippet?: string; title: string; url: string };
export type AISourcesProps = { className?: string; defaultOpen?: boolean; label?: string; sources: AISource[]; theme?: "light" | "dark" };

const hostOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
};

const Favicon = ({ size, source }: { size: number; source: AISource }) => (
  <span className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-surface,#fff)] text-[color:var(--mova-ai-ink-secondary,#666)]" style={{ height: size, width: size }}>
    <Globe aria-hidden="true" size={size * 0.6} />
    {source.favicon ? <span className="absolute inset-0 flex size-full items-center justify-center *:size-full *:object-cover">{source.favicon}</span> : null}
  </span>
);

export function AISources({ className = "", defaultOpen = false, label = "Sources", sources, theme = "light" }: AISourcesProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isHovered, setIsHovered] = useState(false);
  const listId = useId();
  const stacked = sources.slice(0, STACK_LIMIT);
  const overflow = sources.length - stacked.length;
  const fanned = isHovered && !isOpen && !shouldReduceMotion;

  return (
    <div className={`mova-ai-theme w-full ${className}`} data-theme={theme}>
      <style>{AI_THEME_STYLES}</style>
      <button
        aria-expanded={isOpen}
        aria-controls={listId}
        className="flex cursor-pointer items-center gap-2 rounded-lg py-1 text-[color:var(--mova-ai-ink-secondary,#666)] text-sm transition-colors hover:text-[color:var(--mova-ai-ink,#202020)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mova-ai-accent,#454545)]"
        onBlur={() => setIsHovered(false)}
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => setIsHovered(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        type="button"
      >
        <span className="flex items-center">
          {stacked.map((source, index) => (
            <motion.span
              animate={{ marginLeft: index === 0 ? 0 : fanned ? FAN_GAP_PX : -STACK_OVERLAP_PX }}
              className="relative block"
              key={source.id}
              style={{ zIndex: stacked.length - index }}
              transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
            >
              <Favicon size={18} source={source} />
            </motion.span>
          ))}
          {overflow > 0 ? <span className="ml-1 tabular-nums">+{overflow}</span> : null}
        </span>
        <span>{label}</span>
        <motion.span animate={{ rotate: isOpen ? 90 : 0 }} className="flex size-4 items-center justify-center" transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}>
          <ChevronRight aria-hidden="true" size={14} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.ul
            id={listId}
            animate={{ height: "auto", opacity: 1 }}
            className="mt-1 list-none overflow-hidden"
            exit={shouldReduceMotion ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            initial={shouldReduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { height: SPRING_DEFAULT, opacity: { duration: 0.18, ease: EASE_OUT } }}
          >
            {sources.map((source, index) => (
              <motion.li animate={{ opacity: 1, y: 0 }} initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }} key={source.id} transition={shouldReduceMotion ? { duration: 0 } : { ...SPRING_DEFAULT, delay: index * ROW_STAGGER }}>
                <a className="flex items-start gap-2.5 rounded-lg px-1 py-1.5 no-underline transition-colors hover:bg-[var(--mova-ai-hover,#f1f1f1)]" href={source.url} rel="noopener noreferrer" target="_blank">
                  <motion.span className="mt-0.5 block shrink-0" transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}>
                    <Favicon size={18} source={source} />
                  </motion.span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[color:var(--mova-ai-ink,#202020)] text-sm">{source.title}</span>
                    <span className="block truncate text-[color:var(--mova-ai-ink-secondary,#666)] text-xs">{source.snippet ?? hostOf(source.url)}</span>
                  </span>
                </a>
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default AISources;
