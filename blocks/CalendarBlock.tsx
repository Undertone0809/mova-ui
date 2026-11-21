import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlignLeft, Bell, CalendarDays, CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Diamond, Focus, GripVertical, Plus, Trash2, Video, X } from 'lucide-react';
import './blocks-shared.css';
import './calendar-block.css';

type EventKind = 'focus' | 'meeting' | 'deadline';
type CalendarTab = 'today' | 'week' | 'new';
type CalendarEvent = { id: string; title: string; date: string; start: number; end: number; kind: EventKind; reminder: string };
type EventDraft = { title: string; date: string; start: string; end: string; kind: EventKind; reminder: string };
const DEMO_DATE = '2026-10-01';
const FIRST_HOUR = 9 * 60;
const LAST_HOUR = 18 * 60;
const HOUR_HEIGHT = 52;
const DAY_HEIGHT = 9 * HOUR_HEIGHT;
const KIND_NAMES: Record<EventKind, string> = { focus: 'Focus', meeting: 'Meeting', deadline: 'Deadline' };
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dateObject(date: string) { return new Date(`${date}T12:00:00Z`); }
function dateString(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(date: string, days: number) { const next = dateObject(date); next.setUTCDate(next.getUTCDate() + days); return dateString(next); }
function mondayOf(date: string) { const weekday = dateObject(date).getUTCDay(); return addDays(date, -((weekday + 6) % 7)); }
function dateLabel(date: string, options: Intl.DateTimeFormatOptions) { return dateObject(date).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' }); }
function timeLabel(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
function timeValue(value: string) { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes; }
function durationLabel(minutes: number) { const hours = Math.floor(minutes / 60); const rest = minutes % 60; return [hours ? `${hours}h` : '', rest ? `${rest}m` : ''].filter(Boolean).join(' ') || '0h'; }
function toDraft(event: CalendarEvent): EventDraft { return { ...event, start: timeLabel(event.start), end: timeLabel(event.end) }; }
function initialDraft(): EventDraft { return { title: 'Review with Jamie', date: '2026-10-02', start: '15:00', end: '16:00', kind: 'meeting', reminder: '10' }; }
function createSeedEvents(): CalendarEvent[] {
  const event = (id: string, date: string, title: string, start: number, end: number, kind: EventKind): CalendarEvent => ({ id, date, title, start, end, kind, reminder: '10' });
  return [
    event('thu-home', DEMO_DATE, 'Atlas · Homepage', 540, 630, 'focus'),
    event('thu-jamie', DEMO_DATE, 'Sync with Jamie', 645, 690, 'meeting'),
    event('thu-interaction', DEMO_DATE, 'Atlas · Interaction', 780, 870, 'focus'),
    event('thu-morgan', DEMO_DATE, 'Review with Morgan', 900, 960, 'meeting'),
    event('thu-deadline', DEMO_DATE, 'Atlas first draft', 1050, 1065, 'deadline'),
    event('mon-1', '2026-09-28', 'Website exploration', 540, 675, 'focus'),
    event('mon-2', '2026-09-28', 'Weekly planning', 690, 750, 'meeting'),
    event('mon-3', '2026-09-28', 'Design system', 810, 960, 'focus'),
    event('tue-1', '2026-09-29', 'Product research', 540, 690, 'focus'),
    event('tue-2', '2026-09-29', 'Project kickoff', 705, 765, 'meeting'),
    event('tue-3', '2026-09-29', 'Prototype', 780, 930, 'focus'),
    event('tue-4', '2026-09-29', 'Team check-in', 960, 1005, 'meeting'),
    event('wed-1', '2026-09-30', 'Refine the details', 570, 690, 'focus'),
    event('wed-2', '2026-09-30', 'Review with Alex', 810, 900, 'meeting'),
    event('fri-1', '2026-10-02', 'Plan next week', 600, 690, 'focus'),
    event('fri-2', '2026-10-02', 'Creative review', 780, 840, 'meeting'),
    event('fri-3', '2026-10-02', 'Send weekly notes', 1035, 1050, 'deadline'),
    event('sat-1', '2026-10-03', 'A little side project', 600, 690, 'focus'),
  ];
}
function freeGaps(events: CalendarEvent[]) {
  // A deadline divides free time without reserving any minutes itself.
  const ranges = events.map(event => ({ start: event.start, end: event.kind === 'deadline' ? event.start : event.end })).sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = [];
  let cursor = FIRST_HOUR;
  for (const event of ranges) {
    if (event.start > cursor) gaps.push({ start: cursor, end: Math.min(event.start, LAST_HOUR) });
    cursor = Math.max(cursor, event.end);
  }
  if (cursor < LAST_HOUR) gaps.push({ start: cursor, end: LAST_HOUR });
  return gaps.filter(gap => gap.start < LAST_HOUR && gap.end > gap.start);
}
function scheduledMinutes(events: CalendarEvent[]) { return LAST_HOUR - FIRST_HOUR - freeGaps(events).reduce((total, gap) => total + gap.end - gap.start, 0); }
function parsePhrase(phrase: string, previous: EventDraft): EventDraft {
  const lower = phrase.toLowerCase();
  let date = previous.date;
  if (/\btoday\b/.test(lower)) date = DEMO_DATE;
  if (/\btomorrow\b/.test(lower)) date = addDays(DEMO_DATE, 1);
  const weekday = DAY_NAMES.findIndex(name => lower.includes(name.toLowerCase()));
  if (weekday !== -1) {
    let offset = (weekday - dateObject(DEMO_DATE).getUTCDay() + 7) % 7;
    if (/\bnext\b/.test(lower) && offset === 0) offset = 7;
    date = addDays(DEMO_DATE, offset);
  }
  let start = /\bafternoon\b/.test(lower) ? 900 : /\bmorning\b/.test(lower) ? 600 : /\bnoon\b/.test(lower) ? 720 : /\bevening\b/.test(lower) ? 1020 : timeValue(previous.start);
  const explicitTime = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || lower.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/);
  if (explicitTime) {
    let hours = Number(explicitTime[1]);
    const minutes = Number(explicitTime[2] || 0);
    if (explicitTime[3]) hours = hours % 12 + (explicitTime[3] === 'pm' ? 12 : 0);
    if (hours <= 23 && minutes <= 59) start = hours * 60 + minutes;
  }
  const duration = lower.match(/(?:for\s+)?(\d+(?:\.\d+)?|one|two|half|an?|a half)\s*(hours?|hrs?|minutes?|mins?)\b/);
  let length = 60;
  if (duration) {
    const quantity = ({ one: 1, two: 2, half: 0.5, an: 1, a: 1, 'a half': 0.5 } as Record<string, number>)[duration[1]] ?? Number(duration[1]);
    length = quantity * (duration[2].startsWith('h') ? 60 : 1);
  }
  const title = phrase.replace(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/gi, '')
    .replace(/\b(in the\s+|at\s+)?(morning|afternoon|evening|noon)\b/gi, '')
    .replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/\b(?:at\s+)?\d{1,2}:\d{2}\b/g, '')
    .replace(/\b(?:for\s+)?(\d+(?:\.\d+)?|one|two|half|an?|a half)\s*(hours?|hrs?|minutes?|mins?)\b/gi, '').replace(/\s+/g, ' ').trim();
  return { ...previous, title: title ? title.charAt(0).toUpperCase() + title.slice(1) : previous.title, date, start: timeLabel(Math.min(start, 1410)), end: timeLabel(Math.min(start + Math.max(15, length), 1439)), kind: /\b(deadline|due|submit)\b/.test(lower) ? 'deadline' : /\b(focus|write|design|build)\b/.test(lower) ? 'focus' : 'meeting' };
}

/** Site-only, entirely local calendar composition. It is not a Library component. */
export function CalendarBlock({ thumbnail = false }: { thumbnail?: boolean }) {
  const [events, setEvents] = useState(createSeedEvents);
  const [tab, setTab] = useState<CalendarTab>('today');
  const [selectedDate, setSelectedDate] = useState(DEMO_DATE);
  const [weekStart, setWeekStart] = useState(mondayOf(DEMO_DATE));
  const [draft, setDraft] = useState<EventDraft>(initialDraft);
  const [phrase, setPhrase] = useState('Friday afternoon\nReview with Jamie for one hour');
  const [phraseParsed, setPhraseParsed] = useState(true);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [editDraft, setEditDraft] = useState<EventDraft>(initialDraft);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ event: CalendarEvent; y: number; moved: boolean; scale: number } | null>(null);
  const suppressClickRef = useRef(false);
  const nextId = useRef(1);
  const id = useId();
  const dayEvents = useMemo(() => events.filter(event => event.date === selectedDate).sort((a, b) => a.start - b.start), [events, selectedDate]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const occupied = scheduledMinutes(dayEvents);
  const gaps = freeGaps(dayEvents);
  // Leave visual space for the deadline marker, but keep the entire gap available.
  const visualGaps = gaps.map(gap => ({ ...gap, displayStart: gap.start + (dayEvents.some(event => event.kind === 'deadline' && event.start === gap.start) ? 30 : 0) })).filter(gap => gap.end - gap.displayStart >= 30);
  const longestGap = gaps.filter(gap => gap.end - gap.start >= 30).reduce<{ start: number; end: number } | null>((longest, gap) => !longest || gap.end - gap.start >= longest.end - longest.start ? gap : longest, null);
  const upcoming = dayEvents.filter(event => selectedDate !== DEMO_DATE || event.start >= 702);

  useEffect(() => {
    if (!editing || thumbnail) return;
    const firstInput = sheetRef.current?.querySelector<HTMLInputElement>('input');
    firstInput?.focus();
    return () => { const target = returnFocusRef.current; if (target?.isConnected) target.focus(); else newButtonRef.current?.focus(); };
  }, [editing?.id, thumbnail]);

  function navigate(next: CalendarTab) {
    if (thumbnail) return;
    setTab(next); setMenuOpen(false); setError('');
    if (next === 'today') { setSelectedDate(DEMO_DATE); setWeekStart(mondayOf(DEMO_DATE)); }
    if (next === 'new') { setDraft(initialDraft()); setPhrase('Friday afternoon\nReview with Jamie for one hour'); setPhraseParsed(true); }
  }
  function startNew(start: number, end: number, date = selectedDate) {
    if (thumbnail) return;
    setDraft({ title: '', date, start: timeLabel(start), end: timeLabel(Math.min(end, start + 60)), kind: 'focus', reminder: '10' });
    setPhrase(''); setPhraseParsed(false); setError(''); setTab('new');
  }
  function openEvent(event: CalendarEvent) {
    if (thumbnail) return;
    returnFocusRef.current = document.activeElement as HTMLElement;
    setEditing(event); setEditDraft(toDraft(event)); setError('');
  }
  function validate(value: EventDraft) {
    if (!value.title.trim()) return 'Give your event a name.';
    if (!value.date || !value.start || !value.end) return 'Choose a date, start time, and end time.';
    if (!Number.isFinite(timeValue(value.start)) || !Number.isFinite(timeValue(value.end)) || timeValue(value.end) <= timeValue(value.start)) return 'End time must be after start time.';
    if (timeValue(value.start) < FIRST_HOUR || timeValue(value.end) > LAST_HOUR) return 'This demo schedules events between 09:00 and 18:00.';
    return '';
  }
  function saveEvent(value: EventDraft, existingId?: string) {
    const validation = validate(value);
    if (validation) { setError(validation); return; }
    const saved: CalendarEvent = { ...value, title: value.title.trim(), id: existingId || `added-${nextId.current++}`, start: timeValue(value.start), end: timeValue(value.end) };
    setEvents(current => existingId ? current.map(event => event.id === existingId ? saved : event) : [...current, saved]);
    setSelectedDate(saved.date); setWeekStart(mondayOf(saved.date)); setTab('today'); setEditing(null); setError('');
    setNotice(`${saved.title} ${existingId ? 'updated' : 'added'} at ${timeLabel(saved.start)}.`);
  }
  function moveEvent(event: CalendarEvent, start: number) {
    const duration = event.end - event.start;
    const clamped = Math.max(FIRST_HOUR, Math.min(LAST_HOUR - duration, start));
    setEvents(current => current.map(item => item.id === event.id ? { ...item, start: clamped, end: clamped + duration } : item));
    return clamped;
  }
  function onEventKeyDown(keyEvent: React.KeyboardEvent<HTMLButtonElement>, event: CalendarEvent) {
    if (keyEvent.key !== 'ArrowUp' && keyEvent.key !== 'ArrowDown') return;
    keyEvent.preventDefault();
    const start = moveEvent(event, event.start + (keyEvent.key === 'ArrowUp' ? -15 : 15));
    setNotice(`${event.title} moved to ${timeLabel(start)}.`);
  }
  function onPointerDown(pointer: React.PointerEvent<HTMLButtonElement>, event: CalendarEvent) {
    if (thumbnail || pointer.button !== 0) return;
    suppressClickRef.current = false;
    dragRef.current = { event: { ...event }, y: pointer.clientY, moved: false, scale: (plotRef.current?.getBoundingClientRect().height || DAY_HEIGHT) / DAY_HEIGHT };
    pointer.currentTarget.setPointerCapture(pointer.pointerId);
  }
  function onPointerMove(pointer: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const difference = (pointer.clientY - drag.y) / drag.scale;
    if (!drag.moved && Math.abs(difference) < 5) return;
    drag.moved = true; setDraggingId(drag.event.id);
    moveEvent(drag.event, drag.event.start + Math.round(difference / HOUR_HEIGHT * 60 / 15) * 15);
  }
  function onPointerUp(pointer: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.moved) {
      suppressClickRef.current = true;
      const difference = (pointer.clientY - drag.y) / drag.scale;
      const start = moveEvent(drag.event, drag.event.start + Math.round(difference / HOUR_HEIGHT * 60 / 15) * 15);
      setNotice(`${drag.event.title} moved to ${timeLabel(start)}.`);
    }
    dragRef.current = null; setDraggingId(null);
    if (pointer.currentTarget.hasPointerCapture(pointer.pointerId)) pointer.currentTarget.releasePointerCapture(pointer.pointerId);
  }
  function onPointerCancel() {
    if (dragRef.current?.moved) moveEvent(dragRef.current.event, dragRef.current.event.start);
    dragRef.current = null; setDraggingId(null); suppressClickRef.current = true;
  }
  function renderKinds(value: EventDraft, update: (draft: EventDraft) => void) {
    return <div className="cal-kinds" role="group" aria-label="Event type">{(['focus', 'meeting', 'deadline'] as EventKind[]).map(kind => {
      const Icon = kind === 'focus' ? Focus : kind === 'meeting' ? Video : Diamond;
      return <button key={kind} type="button" className={`cal-kind ${kind} ${value.kind === kind ? 'is-selected' : ''}`} aria-pressed={value.kind === kind} onClick={() => update({ ...value, kind })}><Icon size={15} />{KIND_NAMES[kind]}</button>;
    })}</div>;
  }
  function renderFields(value: EventDraft, update: (draft: EventDraft) => void, prefix: string) {
    return <>
      <label className="cal-name-label" htmlFor={`${id}-${prefix}-name`}>Name</label>
      <input id={`${id}-${prefix}-name`} className="cal-name-input" value={value.title} maxLength={80} placeholder="What are you planning?" onChange={event => update({ ...value, title: event.target.value })} required />
      {renderKinds(value, update)}
      <div className="cal-form-row"><CalendarDays size={17} /><label htmlFor={`${id}-${prefix}-date`}>Date</label><input id={`${id}-${prefix}-date`} type="date" value={value.date} onChange={event => update({ ...value, date: event.target.value })} required /></div>
      <div className="cal-form-row cal-time-row"><Clock3 size={17} /><span>Time</span><div className="cal-time-fields"><input aria-label="Start time" type="time" min="09:00" max="17:45" step="900" value={value.start} onChange={event => update({ ...value, start: event.target.value })} required /><span aria-hidden="true">–</span><input aria-label="End time" type="time" min="09:15" max="18:00" step="900" value={value.end} onChange={event => update({ ...value, end: event.target.value })} required /></div></div>
      <div className="cal-form-row"><Bell size={17} /><label htmlFor={`${id}-${prefix}-reminder`}>Reminder</label><div className="cal-select-wrap"><select id={`${id}-${prefix}-reminder`} value={value.reminder} onChange={event => update({ ...value, reminder: event.target.value })}><option value="0">At start time</option><option value="5">5 minutes before</option><option value="10">10 minutes before</option><option value="30">30 minutes before</option><option value="none">No reminder</option></select><ChevronDown size={12} /></div></div>
    </>;
  }
  return <div className={`cal-app ${thumbnail ? 'cal-thumbnail' : ''}`} ref={appRef} lang="en" aria-label="Cadence calendar demo">
    <div className="cal-app-content" inert={thumbnail || !!editing} aria-hidden={editing ? true : undefined}>
      {tab !== 'new' ? <>
        <header className="cal-topbar">
          <button className="cal-wordmark" onClick={() => setMenuOpen(current => !current)} aria-label="Calendar menu" aria-expanded={menuOpen}><AlignLeft size={22} strokeWidth={1.8} /><span>cadence</span></button>
          <div className="cal-profile"><span className="cal-avatar">A</span><span>Alex</span></div>
          {menuOpen && <nav className="cal-menu" aria-label="Calendar views"><button onClick={() => navigate('today')}><CalendarDays size={16} />Today</button><button onClick={() => navigate('week')}><CalendarRange size={16} />This week</button><button onClick={() => navigate('new')}><Plus size={16} />New event</button></nav>}
        </header>
        {tab === 'today' ? <main className="cal-today">
          <div className="cal-day-heading"><div><p>{dateLabel(selectedDate, { month: 'long', year: 'numeric' })}</p><h2>{selectedDate === DEMO_DATE ? 'Today' : dateLabel(selectedDate, { month: 'short', day: 'numeric' })}<span>{dateLabel(selectedDate, { weekday: 'long' })}</span></h2></div><span className="cal-date-number">{dateLabel(selectedDate, { day: '2-digit' })}</span></div>
          <div className="cal-week-strip" aria-label="Select a day">{days.map(date => <button key={date} className={`cal-strip-day ${date === selectedDate ? 'is-selected' : ''}`} aria-pressed={date === selectedDate} aria-label={dateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' })} onClick={() => setSelectedDate(date)}><span>{dateLabel(date, { weekday: 'short' })}</span><strong>{dateObject(date).getUTCDate()}</strong><span className="cal-day-dots" aria-hidden="true">{events.filter(event => event.date === date).slice(0, 3).map(event => <i className={event.kind} key={event.id} />)}</span></button>)}</div>
          <div className="cal-day-summary"><span>{durationLabel(occupied)} planned</span><strong>{durationLabel(LAST_HOUR - FIRST_HOUR - occupied)} available</strong></div>
          <div className="cal-timeline"><div className="cal-hour-labels" aria-hidden="true">{Array.from({ length: 10 }, (_, hour) => <span key={hour} style={{ top: hour * HOUR_HEIGHT }}>{timeLabel(FIRST_HOUR + hour * 60)}</span>)}</div><div className="cal-time-plot" ref={plotRef}>
            {Array.from({ length: 10 }, (_, hour) => <div className="cal-hour-line" key={hour} style={{ top: hour * HOUR_HEIGHT }} />)}
            {visualGaps.map(gap => <button key={gap.start} className={`cal-gap ${gap.end - gap.displayStart >= 60 ? 'cal-gap-large' : ''}`} style={{ top: (gap.displayStart - FIRST_HOUR) / 60 * HOUR_HEIGHT + 4, height: (gap.end - gap.displayStart) / 60 * HOUR_HEIGHT - 8 }} onClick={() => startNew(gap.start, gap.end)} aria-label={`Schedule in free time from ${timeLabel(gap.start)} to ${timeLabel(gap.end)}`}><span>{gap.start === 690 ? 'Lunch break' : 'Free time'} · <strong>{durationLabel(gap.end - gap.start)}</strong></span><span className="cal-gap-add"><Plus size={16} />{gap.end - gap.displayStart >= 60 && 'Add an event'}</span></button>)}
            {dayEvents.map(event => <button key={event.id} type="button" className={`cal-event ${event.kind} ${event.end - event.start <= 45 ? 'cal-event-compact' : ''} ${draggingId === event.id ? 'is-dragging' : ''}`} style={{ top: (event.start - FIRST_HOUR) / 60 * HOUR_HEIGHT + 2, height: event.kind === 'deadline' ? 24 : Math.max(22, (event.end - event.start) / 60 * HOUR_HEIGHT - 4) }} aria-label={`${event.title}, ${timeLabel(event.start)}${event.kind !== 'deadline' ? ` to ${timeLabel(event.end)}` : ' deadline'}. Press Enter to edit; use up and down arrow keys to move by 15 minutes.`} onKeyDown={keyEvent => onEventKeyDown(keyEvent, event)} onPointerDown={pointer => onPointerDown(pointer, event)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } openEvent(event); }}>
              {event.kind === 'deadline' && <Diamond className="cal-deadline-icon" size={10} fill="currentColor" />}<strong>{event.title}</strong><span className="cal-event-time">{timeLabel(event.start)}{event.kind === 'deadline' ? ' due' : <> – {timeLabel(event.end)}{event.end - event.start > 45 && ` · ${KIND_NAMES[event.kind]}`}</>}</span>{event.kind !== 'deadline' && event.end - event.start > 45 && <GripVertical size={13} className="cal-drag-grip" aria-hidden="true" />}
            </button>)}
            {selectedDate === DEMO_DATE && <div className="cal-now-line" style={{ top: (702 - FIRST_HOUR) / 60 * HOUR_HEIGHT }} aria-label="Demo time: 11:42 AM"><span>11:42</span><i /></div>}
          </div></div>
        </main> : <main className="cal-week">
          <div className="cal-week-heading"><div><h2>This week</h2><p>{dateLabel(weekStart, { month: 'short', day: 'numeric' })} – {dateLabel(addDays(weekStart, 6), { month: 'short', day: 'numeric' })}</p></div><div className="cal-week-arrows"><button aria-label="Previous week" onClick={() => { setWeekStart(addDays(weekStart, -7)); setSelectedDate(addDays(selectedDate, -7)); }}><ChevronLeft size={21} /></button><button aria-label="Next week" onClick={() => { setWeekStart(addDays(weekStart, 7)); setSelectedDate(addDays(selectedDate, 7)); }}><ChevronRight size={21} /></button></div></div>
          <div className="cal-week-grid"><div className="cal-week-hours" aria-hidden="true">{[9, 12, 15, 18].map(hour => <span key={hour} style={{ top: 60 + (hour - 9) * 26 }}>{String(hour).padStart(2, '0')}</span>)}<span className="cal-week-planned">Plan</span></div>{days.map(date => {
            const schedule = events.filter(event => event.date === date);
            return <div className={`cal-week-column ${selectedDate === date ? 'is-selected' : ''}`} key={date}><button className="cal-week-day" onClick={() => setSelectedDate(date)} aria-label={`Show ${dateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' })}`} aria-pressed={selectedDate === date}><span>{dateLabel(date, { weekday: 'short' })}</span><strong>{dateObject(date).getUTCDate()}</strong></button><div className="cal-week-day-plot" aria-label={`${dateLabel(date, { weekday: 'long' })} schedule`}>{Array.from({ length: 10 }, (_, index) => <i className="cal-week-gridline" key={index} style={{ top: index * 26 }} />)}{schedule.map(event => <button key={event.id} className={`cal-week-event ${event.kind}`} style={{ top: (event.start - FIRST_HOUR) / 60 * 26 + 1, height: event.kind === 'deadline' ? 8 : Math.max(5, (event.end - event.start) / 60 * 26 - 3) }} aria-label={`${event.title}, ${timeLabel(event.start)}. Edit event`} onClick={() => openEvent(event)}>{event.kind === 'deadline' && <Diamond size={7} fill="currentColor" />}</button>)}</div><span className="cal-week-total">{durationLabel(scheduledMinutes(schedule))}</span></div>;
          })}</div>
          <div className="cal-week-legend"><span><i className="focus" />Focus</span><span><i className="meeting" />Meeting</span><span><Diamond size={7} fill="currentColor" />Deadline</span></div>
          <section className="cal-upcoming"><div className="cal-section-heading"><h3>{dateLabel(selectedDate, { weekday: 'short' })} · Up next</h3><button onClick={() => setTab('today')}>View day<ChevronRight size={13} /></button></div><div className="cal-upcoming-events">{upcoming.length ? upcoming.slice(0, 3).map(event => <button key={event.id} onClick={() => openEvent(event)} className="cal-upcoming-row"><time>{timeLabel(event.start)}</time><i className={event.kind} /><span>{event.title}</span><ChevronRight size={15} /></button>) : <p className="cal-empty">A little room to breathe. Your day is clear.</p>}</div>{longestGap && <button className="cal-longest-gap" onClick={() => startNew(longestGap.start, longestGap.end)}><span><strong>Longest break · {durationLabel(longestGap.end - longestGap.start)}</strong><small>{timeLabel(longestGap.start)} – {timeLabel(longestGap.end)} · Make room for focus</small></span><Plus size={23} /></button>}</section>
        </main>}
        <nav className="cal-bottom-nav" aria-label="Calendar navigation"><button className={`cal-nav-tab ${tab === 'today' ? 'is-active' : ''}`} onClick={() => navigate('today')} aria-current={tab === 'today' ? 'page' : undefined}><CalendarDays size={17} />Today</button><button className={`cal-nav-tab ${tab === 'week' ? 'is-active' : ''}`} onClick={() => navigate('week')} aria-current={tab === 'week' ? 'page' : undefined}><CalendarRange size={17} />Week</button><button className="cal-new-button" onClick={() => navigate('new')} ref={newButtonRef}><Plus size={19} />New event</button></nav>
      </> : <>
        <header className="cal-new-header"><button aria-label="Cancel new event" onClick={() => { setTab('today'); setError(''); }}><X size={20} /></button><h2>New event</h2></header>
        <section className="cal-phrase-panel"><label htmlFor={`${id}-phrase`}><AlignLeft size={14} />Plan it in a sentence</label><textarea id={`${id}-phrase`} aria-describedby={`${id}-phrase-help`} value={phrase} placeholder={'Friday at 3pm\nReview with Jamie for one hour'} maxLength={200} onChange={event => { setPhrase(event.target.value); setPhraseParsed(false); }} /><div className="cal-phrase-footer"><span id={`${id}-phrase-help`}>{phraseParsed ? <><Check size={13} />Suggested {draft.start}–{draft.end}</> : 'Try a day, time, and duration'}</span><button disabled={!phrase.trim()} onClick={() => { setDraft(parsePhrase(phrase, draft)); setPhraseParsed(true); setError(''); }}>{phraseParsed ? 'Parse again' : 'Use suggestion'}</button></div></section>
        <form className="cal-new-form" onSubmit={event => { event.preventDefault(); saveEvent(draft); }} noValidate><h3>Event details</h3>{renderFields(draft, setDraft, 'new')}<div className="cal-availability"><div><span>{draft.date ? dateLabel(draft.date, { weekday: 'long' }) : 'Choose a date'}</span><span>{events.some(event => event.date === draft.date && event.kind !== 'deadline' && event.start < timeValue(draft.end) && event.end > timeValue(draft.start)) ? 'Overlaps another event' : <><Check size={13} />This time is free</>}</span></div><div className="cal-availability-track"><span className={draft.kind}>{durationLabel(Math.max(0, timeValue(draft.end) - timeValue(draft.start)))}</span></div><div className="cal-availability-times"><span>{timeLabel(Math.max(0, timeValue(draft.start) - 60))}</span><span>{draft.start}</span><span>{timeLabel(Math.min(1439, timeValue(draft.end) + 60))}</span></div></div><p className="cal-form-error" role="alert">{error}</p><button className="cal-submit" type="submit">Add event<Plus size={19} /></button><p className="cal-local-note">Demo only · Changes stay in this preview</p></form>
      </>}
    </div>
    <p className="cal-sr-only" role="status" aria-live="polite">{notice}</p>
    {editing && <div className="cal-sheet-backdrop" onClick={() => { setEditing(null); setError(''); }}><div className="cal-edit-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-edit-heading`} onClick={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); setEditing(null); setError(''); }
      if (event.key === 'Tab') { const focusable = sheetRef.current?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]'); if (!focusable?.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    }}><div className="cal-sheet-handle" /><div className="cal-sheet-heading"><h2 id={`${id}-edit-heading`}>Edit event</h2><button aria-label="Close event details" onClick={() => { setEditing(null); setError(''); }}><X size={19} /></button></div><form onSubmit={event => { event.preventDefault(); saveEvent(editDraft, editing.id); }} noValidate>{renderFields(editDraft, setEditDraft, 'edit')}<p className="cal-form-error" role="alert">{error}</p><div className="cal-sheet-actions"><button type="button" className="cal-delete" aria-label={`Delete ${editing.title}`} onClick={() => { setEvents(current => current.filter(event => event.id !== editing.id)); setNotice(`${editing.title} deleted.`); setEditing(null); setError(''); }}><Trash2 size={18} />Delete</button><button className="cal-save" type="submit">Save changes<Check size={17} /></button></div><p className="cal-local-note">Drag events or use ↑ / ↓ to move by 15 minutes</p></form></div></div>}
  </div>;
}
