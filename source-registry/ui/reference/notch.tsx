'use client';

import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export interface NotchOption {
  id: string;
  label: string;
  icon?: ReactNode;
}
export interface NotchItem {
  id: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  options?: readonly NotchOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (id: string) => void;
}
export interface NotchProps {
  items: readonly NotchItem[];
  label?: string;
  placement?: 'top' | 'bottom';
  fixed?: boolean;
  activeId?: string;
  defaultActiveId?: string;
  onActiveChange?: (id: string) => void;
  onItemChange?: (itemId: string, optionId: string) => void;
  className?: string;
  theme?: 'light' | 'dark';
}
/** A spring-shaped floating chooser that grows from compact groups into an option list. */
export function Notch({
  items,
  label = 'Quick settings',
  placement = 'bottom',
  fixed = true,
  activeId,
  defaultActiveId,
  onActiveChange,
  onItemChange,
  className = '',
  theme = 'dark',
}: NotchProps) {
  const [selected, setSelected] = useState(defaultActiveId ?? items[0]?.id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const shell = useRef<HTMLElement>(null);
  const returningTo = useRef<string | null>(null);
  const panelId = useId();
  const reduced = useReducedMotion();
  const openItem = items.find((item) => item.id === expanded);
  function close() {
    returningTo.current = expanded;
    setExpanded(null);
  }
  useLayoutEffect(() => {
    if (expanded) {
      const options = shell.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
      const option = Array.from(options ?? []).find(button => button.getAttribute('aria-selected') === 'true') ?? options?.[0];
      option?.focus({ preventScroll: true });
    } else if (returningTo.current) {
      const groups = shell.current?.querySelectorAll<HTMLButtonElement>('[data-notch-group]');
      Array.from(groups ?? []).find(button => button.dataset.notchGroup === returningTo.current)?.focus({ preventScroll: true });
      returningTo.current = null;
    }
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!shell.current?.contains(event.target as Node)) setExpanded(null);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [expanded]);
  const background = theme === 'dark' ? '#1a2825' : '#edf1e8';
  const foreground = theme === 'dark' ? '#e4eddf' : '#233e31';
  const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: 0,
    background: 'transparent',
    color: 'inherit',
    borderRadius: 8,
    padding: '10px 13px',
    cursor: 'pointer',
    font: '500 12px/1.4 system-ui',
    whiteSpace: 'nowrap' as const,
  };
  return (
    <motion.nav
      ref={shell}
      layout
      aria-label={label}
      className={className}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && openItem) {
          event.stopPropagation();
          close();
        }
        if (
          openItem &&
          ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
        ) {
          event.preventDefault();
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (index +
                    (event.key === 'ArrowDown' ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          buttons[next]?.focus();
        }
      }}
      initial={
        reduced
          ? false
          : {
              opacity: 0,
              y: placement === 'top' ? -30 : 30,
              filter: 'blur(6px)',
            }
      }
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: 'spring', stiffness: 380, damping: 34 }
      }
      style={{
        position: fixed ? 'fixed' : 'relative',
        ...(fixed
          ? {
              left: '50%',
              translateX: '-50%',
              [placement]: 'max(16px, env(safe-area-inset-bottom))',
            }
          : {}),
        zIndex: 40,
        display: 'flex',
        width: 'fit-content',
        maxWidth: '100%',
        margin: '0 auto',
        padding: 4,
        overflow: 'hidden',
        borderRadius: 14,
        border: '1px solid #7a92804d',
        background,
        color: foreground,
        boxShadow: '0 10px 35px #0003',
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {openItem?.options ? (
          <motion.div
            key={openItem.id}
            id={panelId}
            role="listbox"
            aria-label={openItem.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'grid', gap: 4, padding: 4 }}
          >
            {openItem.options.map((option, index) => {
              const current =
                openItem.value ??
                values[openItem.id] ??
                openItem.defaultValue ??
                openItem.options?.[0]?.id;
              return (
                <motion.button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={current === option.id}
                  initial={
                    reduced
                      ? false
                      : { opacity: 0, y: -10, filter: 'blur(4px)' }
                  }
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    delay: reduced ? 0 : index * 0.045 + 0.08,
                    type: 'spring',
                    stiffness: 420,
                    damping: 30,
                  }}
                  style={{
                    ...itemStyle,
                    justifyContent: 'space-between',
                    minWidth: 190,
                    background:
                      current === option.id ? '#658c6555' : 'transparent',
                  }}
                  onClick={() => {
                    setValues((previous) => ({
                      ...previous,
                      [openItem.id]: option.id,
                    }));
                    openItem.onChange?.(option.id);
                    onItemChange?.(openItem.id, option.id);
                    close();
                  }}
                >
                  <span
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    {option.icon}
                    {option.label}
                  </span>
                  {current === option.id && <span aria-hidden="true">●</span>}
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="groups"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {items.map((item, index) => {
              const value =
                item.value ??
                values[item.id] ??
                item.defaultValue ??
                item.options?.[0]?.id;
              const selectedOption = item.options?.find(
                (option) => option.id === value,
              );
              return (
                <Fragment key={item.id}>
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 1,
                        height: 20,
                        borderLeft: '1px dotted #7a928080',
                      }}
                    />
                  )}
                  <button
                    data-notch-group={item.id}
                    type="button"
                    aria-haspopup={item.options ? 'listbox' : undefined}
                    aria-expanded={item.options ? false : undefined}
                    aria-current={
                      !item.options && (activeId ?? selected) === item.id
                        ? 'page'
                        : undefined
                    }
                    style={itemStyle}
                    onClick={() => {
                      if (item.options?.length) {
                        setExpanded(item.id);
                      } else {
                        setSelected(item.id);
                        onActiveChange?.(item.id);
                        if (item.href) window.location.assign(item.href);
                      }
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {selectedOption && (
                      <span style={{ opacity: 0.55 }}>
                        {selectedOption.label}
                      </span>
                    )}
                  </button>
                </Fragment>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
export default Notch;
