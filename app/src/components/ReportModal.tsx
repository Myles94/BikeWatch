import { useEffect, useState } from 'react';
import type { Incident, IncidentType } from '../lib/types';
import { pickImage } from '../data/incidents';

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
    const finalTitle = title.trim() || (type === 'theft' ? 'Bike theft reported' : 'Suspicious activity');
    onSubmit({
      type,
      title: finalTitle,
      description: description.trim() || 'Reported via BikeWatch.',
      lat: coords.lat,
      lng: coords.lng,
      riskWeight: type === 'theft' ? 0.9 : 0.55,
      neighborhood: 'Reported',
      imageUrl: pickImage(finalTitle, Math.floor(Math.random() * 3)),
    });
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/65 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="tac-panel w-[428px] max-w-[92vw] animate-slideUp p-5 shadow-2xl"
      >
        <div className="mb-1 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center border border-danger/50 bg-danger/10 text-danger">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-white">
            Report incident
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-muted transition hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mono mb-4 text-[10px] uppercase tracking-[0.1em] text-muted">
          {coords
            ? `Coord ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
            : 'Click map to set location.'}
        </p>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`border px-3 py-2 text-left transition ${
                type === t.value
                  ? 'border-brand bg-brand/10'
                  : 'border-edge bg-panel-2 hover:border-edge-2'
              }`}
            >
              <div className="text-[13px] font-semibold text-slate-100">{t.label}</div>
              <div className="mono mt-0.5 text-[9px] uppercase tracking-[0.08em] text-muted">{t.hint}</div>
            </button>
          ))}
        </div>

        <label className="tac-label mb-1.5 block">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Bike stolen outside cafe"
          className="mb-3 w-full border border-edge bg-panel-2 px-3 py-2 text-[13px] focus:border-brand focus:outline-none"
        />

        <label className="tac-label mb-1.5 block">Details</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened?"
          rows={3}
          className="mb-4 w-full resize-none border border-edge bg-panel-2 px-3 py-2 text-[13px] focus:border-brand focus:outline-none"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="mono px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-slate-300 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!coords}
            className="bg-danger px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#e03b30] disabled:opacity-40"
          >
            Submit report
          </button>
        </div>
      </form>
    </div>
  );
}
