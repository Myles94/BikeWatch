import { useEffect } from 'react';

interface OutroProps {
  open: boolean;
  onBackToMap: () => void;
  onReplay: () => void;
}

export default function Outro({ open, onBackToMap, onReplay }: OutroProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onBackToMap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onBackToMap]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[60] grid place-items-center overflow-hidden bg-ink">
      {/* faint ops grid + vignette to match the app */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgb(var(--signal-rgb) / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--signal-rgb) / 0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_240px_90px_rgba(3,5,10,0.85)]" />

      <div className="relative flex flex-col items-center text-center animate-bootIn">
        <div className="mono mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-safe shadow-[0_0_8px_#21d07a] animate-livePulse" />
          Theft intelligence · Atlanta, GA
        </div>

        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center bg-brand text-[color:var(--on-signal)]">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.3" />
              <circle cx="18.5" cy="17.5" r="3.3" />
              <path d="M5.5 17.5 9 7h4l3 7m-6.5 3.5h7M13 7l2.5 4" />
            </svg>
          </span>
          <div className="font-display text-[56px] font-extrabold uppercase leading-none tracking-[0.06em] text-white">
            Bike<span className="text-brand">Watch</span>
          </div>
        </div>

        <div className="mt-7 font-display text-[22px] font-bold tracking-[0.02em] text-slate-100">
          Every rider, a lookout.
        </div>
        <div className="mono mt-3 text-[11px] uppercase tracking-[0.34em] text-brand">
          Spotted · Reported · Recovered
        </div>

        <div className="mt-10 flex items-center gap-3">
          <button
            onClick={onBackToMap}
            className="flex items-center gap-2 border border-brand bg-brand px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--on-signal)] transition hover:brightness-110"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3Z" /><path d="M9 7v13M15 4v13" />
            </svg>
            Back to the map
          </button>
          <button
            onClick={onReplay}
            className="flex items-center gap-2 border border-edge bg-panel/80 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300 transition hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
            </svg>
            Replay demo
          </button>
        </div>
      </div>
    </div>
  );
}
