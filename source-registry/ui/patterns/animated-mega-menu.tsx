import {
  useCallback, useEffect, useId, useRef, useState,
  type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { ChevronDown, Menu, X } from 'lucide-react';

export interface MegaMenuLink {
  label: string;
  href: string;
  description?: string;
  icon?: ReactNode;
}

export interface MegaMenuItem {
  label: string;
  href?: string;
  links?: readonly MegaMenuLink[];
  footer?: MegaMenuLink;
}

export interface AnimatedMegaMenuProps {
  items: readonly MegaMenuItem[];
  brand?: ReactNode;
  actions?: ReactNode;
  label?: string;
  theme?: 'dark' | 'light';
  /** Backdrop blur in pixels. */
  blur?: number;
  /** Surface tint opacity, from 0 to 1. */
  opacity?: number;
  /** Backdrop saturation multiplier. */
  saturation?: number;
  borderColor?: string;
  /** Surface corner radius in pixels. */
  borderRadius?: number;
  className?: string;
  style?: CSSProperties;
}

const spring = { type: 'spring', stiffness: 350, damping: 32 } as const;
const menuStyles = `
.mova-mega { position:relative; container-type:inline-size; width:100%; color:var(--mova-mega-text); font:inherit; }
.mova-mega *, .mova-mega *::before { box-sizing:border-box; }
.mova-mega-bar { position:relative; border:1px solid var(--mova-mega-border); border-radius:var(--mova-mega-radius); height:56px; display:flex; align-items:center; gap:24px; padding:0 32px; }
.mova-mega-bar, .mova-mega-popup, .mova-mega-mobile {
  background:var(--mova-mega-surface);
  -webkit-backdrop-filter:blur(var(--mova-mega-blur)) saturate(var(--mova-mega-saturation));
  backdrop-filter:blur(var(--mova-mega-blur)) saturate(var(--mova-mega-saturation));
}
.mova-mega-brand, .mova-mega-actions { flex-shrink:0; display:flex; align-items:center; }
.mova-mega-actions { margin-inline-start:auto; }
.mova-mega-nav { display:flex; gap:2px; align-items:center; min-width:0; overflow:auto; scrollbar-width:none; }
.mova-mega-trigger, .mova-mega-toggle, .mova-mega-link {
  appearance:none; border:0; background:none; color:inherit; font:inherit; text-decoration:none;
  position:relative; cursor:pointer; border-radius:8px; -webkit-tap-highlight-color:transparent;
}
.mova-mega :is(.mova-mega-trigger,.mova-mega-toggle,.mova-mega-link):focus-visible {
  outline:2px solid currentColor; outline-offset:-2px;
}
.mova-mega-trigger {
  display:flex; flex-shrink:0; align-items:center; gap:8px; height:36px; padding:0 14px;
  font-size:14px; white-space:nowrap; color:var(--mova-mega-muted);
}
.mova-mega-trigger[data-active=true] { color:var(--mova-mega-text); }
.mova-mega-trigger > span { z-index:1; display:inline-flex; }
.mova-mega-pill, .mova-mega-row-pill {
  position:absolute; inset:0; border-radius:inherit; background:var(--mova-mega-highlight); pointer-events:none;
}
.mova-mega-pill { z-index:0 !important; }
.mova-mega-bridge { position:absolute; top:100%; left:0; right:0; height:8px; }
.mova-mega-popup {
  position:absolute; left:0; top:calc(100% + 8px); z-index:2; overflow:hidden; border:1px solid var(--mova-mega-border);
  border-radius:var(--mova-mega-radius); transform-origin:top center; box-shadow:0 14px 32px #0003;
}
.mova-mega-content { position:absolute; top:0; left:0; right:0; max-height:min(65vh,420px); overflow:auto; overscroll-behavior:contain; }
.mova-mega-grid { padding:8px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:8px; }
.mova-mega-link {
  display:flex; align-items:center; gap:10px; border-radius:12px; min-height:52px;
  padding:8px 16px; line-height:1.25; text-align:start; font-size:14px; min-width:0;
}
.mova-mega-link > span:not(.mova-mega-row-pill) { position:relative; min-width:0; overflow-wrap:anywhere; }
.mova-mega-description { display:block; color:var(--mova-mega-muted); font-size:12px; margin-top:2px; }
.mova-mega-footer { grid-column:1/-1; border-top:1px solid var(--mova-mega-border); padding-top:8px; margin-top:8px; }
.mova-mega-toggle, .mova-mega-mobile { display:none; }
.mova-mega-mobile { position:absolute; z-index:2; top:100%; inset-inline:0; padding:8px; max-height:min(65vh,430px);
  overflow:auto; overscroll-behavior:contain;
  border:1px solid var(--mova-mega-border); border-radius:var(--mova-mega-radius); box-shadow:0 14px 32px #0003;
}
@container (width < 700px) {
  .mova-mega-bar { padding:0 16px; height:64px; gap:12px; }
  .mova-mega-nav, .mova-mega-popup, .mova-mega-bridge, .mova-mega-bar > .mova-mega-actions { display:none; }
  .mova-mega-toggle { display:grid; place-items:center; min-width:44px; height:44px; }
  .mova-mega-toggle:last-child { margin-inline-start:auto; }
  .mova-mega-mobile { display:block; }
  .mova-mega-mobile .mova-mega-actions { margin:8px 0 0; padding:12px 14px 4px; border-top:1px solid var(--mova-mega-border); }
  .mova-mega-mobile .mova-mega-actions > * { max-width:100%; }
  .mova-mega-mobile .mova-mega-trigger { width:100%; justify-content:space-between; min-height:44px; }
  .mova-mega-mobile .mova-mega-trigger[data-active=true] { background:var(--mova-mega-highlight); }
}
@container (max-width: 310px) { .mova-mega-grid { grid-template-columns:minmax(0,1fr); } }
@container (min-width: 700px) and (max-width: 839px) {
  .mova-mega-bar { padding:0 16px; gap:12px; }
  .mova-mega-trigger { padding:0 10px; }
}
`;

function PresencePanel({ as, onPresent, ...props }: HTMLMotionProps<'div'> & {
  as?: 'nav';
  onPresent?: (element: HTMLElement) => void;
}) {
  const present = useIsPresent();
  const Element = as === 'nav' ? motion.nav : motion.div;
  const setRef = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    element.inert = !present;
    if (present) onPresent?.(element);
  }, [onPresent, present]);
  return <Element {...props} data-present={present} aria-hidden={!present || undefined}
    style={{ ...props.style, pointerEvents: present ? props.style?.pointerEvents : 'none' }}
    ref={setRef} />;
}

