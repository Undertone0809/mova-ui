"use client";

/**
 * Adapted from Reacticx's Context Menu.
 * https://reacticx.com/components/context-menu
 * https://github.com/rit3zh/reacticx/blob/main/src/components/molecules/context-menu/index.tsx
 */

import React, { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";

export type ContextMenuAction = {
  id: string;
  label: string;
  subtitle?: string;
  icon?: ReactNode;
  separatorBefore?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
};

export type ContextMenuProps = {
  children: ReactNode;
  items: readonly ContextMenuAction[];
  label?: string;
  theme?: "light" | "dark";
  disabled?: boolean;
  className?: string;
};

const LONG_PRESS_DURATION = 250;
const PRESS_SCALE = 0.97;
const PREVIEW_SCALE = 1.04;
const MENU_WIDTH = 250;
const MENU_GAP = 30;
const SCREEN_PADDING = 22;
const OPEN_SPRING = { type: "spring", damping: 12, mass: 0.5, stiffness: 120 } as const;
const CLOSE_TRANSITION = { duration: 0.18, ease: "easeOut" } as const;
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const palette = {
  light: {
    background: "rgb(250 250 250 / 90%)",
    text: "#111111",
    subtitle: "#54545a",
    destructive: "#b51d13",
    backdrop: "rgb(0 0 0 / 8%)",
    separator: "rgb(0 0 0 / 9%)",
    highlight: "rgb(0 0 0 / 8%)",
  },
  dark: {
    background: "rgb(37 37 37 / 84%)",
    text: "#ffffff",
    subtitle: "#b0b0b5",
    destructive: "#ff5d54",
    backdrop: "rgb(0 0 0 / 35%)",
    separator: "rgb(255 255 255 / 10%)",
    highlight: "rgb(255 255 255 / 12%)",
  },
};

const contextMenuCss = `
  [data-mova-context-trigger]:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: 4px;
  }
  [data-mova-context-action] { background: transparent; }
  [data-mova-context-action]:enabled:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: -2px;
    background: var(--mova-context-highlight);
  }
  @media (hover: hover) {
    [data-mova-context-action]:enabled:hover { background: var(--mova-context-highlight); }
  }
  [data-mova-context-action]:enabled:active { background: var(--mova-context-highlight); }
`;

type MenuPlacement = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  origin: string;
  shiftX: number;
  shiftY: number;
  scale: number;
};

function placeMenu(rect: DOMRectReadOnly, height: number, reducedMotion: boolean): MenuPlacement {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? document.documentElement.clientWidth;
  const viewportHeight = viewport?.height ?? document.documentElement.clientHeight;
  const inset = Math.min(SCREEN_PADDING, width / 10, viewportHeight / 10);
  const left = (viewport?.offsetLeft ?? 0) + inset;
  const top = (viewport?.offsetTop ?? 0) + inset;
  const availableWidth = width - inset * 2;
  const availableHeight = viewportHeight - inset * 2;
  const bottom = top + availableHeight;
  const gap = Math.min(MENU_GAP, availableHeight / 8);
  const menuWidth = Math.min(MENU_WIDTH, availableWidth);
  const scale = Math.min(
    reducedMotion ? 1 : PREVIEW_SCALE,
    availableWidth / Math.max(1, rect.width),
    availableHeight * 0.55 / Math.max(1, rect.height),
  );
  const previewWidth = rect.width * scale;
  const previewHeight = rect.height * scale;
  const maxHeight = availableHeight - gap - previewHeight;
  const menuHeight = Math.min(height, maxHeight);
  const centeredPreviewLeft = rect.left + (rect.width - previewWidth) / 2;
  const centeredPreviewTop = rect.top + (rect.height - previewHeight) / 2;
  const previewLeft = Math.max(left, Math.min(left + availableWidth - previewWidth, centeredPreviewLeft));
  const previewCenter = previewLeft + previewWidth / 2;
  const menuLeft = Math.max(left, Math.min(left + availableWidth - menuWidth, previewCenter - menuWidth / 2));
  const spaceAbove = centeredPreviewTop - top;
  const spaceBelow = bottom - (centeredPreviewTop + previewHeight);
  const above = spaceBelow < gap + menuHeight && spaceAbove > spaceBelow;
  const totalHeight = previewHeight + gap + menuHeight;
  const proposedTop = above ? centeredPreviewTop - gap - menuHeight : centeredPreviewTop;
  const groupTop = Math.max(top, Math.min(bottom - totalHeight, proposedTop));
  const previewTop = above ? groupTop + menuHeight + gap : groupTop;

  return {
    left: menuLeft,
    top: above ? groupTop : previewTop + previewHeight + gap,
    width: menuWidth,
    maxHeight,
    origin: `${Math.max(0, Math.min(menuWidth, previewCenter - menuLeft))}px ${above ? "bottom" : "top"}`,
    shiftX: previewLeft - centeredPreviewLeft,
    shiftY: previewTop - centeredPreviewTop,
    scale,
  };
}

type Anchor = {
  rect: DOMRectReadOnly;
  pressed: boolean;
  font: string;
  color: string;
};

