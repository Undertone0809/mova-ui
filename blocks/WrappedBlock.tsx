import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, BarChart3, X } from 'lucide-react';
import './blocks-shared.css';
import './wrapped-block.css';

const art = { singer: new URL('./assets/singer-portrait.webp', import.meta.url).href, moon: new URL('./assets/moon-headphones.webp', import.meta.url).href, records: new URL('./assets/record-stack.webp', import.meta.url).href };
const labels = ['Listening time', 'Favorite artist', 'Music personality'];
function TempoLogo() { return <span className="tempo-logo"><BarChart3 size={26} strokeWidth={3} aria-hidden="true" />tempo</span>; }

export function WrappedBlock({ thumbnail = false }: { thumbnail?: boolean }) {
  const [page, setPage] = useState(0);
  const [minutes, setMinutes] = useState(thumbnail ? 48213 : 0);
  const [share, setShare] = useState(false);
  const [image, setImage] = useState('');
  const [status, setStatus] = useState('');
  const recap = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const shareButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (thumbnail || page !== 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setMinutes(48213); return; }
    let frame = 0; let start = 0;
    const tick = (now: number) => { if (!start) start = now; const progress = Math.min((now - start) / 1050, 1); setMinutes(Math.round(48213 * (1 - Math.pow(1 - progress, 3)))); if (progress < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [page, thumbnail]);
  useEffect(() => {
    if (!share) return;
    const element = dialog.current; element?.showModal();
    return () => { element?.close(); shareButton.current?.focus({ preventScroll: true }); };
  }, [share]);
  useEffect(() => {
    if (!share || image) return;
    let active = true;
    const render = async () => {
      try {
        await document.fonts.ready;
        const moon = new Image(); moon.src = art.moon; await moon.decode();
        const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 1040;
        const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
        context.fillStyle = '#b7cdfb'; context.fillRect(0, 0, 720, 1040); context.fillStyle = '#303ee0';
        context.font = 'italic 44px "Mova Anton", sans-serif'; context.fillText('tempo', 42, 68);
        context.font = '600 18px "Mova DM Sans", sans-serif'; context.fillText('2026 WRAPPED', 505, 67);
        context.font = '74px "Mova Anton", sans-serif'; context.fillText('NIGHT OWL', 42, 178); context.fillText('ROMANTIC', 42, 270);
        context.drawImage(moon, 500, 137, 185, 185);
        context.font = '22px "Mova DM Sans", sans-serif'; context.fillText('Late nights. Long plays. On repeat.', 44, 328);
        context.font = '124px "Mova Anton", sans-serif'; context.fillText('48,213', 40, 507);
        context.font = '600 19px "Mova DM Sans", sans-serif'; context.fillText('MINUTES OF MUSIC', 408, 506);
        // A data grid, one marker per complete day of listening (33 days).
        for (let i = 0; i < 33; i++) { const x = 62 + (i % 11) * 58, y = 590 + Math.floor(i / 11) * 60; context.beginPath(); context.arc(x, y, 12, 0, Math.PI * 2); context.fill(); context.save(); context.fillStyle = '#b7cdfb'; context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill(); context.restore(); }
        context.font = '18px "Mova DM Sans", sans-serif'; context.fillText('33 days, 11 hours, 33 minutes', 42, 782);
        context.fillRect(42, 814, 636, 2); context.font = '18px "Mova DM Sans", sans-serif'; context.fillText('TOP ARTIST', 42, 861); context.fillText('AFTER 11 PM', 488, 861);
        context.font = '600 28px "Mova DM Sans", sans-serif'; context.fillText('Mira Vale · 1,287 plays', 42, 908); context.fillText('68%', 488, 908);
        context.font = '16px "Mova DM Sans", sans-serif'; context.fillText('A fictional year in music · Mova Blocks', 42, 995);
        if (active) setImage(canvas.toDataURL('image/png'));
      } catch { if (active) setStatus('Could not create your recap. Close and try again.'); }
    };
    void render(); return () => { active = false; };
  }, [share, image]);
  const go = (next: number) => {
    const nextPage = Math.max(0, Math.min(2, next));
    if (nextPage === page) return;
    const root = recap.current;
    // Story buttons unmount on navigation; keep keyboard focus in the recap.
    if (root && !root.querySelector('.tempo-header')?.contains(document.activeElement)) root.focus({ preventScroll: true });
    setPage(nextPage);
  };
  const value = String(minutes).padStart(5, '0');
  return <div ref={recap} role="group" className={`wrapped-block tempo-page-${page}`} data-thumbnail={thumbnail || undefined} tabIndex={thumbnail ? -1 : 0} aria-label="Tempo 2026 music recap" onKeyDown={event => { if (share) return; if (event.key === 'ArrowRight') { event.preventDefault(); go(page + 1); } if (event.key === 'ArrowLeft') { event.preventDefault(); go(page - 1); } }}>
    <header className="tempo-header"><nav aria-label="Recap pages">{labels.map((label, index) => <button key={label} aria-label={`Page ${index + 1}: ${label}`} aria-current={page === index ? 'step' : undefined} onClick={() => go(index)} className={index <= page ? 'is-seen' : ''} />)}</nav><div><button aria-label="Restart music recap" onClick={() => go(0)}><TempoLogo /></button><span>2026 WRAPPED</span></div></header>
    <section key={page} className="tempo-story" aria-label={labels[page]}>
      {page === 0 && <><h2>This year, you listened for</h2><div className="tempo-minutes" aria-label="48,213 minutes"><span aria-hidden="true">{value.slice(0, 2)},</span><span aria-hidden="true">{value.slice(2)}</span><small>MIN<br />UTES</small></div><div className="tempo-time"><strong>33 DAYS</strong><span>11 hours 33 minutes</span></div><img className="tempo-records" src={art.records} alt="A cascading stack of vinyl records, illustrating a year filled with music" /><button className="tempo-next" onClick={() => go(1)}>Meet your top artist<ArrowRight size={26} strokeWidth={1.5} /></button></>}
      {page === 1 && <><h2>Your most-loved artist</h2><h3 className="tempo-artist-name">MIRA<br />VALE</h3><span className="tempo-artist-side">MIRA VALE</span><img className="tempo-singer" src={art.singer} alt="Original illustration of fictional singer Mira Vale holding a microphone" /><div className="tempo-artist-stats"><div><p>You played her songs</p><strong>1,287<small>times</small></strong></div><div><p>You’re in her top</p><strong>0.7<small>%</small></strong><span>of listeners</span></div></div><button className="tempo-next" onClick={() => go(2)}>Discover your music personality<ArrowRight size={26} strokeWidth={1.5} /></button></>}
      {page === 2 && <><h2 className="tempo-personality-kicker">Your music personality</h2><h3 className="tempo-personality-name">NIGHT<br />OWL<span>ROMANTIC</span></h3><img className="tempo-moon" src={art.moon} alt="A lime crescent moon listening with blue headphones" /><p className="tempo-description">The later it gets, the longer you listen.<br />When the world goes quiet,<br />you find a song that understands.</p><div className="tempo-personality-stats"><div><span>AFTER DARK</span><strong>68<small>%</small></strong><p>After 11 PM</p></div><div><span>YOUR REPEAT FAVORITE</span><b>“Evening Rewind”</b><p>Played 216 times this year</p></div></div><button className="tempo-share" ref={shareButton} onClick={() => { setShare(true); setStatus(''); }}>Share my year<ArrowRight size={24} /></button></>}
    </section>
    <span className="tempo-sr-only" aria-live="polite">Page {page + 1} of 3: {labels[page]}</span>
    {share && <dialog ref={dialog} aria-label="Save your Tempo recap" className="tempo-share-dialog" onCancel={event => { event.preventDefault(); setShare(false); }} onClick={event => { if (event.target === event.currentTarget) setShare(false); }}><div className="tempo-share-panel"><header><h2>A year worth sharing.</h2><button aria-label="Close recap sharing" onClick={() => setShare(false)}><X size={22} /></button></header>{image ? <img src={image} alt="Tempo 2026 recap: Night Owl Romantic, 48,213 minutes, Mira Vale, 68 percent after dark" /> : <div className="tempo-share-loading" role="status">Making your recap…</div>}<button className="tempo-download" disabled={!image} onClick={() => { const link = document.createElement('a'); link.href = image; link.download = 'tempo-2026-wrapped.png'; link.click(); setStatus('Recap image saved'); }}>Save recap image<ArrowDown size={20} /></button><p role="status">{status || 'Fictional listening data. Made for the demo.'}</p></div></dialog>}
  </div>;
}
