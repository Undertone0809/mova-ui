import React from 'react';

/** Adapted from Rudder: https://github.com/Undertone0809/rudder-oss
 * Modified: scoped standalone styles, explicit themes and Luma pill sizing.
 * Ported from ui/src/components/ui/button.tsx,
 * PrimaryRail.tsx and index.css's control-hover / rail-utility-button rules.
 * Text actions use Messenger.tsx's outline/sm button, with Luma pill sizing.
 * Theme tokens are scoped here; no Rudder app, Tailwind or motion dependency.
 */
export const insetButtonStyles = `
.mova-inset-button {
  --surface-elevated: oklch(0.996 0.001 95);
  --surface-shell: oklch(0.963 0.003 95);
  --ink-strong: oklch(0.205 0.004 95);
  --ink-base: oklch(0.315 0.004 92);
  --border-soft: oklch(0.9 0.003 95);
  --border-base: oklch(0.84 0.004 95);
  --sidebar: color-mix(in oklab, var(--surface-shell) 94%, white);
  --sidebar-foreground: var(--ink-base);
  --sidebar-border: color-mix(in oklab, var(--border-soft) 92%, white);
  --control-hover-core: var(--surface-elevated);
  --control-hover-core-shadow: inset 0 1px 0 color-mix(in oklab, white 14%, transparent), 0 2px 7px color-mix(in oklab, var(--ink-strong) 12%, transparent), 0 0 0 1px color-mix(in oklab, var(--border-soft) 52%, transparent);
  position: relative; isolation: isolate; display: inline-flex;
  align-items: center; justify-content: center; flex-shrink: 0;
  box-sizing: border-box; height: 2.5rem; padding: 0 .95rem;
  border: 1px solid var(--border-base); border-radius: 999px;
  background: var(--surface-elevated); color: var(--ink-strong);
  font: inherit; font-size: .875rem; font-weight: 500; line-height: 1.25rem;
  white-space: nowrap; cursor: pointer; outline: none;
  transition-property: color, background-color, border-color, box-shadow, opacity, transform, scale;
  transition-duration: 150ms; transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
.mova-inset-button[data-theme="dark"] {
  --surface-elevated: oklch(0.282 0.004 95);
  --surface-shell: oklch(0.225 0.003 95);
  --ink-strong: oklch(0.955 0.001 95);
  --ink-base: oklch(0.88 0.002 95);
  --border-soft: oklch(0.35 0.004 95);
  --border-base: oklch(0.44 0.004 95);
  --sidebar: color-mix(in oklab, var(--surface-shell) 96%, black);
  --sidebar-border: color-mix(in oklab, var(--border-soft) 94%, black);
  --control-hover-core: color-mix(in oklab, var(--surface-elevated) 84%, white);
  --control-hover-core-shadow: inset 0 1px 0 color-mix(in oklab, white 9%, transparent);
}
.mova-inset-button::before {
  content: ""; position: absolute; z-index: -1; inset: 4px; border-radius: inherit;
  background: var(--control-hover-core); box-shadow: var(--control-hover-core-shadow);
  backdrop-filter: blur(16px) saturate(118%); opacity: 0; pointer-events: none;
  transform: scale(0.82);
  transition: opacity 160ms ease, transform 190ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.mova-inset-button:is(:hover, :focus-visible, :active, [data-state="open"]):not(:disabled):not([aria-disabled="true"])::before { opacity: 1; transform: scale(1); }
.mova-inset-button:active:not(:disabled):not([aria-disabled="true"])::before { transform: scale(0.95); }
.mova-inset-button[data-theme="light"][data-variant="text"]::before { content: none; }
.mova-inset-button[data-theme="light"][data-variant="text"]:is(:hover, :focus-visible, [data-state="open"]):not(:disabled):not([aria-disabled="true"]) { background: color-mix(in oklab, var(--surface-elevated) 94%, black); }
.mova-inset-button[data-theme="light"][data-variant="text"]:is(:active, [data-state="open"]):not(:disabled):not([aria-disabled="true"]) { background: color-mix(in oklab, var(--surface-elevated) 89%, black); }
.mova-inset-button:focus-visible { outline: 3px solid color-mix(in oklab, var(--ink-base) 25%, transparent); outline-offset: 1px; }
.mova-inset-button[data-variant="create"] {
  width: 36px; height: 36px; padding: 0; overflow: hidden; backdrop-filter: blur(22px);
  --control-hover-core: color-mix(in oklab, white 88%, transparent);
  --control-hover-core-shadow: 0 2px 6px color-mix(in oklab, var(--sidebar-foreground) 12%, transparent), 0 0 0 1px color-mix(in oklab, var(--sidebar-foreground) 4%, transparent);
  border-color: color-mix(in oklab, var(--sidebar-border) 76%, white);
  background: color-mix(in oklab, var(--sidebar-foreground) 8%, var(--sidebar));
  color: color-mix(in oklab, var(--sidebar-foreground) 88%, var(--sidebar));
  box-shadow: 0 6px 18px -16px rgb(15 23 42 / 0.55);
}
.mova-inset-button[data-theme="dark"][data-variant="create"] {
  --control-hover-core: color-mix(in oklab, var(--sidebar-foreground) 20%, var(--sidebar));
  --control-hover-core-shadow: inset 0 1px 0 color-mix(in oklab, white 10%, transparent);
  border-color: color-mix(in oklab, var(--sidebar-border) 78%, white 22%);
  background: color-mix(in oklab, var(--sidebar) 90%, white 10%);
  color: color-mix(in oklab, var(--sidebar-foreground) 88%, white 12%);
  box-shadow: 0 7px 18px -16px rgb(0 0 0 / 0.72);
}
.mova-inset-button:disabled, .mova-inset-button[aria-disabled="true"] { pointer-events: none; opacity: .5; }
@media (prefers-reduced-motion: reduce) {
  .mova-inset-button { transition: none !important; }
  .mova-inset-button::before { transform: scale(1) !important; transition: none !important; }
}
`;

export type InsetButtonProps = React.ComponentProps<'button'> & {
  variant?: 'text' | 'create';
  theme?: 'light' | 'dark';
};

export function InsetButton({ variant = 'text', theme = 'dark', children, className = '', type = 'button', ...props }: InsetButtonProps) {
  return <>
    <style>{insetButtonStyles}</style>
    <button type={type} aria-label={variant === 'create' ? 'Create' : undefined} {...props}
      data-theme={theme} data-variant={variant} className={`mova-inset-button ${className}`}>
      {variant === 'create' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> : children}
    </button>
  </>;
}