function panelPosition(header: HTMLElement, trigger: HTMLElement, item: MegaMenuItem) {
  const bounds = header.getBoundingClientRect();
  const triggerBounds = trigger.getBoundingClientRect();
  const hasDescriptions = item.links?.some((link) => link.description);
  const width = Math.min(hasDescriptions ? 466 : 434, bounds.width - 32);
  const center = triggerBounds.left - bounds.left + triggerBounds.width / 2;
  const x = Math.max(16, Math.min(center - width / 2, bounds.width - width - 16));
  return { x, width };
}

function MegaMenuLinks({ item, layoutId, close }: { item: MegaMenuItem; layoutId: string; close: () => void }) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const links = item.links ?? [];

  const row = (link: MegaMenuLink, index: number) => (
    <a
      key={index}
      className="mova-mega-link"
      href={link.href}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHighlighted(index); }}
      onFocus={() => setHighlighted(index)}
      onClick={close}
    >
      {highlighted === index && (
        <motion.span
          aria-hidden="true"
          className="mova-mega-row-pill"
          layoutId={reduced ? undefined : layoutId}
          transition={spring}
        />
      )}
      {link.icon != null && <span aria-hidden="true">{link.icon}</span>}
      <span>
        {link.label}
        {link.description && <span className="mova-mega-description">{link.description}</span>}
      </span>
    </a>
  );

  return (
    <div
      className="mova-mega-grid"
      onPointerLeave={() => setHighlighted(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHighlighted(null);
      }}
    >
      {links.map(row)}
      {item.footer && <div className="mova-mega-footer">{row(item.footer, links.length)}</div>}
    </div>
  );
}

