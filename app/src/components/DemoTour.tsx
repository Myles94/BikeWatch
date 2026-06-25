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

// Minimal recording control: a compact pill (no teleprompter script) so the
// presenter can drive the tour without a bulky overlay in the recording.
export default function DemoTour({ active, step, total, onPrev, onNext, onExit }: DemoTourProps) {
  if (!active) return null;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  return (
    <div className="pointer-events-none absolute left-1/2 top-[84px] z-50 -translate-x-1/2">
      <div className="tac-panel pointer-events-auto animate-slideUp flex items-center gap-2 px-2 py-1.5">
        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_6px_var(--signal)] animate-livePulse" />
        <span className="mono text-[10px] tracking-[0.12em] text-muted">
          {String(step + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <button
          onClick={onPrev}
          disabled={isFirst}
          aria-label="Back"
          className="grid h-6 w-6 place-items-center border border-edge text-slate-300 transition enabled:hover:bg-white/5 enabled:hover:text-white disabled:opacity-30"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
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
        <button
          onClick={onExit}
          aria-label="Exit"
          className="grid h-6 w-6 place-items-center text-muted transition hover:text-white"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