type ContextMenuOverlayProps = {
  anchor: Anchor;
  triggerRef: RefObject<HTMLButtonElement | null>;
  id: string;
  label: string;
  children: ReactNode;
  items: readonly ContextMenuAction[];
  theme: NonNullable<ContextMenuProps["theme"]>;
  reducedMotion: boolean;
  close: (restoreFocus?: boolean) => void;
};

function ContextMenuOverlay({
  anchor, triggerRef, id, label, children, items, theme, reducedMotion, close,
}: ContextMenuOverlayProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const colors = palette[theme];
  const isPresent = useIsPresent();
  const closeRef = useRef(close);

  useClientLayoutEffect(() => { closeRef.current = close; }, [close]);

  useClientLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    const update = () => setPlacement(placeMenu(anchor.rect, menu.scrollHeight, reducedMotion));
    const observer = new ResizeObserver(update);
    observer.observe(menu);
    if (menu.firstElementChild) observer.observe(menu.firstElementChild);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [anchor, triggerRef, reducedMotion]);

  const ready = placement !== null;

  useClientLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !ready || !isPresent) return;
    const first = menu.querySelector<HTMLButtonElement>("[data-mova-context-action]:enabled");
    (first ?? menu).focus({ preventScroll: true });

    const handleFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !menu.contains(event.target)) closeRef.current(false);
    };
    document.addEventListener("focusin", handleFocus);
    return () => document.removeEventListener("focusin", handleFocus);
  }, [isPresent, ready]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      close();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-mova-context-action]:enabled"));
    if (!buttons.length) return;
    const focused = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case "ArrowDown": next = (focused + 1) % buttons.length; break;
      case "ArrowUp": next = (focused < 0 ? buttons.length - 1 : (focused - 1 + buttons.length) % buttons.length); break;
      case "Home": next = 0; break;
      case "End": next = buttons.length - 1; break;
      default: {
        if (event.key.length !== 1 || event.key === " ") return;
        const key = event.key.toLocaleLowerCase();
        const ordered = [...buttons.slice(focused + 1), ...buttons.slice(0, focused + 1)];
        const match = ordered.find((button) => button.dataset.movaContextAction?.toLocaleLowerCase().startsWith(key));
        if (!match) return;
        next = buttons.indexOf(match);
      }
    }
    event.preventDefault();
    event.stopPropagation();
    buttons[next].focus();
  };

  const enter = reducedMotion ? { duration: 0 } : OPEN_SPRING;
  const exit = reducedMotion ? { duration: 0 } : CLOSE_TRANSITION;
  const menuRestScale = reducedMotion ? 1 : 0.8;

  return (
    <motion.div
      style={{ position: "fixed", inset: 0, zIndex: 2147483647, pointerEvents: "none" }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: enter }}
        exit={{ opacity: 0, transition: exit }}
        onClick={() => close()}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: isPresent ? "auto" : "none",
          touchAction: "none",
          background: colors.backdrop,
          backdropFilter: "blur(9px)",
          WebkitBackdropFilter: "blur(9px)",
        }}
      />
      <motion.div
        aria-hidden="true"
        initial={{ x: 0, y: 0, scale: anchor.pressed && !reducedMotion ? PRESS_SCALE : 1 }}
        animate={placement ? { x: placement.shiftX, y: placement.shiftY, scale: placement.scale, transition: enter } : undefined}
        exit={{ x: 0, y: 0, scale: 1, transition: exit }}
        style={{
          position: "absolute",
          left: anchor.rect.left,
          top: anchor.rect.top,
          width: anchor.rect.width,
          height: anchor.rect.height,
          font: anchor.font,
          color: anchor.color,
        }}
      >
        {children}
      </motion.div>
      <motion.div
        ref={menuRef}
        id={id}
        role="menu"
        tabIndex={-1}
        aria-label={label}
        aria-hidden={!isPresent || undefined}
        onKeyDown={handleKeyDown}
        initial={{ opacity: 0, scale: menuRestScale }}
        animate={placement ? { opacity: 1, scale: 1, transition: enter } : undefined}
        exit={{ opacity: 0, scale: menuRestScale, transition: exit }}
        style={{
          "--mova-context-highlight": colors.highlight,
          boxSizing: "border-box",
          position: "absolute",
          left: placement?.left ?? 0,
          top: placement?.top ?? 0,
          width: placement?.width ?? `min(${MENU_WIDTH}px, 80vw)`,
          maxHeight: placement?.maxHeight,
          visibility: ready ? "visible" : "hidden",
          pointerEvents: isPresent ? "auto" : "none",
          transformOrigin: placement?.origin,
          background: colors.background,
          color: colors.text,
          borderRadius: 36,
          paddingBlock: 12,
          overflowY: "auto",
          overscrollBehavior: "contain",
          scrollbarWidth: "thin",
          boxShadow: "0 12px 24px rgb(0 0 0 / 20%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          font: anchor.font,
        } as CSSProperties}
      >
        <div role="presentation" style={{ paddingInline: 8 }}>
          {items.map((item) => (
            <Fragment key={item.id}>
              {item.separatorBefore && (
                <div role="separator" style={{ height: 1, margin: "4px 4px", background: colors.separator }} />
              )}
              <button
                type="button"
                role="menuitem"
                data-mova-context-action={item.label}
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => { close(); item.onSelect?.(); }}
                style={{
                  appearance: "none",
                  border: 0,
                  borderRadius: 18,
                  width: "100%",
                  minHeight: 50,
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 10px",
                  gap: 16,
                  color: item.destructive ? colors.destructive : "inherit",
                  opacity: item.disabled ? 0.45 : 1,
                  font: "inherit",
                  textAlign: "start",
                  cursor: item.disabled ? "default" : "pointer",
                }}
              >
                {item.icon !== undefined && (
                  <span aria-hidden="true" style={{ display: "grid", placeItems: "center", flex: "0 0 26px" }}>
                    {item.icon}
                  </span>
                )}
                <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 17, lineHeight: 1.2, overflowWrap: "anywhere" }}>{item.label}</span>
                  {item.subtitle && (
                    <span style={{ fontSize: 13, lineHeight: 1.25, color: colors.subtitle, overflowWrap: "anywhere" }}>
                      {item.subtitle}
                    </span>
                  )}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

