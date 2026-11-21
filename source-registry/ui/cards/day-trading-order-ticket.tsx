"use client";

/** Local preview only; no brokerage connection. */
import * as React from "react";
import { Check } from "lucide-react";

export interface DayTradingOrderDraft {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "trail";
  shares: number;
  price: number;
  estimatedTotal: number;
  /** Trailing-stop distance; price remains the quote used for the estimate. */
  trailAmount?: number;
}
export interface DayTradingOrderTicketProps {
  symbol?: string;
  company?: string;
  quote?: number;
  change?: string;
  initialShares?: number;
  onSubmit?: (draft: DayTradingOrderDraft) => void | Promise<void>;
  theme?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
}
const types = [
  { id: "market", label: "Market", priceLabel: "", hint: "" },
  { id: "limit", label: "Limit", priceLabel: "Limit price", hint: "a limit price" },
  { id: "stop", label: "Stop market", priceLabel: "Stop price", hint: "a stop price" },
  { id: "trail", label: "Trailing stop", priceLabel: "Trail amount", hint: "a trail amount" },
] as const;
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function SwapText({ text }: { text: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [shown, setShown] = React.useState(text);
  const entering = React.useRef(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (text === shown) { el.classList.remove("mot-is-exit"); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(text); return; }
    el.classList.remove("mot-is-enter-start");
    el.classList.add("mot-is-exit");
    const timer = window.setTimeout(() => { entering.current = true; setShown(text); }, 150);
    return () => window.clearTimeout(timer);
  }, [text, shown]);
  React.useLayoutEffect(() => {
    if (!entering.current || !ref.current) return;
    entering.current = false;
    ref.current.classList.remove("mot-is-exit");
    ref.current.classList.add("mot-is-enter-start");
    void ref.current.offsetHeight;
    ref.current.classList.remove("mot-is-enter-start");
  }, [shown]);
  return <span ref={ref} className="mot-t-text-swap">{shown}</span>;
}
function PopNumber({ value }: { value: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const previous = React.useRef(value);
  const samePrefix = React.useRef(value.length);
  if (previous.current !== value) {
    let same = 0;
    while (same < previous.current.length && same < value.length && previous.current[same] === value[same]) same++;
    samePrefix.current = same;
  }
  const same = samePrefix.current;
  React.useLayoutEffect(() => {
    if (previous.current === value || !ref.current) return;
    previous.current = value;
    ref.current.classList.remove("mot-is-animating");
    void ref.current.offsetHeight;
    ref.current.classList.add("mot-is-animating");
  }, [value]);
  return <span ref={ref} className="mot-t-digit-group" aria-hidden="true">{value.split("").map((character, index) => <span key={index} className="mot-t-digit" data-same={index < same ? "" : undefined} data-stagger={index === value.length - 2 ? "1" : index === value.length - 1 ? "2" : undefined}>{character}</span>)}</span>;
}
function CheckMark({ size = 16 }: { size?: number }) {
  return <Check className="mot-hi" size={size} strokeWidth={size === 24 ? 2 : 3} aria-hidden="true" />;
}
function useFieldError() {
  const [error, setError] = React.useState(false);
  const [shake, setShake] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  React.useLayoutEffect(() => {
    if (!error || !box.current) return;
    box.current.classList.remove("mot-is-shaking");
    void box.current.offsetWidth;
    box.current.classList.add("mot-is-shaking");
    const shakeTimer = setTimeout(() => box.current?.classList.remove("mot-is-shaking"), 300);
    return () => clearTimeout(shakeTimer);
  }, [error, shake]);
  const clear = () => { if (timer.current) clearTimeout(timer.current); setError(false); };
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setError(true); setShake(value => value + 1);
    timer.current = setTimeout(() => setError(false), 3280);
  };
  return { error, box, clear, show };
}

