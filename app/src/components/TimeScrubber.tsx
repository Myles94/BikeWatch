import type { Temporal } from '../lib/types';
import { type TimeSel, dayPart, formatHour, globalMultiplier } from '../lib/temporal';

interface TimeScrubberProps {
  sel: TimeSel;
  playing: boolean;
  temporal: Temporal | null;
  onHour: (h: number) => void;
  onDayType: (d: 'weekday' | 'weekend') => void;
  onTogglePlay: () => void;
  onNow: () => void;
}

export default function TimeScrubber({
  sel,
  playing,
  temporal,
  onHour,
  onDayType,
  onTogglePlay,
  onNow,
}: TimeScrubberProps) {
  const mult = globalMultiplier(temporal, sel);
  const rel = Math.round((mult - 1) * 100);
  const relLabel = rel >= 0 ? `+${rel}%` : `${rel}%`;
  const relTone = rel > 12 ? 'text-danger' : rel < -12 ? 'text-safe' : 'text-brand';

  return (
    <div className="pointer-events-auto absolute bottom-5 left-1/2 z-30 w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2">
      <div className="tac-panel animate-slideUp flex items-center gap-3 px-4 py-3">
        <button
          onClick={onTogglePlay}
          className="grid h-9 w-9 shrink-0 place-items-center bg-brand text-[#1a1300] transition hover:bg-brand-2"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z" /></svg>
          )}
        </button>

        <div className="flex w-[118px] shrink-0 flex-col">
          <div className="mono text-[15px] font-bold leading-none text-white">
            {formatHour(sel.hour)}
          </div>
          <div className="tac-label mt-1">
            {sel.dayType} · {dayPart(sel.hour)}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <input
            type="range"
            min={0}
            max={23}
            step={1}
            value={sel.hour}
            onChange={(e) => onHour(Number(e.target.value))}
            className="scrub w-full"
            aria-label="Hour of day"
          />
          <div className="mono flex justify-between px-0.5 text-[8px] tracking-[0.1em] text-muted">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center">
          <div className={`mono text-[15px] font-bold leading-none ${relTone}`}>{relLabel}</div>
          <div className="tac-label mt-1">vs avg</div>
        </div>

        <div className="flex shrink-0 border border-edge">
          {(['weekday', 'weekend'] as const).map((d) => (
            <button
              key={d}
              onClick={() => onDayType(d)}
              className={`mono px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] transition ${
                sel.dayType === d ? 'bg-brand text-[#1a1300]' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {d === 'weekday' ? 'WD' : 'WE'}
            </button>
          ))}
        </div>

        <button
          onClick={onNow}
          className="mono shrink-0 border border-edge px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-300 transition hover:border-brand/60 hover:text-brand"
        >
          Now
        </button>
      </div>
    </div>
  );
}
