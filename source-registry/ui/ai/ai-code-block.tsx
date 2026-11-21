"use client";

/** Adapted from Beautiful UI (https://github.com/slev12397/beautiful-ui).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/* ─────────────────────────────────────────────────────────
 * CODE BLOCK
 * A light editor panel with two versions (switch in the card):
 *   · Code — a line-numbered listing
 *   · Diff — a unified diff: old/new gutters, a green/red accent
 *     bar and row tint, plus word-level add/del highlights.
 * Both share syntax coloring, insets, and wrapping behavior.
 * ───────────────────────────────────────────────────────── */

const FILE = "churn.ts";

const CODE_LINES = [
  "export async function churnBatch() {",
  '  const flavor = await getFlavor("pistachio");',
  "  const base = await dairy.fetch({ flavor });",
  '  await freezer.store(base, { temp: "-16C" });',
  "  if (!base.approved) return null;",
  "  return base.gallons;",
  "}",
];

/* A single run of code within a diff row; `change` tints it as an add/del. */
export type CodePiece = { text: string; change?: "add" | "del" };
/* One row of a unified diff: old/new line numbers, its kind, and its pieces. */
export type DiffRow = {
  old: number | null;
  cur: number | null;
  type: "ctx" | "add" | "del";
  pieces: CodePiece[];
};
/* Prominent copy strings on the code block. */
export type CodeBlockLabels = { copy: string; copied: string };

// Back-compat internal aliases for the local component signatures.
type Piece = CodePiece;
type Row = DiffRow;

const DIFF: Row[] = [
  { old: 1, cur: 1, type: "ctx", pieces: [{ text: "export async function churnBatch() {" }] },
  { old: 2, cur: 2, type: "ctx", pieces: [{ text: '  const flavor = await getFlavor("pistachio");' }] },
  { old: 3, cur: 3, type: "ctx", pieces: [{ text: "  const base = await dairy.fetch({ flavor });" }] },
  { old: 4, cur: null, type: "del", pieces: [{ text: "  await freezer.store(base, { temp: " }, { text: '"-14C"', change: "del" }, { text: " });" }] },
  { old: null, cur: 4, type: "add", pieces: [{ text: "  await freezer.store(base, { temp: " }, { text: '"-16C"', change: "add" }, { text: " });" }] },
  { old: null, cur: 5, type: "add", pieces: [{ text: "  if (!base.approved) return null;" }] },
  { old: 5, cur: 6, type: "ctx", pieces: [{ text: "  return base.gallons;" }] },
  { old: 6, cur: 7, type: "ctx", pieces: [{ text: "}" }] },
];

const HATCH = "repeating-linear-gradient(45deg, var(--mova-ai-danger,#a33c3c) 0, var(--mova-ai-danger,#a33c3c) 1.5px, transparent 1.5px, transparent 3px)";

/* light syntax coloring — keywords/imports/conditionals, functions, strings & numbers */
const KEYWORDS = new Set(["import", "from", "export", "default", "async", "function", "const", "let", "var", "await", "return", "if", "else", "for", "while", "new", "throw", "try", "catch", "null", "true", "false", "undefined"]);
const TOKEN = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b(?:import|from|export|default|async|function|const|let|var|await|return|if|else|for|while|new|throw|try|catch|null|true|false|undefined)\b|[A-Za-z_$][\w$]*(?=\s*\())/g;

