'use client';

import * as React from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';

export interface ExpandableCardProps {
  title?: string;
  description?: string;
  label?: string;
  imageSrc?: string;
  imageAlt?: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}

/** A compact list entry expands into a reading card, preserving the image and title through the move. */
export function ExpandableCard({
  title = 'The quiet collection',
  description = 'A little space for your next chapter.',
  label = 'Mova Journal',
  imageSrc,
  imageAlt = '',
  children,
  defaultOpen = false,
  onOpenChange,
  theme = 'light',
  className = '',
  style,
}: ExpandableCardProps) {
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState(defaultOpen);
  const dialog = React.useRef<HTMLDialogElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const id = React.useId();
  const titleId = `${id}-title`;
  const transition = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 30 };
  function change(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }
  function finishClose() {
    dialog.current?.close();
    previousFocus.current?.focus();
  }
  React.useEffect(() => {
    if (!open || !dialog.current || dialog.current.open) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : trigger.current;
    dialog.current.showModal();
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <LayoutGroup id={id}>
      <div className={`mova-expandable-card ${className}`} data-theme={theme} style={style}>
        <style>{css}</style>
        <motion.button
          layoutId="surface"
          transition={transition}
          ref={trigger}
          type="button"
          className="mec-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => change(true)}
        >
          {imageSrc ? (
            <motion.img
              layoutId="picture"
              transition={transition}
              src={imageSrc}
              alt={imageAlt}
              draggable={false}
            />
          ) : (
            <motion.span layoutId="picture" className="mec-art" aria-hidden="true">
              ✳
            </motion.span>
          )}
          <span className="mec-summary">
            <motion.strong layoutId="title" transition={transition}>
              {title}
            </motion.strong>
            <motion.span layoutId="description" transition={transition}>
              {description}
            </motion.span>
          </span>
          <motion.span layoutId="action" transition={transition} className="mec-open">
            Read
          </motion.span>
        </motion.button>
        <dialog
          ref={dialog}
          className="mec-dialog"
          data-theme={theme}
          aria-labelledby={titleId}
          onCancel={(event) => {
            event.preventDefault();
            change(false);
          }}
          onClose={() => {
            if (open) change(false);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) change(false);
          }}
        >
          <AnimatePresence onExitComplete={finishClose}>
            {open && (
              <motion.section
                key="reading"
                layoutId="surface"
                transition={transition}
                className="mec-panel"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: reduced ? 0 : 1 }}
              >
                <button
                  type="button"
                  className="mec-close"
                  autoFocus
                  aria-label="Close expanded card"
                  onClick={() => change(false)}
                >
                  ×
                </button>
                {imageSrc ? (
                  <motion.img
                    layoutId="picture"
                    transition={transition}
                    className="mec-hero"
                    src={imageSrc}
                    alt={imageAlt}
                  />
                ) : (
                  <motion.span layoutId="picture" className="mec-hero mec-art" aria-hidden="true">
                    ✳
                  </motion.span>
                )}
                <div className="mec-heading">
                  <div>
                    <motion.h2 id={titleId} layoutId="title" transition={transition}>
                      {title}
                    </motion.h2>
                    <motion.p layoutId="description" transition={transition}>
                      {description}
                    </motion.p>
                  </div>
                  <motion.button
                    layoutId="action"
                    transition={transition}
                    className="mec-done"
                    type="button"
                    onClick={() => change(false)}
                  >
                    Done
                  </motion.button>
                </div>
                <motion.div
                  className="mec-details"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    delay: reduced ? 0 : 0.12,
                    duration: reduced ? 0 : 0.2,
                  }}
                >
                  <small>{label}</small>
                  {children ?? (
                    <>
                      <p>
                        A collection begins with attention. Keep one small detail and return to it when the
                        day slows down.
                      </p>
                      <p>
                        Leave room for a new connection. Mova brings these small moments into the interfaces
                        you build.
                      </p>
                    </>
                  )}
                </motion.div>
              </motion.section>
            )}
          </AnimatePresence>
        </dialog>
      </div>
    </LayoutGroup>
  );
}
const css = `
.mova-expandable-card{width:640px;max-width:100%;font:14px/1.5 Inter,system-ui,sans-serif;color:#292d29;--mec-bg:#f4f1e8;--mec-hover:#e7e4d9;--mec-muted:#6b7068}
.mova-expandable-card[data-theme='dark'],.mec-dialog[data-theme='dark']{--mec-bg:#202623;--mec-hover:#2c3430;--mec-muted:#a3aba5;color:#eeede5}
.mec-trigger{box-sizing:border-box;width:100%;display:flex;align-items:center;gap:16px;padding:16px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background 180ms}
.mec-trigger:hover{background:var(--mec-hover)}.mec-trigger:focus-visible,.mec-close:focus-visible,.mec-done:focus-visible{outline:3px solid #95aaa1;outline-offset:3px}
.mec-trigger>img,.mec-trigger>.mec-art{width:56px;height:56px;object-fit:cover;border-radius:6px;flex:none}.mec-art{display:grid;place-items:center;background:#9fae9d;color:#e3e5d1;font-size:32px}
.mec-summary{display:grid;gap:4px;min-width:0;flex:1}.mec-summary strong{font-size:15px;line-height:1.3;font-weight:500}.mec-summary>span{font-size:13px;color:var(--mec-muted)}
.mec-open,.mec-done{display:inline-flex;align-items:center;justify-content:center;flex:none;border:0;border-radius:20px;padding:8px 18px;background:#d3ddba;color:#263026;font:600 12px/1.4 Inter,system-ui,sans-serif}
.mec-dialog{position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:32px 16px;border:0;background:transparent;color:#292d29;overflow:auto;--mec-bg:#f4f1e8;--mec-muted:#6b7068;font:14px/1.6 Inter,system-ui,sans-serif;box-sizing:border-box}
.mec-dialog[open]{display:grid;place-items:center}.mec-dialog::backdrop{background:#101914b3;backdrop-filter:blur(3px)}
.mec-panel{position:relative;box-sizing:border-box;width:min(500px,100%);border-radius:12px;background:var(--mec-bg);overflow:hidden;box-shadow:0 24px 80px #0005;margin:auto;max-height:calc(100dvh - 64px);display:flex;flex-direction:column}
.mec-hero{display:block;width:100%;height:280px;min-height:140px;object-fit:cover;flex-shrink:1}.mec-hero.mec-art{display:grid;font-size:90px}
.mec-close{position:absolute;z-index:2;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:0;background:#f2f1e7;color:#30342d;font:24px/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 12px #0002}
.mec-heading{display:flex;align-items:center;gap:16px;padding:24px 24px 12px;flex:none}.mec-heading>div{flex:1;min-width:0}.mec-heading h2{font-size:21px;line-height:1.25;font-weight:500;letter-spacing:-.5px;margin:0 0 6px}.mec-heading p{font-size:13px;color:var(--mec-muted);margin:0}.mec-done{cursor:pointer}
.mec-details{padding:0 24px 28px;overflow-y:auto;font-size:13px;line-height:1.7;color:var(--mec-muted)}.mec-details>small{display:block;font-size:10px;letter-spacing:1px;margin:8px 0 12px;text-transform:uppercase}.mec-details p{margin:0 0 12px}
@media(max-width:420px){.mec-trigger{padding:12px 4px;gap:12px}.mec-open{padding:7px 12px}.mec-summary strong{font-size:13px}.mec-summary>span{font-size:11px}.mec-hero{height:220px}.mec-heading{padding:20px 20px 12px}.mec-details{padding:0 20px 24px}.mec-heading h2{font-size:18px}}
`;
