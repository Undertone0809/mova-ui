"use client";

/** Voice is the original local preview; no microphone permission is requested.
 */
import * as React from "react";
import { VoiceBeam } from "voice-glow";
import { ArrowUp, Image as ImageIcon } from "lucide-react";

export interface VoiceAssistantChat { id: string; title: string; preview: string; time?: string }
export interface VoiceAssistantCardProps {
  name?: string;
  chats?: VoiceAssistantChat[];
  simulatedTranscript?: string;
  onSend?: (message: string, image?: File) => void | Promise<void>;
  onChatChange?: (chat: VoiceAssistantChat) => void;
  theme?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
}
const recentChats: VoiceAssistantChat[] = [
  { id: "cafe", title: "Quiet café nearby", preview: "Found 3 spots with good wifi", time: "Now" },
  { id: "trip", title: "Weekend in Lisbon", preview: "Day trips from the city", time: "Yesterday" },
  { id: "dinner", title: "Dinner for four", preview: "Pasta, salad and a cake", time: "Mon" },
  { id: "playlist", title: "Morning run playlist", preview: "45 minutes of upbeat songs", time: "Sun" },
];
type Phase = "idle" | "listening" | "thinking" | "error";
function numeric(element: HTMLElement | null, name: string, fallback: number) {
  const value = element ? parseFloat(getComputedStyle(element).getPropertyValue(name)) : NaN;
  return Number.isFinite(value) ? value : fallback;
}
function bezier(value: string) {
  const match = value.replace(/\s+/g, "").match(/cubic-bezier\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/);
  if (!match) return (t: number) => t;
  const [x1, y1, x2, y2] = match.slice(1).map(Number);
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return (t: number) => {
    if (t <= 0 || t >= 1) return Math.min(1, Math.max(0, t));
    let s = t;
    for (let i = 0; i < 8; i++) {
      const delta = ((ax * s + bx) * s + cx) * s - t;
      const derivative = (3 * ax * s + 2 * bx) * s + cx;
      if (Math.abs(delta) < 1e-6 || derivative === 0) break;
      s -= delta / derivative;
    }
    return ((ay * s + by) * s + cy) * s;
  };
}
function SwapText({ value }: { value: string }) {
  const [shown, setShown] = React.useState(value);
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === shown || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.remove("is-exit", "is-enter-start");
      setShown(value);
      return;
    }
    el.classList.remove("is-enter-start");
    el.classList.add("is-exit");
    const timer = window.setTimeout(() => setShown(value), numeric(el, "--text-swap-dur", 150));
    return () => window.clearTimeout(timer);
  }, [value, shown]);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el?.classList.contains("is-exit")) return;
    el.classList.remove("is-exit");
    el.classList.add("is-enter-start");
    void el.offsetHeight;
    el.classList.remove("is-enter-start");
  }, [shown]);
  return <span ref={ref} className="mvc-t-text-swap">{shown}</span>;
}
function useImageUrl(file?: File) {
  const [url, setUrl] = React.useState("");
  React.useEffect(() => {
    if (!file) { setUrl(""); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function VoiceAssistantCard({ name = "Aria", chats = recentChats, simulatedTranscript = "Find me a quiet café nearby with good wifi for this afternoon", onSend, onChatChange, theme = "light", className = "", style }: VoiceAssistantCardProps = {}) {
  const [page, setPage] = React.useState<1 | 2>(2);
  const [chatId, setChatId] = React.useState<string | undefined>(chats[0]?.id);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [words, setWords] = React.useState<string[]>([]);
  const [count, setCount] = React.useState(0);
  const [runKey, setRunKey] = React.useState(0);
  const [text, setText] = React.useState("");
  const [attachment, setAttachment] = React.useState<File>();
  const [attached, setAttached] = React.useState(false);
  const [sentImage, setSentImage] = React.useState<File>();
  const [clearing, setClearing] = React.useState(false);
  const [clearText, setClearText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const speaking = React.useRef(false);
  const generation = React.useRef(0);
  const sending = React.useRef(false);
  const timers = React.useRef<number[]>([]);
  const raf = React.useRef(0);
  const cardRef = React.useRef<HTMLElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mirrorRef = React.useRef<HTMLDivElement>(null);
  const placeholderRef = React.useRef<HTMLDivElement>(null);
  const glowRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLButtonElement>(null);
  const focusChat = React.useRef(false);
  const listRef = React.useRef<HTMLElement>(null);
  const chatRef = React.useRef<HTMLElement>(null);
  const thumb = useImageUrl(attachment);
  const sentUrl = useImageUrl(sentImage);
  const chat = chats.find(item => item.id === chatId) ?? chats[0];
  const live = phase === "listening";
  const hasContent = Boolean(text.trim() || attached);
  const caption = { idle: "Type, or tap the lines to speak", listening: "Listening…", thinking: "One moment", error: "Could not send. Please try again." }[phase];

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReducedMotion(query.matches);
    read(); query.addEventListener("change", read);
    return () => { query.removeEventListener("change", read); timers.current.forEach(window.clearTimeout); cancelAnimationFrame(raf.current); generation.current++; };
  }, []);
  React.useEffect(() => {
    listRef.current?.toggleAttribute("inert", page !== 1);
    chatRef.current?.toggleAttribute("inert", page !== 2);
    if (page === 2 && focusChat.current) { inputRef.current?.focus(); focusChat.current = false; }
  }, [page]);
  function clearTimers() { timers.current.forEach(window.clearTimeout); timers.current = []; }
  function later(callback: () => void, duration: number) { timers.current.push(window.setTimeout(callback, Math.max(0, duration))); }
  function think() { speaking.current = false; setPhase("thinking"); later(() => setPhase("idle"), 1800); }
  function start() {
    clearTimers();
    generation.current++;
    const transcript = simulatedTranscript.split(/\s+/).filter(Boolean);
    setWords(transcript); setSentImage(undefined); setCount(0); setRunKey(key => key + 1);
    speaking.current = true; setPhase("listening");
    transcript.forEach((_, index) => later(() => setCount(index + 1), 400 + index * 280));
    later(think, 400 + transcript.length * 280 + 500);
  }
  function buildGlow(value: string) {
    const wrap = wrapRef.current, input = inputRef.current;
    const context = document.createElement("canvas").getContext("2d");
    if (!context || !wrap || !input) return "";
    context.font = getComputedStyle(input).font;
    const rgb = theme === "dark" ? "255,255,255" : "0,0,0";
    const width = wrap.clientWidth || 200;
    const padding = parseFloat(getComputedStyle(input).paddingLeft) || 4;
    const spread = numeric(cardRef.current, "--glow-spread", 1.5);
    const layers: string[] = [];
    let x = 0;
    value.split(/(\s+)/).forEach(segment => {
      const segmentWidth = context.measureText(segment).width;
      if (segment.trim()) {
        const center = padding + x + segmentWidth / 2;
        const halfWidth = Math.max(segmentWidth * 0.45, 8) * spread;
        [[0, .8, 7, .22], [halfWidth * .45, .55, 8, .18], [-halfWidth * .4, .65, 6, .16], [halfWidth * .15, .9, 5, .14]].forEach(([dx, multiplier, height, opacity]) => {
          layers.push(`radial-gradient(ellipse ${Math.max(halfWidth * multiplier, 2).toFixed(1)}px ${height}px at ${(((center + dx) / width) * 100).toFixed(2)}% 100%, rgba(${rgb},${opacity}), transparent)`);
        });
      }
      x += segmentWidth;
    });
    return layers.join(", ");
  }
  function stopDissolve() {
    cancelAnimationFrame(raf.current);
    [mirrorRef, placeholderRef, glowRef].forEach(ref => { if (ref.current) ref.current.style.cssText = ""; });
    setClearing(false); setClearText("");
  }
  function dissolve(old: string) {
    stopDissolve();
    const mirror = mirrorRef.current, placeholder = placeholderRef.current, glow = glowRef.current;
    setText("");
    if (!mirror || !placeholder || !glow || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const token = (name: string, fallback: number) => numeric(cardRef.current, name, fallback);
    const total = token("--clear-dur", 1000), outDuration = Math.max(1, token("--clear-out-dur", 400)), inDuration = Math.max(1, token("--clear-in-dur", 400));
    const outFly = token("--clear-out-fly", 12), inFly = token("--clear-in-fly", 12), blur = token("--clear-blur", 2);
    const delay = token("--glow-delay", 50), peakAt = Math.min(.999, Math.max(.001, token("--glow-peak-at", .15))), opacity = token("--glow-opacity", .42);
    const computed = getComputedStyle(cardRef.current!);
    const easeOut = bezier(computed.getPropertyValue("--clear-out-ease")), easeIn = bezier(computed.getPropertyValue("--clear-in-ease"));
    setClearText(old); setClearing(true);
    glow.style.background = buildGlow(old); glow.style.opacity = "0";
    placeholder.style.transform = `translateY(-${inFly}px)`; placeholder.style.opacity = ".9"; placeholder.style.filter = `blur(${blur}px)`;
    const started = performance.now();
    const tick = (now: number) => {
      const elapsed = now - started, out = easeOut(Math.min(1, elapsed / outDuration)), incoming = easeIn(Math.min(1, elapsed / inDuration));
      mirror.style.transform = `translateY(${(out * outFly).toFixed(1)}px)`; mirror.style.opacity = (1 - out).toFixed(3); mirror.style.filter = `blur(${(out * blur).toFixed(1)}px)`;
      placeholder.style.transform = `translateY(${(-inFly + incoming * inFly).toFixed(1)}px)`; placeholder.style.opacity = (.9 + incoming * .1).toFixed(3); placeholder.style.filter = `blur(${(blur - incoming * blur).toFixed(1)}px)`;
      let glowStrength = 0;
      if (elapsed > delay) { const progress = Math.min(1, (elapsed - delay) / Math.max(1, total - delay)); glowStrength = progress < peakAt ? progress / peakAt : 1 - (progress - peakAt) / (1 - peakAt); }
      glow.style.opacity = (glowStrength * opacity).toFixed(3);
      if (elapsed < total) raf.current = requestAnimationFrame(tick); else stopDissolve();
    };
    raf.current = requestAnimationFrame(tick);
  }
  function send() {
    const message = text.trim(), image = attached ? attachment : undefined;
    if ((!message && !image) || sending.current || live) return;
    clearTimers();
    const run = ++generation.current;
    const nextWords = message ? message.split(/\s+/) : [];
    setWords(nextWords); setSentImage(image); setCount(0); setRunKey(key => key + 1);
    if (message) dissolve(text);
    setAttached(false); speaking.current = false;
    const gap = numeric(cardRef.current, "--stream-gap", 60), steps = Math.max(nextWords.length, 1);
    for (let index = 0; index < steps; index++) later(() => setCount(index + 1), 80 + index * gap);
    later(think, 80 + steps * gap + 400);
    if (!onSend) return;
    sending.current = true; setPending(true);
    Promise.resolve().then(() => onSend(message, image)).catch(() => {
      if (run !== generation.current) return;
      clearTimers(); stopDissolve(); setText(message); setAttachment(image); setAttached(Boolean(image)); setPhase("error");
    }).finally(() => { if (run === generation.current) { sending.current = false; setPending(false); } });
  }
  function onRight() {
    if (live) { clearTimers(); setCount(words.length); think(); }
    else if (hasContent) send();
    else start();
  }
  function openChat(item: VoiceAssistantChat) {
    if (item.id !== chatId) {
      clearTimers(); stopDissolve(); generation.current++; sending.current = false; setPending(false);
      speaking.current = false; setPhase("idle"); setWords([]); setSentImage(undefined); setCount(0); setRunKey(key => key + 1); setChatId(item.id);
      onChatChange?.(item);
    }
    focusChat.current = true; setPage(2);
  }
  function keepFocus(event: React.MouseEvent | React.PointerEvent) { if (document.activeElement === inputRef.current) event.preventDefault(); }
  function togglePage() { setPage(current => current === 2 ? 1 : 2); }
  const iconState = live ? "a" : hasContent ? "b" : "a";
  return <section ref={cardRef} className={`mova-voice ${className}`} data-theme={theme} data-phase={phase} style={style} aria-label={`${name} voice assistant`}>
    <style>{css}</style>
    <VoiceBeam className="mvc-beam" level={() => {
      if (!speaking.current || reducedMotion) return .06;
      const time = Date.now();
      return Math.max(.06, Math.min(1, .55 + Math.sin(time / 150) * .22 + Math.sin(time / 61) * .12 + Math.sin(time / 37) * .08)) * .6;
    }} processing={phase === "thinking" || pending} paused={reducedMotion} {...(theme === "dark" ? { theme: "dark" as const } : {})}>
      <div className="mvc-inner"><div className="mvc-content">
        <header className="mvc-top">
          <button ref={menuRef} type="button" className={`mvc-menu${page === 1 ? " is-open" : ""}`} aria-label={page === 1 ? "Close conversations" : "Open conversations"} aria-expanded={page === 1} onClick={togglePage}>
            <svg className="mvc-menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><line className="mvc-l1" x1="2.5" y1="4" x2="13.5" y2="4" /><line className="mvc-l2" x1="2.5" y1="8" x2="13.5" y2="8" /><line className="mvc-l3" x1="2.5" y1="12" x2="13.5" y2="12" /></svg>
          </button>
          <div className="mvc-top-text"><span className="mvc-name"><SwapText value={page === 1 ? "Chats" : name} /></span><span className="mvc-meta"><SwapText value={page === 1 ? `${chats.length} conversations` : chat?.title ?? "New conversation"} /></span></div>
        </header>
        <div className="mvc-divider" aria-hidden="true" />
        <div className="mvc-t-page-slide" data-page={page}>
          <section className="mvc-t-page mvc-page" data-page-id="1" ref={listRef} aria-label="Your conversations" aria-hidden={page !== 1} inert={page !== 1} onKeyDown={event => { if (event.key === "Escape") { setPage(2); menuRef.current?.focus(); } }}>
            <ul className="mvc-list">{chats.map(item => <li key={item.id}><button type="button" className="mvc-row" onClick={() => openChat(item)}><span className="mvc-row-text"><span className="mvc-row-title">{item.title}</span><span className="mvc-row-preview">{item.preview}</span></span><span className="mvc-row-time">{item.time}</span></button></li>)}</ul>
          </section>
          <section className="mvc-t-page mvc-page" data-page-id="2" ref={chatRef} aria-label={`Chat with ${name}`} aria-hidden={page !== 2} inert={page !== 2}>
            <div className="mvc-body"><div className="mvc-bubble-row"><p className="mvc-bubble"><span>How can I help you today?</span></p></div>
              <div key={runKey} className="mvc-transcript" aria-live="polite" aria-atomic="true">
                <span className="mvc-sr-only">{words.slice(0, count).join(" ")}</span>
                {sentUrl && <img className={`mvc-sent-img mvc-t-stream-w${count > 0 ? " is-in" : ""}`} src={sentUrl} alt="Image you sent" width={40} height={40} />}
                {words.length > 0 && <p aria-hidden="true"><span>{words.map((word, index) => <React.Fragment key={index}><span className={`mvc-t-stream-w${index < count ? " is-in" : ""}`}>{word}</span>{index < words.length - 1 ? " " : ""}</React.Fragment>)}</span></p>}
              </div>
            </div>
            <div className="mvc-bottom"><span className="mvc-caption" role="status"><SwapText value={caption} /></span>
              <form className="mvc-field" onSubmit={event => { event.preventDefault(); send(); }}>
                <button type="button" className="mvc-attach mvc-t-icon-swap" data-state={attached ? "b" : "a"} aria-label={attached ? "Remove image" : "Attach image"} disabled={pending} onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={() => attached ? setAttached(false) : fileRef.current?.click()}>
                  <span className="mvc-t-icon" data-icon="a"><ImageIcon size={16} strokeWidth={2.25} aria-hidden="true" /></span>
                  <span className="mvc-t-icon" data-icon="b">{thumb && <img className="mvc-thumb" src={thumb} alt="" width={28} height={28} />}</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file?.type.startsWith("image/") && file.size <= 10 * 1024 * 1024) { setAttachment(file); setAttached(true); } }} />
                <div ref={wrapRef} className={`mvc-t-clear mvc-input-wrap${text && !clearing ? " has-value" : ""}${clearing ? " is-clearing" : ""}`}>
                  <input ref={inputRef} className="mvc-input" type="text" value={text} aria-label={`Message ${name}`} disabled={pending} maxLength={2000} onChange={event => { if (clearing) stopDissolve(); setText(event.target.value); }} />
                  <div className="mvc-t-clear-mirror" ref={mirrorRef} aria-hidden="true">{(clearing ? clearText : text).replace(/ /g, "\u00a0")}</div>
                  <div className="mvc-t-clear-placeholder" ref={placeholderRef} aria-hidden="true">Ask {name} anything</div>
                  <div className="mvc-t-clear-glow" ref={glowRef} aria-hidden="true" />
                </div>
                <button type="button" className={`mvc-mic mvc-t-icon-swap${live ? " is-live" : ""}`} data-state={iconState} aria-label={live ? "Stop voice preview" : hasContent ? "Send message" : "Start voice preview"} aria-pressed={live} disabled={pending} onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={onRight}>
                  <span className="mvc-t-icon" data-icon="a"><span className="mvc-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span></span>
                  <span className="mvc-t-icon" data-icon="b"><ArrowUp size={16} strokeWidth={2.25} aria-hidden="true" /></span>
                </button>
              </form>
            </div>
          </section>
        </div>
      </div></div>
    </VoiceBeam>
  </section>;
}

const css = `
/* @motion
[Page slide] chat and chats screens
--page-slide-dur: Duration
--page-slide-ease: Easing
--page-slide-distance: Distance
more --page-fade-dur: Fade duration
more --page-fade-ease: Fade easing
more --page-blur: Blur
more --page-stagger: Delay
more --page-exit-enabled: Exit slide
[Streaming transcript] your message under Aria's
--stream-fade: Duration
--stream-ease: Easing
--stream-gap: Word gap
more --stream-blur: Blur
[Send dissolve] prompt text on send
--clear-dur: Duration
--clear-out-ease: Easing
--clear-out-fly: Distance
more --clear-out-dur: Text out duration
more --clear-in-dur: Placeholder in duration
more --clear-in-fly: Placeholder distance
more --clear-in-ease: Placeholder easing
more --clear-blur: Blur
more --glow-delay: Glow delay
more --glow-peak-at: Glow peak
more --glow-opacity: Glow opacity
more --glow-spread: Glow spread
more [Status swap] caption and header titles
--text-swap-dur: Duration
--text-swap-ease: Easing
--text-swap-translate-y: Distance
more --text-swap-blur: Blur
more [Icon swap] voice / send and image buttons
--icon-swap-dur: Duration
--icon-swap-ease: Easing
--icon-swap-start-scale: Start scale
more --icon-swap-blur: Blur
more [Menu morph] menu lines into a close X
--duration-fast: Duration
more [Voice lines] bars in the voice button
--wave-dur: Duration
--wave-min: Rest scale
more [Bubble float] assistant message
--float-dur: Duration
--float-distance: Distance
more [Field focus] prompt ring, row hover
--duration-quick: Duration
more [Button press] all buttons and rows
--press-scale: Scale
--press-dur: Duration
--ease-smooth-out: Easing
*/
.mova-voice {
  --page-slide-dur: 250ms;
  --page-fade-dur: 250ms;
  --page-slide-distance: 8px;
  --page-blur: 3px;
  --page-stagger: 0ms;
  --page-exit-enabled: 1;
  --page-slide-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --page-fade-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --stream-gap: 60ms;
  --stream-fade: 350ms;
  --stream-blur: 1px;
  --stream-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --clear-dur: 1000ms;
  --clear-out-dur: 400ms;
  --clear-in-dur: 400ms;
  --clear-out-fly: 12px;
  --clear-in-fly: 12px;
  --clear-out-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --clear-in-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --clear-blur: 2px;
  --glow-delay: 50ms;
  --glow-peak-at: 0.15;
  --glow-opacity: 0.42;
  --glow-spread: 1.5;
  --text-swap-dur: 150ms;
  --text-swap-translate-y: 4px;
  --text-swap-blur: 2px;
  --text-swap-ease: ease-in-out;
  --icon-swap-dur: 250ms;
  --icon-swap-blur: 2px;
  --icon-swap-start-scale: 0.25;
  --icon-swap-ease: ease-in-out;
  --duration-fast: 250ms;
  --duration-quick: 150ms;
  --wave-dur: 900ms;
  --wave-min: 0.35;
  --float-dur: 4000ms;
  --float-distance: 3px;
  --press-scale: 0.99;
  --press-dur: 150ms;
  --ease-smooth-out: cubic-bezier(0.22, 1, 0.36, 1);
  --mvc-btn-bg: var(--mvc-surface);
  --mvc-btn-shadow: 0 1px 3px 0 rgba(0,0,0,.04), inset 0 0 0 1px rgba(0,0,0,.08), inset 0 -1px 0 0 rgba(0,0,0,.08);
  --mvc-hover: rgba(0, 0, 0, 0.02);
  --mvc-chip: rgba(0, 0, 0, 0.04);
  --mvc-focus-soft: rgba(0, 115, 229, 0.06);
  --mvc-img-outline: rgba(0, 0, 0, 0.1);
  --mvc-card-shadow: 0 0 0 1px rgba(0,0,0,.04), 0 8px 32px -4px rgba(0,0,0,.06), 0 1px 3px 0 rgba(0,0,0,.04);
  --divider: color-mix(in srgb, var(--mvc-border) 49%, transparent);
  --bubble: color-mix(in srgb, var(--mvc-fg) 6%, var(--mvc-surface));
}
.mova-voice[data-theme="dark"] {
  --mvc-btn-bg: rgba(255, 255, 255, 0.04);
  --mvc-btn-shadow: 0 1px 1px 0 rgba(0,0,0,.24), inset 0 0 0 1px rgba(255,255,255,.04), inset 0 1px 0 0 rgba(255,255,255,.06);
  --mvc-hover: rgba(255, 255, 255, 0.02);
  --mvc-chip: rgba(255, 255, 255, 0.07);
  --mvc-focus-soft: rgba(0, 115, 229, 0.16);
  --mvc-img-outline: rgba(255, 255, 255, 0.1);
  --glow-opacity: 0.85;
  --bubble: color-mix(in srgb, var(--mvc-fg) 9%, var(--mvc-surface));
}

.mova-voice {
  display: grid;
  width: 360px;
  max-width: 100%;
  height: 340px;
  border-radius: 24px;
  background: var(--mvc-surface);
  box-shadow: var(--mvc-card-shadow);
  color: var(--mvc-fg);
  -webkit-font-smoothing: antialiased;
}
.mvc-beam { margin: -1px; border-radius: 25px; }
.mvc-inner { position: relative; height: 100%; border-radius: 25px; background: transparent; overflow: hidden; }
.mvc-content { position: relative; z-index: 5; height: 100%; display: flex; flex-direction: column; }
:where(.mova-voice) :is(button, input) { font: inherit; padding: 0; border: 0; background: none; color: inherit; }
:where(.mova-voice) button { cursor: pointer; }
.mova-voice :focus-visible:not(input) { outline: none; box-shadow: 0 0 0 2px var(--mvc-surface), 0 0 0 4px var(--mvc-accent); }

.mvc-top { display: flex; align-items: center; gap: 8px; padding: 12px 16px 12px 12px; flex: none; }
.mvc-top-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mvc-name { font-size: 16px; line-height: 22px; font-weight: 500; }
.mvc-meta { font-size: 12px; line-height: 16px; color: var(--mvc-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mvc-divider { height: 1px; flex: none; background: linear-gradient(90deg, transparent, var(--divider) 20%, var(--divider) 80%, transparent); }

.mvc-menu {
  --press-scale: 0.95;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--mvc-fg);
  transition: transform var(--press-dur) var(--ease-smooth-out), background-color var(--duration-quick) var(--ease-smooth-out);
}
@media (hover: hover) and (pointer: fine) { .mvc-menu:hover { background-color: var(--mvc-chip); } }
.mvc-menu:is(:active,.is-pressed) { transform: scale(var(--press-scale)); }
.mvc-menu-icon line {
  transform-box: view-box;
  transform-origin: 8px 8px;
  transition: transform var(--duration-fast) var(--ease-smooth-out), opacity var(--duration-fast) var(--ease-smooth-out);
}
.mvc-menu.is-open .mvc-l1 { transform: rotate(45deg) translateY(4px); }
.mvc-menu.is-open .mvc-l2 { opacity: 0; }
.mvc-menu.is-open .mvc-l3 { transform: rotate(-45deg) translateY(-4px); }

.mvc-t-page-slide { position: relative; flex: 1; min-height: 0; }
.mvc-t-page-slide .mvc-t-page[data-page-id="1"] { --t-page-from-x: calc(var(--page-slide-distance) * -1); }
.mvc-t-page-slide .mvc-t-page[data-page-id="2"] { --t-page-from-x: var(--page-slide-distance); }
.mvc-t-page-slide .mvc-t-page {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transform: translateX(calc(var(--t-page-from-x, 0px) * var(--page-exit-enabled)));
  filter: blur(calc(var(--page-blur) * var(--page-exit-enabled)));
  transition:
    opacity   var(--page-fade-dur)  var(--page-fade-ease),
    transform var(--page-slide-dur) var(--page-slide-ease),
    filter    var(--page-slide-dur) var(--page-slide-ease);
  will-change: opacity, transform, filter;
}
.mvc-t-page-slide[data-page="1"] .mvc-t-page[data-page-id="1"],
.mvc-t-page-slide[data-page="2"] .mvc-t-page[data-page-id="2"] {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
  filter: blur(0);
  transition-delay: var(--page-stagger);
}
.mvc-page { display: flex; flex-direction: column; }

.mvc-list { list-style: none; margin: 0; padding: 12px; display: flex; flex-direction: column; }
.mvc-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  text-align: left;
  transition: transform var(--press-dur) var(--ease-smooth-out), background-color var(--duration-quick) var(--ease-smooth-out);
}
@media (hover: hover) and (pointer: fine) { .mvc-row:hover { background-color: var(--mvc-hover); } }
.mvc-row:is(:active,.is-pressed) { transform: scale(var(--press-scale)); }
.mvc-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mvc-row-title { font-size: 13px; line-height: 20px; color: var(--mvc-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mvc-row-preview { font-size: 12px; line-height: 16px; color: var(--mvc-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mvc-row-time { flex: none; font-size: 12px; line-height: 16px; color: var(--mvc-muted); }

.mvc-body { flex: 1; min-height: 0; overflow: hidden; padding: 24px 24px 0; display: flex; flex-direction: column; gap: 16px; }
.mvc-bubble-row { padding-left: 8px; animation: mvc-float var(--float-dur) ease-in-out infinite; }
@keyframes mvc-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(calc(var(--float-distance) * -1)); }
}
.mvc-bubble { position: relative; display: inline-block; max-width: 240px; padding: 8px 12px; border-radius: 18px; background: var(--bubble); font-size: 14px; line-height: 20px; margin: 0; }
.mvc-bubble span { position: relative; z-index: 1; }
.mvc-bubble::before { content: ""; position: absolute; bottom: 0; left: -7px; width: 20px; height: 20px; background: var(--bubble); border-bottom-right-radius: 16px 14px; }
.mvc-bubble::after { content: ""; position: absolute; bottom: 0; left: -26px; width: 26px; height: 20px; background: var(--mvc-surface); border-bottom-right-radius: 10px; }

.mvc-transcript { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; padding-left: 32px; }
.mvc-transcript p {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--mvc-fg);
  text-align: right;
  text-wrap: pretty;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
.mvc-sent-img { display: block; width: 40px; height: 40px; border-radius: 10px; object-fit: cover; outline: 1px solid var(--mvc-img-outline); outline-offset: -1px; }
.mvc-t-stream-w {
  opacity: 0;
  filter: blur(var(--stream-blur));
  transition:
    opacity var(--stream-fade) var(--stream-ease),
    filter var(--stream-fade) var(--stream-ease);
}
.mvc-t-stream-w.is-in { opacity: 1; filter: blur(0); }

.mvc-bottom { flex: none; padding: 0 16px 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.mvc-caption { font-size: 12px; line-height: 16px; color: var(--mvc-muted); }

.mvc-t-text-swap {
  display: inline-block;
  transform: translateY(0);
  filter: blur(0);
  opacity: 1;
  transition:
    transform var(--text-swap-dur) var(--text-swap-ease),
    filter    var(--text-swap-dur) var(--text-swap-ease),
    opacity   var(--text-swap-dur) var(--text-swap-ease);
  will-change: transform, filter, opacity;
}
.mvc-t-text-swap.is-exit { transform: translateY(calc(var(--text-swap-translate-y) * -1)); filter: blur(var(--text-swap-blur)); opacity: 0; }
.mvc-t-text-swap.is-enter-start { transform: translateY(var(--text-swap-translate-y)); filter: blur(var(--text-swap-blur)); opacity: 0; transition: none; }

.mvc-t-icon-swap { position: relative; display: inline-grid; }
.mvc-t-icon-swap .mvc-t-icon {
  grid-area: 1 / 1;
  transition:
    opacity   var(--icon-swap-dur) var(--icon-swap-ease),
    filter    var(--icon-swap-dur) var(--icon-swap-ease),
    transform var(--icon-swap-dur) var(--icon-swap-ease);
}
.mvc-t-icon-swap[data-state="a"] .mvc-t-icon[data-icon="a"],
.mvc-t-icon-swap[data-state="b"] .mvc-t-icon[data-icon="b"] { opacity: 1; filter: blur(0); transform: scale(1); }
.mvc-t-icon-swap[data-state="a"] .mvc-t-icon[data-icon="b"],
.mvc-t-icon-swap[data-state="b"] .mvc-t-icon[data-icon="a"] { opacity: 0; filter: blur(var(--icon-swap-blur)); transform: scale(var(--icon-swap-start-scale)); }
.mvc-t-icon { display: grid; place-items: center; }

.mvc-field {
  box-sizing: border-box;
  width: 100%;
  height: 44px;
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 22px;
  background: var(--mvc-surface);
  box-shadow: 0 0 0 1px var(--mvc-border);
  transition: box-shadow var(--duration-quick) var(--ease-smooth-out);
}
.mvc-field:has(.mvc-input:focus) { box-shadow: 0 0 0 1px var(--mvc-accent), 0 0 0 4px var(--mvc-focus-soft); }
.mvc-attach {
  --press-scale: 0.95;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--mvc-muted);
  transition: transform var(--press-dur) var(--ease-smooth-out), background-color var(--duration-quick) var(--ease-smooth-out);
}
@media (hover: hover) and (pointer: fine) { .mvc-attach:hover { background-color: var(--mvc-chip); } }
.mvc-attach:is(:active,.is-pressed) { transform: scale(var(--press-scale)); }
.mvc-thumb { display: block; width: 28px; height: 28px; border-radius: 50%; object-fit: cover; outline: 1px solid var(--mvc-img-outline); outline-offset: -1px; }

.mvc-t-clear { position: relative; overflow: hidden; }
.mvc-input-wrap { flex: 1; min-width: 0; height: 36px; }
.mvc-input { width: 100%; height: 100%; box-sizing: border-box; padding: 0 4px; outline: none; font-size: 13px; line-height: 20px; color: var(--mvc-fg); caret-color: var(--mvc-fg); }
.mvc-t-clear-mirror, .mvc-t-clear-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  z-index: 2;
  padding: 0 4px;
  font-size: 13px;
  line-height: 20px;
}
.mvc-t-clear-mirror { opacity: 0; color: var(--mvc-fg); }
.mvc-t-clear-placeholder { color: var(--mvc-muted); }
.mvc-t-clear.has-value .mvc-t-clear-mirror, .mvc-t-clear.is-clearing .mvc-t-clear-mirror { opacity: 1; }
.mvc-t-clear.has-value > input, .mvc-t-clear.is-clearing > input { -webkit-text-fill-color: transparent; }
.mvc-t-clear.has-value .mvc-t-clear-placeholder { opacity: 0; }
.mvc-t-clear-glow { position: absolute; inset: 0; pointer-events: none; opacity: 0; z-index: 3; mix-blend-mode: multiply; }
.mova-voice[data-theme="dark"] .mvc-t-clear-glow { mix-blend-mode: screen; }

.mvc-mic {
  --press-scale: 0.95;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--mvc-btn-bg);
  box-shadow: var(--mvc-btn-shadow);
  color: var(--mvc-fg);
  transition: transform var(--press-dur) var(--ease-smooth-out);
}
:where(.mova-voice) .mvc-mic { background: var(--mvc-btn-bg); }
@media (hover: hover) and (pointer: fine) { .mvc-mic:hover { background-image: linear-gradient(var(--mvc-hover), var(--mvc-hover)); } }
.mvc-mic:is(:active,.is-pressed) { transform: scale(var(--press-scale)); }
.mova-voice .mvc-mic:focus-visible { box-shadow: var(--mvc-btn-shadow), 0 0 0 2px var(--mvc-surface), 0 0 0 4px var(--mvc-accent); }
.mvc-wave { display: flex; align-items: center; gap: 2px; height: 16px; }
.mvc-wave i { display: block; width: 2px; border-radius: 1px; background: currentColor; transform-origin: center; }
.mvc-wave i:nth-child(1) { height: 4px; }
.mvc-wave i:nth-child(2) { height: 9px; }
.mvc-wave i:nth-child(3) { height: 14px; }
.mvc-wave i:nth-child(4) { height: 9px; }
.mvc-wave i:nth-child(5) { height: 4px; }
.mvc-mic.is-live .mvc-wave i { animation: mvc-wave var(--wave-dur) ease-in-out infinite; }
.mvc-mic.is-live .mvc-wave i:nth-child(2) { animation-delay: calc(var(--wave-dur) * -0.3); }
.mvc-mic.is-live .mvc-wave i:nth-child(3) { animation-delay: calc(var(--wave-dur) * -0.6); }
.mvc-mic.is-live .mvc-wave i:nth-child(4) { animation-delay: calc(var(--wave-dur) * -0.15); }
.mvc-mic.is-live .mvc-wave i:nth-child(5) { animation-delay: calc(var(--wave-dur) * -0.45); }
@keyframes mvc-wave {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(var(--wave-min)); }
}

@media (prefers-reduced-motion: reduce) {
  .mvc-bubble-row, .mvc-mic.is-live .mvc-wave i { animation: none !important; }
  .mvc-t-text-swap, .mvc-t-icon-swap .mvc-t-icon, .mvc-t-page-slide .mvc-t-page, .mvc-menu-icon line { transition: none !important; }
  .mvc-t-stream-w { transition: none !important; filter: none !important; opacity: 1 !important; }
  .mvc-t-clear-glow { opacity: 0 !important; }
  .mvc-mic, .mvc-menu, .mvc-attach, .mvc-row { transition: none; }
  .mvc-mic:is(:active,.is-pressed), .mvc-menu:is(:active,.is-pressed), .mvc-attach:is(:active,.is-pressed), .mvc-row:is(:active,.is-pressed) { transform: none; }
}

.mova-voice { --mvc-bg:#f9f9f9; --mvc-fg:#0d0d0d; --mvc-muted:#6c6c6c; --mvc-border:rgba(0,0,0,.08); --mvc-surface:#fff; --mvc-accent:#17181c; font:400 13px/20px "Inter Variable",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-optical-sizing:auto; font-feature-settings:"liga" 1,"calt" 1; letter-spacing:0; color-scheme:light; }
.mova-voice[data-theme="dark"] { --mvc-bg:#131313; --mvc-fg:#f2f2f2; --mvc-muted:rgba(202,202,202,.7); --mvc-border:rgba(255,255,255,.08); --mvc-surface:#1d1d1d; --mvc-accent:#fff; color-scheme:dark; }
.mova-voice { min-width:0; }
.mova-voice, .mova-voice * { box-sizing:border-box; }
.mova-voice button { -webkit-tap-highlight-color:transparent; touch-action:manipulation; -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
.mova-voice button:disabled { cursor:default; opacity:.5; }
.mova-voice .mvc-list { overflow:auto; }
.mova-voice .mvc-sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
.mova-voice .mvc-transcript p { overflow-wrap:anywhere; }
@media (prefers-reduced-motion:reduce) { .mova-voice *, .mova-voice *::before, .mova-voice *::after { animation:none!important; transition:none!important; } }
`;