export function DayTradingOrderTicket({ symbol = "NOVA", company = "Novaline Robotics", quote = 184.20, change = "+1.24%", initialShares = 10, onSubmit, theme = "light", className = "", style }: DayTradingOrderTicketProps = {}) {
  const [side, setSide] = React.useState<DayTradingOrderDraft["side"]>("buy");
  const [type, setType] = React.useState<DayTradingOrderDraft["type"]>("limit");
  const [shares, setShares] = React.useState(String(Math.min(9999, Math.max(0, Math.trunc(Number.isFinite(initialShares) ? initialShares : 10)))));
  const [price, setPrice] = React.useState(quote.toFixed(2));
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuClosing, setMenuClosing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<DayTradingOrderDraft | null>(null);
  const [submitError, setSubmitError] = React.useState("");
  const sharesError = useFieldError();
  const priceError = useFieldError();
  const guard = React.useRef(false);
  const alive = React.useRef(true);
  const placedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const menu = React.useRef<HTMLDivElement>(null);
  const typeButton = React.useRef<HTMLButtonElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const shareInput = React.useRef<HTMLInputElement>(null);
  const priceInput = React.useRef<HTMLInputElement>(null);
  const newOrderFocus = React.useRef(false);
  const id = React.useId();
  const typeInfo = types.find(item => item.id === type)!;
  const count = parseInt(shares, 10) || 0;
  const numericPrice = parseFloat(price);
  const effectivePrice = type === "limit" || type === "stop" ? numericPrice : quote;
  const total = count > 0 && Number.isFinite(effectivePrice) && effectivePrice > 0 ? count * effectivePrice : 0;
  const totalText = money(total);
  const description = (draft: DayTradingOrderDraft) => draft.type === "market" ? "at market" : draft.type === "limit" ? `at ${money(draft.price)}` : draft.type === "stop" ? `stop ${money(draft.price)}` : `trailing ${money(draft.trailAmount ?? 0)}`;
  React.useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (placedTimer.current) clearTimeout(placedTimer.current); if (menuTimer.current) clearTimeout(menuTimer.current); };
  }, []);
  React.useEffect(() => {
    if (done) heading.current?.focus();
    else if (newOrderFocus.current) { newOrderFocus.current = false; (type === "market" ? typeButton : shareInput).current?.focus(); }
  }, [done, type]);
  function closeMenu(focus = false) {
    setMenuOpen(false); setMenuClosing(true);
    if (menuTimer.current) clearTimeout(menuTimer.current);
    menuTimer.current = setTimeout(() => setMenuClosing(false), 150);
    if (focus) typeButton.current?.focus();
  }
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) closeMenu(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); closeMenu(true); } };
    document.addEventListener("pointerdown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);
  function openMenu(focusIndex?: number) {
    if (menuTimer.current) clearTimeout(menuTimer.current);
    setMenuClosing(false); setMenuOpen(true);
    if (focusIndex !== undefined) requestAnimationFrame(() => menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[focusIndex]?.focus());
  }
  function selectType(value: DayTradingOrderDraft["type"]) {
    if ((value === "trail") !== (type === "trail")) setPrice(value === "trail" ? "1.50" : quote.toFixed(2));
    priceError.clear(); sharesError.clear(); setSubmitError(""); setType(value); closeMenu(true);
  }
  const updateShares = (value: string) => { setShares(value); sharesError.clear(); setSubmitError(""); };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (guard.current || done) return;
    const invalidShares = count < 1 || count > 9999;
    const invalidPrice = type !== "market" && !(Number.isFinite(numericPrice) && numericPrice > 0);
    if (invalidShares) sharesError.show();
    if (invalidPrice) priceError.show();
    if (invalidShares || invalidPrice) { if (type === "market") typeButton.current?.focus(); else (invalidShares ? shareInput : priceInput).current?.focus(); return; }
    if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) { setSubmitError("The quote must be greater than zero."); return; }
    const draft: DayTradingOrderDraft = { symbol, side, type, shares: count, price: effectivePrice, estimatedTotal: total, ...(type === "trail" ? { trailAmount: numericPrice } : {}) };
    guard.current = true; setBusy(true); setSubmitError(""); closeMenu();
    try {
      await Promise.all([onSubmit?.(draft), new Promise<void>(resolve => { placedTimer.current = setTimeout(() => { placedTimer.current = null; resolve(); }, 1800); })]);
      if (alive.current) setDone(draft);
    } catch {
      if (placedTimer.current) { clearTimeout(placedTimer.current); placedTimer.current = null; }
      if (alive.current) setSubmitError("The order could not be submitted. Please try again.");
    } finally { guard.current = false; if (alive.current) setBusy(false); }
  }
  return <section className={`mova-order ${className}`} data-theme={theme} style={style} aria-label="Trading order ticket">
    <style>{css}</style>
    {!onSubmit && <p className="mot-sr-only">Interactive preview · no real order</p>}
    <div className="mot-t-page-slide" data-page={done ? 2 : 1}>
      <form className="mot-t-page mot-page-form" data-page-id="1" onSubmit={event => void submit(event)} noValidate inert={!!done} aria-hidden={done ? true : undefined}>
        <header className="mot-head"><div className="mot-head-main"><h2 className="mot-ticker">{symbol}</h2><p className="mot-company">{company}</p></div><div className="mot-quote"><span className="mot-quote-price">{money(quote)}</span><span className="mot-badge" data-negative={change.trim().startsWith("-")}>{change}</span></div></header>
        <div className="mot-t-tabs" role="tablist" aria-label="Order side"><span className="mot-t-tabs-pill" aria-hidden="true" style={{ transform: `translateX(${side === "buy" ? "3px" : "calc(100% + 6px)"})` }} />{(["buy", "sell"] as const).map((value, index) => <button key={value} type="button" role="tab" className="mot-t-tab" aria-selected={value === side} tabIndex={value === side ? 0 : -1} disabled={busy} onClick={() => setSide(value)} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "buy" : event.key === "End" ? "sell" : index === 0 ? "sell" : "buy"; setSide(next); (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next === "buy" ? 0 : 1])?.focus(); } }}>{value === "buy" ? "Buy" : "Sell"}</button>)}</div>
        <div className="mot-fields">
          <div className="mot-field"><span className="mot-field-label" id={`${id}-type-label`}>Order type</span><div className="mot-type-anchor" ref={menu}>
            <button type="button" ref={typeButton} className="mot-box mot-type-btn mot-t-input" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={`${id}-types`} aria-labelledby={`${id}-type-label ${id}-type-value`} disabled={busy} onClick={() => menuOpen ? closeMenu() : openMenu()} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openMenu(event.key === "ArrowDown" ? 0 : types.length - 1); } }}><span className="mot-type-btn-label" id={`${id}-type-value`}><SwapText text={typeInfo.label} /></span><svg className="mot-hi" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.46967 6.46967C4.76256 6.17678 5.23744 6.17678 5.53033 6.46967L8 8.93934L10.4697 6.46967C10.7626 6.17678 11.2374 6.17678 11.5303 6.46967C11.8232 6.76256 11.8232 7.23744 11.5303 7.53033L8.53033 10.5303C8.23744 10.8232 7.76256 10.8232 7.46967 10.5303L4.46967 7.53033C4.17678 7.23744 4.17678 6.76256 4.46967 6.46967Z" /></svg></button>
            <div id={`${id}-types`} className={`mot-t-dropdown${menuOpen ? " mot-is-open" : menuClosing ? " mot-is-closing" : ""}`} role="menu" aria-label="Order type" aria-hidden={!menuOpen} inert={!menuOpen} onKeyDown={event => { const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')); const current = items.indexOf(document.activeElement as HTMLButtonElement); const next = event.key === "ArrowDown" ? (current + 1) % items.length : event.key === "ArrowUp" ? (current + items.length - 1) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1; if (next >= 0) { event.preventDefault(); items[next]?.focus(); } if (event.key === "Tab") closeMenu(); }}>
              {types.map(item => <button key={item.id} type="button" role="menuitemradio" aria-checked={item.id === type} className="mot-menu-item" tabIndex={menuOpen ? 0 : -1} onClick={() => selectType(item.id)}><span>{item.label}</span>{item.id === type && <CheckMark />}</button>)}
            </div>
          </div></div>
          <div className="mot-t-acc" data-open={type !== "market"} aria-hidden={type === "market"} inert={type === "market"}><div className="mot-t-acc-panel"><div className="mot-t-acc-panel-inner"><div className="mot-t-acc-body">
            <div className={`mot-field mot-t-input-wrap${sharesError.error ? " mot-is-error" : ""}`}><label className="mot-field-label" htmlFor={`${id}-shares`}>Shares</label><div className={`mot-box mot-t-input${sharesError.error ? " mot-is-error" : ""}`} ref={sharesError.box}><button type="button" className="mot-step" aria-label="One share less" disabled={busy} onClick={() => updateShares(String(Math.max(0, count - 1)))}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.25" aria-hidden="true"><path d="M5 12h14" /></svg></button><input ref={shareInput} id={`${id}-shares`} inputMode="numeric" value={shares} disabled={busy} aria-invalid={sharesError.error} aria-describedby={sharesError.error ? `${id}-shares-error` : undefined} onChange={event => updateShares(event.target.value.replace(/\D/g, "").slice(0, 4))} /><button type="button" className="mot-step" aria-label="One share more" disabled={busy} onClick={() => updateShares(String(Math.min(9999, count + 1)))}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.25" aria-hidden="true"><path d="M12 4.5v15m7.5-7.5h-15" /></svg></button></div><p className="mot-t-error-msg" id={`${id}-shares-error`} role={sharesError.error ? "alert" : undefined}>Enter at least 1 share</p></div>
            <div className={`mot-field mot-t-input-wrap${priceError.error ? " mot-is-error" : ""}`}><label className="mot-field-label" htmlFor={`${id}-price`}><SwapText text={typeInfo.priceLabel || "Limit price"} /></label><div className={`mot-box mot-price mot-t-input${priceError.error ? " mot-is-error" : ""}`} ref={priceError.box}><span className="mot-prefix" aria-hidden="true">$</span><input ref={priceInput} id={`${id}-price`} tabIndex={type === "market" ? -1 : 0} inputMode="decimal" value={price} disabled={busy} aria-invalid={priceError.error} aria-describedby={priceError.error ? `${id}-price-error` : undefined} onChange={event => { setPrice(event.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 8)); priceError.clear(); setSubmitError(""); }} /></div><p className="mot-t-error-msg" id={`${id}-price-error`} role={priceError.error ? "alert" : undefined}>Enter {typeInfo.hint || "a limit price"}</p></div>
          </div></div></div></div>
        </div>
        <div className="mot-divider" aria-hidden="true" />
        <div className="mot-total"><span className="mot-total-label">Est. total</span><span className="mot-total-value"><PopNumber value={totalText} /><span className="mot-sr-only" aria-live="polite">{totalText}</span></span></div>
        {submitError && <p className="mot-submit-error" role="alert">{submitError}</p>}
        <button type="submit" className={`mot-submit${busy ? " mot-is-loading" : ""}`} aria-live="polite" aria-busy={busy} disabled={busy}><span className="mot-btn-loader"><span className="mot-t-matrix" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} className={[0, 3, 12, 15].includes(index) ? "mot-is-gap" : undefined} style={{ "--d": (index % 4) * 120 } as React.CSSProperties} />)}</span></span><SwapText text={busy ? "Placing order" : side === "buy" ? "Buy" : "Sell"} /></button>
      </form>
      <section className="mot-t-page mot-page-done" data-page-id="2" aria-hidden={!done} inert={!done}>
        <div className="mot-done-head"><span className="mot-done-icon"><CheckMark size={24} /></span><h2 className="mot-done-title" ref={heading} tabIndex={-1}>{onSubmit ? "Order submitted" : "Order preview ready"}</h2><p className="mot-done-meta">{done ? `${done.side === "buy" ? "Buy" : "Sell"} ${done.shares} ${done.symbol} ${description(done)}` : `Buy ${count} ${symbol} at ${money(quote)}`}</p></div>
        <div className="mot-divider" aria-hidden="true" /><div className="mot-total"><span className="mot-total-label">Est. total</span><span className="mot-total-value">{money(done?.estimatedTotal ?? total)}</span></div>
        <button type="button" className="mot-again" tabIndex={done ? 0 : -1} onClick={() => { newOrderFocus.current = true; setDone(null); }}>New order</button>
      </section>
    </div>
  </section>;
}

