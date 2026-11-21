/*
React web adaptation of https://kinetik-ui.dev/components/fold-panel
*/
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export interface FoldPanelProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
  style?: CSSProperties;
}

const foldSpring = { stiffness: 210, damping: 27, mass: 1 };
const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-current';

export function FoldPanel({
  title, subtitle, leading, children, open, defaultOpen = false, onOpenChange,
  disabled = false, theme = 'dark', className, style,
}: FoldPanelProps) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const expanded = open ?? innerOpen;
  const reduced = useReducedMotion();
  const contentId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const progress = useSpring(expanded ? 1 : 0, foldSpring);
  const rows = useTransform(progress, [0, 1], ['0fr', '1fr']);
  const opacity = useTransform(progress, [0.3, 0.8], [0, 1]);
  const offset = useTransform(progress, [0, 1], [-10, 0]);
  const rotate = useTransform(progress, [0, 1], [0, 180]);
  const dark = theme === 'dark';
  const backgroundColor = useTransform(progress, [0, 1], dark ? ['#0a0a0a', '#1c1c1c'] : ['#fafafa', '#ffffff']);
  const borderColor = useTransform(progress, [0, 1], dark
    ? ['rgba(255,255,255,.08)', 'rgba(255,255,255,.16)']
    : ['rgba(0,0,0,.08)', 'rgba(0,0,0,.16)']);

  useEffect(() => {
    const value = expanded ? 1 : 0;
    if (reduced) progress.jump(value);
    else progress.set(value);
  }, [expanded, progress, reduced]);

  const setContent = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    if (!expanded && element.contains(document.activeElement)) trigger.current?.focus();
    element.inert = !expanded;
  }, [expanded]);

  function toggle() {
    if (open === undefined) setInnerOpen(!expanded);
    onOpenChange?.(!expanded);
  }

  return (
    <motion.div
      className={className}
      whileTap={disabled || reduced ? undefined : { scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 1 }}
      style={{
        width: '100%', border: '1px solid', borderRadius: 20, overflow: 'hidden',
        opacity: disabled ? 0.5 : 1, color: dark ? '#ededed' : '#0a0a0a',
        backgroundColor, borderColor, ...style,
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={focusStyle}
        aria-controls={contentId}
        aria-expanded={expanded}
        disabled={disabled}
        onClick={toggle}
        style={{
          appearance: 'none', display: 'flex', alignItems: 'center', width: '100%',
          minHeight: 64, gap: 12, padding: '12px 16px', border: 0, background: 'none',
          color: 'inherit', font: 'inherit', cursor: disabled ? 'default' : 'pointer',
          textAlign: 'start',
        }}
      >
        {leading != null && (
          <span aria-hidden="true" style={{
            display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0,
            borderRadius: 10, color: dark ? '#7ab2ff' : '#1f5fe0',
            background: dark ? 'rgba(59,130,246,.16)' : 'rgba(31,95,224,.1)',
          }}>
            {leading}
          </span>
        )}
        <span style={{ display: 'grid', flex: 1, minWidth: 0, gap: 2 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 16, lineHeight: 1.2, fontWeight: 600 }}>{title}</span>
          {subtitle && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, lineHeight: 1.3, color: dark ? '#a1a1a1' : '#555' }}>{subtitle}</span>
          )}
        </span>
        <motion.span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, flexShrink: 0, rotate, color: dark ? '#a1a1a1' : '#555' }}>
          <ChevronDown size={16} strokeWidth={1.75} />
        </motion.span>
      </button>
      <motion.div ref={setContent} id={contentId} aria-hidden={!expanded} style={{ display: 'grid', gridTemplateRows: rows }}>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <motion.div style={{ padding: '0 16px 16px', opacity, y: offset }}>
            {children}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
