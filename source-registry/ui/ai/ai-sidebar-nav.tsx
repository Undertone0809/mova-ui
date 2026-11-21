"use client";

// Adapted from Beautiful UI.
// Retains the original 224px / 52px rail and gliding navigation motion.

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LogOut as IconArrowBoxLeft, Check as IconCheckmark1Small, ChevronDown as IconChevronDownSmall, X as IconCrossSmall, SquarePen as IconEditBig, House as IconHome, Search as IconMagnifyingGlass, Plus as IconPlusMedium, IceCream as IconPopsicle2, Settings as IconSettingsGear1, PanelLeftClose as IconSidebarLeftArrow, UserPlus as IconUserAdd } from "lucide-react";

/* Shadow tokens from shadow-plugin 2.1.1. */
const AI_THEME_STYLES = "__MOVA_AI_DESIGN_TOKENS__";
const COMPONENT_STYLES = `[data-mova-sidebar] button:focus-visible { outline:2px solid var(--mova-ai-accent,#454545);outline-offset:2px;border-radius:8px; }
[data-mova-sidebar] input:focus-visible { outline:none; }
[data-mova-sidebar] .sidebar-search:focus-within { outline:2px solid var(--mova-ai-accent,#454545);outline-offset:2px;border-radius:8px; }
[data-mova-sidebar] .sidebar-search button:focus-visible { outline:none; }
[data-mova-sidebar] button { cursor:pointer; } [data-mova-sidebar] button:disabled { cursor:default; }
[data-mova-sidebar] .sidebar-row{
  width: 208px;
  transition-duration: var(--sidebar-copy-duration);
  transition-timing-function: var(--sidebar-easing);
}

[data-mova-sidebar] .sidebar-copy{
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity var(--sidebar-copy-duration) ease-out,
    transform var(--sidebar-copy-duration) var(--sidebar-easing);
}

[data-mova-sidebar] .sidebar-logo,
[data-mova-sidebar] .sidebar-collapse-control,
[data-mova-sidebar] .sidebar-expand-control{
  transition-duration: var(--sidebar-copy-duration);
  transition-timing-function: ease-out;
}

[data-mova-sidebar] .sidebar-expand-control{
  pointer-events: none;
  opacity: 0;
}

[data-mova-sidebar] .sidebar-glide-highlight{
  right: 8px;
  left: 8px;
}

[data-mova-sidebar][data-sidebar-collapsed="true"] .sidebar-row{
  width: 36px;
}

[data-mova-sidebar][data-sidebar-collapsed="true"] .sidebar-copy{
  pointer-events: none;
  opacity: 0;
  transform: translateX(calc(var(--sidebar-copy-offset) * -1));
}

[data-mova-sidebar][data-sidebar-collapsed="true"] .sidebar-workspace-control{
  pointer-events: none;
}

[data-mova-sidebar][data-sidebar-collapsed="true"] .sidebar-logo,
[data-mova-sidebar][data-sidebar-collapsed="true"] .sidebar-collapse-control{
  pointer-events: none;
  opacity: 0;
}

[data-mova-sidebar][data-sidebar-collapsed="true"] .sidebar-expand-control{
  pointer-events: auto;
  opacity: 1;
}

[data-mova-sidebar][data-sidebar-collapsed="true"] .sidebar-glide-highlight{
  right: auto;
  width: 36px;
}


@keyframes mova-sidebar-pop {from {opacity:0;transform:scale(.95)} to {opacity:1;transform:scale(1)}}
@keyframes mova-sidebar-eq {0%,100% {transform:scaleY(.35)} 50% {transform:scaleY(1)}}
@media(prefers-reduced-motion:reduce) { [data-mova-sidebar], [data-mova-sidebar] * {animation:none!important;transition:none!important;scroll-behavior:auto!important;} }
`;

type GlideMenuProps = {
  children: ReactNode;
  className?: string;
  highlightClassName?: string;
  rowSelector?: string;
};