function highlight(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    const t = m[0];
    if (idx > last) nodes.push(<span key={k++}>{text.slice(last, idx)}</span>);
    let color: string;
    let weight: number | undefined;
    if (/^["'`]/.test(t) || /^\d/.test(t)) color = "var(--mova-ai-warning,#986517)"; // string / number
    else if (KEYWORDS.has(t)) color = "var(--mova-ai-accent-ink,#333)"; // keyword / import / conditional
    else { color = "var(--mova-ai-ink,#202020)"; weight = 500; } // function call
    nodes.push(<span key={k++} style={{ color, fontWeight: weight }}>{t}</span>);
    last = idx + t.length;
  }
  if (last < text.length) nodes.push(<span key={k++}>{text.slice(last)}</span>);
  return nodes;
}

function Pieces({ pieces }: { pieces: Piece[] }) {
  return (
    <>
      {pieces.map((p, i) => {
        if (p.change) {
          const add = p.change === "add";
          return (
            <span
              key={i}
              className="rounded-[3px]"
              style={{
                background: `color-mix(in srgb, var(--${add ? "green" : "red"}) 18%, transparent)`,
                padding: "0 2px",
                margin: "0 -1px",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
              }}
            >
              {highlight(p.text)}
            </span>
          );
        }
        return <span key={i}>{highlight(p.text)}</span>;
      })}
    </>
  );
}

function CodeContent({ isDiff, lines, diff }: { isDiff: boolean; lines: string[]; diff: Row[] }) {
  return isDiff ? (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-5 w-px bg-[var(--mova-ai-border,#dedede)]" />
      {diff.map((r, i) => {
        const add = r.type === "add";
        const del = r.type === "del";
        // one gutter column: removals keep the old number, additions/context show the new one
        const num = del ? r.old : r.cur;
        return (
          <div
            key={i}
            className={`relative grid grid-cols-[20px_minmax(0,1fr)] items-start
              ${add ? "bg-[var(--mova-ai-success-tint,#e8f3ec)]" : del ? "bg-[var(--mova-ai-danger-tint,#f7eaea)]" : ""}`}
          >
            {(add || del) && (
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: add ? "var(--mova-ai-success,#28734d)" : HATCH }} />
            )}
            <span className={`select-none text-center text-[11px] ${add ? "text-[var(--mova-ai-success,#28734d)]" : del ? "text-[var(--mova-ai-danger,#a33c3c)]" : "text-[var(--mova-ai-ink-muted,#858585)]"}`}>{num ?? ""}</span>
            <code className="pr-3 pl-1 break-words whitespace-pre-wrap">
              <Pieces pieces={r.pieces} />
            </code>
          </div>
        );
      })}
    </div>
  ) : (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-5 w-px bg-[var(--mova-ai-border,#dedede)]" />
      {lines.map((line, i) => (
        <div key={i} className="grid grid-cols-[20px_minmax(0,1fr)] items-start">
          <span className="select-none text-center text-[11px] text-[var(--mova-ai-ink-muted,#858585)]">{i + 1}</span>
          <code className="pr-3 pl-1 break-words whitespace-pre-wrap">{highlight(line)}</code>
        </div>
      ))}
    </div>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--mova-ai-ink-muted,#858585)]">
      <path d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  );
}

const DEFAULT_LABELS: CodeBlockLabels = { copy: "Copy", copied: "Copied" };

export type CodeBlockProps = {
  /** Which view to render — "Code" (line-numbered listing) or "Diff". */
  variant?: string;
  /** The lines shown in the Code view. */
  lines?: string[];
  /** Raw text placed on the clipboard by Copy. Defaults to `lines` joined. */
  code?: string;
  /** The unified-diff rows shown in the Diff view. */
  diff?: DiffRow[];
  /** Filename shown in the header. */
  filename?: string;
  /** Prominent copy strings. */
  labels?: Partial<CodeBlockLabels>;
  /** Called with the copied text after a successful copy. */
  onCopy?: (text: string) => void;
};

function CodeBlock({
  variant,
  lines = CODE_LINES,
  code,
  diff = DIFF,
  filename = FILE,
  labels,
  onCopy,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState("Code");
  const [hasSwitchedView, setHasSwitchedView] = useState(false);
  const isDiff = (variant ?? view) === "Diff";
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {if (copyTimer.current) clearTimeout(copyTimer.current);}, []);
  const contentRef = useRef<HTMLDivElement>(null);
  const codeMeasureRef = useRef<HTMLDivElement>(null);
  const diffMeasureRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(0);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    let measuredWidth = -1;
    const measure = (force = false) => {
      const width = content.clientWidth;
      if (!force && width === measuredWidth) return;
      measuredWidth = width;
      const codeHeight = codeMeasureRef.current?.scrollHeight ?? 0;
      const diffHeight = diffMeasureRef.current?.scrollHeight ?? 0;
      setReservedHeight(Math.max(codeHeight, diffHeight));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure(true));
    const handleResize = () => measure(true);
    observer?.observe(content);
    if (codeMeasureRef.current) observer?.observe(codeMeasureRef.current);
    if (diffMeasureRef.current) observer?.observe(diffMeasureRef.current);
    window.addEventListener("resize", handleResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [lines, diff]);
  const text = { ...DEFAULT_LABELS, ...labels };
  const raw = code ?? (isDiff ? diff.map((row) => `${row.type === "add" ? "+" : row.type === "del" ? "-" : " "}${row.pieces.map((piece) => piece.text).join("")}`).join("\n") : lines.join("\n"));

  const copy = useCallback(() => {
    setCopyError(false);
    if (!navigator.clipboard) {setCopyError(true); return;}
    navigator.clipboard.writeText(raw).then(() => {
      setCopied(true);
      onCopy?.(raw);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => setCopyError(true));
  }, [raw, onCopy]);

  const added = diff.filter((r) => r.type === "add").length;
  const removed = diff.filter((r) => r.type === "del").length;

  return (
    <div className="w-full max-w-105 overflow-hidden rounded-lg border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-surface,#fff)] text-[color:var(--mova-ai-ink,#202020)] shadow-[var(--mova-ai-shadow-card,none)]">
      {/* header — file · (diff stat | copy) */}
      <div className="mova-ai-code-header grid min-h-11 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-[var(--mova-ai-border,#dedede)] px-4 text-[12.5px]">
        <span className="mova-ai-code-filename inline-flex min-w-0 items-center gap-[7px]">
          <FileIcon />
          <span className="min-w-0 truncate font-mono leading-none text-[var(--mova-ai-ink,#202020)]">{filename}</span>
        </span>

        {variant === undefined && <div role="group" aria-label="Code view" className="mova-ai-code-view-controls relative inline-grid shrink-0 grid-cols-2 items-center justify-self-center rounded-[6px] bg-[var(--mova-ai-field,#f6f6f6)] p-0.5">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0.5 top-0.5 bottom-0.5 rounded-[4px] bg-[var(--mova-ai-surface,#fff)] shadow-[var(--mova-ai-shadow-btn,none)] transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ width: "calc((100% - 4px) / 2)", transform: view === "Diff" ? "translateX(100%)" : "translateX(0)" }}
          />
          {["Code", "Diff"].map((item) => <button key={item} type="button" aria-pressed={view === item} onClick={() => {setView(item);setHasSwitchedView(true);setCopied(false);setCopyError(false);}} className={`relative z-10 min-w-[34px] rounded-[4px] px-1.5 py-1 text-[11px] leading-none transition-colors duration-150 ${view === item ? "text-[var(--mova-ai-ink,#202020)]" : "text-[var(--mova-ai-ink-muted,#858585)]"}`}>{item}</button>)}
        </div>}
        <div className="mova-ai-code-actions col-start-3 flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span
            aria-hidden={!isDiff}
            className={`inline-flex shrink-0 items-center gap-2 font-mono text-[12px] leading-none tabular-nums ${isDiff ? "visible" : "invisible"}`}
          >
              <span className="text-[var(--mova-ai-success,#28734d)]">+{added}</span>
              <span className="text-[var(--mova-ai-danger,#a33c3c)]">-{removed}</span>
          </span>
          <button
            type="button"
            aria-label={isDiff ? "Copy diff" : "Copy code"}
            aria-live="polite"
            onClick={copy}
            className={`mova-ai-code-copy-button flex min-h-6 min-w-0 max-w-full items-center gap-1 rounded-[6px] px-1.5 text-[12px]
              font-medium transition-colors duration-100 hover:bg-[var(--mova-ai-hover,#f1f1f1)]
              ${copied ? "text-[var(--mova-ai-success,#28734d)]" : "text-[var(--mova-ai-ink-muted,#858585)] hover:text-[var(--mova-ai-ink,#202020)]"}`}
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            )}
            <span className="min-w-0 break-words">{copied ? text.copied : text.copy}</span>
          </button>
        </div>
      </div>
      {copyError && <div role="alert" className="px-4 py-1 text-[11px] text-[var(--mova-ai-danger,#a33c3c)]">Clipboard unavailable. Select the code to copy.</div>}

      {/* body — equal 12px inset on top / left / right; lines wrap */}
      <div className="py-3 font-mono text-[12.5px] leading-[1.65] text-[var(--mova-ai-ink-secondary,#666)]">
        <div ref={contentRef} className="relative" style={{ minHeight: reservedHeight || undefined }}>
          {/* Passive layout copies account for wrapping; the only visible content layer is the active view below. */}
          <div aria-hidden="true" className="pointer-events-none invisible absolute inset-0 select-none">
            <div ref={codeMeasureRef} className="absolute inset-x-0 top-0">
              <CodeContent isDiff={false} lines={lines} diff={diff} />
            </div>
            <div ref={diffMeasureRef} className="absolute inset-x-0 top-0">
              <CodeContent isDiff={true} lines={lines} diff={diff} />
            </div>
          </div>
          <div key={isDiff ? "diff" : "code"} className={hasSwitchedView ? "mova-ai-code-view-enter" : undefined}>
            <CodeContent isDiff={isDiff} lines={lines} diff={diff} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Shadow values from shadow-plugin. */
const AI_THEME_STYLES = "__MOVA_AI_DESIGN_TOKENS__";
const scopedStyles = `.mova-ai-code-block{container-type:inline-size} .mova-ai-code-block .primitive-card-pad{padding:12px} .mova-ai-code-block .primitive-card-bar{padding:10px 12px} .mova-ai-code-block .primitive-card-footer{padding:10px} .mova-ai-code-block .primitive-icon-button{display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:8px}
.mova-ai-code-block :is(button,input,[tabindex]):focus-visible{outline:2px solid var(--mova-ai-accent,#454545)!important;outline-offset:2px} .mova-ai-code-block button:not(:disabled){cursor:pointer} .mova-ai-code-block code{overflow-wrap:anywhere} .mova-ai-code-block *, .mova-ai-code-block *::before,.mova-ai-code-block *::after{box-sizing:border-box}
.mova-ai-code-block .mova-ai-code-view-enter{animation:mova-ai-code-block-view-enter 180ms cubic-bezier(.2,.7,.2,1) both}
@keyframes mova-ai-code-block-view-enter{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
@keyframes mova-ai-code-block-pop-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
@keyframes mova-ai-code-block-fade-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes mova-ai-code-block-shimmer-text{from{background-position:150% center}to{background-position:-50% center}}
@container (max-width:360px){.mova-ai-code-block .mova-ai-code-header{grid-template-columns:minmax(0,1fr) minmax(0,1fr);row-gap:8px;padding-top:8px;padding-bottom:8px}.mova-ai-code-block .mova-ai-code-filename{grid-column:1;grid-row:1}.mova-ai-code-block .mova-ai-code-actions{grid-column:2;grid-row:1;max-width:100%}.mova-ai-code-block .mova-ai-code-view-controls{grid-column:1/-1;grid-row:2}}
@media(prefers-reduced-motion:reduce){.mova-ai-code-block *, .mova-ai-code-block *::before, .mova-ai-code-block *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`;

export function AICodeBlock({theme = "light", ...props}: CodeBlockProps & {theme?: "light" | "dark"} = {}) {
 return <div className="mova-ai-theme mova-ai-code-block w-full min-w-0 max-w-105" data-theme={theme}><style>{AI_THEME_STYLES}{scopedStyles}</style><CodeBlock {...props} /></div>;
}
