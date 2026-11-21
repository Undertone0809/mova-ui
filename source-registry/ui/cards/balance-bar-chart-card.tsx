"use client";

/** Original Mova implementation; visual reference documented in docs/provenance/interactive-cards.md. */
import * as React from "react";

export interface BalanceBarPoint { label: string; value: number }
export interface BalanceBarPeriod { id: string; label: string; balance: number; change: string; detail: string; points: BalanceBarPoint[] }
export interface BalanceBarChartCardProps { periods?: BalanceBarPeriod[]; defaultPeriod?: string; currency?: string; locale?: string; onPeriodChange?: (period: BalanceBarPeriod) => void; theme?: "light" | "dark"; className?: string; style?: React.CSSProperties }
const periodsDefault: BalanceBarPeriod[] = [
  { id: "week", label: "Week", balance: 12480.50, change: "+8.2%", detail: "+$940.20 this week", points: ["M", "T", "W", "T", "F", "S", "S"].map((label, i) => ({ label, value: [96, 142, 88, 210, 175, 120, 109][i] })) },
  { id: "month", label: "Month", balance: 12480.50, change: "+12.4%", detail: "+$4,220.60 this month", points: ["1", "5", "10", "15", "20", "25", "30"].map((label, i) => ({ label, value: [420, 610, 380, 720, 560, 890, 640][i] })) },
  { id: "year", label: "Year", balance: 12480.50, change: "+18.6%", detail: "+$32,520.00 this year", points: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((label, i) => ({ label, value: [3120, 4210, 3680, 5020, 4460, 5890, 6140][i] })) },
];
const useLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/** Keep the previous and next strings in the same grid cell during a soft swap. */
function SoftText({ text, className = "" }: { text: string; className?: string }) {
  const element = React.useRef<HTMLSpanElement>(null);
  const initial = React.useRef(text);
  useLayoutEffect(() => {
    const el = element.current;
    if (!el) return;
    const previous = el.dataset.text ?? initial.current;
    if (previous === text) return;
    el.dataset.text = text;
    const width = el.getBoundingClientRect().width;
    const old = document.createElement("span");
    old.className = "mbc-soft-old";
    old.setAttribute("aria-hidden", "true");
    old.textContent = previous;
    const next = document.createElement("span");
    next.className = "mbc-soft-new";
    next.textContent = text;
    el.classList.remove("is-swapping");
    el.replaceChildren(old, next);
    const nextWidth = next.getBoundingClientRect().width;
    el.style.width = `${width}px`;
    void el.offsetWidth;
    el.classList.add("is-swapping");
    el.style.width = `${nextWidth}px`;
    const computed = getComputedStyle(el);
    const duration = Math.max(parseFloat(computed.getPropertyValue("--mbc-text-dur")) || 0, parseFloat(computed.getPropertyValue("--mbc-text-resize-dur")) || 0);
    const timer = window.setTimeout(() => {
      el.classList.remove("is-swapping");
      el.style.removeProperty("width");
      el.textContent = text;
    }, duration + 40);
    return () => window.clearTimeout(timer);
  }, [text]);
  return <span ref={element} className={`mbc-soft ${className}`}>{initial.current}</span>;
}

