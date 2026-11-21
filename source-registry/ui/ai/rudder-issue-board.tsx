"use client";

// Adapted from Rudder's KanbanBoard, StatusIcon, and PriorityIcon.
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, FolderKanban, Plus, Tags, UserCheck, Filter, List, Columns3, SlidersHorizontal, ArrowUpDown, ChevronDown, Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Fragment, createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useId, type ReactNode, type RefObject, type CSSProperties } from "react";

export type BoardStatus = "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled";

export interface BoardIssue {
  assignee: string;
  created: string;
  updated?: string;
  id: string;
  labels: string[];
  priority: "critical" | "high" | "medium" | "low";
  project: string;
  reviewer?: string;
  status: BoardStatus;
  title: string;
}

export interface RudderIssueBoardProps {
  theme?: "dark" | "light";
  className?: string;
  initialIssues?: readonly BoardIssue[];
  onIssuesChange?: (issues: BoardIssue[]) => void;
}

const BOARD_STATUSES: readonly BoardStatus[] = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"];
const AI_THEME_STYLES = "__MOVA_AI_DESIGN_TOKENS__";

const createBoardKeyboardCoordinates = (
  getHorizontalTarget: () => BoardStatus | null,
  onHorizontalTarget: (status: BoardStatus | null) => void,
): KeyboardCoordinateGetter => (event, args) => {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") {
    onHorizontalTarget(null);
    return sortableKeyboardCoordinates(event, args);
  }

  event.preventDefault();
  const { context } = args;
  const currentStatus = String(getHorizontalTarget() ?? context.active?.data.current?.status ?? "") as BoardStatus;
  const lanes: Array<{ rect: NonNullable<ReturnType<typeof context.droppableRects.get>>; status: BoardStatus }> = [];

  context.droppableContainers.getEnabled().forEach((container) => {
    const data = container.data.current;
    if (data?.type !== "column" && data?.type !== "hidden-column") return;
    const rect = context.droppableRects.get(container.id);
    if (rect && BOARD_STATUSES.includes(data.status as BoardStatus)) {
      lanes.push({ rect, status: data.status as BoardStatus });
    }
  });

  lanes.sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top);
  const currentIndex = lanes.findIndex((lane) => lane.status === currentStatus);
  const targetIndex = currentIndex + (event.code === "ArrowRight" ? 1 : -1);
  const targetLane = lanes[targetIndex];
  if (!targetLane) {
    onHorizontalTarget(null);
    return;
  }
  onHorizontalTarget(targetLane.status);

  const currentCenterY = context.collisionRect
    ? context.collisionRect.top + context.collisionRect.height / 2
    : targetLane.rect.top;
  let targetRect = targetLane.rect;
  let nearestDistance = Number.POSITIVE_INFINITY;

  context.droppableContainers.getEnabled().forEach((container) => {
    const data = container.data.current;
    if (data?.type !== "issue" || data.status !== targetLane.status) return;
    const rect = context.droppableRects.get(container.id);
    if (!rect) return;
    const distance = Math.abs(rect.top + rect.height / 2 - currentCenterY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      targetRect = rect;
    }
  });

  const activeRect = context.collisionRect;
  return {
    x: targetRect.left + (targetRect.width - (activeRect?.width ?? 0)) / 2,
    y: targetRect.top + (targetRect.height - (activeRect?.height ?? 0)) / 2,
  };
};

const STATUS_META: Record<BoardStatus, { color: string; tint: string; label: string; lane: string; laneOver: string }> = {
  backlog: { color: "var(--mova-ai-neutral-status)", tint: "var(--mova-ai-neutral-status)", label: "Backlog", lane: "border-[var(--mova-ai-border,#3b3b3b)] bg-[var(--mova-ai-canvas,#202020)]", laneOver: "border-[var(--mova-ai-border-strong,#505050)] bg-[var(--mova-ai-hover,#2d2d2d)]" },
  todo: { color: "var(--mova-ai-info)", tint: "var(--mova-ai-info-tint)", label: "To do", lane: "border-[var(--mova-ai-border,#3b3b3b)] bg-[var(--mova-ai-canvas,#202020)]", laneOver: "border-[var(--mova-ai-border-strong,#505050)] bg-[var(--mova-ai-hover,#2d2d2d)]" },
  in_progress: { color: "var(--mova-ai-warning)", tint: "var(--mova-ai-warning-tint)", label: "In progress", lane: "border-[var(--mova-ai-border,#3b3b3b)] bg-[var(--mova-ai-canvas,#202020)]", laneOver: "border-[var(--mova-ai-border-strong,#505050)] bg-[var(--mova-ai-hover,#2d2d2d)]" },
  in_review: { color: "#8b6bd9", tint: "#8b6bd9", label: "In review", lane: "border-[var(--mova-ai-border,#3b3b3b)] bg-[var(--mova-ai-canvas,#202020)]", laneOver: "border-[var(--mova-ai-border-strong,#505050)] bg-[var(--mova-ai-hover,#2d2d2d)]" },
  blocked: { color: "var(--mova-ai-danger)", tint: "var(--mova-ai-danger-tint)", label: "Blocked", lane: "border-[var(--mova-ai-border,#3b3b3b)] bg-[var(--mova-ai-canvas,#202020)]", laneOver: "border-[var(--mova-ai-border-strong,#505050)] bg-[var(--mova-ai-hover,#2d2d2d)]" },
  done: { color: "var(--mova-ai-success)", tint: "var(--mova-ai-success-tint)", label: "Done", lane: "border-[var(--mova-ai-border,#3b3b3b)] bg-[var(--mova-ai-canvas,#202020)]", laneOver: "border-[var(--mova-ai-border-strong,#505050)] bg-[var(--mova-ai-hover,#2d2d2d)]" },
  cancelled: { color: "var(--mova-ai-neutral-status)", tint: "var(--mova-ai-neutral-status)", label: "Cancelled", lane: "border-[var(--mova-ai-border,#3b3b3b)] bg-[var(--mova-ai-canvas,#202020)]", laneOver: "border-[var(--mova-ai-border-strong,#505050)] bg-[var(--mova-ai-hover,#2d2d2d)]" },
};

