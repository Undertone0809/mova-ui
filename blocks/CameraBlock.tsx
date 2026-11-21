import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, Check, ChevronRight, Focus, Grid3X3, X, Zap, ZapOff } from 'lucide-react';
import './blocks-shared.css';
import './camera-block.css';

const scene = new URL('./assets/street-corner.webp', import.meta.url).href;
const films = [
  { id: 'daylight', name: 'Daylight', iso: '200', detail: 'Warm tones · Fine grain', short: 'Warm everyday', filter: 'sepia(.16) saturate(.86) contrast(1.03)' },
  { id: 'coast', name: 'Coast', iso: '400', detail: 'Cool tones · Blue shadows', short: 'Cool blue shadows', filter: 'sepia(.16) hue-rotate(155deg) saturate(.65) contrast(.98)' },
  { id: 'silver', name: 'Silver', iso: '100', detail: 'Black & white · Rich detail', short: 'Monochrome stories', filter: 'grayscale(1) contrast(1.1)' },
];
type Photo = { film: number; exposure: number; zoom: number; time: string };

export function CameraBlock({ thumbnail = false }: { thumbnail?: boolean }) {
  const [film, setFilm] = useState(0);
  const [exposure, setExposure] = useState(0);
  const [grid, setGrid] = useState(false);
  const [flash, setFlash] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [sheet, setSheet] = useState(false);
  const [album, setAlbum] = useState(false);
  const [count, setCount] = useState(8);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [point, setPoint] = useState({ x: 50, y: 50, visible: false });
  const [photo, setPhoto] = useState<Photo>({ film: 0, exposure: 0, zoom: 1, time: 'Oct 1 · 4:28 PM' });
  const dialog = useRef<HTMLDialogElement>(null);
  const filmButton = useRef<HTMLButtonElement>(null);
  const captureTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (captureTimeout.current) clearTimeout(captureTimeout.current); }, []);
  useEffect(() => {
    if (!sheet) return;
    const el = dialog.current;
    el?.showModal();
    return () => { el?.close(); filmButton.current?.focus({ preventScroll: true }); };
  }, [sheet]);
  const filter = (f: number, ev: number) => `${films[f].filter} brightness(${Math.pow(2, ev * .42)})`;
  const capture = () => {
    if (thumbnail || capturing || count >= 36) return;
    setCapturing(true);
    setCount(value => value + 1);
    setPhoto({ film, exposure, zoom, time: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) });
    setStatus('Developing your photo…');
    captureTimeout.current = setTimeout(() => { setCapturing(false); setStatus('Photo added to your roll'); }, 850);
  };
  const save = async () => {
    setSaving(true);
    try {
      const image = new Image(); image.src = scene; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 1280;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
      context.filter = filter(photo.film, photo.exposure);
      const width = image.naturalWidth / photo.zoom, height = image.naturalHeight / photo.zoom;
      context.drawImage(image, (image.naturalWidth - width) / 2, (image.naturalHeight - height) / 2, width, height, 0, 0, 960, 1280);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image unavailable')), 'image/png'));
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `corner-${films[photo.film].id}-${count}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Photo saved');
    } catch { setStatus('Could not save this photo. Please try again.'); }
    finally { setSaving(false); }
  };
  return <div className="camera-block" data-thumbnail={thumbnail || undefined}>
    {album ? <section className="cb-album" aria-label="Your film roll">
      <header><button aria-label="Back to camera" onClick={() => setAlbum(false)}><ArrowLeft size={20} /></button><h2>Your film roll</h2><span>{String(count).padStart(2, '0')} / 36</span></header>
      <div className="cb-print"><img src={scene} alt="An original sunlit street-corner photograph" style={{ filter: filter(photo.film, photo.exposure), transform: `scale(${photo.zoom})` }} /></div>
      <div className="cb-photo-meta"><strong>{films[photo.film].name} {films[photo.film].iso}</strong><span>{photo.exposure.toFixed(1)} EV</span></div>
      <p>{photo.time}</p><button className="cb-save" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save photo'}<ArrowDown size={18} /></button>
      <small>Demo photography. No camera access required.</small>
    </section> : <>
      <header className="cb-header"><div className="cb-brand">corner<span className="cb-brand-dot" /><span className="cb-subtitle">FILM CAMERA</span></div><button aria-label={`Flash: ${flash ? 'auto' : 'off'}`} aria-pressed={flash} onClick={() => setFlash(!flash)}>{flash ? <Zap size={20} /> : <ZapOff size={20} />}</button><button aria-label={grid ? 'Hide composition grid' : 'Show composition grid'} aria-pressed={grid} onClick={() => setGrid(!grid)}><Grid3X3 size={20} /></button></header>
      <div className="cb-viewfinder" aria-label="Demo street viewfinder" onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); setPoint({ x: (event.clientX - bounds.left) / bounds.width * 100, y: (event.clientY - bounds.top) / bounds.height * 100, visible: true }); }}>
        <img src={scene} alt="Sunlight and tree shadows on a cream-stone shop with a green storefront" style={{ filter: filter(film, exposure), transform: `scale(${zoom})` }} />
        {grid && <div className="cb-grid" aria-hidden="true" />}
        <span className="cb-crop">CROP 3:4</span>
        {point.visible && <Focus className="cb-focus" size={58} strokeWidth={1} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-hidden="true" />}
        <div className="cb-viewfinder-foot"><span><b>{zoom === 1 ? 28 : 42}</b> mm</span><button aria-label={`Focal length: ${zoom} times`} onClick={event => { event.stopPropagation(); setZoom(zoom === 1 ? 1.5 : 1); }}>{zoom}×</button><span>Auto metering</span></div>
        {capturing && <div className="cb-shutter-flash" aria-hidden="true" />}
      </div>
      <div className="cb-controls">
        <button className="cb-film-trigger" ref={filmButton} onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet}>
          <span className={`cb-film-can cb-can-${films[film].id}`} aria-hidden="true">{films[film].iso}</span><span><strong>{films[film].name} <b>{films[film].iso}</b></strong><small>{films[film].detail}</small></span><span className="cb-change">Change film<ChevronRight size={14} /></span>
        </button>
        <div className="cb-exposure-label"><label htmlFor={thumbnail ? 'camera-ev-thumb' : 'camera-ev'}>Exposure compensation</label><span><b>{exposure > 0 ? '+' : ''}{exposure.toFixed(1)}</b> EV</span></div>
        <div className="cb-dial"><input id={thumbnail ? 'camera-ev-thumb' : 'camera-ev'} aria-label="Exposure compensation" type="range" min={-2} max={2} step={.1} value={exposure} onChange={event => setExposure(Number(event.target.value))} /><div aria-hidden="true"><span>−2</span><span>−1</span><span>0</span><span>+1</span><span>+2</span></div></div>
        <div className="cb-shoot-row"><button className="cb-album-button" onClick={() => setAlbum(true)} aria-label="Open film roll"><span><img src={scene} alt="Most recent demo photo" style={{ filter: filter(photo.film, photo.exposure) }} /></span><small>Album</small></button><button className="cb-shutter" aria-label="Take photo" disabled={capturing || count >= 36} onClick={capture}><span /></button><div className="cb-counter"><span><b>{String(count).padStart(2, '0')}</b> / 36</span><small>{count >= 36 ? 'Roll complete' : 'Frames exposed'}</small></div></div>
      </div>
      {capturing && <div className="cb-flying-photo" aria-hidden="true"><img src={scene} alt="" style={{ filter: filter(film, exposure) }} /></div>}
      {sheet && <dialog ref={dialog} aria-label="Choose film stock" className="cb-film-dialog" onCancel={event => { event.preventDefault(); setSheet(false); }} onClick={event => { if (event.target === event.currentTarget) setSheet(false); }}><div className="cb-film-sheet"><div className="cb-sheet-handle" /><header><h2>Load a new roll</h2><button aria-label="Close film selector" onClick={() => setSheet(false)}><X size={20} /></button></header><div className="cb-film-options" role="group" aria-label="Film stock">{films.map((value, index) => <button key={value.id} aria-pressed={film === index} onClick={() => { setFilm(index); setSheet(false); setStatus(`${value.name} ${value.iso} loaded`); }}><span className={film === index ? 'selected' : ''}><img src={scene} alt={`${value.name} film color preview`} style={{ filter: filter(index, 0) }} />{film === index && <Check size={18} />}</span><strong>{value.name} <b>{value.iso}</b></strong><small>{value.short}</small></button>)}</div><p>Fine grain <span>ISO {films[film].iso}</span></p></div></dialog>}
    </>}
    <div className="cb-status" role="status">{status}</div>
  </div>;
}
