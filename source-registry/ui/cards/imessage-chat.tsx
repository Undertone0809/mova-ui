"use client";

/** Original Mova implementation; visual reference documented in docs/provenance/interactive-cards.md. */
import * as React from "react";
import { ArrowUp, Phone, Video } from "lucide-react";

export interface IMessageChatMessage { id: string; text: string; direction: "incoming" | "outgoing" }
export interface IMessageChatProps {
  name?: string;
  avatar?: string;
  deliveryStatus?: string;
  initialMessages?: IMessageChatMessage[];
  onSend?: (text: string) => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  theme?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
}
const conversation: IMessageChatMessage[] = [
  { id: "1", text: "Are we still on for Saturday?", direction: "incoming" },
  { id: "2", text: "Yes! Trail at 9?", direction: "outgoing" },
  { id: "3", text: "Perfect. I'll bring coffee", direction: "incoming" },
  { id: "4", text: "The good kind this time", direction: "incoming" },
  { id: "5", text: "You're the best", direction: "outgoing" },
];
const defaultAvatar = "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=64&h=64";
const replies = ["Love that", "See you there!", "Haha deal", "Bringing snacks too"];

export function IMessageChat({ name = "Maya Chen", avatar = defaultAvatar, deliveryStatus, initialMessages = conversation, onSend, onAudioCall, onVideoCall, theme = "light", className = "", style }: IMessageChatProps = {}) {
  const [messages, setMessages] = React.useState(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [status, setStatus] = React.useState("Read");
  const [statusPhase, setStatusPhase] = React.useState<"stable" | "exit" | "enter">("stable");
  const [receiptAfter, setReceiptAfter] = React.useState(initialMessages[initialMessages.length - 1]?.id);
  const [newMessages, setNewMessages] = React.useState<Set<string>>(() => new Set());
  const [receiptNew, setReceiptNew] = React.useState(false);
  const [typing, setTyping] = React.useState(false);
  const [tooltip, setTooltip] = React.useState({ text: "", visible: false, width: 0, x: 0 });
  const [pressed, setPressed] = React.useState<string>();
  const thread = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const statusText = React.useRef<HTMLSpanElement>(null);
  const tooltipText = React.useRef<HTMLSpanElement>(null);
  const actions = React.useRef<HTMLSpanElement>(null);
  const tooltipTrigger = React.useRef<HTMLButtonElement | null>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressStarted = React.useRef(0);
  const initiallyScrolled = React.useRef(false);
  const sequence = React.useRef(0);
  const replyIndex = React.useRef(0);
  const instanceId = React.useId();
  const tooltipId = `${instanceId}-tooltip`;

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  function later(callback: () => void, delay: number) {
    timers.current.push(setTimeout(callback, delay));
  }
  React.useEffect(() => () => { clearTimers(); clearTimeout(pressTimer.current); }, []);
  React.useEffect(() => {
    if (!thread.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    thread.current.scrollTo({ top: thread.current.scrollHeight, behavior: !initiallyScrolled.current || reduced ? "auto" : "smooth" });
    initiallyScrolled.current = true;
  }, [messages, typing]);
  React.useLayoutEffect(() => {
    if (statusPhase !== "enter") return;
    // Flush the incoming position before transitioning the new receipt into place.
    void statusText.current?.offsetHeight;
    setStatusPhase("stable");
  }, [statusPhase]);
  React.useLayoutEffect(() => {
    if (!tooltip.visible || !tooltipText.current || !tooltipTrigger.current || !actions.current) return;
    const width = Math.ceil(tooltipText.current.scrollWidth + 24);
    const group = actions.current.getBoundingClientRect();
    const trigger = tooltipTrigger.current.getBoundingClientRect();
    const x = Math.min(trigger.left - group.left + trigger.width / 2 - width / 2, group.width + 6 - width);
    setTooltip(current => current.width === width && current.x === x ? current : { ...current, width, x });
  }, [tooltip.text, tooltip.visible]);

  function showTooltip(event: React.SyntheticEvent<HTMLButtonElement>, text: string) {
    tooltipTrigger.current = event.currentTarget;
    setTooltip(current => ({ ...current, text, visible: true }));
  }
  function hideTooltip() { setTooltip(current => ({ ...current, visible: false })); }
  function press(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") return;
    clearTimeout(pressTimer.current);
    pressStarted.current = performance.now();
    setPressed(event.currentTarget.dataset.press);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function releasePress() {
    pressTimer.current = setTimeout(() => setPressed(undefined), Math.max(0, 150 - (performance.now() - pressStarted.current)));
  }
  function finishAnimation(id: string, event: React.AnimationEvent) {
    if (event.animationName !== "mic-pop") return;
    setNewMessages(current => { const next = new Set(current); next.delete(id); return next; });
  }
  function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    clearTimers();
    const id = `${instanceId}-sent-${++sequence.current}`;
    setTyping(false);
    setMessages(current => [...current, { id, text, direction: "outgoing" }]);
    setNewMessages(current => new Set(current).add(id));
    setReceiptAfter(id);
    setReceiptNew(true);
    setStatus("Delivered");
    setStatusPhase("stable");
    setDraft("");
    later(() => {
      setStatusPhase("exit");
      later(() => { setStatus("Read"); setStatusPhase("enter"); }, 150);
    }, 1200);
    later(() => setTyping(true), 1800);
    later(() => {
      setTyping(false);
      const replyId = `${instanceId}-reply-${++sequence.current}`;
      const reply = replies[replyIndex.current++ % replies.length];
      setMessages(current => [...current, { id: replyId, text: reply, direction: "incoming" }]);
      setNewMessages(current => new Set(current).add(replyId));
    }, 3400);
    onSend?.(text);
  }
  const receipt = <div key="receipt" className={`mic-status${receiptNew ? " mic-new" : ""}`} role="status" onAnimationEnd={event => { if (event.animationName === "mic-pop") setReceiptNew(false); }}><span ref={statusText} className={`mic-text-swap${statusPhase === "exit" ? " mic-exit" : statusPhase === "enter" ? " mic-enter-start" : ""}`}>{deliveryStatus ?? status}</span></div>;
  const contents: React.ReactNode[] = [<div key="timestamp" className="mic-time">Today 9:41 AM</div>];
  messages.forEach(message => {
    contents.push(<div key={message.id} className={`mic-bubble mic-${message.direction}${newMessages.has(message.id) ? " mic-new" : ""}`} onAnimationEnd={event => finishAnimation(message.id, event)}>{message.text}</div>);
    if (message.id === receiptAfter) contents.push(receipt);
  });
  if (!messages.length) contents.push(receipt);
  if (typing) contents.push(<div key="typing" className="mic-bubble mic-incoming mic-typing mic-new" aria-label={`${name.split(" ")[0]} is typing`}><i /><i /><i /></div>);
  return <section className={`mova-imessage ${className}`} data-theme={theme} style={style} aria-label={`Conversation with ${name}`}>
    <style>{css}</style>
    <header><span className="mic-avatar">{avatar ? <img src={avatar} alt={name} width={32} height={32} /> : name.split(" ").map(word => word[0]).slice(0, 2).join("")}</span><div className="mic-person"><strong>{name}</strong><span>iMessage</span></div><span className="mic-actions" ref={actions} onPointerLeave={hideTooltip}>
      <button type="button" className="mic-icon" aria-label="Audio call" aria-describedby={tooltipId} data-press="audio" data-pressed={pressed === "audio"} onPointerDown={press} onPointerUp={releasePress} onPointerCancel={releasePress} onPointerEnter={event => showTooltip(event, "Audio call")} onFocus={event => showTooltip(event, "Audio call")} onBlur={hideTooltip} onClick={() => { hideTooltip(); onAudioCall?.(); }}><Phone size={16} strokeWidth={2.25} aria-hidden="true" /></button>
      {onVideoCall && <button type="button" className="mic-icon" aria-label={`Video call ${name}`} aria-describedby={tooltipId} data-press="video" data-pressed={pressed === "video"} onPointerDown={press} onPointerUp={releasePress} onPointerCancel={releasePress} onPointerEnter={event => showTooltip(event, "Video call")} onFocus={event => showTooltip(event, "Video call")} onBlur={hideTooltip} onClick={() => { hideTooltip(); onVideoCall(); }}><Video size={16} /></button>}
      <span className="mic-tooltip" id={tooltipId} role="tooltip" aria-hidden={!tooltip.visible} data-show={tooltip.visible} style={{ width: tooltip.width, "--mic-tooltip-x": `${tooltip.x}px` } as React.CSSProperties}><span ref={tooltipText}>{tooltip.text}</span></span>
    </span></header>
    <div className="mic-divider" aria-hidden="true" />
    <div className="mic-thread" ref={thread} role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions"><div className="mic-messages">{contents}</div></div>
    <form onSubmit={send}><label className="mic-field"><input ref={input} type="text" aria-label="Message" placeholder="iMessage" autoComplete="off" value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} /><button type="submit" className={`mic-send${draft.trim() ? " mic-ready" : ""}`} aria-label="Send" aria-disabled={!draft.trim()} data-press="send" data-pressed={pressed === "send"} onPointerDown={press} onPointerUp={releasePress} onPointerCancel={releasePress} onClick={() => input.current?.focus()}><ArrowUp size={16} strokeWidth={2.25} aria-hidden="true" /></button></label></form>
  </section>;
}
const css = `
.mova-imessage{--mic-bg:#fff;--mic-fg:#0d0d0d;--mic-muted:#6c6c6c;--mic-chip:rgba(0,0,0,.04);--mic-bubble-in:rgba(0,0,0,.05);--mic-bubble-out:#1c5ffb;--mic-input-line:rgba(0,0,0,.14);--mic-input-focus:#585858;--mic-divider:rgba(0,0,0,.0392);--mic-tooltip-bg:#fff;--mic-tooltip-fg:#2f2f2f;box-sizing:border-box;width:300px;max-width:100%;display:flex;flex-direction:column;border-radius:24px;background:var(--mic-bg);color:var(--mic-fg);font:400 13px/20px "Inter Variable",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0;box-shadow:0 0 0 1px #0000000a,0 8px 32px -4px #0000000f,0 1px 3px #0000000a;overflow:hidden;-webkit-font-smoothing:antialiased}
.mova-imessage[data-theme=dark]{--mic-bg:#1d1d1d;--mic-fg:#f2f2f2;--mic-muted:rgba(202,202,202,.7);--mic-chip:rgba(255,255,255,.07);--mic-bubble-in:rgba(255,255,255,.08);--mic-bubble-out:#2f6bff;--mic-input-line:rgba(255,255,255,.14);--mic-input-focus:#a5a5a5;--mic-divider:rgba(255,255,255,.0392);--mic-tooltip-bg:#262626;--mic-tooltip-fg:#f2f2f2;color-scheme:dark}
.mova-imessage *{box-sizing:border-box}.mova-imessage button,.mova-imessage input{font:inherit;letter-spacing:inherit}.mova-imessage button{padding:0;border:0;background:none;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}.mova-imessage button:is(:active,[data-pressed=true]){transform:scale(.95)}.mova-imessage :focus-visible:not(input){outline:none;box-shadow:0 0 0 2px var(--mic-bg),0 0 0 4px var(--mic-fg)}.mova-imessage header{display:flex;gap:12px;align-items:center;padding:16px;position:relative;z-index:2}.mic-avatar{display:inline-grid;place-items:center;flex:none;width:32px;height:32px;border-radius:50%;background:#c7b0a1;color:#433b37;font-size:12.8px;font-weight:500;line-height:1;overflow:hidden}.mic-avatar img{display:block;width:32px;height:32px;border-radius:50%;object-fit:cover;outline:1px solid #00000014;outline-offset:-1px}.mova-imessage[data-theme=dark] .mic-avatar img{outline-color:#ffffff14}.mic-person{flex:1;min-width:0;display:flex;flex-direction:column}.mic-person strong{font-size:15px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mic-person>span,.mic-time,.mic-status{font-size:12px;line-height:16px;color:var(--mic-muted)}.mic-actions{position:relative;display:inline-flex;flex:none;gap:4px;margin-right:-6px}.mova-imessage .mic-icon{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:var(--mic-muted);transition:transform 150ms cubic-bezier(.22,1,.36,1),background-color 150ms cubic-bezier(.22,1,.36,1)}@media(hover:hover) and (pointer:fine){.mova-imessage .mic-icon:hover{background:var(--mic-chip)}}.mic-tooltip{position:absolute;top:calc(100% + 8px);left:0;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;translate:var(--mic-tooltip-x,0px) 0;scale:.98;transform-origin:50% 0;padding:8px 12px;border-radius:8px;background:var(--mic-tooltip-bg);color:var(--mic-tooltip-fg);font-size:12px;line-height:16px;white-space:nowrap;box-shadow:0 0 0 1px #0000000f,0 2px 6px #0000000d,0 4px 42px #0000000f;opacity:0;pointer-events:none;z-index:3;transition:opacity 50ms ease-out,scale 50ms ease-out,translate 160ms cubic-bezier(.22,1,.36,1),width 160ms cubic-bezier(.22,1,.36,1)}.mic-tooltip[data-show=true]{opacity:1;scale:1;transition:opacity 150ms ease-out 80ms,scale 150ms ease-out 80ms,translate 160ms cubic-bezier(.22,1,.36,1),width 160ms cubic-bezier(.22,1,.36,1)}.mic-tooltip>span{white-space:nowrap}.mic-divider{height:1px;flex:none;background:linear-gradient(90deg,transparent,var(--mic-divider) 20%,var(--mic-divider) 80%,transparent)}.mic-thread{box-sizing:content-box;height:228px;display:flex;flex-direction:column;overflow-y:auto;padding:12px 16px;scrollbar-width:none;overscroll-behavior:contain;-webkit-mask-image:linear-gradient(to bottom,transparent,#000 16px);mask-image:linear-gradient(to bottom,transparent,#000 16px)}.mic-thread::-webkit-scrollbar{display:none}.mic-messages{margin-top:auto;display:flex;flex-direction:column;gap:2px}.mic-time{align-self:center;margin-bottom:8px}.mic-bubble{box-sizing:content-box;max-width:78%;padding:8px 12px;border-radius:18px;font-size:13px;line-height:20px;overflow-wrap:anywhere;text-wrap:pretty;transition:border-radius 250ms cubic-bezier(.22,1,.36,1)}.mic-incoming{align-self:flex-start;background:var(--mic-bubble-in);border-bottom-left-radius:6px;transform-origin:0 100%}.mic-outgoing{align-self:flex-end;background:var(--mic-bubble-out);color:#fff;border-bottom-right-radius:6px;transform-origin:100% 100%}.mic-incoming:has(+.mic-incoming){border-bottom-left-radius:18px}.mic-outgoing:has(+.mic-outgoing){border-bottom-right-radius:18px}.mic-incoming+.mic-outgoing,.mic-outgoing+.mic-incoming,.mic-status+.mic-bubble{margin-top:6px}.mic-status{align-self:flex-end;padding:2px 4px 0 0;transform-origin:100% 0}.mic-new{animation:mic-pop 500ms cubic-bezier(.34,1.36,.64,1) both,mic-fade 400ms cubic-bezier(.22,1,.36,1) both}@keyframes mic-pop{from{transform:translateY(8px) scale(.92)}to{transform:none}}@keyframes mic-fade{from{opacity:0;filter:blur(2px)}to{opacity:1;filter:blur(0)}}.mic-bubble.mic-typing{display:flex;align-items:center;gap:4px;padding:14px 12px}.mic-typing i{width:6px;height:6px;border-radius:50%;background:var(--mic-muted);animation:mic-typing 1200ms ease-in-out infinite}.mic-typing i:nth-child(2){animation-delay:180ms}.mic-typing i:nth-child(3){animation-delay:360ms}@keyframes mic-typing{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}.mic-text-swap{display:inline-block;transform:translateY(0);filter:blur(0);opacity:1;transition:transform 150ms ease-in-out,filter 150ms ease-in-out,opacity 150ms ease-in-out;will-change:transform,filter,opacity}.mic-text-swap.mic-exit{transform:translateY(-4px);filter:blur(2px);opacity:0}.mic-text-swap.mic-enter-start{transform:translateY(4px);filter:blur(2px);opacity:0;transition:none}.mova-imessage form{padding:8px 16px 16px;margin:0}.mic-field{display:flex;align-items:center;gap:8px;height:36px;padding:0 4px 0 14px;border-radius:40px;background:var(--mic-bg);box-shadow:inset 0 0 0 1px var(--mic-input-line);transition:box-shadow 120ms ease;cursor:text}.mic-field:focus-within{box-shadow:inset 0 0 0 1.5px var(--mic-input-focus)}.mova-imessage input{flex:1;min-width:0;height:100%;padding:0;border:0;outline:none;background:none;color:var(--mic-fg);font-size:13px;line-height:20px}.mova-imessage input::placeholder{color:var(--mic-muted)}.mova-imessage .mic-send{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--mic-chip);color:var(--mic-muted);transition:transform 150ms cubic-bezier(.22,1,.36,1),background-color 150ms cubic-bezier(.22,1,.36,1),color 150ms cubic-bezier(.22,1,.36,1)}.mova-imessage .mic-send[aria-disabled=true]{cursor:default}.mova-imessage .mic-send.mic-ready{background:var(--mic-bubble-out);color:#fff}@media(prefers-reduced-motion:reduce){.mova-imessage *{animation:none!important;transition:none!important}.mova-imessage .mic-typing i{opacity:.6}.mova-imessage button:is(:active,[data-pressed=true]){transform:none}}
`;
