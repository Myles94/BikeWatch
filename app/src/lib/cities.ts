import type { HeatPoint, Incident } from './types';

export interface City {
  id: string;
  name: string;
  short: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  incidents: number; // headline count (mock for non-Atlanta)
  heat: HeatPoint[];
  markers: Incident[];
}

// Deterministic PRNG so every render/replay shows the same mock network.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MARKER_TITLES = [
  'Bike stolen from a transit rack',
  'Cut lock reported downtown',
  'Suspicious person testing locks',
  'E-scooter stripped overnight',
  'Bike grabbed outside a cafe',
  'Lock tampering near the park',
  'Commuter bike taken at a station',
];

function makeCityData(seedSrc: string, center: [number, number]): { heat: HeatPoint[]; markers: Incident[] } {
  let seed = 0;
  for (let i = 0; i < seedSrc.length; i++) seed = (seed * 31 + seedSrc.charCodeAt(i)) | 0;
  const rnd = mulberry32(seed);
  const [clng, clat] = center;

  // A few cluster cores so the heat reads as real hotspots, not noise.
  const cores = Array.from({ length: 4 }, () => ({
    lng: clng + (rnd() - 0.5) * 0.07,
    lat: clat + (rnd() - 0.5) * 0.06,
    intensity: 0.55 + rnd() * 0.45,
  }));

  const heat: HeatPoint[] = [];
  for (const core of cores) {
    const n = 10 + Math.floor(rnd() * 8);
    for (let i = 0; i < n; i++) {
      heat.push({
        lng: core.lng + (rnd() - 0.5) * 0.022,
        lat: core.lat + (rnd() - 0.5) * 0.02,
        w: Math.max(0.15, core.intensity * (0.5 + rnd() * 0.5)),
      });
    }
  }

  const now = Date.now();
  const markers: Incident[] = cores.flatMap((core, ci) =>
    Array.from({ length: 2 }, (_, mi) => {
      const isSusp = rnd() > 0.6;
      return {
        id: `net-${seedSrc}-${ci}-${mi}`,
        type: isSusp ? ('suspicious' as const) : ('theft' as const),
        title: MARKER_TITLES[Math.floor(rnd() * MARKER_TITLES.length)],
        description: 'Crowdsourced report from the local BikeWatch network.',
        lat: core.lat + (rnd() - 0.5) * 0.014,
        lng: core.lng + (rnd() - 0.5) * 0.016,
        timestamp: new Date(now - Math.floor(rnd() * 72) * 3600_000).toISOString(),
        riskWeight: isSusp ? 0.45 : 0.8,
        source: 'network',
      };
    }),
  );

  return { heat, markers };
}

const RAW: Omit<City, 'heat' | 'markers'>[] = [
  { id: 'atl', name: 'Atlanta', short: 'ATL', center: [-84.3853, 33.7701], zoom: 12.6, incidents: 1642 },
  { id: 'nyc', name: 'New York', short: 'NYC', center: [-73.9857, 40.7484], zoom: 12.0, incidents: 4880 },
  { id: 'chi', name: 'Chicago', short: 'CHI', center: [-87.6298, 41.8781], zoom: 11.8, incidents: 3120 },
  { id: 'bos', name: 'Boston', short: 'BOS', center: [-71.0589, 42.3601], zoom: 12.2, incidents: 2070 },
  { id: 'lax', name: 'Los Angeles', short: 'LA', center: [-118.2437, 34.0522], zoom: 11.2, incidents: 3960 },
  { id: 'clt', name: 'Charlotte', short: 'CLT', center: [-80.8431, 35.2271], zoom: 12.0, incidents: 1180 },
];

export const CITIES: City[] = RAW.map((c) => {
  const { heat, markers } = makeCityData(c.id, c.center);
  return { ...c, heat, markers };
});

export const cityById = (id: string) => CITIES.find((c) => c.id === id);
