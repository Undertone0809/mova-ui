"use client";

/** Original Mova implementation; visual reference documented in docs/provenance/interactive-cards.md. */
import * as React from "react";

export interface CalendarDayAttendee { name: string; image?: string; color?: string }
export interface CalendarDayEvent { id: string; title: string; time: string; location?: string; color?: string; attendees?: CalendarDayAttendee[] }
export interface CalendarDay { id: string; weekday: string; day: number; dateLabel: string; events: CalendarDayEvent[] }
export interface CalendarDayCardProps { days?: CalendarDay[]; defaultSelectedDay?: string; onDayChange?: (day: CalendarDay) => void; onEventClick?: (event: CalendarDayEvent) => void; theme?: "light" | "dark"; className?: string; style?: React.CSSProperties }

const portrait = (name: string, photo: string): CalendarDayAttendee => ({ name, image: `https://images.unsplash.com/${photo}?auto=format&fit=crop&q=80&w=48&h=48` });
const people = {
  leo: portrait("Leo Park", "photo-1500648767791-00dcc994a43e"),
  maya: portrait("Maya Chen", "photo-1534528741775-53994a69daeb"),
  tom: portrait("Tom Hale", "photo-1506794778202-cad84cf45f1d"),
  ana: portrait("Ana Ruiz", "photo-1438761681033-6461ffad8d80"),
  jade: portrait("Jade Wu", "photo-1580489944761-15a19d654956"),
  priya: portrait("Priya Nair", "photo-1544005313-94ddf0286df2"),
  sam: portrait("Sam Okafor", "photo-1570158268183-d296b2892211"),
  nina: portrait("Nina Brooks", "photo-1632765854612-9b02b6ec2b15"),
};
const defaultDays: CalendarDay[] = [
  { id: "11", weekday: "Monday", day: 11, dateLabel: "March 11", events: [
    { id: "0-0", title: "Weekly planning", time: "9:30 – 10:15", location: "Room 2", color: "#1C5FFB" },
    { id: "0-1", title: "Design critique", time: "14:00 – 15:00", location: "Studio", color: "#B01CFB", attendees: [people.maya, people.sam] },
  ] },
  { id: "12", weekday: "Tuesday", day: 12, dateLabel: "March 12", events: [
    { id: "1-0", title: "Roadmap review", time: "10:00 – 11:00", location: "Zoom", color: "#EF8121", attendees: [people.leo, people.ana, people.nina] },
    { id: "1-1", title: "Lunch with Priya", time: "13:30 – 14:30", location: "Café", color: "#1EBB26", attendees: [people.priya] },
    { id: "1-2", title: "Hiring sync", time: "16:00 – 16:30", location: "Room 4", color: "#1C5FFB" },
  ] },
  { id: "13", weekday: "Wednesday", day: 13, dateLabel: "March 13", events: [
    { id: "2-0", title: "Customer call", time: "11:00 – 11:30", location: "Zoom", color: "#EC4A4A", attendees: [people.tom, people.jade] },
    { id: "2-1", title: "Sprint demo", time: "15:00 – 16:00", location: "Studio", color: "#B01CFB" },
  ] },
  { id: "14", weekday: "Thursday", day: 14, dateLabel: "March 14", events: [
    { id: "3-0", title: "Standup", time: "9:00 – 9:15", location: "Zoom", color: "#1C5FFB" },
    { id: "3-1", title: "Product review", time: "11:30 – 12:30", location: "Room 2", color: "#B01CFB", attendees: [people.jade, people.leo, people.tom] },
    { id: "3-2", title: "1:1 with Maya", time: "16:00 – 16:30", location: "Café", color: "#1EBB26", attendees: [people.maya] },
  ] },
  { id: "15", weekday: "Friday", day: 15, dateLabel: "March 15", events: [
    { id: "4-0", title: "Retro", time: "10:00 – 10:45", location: "Studio", color: "#EF8121", attendees: [people.ana, people.sam, people.nina] },
    { id: "4-1", title: "Team drinks", time: "15:30 – 16:30", location: "Rooftop", color: "#1EBB26" },
  ] },
];