const DEFAULT_ISSUES: readonly BoardIssue[] = [
  { id: "R6Z-141", title: "Retire legacy Node backend, CLI, and MCP authorities", status: "backlog", priority: "high", assignee: "Noah", project: "Rudder-dev", labels: ["Feature"], created: "Aug 20" },
  { id: "R6Z-140", title: "Cut over the public listener and Rust authorities", status: "backlog", priority: "high", assignee: "Avery", project: "Rudder-dev", labels: ["Feature"], created: "Aug 20" },
  { id: "R6Z-170", title: "Proposal: add history versions and Diff view", status: "todo", priority: "medium", assignee: "Luca", project: "Rudder-dev", labels: ["Feature"], created: "Aug 27" },
  { id: "R6Z-166", title: "Define the issue event contract for agent handoffs", status: "todo", priority: "medium", assignee: "Mira", project: "Rudder-dev", labels: ["Spec"], created: "Aug 26" },
  { id: "R6Z-181", title: "Share 500-index issue context through MCP and CLI", status: "in_progress", priority: "high", assignee: "Sana", project: "Rudder-dev", labels: ["Feature"], created: "Aug 30" },
  { id: "R6Z-210", title: "Re-run the Rust output spool after a capacity failure", status: "in_progress", priority: "high", assignee: "Noah", reviewer: "Mira", project: "Rudder-dev", labels: ["Bug"], created: "Sep 14" },
  { id: "R6Z-207", title: "Remove the loaded Issues hint from the shell", status: "done", priority: "medium", assignee: "Theo", project: "Rudder-dev", labels: ["Feature"], created: "Aug 19" },
];

