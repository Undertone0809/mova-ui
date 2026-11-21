'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type GooeyInputProps = {
  label?: string;
  placeholder?: string;
  actionLabel?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  onSubmit?: (value: string) => void;
  onValueChange?: (value: string) => void;
  leading?: ReactNode;
  className?: string;
  theme?: 'light' | 'dark';
};

/** A search capsule pulls away from its icon through a liquid bridge. */
export function GooeyInput({
  label = 'Search',
  placeholder = 'Search Mova…',
  actionLabel = 'Search',
  defaultOpen = false,
  disabled = false,
  onSubmit,
  onValueChange,
  leading,
  className = '',
  theme = 'dark',
}: GooeyInputProps = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const composing = useRef(false);
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const reduced = useReducedMotion();
  const spring = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, duration: 0.4, bounce: 0.25 };
  const icon = leading ?? (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="10.5" cy="10.5" r="7.5" />
      <path d="m16 16 5 5" />
    </svg>
  );
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <form
      className={className}
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim() && !disabled && !composing.current)
          onSubmit?.(value.trim());
      }}
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        minHeight: 76,
        color: theme === 'dark' ? '#1a2926' : '#f4f7f1',
        font: '500 14px/1.4 system-ui, sans-serif',
      }}
    >
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: 'absolute' }}
      >
        <defs>
          <filter id={id} x="-60%" y="-100%" width="220%" height="300%">
            <feGaussianBlur stdDeviation="5" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -10"
            />
            <feComposite in="SourceGraphic" operator="atop" />
          </filter>
        </defs>
      </svg>
      <motion.div
        animate={{ width: open ? 282 : 132 }}
        transition={spring}
        style={{ position: 'relative', height: 44, margin: '16px 0' }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            filter: `url(#${id})`,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            animate={{ width: open ? 232 : 132, x: open ? 50 : 0 }}
            transition={spring}
            style={{
              position: 'absolute',
              height: 44,
              borderRadius: 28,
              background: theme === 'dark' ? '#d9eadc' : '#274b40',
            }}
          />
          <motion.div
            animate={{ scale: open ? 1 : 0, opacity: open ? 1 : 0 }}
            transition={spring}
            style={{
              position: 'absolute',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: theme === 'dark' ? '#d9eadc' : '#274b40',
            }}
          />
        </div>
        <motion.button
          ref={trigger}
          type="button"
          disabled={disabled}
          aria-label={open ? `Close ${label.toLowerCase()}` : label}
          aria-expanded={open}
          onClick={() => {
            if (open) close();
            else {
              setOpen(true);
              requestAnimationFrame(() => input.current?.focus());
            }
          }}
          animate={{ width: open ? 44 : 132 }}
          transition={spring}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: 44,
            border: 0,
            borderRadius: 28,
            color: 'inherit',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: open ? 'center' : 'flex-start',
            gap: 9,
            padding: open ? 0 : '0 16px',
            cursor: 'pointer',
          }}
        >
          {icon}
          {!open && <span>{label}</span>}
        </motion.button>
        <motion.div
          animate={{
            width: open ? 232 : 0,
            opacity: open ? 1 : 0,
            x: open ? 50 : 100,
          }}
          transition={spring}
          style={{
            position: 'absolute',
            height: 44,
            overflow: 'hidden',
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          <input
            ref={input}
            type="search"
            aria-label={label}
            placeholder={placeholder}
            value={value}
            disabled={disabled || !open}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onChange={(event) => {
              setValue(event.target.value);
              onValueChange?.(event.target.value);
            }}
            onBlur={(event) => {
              if (
                !value &&
                !event.currentTarget.form?.contains(event.relatedTarget)
              )
                setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.nativeEvent.isComposing)
                close();
            }}
            style={{
              boxSizing: 'border-box',
              width: '100%',
              height: 44,
              border: 0,
              borderRadius: 28,
              padding: '0 18px',
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              outlineOffset: -3,
            }}
          />
          <button
            type="submit"
            aria-label={actionLabel}
            tabIndex={-1}
            style={{ display: 'none' }}
          />
        </motion.div>
      </motion.div>
    </form>
  );
}
export default GooeyInput;
