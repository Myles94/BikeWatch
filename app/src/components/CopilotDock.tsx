import { useEffect, useRef, useState } from 'react';
import type { CopilotResult } from '../lib/types';
import { SUGGESTED_PROMPTS } from '../lib/copilot';

interface ChatItem {
  role: 'user' | 'bot';
  text: string;
  bullets?: string[];
}

interface CopilotDockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAsk: (question: string) => CopilotResult;
  autoAsk?: { question: string; key: number } | null;
}

function CoreIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" />
      <path d="M9.5 9.5h5v5h-5z" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  );
}

export default function CopilotDock({ open, onOpenChange, onAsk, autoAsk }: CopilotDockProps) {
  const [items, setItems] = useState<ChatItem[]>([
    {
      role: 'bot',
      text: 'Theft-intelligence console online. I track live activity across Atlanta - ask where to park, what to avoid, or for a safer route home.',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, thinking, open]);

  const submit = (q: string) => {
    const question = q.trim();
    if (!question || thinking) return;
    setItems((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setThinking(true);
    setTimeout(() => {
      const res = onAsk(question);
      setItems((prev) => [...prev, { role: 'bot', text: res.answer, bullets: res.bullets }]);
      setThinking(false);
    }, 600);
  };

  // Auto-ask a question (demo tour drives this) with a brief "typing" feel.
  const lastAutoRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoAsk || autoAsk.key === lastAutoRef.current) return;
    lastAutoRef.current = autoAsk.key;
    setInput(autoAsk.question);
    const t = setTimeout(() => submit(autoAsk.question), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAsk]);

  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-30 flex flex-col items-end gap-3">
      {/* Panel */}
      <div
        className={`tac-panel pointer-events-auto flex w-[378px] max-w-[90vw] origin-bottom-right flex-col overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.65)] transition-all duration-200 ${
          open
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-3 scale-95 opacity-0'
        }`}
        style={{ height: open ? 'min(564px, 72vh)' : 0 }}
      >
        <div className="flex items-center gap-2.5 border-b border-edge px-4 py-3">
          <span className="grid h-8 w-8 place-items-center border border-brand/50 bg-brand/10 text-brand">
            <CoreIcon />
          </span>
          <div className="leading-tight">
            <div className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-white">
              Copilot
            </div>
            <div className="mono mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-safe animate-livePulse" />
              Monitoring live
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="ml-auto grid h-7 w-7 place-items-center text-muted transition hover:bg-white/5 hover:text-white"
            aria-label="Close copilot"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {items.map((it, idx) => (
            <div key={idx} className={`animate-slideUp ${it.role === 'user' ? 'flex justify-end' : ''}`}>
              <div
                className={
                  it.role === 'user'
                    ? 'max-w-[85%] bg-brand px-3.5 py-2 text-[13px] font-medium text-[color:var(--on-signal)]'
                    : 'max-w-[92%] border border-edge border-l-2 border-l-brand bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-slate-100'
                }
              >
                <p className="leading-snug">{it.text}</p>
                {it.bullets && (
                  <ul className="mt-2.5 space-y-1.5">
                    {it.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2 text-[12px] text-slate-300">
                        <span className="mono mt-px text-[10px] text-brand">{String(i + 1).padStart(2, '0')}</span>
                        <span className="leading-snug">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="animate-slideUp">
              <div className="inline-flex items-center gap-1.5 border border-edge bg-white/[0.03] px-3.5 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-edge px-3 py-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => submit(p)}
                className="mono border border-edge bg-white/[0.02] px-2.5 py-1 text-[10px] uppercase tracking-[0.06em] text-slate-300 transition hover:border-brand/60 hover:text-brand"
              >
                {p}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex items-center gap-2 border border-edge bg-white/[0.02] px-3 py-2 focus-within:border-brand/60"
          >
            <span className="mono text-[12px] text-brand">{'>'}</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query parking, routes, or risk…"
              className="mono flex-1 bg-transparent text-[12px] text-slate-100 placeholder:text-muted focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="grid h-7 w-7 place-items-center bg-brand text-[color:var(--on-signal)] transition hover:bg-brand-2 disabled:opacity-40"
              aria-label="Send"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 12 14-7-7 14-2-5-5-2Z" /></svg>
            </button>
          </form>
        </div>
      </div>

      {/* Launcher */}
      <button
        onClick={() => onOpenChange(!open)}
        className={`pointer-events-auto flex items-center gap-2 border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] shadow-lg transition ${
          open
            ? 'border-edge bg-panel/90 text-slate-300 hover:text-white'
            : 'border-brand bg-brand text-[color:var(--on-signal)] hover:bg-brand-2'
        }`}
      >
        <CoreIcon />
        {open ? 'Hide Copilot' : 'Ask Copilot'}
      </button>
    </div>
  );
}