function StatusIcon({ status }: { status: BoardStatus }) {
  const common = { stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const };
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" data-slot="issue-status-icon" data-status={status} style={{ color: STATUS_META[status].color }} aria-hidden="true">
      <svg viewBox="0 0 16 16" className="h-full w-full overflow-visible" fill="none">
        {status === "backlog" ? <circle cx="8" cy="8" r="5.5" {...common} strokeDasharray="1 3" /> : null}
        {status === "todo" ? <circle cx="8" cy="8" r="5.5" {...common} /> : null}
        {status === "in_progress" ? <><circle cx="8" cy="8" r="5.5" {...common} opacity="0.22" /><path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5" {...common} strokeWidth="2.4" /><path d="M13.5 8a5.5 5.5 0 0 1-5.5 5.5" {...common} strokeWidth="2.4" opacity="0.72" /></> : null}
        {status === "in_review" ? <><circle cx="8" cy="8" r="5.5" {...common} /><circle cx="8" cy="8" r="2" fill="currentColor" /></> : null}
        {status === "done" ? <><circle cx="8" cy="8" r="6.5" fill="currentColor" /><path d="M4.75 8.25 7 10.5l4.25-5" stroke="var(--mova-ai-status-on,#fff)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></> : null}
        {status === "cancelled" ? <><circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.16" /><circle cx="8" cy="8" r="5.5" {...common} /><path d="m5.25 5.25 5.5 5.5m0-5.5-5.5 5.5" {...common} /></> : null}
        {status === "blocked" ? <><path d="M5.1 2.25h5.8l3.05 3.05v5.4l-3.05 3.05H5.1L2.05 10.7V5.3Z" {...common} strokeLinejoin="round" /><path d="m5.25 5.25 5.5 5.5" {...common} /></> : null}
      </svg>
    </span>
  );
}

function PriorityIcon({ priority }: { priority: BoardIssue["priority"] }) {
  const active = priority === "critical" ? 4 : priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  const tone = priority === "critical" ? "var(--mova-ai-danger)" : priority === "high" ? "var(--mova-ai-warning)" : priority === "medium" ? "var(--mova-ai-info)" : "var(--mova-ai-neutral-status)";
  const heights = [4, 6, 10, 14];
  return (
    <span className="inline-flex h-3.5 w-4 items-end gap-[2px]" style={{ color: tone }} aria-hidden="true">
      {heights.map((height, index) => <span className="w-[3px] rounded-[1px] bg-current" key={height} style={{ height: `${height}px`, opacity: index < active ? 1 : 0.25 }} />)}
    </span>
  );
}

const DISPLAY_FIELDS = ["Identifier", "Priority", "Assignee", "Reviewer", "Labels", "Project", "Updated", "Created"] as const;
type DisplayField = typeof DISPLAY_FIELDS[number];
const DisplayContext = createContext<readonly DisplayField[]>(DISPLAY_FIELDS.filter((field) => field !== "Updated"));

function MemberAvatar({ name }: { name: string }) {
  return <span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--mova-ai-hover-strong,#e9e9e9)] text-[9px] font-semibold text-[color:var(--mova-ai-ink,#202020)]">{name.slice(0, 1)}</span>;
}

function IssueListRow({ issue }: { issue: BoardIssue }) {
  const display = useContext(DisplayContext);
  return <article className="rudder-list-row border-b border-[var(--mova-ai-border-soft,#ededed)] px-4 py-3" data-testid={`issue-row-${issue.id}`}>
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5" title={STATUS_META[issue.status].label}><span className="sr-only">{STATUS_META[issue.status].label}</span><StatusIcon status={issue.status} /></span>
      {display.includes("Identifier") ? <span className="shrink-0 pt-0.5 font-mono text-xs text-[color:var(--mova-ai-ink-muted,#858585)]">{issue.id}</span> : null}
      <h3 className="min-w-0 flex-1 break-words text-sm font-medium leading-relaxed text-[color:var(--mova-ai-ink,#202020)]">{issue.title}</h3>
    </div>
    <div className="rudder-list-meta flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[color:var(--mova-ai-ink-secondary,#666)]">
      {display.includes("Priority") ? <span title={`${issue.priority} priority`}><span className="sr-only">{issue.priority} priority</span><PriorityIcon priority={issue.priority} /></span> : null}
      {display.includes("Labels") ? issue.labels.map((label) => <span key={label} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--mova-ai-border,#dedede)] px-2 py-0.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mova-ai-neutral-status,#69737d)]" /><span className="break-words">{label}</span></span>) : null}
      {display.includes("Assignee") ? <span className="inline-flex min-w-0 items-center gap-1.5"><MemberAvatar name={issue.assignee} /><span className="break-words">{issue.assignee}</span></span> : null}
      {display.includes("Reviewer") && issue.reviewer ? <span className="inline-flex items-center gap-1" title="Reviewer"><UserCheck className="h-3 w-3 shrink-0" />{issue.reviewer}</span> : null}
      {display.includes("Project") ? <span className="rudder-list-project break-words">{issue.project}</span> : null}
      {display.includes("Created") ? <span className="whitespace-nowrap">{issue.created}</span> : null}
      {display.includes("Updated") ? <span className="whitespace-nowrap">Updated {issue.updated ?? issue.created}</span> : null}
    </div>
  </article>;
}

function IssueCardBody({ issue }: { issue: BoardIssue }) {
  const display = useContext(DisplayContext);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start gap-2">
        <span className="min-w-0 flex-1 font-mono text-xs text-[color:var(--mova-ai-ink-muted,#858585)]">{display.includes("Identifier") ? issue.id : ""}</span>
        {display.includes("Assignee") ? <span className="inline-flex min-w-0 max-w-[8.5rem] shrink items-center gap-1 overflow-hidden text-xs text-[color:var(--mova-ai-ink-secondary,#666)]">
          <MemberAvatar name={issue.assignee} />
          <span className="truncate">{issue.assignee}</span>
        </span> : null}
      </div>
      <p className="mt-2 break-words text-sm leading-snug text-[color:var(--mova-ai-ink,#202020)]">{issue.title}</p>
      {display.includes("Priority") ? <div className="mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-[color:var(--mova-ai-ink-muted,#858585)]">
        <PriorityIcon priority={issue.priority} />
        <span className="capitalize">{issue.priority}</span>
      </div> : null}
      <div className="mt-2 space-y-1.5 border-t border-[var(--mova-ai-border-soft,#ededed)] pt-2 text-xs text-[color:var(--mova-ai-ink-muted,#858585)]">
        {display.includes("Project") ? <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2"><span className="inline-flex items-center gap-1.5"><FolderKanban className="h-3 w-3" />Project</span><span className="truncate text-right">{issue.project}</span></div> : null}
        {display.includes("Reviewer") && issue.reviewer ? <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2"><span className="inline-flex items-center gap-1.5"><UserCheck className="h-3 w-3" />Reviewer</span><span className="truncate text-right">{issue.reviewer}</span></div> : null}
        {display.includes("Labels") ? <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2"><span className="inline-flex items-center gap-1.5"><Tags className="h-3 w-3" />Labels</span><span className="truncate text-right"><span className="inline-flex items-center gap-1 rounded-full border border-[var(--mova-ai-border,#dedede)] px-1.5 py-0.5 text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--mova-ai-neutral-status,#69737d)]" />{issue.labels[0] ?? "None"}</span></span></div> : null}
        {display.includes("Created") ? <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2"><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3 w-3" />Created</span><span className="truncate text-right">{issue.created}</span></div> : null}
        {display.includes("Updated") ? <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2"><span>Updated</span><span className="truncate text-right">{issue.updated ?? issue.created}</span></div> : null}
      </div>
    </div>
  );
}

function SortableIssueCard({ issue }: { issue: BoardIssue }) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: issue.id, data: { status: issue.status, type: "issue" } });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`motion-kanban-card cursor-grab touch-pan-x overflow-hidden rounded-[9px] border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-surface,#fff)] p-2.5 outline-none transition-[box-shadow,opacity,border-color] motion-reduce:transition-none focus-visible:border-[var(--mova-ai-border-strong,#c8c8c8)] focus-visible:ring-2 focus-visible:ring-[var(--mova-ai-border-strong,#c8c8c8)] active:cursor-grabbing ${isDragging ? "opacity-25" : "hover:border-[var(--mova-ai-border-strong,#c8c8c8)] hover:shadow-sm"}`}
      data-dragging={isDragging ? "true" : "false"}
      data-issue-id={issue.id}
      data-testid={`kanban-card-${issue.id}`}
    >
      <IssueCardBody issue={issue} />
    </article>
  );
}

function BoardColumn({ issues, status, onCreate }: { issues: BoardIssue[]; status: BoardStatus; onCreate: (status: BoardStatus, trigger: HTMLElement) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: status, data: { status, type: "column" } });
  const meta = STATUS_META[status];
  return (
    <div className="flex min-h-0 w-[260px] min-w-[260px] shrink-0 flex-col">
      <div className="mb-1 flex items-center gap-2 px-2 py-2">
        <StatusIcon status={status} />
        <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mova-ai-ink-secondary,#666)]">{meta.label}</span>
        <span className="ml-auto text-xs tabular-nums text-[color:var(--mova-ai-ink-muted,#858585)]">{issues.length}</span>
        <button type="button" onClick={(event) => onCreate(status, event.currentTarget)} aria-label={`Create issue in ${meta.label}`} className="rounded p-1 hover:bg-[var(--mova-ai-hover-strong,#e9e9e9)] focus-visible:ring-2 focus-visible:ring-[var(--mova-ai-border-strong,#c8c8c8)]"><Plus className="h-3.5 w-3.5 text-[color:var(--mova-ai-ink-muted,#858585)]" aria-hidden="true" /></button>
      </div>
      <div
        ref={setNodeRef}
        className={`motion-kanban-lane min-h-[160px] flex-1 space-y-1.5 overflow-y-auto rounded-[9px] border p-1.5 transition-colors motion-reduce:transition-none ${isOver ? meta.laneOver : meta.lane}`}
        data-over={isOver ? "true" : "false"}
        data-status={status}
        style={{ "--lane-status": meta.color, "--lane-tint": meta.tint } as CSSProperties}
        data-testid={`kanban-column-${status}`}
      >
        <SortableContext items={issues.map((issue) => issue.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => <Fragment key={issue.id}><SortableIssueCard issue={issue} /></Fragment>)}
        </SortableContext>
      </div>
    </div>
  );
}

function HiddenStatus({ status, onCreate }: { status: BoardStatus; onCreate: (status: BoardStatus, trigger: HTMLElement) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: status, data: { status, type: "hidden-column" } });
  const meta = STATUS_META[status];
  return (
    <div ref={setNodeRef} className={`motion-kanban-lane flex items-center gap-2 rounded-[9px] border px-2 py-2 transition-colors motion-reduce:transition-none ${isOver ? meta.laneOver : meta.lane}`} data-over={isOver ? "true" : "false"} data-status={status} style={{ "--lane-status": meta.color, "--lane-tint": meta.tint } as CSSProperties} data-testid={`kanban-hidden-column-${status}`}>
      <StatusIcon status={status} />
      <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--mova-ai-ink-secondary,#666)]">{meta.label}</span>
      <span className="text-xs tabular-nums text-[color:var(--mova-ai-ink-muted,#858585)]">0</span>
      <button type="button" onClick={(event) => onCreate(status, event.currentTarget)} aria-label={`Create issue in ${meta.label}`} className="rounded p-1 hover:bg-[var(--mova-ai-hover-strong,#e9e9e9)] focus-visible:ring-2 focus-visible:ring-[var(--mova-ai-border-strong,#c8c8c8)]"><Plus className="h-3.5 w-3.5 text-[color:var(--mova-ai-ink-muted,#858585)]" aria-hidden="true" /></button>
    </div>
  );
}

function ToolbarPopover({ label, icon, children, triggerRef }: { label: string; icon: ReactNode; children: ReactNode; triggerRef?: RefObject<HTMLButtonElement | null> }) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const container = root.current;
    const popup = panel.current;
    const board = container?.closest<HTMLElement>('section[aria-label="Rudder issue board"]');
    if (!container || !popup || !board) return;
    const position = () => {
      const anchor = container.getBoundingClientRect();
      const bounds = board.getBoundingClientRect();
      // Convert viewport measurements back to local CSS pixels for scaled previews.
      const scale = container.offsetWidth ? anchor.width / container.offsetWidth : 1;
      if (!scale) return;
      const inset = 8 * scale;
      popup.style.maxWidth = `${Math.max(0, (bounds.width - inset * 2) / scale)}px`;
      const width = popup.getBoundingClientRect().width;
      const left = Math.max(bounds.left + inset, Math.min(anchor.right - width, bounds.right - inset - width));
      popup.style.left = `${(left - anchor.left) / scale}px`;
      popup.style.right = "auto";
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(board);
    observer.observe(container);
    window.addEventListener("resize", position);
    return () => { observer.disconnect(); window.removeEventListener("resize", position); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("input:checked, button, input")?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return <div ref={root} className="relative" onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <button ref={(node) => { trigger.current = node; if (triggerRef) triggerRef.current = node; }} type="button" aria-label={label === "Sort" ? "Sort issues" : label === "Filter" ? "Filter issues by status" : "Display fields"} aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--mova-ai-hover,#f1f1f1)] ${open ? "bg-[var(--mova-ai-hover-strong,#e9e9e9)] text-[color:var(--mova-ai-ink,#202020)]" : ""}`}>{icon}{label}<ChevronDown className="h-3 w-3" /></button>
    <AnimatePresence initial={false}>{open ? <motion.div key="panel" ref={panel} id={id} role="group" aria-label={`${label} options`} initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -3 }} transition={{ duration: reducedMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }} className="absolute right-0 z-30 mt-2 w-48 space-y-1 rounded-lg border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-surface,#fff)] p-2 text-xs shadow-xl">{children}</motion.div> : null}</AnimatePresence>
  </div>;
}

function resolveTargetStatus(overId: string, issues: BoardIssue[]): BoardStatus | null {
  if (BOARD_STATUSES.includes(overId as BoardStatus)) return overId as BoardStatus;
  return issues.find((issue) => issue.id === overId)?.status ?? null;
}

export function RudderIssueBoard({ theme = "dark", className = "", initialIssues = DEFAULT_ISSUES, onIssuesChange }: RudderIssueBoardProps) {
  const rootRef = useRef<HTMLElement>(null);
  const sortGroupId = useId();
  const keyboardTargetRef = useRef<BoardStatus | null>(null);
  const [issues, setIssues] = useState<BoardIssue[]>(() => [...initialIssues]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("Manual");
  const [descending, setDescending] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [display, setDisplay] = useState<DisplayField[]>(DISPLAY_FIELDS.filter((field) => field !== "Updated"));
  const [creating, setCreating] = useState<BoardStatus | null>(null);
  const [draft, setDraft] = useState("");
  const createInputRef = useRef<HTMLInputElement>(null);
  const createTriggerRef = useRef<HTMLElement | null>(null);
  const listCreateRef = useRef<HTMLButtonElement>(null);
  const statusFilterRef = useRef<HTMLButtonElement>(null);
  const createOpen = creating !== null;
  const restoreCreateFocus = () => requestAnimationFrame(() => {
    const original = createTriggerRef.current;
    (original?.isConnected ? original : listCreateRef.current ?? statusFilterRef.current)?.focus();
  });
  const openCreate = (status: BoardStatus, trigger: HTMLElement) => { createTriggerRef.current = trigger; setCreating(status); setDraft(""); };
  const closeCreate = () => { setCreating(null); restoreCreateFocus(); };
  useEffect(() => { if (createOpen) createInputRef.current?.focus(); }, [createOpen]);
  const orderedIssues = useMemo(() => {
    const matches = issues;
    if (sort === "Manual") return matches;
    const dateValue = (value: string): string | number => { const timestamp = Date.parse(value); return Number.isNaN(timestamp) ? value : timestamp; };
    return [...matches].sort((a, b) => {
      const value = (issue: BoardIssue): string | number => sort === "Status" ? BOARD_STATUSES.indexOf(issue.status) : sort === "Priority" ? ["critical", "high", "medium", "low"].indexOf(issue.priority) : sort === "Title" ? issue.title : dateValue(sort === "Updated" ? issue.updated ?? issue.created : issue.created);
      const av = value(a), bv = value(b);
      const delta = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return descending ? -delta : delta;
    });
  }, [issues, sort, descending]);
  const filtered = useMemo(() => orderedIssues.filter((issue) => statusFilter === "all" || issue.status === statusFilter), [orderedIssues, statusFilter]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<BoardStatus | null>(null);
  const [announcement, setAnnouncement] = useState("Issue board ready. Pick up a card to move it between status columns.");
  const [reduceMotion, setReduceMotion] = useState(false);
  const keyboardCoordinates = useMemo(
    () => createBoardKeyboardCoordinates(
      () => keyboardTargetRef.current,
      (status) => { keyboardTargetRef.current = status; },
    ),
    [],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );
  const grouped = useMemo(() => Object.fromEntries(BOARD_STATUSES.map((status) => [status, filtered.filter((issue) => issue.status === status)])) as Record<BoardStatus, BoardIssue[]>, [filtered]);
  const visibleStatuses = BOARD_STATUSES.filter((status) => grouped[status].length > 0);
  const hiddenStatuses = BOARD_STATUSES.filter((status) => grouped[status].length === 0);
  const activeIssue = activeId ? issues.find((issue) => issue.id === activeId) ?? null : null;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const collisionDetection: CollisionDetection = (args) => {
    if (!args.pointerCoordinates && keyboardTargetRef.current) {
      const target = args.droppableContainers.find((container) => container.id === keyboardTargetRef.current);
      if (target) return [{ id: target.id, data: { droppableContainer: target, value: 0 } }];
    }
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      const issueCollision = pointerCollisions.find(({ id }) =>
        args.droppableContainers.find((container) => container.id === id)?.data.current?.type === "issue"
      );
      if (issueCollision) return [issueCollision];

      const laneCollision = pointerCollisions.find(({ id }) => {
        const type = args.droppableContainers.find((container) => container.id === id)?.data.current?.type;
        return type === "column" || type === "hidden-column";
      });
      const lane = laneCollision
        ? args.droppableContainers.find((container) => container.id === laneCollision.id)
        : null;
      const targetStatus = lane?.data.current?.status as BoardStatus | undefined;
      const laneIssues = targetStatus
        ? args.droppableContainers.filter((container) =>
            container.id !== args.active.id
            && container.data.current?.type === "issue"
            && container.data.current?.status === targetStatus
          )
        : [];
      const laneIssueBottom = Math.max(
        ...laneIssues.map((container) => args.droppableRects.get(container.id)?.bottom ?? Number.NEGATIVE_INFINITY),
      );
      if (args.pointerCoordinates && args.pointerCoordinates.y <= laneIssueBottom) {
        const nearestIssue = closestCenter({ ...args, droppableContainers: laneIssues })[0];
        if (nearestIssue) return [nearestIssue];
      }

      return pointerCollisions;
    }
    return closestCenter(args);
  };

  const clearDrag = (event?: DragCancelEvent) => {
    keyboardTargetRef.current = null;
    setActiveId(null);
    setOverStatus(null);
    if (event) setAnnouncement("Move cancelled.");
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const issue = issues.find((candidate) => candidate.id === String(active.id));
    setActiveId(String(active.id));
    if (issue) setAnnouncement(`Picked up ${issue.id}. Current status: ${STATUS_META[issue.status].label}.`);
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverStatus(over ? resolveTargetStatus(String(over.id), issues) : null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    clearDrag();
    if (!over) {
      setAnnouncement("Move cancelled.");
      return;
    }
    const activeIssueId = String(active.id);
    const overId = String(over.id);
    const targetStatus = resolveTargetStatus(overId, issues);
    const movingIssue = issues.find((issue) => issue.id === activeIssueId);
    if (!targetStatus || !movingIssue) return;

    const sourceStatus = movingIssue.status;
    const allGrouped = Object.fromEntries(BOARD_STATUSES.map((status) => [status, orderedIssues.filter((issue) => issue.status === status)])) as Record<BoardStatus, BoardIssue[]>;
    const targetLaneBeforeMove = allGrouped[targetStatus];
    const nextByStatus = Object.fromEntries(BOARD_STATUSES.map((status) => [status, allGrouped[status].filter((issue) => issue.id !== activeIssueId)])) as Record<BoardStatus, BoardIssue[]>;
    const targetLane = nextByStatus[targetStatus];
    const overIndex = targetLaneBeforeMove.findIndex((issue) => issue.id === overId);
    const insertAt = overIndex >= 0 ? Math.min(overIndex, targetLane.length) : targetLane.length;
    targetLane.splice(insertAt, 0, { ...movingIssue, status: targetStatus });
    const nextIssues = BOARD_STATUSES.flatMap((status) => nextByStatus[status]);

    if (sourceStatus !== targetStatus || nextIssues.map((issue) => issue.id).join("|") !== issues.map((issue) => issue.id).join("|")) {
      setSort("Manual");
      setIssues(nextIssues);
      onIssuesChange?.(nextIssues);
      setAnnouncement(`${movingIssue.id} moved to ${STATUS_META[targetStatus].label}.`);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const movedCard = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-issue-id]") ?? [])
          .find((card) => card.dataset.issueId === activeIssueId);
        (movedCard ?? statusFilterRef.current)?.focus({ preventScroll: true });
      }));
    } else {
      setAnnouncement(`${movingIssue.id} stayed in ${STATUS_META[targetStatus].label}.`);
    }
  };

  return (
    <section ref={rootRef} data-theme={theme} className={`mova-ai-theme rudder-board w-full min-w-0 min-h-[620px] bg-[var(--mova-ai-canvas,#202020)] text-[color:var(--mova-ai-ink,#eeeeee)] ${className}`} aria-label="Rudder issue board">
      <style>{AI_THEME_STYLES}{`
        .rudder-board :is(button,input,select,summary):focus-visible { outline: 2px solid var(--mova-ai-accent,#c2c2c2); outline-offset: 2px; }
        .rudder-board { container-type: inline-size; }
        .rudder-board .motion-kanban-lane[data-status] { position: relative; overflow: hidden; }
        .rudder-board .motion-kanban-lane[data-status] { background: color-mix(in srgb, var(--lane-tint) 30%, var(--mova-ai-canvas,#202020)); border-color: color-mix(in srgb, var(--lane-status) 38%, var(--mova-ai-border,#3b3b3b)); }
        .rudder-board .motion-kanban-lane[data-status][data-over="true"] { background: color-mix(in srgb, var(--lane-tint) 48%, var(--mova-ai-hover,#2d2d2d)); border-color: color-mix(in srgb, var(--lane-status) 68%, var(--mova-ai-border-strong,#505050)); }
        .rudder-board .motion-kanban-lane[data-status]::after { content: ""; position: absolute; inset-inline: 7px; bottom: 0; height: 2px; border-radius: 999px; background: var(--lane-status); opacity: .82; pointer-events: none; }
        .rudder-board .motion-kanban-lane[data-status][data-over="true"]::after { opacity: 1; height: 3px; }
        .rudder-list-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 40%); align-items: start; gap: 16px; }
        .rudder-list-meta { justify-content: flex-end; padding-top: 2px; }
        @container (max-width: 640px) {
          .rudder-list-row { grid-template-columns: minmax(0, 1fr); gap: 8px; }
          .rudder-list-meta { justify-content: flex-start; padding-left: 26px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .motion-kanban-card,
          .motion-kanban-lane {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
      <p className="sr-only" aria-live="assertive">{announcement}</p>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--mova-ai-border,#dedede)] px-4 py-3 text-xs text-[color:var(--mova-ai-ink-secondary,#666)]">
        <h2 className="mr-auto text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--mova-ai-ink-secondary,#666)]">Issues</h2>
        <div className="flex flex-wrap items-center justify-end gap-1">
        <button type="button" aria-label="Show working issues" aria-pressed={statusFilter === "in_progress"} onClick={() => setStatusFilter((value) => value === "in_progress" ? "all" : "in_progress")} className={`mr-1 rounded-md border border-[var(--mova-ai-border,#dedede)] px-2.5 py-1.5 tabular-nums transition-colors hover:bg-[var(--mova-ai-hover,#f1f1f1)] ${statusFilter === "in_progress" ? "bg-[var(--mova-ai-hover-strong,#e9e9e9)] text-[color:var(--mova-ai-ink,#202020)]" : ""}`}>{issues.filter((issue) => issue.status === "in_progress").length} working</button>
        <div className="mr-1 flex rounded-md border border-[var(--mova-ai-border,#dedede)] p-0.5"><button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} className={`rounded p-1 transition-colors ${view === "list" ? "bg-[var(--mova-ai-hover-strong,#e9e9e9)] text-[color:var(--mova-ai-ink,#202020)]" : ""}`}><List className="h-3.5 w-3.5" /></button><button type="button" aria-label="Board view" aria-pressed={view === "board"} onClick={() => setView("board")} className={`rounded p-1 transition-colors ${view === "board" ? "bg-[var(--mova-ai-hover-strong,#e9e9e9)] text-[color:var(--mova-ai-ink,#202020)]" : ""}`}><Columns3 className="h-3.5 w-3.5" /></button></div>
        <ToolbarPopover label="Filter" triggerRef={statusFilterRef} icon={<Filter className="h-3 w-3" />}>
          <div role="radiogroup" aria-label="Issue status">{["all", ...BOARD_STATUSES].map((status) => <label key={status} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--mova-ai-hover,#f1f1f1)]"><input type="radio" className="accent-[var(--mova-ai-accent,#454545)]" name={`${sortGroupId}-status`} checked={statusFilter === status} onChange={() => setStatusFilter(status)} />{status === "all" ? "All statuses" : STATUS_META[status as BoardStatus].label}</label>)}</div>
        </ToolbarPopover>
        <ToolbarPopover label="Sort" icon={<ArrowUpDown className="h-3 w-3" />}>
          <div role="radiogroup" aria-label="Sort field">{["Manual", "Status", "Priority", "Title", "Created", "Updated"].map((value) => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--mova-ai-hover,#f1f1f1)] ${sort === value ? "bg-[var(--mova-ai-hover,#f1f1f1)] text-[color:var(--mova-ai-ink,#202020)]" : ""}`}><input className="accent-[var(--mova-ai-accent,#454545)]" type="radio" name={sortGroupId} checked={sort === value} onChange={() => setSort(value)} />{value}{sort === value ? <Check className="ml-auto h-3 w-3" /> : null}</label>)}</div>
          <button type="button" disabled={sort === "Manual"} onClick={() => setDescending((value) => !value)} aria-label="Toggle sort direction" className="flex w-full items-center gap-2 border-t border-[var(--mova-ai-border,#dedede)] px-2 py-2 text-left disabled:opacity-40"><ArrowUpDown className="h-3 w-3" />{descending ? "Descending" : "Ascending"}</button>
        </ToolbarPopover>
        <ToolbarPopover label="Display" icon={<SlidersHorizontal className="h-3 w-3" />}>{DISPLAY_FIELDS.map((field) => <label key={field} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--mova-ai-hover,#f1f1f1)]"><input className="accent-[var(--mova-ai-accent,#454545)]" type="checkbox" checked={display.includes(field)} onChange={() => setDisplay((fields) => fields.includes(field) ? fields.filter((value) => value !== field) : [...fields, field])} />{field}</label>)}</ToolbarPopover>
        </div>
      </div>
      {creating ? <form onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeCreate(); } }} className="flex flex-wrap items-center gap-2 border-b border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-hover,#f1f1f1)] p-3" onSubmit={(event) => { event.preventDefault(); if (!draft.trim()) return; let sequence = issues.length + 1; while (issues.some((issue) => issue.id === `ISS-${sequence}`)) sequence++; const next = [...issues, { id: `ISS-${sequence}`, title: draft.trim(), status: creating, priority: "medium" as const, assignee: "Unassigned", project: "No project", labels: [], created: new Date().toISOString().slice(0, 10) }]; setIssues(next); onIssuesChange?.(next); setStatusFilter("all"); closeCreate(); setAnnouncement("Issue created."); }}><input ref={createInputRef} required aria-label="New issue title" placeholder="Issue title" value={draft} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1 rounded border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-field,#f6f6f6)] px-2 py-1.5 text-sm" /><select aria-label="New issue status" value={creating} onChange={(event) => setCreating(event.target.value as BoardStatus)} className="rounded bg-[var(--mova-ai-canvas,#f4f4f4)] p-1 text-xs">{BOARD_STATUSES.map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}</select><button type="submit" className="rounded bg-[var(--mova-ai-accent,#454545)] px-3 py-1.5 text-xs text-[color:var(--mova-ai-accent-foreground,#fff)]">Create</button><button type="button" onClick={closeCreate} className="px-2 text-xs">Cancel</button></form> : null}
      <DisplayContext.Provider value={display}>
      <AnimatePresence mode="wait" initial={false}>
      <motion.div key={view} initial={{ opacity: 0, y: reduceMotion ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -3 }} transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}>
      {view === "list" ? <div className="max-h-[580px] overflow-y-auto">{filtered.map((issue) => <IssueListRow key={issue.id} issue={issue} />)}{filtered.length === 0 ? <p className="py-10 text-center text-sm text-[color:var(--mova-ai-ink-secondary,#666)]">No issues match this filter.</p> : null}<button ref={listCreateRef} type="button" onClick={(event) => openCreate(statusFilter === "all" ? "backlog" : statusFilter as BoardStatus, event.currentTarget)} className="flex items-center gap-2 px-4 py-3 text-xs text-[color:var(--mova-ai-ink-secondary,#666)] transition-colors hover:text-[color:var(--mova-ai-ink,#202020)]"><Plus className="h-3.5 w-3.5" />Add issue</button></div> :
      <DndContext
        autoScroll={{ acceleration: 2, interval: 10, threshold: { x: 0.08, y: 0.2 } }}
        collisionDetection={collisionDetection}
        onDragCancel={clearDrag}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div className="overflow-x-auto overscroll-x-contain p-3 sm:p-4">
          <div className="flex min-h-[520px] min-w-max items-stretch gap-3">
            {visibleStatuses.map((status) => <Fragment key={status}><BoardColumn issues={grouped[status]} status={status} onCreate={openCreate} /></Fragment>)}
            {hiddenStatuses.length > 0 ? (
              <div className={`motion-kanban-lane flex min-h-0 w-[228px] min-w-[228px] shrink-0 flex-col rounded-[10px] border p-2 transition-colors motion-reduce:transition-none ${overStatus && hiddenStatuses.includes(overStatus) ? "border-[var(--mova-ai-border-strong,#c8c8c8)] bg-[var(--mova-ai-hover,#f1f1f1)]" : "border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-canvas,#f4f4f4)]"}`} data-testid="kanban-hidden-columns">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mova-ai-ink-muted,#858585)]">Hidden columns</span>
                  <span className="ml-auto text-xs tabular-nums text-[color:var(--mova-ai-ink-muted,#858585)]">{hiddenStatuses.length}</span>
                </div>
                <div className="space-y-2">{hiddenStatuses.map((status) => <Fragment key={status}><HiddenStatus status={status} onCreate={openCreate} /></Fragment>)}</div>
              </div>
            ) : null}
          </div>
        </div>
        <DragOverlay dropAnimation={reduceMotion ? null : { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {activeIssue ? <article className="w-[247px] rotate-[0.4deg] scale-[1.015] overflow-hidden rounded-[9px] border border-[var(--mova-ai-border-strong,#c8c8c8)] bg-[var(--mova-ai-surface,#fff)] p-2.5 shadow-[0_18px_48px_rgba(0,0,0,.48)]"><IssueCardBody issue={activeIssue} /></article> : null}
        </DragOverlay>
      </DndContext>}
      </motion.div>
      </AnimatePresence>
      </DisplayContext.Provider>
    </section>
  );
}

export default RudderIssueBoard;
