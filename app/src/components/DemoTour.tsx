interface DemoTourProps {
  active: boolean;
  step: number;
  total: number;
  title: string;
  say: string;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

export default function DemoTour({ active, step, total, title, say, onPrev, onNext, onExit }: DemoTourProps) {
  if (!active) return null;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  return (
    <div className="pointer-events-none absolute left-1/2 top-[84px] z-50 w-[560px] max-w-[92vw] -translate-x-1/2">
      <div className="tac-panel pointer-events-auto animate-slideUp overflow-hidden">
        <div className="flex items-center justify-between border-b border-edge px-3.5 py-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_6px_var(--signal)] animate-livePulse" />
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
              Demo Tour
            </span>
            <span className="mono text-[10px] tracking-[0.1em] text-muted">
              {String(step + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={onExit}
            className="mono flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-muted transition hover:text-white"
          >
            Exit
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="font-display text-[15px] font-bold leading-snug text-white">{title}</div>
          <div className="mt-1.5 text-[12.5px] leading-snug text-slate-300">
            <span className="mono mr-1.5 text-[9px] uppercase tracking-[0.14em] text-brand">Say</span>
            {say}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-edge px-3.5 py-2">
          <span className="mono text-[9px] uppercase tracking-[0.12em] text-muted">
            → / Space · next &nbsp;·&nbsp; ← back &nbsp;·&nbsp; Esc exit
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              disabled={isFirst}
              className="mono border border-edge px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 transition enabled:hover:bg-white/5 enabled:hover:text-white disabled:opacity-30"
            >
              Back
            </button>
            <button
              onClick={onNext}
              className="mono flex items-center gap-1.5 bg-brand px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--on-signal)] transition hover:brightness-110"
            >
              {isLast ? 'Finish' : 'Next'}
              {!isLast && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