/** A single hover layer that glides between interactive menu rows. */
function GlideMenu({
  children,
  className = "",
  highlightClassName = "inset-x-0 rounded-[8px] bg-[var(--mova-ai-hover,#f1f1f1)]",
  rowSelector = "[data-menu-row]",
}: GlideMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const [visible, setVisible] = useState(false);

  const moveTo = (target: EventTarget | null) => {
    const container = ref.current;
    if (!(target instanceof Element) || !container) return;
    const row = target.closest(rowSelector);
    if (!(row instanceof HTMLElement) || !container.contains(row)) return;
    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    setBox({ top: rowRect.top - containerRect.top, height: rowRect.height });
    setVisible(true);
  };

  return (
    <div
      ref={ref}
      onMouseOver={(event) => moveTo(event.target)}
      onMouseLeave={() => setVisible(false)}
      onFocusCapture={(event) => moveTo(event.target)}
      onBlurCapture={(event) => {
        if (!ref.current?.contains(event.relatedTarget as Node | null)) setVisible(false);
      }}
      className={`group/glide-menu relative ${className}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute ${highlightClassName}`}
        style={{
          top: box?.top ?? 0,
          height: box?.height ?? 0,
          opacity: box && visible ? 1 : 0,
          transition:
            "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
        }}
      />
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * SIDEBAR NAV
 * Shared by the design-system preview and the harness shell:
 * compact workspace switcher, primary navigation, searchable
 * chat history, and a collapse that preserves icon alignment.
 * ───────────────────────────────────────────────────────── */

const WORKSPACE = { key: "creamery", name: "Creamery Ops", monogram: "C" };

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: <IconHome size={18} /> },
  { key: "invite", label: "Invite users", icon: <IconUserAdd size={18} />, count: "3/10" },
];

type SidebarRecent = {
  id: string;
  label: string;
  prompt?: string;
};

const DEFAULT_RECENTS: SidebarRecent[] = [
  { id: "suppliers", label: "Supplier records" },
  { id: "todos", label: "Urgent to-dos this morning" },
  { id: "flavor", label: "Flavor page ticket" },
  { id: "workload", label: "Workload summary" },
  { id: "offboarding", label: "Off-board a supplier" },
  { id: "restock", label: "Batch restock function" },
  { id: "edits", label: "Propose flavor edits" },
  { id: "subway", label: "Subway surfing" },
];

type SidebarNavProps = {
  theme?: "dark" | "light";
  onWorkspaceAction?: (action: string) => void;
  activeTitle?: string | null;
  className?: string;
  fill?: boolean;
  onNewChat?: () => void;
  onPick?: (id: string, label: string, prompt?: string) => void;
  /** controlled primary-nav selection (e.g. "home" | "invite") */
  activeNav?: string;
  onNavigate?: (key: string) => void;
  /** footer call-to-action — defaults to the demo "Upgrade" button */
  footerLabel?: string;
  footerIcon?: ReactNode;
  onFooterClick?: () => void;
  recents?: SidebarRecent[];
  variant?: string;
};

