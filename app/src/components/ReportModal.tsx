import { useEffect, useState } from 'react';
import type { Incident, IncidentType } from '../lib/types';

interface ReportModalProps {
  open: boolean;
  coords: { lat: number; lng: number } | null;
  onClose: () => void;
  onSubmit: (incident: Omit<Incident, 'id' | 'timestamp' | 'isNew'>) => void;
}

const TYPES: { value: IncidentType; label: string; hint: string }[] = [
  { value: 'theft', label: 'Theft', hint: 'A bike or part was stolen' },
  { value: 'suspicious', label: 'Suspicious', hint: 'Suspicious activity nearby' },
];

export default function ReportModal({ open, coords, onClose, onSubmit }: ReportModalProps) {
  const [type, setType] = useState<IncidentType>('theft');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setType('theft');
      setTitle('');
      setDescription('');
    }
  }, [open]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) return;
    onSubmit({
      type,
      title: title.trim() || (type === 'theft' ? 'Bike theft reported' : 'Suspicious activity'),
      description: description.trim() || 'Reported via BikeWatch.',
      lat: coords.lat,
      lng: coords.lng,
      riskWeight: type === 'theft' ? 0.9 : 0.55,
      neighborhood: 'Reported',
    });
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-[420px] max-w-[92vw] animate-slideUp rounded-2xl border border-edge bg-panel p-5 shadow-2xl"
      >
        <div className="mb-1 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-danger/15 text-danger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold">Report an incident</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-slate-400 transition hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          {coords
            ? `Location: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
            : 'Click the map to set a location.'}
        </p>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                type === t.value
                  ? 'border-brand bg-brand/10'
                  : 'border-edge bg-panel-2 hover:border-slate-500'
              }`}
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-[11px] text-slate-400">{t.hint}</div>
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-300">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Bike stolen outside cafe"
          className="mb-3 w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />

        <label className="mb-1 block text-xs font-medium text-slate-300">Details</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened?"
          rows={3}
          className="mb-4 w-full resize-none rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-300 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!coords}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-40"
          >
            Submit report
          </button>
        </div>
      </form>
    </div>
  );
}
