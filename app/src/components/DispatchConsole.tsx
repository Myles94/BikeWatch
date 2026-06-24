import type { DispatchStatus } from '../lib/types';

export interface Dispatch {
  id: string; // theft incident id
  caseId: string;
  title: string;
  place: string;
  status: DispatchStatus;
  escalatedBy: string;
  startedAt: number;
}

interface DispatchConsoleProps {
  dispatches: Dispatch[];
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}

const STEPS: { key: DispatchStatus; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'responding', label: 'Responding' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_COPY: Record<DispatchStatus, string> = {
  submitted: 'Report relayed to APD dispatch queue',
  acknowledged: 'Dispatcher acknowledged - assigning a unit',
  responding: 'Officer en route · ETA ~6 min',
  resolved: 'Case closed by responding unit',
};

function clock(at: number) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function DispatchConsole({ dispatches, onResolve, onDismiss }: DispatchConsoleProps) {
  if (dispatches.length === 0) return null;

  return (
    <div className="absolute bottom-5 left-1/2 z-30 flex w-[380px] max-w-[92vw] -translate-x-1/2 flex-col gap-2.5">
      {dispatches.map((d) => {
        const idx = STEPS.findIndex((s) => s.key === d.status);
        const accent = d.status === 'resolved' ? '#21d07a' : '#ff453a';
        return (
          <div key={d.id} className="tac-panel animate-slideUp overflow-hidden">
            <div className="flex items-center justify-between border-b border-edge px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full animate-livePulse"
                  style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
                />
                <span className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-white">
                  APD Dispatch
                </span>
                <span className="mono text-[10px] tracking-[0.06em] text-muted">{d.caseId}</span>
              </div>
              <button
                onClick={() => onDismiss(d.id)}
                className="grid h-5 w-5 place-items-center text-muted transition hover:text-white"
                aria-label="Dismiss"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-3.5 pb-3 pt-2.5">
              <div className="text-[12.5px] font-semibold leading-snug text-slate-100">{d.title}</div>
              <div className="mono mt-1 text-[9px] uppercase tracking-[0.1em] text-muted">
                {d.place} · escalated by {d.escalatedBy} · {clock(d.startedAt)}
              </div>

              {/* status timeline */}
              <div className="mt-3 flex items-center">
                {STEPS.map((s, i) => {
                  const done = i <= idx;
                  const isResolvedStep = s.key === 'resolved';
                  const dot = done ? (isResolvedStep ? '#21d07a' : '#ff453a') : '#243049';
                  return (
                    <div key={s.key} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <span
                          className={`grid h-4 w-4 place-items-center rounded-full ${i === idx ? 'animate-livePulse' : ''}`}
                          style={{ background: dot }}
                        >
                          {done && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#06080d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          )}
                        </span>
                        <span
                          className="mono text-[8px] uppercase tracking-[0.06em] whitespace-nowrap"
                          style={{ color: done ? '#c7d2ec' : '#5b667d' }}
                        >
                          {s.label}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <span
                          className="mx-1 mb-4 h-px flex-1"
                          style={{ background: i < idx ? accent : '#243049' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mono mt-2.5 flex items-center justify-between text-[10px] tracking-[0.04em] text-slate-300">
                <span>{STATUS_COPY[d.status]}</span>
                {d.status === 'responding' && (
                  <button
                    onClick={() => onResolve(d.id)}
                    className="ml-2 shrink-0 border border-safe/60 bg-safe/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-safe transition hover:bg-safe/20"
                  >
                    Mark resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