const SIDEBAR_MOTION = {
  expandedWidth: 224,
  collapsedWidth: 52,
  duration: 280,
  copyDuration: 180,
  copyOffset: 8,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

/* ─────────────────────────────────────────────────────────
 * CHAT SEARCH STORYBOARD
 *
 *   0ms   search is triggered; Chats label begins fading
 *   0ms   field grows right → left from the search control
 * 180ms   field fills the row; cursor is focused and ready
 * ───────────────────────────────────────────────────────── */
const CHAT_SEARCH_MOTION = {
  duration: 180,
  closedWidth: 28,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  listDuration: 220,
};

function GlideGroup({ children }: { children: ReactNode }) {
  return (
    <GlideMenu
      rowSelector="[data-row]"
      highlightClassName="sidebar-glide-highlight rounded-[7px] bg-[var(--mova-ai-hover-strong,#e9e9e9)]"
      className="group/glide flex flex-col gap-px"
    >
      {children}
    </GlideMenu>
  );
}

function RailButton({
  icon,
  label,
  active = false,
  count,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  count?: string;
  onClick?: () => void;
}) {
  return (
    <button
      data-row
      aria-label={label}
      aria-current={active ? "page" : undefined}
      type="button"
      onClick={onClick}
      className={`sidebar-row relative z-10 mx-2 flex h-8 items-center rounded-[8px] px-2 text-left
        transition-[width,background-color,color,transform] duration-150 active:scale-[0.98]
        ${active ? "bg-[var(--mova-ai-hover-strong,#e9e9e9)] group-hover/glide:bg-transparent" : ""}`}
    >
      <span className={`flex size-5 shrink-0 items-center justify-center ${active ? "text-[var(--mova-ai-ink,#202020)]" : "text-[var(--mova-ai-ink-secondary,#666)]"}`}>
        {icon}
      </span>
      <span className={`sidebar-copy ml-1.5 min-w-0 flex-1 truncate text-[14px] font-medium ${active ? "text-[var(--mova-ai-ink,#202020)]" : "text-[var(--mova-ai-ink-secondary,#666)]"}`}>
        {label}
      </span>
      {count && (
        <span className="sidebar-copy mr-2 shrink-0 text-[12px] font-medium tabular-nums text-[var(--mova-ai-ink-muted,#858585)]">
          {count}
        </span>
      )}
    </button>
  );
}

function WorkspaceMenu({
  position,
  theme,
  onAction,
  onClose,
}: {
  theme: "dark" | "light";
  onAction: (action: string) => void;
  position: { top: number; left: number };
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  return createPortal(
    <div ref={menuRef}
      data-mova-sidebar data-theme={theme}
      data-workspace-menu
      role="group" aria-label="Workspace menu"
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button")); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus(); } }}
      className="mova-ai-theme fixed z-50 w-64 rounded-lg border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-surface,#fff)] p-1.5 shadow-[var(--mova-ai-shadow-overlay,none)]"
      style={{
        top: position.top,
        left: position.left,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100dvh - 16px)", overflowY: "auto",
        animation: "mova-sidebar-pop 180ms cubic-bezier(0.23,1,0.32,1) both",
        transformOrigin: "top left",
      }}
    >
      <style>{AI_THEME_STYLES}{COMPONENT_STYLES}</style>
      <GlideMenu className="flex flex-col gap-px" highlightClassName="inset-x-0 rounded-[8px] bg-[var(--mova-ai-hover-strong,#e9e9e9)]">
        <button
          data-menu-row
          type="button"
          onClick={onClose}
          className="relative z-10 flex h-10 w-full items-center gap-1.5 rounded-[8px] px-2 text-left"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-[var(--mova-ai-ink,#202020)] text-[11px] font-semibold text-[var(--mova-ai-surface,#fff)]">
            {WORKSPACE.monogram}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[var(--mova-ai-ink,#202020)]">{WORKSPACE.name}</span>
          <span className="shrink-0 text-[var(--mova-ai-ink,#202020)]"><IconCheckmark1Small size={18} /></span>
        </button>
        <div className="my-1 h-px bg-[var(--mova-ai-border,#dedede)]" />
        {[
          { label: "New workspace", icon: <IconPlusMedium size={16} /> },
          { label: "Workspace settings", icon: <IconSettingsGear1 size={16} /> },
          { label: "Invite team members", icon: <IconUserAdd size={16} /> },
        ].map((item) => (
          <button
            key={item.label}
            data-menu-row
            type="button"
            onClick={() => { onAction(item.label); onClose(); }}
            className="relative z-10 flex h-9 w-full items-center gap-1.5 rounded-[8px] px-2 text-left"
          >
            <span className="flex size-5 shrink-0 items-center justify-center text-[var(--mova-ai-ink-secondary,#666)]">{item.icon}</span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--mova-ai-ink,#202020)]">{item.label}</span>
          </button>
        ))}
        <div className="my-1 h-px bg-[var(--mova-ai-border,#dedede)]" />
        <button
          data-menu-row
          type="button"
          onClick={() => { onAction("Sign out"); onClose(); }}
          className="relative z-10 flex h-9 w-full items-center gap-1.5 rounded-[8px] px-2 text-left"
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-[var(--mova-ai-ink-secondary,#666)]"><IconArrowBoxLeft size={16} /></span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--mova-ai-ink,#202020)]">Sign out</span>
        </button>
      </GlideMenu>
    </div>,
    document.body,
  );
}

export function AISidebarNav({
  theme = "dark",
  onWorkspaceAction,
  activeTitle,
  className = "",
  fill = false,
  onNewChat,
  onPick,
  activeNav,
  onNavigate,
  footerLabel = "Upgrade",
  footerIcon,
  onFooterClick,
  recents = DEFAULT_RECENTS,
}: SidebarNavProps) {
  const [feedback, setFeedback] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [internalNav, setInternalNav] = useState("chats");
  const currentNav = activeNav ?? internalNav;
  const selectNav = (key: string) => {
    setInternalNav(key);
    if (key === "home" || key === "invite") setFeedback(key === "home" ? "Home selected" : "Invite users selected");
    onNavigate?.(key);
  };
  const [demoActiveTitle, setDemoActiveTitle] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspacePosition, setWorkspacePosition] = useState({ top: 0, left: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const historyId = useId();
  const searchId = useId();
  const workspaceButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedTitle = activeTitle === undefined ? demoActiveTitle : activeTitle;
  const visibleRecents = recents.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!workspaceOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!workspaceButtonRef.current?.contains(target) && !target.closest("[data-workspace-menu]")) {
        setWorkspaceOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [workspaceOpen]);

  useEffect(() => {
    if (!workspaceOpen) return;
    const close = () => { setWorkspaceOpen(false); workspaceButtonRef.current?.focus(); };
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("resize", close); };
  }, [workspaceOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const collapse = () => {
    setCollapsed(true);
    requestAnimationFrame(() => expandRef.current?.focus());
    setWorkspaceOpen(false);
    setSearchOpen(false);
    setQuery("");
  };

  const toggleChats = () => {
    if (chatsExpanded) {
      setSearchOpen(false);
      setQuery("");
    }
    setChatsExpanded(!chatsExpanded);
  };

  return (
    <aside
      ref={rootRef}
      data-mova-sidebar data-theme={theme}
      data-sidebar-collapsed={collapsed}
      aria-label="Workspace navigation"
      className={`mova-ai-theme relative flex shrink-0 overflow-hidden rounded-lg border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-surface,#fff)] text-[color:var(--mova-ai-ink,#202020)] transition-[width] ${fill ? "h-full" : "h-[600px]"} ${className}`}
      style={{
        width: collapsed ? SIDEBAR_MOTION.collapsedWidth : SIDEBAR_MOTION.expandedWidth,
        transitionDuration: `${SIDEBAR_MOTION.duration}ms`,
        transitionTimingFunction: SIDEBAR_MOTION.easing,
        "--sidebar-copy-duration": `${SIDEBAR_MOTION.copyDuration}ms`,
        "--sidebar-copy-offset": `${SIDEBAR_MOTION.copyOffset}px`,
        "--sidebar-easing": SIDEBAR_MOTION.easing,
      } as CSSProperties}
    >
      <style>{AI_THEME_STYLES}{COMPONENT_STYLES}</style>
      <div className="flex min-h-0 w-[224px] shrink-0 flex-col">
        <div className="relative mb-2.5 h-10 shrink-0">
          <button
            ref={workspaceButtonRef}
            data-workspace-trigger
            type="button"
            aria-expanded={workspaceOpen}
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
            onClick={() => {
              if (!workspaceOpen && workspaceButtonRef.current) {
                const rect = workspaceButtonRef.current.getBoundingClientRect();
                setWorkspacePosition({ top: Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - 260)), left: Math.max(8, Math.min(rect.left, window.innerWidth - 264)) });
              }
              setWorkspaceOpen((open) => !open);
            }}
            className="sidebar-workspace-control absolute left-2 top-1 flex h-8 w-[164px] items-center rounded-[8px] px-2 text-left transition-[background-color,transform] duration-100 hover:bg-[var(--mova-ai-hover-strong,#e9e9e9)] active:scale-[0.99]"
          >
            <span className="sidebar-logo flex size-5 shrink-0 items-center justify-center text-[var(--mova-ai-ink,#202020)]">
              <IconPopsicle2 size={18} />
            </span>
            <span className="sidebar-copy ml-1.5 min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--mova-ai-ink-secondary,#666)]">
              {WORKSPACE.name}
            </span>
            <span className="sidebar-copy ml-1 flex shrink-0 text-[var(--mova-ai-ink-muted,#858585)]">
              <IconChevronDownSmall size={16} />
            </span>
          </button>

          {workspaceOpen && <WorkspaceMenu theme={theme} position={workspacePosition} onAction={(action) => { setFeedback(`${action} selected`); onWorkspaceAction?.(action); }} onClose={() => { setWorkspaceOpen(false); workspaceButtonRef.current?.focus(); }} />}

          <button
            type="button"
            ref={collapseRef}
            aria-label="Collapse sidebar"
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
            onClick={collapse}
            className="sidebar-collapse-control absolute right-2 top-1 flex size-8 items-center justify-center rounded-[8px] text-[var(--mova-ai-ink-muted,#858585)] transition-[opacity,background-color,color] duration-150 hover:bg-[var(--mova-ai-hover-strong,#e9e9e9)] hover:text-[var(--mova-ai-ink,#202020)]"
          >
            <IconSidebarLeftArrow size={18} />
          </button>
          <button
            type="button"
            ref={expandRef}
            aria-label="Expand sidebar"
            aria-hidden={!collapsed}
            tabIndex={collapsed ? 0 : -1}
            onClick={() => { setCollapsed(false); requestAnimationFrame(() => collapseRef.current?.focus()); }}
            className="sidebar-expand-control absolute left-2 top-0.5 flex size-9 items-center justify-center rounded-[8px] text-[var(--mova-ai-ink-muted,#858585)] transition-[opacity,background-color,color] duration-150 hover:bg-[var(--mova-ai-hover-strong,#e9e9e9)] hover:text-[var(--mova-ai-ink,#202020)]"
          >
            <IconSidebarLeftArrow size={18} className="rotate-180" />
          </button>
        </div>

        <GlideGroup>
          <RailButton
            icon={<IconEditBig size={18} />}
            label="New chat"
            onClick={() => {
              if (activeTitle === undefined) setDemoActiveTitle(null);
              selectNav("chats");
              setFeedback("New chat ready");
              onNewChat?.();
            }}
          />
          {NAV_ITEMS.map((item) => (
            <RailButton
              key={item.key}
              icon={item.icon}
              label={item.label}
              count={item.count}
              active={currentNav === item.key}
              onClick={() => selectNav(item.key)}
            />
          ))}
        </GlideGroup>

        <div className="mt-3 flex min-h-0 flex-1 flex-col" inert={collapsed}>
          <div className="sidebar-copy relative mx-2 mb-1 h-8 shrink-0">
            <button
              type="button"
              aria-label="Chats"
              aria-expanded={chatsExpanded}
              aria-controls={historyId}
              aria-hidden={searchOpen}
              tabIndex={searchOpen ? -1 : 0}
              onClick={toggleChats}
              className={`absolute inset-0 flex items-center gap-1.5 rounded-[8px] px-2 text-left text-[12.5px] font-medium text-[var(--mova-ai-ink-muted,#858585)] transition-[opacity,transform,color] hover:text-[var(--mova-ai-ink,#202020)] ${searchOpen ? "pointer-events-none -translate-x-1 opacity-0" : "translate-x-0 opacity-100"}`}
              style={{ transitionDuration: `${CHAT_SEARCH_MOTION.duration}ms`, transitionTimingFunction: CHAT_SEARCH_MOTION.easing }}
            >
              <IconChevronDownSmall size={16} className={`transition-transform duration-200 ${chatsExpanded ? "rotate-0" : "-rotate-90"}`} />
              <span>Chats</span>
            </button>

            <button
              type="button"
              ref={searchButtonRef}
              aria-label="Search chats"
              tabIndex={searchOpen ? -1 : 0}
              aria-expanded={searchOpen}
              aria-controls={searchId}
              aria-hidden={searchOpen}
              onClick={() => { setChatsExpanded(true); setSearchOpen(true); }}
              className={`absolute right-0 top-0 z-10 flex size-8 items-center justify-center rounded-[8px] text-[var(--mova-ai-ink-muted,#858585)] transition-[opacity,background-color,color,transform] hover:bg-[var(--mova-ai-hover-strong,#e9e9e9)] hover:text-[var(--mova-ai-ink,#202020)] active:scale-[0.96] ${searchOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
              style={{ transitionDuration: `${CHAT_SEARCH_MOTION.duration}ms` }}
            >
              <IconMagnifyingGlass size={16} />
            </button>

            <div
              id={searchId}
              role="search"
              aria-hidden={!searchOpen}
              inert={!searchOpen}
              className={`sidebar-search absolute right-0 top-0 z-20 flex h-8 items-center overflow-hidden rounded-[8px] bg-[var(--mova-ai-field,#f6f6f6)] text-[var(--mova-ai-ink-muted,#858585)] shadow-[var(--mova-ai-shadow-hairline,none)] transition-[width,opacity] focus-within:text-[var(--mova-ai-ink-secondary,#666)] ${searchOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
              style={{
                width: searchOpen ? "100%" : CHAT_SEARCH_MOTION.closedWidth,
                transitionDuration: `${CHAT_SEARCH_MOTION.duration}ms`,
                transitionTimingFunction: CHAT_SEARCH_MOTION.easing,
              }}
            >
              <span className="ml-2 flex shrink-0 items-center justify-center">
                <IconMagnifyingGlass size={15} />
              </span>
              <input
                ref={searchRef}
                tabIndex={searchOpen ? 0 : -1}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchOpen(false);
                    setQuery("");
                    searchButtonRef.current?.focus();
                  }
                }}
                placeholder="Search chats"
                aria-label="Search chat history"
                className="ml-1.5 min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[var(--mova-ai-ink,#202020)] outline-none placeholder:text-[var(--mova-ai-ink-muted,#858585)]"
              />
              <button
                type="button"
                aria-label="Close chat search"
                tabIndex={searchOpen ? 0 : -1}
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                  searchButtonRef.current?.focus();
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--mova-ai-ink-muted,#858585)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--mova-ai-hover-strong,#e9e9e9)] hover:text-[var(--mova-ai-ink,#202020)] active:scale-[0.96]"
              >
                <IconCrossSmall size={16} />
              </button>
            </div>
          </div>

          {/* Reveal the list without resizing its scroll viewport during the transition. */}
          <div
            id={historyId}
            aria-hidden={!chatsExpanded}
            inert={!chatsExpanded}
            className="min-h-0 flex-1 overflow-y-auto transition-[clip-path,opacity]"
            style={{
              clipPath: chatsExpanded ? "inset(0)" : "inset(0 0 100% 0)",
              opacity: chatsExpanded ? 1 : 0,
              transitionDuration: `${CHAT_SEARCH_MOTION.listDuration}ms`,
              transitionTimingFunction: CHAT_SEARCH_MOTION.easing,
            }}
          >
            <GlideGroup>
              {visibleRecents.map((item) => {
                const active = item.label === selectedTitle;
                return (
                  <button
                    key={item.id}
                    data-row
                    type="button"
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      setInternalNav("chats");
                      onNavigate?.("chats");
                      if (activeTitle === undefined) setDemoActiveTitle(item.label);
                      onPick?.(item.id, item.label, item.prompt);
                    }}
                    className={`sidebar-row relative z-10 mx-2 flex h-8 max-w-[calc(100%-1rem)] items-center rounded-[8px] px-2 text-left transition-[width,background-color,color,transform] duration-150 active:scale-[0.98] ${
                      active ? "bg-[var(--mova-ai-hover-strong,#e9e9e9)] group-hover/glide:bg-transparent" : ""
                    }`}
                  >
                    <span className={`sidebar-copy min-w-0 flex-1 truncate text-[14px] font-medium ${active ? "text-[var(--mova-ai-ink,#202020)]" : "text-[var(--mova-ai-ink-secondary,#666)]"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
              {query && visibleRecents.length === 0 && (
                <div className="sidebar-copy mx-2 px-2 py-2 text-[12.5px] text-[var(--mova-ai-ink-muted,#858585)]">No chats found</div>
              )}
            </GlideGroup>
          </div>
        </div>

        <div inert={collapsed} className="sidebar-copy mx-2 mt-3 w-[208px] shrink-0 border-t border-[var(--mova-ai-border,#dedede)] pb-2 pt-3">
          <button
            type="button"
            onClick={() => { (onFooterClick ?? onNewChat)?.(); }}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[var(--mova-ai-hover-strong,#e9e9e9)] text-[12.5px] font-medium text-[var(--mova-ai-ink,#202020)] transition-[background-color,transform] duration-150 hover:bg-[var(--mova-ai-border-strong,#c8c8c8)] active:scale-[0.98]"
          >
            {footerIcon}
            {footerLabel}
          </button>
          <p role="status" className="sr-only">{feedback}</p>
        </div>
      </div>
    </aside>
  );
}

export default AISidebarNav;
