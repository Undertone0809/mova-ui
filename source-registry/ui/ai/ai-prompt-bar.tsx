"use client";

// Adapted from Beautiful UI.
// Original composer geometry, controls, glide motion, and Glimm sweep are retained.

import { useEffect, useLayoutEffect, useRef, useState, useId } from "react";
import type { Palette, ShaderController, SweepHandle } from "glimm";

type SpeechRecognizer = {
  lang: string; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
/* Shadow tokens from shadow-plugin 2.1.1. */
const AI_THEME_STYLES = "__MOVA_AI_DESIGN_TOKENS__";
const COMPONENT_STYLES = `[data-mova-prompt] button:focus-visible { outline:2px solid var(--mova-ai-accent,#454545);outline-offset:2px; }
[data-mova-prompt] :is(input,textarea):focus-visible { outline:none; }
[data-mova-prompt] .prompt-composer:focus-within { outline:2px solid var(--mova-ai-accent,#454545);outline-offset:2px; }
[data-mova-prompt] button { cursor:pointer; } [data-mova-prompt] button:disabled { cursor:default; }

@keyframes mova-prompt-pop {from {opacity:0;transform:scale(.95)} to {opacity:1;transform:scale(1)}}
@keyframes mova-prompt-eq {0%,100% {transform:scaleY(.35)} 50% {transform:scaleY(1)}}
@media(prefers-reduced-motion:reduce) { [data-mova-prompt], [data-mova-prompt] * {animation:none!important;transition:none!important;scroll-behavior:auto!important;} }
`;

/* The built-in "prism" palette is only cyan→indigo→magenta, so a sweep
 * reads as blue/purple. Build a true full-spectrum rainbow instead. */
type GlimmRuntime = typeof import("glimm");


/* ─────────────────────────────────────────────────────────
 * PROMPT BAR
 * A composer with real controls: attach, @ data sources,
 * / commands, a model picker, dictation, and send.
 * Type @ or / to open the menus; ↑↓ + Enter to pick.
 * Variants: Rounded (card radius) · Pill (full radius).
 * ───────────────────────────────────────────────────────── */

function Icon({ children, size = 15, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, React.ReactNode> = {
  clip: <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  layers: <g><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></g>,
  globe: <g><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g>,
};

/* real product marks, inline so the file stays self-contained */
const BRANDS: Record<string, React.ReactNode> = {
  figma: (
    <svg width="11" height="16" viewBox="0 0 38 57" aria-hidden="true">
      <path d="M9.5 57A9.5 9.5 0 0 0 19 47.5V38H9.5a9.5 9.5 0 0 0 0 19z" fill="#0ACF83" />
      <path d="M0 28.5A9.5 9.5 0 0 1 9.5 19H19v19H9.5A9.5 9.5 0 0 1 0 28.5z" fill="#A259FF" />
      <path d="M0 9.5A9.5 9.5 0 0 1 9.5 0H19v19H9.5A9.5 9.5 0 0 1 0 9.5z" fill="#F24E1E" />
      <path d="M19 0h9.5a9.5 9.5 0 1 1 0 19H19V0z" fill="#FF7262" />
      <path d="M38 28.5a9.5 9.5 0 1 1-19 0 9.5 9.5 0 0 1 19 0z" fill="#1ABCFE" />
    </svg>
  ),
  slack: (
    <svg width="15" height="15" viewBox="0 0 127 127" aria-hidden="true">
      <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A" />
      <path d="M47 27.2c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.7 39.7.8 47 .8c7.3 0 13.2 5.9 13.2 13.2v13.2H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.3.7 54.4.7 47.1c0-7.3 5.9-13.2 13.2-13.2H47z" fill="#36C5F0" />
      <path d="M99.9 47.1c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V47.1zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.9C66.9 6.6 72.8.7 80.1.7c7.3 0 13.2 5.9 13.2 13.2v33.2z" fill="#2EB67D" />
      <path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z" fill="#ECB22E" />
    </svg>
  ),
  gmail: (
    <svg width="15" height="12" viewBox="0 0 256 193" aria-hidden="true">
      <path d="M58.182 192.05V93.14L27.507 65.077 0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455h40.727Z" fill="#4285F4" />
      <path d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837-27.026 25.798v98.91Z" fill="#34A853" />
      <path d="m58.182 93.14-4.174-38.647 4.174-36.989L128 69.868l69.818-52.364 4.669 34.992-4.669 40.644L128 145.504 58.182 93.14Z" fill="#EA4335" />
      <path d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945l-16.292 12.218Z" fill="#FBBC04" />
      <path d="m0 49.504 26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23v23.273Z" fill="#C5221F" />
    </svg>
  ),
};

type Source = {
  key: string;
  name: string;
  desc: string;
  glyph?: string;
  brand?: string;
  attach?: boolean;
  connect?: boolean;
};

const SOURCES: Source[] = [
  { key: "attach", name: "Add photos & files", desc: "Upload from your computer", glyph: "clip", attach: true },
  { key: "scoop", name: "Scoop Data", desc: "Sales & churn metrics", glyph: "chart" },
  { key: "flavors", name: "Flavor records", desc: "26 makers, tags, links", glyph: "layers" },
  { key: "web", name: "Web search", desc: "Real-time news and info", glyph: "globe" },
  { key: "figma", name: "Figma", desc: "Design-to-code workflows", brand: "figma" },
  { key: "slack", name: "Slack", desc: "Read and manage Slack", brand: "slack" },
  { key: "gmail", name: "Gmail", desc: "Read and manage Gmail", brand: "gmail", connect: true },
];

const COMMANDS = [
  { key: "compare", name: "/compare", desc: "Flavor vs. last summer" },
  { key: "churn-plan", name: "/churn-plan", desc: "Draft a churn schedule" },
  { key: "restock", name: "/restock", desc: "Build a reorder list" },
  { key: "draft-email", name: "/draft-email", desc: "Write a supplier email" },
  { key: "summarize", name: "/summarize", desc: "Digest the thread so far" },
];

const MODELS = [
  { key: "sprinkles-5", name: "Sprinkles 5", tag: "Flagship" },
  { key: "vanilla-1", name: "Vanilla 1", tag: "Basic" },
  { key: "freezer-burn", name: "Freezer Burn 0.4", tag: "Stale" },
];



/* self-running demo: walk the @ menu, then the / menu, and repeat.
 * Any pointer or key interaction hands control to the user. */
const AUTO_STEPS: {
  draft: string;
  active?: number;
  connect?: boolean;
  modelOpen?: boolean;
  model?: string;
  hold: number;
}[] = [
  { draft: "", connect: false, model: "vanilla-1", hold: 1100 },
  { draft: "@", active: 0, hold: 900 },
  { draft: "@", active: 1, hold: 620 },
  { draft: "@", active: 4, hold: 620 },
  { draft: "@", active: 6, hold: 700 },
  { draft: "@", active: 6, connect: true, hold: 1000 },
  { draft: "", hold: 700 },
  { draft: "/", active: 0, hold: 900 },
  { draft: "/", active: 1, hold: 620 },
  { draft: "/", active: 3, hold: 1000 },
  { draft: "", hold: 800 },
  // open the model picker and upgrade to the flagship → rainbow sweep
  { draft: "", modelOpen: true, hold: 1200 },
  { draft: "", model: "sprinkles-5", hold: 2400 },
  { draft: "", hold: 900 },
];

/* the last @word or /word being typed, if any */
function parseToken(draft: string): { kind: "at" | "slash"; query: string; start: number } | null {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

export function AIPromptBar({
  theme = "dark",
  className = "",
  variant = "Rounded",
  demo = true,
  tall = false,
  placeholder,
  onSend,
}: {
  theme?: "dark" | "light";
  className?: string;
  variant?: string;
  /** the self-running walkthrough; turn off when embedding in a real surface */
  demo?: boolean;
  /** hero sizing: a multi-line input with controls on their own row */
  tall?: boolean;
  placeholder?: string;
  /** The first argument preserves the original text-only callback API. */
  onSend?: (text: string, submission: {
    files: File[];
    sources: Array<{ key: string; name: string; desc: string }>;
    model: { key: string; name: string; tag: string };
  }) => void;
}) {
  const sourceMenuId = useId();
  const modelMenuId = useId();
  const [feedback, setFeedback] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognizer | null>(null);
  const sweepRef = useRef<SweepHandle | null>(null);
  const glimmRuntimeRef = useRef<{ api: GlimmRuntime; rainbow: Palette } | null>(null);
  const pendingSweepRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pill = variant === "Pill";
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState(MODELS[1]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedSources, setSelectedSources] = useState<Source[]>([]);
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [auto, setAuto] = useState(demo);
  const [autoStep, setAutoStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const wide = expanded || tall;
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [modelBox, setModelBox] = useState<{ top: number; height: number } | null>(null);
  const [modelHovered, setModelHovered] = useState<number | null>(null);
  const [modelMenuLeft, setModelMenuLeft] = useState(0);
  const [modelMenuBottom, setModelMenuBottom] = useState(0);
  const composerAnchorRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modelRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const glimmRef = useRef<HTMLCanvasElement>(null);
  const shaderRef = useRef<ShaderController | null>(null);
  const sweepingRef = useRef(false);

  /* hand control to the user: stop the demo loop, and when they aim at
   * the input itself, clear the demo's leftover draft for a clean start */
  const takeOver = (event: { target: EventTarget | null }) => {
    setAuto(false);
    if (auto && event.target === inputRef.current) setDraft("");
  };

  const token = dismissed ? null : parseToken(draft);
  const menu: "at" | "slash" | null = plusOpen ? "at" : token?.kind ?? null;
  const query = plusOpen ? "" : token?.query ?? "";

  const rows: { key: string; name: string; desc: string }[] =
    menu === "at"
      ? SOURCES.filter((s) => s.name.toLowerCase().includes(query))
      : menu === "slash"
        ? COMMANDS.filter((c) => c.name.slice(1).startsWith(query))
        : [];

  useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menu, query]);

  /* a single highlight glides to the active row instead of each row
   * toggling its own background — matches the gliding pill in the nav */
  useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menu, query, active, connected, rows.length]);

  /* same gliding highlight in the model menu — floats to the hovered
   * row, falling back to the currently-selected model */
  const modelIndex = MODELS.findIndex((m) => m.key === model.key);
  useLayoutEffect(() => {
    if (!modelOpen) return;
    const target = modelRowRefs.current[modelHovered ?? modelIndex];
    if (target) setModelBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [modelOpen, modelHovered, modelIndex]);

  /* The menu is outside the clipped composer. Reposition it when the
   * preview resizes as well as when it opens. */
  useLayoutEffect(() => {
    if (!modelOpen || !composerAnchorRef.current || !modelRef.current) return;
    const reposition = () => {
      const anchorRect = composerAnchorRef.current?.getBoundingClientRect();
      const triggerRect = modelRef.current?.getBoundingClientRect();
      if (!anchorRect || !triggerRect) return;
      const menuWidth = modelMenuRef.current?.offsetWidth ?? 208;
      setModelMenuLeft(Math.max(0, Math.min(triggerRect.left - anchorRect.left, anchorRect.width - menuWidth)));
      setModelMenuBottom(anchorRect.bottom - triggerRect.top + 8);
    };
    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(composerAnchorRef.current);
    window.addEventListener("resize", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
    };
  }, [modelOpen, wide, model.name]);

  useEffect(() => {
    if (!modelOpen) setModelHovered(null);
  }, [modelOpen]);

  /* Build the shader with a pinned hue phase. createShader seeds its
   * internal hueShift from Math.random(), which made the sweep a different
   * colour on every reload — pin it so the rainbow is identical each time. */
  const makeShader = () => {
    const canvas = glimmRef.current;
    const runtime = glimmRuntimeRef.current;
    if (!runtime || !canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    const random = Math.random;
    Math.random = () => 0;
    try {
      return runtime.api.createShader({
        canvas,
        palette: runtime.rainbow,
        direction: "ltr",
        bandTight: 10,
        swellAmount: 0.85,
      });
    } catch {
      return null;
    } finally {
      Math.random = random;
    }
  };

  const stopSweep = () => {
    pendingSweepRef.current = false;
    sweepingRef.current = false;
    sweepRef.current?.cancel();
    sweepRef.current = null;
    shaderRef.current?.destroy();
    shaderRef.current = null;
  };

  /* Glimm shader lives inside the composer, invisible at rest. Selecting
   * the flagship model fires a one-shot rainbow sweep across the interior. */
  useEffect(() => {
    let disposed = false;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => { if (motionQuery.matches) stopSweep(); };
    motionQuery.addEventListener("change", motionChanged);
    // Glimm is ESM-only: keep module evaluation safe for CJS and SSR consumers.
    void import("glimm").then((api) => {
      if (disposed) return;
      const { ACCENTS, accentChain } = api;
      glimmRuntimeRef.current = {
        api,
        rainbow: accentChain([ACCENTS.red, ACCENTS.orange, ACCENTS.yellow, ACCENTS.green, ACCENTS.cyan, ACCENTS.blue, ACCENTS.purple]),
      };
      if (pendingSweepRef.current) celebrate();
    }).catch(() => {
      // The composer remains functional if the optional visual cannot load.
      if (!disposed) pendingSweepRef.current = false;
    });
    return () => {
      disposed = true;
      motionQuery.removeEventListener("change", motionChanged);
      stopSweep();
      glimmRuntimeRef.current = null;
      recognitionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const celebrate = () => {
    if (sweepingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const runtime = glimmRuntimeRef.current;
    if (!runtime) { pendingSweepRef.current = true; return; }
    pendingSweepRef.current = false;
    // Recreate the shader per sweep so uTime restarts at 0 — the hue phase
    // (which drifts with time) is then identical on every trigger.
    shaderRef.current?.destroy();
    const shader = makeShader();
    shaderRef.current = shader;
    if (!shader) return;
    sweepingRef.current = true;
    const sweep = runtime.api.playSweep(shader, {
      palette: runtime.rainbow,
      direction: "ltr",
      sweepMs: 570,
      outroMs: 80,
      peakAlpha: 1.3,
      bandTight: 10,
      brightness: 1.4,
      swellAmount: 1,
      waveSpeed: 1.8,
      easing: "easeOutExpo",
    });
    sweepRef.current = sweep;
    sweep.done.finally(() => {
      if (sweepRef.current === sweep) {
        sweepingRef.current = false;
        sweepRef.current = null;
        shader.destroy();
        if (shaderRef.current === shader) shaderRef.current = null;
      }
    });
  };

  const selectModel = (next: (typeof MODELS)[number]) => {
    setModel(next);
    setModelOpen(false);
    if (next.key === "sprinkles-5") celebrate();
    else stopSweep();
  };

  /* autoplay: apply the current step, then advance after its hold */
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const step = AUTO_STEPS[autoStep % AUTO_STEPS.length];
    setDraft(step.draft);
    if (step.active !== undefined) setActive(step.active);
    if (step.connect !== undefined) setConnected(step.connect);
    if (step.modelOpen !== undefined) setModelOpen(step.modelOpen);
    if (step.model) {
      const next = MODELS.find((m) => m.key === step.model);
      if (next) selectModel(next);
    }
    const t = setTimeout(() => setAutoStep((s) => s + 1), step.hold);
    return () => clearTimeout(t);
  }, [auto, autoStep]);

  const toggleDictation = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setFeedback("Dictation is unavailable in this browser. You can type your message instead."); return; }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      setDraft((current) => `${current.trimEnd()} ${text}`.trimStart());
      setFeedback("Dictation added to your message.");
    };
    recognition.onend = () => { setListening(false); inputRef.current?.focus(); };
    recognition.onerror = () => { setListening(false); setFeedback("Dictation could not start. Check microphone access or type your message."); };
    try { recognition.start(); setListening(true); setFeedback("Listening through your microphone…"); }
    catch { setListening(false); setFeedback("Dictation is unavailable right now."); }
  };

  /* Move wrapped text above the controls, then grow to a compact maximum. */
  useLayoutEffect(() => {
    const input = inputRef.current;
    const controls = controlsRef.current;
    const measure = measureRef.current;
    const modelButton = modelRef.current;
    if (!input || !controls || !measure || !modelButton) return;

    const fixedControlsWidth = 28 * 3 + modelButton.offsetWidth;
    const inlineGaps = 4 * 4;
    const inlineInputWidth = controls.clientWidth - fixedControlsWidth - inlineGaps;
    const needsFullWidth = draft.includes("\n") || measure.offsetWidth + 8 > inlineInputWidth;
    if (needsFullWidth !== expanded) {
      setExpanded(needsFullWidth);
    }

    const minHeight = 28;
    const maxHeight = 100;
    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [draft, expanded]);

  /* clicking anywhere outside the composer closes the open menus */
  useEffect(() => {
    if (!modelOpen && !plusOpen) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setDismissed(true);
        setModelOpen(false);
        setPlusOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [modelOpen, plusOpen]);

  const closeMenus = () => {
    setPlusOpen(false);
    setModelOpen(false);
  };

  const pick = (row: { key: string; name: string }) => {
    const source = SOURCES.find((s) => s.key === row.key);
    if (source?.attach) {
      fileRef.current?.click();
      if (token) setDraft(draft.slice(0, token.start));
    } else if (menu === "at") {
      if (source) setSelectedSources((current) => current.some((item) => item.key === source.key) ? current : [...current, source]);
      if (source?.connect) { setConnected(true); setFeedback(`${source.name} selected for this demo. Connect your account in your app to use live data.`); }
      setDraft(`${token ? draft.slice(0, token.start) : draft}@${row.name} `);
    } else {
      setDraft(`${token ? draft.slice(0, token.start) : draft}${row.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const canSend = draft.trim().length > 0 || attachments.length > 0;
  const send = () => {
    if (!canSend) return;
    onSend?.(draft.trim(), {
      files: [...attachments],
      sources: selectedSources.filter((source) => draft.includes(`@${source.name}`)).map(({ key, name, desc }) => ({ key, name, desc })),
      model: { ...model },
    });
    setFeedback(`Sent${attachments.length ? ` with ${attachments.length} attachment${attachments.length === 1 ? "" : "s"}` : ""}: ${draft.trim() || attachments.map((file) => file.name).join(", ")}`);
    setDraft("");
    setAttachments([]);
    setSelectedSources([]);
    closeMenus();
  };

  return (
    <div
      ref={rootRef}
      data-mova-prompt
      data-theme={theme}
      data-promptbar
      className={`mova-ai-theme ${demo ? "flex min-h-[384px] w-full max-w-[420px] flex-col justify-end pb-8" : "w-full"} ${className}`}
      onPointerDownCapture={takeOver}
      onKeyDownCapture={(event) => { takeOver(event); if (event.key === "Escape") { event.stopPropagation(); setDismissed(true); closeMenus(); inputRef.current?.focus(); } }}
    >
      <style>{AI_THEME_STYLES}{COMPONENT_STYLES}</style>
      <input ref={fileRef} type="file" multiple className="hidden" aria-label="Attach files" onChange={(event) => { const files = Array.from(event.target.files ?? []); setAttachments((current) => [...current, ...files]); setFeedback(`${files.length} file${files.length === 1 ? "" : "s"} attached.`); event.target.value = ""; inputRef.current?.focus(); }} />
      {/* composer is the anchor — menus grow up from its top edge */}
      <div ref={composerAnchorRef} className="relative">
      {/* ── @ / slash menu ─────────────────────────────── */}
      {menu && (
        <div
          id={sourceMenuId}
          role="listbox" aria-label="Sources and commands"
          onMouseLeave={() => setEngaged(false)}
          className="absolute inset-x-0 bottom-full z-10 mb-2 max-h-[min(320px,60dvh)] overflow-y-auto rounded-[10px] bg-[var(--mova-ai-surface,#fff)] p-1 shadow-[var(--mova-ai-shadow-raised,none)]"
          style={{ animation: "mova-prompt-pop 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom center" }}
        >
          {/* single gliding highlight — appears once a row is hovered */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-[var(--mova-ai-hover,#f1f1f1)]"
            style={{
              top: rowBox?.top ?? 0,
              height: rowBox?.height ?? 0,
              opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {rows.map((row, i) => {
            const source = menu === "at" ? SOURCES.find((s) => s.key === row.key) : undefined;
            return (
              <button
                key={row.key}
                id={`${sourceMenuId}-${i}`} role="option" aria-selected={i === active}
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  setActive(i);
                  setEngaged(true);
                }}
                onFocus={() => { setActive(i); setEngaged(true); }}
                onClick={() => pick(row)}
                className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
              >
                {source && (
                  <span className="flex size-5.5 shrink-0 items-center justify-center text-[var(--mova-ai-ink-secondary,#666)]">
                    {source.brand ? BRANDS[source.brand] : <Icon size={15}>{GLYPHS[source.glyph ?? "clip"]}</Icon>}
                  </span>
                )}
                <span className="shrink-0 text-[12.5px] font-medium text-[var(--mova-ai-ink,#202020)]">
                  {row.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--mova-ai-ink-muted,#858585)]">{row.desc}</span>
                {source?.connect && (
                  <span
                    className={`shrink-0 text-[12px] font-medium transition-colors duration-100 ${
                      connected ? "text-[var(--mova-ai-success,#28734d)]" : "text-[var(--mova-ai-accent-ink,#333)] hover:underline"
                    }`}
                  >
                    {connected ? "Connected" : "Connect"}
                  </span>
                )}
              </button>
            );
          })}
          {rows.length === 0 && (
            <div className="flex h-9 items-center px-2 text-[12px] text-[var(--mova-ai-ink-muted,#858585)]">
              No matches for “{query}”
            </div>
          )}
          <div className="mt-1 border-t border-[var(--mova-ai-border,#dedede)] px-2 pt-1.5 pb-1 text-[11px] text-[var(--mova-ai-ink-muted,#858585)]">
            {menu === "at" ? "Type to search sources & files" : "Type to search commands"}
          </div>
        </div>
      )}

      {/* ── model menu ─────────────────────────────────── */}
      {modelOpen && (
        <div
          ref={modelMenuRef}
          id={modelMenuId}
          role="group" aria-label="Available models"
          onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const current = modelRowRefs.current.indexOf(document.activeElement as HTMLButtonElement); modelRowRefs.current[(current + (event.key === "ArrowDown" ? 1 : MODELS.length - 1)) % MODELS.length]?.focus(); } }}
          onMouseLeave={() => setModelHovered(null)}
          className="absolute z-10 w-52 max-w-full rounded-[10px] bg-[var(--mova-ai-surface,#fff)] p-1 shadow-[var(--mova-ai-shadow-raised,none)]"
          style={{ left: modelMenuLeft, bottom: modelMenuBottom, animation: "mova-prompt-pop 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom left" }}
        >
          {/* single gliding highlight — floats to the hovered / selected row */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-[var(--mova-ai-hover,#f1f1f1)]"
            style={{
              top: modelBox?.top ?? 0,
              height: modelBox?.height ?? 0,
              opacity: modelBox && modelHovered !== null ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {MODELS.map((m, i) => (
            <button
              key={m.key}
              type="button"
              ref={(el) => {
                modelRowRefs.current[i] = el;
              }}
              onMouseDown={(event) => event.preventDefault()}
              onFocus={() => setModelHovered(i)}
              onMouseEnter={() => setModelHovered(i)}
              onClick={() => {
                selectModel(m);
                inputRef.current?.focus();
              }}
              className="relative z-10 flex h-7.5 w-full items-center gap-2 rounded-[6px] px-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--mova-ai-ink,#202020)]">{m.name}</span>
              <span className="shrink-0 text-[11px] text-[var(--mova-ai-ink-muted,#858585)]">{m.tag}</span>
              <span className={`shrink-0 text-[var(--mova-ai-ink,#202020)] ${m.key === model.key ? "" : "invisible"}`}>
                <Icon size={13} strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></Icon>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── composer ───────────────────────────────────── */}
      <div
        className={`prompt-composer relative isolate flex flex-col overflow-hidden border border-[var(--mova-ai-border,#dedede)] bg-[var(--mova-ai-surface,#fff)] shadow-[var(--mova-ai-shadow-card,none)] transition-[border-color,border-radius] duration-150 focus-within:border-[var(--mova-ai-border-strong,#c8c8c8)] ${
          tall ? "gap-2.5 p-3.5" : "gap-1.5 p-1.5"
        } ${
          pill ? (attachments.length > 0 || wide ? "rounded-[24px]" : "rounded-full") : tall ? "rounded-[22px]" : "rounded-[14px]"
        }`}
      >
        {/* rainbow glimm sweep — plays across the interior on model change.
            explicit w/h: a <canvas> is a replaced element and won't stretch
            to inset-0 alone, which feeds back into the shader's ResizeObserver. */}
        <canvas
          ref={glimmRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
          style={{ borderRadius: "inherit" }}
        />
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
        >
          {draft}
        </span>

        {attachments.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 pt-0.5 ${pill ? "px-1" : "px-0.5"}`}>
            {attachments.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                className={`flex h-6.5 items-center gap-1.5 bg-[var(--mova-ai-field,#f6f6f6)] py-1 pr-1 pl-1.5 text-[11.5px] text-[var(--mova-ai-ink-secondary,#666)] shadow-[var(--mova-ai-shadow-hairline,none)] ${
                  pill ? "rounded-full" : "rounded-[6px]"
                }`}
                style={{ animation: "mova-prompt-pop 200ms cubic-bezier(0.23,1,0.32,1) both" }}
              >
                <Icon size={12}><g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></g></Icon>
                <span className="max-w-36 truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setAttachments((current) => current.filter((_, j) => j !== i))}
                  className={`-my-1 flex size-6 items-center justify-center text-[var(--mova-ai-ink-muted,#858585)] transition-colors duration-100 hover:bg-[color-mix(in_srgb,var(--mova-ai-border,#dedede)_70%,transparent)] hover:text-[var(--mova-ai-ink,#202020)] ${
                    pill ? "rounded-full" : "rounded-[5px]"
                  }`}
                >
                  <Icon size={10} strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></Icon>
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          ref={controlsRef}
          className={`grid items-end gap-x-1 gap-y-1.5 ${
            wide
              ? "grid-cols-[28px_auto_minmax(0,1fr)_28px_28px]"
              : "grid-cols-[28px_minmax(0,1fr)_auto_28px_28px]"
          }`}
        >
          <button
            type="button"
            aria-label="Add attachments and sources"
            aria-expanded={plusOpen}
            onClick={() => {
              setModelOpen(false);
              setPlusOpen((current) => !current);
              inputRef.current?.focus();
            }}
            className={`flex size-7 shrink-0 items-center justify-center justify-self-start text-[var(--mova-ai-ink-muted,#858585)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--mova-ai-hover,#f1f1f1)] hover:text-[var(--mova-ai-ink,#202020)] active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${plusOpen ? "bg-[var(--mova-ai-hover,#f1f1f1)] text-[var(--mova-ai-ink,#202020)]" : ""} ${wide ? "col-start-1 row-start-2" : "col-start-1 row-start-1"}`}
          >
            <Icon size={16} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Icon>
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setDismissed(false);
              setPlusOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (menu && rows.length > 0) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setEngaged(true);
                  setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
                  return;
                }
                if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
                  event.preventDefault();
                  pick(rows[active]);
                  return;
                }
              }
              if (event.key === "Escape") {
                setDismissed(true);
                closeMenus();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={listening ? "Listening…" : placeholder ?? "Write a message…"}
            aria-label="Prompt"
            aria-expanded={!!menu}
            aria-controls={menu ? sourceMenuId : undefined}
            aria-activedescendant={menu && rows[active] ? `${sourceMenuId}-${active}` : undefined}
            className={`${tall ? "min-h-[68px] px-2 py-2 text-[14px] leading-5" : "min-h-7 px-1 py-[5px] text-[13px] leading-[18px]"} min-w-0 w-full resize-none bg-transparent text-[var(--mova-ai-ink,#202020)] outline-none [overflow-wrap:anywhere] placeholder:text-[var(--mova-ai-ink-muted,#858585)] ${
              wide ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1"
            }`}
          />

          {/* model picker */}
          <button
            ref={modelRef}
            type="button"
            aria-expanded={modelOpen}
            aria-label="Choose model"
            aria-controls={modelMenuId}
            onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setPlusOpen(false); setDismissed(true); setModelOpen(true); requestAnimationFrame(() => modelRowRefs.current[modelIndex]?.focus()); } }}
            onClick={() => {
              setPlusOpen(false);
              setDismissed(true);
              setModelOpen((current) => !current);
            }}
            className={`flex h-7 shrink-0 items-center gap-1 px-1.5 text-[12px] font-medium text-[var(--mova-ai-ink-secondary,#666)] transition-colors duration-150 hover:bg-[var(--mova-ai-hover,#f1f1f1)] hover:text-[var(--mova-ai-ink,#202020)] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${wide ? "col-start-2 row-start-2 justify-self-start" : "col-start-3 row-start-1"}`}
          >
            {model.name}
            <span className="text-[var(--mova-ai-ink-muted,#858585)]">
              <Icon size={11} strokeWidth={2.4}><path d="M6 9l6 6 6-6" /></Icon>
            </span>
          </button>

          {/* dictation */}
          <button
            type="button"
            aria-label={listening ? "Stop dictation" : "Start dictation"}
            aria-pressed={listening}
            onClick={toggleDictation}
            className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${listening ? "bg-[var(--mova-ai-accent-tint,#eee)] text-[var(--mova-ai-accent-ink,#333)]" : "text-[var(--mova-ai-ink-muted,#858585)] hover:bg-[var(--mova-ai-hover,#f1f1f1)] hover:text-[var(--mova-ai-ink,#202020)]"} ${wide ? "col-start-4 row-start-2" : "col-start-4 row-start-1"}`}
          >
            {listening ? (
              <span className="flex h-3.5 items-center gap-[2.5px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] rounded-full bg-current"
                    style={{ height: "100%", animation: `mova-prompt-eq 900ms ease-in-out ${i * 150}ms infinite` }}
                  />
                ))}
              </span>
            ) : (
              <Icon size={15} strokeWidth={2}><g><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></g></Icon>
            )}
          </button>

          {/* send — tactile square (round in the pill variant) */}
          <button
            type="button"
            aria-label="Send"
            disabled={!canSend}
            onClick={send}
            className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${wide ? "col-start-5 row-start-2" : "col-start-5 row-start-1"}`}
            style={{
              background: canSend ? "var(--mova-ai-ink,#202020)" : "var(--mova-ai-border-strong,#c8c8c8)",
              color: canSend ? "var(--mova-ai-surface,#fff)" : "var(--mova-ai-ink-secondary,#666)",
            }}
          >
            <Icon size={16} strokeWidth={2.4}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>
          </button>
        </div>
      </div>
      </div>
      <p role="status" className="mt-2 min-h-4 break-words text-[11px] text-[var(--mova-ai-ink-muted,#858585)]">{feedback}</p>
    </div>
  );
}

export default AIPromptBar;