export function BalanceBarChartCard({ periods = periodsDefault, defaultPeriod = "week", currency = "USD", locale = "en-US", onPeriodChange, theme = "light", className = "", style }: BalanceBarChartCardProps = {}) {
  const [selected, setSelected] = React.useState(defaultPeriod);
  const [active, setActive] = React.useState<number | null>(null);
  const root = React.useRef<HTMLElement>(null);
  const chart = React.useRef<HTMLDivElement>(null);
  const tooltip = React.useRef<HTMLDivElement>(null);
  const tooltipText = React.useRef<HTMLSpanElement>(null);
  const tabs = React.useRef<HTMLDivElement>(null);
  const pill = React.useRef<HTMLSpanElement>(null);
  const measuredPill = React.useRef(false);
  const lastTooltip = React.useRef("");
  const tipId = React.useId();
  const chartId = React.useId();
  const period = periods.find(item => item.id === selected) ?? periods[0];
  const periodIndex = period ? periods.indexOf(period) : -1;
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });
  const pointMoney = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const amountParts = money.formatToParts(period?.balance ?? 0);
  const max = Math.max(1, ...(period?.points.map(point => Math.abs(point.value)) ?? []));
  const signed = period?.points.some(point => point.value < 0) ?? false;
  const negativeChange = period?.change.trim().startsWith("-");
  const detail = /^(.*?)(\$[\d,.]+)(\s+this\s+)(.+)$/.exec(period?.detail ?? "");
  if (active !== null && period?.points[active]) lastTooltip.current = pointMoney.format(period.points[active].value);

  useLayoutEffect(() => {
    const tip = tooltip.current;
    if (!tip) return;
    const trigger = chart.current?.querySelectorAll<HTMLButtonElement>(".mbc-column")[active ?? -1];
    if (active === null || !trigger || !chart.current || !tooltipText.current) {
      tip.dataset.show = "false";
      tip.setAttribute("aria-hidden", "true");
      return;
    }
    const showing = tip.dataset.show === "true";
    const computed = getComputedStyle(tip);
    const width = Math.ceil(tooltipText.current.scrollWidth + parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight));
    const groupRect = chart.current.getBoundingClientRect();
    const rect = trigger.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.left - groupRect.left + rect.width / 2 - width / 2, groupRect.width - width));
    if (!showing) tip.style.transition = "none";
    tip.style.width = `${width}px`;
    tip.style.setProperty("--mbc-tip-x", `${x}px`);
    if (!showing) { void tip.offsetWidth; tip.style.transition = ""; }
    tip.dataset.show = "true";
    tip.setAttribute("aria-hidden", "false");
  }, [active, period, currency, locale]);

  const movePill = React.useCallback((animate: boolean) => {
      const tab = tabs.current?.querySelector<HTMLButtonElement>('[role=tab][aria-selected="true"]');
      const el = pill.current;
      if (!tab || !el) return;
      if (!animate) el.style.transition = "none";
      el.style.transform = `translateX(${tab.offsetLeft}px)`;
      el.style.width = `${tab.offsetWidth}px`;
      if (!animate) { void el.offsetWidth; el.style.transition = ""; }
  }, []);

  useLayoutEffect(() => {
    movePill(measuredPill.current);
    measuredPill.current = true;
  }, [movePill, periodIndex, periods]);

  useLayoutEffect(() => {
    const resize = () => movePill(false);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : undefined;
    if (tabs.current) observer?.observe(tabs.current);
    window.addEventListener("resize", resize);
    let cancelled = false;
    document.fonts?.ready.then(() => { if (!cancelled) movePill(false); });
    return () => { cancelled = true; observer?.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    let pressed: HTMLButtonElement | null = null;
    let started = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { if (pressed) delete pressed.dataset.pressed; pressed = null; };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const button = (event.target as Element).closest<HTMLButtonElement>("button");
      if (!button || button.disabled) return;
      clearTimeout(timer); clear(); pressed = button; started = performance.now(); button.dataset.pressed = "true";
    };
    const up = () => {
      if (!pressed) return;
      const duration = parseFloat(getComputedStyle(pressed).getPropertyValue("--mbc-press-dur")) || 150;
      timer = setTimeout(clear, Math.max(0, duration - (performance.now() - started)));
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    return () => { clearTimeout(timer); clear(); el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, []);

  function selectPeriod(item: BalanceBarPeriod) {
    if (period?.id === item.id) return;
    setSelected(item.id); setActive(null); onPeriodChange?.(item);
  }

  return <section ref={root} className={`mova-balance ${className}`} data-theme={theme} style={style} aria-label="Balance chart">
    <style>{css}</style>
    <div className="mbc-label">Balance</div>
    <div className="mbc-summary">{amountParts.map((part, index) => <span key={index} className={part.type === "decimal" || part.type === "fraction" ? "mbc-cents" : undefined}>{part.value}</span>)}</div>
    <div className="mbc-change-row">
      {period && <span className="mbc-change" data-negative={negativeChange}><SoftText text={period.change} /></span>}
      <span className="mbc-detail">{detail ? <>{detail[1]}<SoftText text={detail[2]} />{detail[3]}<SoftText text={detail[4]} /></> : <SoftText text={period?.detail ?? "No balance data"} />}</span>
    </div>
    <div ref={chart} id={chartId} className="mbc-chart" role="tabpanel" aria-label={period?.label ?? "Balance data"} onPointerLeave={() => setActive(null)}>{period?.points.map((point, index) => <button key={index} type="button" className="mbc-column" aria-label={`${point.label}: ${money.format(point.value)}`} aria-describedby={active === index ? tipId : undefined} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onPointerEnter={() => setActive(index)} onClick={() => setActive(index)} data-current={index === period.points.length - 1}>
      <span className="mbc-track" data-signed={signed}><span className="mbc-bar" style={{ height: `${Math.max(4, Math.round(Math.abs(point.value) / max * (signed ? 56 : 72)))}px`, ...(signed ? point.value < 0 ? { top: "50%", bottom: "auto", borderRadius: "0 0 2px 2px" } : { bottom: "50%" } : {}) }} /></span>
      <SoftText className="mbc-axis" text={point.label} />
    </button>)}<div ref={tooltip} id={tipId} role="tooltip" className="mbc-tooltip" data-show="false" aria-hidden="true"><span ref={tooltipText}>{lastTooltip.current}</span></div></div>
    <div ref={tabs} className="mbc-periods" role="tablist" aria-label="Chart period"><span ref={pill} className="mbc-period-pill" aria-hidden="true" />{periods.map((item, index) => <button type="button" role="tab" key={item.id} aria-selected={period?.id === item.id} aria-controls={chartId} tabIndex={period?.id === item.id ? 0 : -1} onClick={() => selectPeriod(item)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (index + 1) % periods.length : event.key === "ArrowLeft" ? (index - 1 + periods.length) % periods.length : event.key === "Home" ? 0 : event.key === "End" ? periods.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); selectPeriod(periods[next]); tabs.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
    }}>{item.label}</button>)}</div>
  </section>;
}
const css = `
.mova-balance{--mbc-bg:#fff;--mbc-fg:#0d0d0d;--mbc-muted:#6c6c6c;--mbc-bar:rgba(28,95,251,.14);--mbc-bar-hover:rgba(28,95,251,.26);--mbc-bar-current:#1c5ffb;--mbc-chip:rgba(0,0,0,.04);--mbc-pill:#fff;--mbc-tip-bg:#fff;--mbc-tip-fg:#2f2f2f;--mbc-fill:#e7f9f3;--mbc-ink:#216e55;--mbc-ease:cubic-bezier(.22,1,.36,1);--mbc-press-dur:150ms;--mbc-chart-dur:400ms;--mbc-text-dur:200ms;--mbc-text-resize-dur:240ms;--mbc-tabs-dur:250ms;box-sizing:border-box;width:300px;max-width:100%;padding:24px;border-radius:24px;background:var(--mbc-bg);color:var(--mbc-fg);font:400 13px/20px 'Inter Variable',Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0;-webkit-font-smoothing:antialiased;box-shadow:0 0 0 1px #0000000a,0 8px 32px -4px #0000000f,0 1px 3px #0000000a}
.mova-balance[data-theme=dark]{--mbc-bg:#1d1d1d;--mbc-fg:#f2f2f2;--mbc-muted:rgba(202,202,202,.7);--mbc-bar:rgba(92,140,255,.22);--mbc-bar-hover:rgba(92,140,255,.36);--mbc-bar-current:#5c8cff;--mbc-chip:rgba(255,255,255,.07);--mbc-pill:rgba(255,255,255,.12);--mbc-tip-bg:#262626;--mbc-tip-fg:#f2f2f2;--mbc-fill:#12291f;--mbc-ink:#6fd3a8;color-scheme:dark;box-shadow:0 0 0 1px #ffffff0f,0 8px 32px -4px #0000004d,0 1px 3px #0003}
.mova-balance *{box-sizing:border-box}.mova-balance button{font:inherit;letter-spacing:inherit;margin:0;border:0;padding:0;background:none;color:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-touch-callout:none;transition:transform var(--mbc-press-dur) var(--mbc-ease)}.mova-balance button:is(:active,[data-pressed=true]){transform:scale(.97)}.mova-balance button:focus{outline:none}.mova-balance button:focus-visible{box-shadow:0 0 0 2px var(--mbc-bg),0 0 0 4px var(--mbc-fg)}
.mbc-label{font-size:13px;line-height:20px;color:var(--mbc-muted)}.mbc-summary{margin-top:16px;font-size:28px;line-height:34px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}.mbc-cents{color:var(--mbc-muted)}.mbc-change-row{margin-top:8px;display:flex;align-items:center;gap:8px;font-size:12px;line-height:16px;color:var(--mbc-muted);min-width:0}.mbc-detail{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}.mbc-change{flex:none;display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:50px;font-size:11px;line-height:16px;font-weight:500;background:var(--mbc-fill);color:var(--mbc-ink);font-variant-numeric:tabular-nums;box-shadow:0 1px 3px #0000000a,inset 0 0 0 1px color-mix(in srgb,var(--mbc-ink) 14%,transparent),inset 0 -1px 0 color-mix(in srgb,var(--mbc-ink) 10%,transparent)}.mbc-change[data-negative=true]{--mbc-fill:#fbe9e9;--mbc-ink:#ad3c3c}.mova-balance[data-theme=dark] .mbc-change[data-negative=true]{--mbc-fill:#4c2b2b;--mbc-ink:#ffaaaa}
.mbc-soft{display:inline-grid;justify-items:var(--mbc-text-align,start);transition:width var(--mbc-text-resize-dur) var(--mbc-ease)}.mbc-soft>span{grid-area:1/1;white-space:pre;transition:filter var(--mbc-text-dur) ease-in-out,opacity var(--mbc-text-dur) ease-in-out}.mbc-soft-new{opacity:0;filter:blur(2px)}.mbc-soft.is-swapping .mbc-soft-old{opacity:0;filter:blur(2px)}.mbc-soft.is-swapping .mbc-soft-new{opacity:1;filter:blur(0)}
.mbc-chart{display:flex;position:relative;width:100%;gap:4px;margin-top:16px}.mova-balance .mbc-column{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding-bottom:4px;border-radius:8px;cursor:default}.mbc-track{position:relative;height:112px;width:100%;display:flex;align-items:flex-end;justify-content:center}.mbc-track[data-signed=true]:after{content:"";position:absolute;top:50%;left:0;right:0;height:1px;background:#8885}.mbc-track[data-signed=true] .mbc-bar{position:absolute}.mbc-bar{display:block;width:100%;max-width:24px;border-radius:2px 2px 0 0;background:var(--mbc-bar);transition:height var(--mbc-chart-dur) var(--mbc-ease),background-color 150ms var(--mbc-ease)}.mbc-column:focus-visible .mbc-bar{background:var(--mbc-bar-hover)}@media(hover:hover) and (pointer:fine){.mbc-column:hover .mbc-bar{background:var(--mbc-bar-hover)}.mbc-periods button:not([aria-selected=true]):hover{color:var(--mbc-fg)}}.mbc-column[data-current=true] .mbc-bar{background:var(--mbc-bar-current)}.mbc-axis{font-size:12px;line-height:16px;color:var(--mbc-muted);--mbc-text-align:center}.mbc-column[data-current=true] .mbc-axis{color:var(--mbc-fg)}
.mbc-tooltip{position:absolute;top:0;left:0;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:0;max-width:100%;overflow:hidden;translate:var(--mbc-tip-x,0px) 0;scale:.98;transform-origin:50% 100%;padding:8px 12px;border-radius:8px;background:var(--mbc-tip-bg);color:var(--mbc-tip-fg);white-space:nowrap;box-shadow:0 0 0 1px #0000000f,0 2px 6px #0000000d,0 4px 42px #0000000f;opacity:0;pointer-events:none;font-size:12px;line-height:16px;font-variant-numeric:tabular-nums;transition:opacity 50ms ease-out,scale 50ms ease-out,translate 160ms var(--mbc-ease),width 160ms var(--mbc-ease)}.mbc-tooltip[data-show=true]{opacity:1;scale:1;transition:opacity 150ms ease-out 80ms,scale 150ms ease-out 80ms,translate 160ms var(--mbc-ease),width 160ms var(--mbc-ease)}.mova-balance[data-theme=dark] .mbc-tooltip{box-shadow:0 1px 3px #0000000a,inset 0 1px #ffffff0a,inset 0 0 0 1px #c4c4c414}
.mbc-periods{position:relative;display:flex;align-items:center;width:100%;gap:3px;background:var(--mbc-chip);padding:3px;border-radius:48px;margin-top:16px}.mova-balance .mbc-periods button{position:relative;flex:1;min-width:0;height:30px;padding:4px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:48px;font-size:13px;line-height:20px;font-weight:500;color:var(--mbc-muted);cursor:pointer;z-index:1;transition:color var(--mbc-tabs-dur) var(--mbc-ease),transform var(--mbc-press-dur) var(--mbc-ease)}.mbc-periods button[aria-selected=true]{color:var(--mbc-fg)}.mbc-period-pill{position:absolute;top:3px;left:0;height:30px;width:0;background:var(--mbc-pill);border-radius:48px;box-shadow:0 1px 3px #00000014,0 0 0 1px #0000000a;transform:translateX(0);transition:transform var(--mbc-tabs-dur) var(--mbc-ease),width var(--mbc-tabs-dur) var(--mbc-ease);will-change:transform,width;z-index:0;pointer-events:none}
@media(prefers-reduced-motion:reduce){.mova-balance *{animation:none!important;transition:none!important}.mova-balance button:is(:active,[data-pressed=true]){transform:none}}
`;
