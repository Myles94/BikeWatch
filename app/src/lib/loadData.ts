import type { HeatPoint, Incident, RiskModel, Temporal, Zone } from './types';

export interface RiskData {
  incidents: Incident[];
  heatPoints: HeatPoint[];
  zones: Zone[];
  temporal: Temporal | null;
  model: RiskModel | null;
}

const EMPTY: RiskData = {
  incidents: [],
  heatPoints: [],
  zones: [],
  temporal: null,
  model: null,
};

/**
 * Loads the real-data risk layer produced by the APD pipeline
 * (data-pipeline/*.py -> public/data/*.json). Fails soft so the app still
 * renders curated demo data if the files are missing.
 */
export async function loadRiskData(base = import.meta.env.BASE_URL || '/'): Promise<RiskData> {
  const url = (name: string) => `${base}data/${name}`.replace(/\/{2,}/g, '/');
  try {
    const [incidents, heatPoints, zones, temporal, model] = await Promise.all([
      fetch(url('incidents.json')).then((r) => (r.ok ? r.json() : [])),
      fetch(url('heat-points.json')).then((r) => (r.ok ? r.json() : [])),
      fetch(url('zones.json')).then((r) => (r.ok ? r.json() : [])),
      fetch(url('temporal.json')).then((r) => (r.ok ? r.json() : null)),
      fetch(url('model.json')).then((r) => (r.ok ? r.json() : null)),
    ]);
    return { incidents, heatPoints, zones, temporal, model };
  } catch {
    return EMPTY;
  }
}