function SoftText({ text, className = "" }: { text: string; className?: string }) {
  const root = React.useRef<HTMLSpanElement>(null);
  const incoming = React.useRef<HTMLSpanElement>(null);
  const last = React.useRef(text);
  const [content, setContent] = React.useState({ old: "", next: text });
  const [swapping, setSwapping] = React.useState(false);
  const [width, setWidth] = React.useState<number>();
  React.useLayoutEffect(() => {
    if (last.current === text) return;
    const old = last.current;
    last.current = text;
    setWidth(root.current?.getBoundingClientRect().width);
    setSwapping(false);
    setContent({ old, next: text });
    const frame = requestAnimationFrame(() => {
      setWidth(incoming.current?.getBoundingClientRect().width);
      setSwapping(true);
    });
    const timer = setTimeout(() => { setContent({ old: "", next: text }); setWidth(undefined); setSwapping(false); }, 280);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [text]);
  return <span ref={root} className={`mcd-soft ${className}`} data-swapping={swapping} data-changing={!!content.old} style={{ width }}>
    {content.old && <span className="mcd-soft-old" aria-hidden="true">{content.old}</span>}
    <span ref={incoming} className="mcd-soft-new">{content.next}</span>
  </span>;
}

function Attendees({ people: attendees }: { people: CalendarDayAttendee[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  const [returning, setReturning] = React.useState(false);
  const shift = (index: number) => active === null ? 0 : -4 * Math.pow(.45, Math.abs(index - active));
  function activate(index: number) { setReturning(false); setActive(index); }
  function reset() { setReturning(true); setActive(null); }
  return <div className="mcd-attendees" role="group" aria-label={`Attendees: ${attendees.map(person => person.name).join(", ")}`} onMouseLeave={reset}>
    {attendees.map((person, index) => <span key={`${person.name}-${index}`} className="mcd-avatar" role="img" aria-label={person.name} tabIndex={0} onMouseEnter={() => activate(index)} onFocus={() => activate(index)} onBlur={reset} data-returning={returning} style={{ "--mcd-shift": `${shift(index)}px`, "--mcd-scale": active === index ? 1.05 : 1, "--mcd-cut-dy": `${index < attendees.length - 1 ? shift(index + 1) - shift(index) : 0}px`, "--mcd-avatar-color": person.color ?? "#c6b7d8" } as React.CSSProperties}>
      {person.image ? <img src={person.image} alt="" width={24} height={24} /> : <span className="mcd-initials" aria-hidden="true">{person.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</span>}
    </span>)}
  </div>;
}

export function CalendarDayCard({ days = defaultDays, defaultSelectedDay = "14", onDayChange, onEventClick, theme = "light", className = "", style }: CalendarDayCardProps = {}) {
  const [selected, setSelected] = React.useState(defaultSelectedDay);
  const currentIndex = Math.max(0, days.findIndex(day => day.id === selected));
  const current = days[currentIndex];
  const id = React.useId();
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const dayStrip = React.useRef<HTMLDivElement>(null);
  const measured = React.useRef(false);
  const [pill, setPill] = React.useState({ left: 0, width: 0, animate: false });
  React.useLayoutEffect(() => {
    const tab = tabs.current[currentIndex];
    if (tab) setPill({ left: tab.offsetLeft, width: tab.offsetWidth, animate: measured.current });
    measured.current = true;
  }, [currentIndex, days]);
  React.useLayoutEffect(() => {
    const measure = () => {
      const tab = dayStrip.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (tab) setPill({ left: tab.offsetLeft, width: tab.offsetWidth, animate: false });
    };
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    if (dayStrip.current) observer?.observe(dayStrip.current);
    return () => observer?.disconnect();
  }, [days.length]);
  const [pressedDay, setPressedDay] = React.useState<number | null>(null);
  const pressStart = React.useRef(0);
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(pressTimer.current), []);
  function startPress(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    if (event.pointerType === "mouse") return;
    clearTimeout(pressTimer.current);
    pressStart.current = performance.now();
    setPressedDay(index);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function endPress() {
    pressTimer.current = setTimeout(() => setPressedDay(null), Math.max(0, 150 - (performance.now() - pressStart.current)));
  }
  function select(index: number, focus = false) {
    const day = days[index];
    if (!day) return;
    if (focus) tabs.current[index]?.focus();
    if (current?.id === day.id) return;
    setSelected(day.id);
    onDayChange?.(day);
  }
  function handleKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % days.length : event.key === "ArrowLeft" ? (index - 1 + days.length) % days.length : event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : null;
    if (next !== null) { event.preventDefault(); select(next, true); }
  }
  return <section className={`mova-calendar ${className}`} data-theme={theme} style={style} aria-label="Calendar">
    <style>{css}</style>
    <header className="mcd-head"><h2><SoftText text={current?.weekday ?? "Your calendar"} /></h2><p className="mcd-meta" aria-live="polite" aria-atomic="true">{current ? <><SoftText text={current.dateLabel} /><span> · </span><SoftText text={String(current.events.length)} className="mcd-number" /><span>{current.events.length === 1 ? " meeting" : " meetings"}</span></> : "No days available"}</p></header>
    {!!days.length && <div ref={dayStrip} className="mcd-days" role="tablist" aria-label={`Week of ${days[0].dateLabel}`} style={{ "--mcd-count": days.length, "--mcd-index": currentIndex } as React.CSSProperties}>
      <span className="mcd-pill" aria-hidden="true" style={{ width: pill.width, transform: `translateX(${pill.left}px)`, transition: pill.animate ? undefined : "none" }} />
      {days.map((day, index) => <button type="button" role="tab" key={day.id} ref={element => { tabs.current[index] = element; }} id={`${id}-tab-${index}`} aria-selected={current?.id === day.id} aria-controls={`${id}-panel-${index}`} aria-label={`${day.weekday}, ${day.dateLabel}`} tabIndex={current?.id === day.id ? 0 : -1} data-pressed={pressedDay === index} onPointerDown={event => startPress(event, index)} onPointerUp={endPress} onPointerCancel={endPress} onKeyDown={event => handleKey(event, index)} onClick={() => select(index)}><span>{day.weekday.slice(0, 3)}</span><strong>{day.day}</strong></button>)}
    </div>}
    <div className="mcd-agenda">
      {days.map((day, index) => <section className="mcd-page" key={day.id} role="tabpanel" aria-label={`${day.weekday} meetings`} id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} aria-hidden={index !== currentIndex} inert={index !== currentIndex || undefined} data-active={index === currentIndex} style={{ "--mcd-side": index < currentIndex ? "-8px" : "8px" } as React.CSSProperties}>
        {day.events.length ? <ul>{day.events.map(event => <li className="mcd-event" key={event.id} style={{ "--mcd-event": event.color ?? "#1C5FFB" } as React.CSSProperties}>
          {onEventClick ? <button type="button" className="mcd-event-main" onClick={() => onEventClick(event)}><span className="mcd-event-line" aria-hidden="true" /><span className="mcd-event-text"><strong>{event.title}</strong><small><span>{event.time}</span>{event.location ? ` · ${event.location}` : ""}</small></span></button> : <div className="mcd-event-main"><span className="mcd-event-line" aria-hidden="true" /><span className="mcd-event-text"><strong>{event.title}</strong><small><span>{event.time}</span>{event.location ? ` · ${event.location}` : ""}</small></span></div>}
          {!!event.attendees?.length && <Attendees people={event.attendees} />}
        </li>)}</ul> : <p className="mcd-empty">Nothing scheduled. Enjoy your day.</p>}
      </section>)}
      {!current && <p className="mcd-empty">Nothing scheduled. Enjoy your day.</p>}
    </div>
  </section>;
}
const css = `
@property --mcd-cut-dy{syntax:'<length>';inherits:false;initial-value:0px}
.mova-calendar{--mcd-bg:#fff;--mcd-fg:#0d0d0d;--mcd-muted:#6c6c6c;--mcd-track:#0000000a;--mcd-hover:#0000000a;--mcd-pill:#fff;--mcd-tint:7%;--mcd-pill-shadow:0 0 0 1px #0000000f,0 2px 6px #0000000d,0 1px 2px #0000000a;--mcd-ease:cubic-bezier(.22,1,.36,1);width:300px;max-width:100%;box-sizing:border-box;padding:24px;border-radius:24px;color:var(--mcd-fg);background:var(--mcd-bg);font:400 13px/20px "Inter Variable",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0;font-optical-sizing:auto;font-feature-settings:'liga' 1,'calt' 1;-webkit-font-smoothing:antialiased;box-shadow:0 0 0 1px #0000000a,0 8px 32px -4px #0000000f,0 1px 3px #0000000a;display:flex;flex-direction:column;gap:16px}.mova-calendar[data-theme=dark]{--mcd-bg:#1d1d1d;--mcd-fg:#f2f2f2;--mcd-muted:rgba(202,202,202,.7);--mcd-track:#ffffff0a;--mcd-hover:rgba(255,255,255,.065);--mcd-pill:#ffffff1a;--mcd-tint:14%;--mcd-pill-shadow:0 1px 3px #0000003d,inset 0 0 0 1px #ffffff0f,inset 0 1px 0 #ffffff0f;color-scheme:dark}.mova-calendar *{box-sizing:border-box}.mova-calendar h2,.mova-calendar p,.mova-calendar ul{margin:0;padding:0}.mova-calendar button{font:inherit;letter-spacing:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}.mova-calendar button:focus-visible,.mcd-avatar:focus-visible{outline:2px solid var(--mcd-fg);outline-offset:2px}.mcd-head{display:flex;flex-direction:column;gap:4px}.mova-calendar h2{font-size:28px;line-height:34px;font-weight:500}.mcd-meta{display:flex;white-space:pre;font-size:12px;line-height:16px;color:var(--mcd-muted)}.mcd-number,.mcd-event small span{font-variant-numeric:tabular-nums}.mcd-soft{display:inline-grid;justify-items:start;transition:width 240ms var(--mcd-ease)}.mcd-soft>span{grid-area:1/1;white-space:pre;transition:filter 200ms ease-in-out,opacity 200ms ease-in-out}.mcd-soft[data-changing=true] .mcd-soft-new{opacity:0;filter:blur(2px)}.mcd-soft[data-swapping=true] .mcd-soft-old{opacity:0;filter:blur(2px)}.mcd-soft[data-swapping=true] .mcd-soft-new{opacity:1;filter:blur(0)}.mcd-days{position:relative;display:flex;align-items:center;gap:2px;padding:4px;border-radius:16px;background:var(--mcd-track)}.mcd-days button{position:relative;flex:1;min-width:0;height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:12px;z-index:1;transition:color 250ms var(--mcd-ease),background-color 250ms var(--mcd-ease),transform 150ms var(--mcd-ease)}.mcd-days button>span{font-size:12px;line-height:16px;color:var(--mcd-muted)}.mcd-days strong{font-size:15px;line-height:20px;font-weight:400;font-variant-numeric:tabular-nums}.mcd-days button:is(:active,[data-pressed=true]){transform:scale(.95)}.mcd-days button:focus-visible{outline:none;box-shadow:0 0 0 2px var(--mcd-bg),0 0 0 4px var(--mcd-fg)}.mcd-pill{position:absolute;top:4px;left:0;height:52px;background:var(--mcd-pill);box-shadow:var(--mcd-pill-shadow);border-radius:12px;transition:transform 250ms var(--mcd-ease),width 250ms var(--mcd-ease);pointer-events:none}.mcd-agenda{display:grid;position:relative}.mcd-page{grid-area:1/1;min-width:0;opacity:0;pointer-events:none;transform:translateX(var(--mcd-side));filter:blur(3px);transition:opacity 250ms var(--mcd-ease),transform 250ms var(--mcd-ease),filter 250ms var(--mcd-ease)}.mcd-page[data-active=true]{opacity:1;pointer-events:auto;transform:translateX(0);filter:blur(0)}.mcd-page ul{list-style:none;display:flex;flex-direction:column;gap:8px}.mcd-event{display:flex;align-items:center;gap:12px;padding:8px 12px 8px 8px;border-radius:12px;background:color-mix(in srgb,var(--mcd-event) var(--mcd-tint),transparent)}.mcd-event-main{flex:1;min-width:0;display:flex;align-self:stretch;align-items:center;gap:12px;text-align:left;border-radius:4px}.mcd-event-line{flex:none;align-self:stretch;width:3px;border-radius:2px;background:var(--mcd-event)}.mcd-event-text{min-width:0;flex:1}.mcd-event strong{display:block;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mcd-event small{display:block;font-size:12px;line-height:16px;color:var(--mcd-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mcd-attendees{display:flex;align-items:center;flex:none;align-self:center}.mcd-avatar{display:flex;flex:none;width:24px;height:24px;border-radius:50%;transform-origin:center;transform:translateY(var(--mcd-shift,0px)) scale(var(--mcd-scale,1));transition:transform 320ms var(--mcd-ease),--mcd-cut-dy 320ms var(--mcd-ease)}.mcd-avatar[data-returning=true]{transition-timing-function:cubic-bezier(.34,3.85,.64,1)}.mcd-avatar+.mcd-avatar{margin-left:-6px}.mcd-avatar:not(:last-child){-webkit-mask:radial-gradient(58.333% 58.333% at 125% calc(50% + var(--mcd-cut-dy)),transparent calc(100% - .5px),#000 calc(100% + .5px));mask:radial-gradient(58.333% 58.333% at 125% calc(50% + var(--mcd-cut-dy)),transparent calc(100% - .5px),#000 calc(100% + .5px))}.mcd-avatar img{display:block;width:24px;height:24px;border-radius:50%;object-fit:cover;outline:1px solid #00000014;outline-offset:-1px}.mova-calendar[data-theme=dark] .mcd-avatar img{outline-color:#ffffff14}.mcd-initials{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;font-size:10px;line-height:1;background:var(--mcd-avatar-color);color:#25212b}.mcd-empty{font-size:12px;color:var(--mcd-muted);padding:8px 0!important;min-height:52px}@media(hover:hover) and (pointer:fine){.mcd-days button:not([aria-selected=true]):hover{background:var(--mcd-hover)}}@media(prefers-reduced-motion:reduce){.mova-calendar *{animation:none!important;transition:none!important}.mcd-days button:is(:active,[data-pressed=true]),.mcd-avatar{transform:none!important}.mcd-page{transform:none;filter:none}}
`;
