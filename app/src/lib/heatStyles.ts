import type { HeatPoint } from './types';

export type HeatStyle = 'blur' | 'hex';

export const HEAT_STYLES: { id: HeatStyle; label: string }[] = [
  { id: 'blur', label: 'Blob' },
  { id: 'hex', label: 'Hex' },
];

type Poly = [number, number][];
interface RiskFeature {
  type: 'Feature';
  properties: { risk: number };
  geometry: { type: 'Polygon'; coordinates: Poly[] };
}
export interface RiskFC {
  type: 'FeatureCollection';
  features: RiskFeature[];
}

const EMPTY: RiskFC = { type: 'FeatureCollection', features: [] };
const HEX_DEG = 0.0034; // hex size (deg)
const MIN_RISK = 0.04; // drop near-empty cells for a clean look

function feature(risk: number, coords: Poly): RiskFeature {
  return { type: 'Feature', properties: { risk }, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/** Pointy-top hexagonal binning, with punchy contrast so danger reads loud. */
function hexFC(points: HeatPoint[]): RiskFC {
  const size = HEX_DEG;
  const cells = new Map<string, { sum: number; q: number; r: number }>();
  const axialRound = (q: number, r: number) => {
    const x = q;
    const z = r;
    const y = -x - z;
    let rx = Math.round(x);
    let ry = Math.round(y);
    let rz = Math.round(z);
    const dx = Math.abs(rx - x);
    const dy = Math.abs(ry - y);
    const dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return { q: rx, r: rz };
  };
  for (const p of points) {
    const q = ((Math.sqrt(3) / 3) * p.lng - (1 / 3) * p.lat) / size;
    const r = ((2 / 3) * p.lat) / size;
    const { q: rq, r: rr } = axialRound(q, r);
    const key = `${rq},${rr}`;
    const c = cells.get(key) ?? { sum: 0, q: rq, r: rr };
    c.sum += p.w;
    cells.set(key, c);
  }
  let max = 0;
  cells.forEach((c) => (max = Math.max(max, c.sum)));
  if (max <= 0) return EMPTY;
  const features: RiskFeature[] = [];
  cells.forEach((c) => {
    // lower exponent => mid-risk hexes light up hotter (more "danger")
    const risk = Math.pow(c.sum / max, 0.5);
    if (risk < MIN_RISK) return;
    const cx = size * Math.sqrt(3) * (c.q + c.r / 2);
    const cy = size * (3 / 2) * c.r;
    const corners: Poly = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30);
      corners.push([cx + size * Math.cos(ang), cy + size * Math.sin(ang)]);
    }
    corners.push(corners[0]);
    features.push(feature(risk, corners));
  });
  return { type: 'FeatureCollection', features };
}

export function buildRiskPolygons(points: HeatPoint[], style: HeatStyle): RiskFC {
  if (style === 'blur' || !points.length) return EMPTY;
  return hexFC(points);
}