type Press = { pointerId: number; x: number; y: number; timer: ReturnType<typeof setTimeout> };

export function ContextMenu({
  children,
  items,
  label = "Actions",
  theme = "light",
  disabled = false,
  className,
}: ContextMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pressRef = useRef<Press | null>(null);
  const ignoreClick = useRef(false);
  const id = useId();
  const reducedMotion = useReducedMotion() ?? false;
  const [pressing, setPressing] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const unavailable = disabled || items.length === 0;

  useEffect(() => {
    const trigger = triggerRef.current;
    const preventLongPressClick = (event: TouchEvent) => {
      // The browser can retarget the compatibility click to the backdrop on release.
      if (ignoreClick.current && event.cancelable) event.preventDefault();
    };
    trigger?.addEventListener("touchend", preventLongPressClick, { passive: false });

    return () => {
      trigger?.removeEventListener("touchend", preventLongPressClick);
      if (pressRef.current) clearTimeout(pressRef.current.timer);
    };
  }, []);

  const cancelPress = () => {
    if (pressRef.current) clearTimeout(pressRef.current.timer);
    pressRef.current = null;
    setPressing(false);
  };

  const open = (pressed = false) => {
    const trigger = triggerRef.current;
    if (!trigger || trigger.disabled || anchor) return;
    const { font, color } = getComputedStyle(trigger);
    setAnchor({ rect: trigger.getBoundingClientRect(), font, color, pressed });
    setShowPreview(true);
  };

  const close = (restoreFocus = true) => {
    setAnchor(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (unavailable && anchor) {
      setAnchor(null);
      setShowPreview(false);
    }
  }, [anchor, unavailable]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || anchor) return;
    ignoreClick.current = false;
    const timer = setTimeout(() => {
      ignoreClick.current = true;
      cancelPress();
      open(true);
    }, LONG_PRESS_DURATION);
    pressRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, timer };
    setPressing(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 10) return;
    ignoreClick.current = true;
    cancelPress();
  };

  return (
    <div className={className} style={{ position: "relative", display: "inline-grid", maxWidth: "100%" }}>
      <style>{contextMenuCss}</style>
      <motion.div
        animate={{ scale: !reducedMotion && pressing ? PRESS_SCALE : 1 }}
        transition={{ duration: reducedMotion ? 0 : pressing ? 0.25 : 0.16, ease: "easeOut" }}
        style={{ minWidth: 0, visibility: showPreview ? "hidden" : undefined }}
      >
        {children}
      </motion.div>
      <button
        ref={triggerRef}
        type="button"
        data-mova-context-trigger=""
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-controls={anchor ? id : undefined}
        aria-keyshortcuts="Shift+F10 ContextMenu"
        disabled={unavailable}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(event) => {
          if (unavailable) return;
          event.preventDefault();
          event.stopPropagation();
          cancelPress();
          open();
        }}
        onKeyDown={(event) => {
          if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
          event.preventDefault();
          event.stopPropagation();
          open();
        }}
        onClick={(event) => {
          if (ignoreClick.current && event.detail !== 0) {
            ignoreClick.current = false;
            return;
          }
          open();
        }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          appearance: "none",
          border: 0,
          padding: 0,
          borderRadius: "inherit",
          background: "transparent",
          color: "inherit",
          font: "inherit",
          cursor: unavailable ? undefined : "context-menu",
          touchAction: "manipulation",
          WebkitTouchCallout: "none",
        }}
      />
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence onExitComplete={() => setShowPreview(false)}>
          {anchor && (
            <ContextMenuOverlay
              key="menu"
              anchor={anchor}
              triggerRef={triggerRef}
              id={id}
              label={label}
              items={items}
              theme={theme}
              reducedMotion={reducedMotion}
              close={close}
            >
              {children}
            </ContextMenuOverlay>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
