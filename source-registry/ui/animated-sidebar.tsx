"use client";

// Original Mova source.

import { Activity, Bookmark, ChevronDown, LayoutGrid } from "lucide-react";
import { useId, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type AnimatedSidebarItemId = "send" | "templates" | "events";

export type AnimatedSidebarProps = {
  className?: string;
  initialActiveItem?: AnimatedSidebarItemId;
  onItemChange?: (id: AnimatedSidebarItemId) => void;
  theme?: "dark" | "light";
};

type SidebarItem = {
  id: AnimatedSidebarItemId;
  label: string;
  meta: string;
  icon: LucideIcon;
};

const SIDEBAR_ITEMS: readonly SidebarItem[] = [
  { id: "send", label: "Work queue", meta: "Current cycle", icon: LayoutGrid },
  { id: "templates", label: "Saved views", meta: "Shared space", icon: Bookmark },
  { id: "events", label: "Activity log", meta: "Updated today", icon: Activity },
];

const SIDEBAR_STYLES = `
.mova-sidebar,
.mova-sidebar * {
  box-sizing: border-box;
}

.mova-sidebar {
  --mova-sidebar-background: #171a1e;
  --mova-sidebar-surface: #20252b;
  --mova-sidebar-border: #343a43;
  --mova-sidebar-text: #f2f5f5;
  --mova-sidebar-muted: #9da7ad;
  --mova-sidebar-accent: #87e3c1;
  --mova-sidebar-accent-surface: #19382f;
  --mova-sidebar-focus: #ffd166;
  width: min(300px, 100%);
  min-width: 0;
  min-height: 384px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  border: 1px solid var(--mova-sidebar-border);
  border-radius: 8px;
  background: var(--mova-sidebar-background);
  color: var(--mova-sidebar-text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color-scheme: dark;
}

.mova-sidebar[data-theme="light"] {
  --mova-sidebar-background: #f6f8f6;
  --mova-sidebar-surface: #ffffff;
  --mova-sidebar-border: #d6ddd8;
  --mova-sidebar-text: #1f2823;
  --mova-sidebar-muted: #657169;
  --mova-sidebar-accent: #087f5b;
  --mova-sidebar-accent-surface: #e2f4ec;
  --mova-sidebar-focus: #a65600;
  color-scheme: light;
}

.mova-sidebar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 4px;
}

.mova-sidebar__mark {
  display: grid;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--mova-sidebar-accent) 42%, var(--mova-sidebar-border));
  border-radius: 4px;
  background: var(--mova-sidebar-accent-surface);
  color: var(--mova-sidebar-accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.mova-sidebar__brand-copy {
  display: grid;
  min-width: 0;
  gap: 0;
}

.mova-sidebar__eyebrow {
  margin: 0;
  color: var(--mova-sidebar-muted);
  font-size: 11px;
  letter-spacing: 0.08em;
  line-height: 16px;
  text-transform: uppercase;
}

.mova-sidebar__title {
  overflow: hidden;
  color: var(--mova-sidebar-text);
  font-size: 14px;
  font-weight: 650;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mova-sidebar__section {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.mova-sidebar__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  padding: 0 4px 0 8px;
}

.mova-sidebar__section-label {
  color: var(--mova-sidebar-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.mova-sidebar__section-toggle {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--mova-sidebar-muted);
  cursor: pointer;
  transition: border-color 180ms ease, color 180ms ease, background-color 180ms ease;
}

.mova-sidebar__section-toggle:hover {
  border-color: var(--mova-sidebar-border);
  background: var(--mova-sidebar-surface);
  color: var(--mova-sidebar-text);
}

.mova-sidebar__section-toggle[data-open="true"] .mova-sidebar__chevron {
  transform: rotate(180deg);
}

.mova-sidebar__chevron {
  transition: transform 180ms ease;
}

.mova-sidebar__section-content {
  display: grid;
  grid-template-rows: 1fr;
  min-width: 0;
  opacity: 1;
  transition: grid-template-rows 220ms ease, opacity 160ms ease;
}

.mova-sidebar__section-content[data-open="false"] {
  grid-template-rows: 0fr;
  opacity: 0;
  pointer-events: none;
}

.mova-sidebar__section-content-inner {
  min-height: 0;
  overflow: hidden;
}

.mova-sidebar__list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mova-sidebar__item {
  position: relative;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  width: 100%;
  min-height: 52px;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--mova-sidebar-muted);
  cursor: pointer;
  text-align: left;
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
}

.mova-sidebar__item::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 20px;
  border-radius: 0 2px 2px 0;
  background: var(--mova-sidebar-accent);
  content: "";
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 180ms ease;
}

.mova-sidebar__item:hover {
  border-color: var(--mova-sidebar-border);
  background: var(--mova-sidebar-surface);
  color: var(--mova-sidebar-text);
}

.mova-sidebar__item[data-active="true"] {
  border-color: color-mix(in srgb, var(--mova-sidebar-accent) 24%, var(--mova-sidebar-border));
  background: var(--mova-sidebar-accent-surface);
  color: var(--mova-sidebar-text);
}

.mova-sidebar__item[data-active="true"]::before {
  opacity: 1;
}

.mova-sidebar__item:focus-visible,
.mova-sidebar__section-toggle:focus-visible {
  outline: 2px solid var(--mova-sidebar-focus);
  outline-offset: -2px;
}

.mova-sidebar__icon {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  color: currentColor;
}

.mova-sidebar__item[data-active="true"] .mova-sidebar__icon {
  color: var(--mova-sidebar-accent);
}

.mova-sidebar__item-copy {
  display: grid;
  min-width: 0;
  gap: 0;
}

.mova-sidebar__item-label,
.mova-sidebar__item-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mova-sidebar__item-label {
  color: inherit;
  font-size: 13px;
  font-weight: 650;
  line-height: 20px;
}

.mova-sidebar__item-meta {
  color: var(--mova-sidebar-muted);
  font-size: 11px;
  line-height: 16px;
}

.mova-sidebar__count {
  min-width: 24px;
  padding: 2px 4px;
  border: 1px solid var(--mova-sidebar-border);
  border-radius: 4px;
  color: var(--mova-sidebar-muted);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.mova-sidebar__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
  margin-top: auto;
  padding: 8px 12px;
  border-top: 1px solid var(--mova-sidebar-border);
  color: var(--mova-sidebar-muted);
  font-size: 11px;
}

.mova-sidebar__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mova-sidebar__status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: var(--mova-sidebar-accent);
}

@media (prefers-reduced-motion: reduce) {
  .mova-sidebar *,
  .mova-sidebar *::before,
  .mova-sidebar *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
`;

export function AnimatedSidebar({
  className = "",
  initialActiveItem = "send",
  onItemChange,
  theme = "dark",
}: AnimatedSidebarProps = {}) {
  const [activeItem, setActiveItem] = useState<AnimatedSidebarItemId>(initialActiveItem);
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const sectionId = `mova-sidebar-section-${useId().replace(/:/g, "")}`;
  const rootClassName = ["mova-sidebar", className].filter(Boolean).join(" ");

  const selectItem = (id: AnimatedSidebarItemId) => {
    setActiveItem(id);
    onItemChange?.(id);
  };

  return (
    <>
      <style>{SIDEBAR_STYLES}</style>
      <aside className={rootClassName} data-theme={theme} aria-label="Workspace navigation">
        <div className="mova-sidebar__brand">
          <span className="mova-sidebar__mark" aria-hidden="true">MW</span>
          <div className="mova-sidebar__brand-copy">
            <p className="mova-sidebar__eyebrow">Workspace</p>
            <strong className="mova-sidebar__title">Mova Workbench</strong>
          </div>
        </div>

        <nav aria-label="Workspace destinations">
          <div className="mova-sidebar__section">
            <div className="mova-sidebar__section-heading">
              <span className="mova-sidebar__section-label">Spaces</span>
              <button
                aria-controls={sectionId}
                aria-expanded={isSectionOpen}
                aria-label={`${isSectionOpen ? "Collapse" : "Expand"} workspace destinations`}
                className="mova-sidebar__section-toggle"
                data-open={isSectionOpen}
                onClick={() => setIsSectionOpen((open) => !open)}
                type="button"
              >
                <ChevronDown className="mova-sidebar__chevron" size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            <div
              aria-hidden={!isSectionOpen}
              className="mova-sidebar__section-content"
              data-open={isSectionOpen}
              id={sectionId}
            >
              <div className="mova-sidebar__section-content-inner">
                <ul className="mova-sidebar__list">
                  {SIDEBAR_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeItem === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          aria-current={isActive ? "page" : undefined}
                          aria-pressed={isActive}
                          className="mova-sidebar__item"
                          data-active={isActive}
                          onClick={() => selectItem(item.id)}
                          tabIndex={isSectionOpen ? 0 : -1}
                          type="button"
                        >
                          <span className="mova-sidebar__icon" aria-hidden="true">
                            <Icon size={17} strokeWidth={1.8} />
                          </span>
                          <span className="mova-sidebar__item-copy">
                            <span className="mova-sidebar__item-label">{item.label}</span>
                            <span className="mova-sidebar__item-meta">{item.meta}</span>
                          </span>
                          <span className="mova-sidebar__count" aria-hidden="true">3</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </nav>

        <div className="mova-sidebar__footer">
          <span className="mova-sidebar__status">
            <span className="mova-sidebar__status-dot" aria-hidden="true" />
            <span>Workspace ready</span>
          </span>
          <span>3 views</span>
        </div>
      </aside>
    </>
  );
}

export default AnimatedSidebar;
