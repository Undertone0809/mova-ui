import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Copy, CornerDownRight,
  Crosshair, Frame, Hand, HelpCircle, Link2, MessageSquare, Minus, MousePointer2,
  Pause, Play, Plus, Redo2, Send, StickyNote, Trash2, Type, Undo2, Vote, X,
} from 'lucide-react';
import './blocks-shared.css';
import './canvas-block.css';

type Tone = 'sand' | 'peach' | 'lilac' | 'blue' | 'white' | 'gray';
type Note = { id: string; title: string; body?: string; author: string; tone: Tone; kind: 'problem' | 'idea' | 'action' | 'text'; x: number; y: number; w: number; h: number; votes: number; mine?: boolean; due?: string; group?: string };
type Edge = { id: string; from: string; to: string };
type Board = { notes: Note[]; edges: Edge[] };
type Tool = 'select' | 'hand' | 'note' | 'text' | 'connect';
type Drag = { type: 'note' | 'pan'; pointer: number; startX: number; startY: number; pan: { x: number; y: number }; ids: string[]; initial: Board; moved: boolean };
const initialNotes: Note[] = [
  { id: 'p1', title: 'After signing up,\nwhat do I do next?', author: 'Jamie', tone: 'sand', kind: 'problem', x: 140, y: 191, w: 220, h: 108, votes: 0 },
  { id: 'p2', title: 'Too much setup before\nI see any value', author: 'Alex', tone: 'sand', kind: 'problem', x: 140, y: 318, w: 220, h: 108, votes: 0 },
  { id: 'p3', title: 'An empty workspace.\nWhere do I start?', author: 'Morgan', tone: 'sand', kind: 'problem', x: 140, y: 445, w: 220, h: 108, votes: 0 },
  { id: 'p4', title: 'I got an invitation,\nbut what’s my role?', author: 'Jamie', tone: 'sand', kind: 'problem', x: 140, y: 572, w: 220, h: 108, votes: 0 },
  { id: 'i1', title: 'Start with one\nreal task', body: 'Put the learning in the doing.\nSkip the five-page introduction.', author: 'Jamie', tone: 'peach', kind: 'idea', x: 422, y: 198, w: 221, h: 211, votes: 3 },
  { id: 'i2', title: 'A first step\nfor every role', body: 'Ask “what brings you here?”\nThen show the shortest path.', author: 'Alex', tone: 'lilac', kind: 'idea', x: 674, y: 198, w: 221, h: 211, votes: 1 },
  { id: 'i3', title: 'A starting point,\nnot a blank page', body: 'Give people something to edit.\nMake that first step a little easier.', author: 'You', tone: 'blue', kind: 'idea', x: 422, y: 448, w: 221, h: 211, votes: 2, mine: true },
  { id: 'i4', title: 'Bring the context\nwith the invite', body: 'Say who invited me,\nand what we’ll do together.', author: 'Morgan', tone: 'lilac', kind: 'idea', x: 674, y: 448, w: 221, h: 211, votes: 1 },
  { id: 'a1', title: 'Walk through the flow\nwith 5 new users', body: 'Find the moments\nwhere people get stuck.', author: 'Jamie', tone: 'white', kind: 'action', x: 946, y: 217, w: 162, h: 179, votes: 0, due: 'Oct 6' },
  { id: 'a2', title: 'Prototype the\ntop two ideas', body: 'Let’s review them\nnext Tuesday.', author: 'Alex', tone: 'gray', kind: 'action', x: 946, y: 441, w: 162, h: 167, votes: 0, due: 'Oct 8' },
];
const initialBoard: Board = { notes: initialNotes, edges: [
  { id: 'e1', from: 'p1', to: 'i1' }, { id: 'e2', from: 'p2', to: 'i3' },
  { id: 'e3', from: 'i2', to: 'a1' }, { id: 'e4', from: 'i4', to: 'a2' },
] };
const people = [{ name: 'Alex', initial: 'A', color: 'gold' }, { name: 'Jamie', initial: 'J', color: 'pink' }, { name: 'Morgan', initial: 'M', color: 'periwinkle' }, { name: 'You', initial: 'Y', color: 'violet' }];
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export function CanvasBlock({ thumbnail = false }: { thumbnail?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1182, height: 757 });
  const [board, setBoard] = useState<Board>(initialBoard);
  const boardRef = useRef(board);
  boardRef.current = board;
  const [past, setPast] = useState<Board[]>([]);
  const [future, setFuture] = useState<Board[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<Drag | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', body: '' });
  const [seconds, setSeconds] = useState(102);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [modal, setModal] = useState<'help' | 'share' | 'comments' | null>(null);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([{ author: 'Alex', text: 'Let’s focus on the first moment of value. What can we make simpler?' }]);
  const [announcement, setAnnouncement] = useState('');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy demo link');
  const arrowId = useId().replace(/:/g, '');
  const modalReturnFocus = useRef<HTMLElement | null>(null);
  const narrow = dimensions.width < 700;
  const baseScale = narrow ? 0.8 : Math.min(1, (dimensions.width - 54) / 1440);
  const scale = baseScale * zoom;
  const origin = { x: (narrow ? -332 : 0) + pan.x, y: (narrow ? -130 : 40) + pan.y };
  const remaining = 3 - board.notes.filter(note => note.mine).length;
  const selectedNotes = board.notes.filter(note => selected.includes(note.id));
  const bounds = selectedNotes.length ? { left: Math.min(...selectedNotes.map(n => n.x)), top: Math.min(...selectedNotes.map(n => n.y)), right: Math.max(...selectedNotes.map(n => n.x + n.w)), bottom: Math.max(...selectedNotes.map(n => n.y + n.h)) } : null;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width && height) setDimensions({ width, height });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (thumbnail || paused || ended) return;
    const interval = window.setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [thumbnail, paused, ended]);
  useEffect(() => { if (seconds === 0) setEnded(true); }, [seconds]);
  useEffect(() => {
    if (!announcement) return;
    const timeout = window.setTimeout(() => setAnnouncement(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [announcement]);

  useEffect(() => {
    if (!modal) return;
    modalReturnFocus.current = document.activeElement as HTMLElement;
    const dialog = rootRef.current?.querySelector<HTMLElement>(modal === 'comments' ? '.mcb-comments' : '.mcb-modal');
    const closeButton = dialog?.querySelector<HTMLButtonElement>('button');
    closeButton?.focus({ preventScroll: true });
    return () => { if (modalReturnFocus.current?.isConnected) modalReturnFocus.current.focus({ preventScroll: true }); };
  }, [modal]);

  function commit(next: Board) {
    setPast(history => [...history.slice(-39), boardRef.current]);
    setFuture([]);
    setBoard(next);
  }
  function undo() {
    if (!past.length) return;
    setFuture(items => [boardRef.current, ...items]);
    setBoard(past[past.length - 1]);
    setPast(items => items.slice(0, -1));
    setSelected([]);
    setAnnouncement('Last change undone');
  }
  function redo() {
    if (!future.length) return;
    setPast(items => [...items, boardRef.current]);
    setBoard(future[0]);
    setFuture(items => items.slice(1));
    setSelected([]);
    setAnnouncement('Change restored');
  }
  function resetView() { setPan({ x: 0, y: 0 }); setZoom(1); }
  function navigate(column: 'problems' | 'ideas' | 'next') {
    const center = column === 'problems' ? 250 : column === 'ideas' ? 658 : 1027;
    const target = narrow ? dimensions.width / 2 : (dimensions.width - (minimized ? 0 : 310)) / 2;
    setPan({ x: target - center * scale - (narrow ? -332 : 0), y: 0 });
    setAnnouncement(`Showing ${column === 'problems' ? 'pain points' : column === 'ideas' ? 'ideas' : 'next steps'}`);
  }
  function chooseTool(next: Tool) {
    setTool(next); setConnectFrom(null); setMenu(false);
    viewportRef.current?.focus({ preventScroll: true });
    setAnnouncement(next === 'note' || next === 'text' ? `Click the canvas to add ${next === 'note' ? 'a sticky note' : 'text'}. Press Enter to add in the center.` : next === 'connect' ? 'Select two notes to connect them' : next === 'hand' ? 'Drag the canvas to pan. Use the column navigation to jump.' : 'Select a note. Hold Shift to select more.');
  }
  function addNote(clientX?: number, clientY?: number, asText = tool === 'text') {
    const rect = viewportRef.current?.getBoundingClientRect();
    const x = rect && clientX !== undefined ? (clientX - rect.left - origin.x) / scale : ((narrow ? dimensions.width / 2 : (dimensions.width - 300) / 2) - origin.x) / scale;
    const y = rect && clientY !== undefined ? (clientY - rect.top - origin.y) / scale : (220 - origin.y) / scale;
    const note: Note = { id: `note-${stamp()}`, title: asText ? 'Add your text' : 'Write your idea', body: '', author: 'You', tone: asText ? 'white' : 'peach', kind: asText ? 'text' : 'idea', x: Math.max(-200, Math.min(1800, x - 110)), y: Math.max(-100, Math.min(1000, y - 20)), w: 220, h: asText ? 104 : 164, votes: 0 };
    commit({ ...boardRef.current, notes: [...boardRef.current.notes, note] });
    setSelected([note.id]); setEditing(note.id); setDraft({ title: note.title, body: '' }); setTool('select');
    setAnnouncement(asText ? 'Text added' : 'Sticky note added');
  }
  function finishEditing() {
    if (!editing) return;
    const original = boardRef.current.notes.find(n => n.id === editing);
    if (original && (original.title !== draft.title || (original.body || '') !== draft.body)) {
      commit({ ...boardRef.current, notes: boardRef.current.notes.map(n => n.id === editing ? { ...n, title: draft.title.trim() || 'Untitled idea', body: draft.body } : n) });
    }
    setEditing(null);
  }
  function startEditing(note: Note) { setSelected([note.id]); setDraft({ title: note.title, body: note.body || '' }); setEditing(note.id); }
  function voteFor(note: Note) {
    if (ended || submitted) { setAnnouncement(ended ? 'Voting has ended. Results are in the voting panel.' : 'Your votes are submitted. Choose Edit votes to change them.'); return; }
    if (!note.mine && remaining <= 0) { setAnnouncement('You’ve used all 3 votes. Retract a vote to choose another idea.'); return; }
    commit({ ...boardRef.current, notes: boardRef.current.notes.map(n => n.id === note.id ? { ...n, mine: !n.mine, votes: n.votes + (n.mine ? -1 : 1) } : n) });
    setAnnouncement(note.mine ? 'Vote retracted' : `Voted for ${note.title.replace(/\n/g, ' ')}`);
  }
  function removeSelected() {
    if (!selected.length) return;
    commit({ notes: boardRef.current.notes.filter(n => !selected.includes(n.id)), edges: boardRef.current.edges.filter(e => !selected.includes(e.from) && !selected.includes(e.to)) });
    setSelected([]); setAnnouncement(`${selected.length} ${selected.length === 1 ? 'note' : 'notes'} deleted. Undo is available.`);
  }
  function duplicateSelected() {
    if (!selected.length) return;
    const copies = selectedNotes.map(note => ({ ...note, id: `note-${stamp()}`, x: note.x + 30, y: note.y + 30, mine: false, votes: 0, group: undefined }));
    commit({ ...boardRef.current, notes: [...boardRef.current.notes, ...copies] });
    setSelected(copies.map(note => note.id)); setAnnouncement('Selected notes duplicated');
  }
  function groupSelected() {
    if (selected.length < 2) { setAnnouncement('Hold Shift and select at least two notes to group them'); return; }
    const currentGroup = selectedNotes[0]?.group;
    const ungroup = currentGroup && selectedNotes.every(n => n.group === currentGroup);
    const group = ungroup ? undefined : `group-${stamp()}`;
    commit({ ...boardRef.current, notes: boardRef.current.notes.map(n => selected.includes(n.id) ? { ...n, group } : n) });
    setAnnouncement(ungroup ? 'Notes ungrouped' : `${selected.length} notes grouped. Drag any note to move the group.`);
  }
  function connectNote(note: Note) {
    if (!connectFrom) { setConnectFrom(note.id); setSelected([note.id]); setAnnouncement('Now choose the second note'); }
    else if (connectFrom !== note.id) {
      commit({ ...boardRef.current, edges: [...boardRef.current.edges, { id: `edge-${stamp()}`, from: connectFrom, to: note.id }] });
      setConnectFrom(null); setTool('select'); setSelected([]); setAnnouncement('Notes connected');
    }
  }
  function beginNoteDrag(event: PointerEvent<HTMLElement>, note: Note) {
    if (event.button !== 0 || editing) return;
    if ((event.target as HTMLElement).closest('button, textarea')) return;
    event.stopPropagation();
    if (tool === 'hand') { beginPan(event); return; }
    if (tool === 'connect') { connectNote(note); return; }
    if (tool === 'note' || tool === 'text') return;
    const groupIds = note.group ? board.notes.filter(n => n.group === note.group).map(n => n.id) : [note.id];
    const ids = event.shiftKey ? selected.includes(note.id) ? selected.filter(id => !groupIds.includes(id)) : [...new Set([...selected, ...groupIds])] : selected.includes(note.id) ? selected : groupIds;
    setSelected(ids);
    event.currentTarget.focus({ preventScroll: true });
    if (event.shiftKey) return;
    drag.current = { type: 'note', pointer: event.pointerId, startX: event.clientX, startY: event.clientY, pan, ids, initial: boardRef.current, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function beginPan(event: PointerEvent<HTMLElement>) {
    drag.current = { type: 'pan', pointer: event.pointerId, startX: event.clientX, startY: event.clientY, pan, ids: [], initial: boardRef.current, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePointer(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
    if (Math.abs(dx) + Math.abs(dy) < 4 && !current.moved) return;
    current.moved = true;
    if (current.type === 'pan') setPan({ x: current.pan.x + dx, y: current.pan.y + dy });
    else setBoard({ ...current.initial, notes: current.initial.notes.map(n => current.ids.includes(n.id) ? { ...n, x: Math.max(-300, Math.min(1900, n.x + dx / scale)), y: Math.max(-150, Math.min(1200, n.y + dy / scale)) } : n) });
  }
  function endPointer(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (current.type === 'note' && current.moved) { setPast(history => [...history.slice(-39), current.initial]); setFuture([]); }
    drag.current = null;
  }
  function boardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (modal && event.key === 'Tab') {
      const dialog = rootRef.current?.querySelector<HTMLElement>(modal === 'comments' ? '.mcb-comments' : '.mcb-modal');
      const focusable = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, [tabindex="0"]');
      if (focusable?.length) {
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && target === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && target === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (event.key === 'Escape' && modal) { event.preventDefault(); setModal(null); return; }
    if (modal) return;
    if (target.closest('input, textarea, [contenteditable="true"]')) return;
    if (event.key === 'Escape') { setModal(null); setSelected([]); setTool('select'); setConnectFrom(null); setMenu(false); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelected(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') { event.preventDefault(); groupSelected(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { if (selected.length) { event.preventDefault(); removeSelected(); } return; }
    if (target.closest('button')) return;
    if (event.key === 'Enter' && (tool === 'note' || tool === 'text')) { event.preventDefault(); addNote(); return; }
    if (event.key === 'Enter' && target.dataset.noteId) {
      event.preventDefault(); const note = board.notes.find(n => n.id === target.dataset.noteId); if (note) { setSelected([note.id]); startEditing(note); } return;
    }
    if (event.key.startsWith('Arrow')) {
      const step = event.shiftKey ? 20 : 5;
      const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
      const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
      event.preventDefault();
      if (selected.length && tool !== 'hand') commit({ ...board, notes: board.notes.map(n => selected.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n) });
      else setPan(p => ({ x: p.x - dx * 8, y: p.y - dy * 8 }));
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'v') chooseTool('select');
      if (key === 'h') chooseTool('hand');
      if (key === 'n') chooseTool('note');
      if (key === 't') chooseTool('text');
      if (key === 'c') chooseTool('connect');
      if (key === '?') setModal('help');
    }
  }
  const grouped = [...new Set(board.notes.map(n => n.group).filter(Boolean))].map(group => board.notes.filter(n => n.group === group));
  const orderedResults = board.notes.filter(n => n.kind === 'idea').sort((a, b) => b.votes - a.votes).slice(0, 3);
  return (
    <div ref={rootRef} className={`mova-canvas-block${narrow ? ' mcb-narrow' : ''}${thumbnail ? ' mcb-thumbnail' : ''}`} onKeyDown={boardKeyDown} aria-label="Loom whiteboard demo">
      <header className="mcb-header">
        <div className="mcb-brand" aria-label="Loom"><span className="mcb-logo" aria-hidden="true"><i /><i /><i /></span><span>loom</span><ChevronDown size={11} /></div>
        <div className="mcb-board-name"><div>Daylight team <span>/</span> Product workshop</div><strong>A new user’s first day <ChevronDown size={11} /></strong></div>
        <span className="mcb-editable"><Check size={13} /> Editable</span>
        <div className="mcb-header-right"><div className="mcb-avatars" aria-label="Four demo collaborators">{people.map(person => <span key={person.name} className={`mcb-avatar mcb-${person.color}`} title={`${person.name} · Demo collaborator`}>{person.initial}</span>)}</div><span className="mcb-online"><i />4 here</span><button className="mcb-follow" onClick={() => { resetView(); setAnnouncement('Centered on Alex’s demo view'); }}><Crosshair size={15} />Follow host</button><button className="mcb-share" onClick={() => setModal(modal === 'share' ? null : 'share')}>Share board</button></div>
      </header>
      <div ref={viewportRef} className={`mcb-workspace mcb-tool-${tool}`} tabIndex={0} aria-label="Whiteboard canvas. Use arrow keys to pan, or select a note to move it." onPointerDown={event => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('button, textarea, .mcb-note, .mcb-overlay')) return;
        if (tool === 'note' || tool === 'text') { addNote(event.clientX, event.clientY); return; }
        if (tool === 'hand') beginPan(event);
        else { setSelected([]); setEditing(null); }
      }} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer}>
        <div className="mcb-board" style={{ transform: `translate(${origin.x}px, ${origin.y}px) scale(${scale})` }}>
          <div className="mcb-board-heading"><p><i /> Thursday workshop <span>·</span> October 1</p><h2>A new user’s first day<span>.</span></h2></div>
          <div className="mcb-steps"><span><b>1</b> Find the friction <Check size={11} /></span><span><b>2</b> Explore ideas <Check size={11} /></span><span className="active"><b>3</b> Vote & focus</span></div>
          <section className="mcb-frame mcb-frame-problems" aria-label="Pain points"><div className="mcb-frame-label"><span>01</span><strong>Pain points</strong><small>{board.notes.filter(n => n.kind === 'problem').length}</small></div></section>
          <section className="mcb-frame mcb-frame-ideas" aria-label="Ideas"><div className="mcb-frame-label"><span>02</span><strong>What could we do?</strong><small>{board.notes.filter(n => n.kind === 'idea').length}</small><em><i />{ended ? 'Results are in' : 'Voting now'}</em></div></section>
          <section className="mcb-frame mcb-frame-next" aria-label="Next steps"><div className="mcb-frame-label"><span>03</span><strong>Up next</strong><small>{board.notes.filter(n => n.kind === 'action').length}</small></div></section>
          <svg className="mcb-connections" width="2200" height="1400" aria-label={`${board.edges.length} connections between notes`}><defs><marker id={arrowId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M1 1 L6 3.5 L1 6" fill="none" stroke="#b7b2bd" strokeWidth="1" /></marker></defs>{board.edges.map(edge => {
            const from = board.notes.find(n => n.id === edge.from), to = board.notes.find(n => n.id === edge.to);
            if (!from || !to) return null;
            const x1 = from.x + from.w + 4, y1 = from.y + from.h / 2, x2 = to.x - 5, y2 = to.y + to.h / 2;
            const curve = Math.max(24, Math.abs(x2 - x1) * 0.5);
            return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`} fill="none" stroke="#b7b2bd" strokeWidth="1.2" markerEnd={`url(#${arrowId})`} />;
          })}</svg>
          {grouped.map(notes => {
            const left = Math.min(...notes.map(n => n.x)), top = Math.min(...notes.map(n => n.y)), right = Math.max(...notes.map(n => n.x + n.w)), bottom = Math.max(...notes.map(n => n.y + n.h));
            return <div key={notes[0].group} className="mcb-group-outline" style={{ left: left - 9, top: top - 9, width: right - left + 18, height: bottom - top + 18 }}><span>Group</span></div>;
          })}
          {board.notes.map(note => <article key={note.id} tabIndex={0} data-note-id={note.id} className={`mcb-note mcb-note-${note.kind} mcb-tone-${note.tone}${selected.includes(note.id) ? ' mcb-selected' : ''}${editing === note.id ? ' mcb-editing' : ''}`} style={{ left: note.x, top: note.y, width: note.w, height: note.h } as CSSProperties} aria-label={`${note.title.replace(/\n/g, ' ')}. ${selected.includes(note.id) ? 'Selected. ' : ''}${note.author}. ${note.kind === 'idea' ? `${note.votes} votes. ` : ''}Press Enter to edit. Shift-click to select multiple notes.`} onPointerDown={event => beginNoteDrag(event, note)} onDoubleClick={() => { if (tool === 'select') startEditing(note); }} onKeyDown={event => {
            if ((event.key === ' ' || event.key === 'Enter') && tool === 'connect' && event.target === event.currentTarget) { event.preventDefault(); event.stopPropagation(); connectNote(note); return; }
            if (event.key === ' ' && event.target === event.currentTarget) { event.preventDefault(); event.stopPropagation(); setSelected(ids => event.shiftKey ? ids.includes(note.id) ? ids.filter(id => id !== note.id) : [...ids, note.id] : [note.id]); }
          }}>
            {editing === note.id ? <div className="mcb-note-editor" onPointerDown={e => e.stopPropagation()} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) finishEditing(); }}><textarea autoFocus aria-label="Note title" value={draft.title} onFocus={event => event.currentTarget.select()} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} onKeyDown={event => { if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) { event.preventDefault(); finishEditing(); } }} />{note.kind !== 'problem' && <textarea className="mcb-body-editor" aria-label="Note description" placeholder="Add a little detail…" value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />}</div> : <><h3>{note.title}</h3>{note.body && <p>{note.body}</p>}</>}
            {note.kind === 'idea' && <div className="mcb-vote-dots" aria-hidden="true">{Array.from({ length: Math.min(note.votes, 6) }, (_, index) => <i key={index} className={note.mine && index === note.votes - 1 ? 'mine' : ''} />)}</div>}
            <div className="mcb-note-footer"><span className="mcb-note-author"><i className={`mcb-${people.find(p => p.name === note.author)?.color || 'violet'}`}>{note.author[0]}</i>{note.author}</span>{note.due && <span className="mcb-due">{note.due}</span>}{note.kind === 'idea' && <div className="mcb-note-voting"><span>{note.votes}<small> votes</small></span><button aria-label={note.mine ? `Retract vote for ${note.title.replace(/\n/g, ' ')}` : `Vote for ${note.title.replace(/\n/g, ' ')}`} aria-pressed={!!note.mine} className={note.mine ? 'is-voted' : ''} onClick={() => voteFor(note)} disabled={ended || submitted}>{note.mine ? <Check size={14} /> : <Plus size={14} />}</button></div>}</div>
            {note.mine && note.kind === 'idea' && note.id !== 'i3' && <span className="mcb-your-vote">You +1</span>}
          </article>)}
          {bounds && <><div className="mcb-selection-box" style={{ left: bounds.left - 5, top: bounds.top - 5, width: bounds.right - bounds.left + 10, height: bounds.bottom - bounds.top + 10 }}><i /><i /><i /><i /></div><div className="mcb-selection-toolbar mcb-overlay" style={{ left: Math.max((12 - origin.x) / scale, Math.min(bounds.left, bounds.right - 310, (dimensions.width - 12 - origin.x) / scale - 310)), top: Math.max(bounds.top - 65, ((narrow ? 38 : 8) - origin.y) / scale) }} onPointerDown={e => e.stopPropagation()}><span>{selected.length} selected</span><div className="mcb-color-options">{(['peach', 'blue', 'lilac'] as Tone[]).map(tone => <button key={tone} className={`mcb-tone-${tone}`} aria-label={`Make selected notes ${tone}`} onClick={() => commit({ ...board, notes: board.notes.map(n => selected.includes(n.id) ? { ...n, tone } : n) })} />)}</div><button aria-label="Group or ungroup selected notes" onClick={groupSelected}>Group</button><button aria-label="Duplicate selected notes" onClick={duplicateSelected}><Copy size={14} /></button><button aria-label="Delete selected notes" onClick={removeSelected}><Trash2 size={14} /></button></div></>}
          <div className="mcb-cursor mcb-cursor-jamie" aria-hidden="true"><MousePointer2 fill="currentColor" size={22} /><span>Jamie</span></div><div className="mcb-cursor mcb-cursor-alex" aria-hidden="true"><MousePointer2 fill="currentColor" size={22} /><span>Alex</span></div><div className="mcb-cursor mcb-cursor-morgan" aria-hidden="true"><MousePointer2 fill="currentColor" size={22} /><span>Morgan</span></div>
        </div>
        <nav className="mcb-column-nav mcb-overlay" aria-label="Navigate board columns"><button onClick={() => navigate('problems')}><ArrowLeft size={11} />Pain points</button><button onClick={() => navigate('ideas')}>Ideas</button><button onClick={() => navigate('next')}>Up next<ArrowRight size={11} /></button></nav>
        {minimized ? <button className="mcb-vote-minimized mcb-overlay" onClick={() => setMinimized(false)}><Vote size={15} />{ended ? 'Voting results' : 'Voting in progress'}<span>·</span>{ended ? 'View' : formatTime(seconds)}</button> : <aside className={`mcb-vote-panel mcb-overlay${ended ? ' mcb-ended' : ''}`} aria-label={ended ? 'Voting results' : 'Voting session'}>
          <div className="mcb-panel-eyebrow"><Vote size={15} /><span>{ended ? 'Voting results' : 'Open voting'}</span><button aria-label="Minimize voting panel" onClick={() => setMinimized(true)}><Minus size={15} /></button></div>
          <h3>What should we do first?</h3><p className="mcb-panel-description">3 votes each. Pick the ideas worth starting with.</p>
          {ended ? <div className="mcb-results">{orderedResults.map((note, index) => <div key={note.id}><b>{index + 1}</b><span>{note.title.replace(/\n/g, ' ')}</span><strong>{note.votes}<small> votes</small></strong></div>)}</div> : <div className="mcb-timer"><i /><strong>{formatTime(seconds)}</strong><button aria-label={paused ? 'Resume voting timer' : 'Pause voting timer'} onClick={() => setPaused(!paused)}>{paused ? <Play size={15} /> : <Pause size={15} />}</button></div>}
          <div className="mcb-votes-left"><div>{[0, 1, 2].map(index => <span key={index} className={index < 3 - remaining ? 'used' : ''}>{index < 3 - remaining ? <Check size={13} /> : <Plus size={11} />}</span>)}</div><span>{ended ? 'Voting has ended' : <>You have <b>{remaining}</b> {remaining === 1 ? 'vote' : 'votes'} left</>}</span></div>
          <div className="mcb-participants"><div className="mcb-participants-heading"><span>Participation</span><span>{submitted || ended ? '2' : '1'} / 4 finished</span></div>{people.map((person, index) => <div className="mcb-person" key={person.name}><span className={`mcb-avatar mcb-${person.color}`}>{person.initial}</span><span>{person.name}{index === 0 && <small>Host</small>}</span><small>{index === 0 || (index === 3 && (submitted || ended)) ? <><Check size={11} />Done</> : `${index === 1 ? '2' : index === 2 ? '1' : 3 - remaining} / 3`}</small></div>)}</div>
          <button className="mcb-finish-voting" onClick={() => { if (ended) { commit({ ...board, notes: board.notes.map(note => note.kind === 'idea' ? { ...note, votes: 0, mine: false } : note) }); setEnded(false); setSeconds(102); setPaused(false); setSubmitted(false); setAnnouncement('A new local voting round has started with 3 fresh votes'); } else { setSubmitted(!submitted); setAnnouncement(submitted ? 'You can edit your votes' : 'Your votes are submitted'); } }}>{ended ? <><Redo2 size={14} />New round</> : submitted ? <>Edit votes</> : <><Check size={15} />Finish voting</>}</button>
          <div className={`mcb-panel-bottom${submitted ? ' mcb-ready-results' : ''}`}><span>{ended ? 'Local demo results' : 'Started by Alex · 5 min'}</span>{!ended && <button onClick={() => { setEnded(true); setAnnouncement('Voting ended. The top three ideas are shown.'); }}>End round</button>}</div>
        </aside>}
        <div className="mcb-minimap mcb-overlay"><button onClick={resetView}><span>Overview</span><Frame size={12} /></button><div className="mcb-minimap-board" aria-hidden="true"><div>{['sand','sand','sand','sand'].map((t, i) => <i key={i} className={`mcb-tone-${t}`} />)}</div><div>{['peach','blue'].map(t => <i key={t} className={`mcb-tone-${t}`} />)}</div><div>{['lilac','lilac'].map((t, i) => <i key={i} className={`mcb-tone-${t}`} />)}</div><div><i className="mcb-tone-gray" /><i className="mcb-tone-gray" /></div></div></div>
        <div className="mcb-history mcb-overlay"><button aria-label="Undo last board change" disabled={!past.length} onClick={undo}><Undo2 size={17} /></button><button aria-label="Redo board change" disabled={!future.length} onClick={redo}><Redo2 size={17} /></button><span>{board.notes.length} notes <i>·</i> Shift to multi-select</span></div>
        <div className="mcb-tool-tray mcb-overlay" role="toolbar" aria-label="Whiteboard tools">
          <button aria-label="Select tool" title="Select (V)" aria-pressed={tool === 'select'} className={tool === 'select' ? 'active' : ''} onClick={() => chooseTool('select')}><MousePointer2 size={24} /></button><button aria-label="Pan tool" title="Hand (H)" aria-pressed={tool === 'hand'} className={tool === 'hand' ? 'active' : ''} onClick={() => chooseTool('hand')}><Hand size={22} /></button><span className="mcb-tool-divider" /><button aria-label="Add sticky note" title="Sticky note (N)" aria-pressed={tool === 'note'} className={tool === 'note' ? 'active' : ''} onClick={() => chooseTool('note')}><span className="mcb-sticky-icon"><i /><i /><i /></span></button><button aria-label="Add text" title="Text (T)" aria-pressed={tool === 'text'} className={tool === 'text' ? 'active' : ''} onClick={() => chooseTool('text')}><Type size={26} /></button><button aria-label="Connect two notes" title="Connector (C)" aria-pressed={tool === 'connect'} className={tool === 'connect' ? 'active' : ''} onClick={() => chooseTool('connect')}><CornerDownRight size={26} /></button><button aria-label="Select all idea notes" title="Select ideas" onClick={() => { setSelected(board.notes.filter(n => n.kind === 'idea').map(n => n.id)); setTool('select'); setAnnouncement('All idea notes selected'); }}><Frame size={25} /></button><span className="mcb-tool-divider mcb-secondary-tool" /><button className="mcb-secondary-tool" aria-label="Open comments" title="Comments" onClick={() => setModal(modal === 'comments' ? null : 'comments')}><MessageSquare size={23} /></button><button className="mcb-secondary-tool" aria-label="More board tools" title="More" aria-expanded={menu} onClick={() => setMenu(!menu)}><Plus size={25} /></button>
          {menu && <div className="mcb-more-menu"><button onClick={() => { addNote(undefined, undefined, false); setMenu(false); }}><StickyNote size={15} />Add note in center</button><button onClick={() => { setModal('comments'); setMenu(false); }}><MessageSquare size={15} />Comments</button><button onClick={() => { resetView(); setMenu(false); }}><Crosshair size={15} />Reset view</button><button onClick={() => { setModal('help'); setMenu(false); }}><HelpCircle size={15} />Keyboard shortcuts</button></div>}
        </div>
        <div className="mcb-zoom mcb-overlay"><button aria-label="Zoom out" disabled={zoom <= 0.55} onClick={() => setZoom(z => Math.max(0.55, +(z - 0.1).toFixed(2)))}><Minus size={15} /></button><button className="mcb-zoom-label" aria-label="Reset zoom and fit board" onClick={resetView}>{Math.round(scale * 100)}%<ChevronDown size={11} /></button><button aria-label="Zoom in" disabled={zoom >= 1.8} onClick={() => setZoom(z => Math.min(1.8, +(z + 0.1).toFixed(2)))}><Plus size={15} /></button><span /><button aria-label="Whiteboard help" onClick={() => setModal('help')}><HelpCircle size={15} /></button></div>
        {announcement && !thumbnail && <div className="mcb-toast" role="status">{announcement}</div>}
        {modal === 'comments' && <aside className="mcb-comments mcb-overlay"><div className="mcb-modal-heading"><h3>Board comments</h3><button aria-label="Close comments" onClick={() => setModal(null)}><X size={18} /></button></div><p className="mcb-demo-hint">Demo conversation · saved for this session</p><div className="mcb-comment-list">{comments.map((item, i) => <div key={i}><span className={`mcb-avatar ${item.author === 'You' ? 'mcb-violet' : 'mcb-gold'}`}>{item.author[0]}</span><div><strong>{item.author}</strong><p>{item.text}</p></div></div>)}</div><form onSubmit={e => { e.preventDefault(); if (!comment.trim()) return; setComments(items => [...items, { author: 'You', text: comment.trim() }]); setComment(''); }}><label htmlFor={`${arrowId}-comment`}>Add a comment</label><textarea id={`${arrowId}-comment`} value={comment} onChange={e => setComment(e.target.value)} placeholder="Share a thought…" /><button disabled={!comment.trim()} type="submit"><Send size={14} />Post locally</button></form></aside>}
      </div>
      {(modal === 'share' || modal === 'help') && <div className="mcb-modal-backdrop" onClick={() => setModal(null)}><section className="mcb-modal" role="dialog" aria-modal="true" aria-label={modal === 'share' ? 'Share this demo' : 'Whiteboard help'} onClick={e => e.stopPropagation()}><div className="mcb-modal-heading"><h3>{modal === 'share' ? 'Share a little inspiration' : 'Make room for ideas'}</h3><button aria-label="Close dialog" onClick={() => setModal(null)}><X size={19} /></button></div>{modal === 'share' ? <><p>This is a local, interactive demo. Copy a link to this page to share the experience. Your edits stay in this session.</p><button className="mcb-copy-link" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopyLabel('Link copied'); } catch { setCopyLabel('Select and copy the link below'); } }}><Link2 size={16} />{copyLabel}</button><input aria-label="Demo page link" readOnly value={typeof window === 'undefined' ? '' : window.location.href} onFocus={e => e.currentTarget.select()} /></> : <><p>Click to select. Double-click or press Enter on a note to edit. Drag notes to move them.</p><dl><div><dt>Select / Pan</dt><dd>V / H</dd></div><div><dt>Sticky note / Text</dt><dd>N / T</dd></div><div><dt>Connect two notes</dt><dd>C</dd></div><div><dt>Select more notes</dt><dd>Shift + click</dd></div><div><dt>Move selection</dt><dd>Arrow keys</dd></div><div><dt>Duplicate / Group</dt><dd>⌘ / Ctrl + D / G</dd></div><div><dt>Undo / Redo</dt><dd>⌘ / Ctrl + Z / Shift Z</dd></div><div><dt>Delete / Deselect</dt><dd>Delete / Esc</dd></div></dl><p className="mcb-help-note"><strong>Demo collaborators</strong> Alex, Jamie, and Morgan are illustrative. Voting, comments, and changes are local to this page. Use the column buttons or Pan tool to reach every part of the board.</p></>}</section></div>}
    </div>
  );
}