const css = `
.mova-order{--stage-fg:#0d0d0d;--stage-muted:#6c6c6c;--stage-border:rgba(0,0,0,.08);--stage-surface:#fff;--stage-accent:#17181c;--stage-on-accent:#fff;color-scheme:light;font:400 13px/20px "Inter Variable",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-optical-sizing:auto;font-feature-settings:"liga" 1,"calt" 1;letter-spacing:0;-webkit-font-smoothing:antialiased}
.mova-order[data-theme=dark]{--stage-fg:#f2f2f2;--stage-muted:rgba(202,202,202,.7);--stage-border:rgba(255,255,255,.08);--stage-surface:#1d1d1d;--stage-accent:#fff;--stage-on-accent:#0d0d0d;color-scheme:dark}
.mova-order *{box-sizing:border-box}
.mova-order {
  --page-slide-dur: 250ms;
  --page-fade-dur: 250ms;
  --page-slide-distance: 8px;
  --page-blur: 3px;
  --page-stagger: 0ms;
  --page-exit-enabled: 1;
  --page-slide-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --page-fade-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --matrix-cycle: 1200ms;
  --matrix-base: color-mix(in srgb, var(--stage-on-accent) 35%, transparent);
  --matrix-active: var(--stage-on-accent);
  --matrix-ease: ease-in-out;
  --done-pop-dur: 500ms;
  --done-pop-scale: 0.6;
  --shake-distance: 6px;
  --shake-overshoot: 4px;
  --shake-dur-a: 80ms;
  --shake-dur-b: 60ms;
  --shake-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --revert-hold: 3000ms;
  --revert-dur: 280ms;
  --digit-dur: 500ms;
  --digit-distance: 8px;
  --digit-stagger: 70ms;
  --digit-blur: 2px;
  --digit-ease: cubic-bezier(0.34, 1.45, 0.64, 1);
  --digit-dir-x: 0;
  --digit-dir-y: 1;
  --tabs-dur: 250ms;
  --tabs-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --tabs-text-muted: var(--stage-muted);
  --tabs-text-active: var(--stage-fg);
  --tabs-bar-bg: var(--chip);
  --tabs-pill-bg: var(--stage-surface);
  --text-swap-dur: 150ms;
  --text-swap-translate-y: 4px;
  --text-swap-blur: 2px;
  --text-swap-ease: ease-in-out;
  --press-scale: 0.99;
  --press-dur: 150ms;
  --ease-smooth-out: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-quick: 150ms;
  --ease-out: ease-out;

  --dropdown-open-dur: 250ms;
  --dropdown-close-dur: 150ms;
  --dropdown-pre-scale: 0.97;
  --dropdown-closing-scale: 0.99;
  --dropdown-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --acc-expand: 250ms;
  --acc-collapse: 250ms;
  --acc-chevron: 250ms;
  --acc-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --menu-shadow: 0 4px 42px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.05), 0 0 0 1px rgba(0,0,0,.06);

  --chip: rgba(0,0,0,.04);
  --chip-hover: rgba(0,0,0,.06);
  --chip-press: rgba(0,0,0,.08);
  --ring-soft: rgba(0,0,0,.06);
  --err: #EC4A4A;
  --divider: color-mix(in srgb, var(--stage-border) 49%, transparent);
  --badge-fill: #E7F9F3;
  --badge-ink: #216E55;
  --pill-shadow: 0 1px 2px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04);
  --cta-shadow: 0 1px 2px 0 rgba(0,0,0,.2);
  --cta-hover: rgba(255,255,255,.06);
  --card-shadow: 0 0 0 1px rgba(0,0,0,.04), 0 8px 32px -4px rgba(0,0,0,.06), 0 1px 3px 0 rgba(0,0,0,.04);
}
.mova-order[data-theme="dark"] {
  --chip: rgba(255,255,255,.07);
  --chip-hover: rgba(255,255,255,.10);
  --chip-press: rgba(255,255,255,.08);
  --ring-soft: rgba(255,255,255,.10);
  --err: #FF6B6B;
  --badge-fill: rgba(33,110,85,.28);
  --badge-ink: #7FDDB8;
  --tabs-pill-bg: rgba(255,255,255,.10);
  --pill-shadow: 0 1px 2px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.06);
  --cta-shadow: 0 1px 2px 0 rgba(0,0,0,.4);
  --cta-hover: rgba(0,0,0,.06);
  --card-shadow: 0 0 0 1px rgba(255,255,255,.06), 0 8px 32px -4px rgba(0,0,0,.3), 0 1px 3px 0 rgba(0,0,0,.2);
}

.mova-order {
  width: 300px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 24px;
  border-radius: 24px;
  background: var(--stage-surface);
  box-shadow: var(--card-shadow);
  color: var(--stage-fg);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
:where(.mova-order) :is(button, input) { font: inherit; color: inherit; }
:where(.mova-order) button { padding: 0; border: 0; background: none; cursor: pointer; }
:where(.mova-order) p { margin: 0; }
.mova-order :focus-visible:not(input) {
  outline: none;
  box-shadow: 0 0 0 2px var(--stage-surface), 0 0 0 4px var(--stage-accent);
}

.mot-head { display: flex; align-items: flex-start; gap: 12px; }
.mot-head-main { flex: 1; min-width: 0; }
.mot-ticker { font-size: 16px; line-height: 22px; font-weight: 500; margin: 0; }
.mot-company { font-size: 12px; line-height: 16px; color: var(--stage-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mot-quote { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.mot-quote-price { font-size: 13px; line-height: 20px; font-variant-numeric: tabular-nums; }
.mot-badge {
  display: inline-flex; align-items: center;
  height: 18px; padding: 0 6px; border-radius: 50px;
  font-size: 11px; line-height: 16px; font-weight: 500;
  background: var(--badge-fill); color: var(--badge-ink);
  box-shadow: 0 1px 3px rgba(0,0,0,.04), inset 0 0 0 1px color-mix(in srgb, var(--badge-ink) 14%, transparent), inset 0 -1px 0 0 color-mix(in srgb, var(--badge-ink) 10%, transparent);
  font-variant-numeric: tabular-nums;
}

/* Tabs sliding */
.mot-t-tabs {
  position: relative;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border-radius: 48px;
  background: var(--tabs-bar-bg);
}
.mot-t-tab {
  position: relative;
  flex: 1;
  appearance: none;
  border: 0;
  background: transparent;
  height: 30px;
  padding: 4px 12px;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  color: var(--tabs-text-muted);
  cursor: pointer;
  border-radius: 48px;
  z-index: 1;
  --press-scale: 0.97;
  transition: color var(--tabs-dur) var(--tabs-ease), transform var(--press-dur) var(--ease-smooth-out);
}
.mova-order .mot-t-tab { color: var(--tabs-text-muted); }
.mova-order .mot-t-tab[aria-selected="true"] { color: var(--tabs-text-active); }
@media (hover: hover) and (pointer: fine) { .mova-order .mot-t-tab:not([aria-selected="true"]):hover { color: var(--tabs-text-active); } }
.mot-t-tabs-pill {
  position: absolute;
  top: 3px;
  left: 0;
  height: 30px;
  width: calc((100% - 9px) / 2);
  background: var(--tabs-pill-bg);
  box-shadow: var(--pill-shadow);
  border-radius: 48px;
  transform: translateX(0);
  transition: transform var(--tabs-dur) var(--tabs-ease), width var(--tabs-dur) var(--tabs-ease);
  will-change: transform, width;
  z-index: 0;
  pointer-events: none;
}

/* Fields */
.mot-fields { display: flex; flex-direction: column; gap: 4px; }
.mot-field {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: 12px;
}
.mot-field-label { font-size: 13px; line-height: 20px; }
.mot-box {
  width: 136px;
  height: 36px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  border-radius: 10px;
  background: var(--stage-surface);
  box-shadow: 0 0 0 1px var(--stage-border);
}
.mot-t-input {
  transition: box-shadow var(--duration-quick) var(--ease-out);
  will-change: transform;
}
.mot-box:focus-within { box-shadow: 0 0 0 1px var(--stage-accent), 0 0 0 3px var(--ring-soft); }
.mot-t-input.mot-is-error,
.mot-t-input.mot-is-error:focus-within {
  box-shadow: 0 0 0 1px var(--err), 0 0 0 3px color-mix(in srgb, var(--err) 14%, transparent);
  transition: box-shadow var(--revert-dur, 280ms) ease-out;
}
.mot-box input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--stage-fg);
  text-align: center;
}
.mot-box.mot-price { padding: 0 12px; gap: 2px; }
.mot-box.mot-price input { text-align: right; }
.mot-prefix { font-size: 13px; line-height: 20px; color: var(--stage-muted); }
.mot-step {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--stage-muted);
  --press-scale: 0.95;
  transition: background-color var(--duration-quick) var(--ease-out), transform var(--press-dur) var(--ease-smooth-out);
}
@media (hover: hover) and (pointer: fine) { .mot-step:hover { background: var(--chip); } }
.mot-step:is(:active,.mot-is-pressed) { background: var(--chip-press); transform: scale(var(--press-scale)); }

.mot-t-error-msg {
  grid-column: 1 / -1;
  margin: 4px 0 0;
  height: 16px;
  font-size: 12px;
  line-height: 16px;
  text-align: right;
  color: var(--err);
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--revert-dur, 280ms) ease-out, visibility 0s linear var(--revert-dur, 280ms);
}
.mot-t-input-wrap.mot-is-error .mot-t-error-msg {
  opacity: 1;
  visibility: visible;
  transition: opacity var(--revert-dur, 280ms) ease-out, visibility 0s linear 0s;
}
.mot-t-input.mot-is-shaking {
  animation: mot-t-input-shake calc(var(--shake-dur-a) * 2 + var(--shake-dur-b) * 2) linear;
}
@keyframes mot-t-input-shake {
  0%      { transform: translateX(0);                                 animation-timing-function: var(--shake-ease); }
  28.57%  { transform: translateX(var(--shake-distance));             animation-timing-function: var(--shake-ease); }
  57.14%  { transform: translateX(calc(var(--shake-distance) * -1)); animation-timing-function: var(--shake-ease); }
  78.57%  { transform: translateX(var(--shake-overshoot));            animation-timing-function: var(--shake-ease); }
  100%    { transform: translateX(0); }
}

/* Total */
.mot-divider { height: 1px; background: linear-gradient(90deg, transparent, var(--divider) 20%, var(--divider) 80%, transparent); }
.mot-total { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; line-height: 20px; }
.mot-total-label { color: var(--stage-muted); }
.mot-total-value { font-variant-numeric: tabular-nums; }

@keyframes mot-t-digit-pop-in {
  0% {
    transform: translate(calc(var(--digit-distance) * var(--digit-dir-x)), calc(var(--digit-distance) * var(--digit-dir-y)));
    opacity: 0;
    filter: blur(var(--digit-blur));
  }
  100% { transform: translate(0, 0); opacity: 1; filter: blur(0); }
}
.mot-t-digit-group { display: inline-flex; align-items: baseline; }
.mot-t-digit { display: inline-block; white-space: pre; }
.mot-t-digit-group.mot-is-animating .mot-t-digit { animation: mot-t-digit-pop-in var(--digit-dur) var(--digit-ease) both; }
.mot-t-digit-group.mot-is-animating .mot-t-digit[data-stagger="1"] { animation-delay: var(--digit-stagger); }
.mot-t-digit-group.mot-is-animating .mot-t-digit[data-stagger="2"] { animation-delay: calc(var(--digit-stagger) * 2); }
.mot-t-digit-group.mot-is-animating .mot-t-digit[data-same] { animation: none; }

/* Submit */
.mot-submit {
  height: 36px;
  width: 100%;
  border-radius: 40px;
  background: var(--stage-accent);
  color: var(--stage-on-accent);
  box-shadow: var(--cta-shadow);
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  padding: 0 12px;
  overflow: hidden;
  transition: transform var(--press-dur) var(--ease-smooth-out), background-color var(--duration-quick) var(--ease-out);
}
.mova-order .mot-submit { color: var(--stage-on-accent); }
@media (hover: hover) and (pointer: fine) { .mot-submit:hover { background-image: linear-gradient(var(--cta-hover), var(--cta-hover)); } }
.mot-submit:is(:active,.mot-is-pressed) { transform: scale(var(--press-scale)); }
.mot-t-tab:is(:active,.mot-is-pressed) { transform: scale(var(--press-scale)); }

.mot-t-text-swap {
  display: inline-block;
  transform: translateY(0);
  filter: blur(0);
  opacity: 1;
  transition: transform var(--text-swap-dur) var(--text-swap-ease), filter var(--text-swap-dur) var(--text-swap-ease), opacity var(--text-swap-dur) var(--text-swap-ease);
}
.mot-t-text-swap.mot-is-exit { transform: translateY(calc(var(--text-swap-translate-y) * -1)); filter: blur(var(--text-swap-blur)); opacity: 0; }
.mot-t-text-swap.mot-is-enter-start { transform: translateY(var(--text-swap-translate-y)); filter: blur(var(--text-swap-blur)); opacity: 0; transition: none; }

/* Page side-by-side */
.mot-t-page-slide { position: relative; display: grid; }
.mot-t-page-slide .mot-t-page[data-page-id="1"] { --t-page-from-x: calc(var(--page-slide-distance) * -1); }
.mot-t-page-slide .mot-t-page[data-page-id="2"] { --t-page-from-x: var(--page-slide-distance); }
.mot-t-page-slide .mot-t-page {
  grid-area: 1 / 1;
  opacity: 0;
  pointer-events: none;
  transform: translateX(calc(var(--t-page-from-x, 0px) * var(--page-exit-enabled)));
  filter: blur(calc(var(--page-blur) * var(--page-exit-enabled)));
  transition: opacity var(--page-fade-dur) var(--page-fade-ease), transform var(--page-slide-dur) var(--page-slide-ease), filter var(--page-slide-dur) var(--page-slide-ease);
}
.mot-t-page-slide[data-page="1"] .mot-t-page[data-page-id="1"],
.mot-t-page-slide[data-page="2"] .mot-t-page[data-page-id="2"] {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
  filter: blur(0);
  transition-delay: var(--page-stagger);
}
.mot-page-form { display: flex; flex-direction: column; gap: 16px; }
.mot-page-done { display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 16px; text-align: center; }
.mot-done-head { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mot-done-icon {
  width: 48px; height: 48px; border-radius: 50%;
  display: grid; place-items: center;
  margin-bottom: 8px;
  background: var(--badge-fill); color: var(--badge-ink);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--badge-ink) 14%, transparent);
  opacity: 0;
  transform: scale(var(--done-pop-scale));
  transition: opacity var(--done-pop-dur) var(--ease-smooth-out), transform var(--done-pop-dur) var(--ease-smooth-out);
}
.mot-t-page-slide[data-page="2"] .mot-done-icon { opacity: 1; transform: scale(1); transition-delay: var(--page-slide-dur); }
.mot-done-title { font-size: 16px; line-height: 22px; font-weight: 500; }
.mot-done-meta { font-size: 12px; line-height: 16px; color: var(--stage-muted); }
.mot-again {
  height: 36px; width: 100%; border-radius: 40px;
  background: var(--chip); color: var(--stage-fg);
  font-size: 13px; line-height: 20px; font-weight: 500;
  --press-scale: 0.97;
  transition: transform var(--press-dur) var(--ease-smooth-out), background-color var(--duration-quick) var(--ease-out);
}
@media (hover: hover) and (pointer: fine) { .mot-again:hover { background: var(--chip-hover); } }
.mot-again:is(:active,.mot-is-pressed) { background: var(--chip-press); transform: scale(var(--press-scale)); }

/* Matrix dot loader */
.mot-btn-loader { position: absolute; left: 16px; top: 50%; translate: 0 -50%; opacity: 0; transition: opacity var(--duration-quick) var(--ease-out); }
.mot-submit.mot-is-loading .mot-btn-loader { opacity: 1; }
.mot-submit { position: relative; }
.mot-t-matrix { display: grid; grid-template-columns: repeat(4, 2px); grid-auto-rows: 2px; gap: 2px; }
.mot-t-matrix i { display: block; background: var(--matrix-base); animation: mot-t-matrix-pulse var(--matrix-cycle) var(--matrix-ease) infinite; animation-delay: calc(var(--d, 0) * 1ms); }
.mot-t-matrix i.mot-is-gap { visibility: hidden; animation: none; }
@keyframes mot-t-matrix-pulse {
  0%, 45%, 100% { background-color: var(--matrix-base); }
  15% { background-color: var(--matrix-active); }
}

.mot-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .mot-t-input { animation: none !important; transform: none !important; }
  .mot-t-digit-group .mot-t-digit { animation: none !important; }
  .mot-t-tabs-pill, .mot-t-tab { transition: none !important; }
  .mot-t-text-swap { transition: none !important; }
  .mot-t-page-slide .mot-t-page, .mot-done-icon { transition: none !important; }
  .mot-t-matrix i { animation: none !important; }
  .mot-again:is(:active,.mot-is-pressed) { transform: none; }
  .mot-submit:is(:active,.mot-is-pressed), .mot-step:is(:active,.mot-is-pressed), .mot-t-tab:is(:active,.mot-is-pressed) { transform: none; }
}
/* Order type menu */
.mova-order[data-theme="dark"] { --menu-shadow: 0 1px 3px rgba(0,0,0,.04), inset 0 1px 0 rgba(255,255,255,.04), inset 0 0 0 1px rgba(196,196,196,.08); }
.mot-type-anchor { position: relative; }
.mot-box.mot-type-btn {
  width: 136px;
  justify-content: space-between;
  padding: 0 10px 0 12px;
  gap: 6px;
  font-size: 13px;
  line-height: 20px;
  --press-scale: 0.97;
  transition: box-shadow var(--duration-quick) var(--ease-out), transform var(--press-dur) var(--ease-smooth-out);
}
.mot-box.mot-type-btn:is(:active,.mot-is-pressed) { transform: scale(var(--press-scale)); }
.mot-type-btn .mot-hi, .mot-type-btn [data-icon] { color: var(--stage-muted); flex: none; }
.mot-type-btn-label { overflow: hidden; white-space: nowrap; }
.mova-order .mot-box.mot-type-btn:focus-visible { box-shadow: 0 0 0 1px var(--stage-accent), 0 0 0 3px var(--ring-soft); }
.mot-t-dropdown {
  position: absolute;
  top: 40px;
  right: 0;
  z-index: 5;
  width: 168px;
  box-sizing: border-box;
  padding: 6px;
  border-radius: 12px;
  background: var(--stage-surface);
  box-shadow: var(--menu-shadow);
  transform-origin: top right;
  transform: scale(var(--dropdown-pre-scale));
  opacity: 0;
  pointer-events: none;
  transition: transform var(--dropdown-open-dur) var(--dropdown-ease), opacity var(--dropdown-open-dur) var(--dropdown-ease);
  will-change: transform, opacity;
}
.mot-t-dropdown.mot-is-open { transform: scale(1); opacity: 1; pointer-events: auto; }
.mot-t-dropdown.mot-is-closing {
  transform: scale(var(--dropdown-closing-scale));
  opacity: 0;
  pointer-events: none;
  transition: transform var(--dropdown-close-dur) var(--dropdown-ease), opacity var(--dropdown-close-dur) var(--dropdown-ease);
}
.mot-menu-item {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 6px 0 8px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  --press-scale: 0.97;
  transition: background-color var(--duration-quick) var(--ease-out), transform var(--press-dur) var(--ease-smooth-out);
}
@media (hover: hover) and (pointer: fine) { .mot-menu-item:hover { background: var(--chip); } }
.mot-menu-item:is(:active,.mot-is-pressed) { background: var(--chip-press); transform: scale(var(--press-scale)); }
.mot-menu-item [data-icon], .mot-menu-item .mot-hi { color: var(--stage-muted); }

/* Accordion expand */
.mot-t-acc { margin: -4px -4px; }
.mot-t-acc-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--acc-collapse) var(--acc-ease); }
.mot-t-acc[data-open="true"] .mot-t-acc-panel { grid-template-rows: 1fr; transition: grid-template-rows var(--acc-expand) var(--acc-ease); }
.mot-t-acc-panel-inner {
  min-height: 0;
  overflow: hidden;
  opacity: 0;
  filter: blur(2px);
  transition: opacity var(--acc-collapse) var(--acc-ease), filter var(--acc-collapse) var(--acc-ease);
}
.mot-t-acc[data-open="true"] .mot-t-acc-panel-inner {
  opacity: 1;
  filter: blur(0);
  transition: opacity var(--acc-expand) var(--acc-ease), filter var(--acc-expand) var(--acc-ease);
}
.mot-t-acc-body { padding: 4px; }

@media (prefers-reduced-motion: reduce) {
  .mot-t-dropdown, .mot-box.mot-type-btn, .mot-menu-item { transition: none !important; }
  .mot-box.mot-type-btn:is(:active,.mot-is-pressed), .mot-menu-item:is(:active,.mot-is-pressed) { transform: none; }
  .mot-t-acc-panel, .mot-t-acc-panel-inner, .mot-t-acc-chevron { transition: none !important; }
}

.mot-hi-play{translate:1px 0}.mot-hi-heart{translate:0 1px}

/* Touch press feedback stays local to this component. */
.mova-order :is(button,[role="tab"],[role="menuitemradio"]){-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-touch-callout:none}

.mova-order .mot-done-title{margin:0}
.mova-order .mot-done-title:focus{outline:none;box-shadow:none}
.mova-order button:disabled{cursor:default}
.mova-order .mot-badge[data-negative=true]{--badge-fill:#fbe9e9;--badge-ink:#ad3c3c}
.mova-order[data-theme=dark] .mot-badge[data-negative=true]{--badge-fill:#4c2b2b;--badge-ink:#ffaaaa}
.mova-order .mot-submit-error{font-size:12px;line-height:16px;color:var(--err)}
@media(prefers-reduced-motion:reduce){.mova-order *{animation:none!important;transition:none!important}.mova-order .mot-t-text-swap{transform:none;filter:none;opacity:1}}
`;
