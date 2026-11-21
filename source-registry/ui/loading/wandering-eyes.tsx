import React from 'react';

// Adapted from Loading UI's wandering-eyes component.
// Source: https://github.com/turbostarter/loading-ui/blob/main/registry/components/loading-ui/wandering-eyes.tsx

type WanderingEyesProps = React.ComponentProps<'span'> & {
  eyeScale?: number;
  gapScale?: number;
  pupilScale?: number;
  blinkScale?: number;
  travelScale?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function WanderingEyes({
  className = '',
  style,
  eyeScale = 0.62,
  gapScale = 0.09,
  pupilScale = 0.32,
  blinkScale = 0.375,
  travelScale = 0.3125,
  ...props
}: WanderingEyesProps) {
  const safeEyeScale = clamp(eyeScale, 0.28, 0.7);
  const safeGapScale = clamp(gapScale, 0.04, 0.3);
  const safePupilScale = clamp(pupilScale, 0.12, 0.45);
  const safeBlinkScale = clamp(blinkScale, 0.15, 1);
  const safeTravelScale = clamp(travelScale, 0.08, 0.5);
  const eyesStyle = {
    ...style,
    containerType: 'size',
    '--mova-wandering-eyes-eye': `${(safeEyeScale * 100).toFixed(2)}cqmin`,
    '--mova-wandering-eyes-gap': `${(safeGapScale * 100).toFixed(2)}cqmin`,
    '--mova-wandering-eyes-pupil-scale': `${safePupilScale}`,
    '--mova-wandering-eyes-blink': `${safeBlinkScale}`,
    '--mova-wandering-eyes-travel-scale': `${safeTravelScale}`,
  } as React.CSSProperties;

  return (
    <>
      <style>{`
        @keyframes mova-wandering-eyes-move {
          0%, 10% { background-position: 0 0; }
          13%, 40% { background-position: calc(var(--mova-wandering-eyes-eye) * var(--mova-wandering-eyes-travel-scale) * -1) 0; }
          43%, 70% { background-position: calc(var(--mova-wandering-eyes-eye) * var(--mova-wandering-eyes-travel-scale)) 0; }
          73%, 90% { background-position: 0 calc(var(--mova-wandering-eyes-eye) * var(--mova-wandering-eyes-travel-scale)); }
          93%, 100% { background-position: 0 0; }
        }
        @keyframes mova-wandering-eyes-blink {
          0%, 10%, 12%, 20%, 22%, 40%, 42%, 60%, 62%, 70%, 72%, 90%, 92%, 98%, 100% { height: var(--mova-wandering-eyes-eye); }
          11%, 21%, 41%, 61%, 71%, 91%, 99% { height: calc(var(--mova-wandering-eyes-eye) * var(--mova-wandering-eyes-blink)); }
        }
        .mova-wandering-eyes__pair {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--mova-wandering-eyes-gap);
        }
        .mova-wandering-eyes__eye {
          display: inline-block;
          width: var(--mova-wandering-eyes-eye);
          height: var(--mova-wandering-eyes-eye);
          border-radius: 999px;
          background-color: color-mix(in srgb, currentColor 16%, transparent);
          background-image: radial-gradient(circle calc(var(--mova-wandering-eyes-eye) * var(--mova-wandering-eyes-pupil-scale)), currentColor 100%, transparent 0);
          background-repeat: no-repeat;
          animation: mova-wandering-eyes-move var(--duration, 10s) infinite, mova-wandering-eyes-blink var(--duration, 10s) infinite;
        }
      `}</style>
      <span
        role="status"
        aria-label="Loading"
        className={`mova-wandering-eyes relative inline-flex aspect-[9/4] items-center justify-center align-middle ${className}`}
        style={eyesStyle}
        {...props}
      >
        <span aria-hidden="true" className="mova-wandering-eyes__pair">
          <span className="mova-wandering-eyes__eye" />
          <span className="mova-wandering-eyes__eye" />
        </span>
        <span className="sr-only">Loading</span>
      </span>
    </>
  );
}
