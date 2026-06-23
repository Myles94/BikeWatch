import { useEffect, useRef, useState } from 'react';
import type { CopilotResult } from '../lib/types';
import { SUGGESTED_PROMPTS } from '../lib/copilot';

interface ChatItem {
  role: 'user' | 'bot';
  text: string;
  bullets?: string[];
}

interface CopilotPanelProps {
  onAsk: (question: string) => CopilotResult;
}

export default function CopilotPanel({ onAsk }: CopilotPanelProps) {
  const [items, setItems] = useState<ChatItem[]>([
    {
      role: 'bot',
      text: "I'm BikeWatch Copilot — your mobility safety assistant. Ask me where to park, what to avoid, or for a safer route home.",
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, thinking]);

  const submit = (q: string) => {
    const question = q.trim();
    if (!question || thinking) return;
    setItems((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setThinking(true);
    // brief delay to feel intentional
    setTimeout(() => {
      const res = onAsk(question);
      setItems((prev) => [
        ...prev,
        { role: 'bot', text: res.answer, bullets: res.bullets },
      ]);
      setThinking(false);
    }, 650);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">BikeWatch Copilot</div>
          <div className="text-[11px] text-slate-400">Safety guidance · live</div>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-safe">
          <span className="h-1.5 w-1.5 rounded-full bg-safe shadow-[0_0_8px_#22c55e]" />
          online
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {items.map((it, idx) => (
          <div
            key={idx}
            className={`animate-slideUp ${it.role === 'user' ? 'flex justify-end' : ''}`}
          >
            <div
              className={
                it.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm font-medium text-ink'
                  : 'max-w-[92%] rounded-2xl rounded-bl-md border border-edge bg-panel-2 px-3.5 py-2.5 text-sm text-slate-100'
              }
            >
              <p className="leading-snug">{it.text}</p>
              {it.bullets && (
                <ul className="mt-2 space-y-1.5">
                  {it.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] text-slate-300">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
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
            <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-edge bg-panel-2 px-3.5 py-3">
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
              className="rounded-full border border-edge bg-panel-2 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-brand hover:text-brand"
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
          className="flex items-center gap-2 rounded-xl border border-edge bg-panel-2 px-3 py-2 focus-within:border-brand"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about parking, routes, or risk…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-ink transition hover:bg-brand-2 disabled:opacity-40"
            disabled={!input.trim()}
            aria-label="Send"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m5 12 14-7-7 14-2-5-5-2Z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
