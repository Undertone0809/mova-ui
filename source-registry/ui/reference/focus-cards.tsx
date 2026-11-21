'use client';

import * as React from 'react';

export interface FocusCardItem {
  id: string;
  title: string;
  description?: string;
  imageSrc?: string;
  imageAlt?: string;
  label?: string;
}
export interface FocusCardsProps {
  items?: FocusCardItem[];
  onSelect?: (item: FocusCardItem) => void;
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}
const defaults: FocusCardItem[] = [
  {
    id: 'observe',
    title: 'Observe',
    description: 'Find something you missed.',
  },
  { id: 'collect', title: 'Collect', description: 'Keep what stays with you.' },
  { id: 'connect', title: 'Connect', description: 'Let the pieces meet.' },
];

/** Hovering or focusing one image softly blurs its neighbors and reveals its caption. */
export function FocusCards({
  items = defaults,
  onSelect,
  theme = 'light',
  className = '',
  style,
}: FocusCardsProps) {
  const [hover, setHover] = React.useState<string | null>(null);
  const [focus, setFocus] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const active = hover ?? focus ?? selected;
  return (
    <div
      className={`mova-focus-cards ${className}`}
      data-theme={theme}
      style={style}
      onPointerLeave={() => setHover(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocus(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setSelected(null);
          setHover(null);
          setFocus(null);
        }
      }}
    >
      <style>{css}</style>
      {items.length ? (
        <div className="mfc-grid">
          {items.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className="mfc-item"
              data-dimmed={active !== null && active !== item.id}
              data-active={active === item.id}
              aria-pressed={selected === item.id}
              aria-label={item.title}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'touch') setHover(item.id);
              }}
              onFocus={() => setFocus(item.id)}
              onClick={() => {
                setSelected((value) => (value === item.id ? null : item.id));
                onSelect?.(item);
              }}
            >
              {item.imageSrc ? (
                <img src={item.imageSrc} alt={item.imageAlt ?? ''} draggable={false} />
              ) : (
                <span className="mfc-art" aria-hidden="true">
                  {['◌', '▧', '✳'][index % 3]}
                </span>
              )}
              <span className="mfc-caption">
                <strong>{item.title}</strong>
                {item.description && <span>{item.description}</span>}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p>Your collection has room to grow.</p>
      )}
    </div>
  );
}
const css = `
.mova-focus-cards{width:920px;max-width:100%;font:14px/1.5 Inter,system-ui,sans-serif}
.mfc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.mfc-item{position:relative;isolation:isolate;display:block;width:100%;height:320px;min-width:0;padding:0;border:0;border-radius:8px;overflow:hidden;background:#9da79b;color:#fff;text-align:left;cursor:pointer;transition:filter 300ms ease,transform 300ms ease}
.mfc-item[data-dimmed='true']{filter:blur(4px);transform:scale(.98)}.mfc-item:focus-visible{outline:3px solid #a4b7b1;outline-offset:5px}
.mfc-item>img,.mfc-art{display:block;width:100%;height:100%;object-fit:cover}.mfc-art{display:grid;place-items:center;font-size:90px;background:#9ca89a}
.mfc-caption{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:24px 20px;background:#111a245e;opacity:0;transition:opacity 300ms ease}
.mfc-item[data-active='true'] .mfc-caption{opacity:1}.mfc-caption strong{font-size:23px;font-weight:500;line-height:1.2;letter-spacing:-.4px}.mfc-caption>span{font-size:12px;margin-top:8px;color:#fff9}
@media(max-width:700px){.mfc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.mfc-item{height:250px}.mfc-caption{padding:20px 16px}.mfc-caption strong{font-size:20px}}
@media(max-width:420px){.mfc-grid{grid-template-columns:1fr}.mfc-item{height:300px}}
@media(prefers-reduced-motion:reduce){.mfc-item,.mfc-caption{transition:none}.mfc-item[data-dimmed='true']{transform:none}}
`;