export function AnimatedMegaMenu({
  items, brand, actions, label = 'Main navigation', theme = 'dark',
  blur = 24, opacity = 0.7, saturation = 1.4, borderColor, borderRadius = 8, className, style,
}: AnimatedMegaMenuProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const triggers = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);
  const closeTimer = useRef<number | undefined>(undefined);
  const focusOnOpen = useRef(false);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [direction, setDirection] = useState(1);
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<number | null>(null);
  const [currentPanel, setCurrentPanel] = useState<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState({ x: 16, width: 434, height: 120 });
  const openItem = active === null ? undefined : items[active];
  const dark = theme === 'dark';
  const transition = reduced ? { duration: 0 } : spring;

  function currentContent() {
    return root.current?.querySelector<HTMLDivElement>('.mova-mega-content[data-present="true"]');
  }

  function close() {
    window.clearTimeout(closeTimer.current);
    focusOnOpen.current = false;
    setCurrentPanel(null);
    setActive(null);
    setHighlighted(null);
    setMobileOpen(false);
    setMobileGroup(null);
  }

  function show(index: number, focusLinks = false) {
    window.clearTimeout(closeTimer.current);
    const item = items[index];
    if (!item) return;
    if (active !== null && index !== active) setDirection(index > active ? 1 : -1);
    setHighlighted(index);
    if (item.links?.length || item.footer) {
      const trigger = triggers.current[index];
      if (active !== index && root.current && trigger) {
        const position = panelPosition(root.current, trigger, item);
        setGeometry((previous) => ({ ...previous, ...position }));
      }
      setActive(index);
      if (focusLinks) {
        const first = active === index ? currentContent()?.querySelector('a') : null;
        if (first) first.focus();
        else focusOnOpen.current = true;
      }
    } else {
      setActive(null);
    }
  }

  useEffect(() => {
    if (active === null || !root.current || !currentPanel || currentPanel !== currentContent()) return;
    const header = root.current;
    const panel = currentPanel;
    const trigger = triggers.current[active];
    const item = items[active];
    if (!trigger || !item) return;

    const measure = () => {
      if (Number.parseFloat(window.getComputedStyle(header).width) < 700) return;
      const { x, width } = panelPosition(header, trigger, item);
      const height = panel.offsetHeight + 2;
      setGeometry((old) => old.x === x && old.width === width && old.height === height
        ? old : { x, width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(panel);
    observer.observe(trigger);
    if (focusOnOpen.current) {
      focusOnOpen.current = false;
      panel.querySelector('a')?.focus();
    }
    return () => observer.disconnect();
  }, [active, currentPanel, items]);

  useEffect(() => {
    const header = root.current;
    if (!header) return;
    let wasCompact: boolean | undefined;
    const measure = () => {
      const next = Number.parseFloat(window.getComputedStyle(header).width) < 700;
      setCompact(next);
      if (wasCompact !== undefined && wasCompact !== next) {
        const focused = document.activeElement;
        const losesFocus = focused instanceof HTMLElement && (next
          ? focused.closest('.mova-mega-nav,.mova-mega-popup,.mova-mega-actions')
          : focused.closest('.mova-mega-mobile,.mova-mega-toggle'));
        close();
        if (losesFocus && header.contains(focused)) {
          if (next) mobileToggle.current?.focus();
          else triggers.current[0]?.focus();
        }
      }
      wasCompact = next;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileOpen && active === null) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [active, mobileOpen]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function handleTriggerKey(event: KeyboardEvent<HTMLElement>, index: number) {
    if (event.key === 'ArrowDown' && (items[index].links?.length || items[index].footer)) {
      event.preventDefault();
      show(index, true);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
      event.preventDefault();
      triggers.current[next]?.focus();
    }
  }

  const variables = {
    '--mova-mega-text': dark ? '#ededed' : '#171717',
    '--mova-mega-muted': dark ? '#d4d4d4' : '#595959',
    '--mova-mega-highlight': dark ? '#ffffff0f' : '#0000000c',
    '--mova-mega-border': borderColor ?? (dark ? '#ffffff1a' : '#0000001a'),
    '--mova-mega-surface': `rgb(${dark ? '8 8 8' : '255 255 255'} / ${Math.min(1, Math.max(0, opacity))})`,
    '--mova-mega-blur': `${Math.max(0, blur)}px`,
    '--mova-mega-saturation': Math.max(0, saturation),
    '--mova-mega-radius': `${Math.max(0, borderRadius)}px`,
    ...style,
  } as CSSProperties;

  return (
    <header
      ref={root}
      className={`mova-mega ${className ?? ''}`}
      style={variables}
      onPointerEnter={() => window.clearTimeout(closeTimer.current)}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse' || root.current?.contains(document.activeElement) && document.activeElement?.matches(':focus-visible')) return;
        closeTimer.current = window.setTimeout(close, 120);
      }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !openItem && !mobileOpen) return;
        event.preventDefault();
        if (mobileOpen) mobileToggle.current?.focus();
        else if (active !== null) triggers.current[active]?.focus();
        close();
      }}
    >
      <style>{menuStyles}</style>
      <div className="mova-mega-bar">
        {brand && <div className="mova-mega-brand">{brand}</div>}
        <nav className="mova-mega-nav" aria-label={label}>
          {items.map((item, index) => {
            const hasMenu = Boolean(item.links?.length || item.footer);
            const common = {
              className: 'mova-mega-trigger',
              'data-active': highlighted === index,
              onPointerEnter: (event: ReactPointerEvent) => {
                if (event.pointerType === 'mouse') show(index);
              },
              onFocus: () => {
                setHighlighted(index);
                if (active !== index) setActive(null);
              },
              onKeyDown: (event: KeyboardEvent<HTMLElement>) => handleTriggerKey(event, index),
            };
            const children = (
              <>
                {highlighted === index && (
                  <motion.span aria-hidden="true" className="mova-mega-pill" layoutId={reduced ? undefined : `${id}-nav-pill`} transition={transition} />
                )}
                <span>{item.label}</span>
                {hasMenu && (
                  <motion.span aria-hidden="true" animate={{ rotate: active === index ? 180 : 0 }} transition={transition}>
                    <ChevronDown size={14} />
                  </motion.span>
                )}
              </>
            );
            return hasMenu ? (
              <button
                {...common}
                key={index}
                type="button"
                ref={(element) => { triggers.current[index] = element; }}
                aria-expanded={active === index}
                aria-controls={active === index ? `${id}-panel` : undefined}
                onClick={() => show(index, true)}
              >{children}</button>
            ) : (
              <a
                {...common}
                key={index}
                href={item.href}
                ref={(element) => { triggers.current[index] = element; }}
                onClick={close}
              >{children}</a>
            );
          })}
        </nav>
        {actions && !compact && <div className="mova-mega-actions">{actions}</div>}
        <button
          className="mova-mega-toggle"
          ref={mobileToggle}
          type="button"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          aria-controls={mobileOpen ? `${id}-mobile` : undefined}
          onClick={() => {
            if (mobileOpen) close();
            else setMobileOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && mobileOpen) {
              event.preventDefault();
              root.current?.querySelector<HTMLElement>('.mova-mega-mobile[data-present="true"] :is(button,a[href])')?.focus();
            }
          }}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {openItem && (
          <PresencePanel
            key="panel"
            id={`${id}-panel`}
            className="mova-mega-popup"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.96, ...geometry }}
            animate={{ opacity: 1, scale: 1, ...geometry }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
            transition={transition}
          >
            <AnimatePresence initial={false} custom={direction} propagate>
              <PresencePanel
                key={active}
                className="mova-mega-content"
                onPresent={setCurrentPanel}
                custom={direction}
                variants={{
                  entering: (side: number) => ({ x: reduced ? 0 : side * 24, opacity: 0 }),
                  visible: { x: 0, opacity: 1 },
                  exiting: (side: number) => ({ x: reduced ? 0 : side * -24, opacity: 0, pointerEvents: 'none' }),
                }}
                initial="entering"
                animate="visible"
                exit="exiting"
                transition={transition}
                onKeyDown={(event) => {
                  const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]'));
                  const current = links.findIndex((link) => link === document.activeElement);
                  if (current === -1 || active === null) return;
                  if (event.key === 'Tab') {
                    const next = event.shiftKey && current === 0 ? triggers.current[active]
                      : !event.shiftKey && current === links.length - 1
                        ? triggers.current[active + 1] ?? root.current?.querySelector<HTMLElement>('.mova-mega-actions :is(button,a[href])')
                        : null;
                    if (next) {
                      event.preventDefault();
                      next.focus();
                    }
                    return;
                  }
                  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
                    : (current + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
                  links[next].focus();
                }}
              >
                <MegaMenuLinks item={openItem} layoutId={`${id}-rows-${active}`} close={close} />
              </PresencePanel>
            </AnimatePresence>
          </PresencePanel>
        )}
      </AnimatePresence>
      {openItem && <span className="mova-mega-bridge" aria-hidden="true" />}
      <AnimatePresence initial={false}>
        {mobileOpen && (
          <PresencePanel
            as="nav"
            id={`${id}-mobile`}
            aria-label={label}
            className="mova-mega-mobile"
            initial={{ opacity: 0, y: reduced ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -6 }}
            transition={transition}
          >
            {items.map((item, index) => item.links?.length || item.footer ? (
              <div key={index}>
                <button
                  className="mova-mega-trigger"
                  type="button"
                  aria-expanded={mobileGroup === index}
                  data-active={mobileGroup === index}
                  onClick={() => setMobileGroup(mobileGroup === index ? null : index)}
                >
                  {item.label}
                  <motion.span aria-hidden="true" animate={{ rotate: mobileGroup === index ? 180 : 0 }} transition={transition}>
                    <ChevronDown size={14} />
                  </motion.span>
                </button>
                {mobileGroup === index && <MegaMenuLinks item={item} layoutId={`${id}-mobile-rows`} close={close} />}
              </div>
            ) : (
              <a className="mova-mega-trigger" href={item.href} key={index} onClick={close}>{item.label}</a>
            ))}
            {actions && compact && <div className="mova-mega-actions" onClick={(event) => {
              if ((event.target as HTMLElement).closest('a[href]')) close();
            }}>{actions}</div>}
          </PresencePanel>
        )}
      </AnimatePresence>
    </header>
  );
}
