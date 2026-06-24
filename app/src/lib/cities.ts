import type { HeatPoint, Incident } from './types';

export interface City {
  id: string;
  name: string;
  short: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  incidents: number; // headline count (mock for non-Atlanta)
  hotspots: { name: string; lng: number; lat: number; weight: number }[];
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

// Believable, neighborhood-flavored report copy. {hood} is the local district.
const THEFT_TITLES = [
  'Locked bike cut outside {hood}',
  'Bike stolen from a {hood} transit rack',
  'U-lock defeated near {hood}',
  'Commuter bike taken at {hood} station',
  'E-bike grabbed off a {hood} porch',
];
const SUSPICIOUS_TITLES = [
  'Person testing locks in {hood}',
  'Lock tampering reported in {hood}',
  'Two riders casing racks near {hood}',
  'Bolt cutters spotted around {hood}',
];

const REPORTERS = [
  '@dailycommuter',
  '@nightshift_rider',
  '@bikebus_local',
  '@lockedandloaded',
  '@spokesperson',
  '@trailmix',
  '@pedalpusher',
  '@gearedup',
];

function makeCityData(
  seedSrc: string,
  hotspots: City['hotspots'],
): { heat: HeatPoint[]; markers: Incident[] } {
  let seed = 0;
  for (let i = 0; i < seedSrc.length; i++) seed = (seed * 31 + seedSrc.charCodeAt(i)) | 0;
  const rnd = mulberry32(seed);
  const now = Date.now();

  const heat: HeatPoint[] = [];
  const markers: Incident[] = [];

  hotspots.forEach((hs, hi) => {
    // Heat cloud around the real district so hotspots land on named places.
    const n = 9 + Math.floor(rnd() * 7 * hs.weight);
    for (let i = 0; i < n; i++) {
      heat.push({
        lng: hs.lng + (rnd() - 0.5) * 0.018,
        lat: hs.lat + (rnd() - 0.5) * 0.016,
        w: Math.max(0.18, hs.weight * (0.45 + rnd() * 0.55)),
      });
    }

    // Two to three reports pinned near each district, weighted by its risk.
    const mCount = 2 + (rnd() < hs.weight - 0.45 ? 1 : 0);
    for (let mi = 0; mi < mCount; mi++) {
      const isSusp = rnd() > 0.62;
      const pool = isSusp ? SUSPICIOUS_TITLES : THEFT_TITLES;
      const title = pool[Math.floor(rnd() * pool.length)].replace('{hood}', hs.name);
      const hoursAgo = 1 + Math.floor(rnd() * 96);
      markers.push({
        id: `net-${seedSrc}-${hi}-${mi}`,
        type: isSusp ? 'suspicious' : 'theft',
        title,
        description: `Crowdsourced report from the ${hs.name} BikeWatch network.`,
        lat: hs.lat + (rnd() - 0.5) * 0.01,
        lng: hs.lng + (rnd() - 0.5) * 0.012,
        timestamp: new Date(now - hoursAgo * 3600_000).toISOString(),
        riskWeight: isSusp ? 0.45 : 0.82,
        source: 'network',
        neighborhood: hs.name,
        reporter: REPORTERS[Math.floor(rnd() * REPORTERS.length)],
        watchers: 3 + Math.floor(rnd() * 26),
      });
    }
  });

  return { heat, markers };
}

const RAW: Omit<City, 'heat' | 'markers'>[] = [
  {
    id: 'atl',
    name: 'Atlanta',
    short: 'ATL',
    center: [-84.3853, 33.7701],
    zoom: 12.6,
    incidents: 1642,
    hotspots: [
      { name: 'Downtown', lng: -84.3901, lat: 33.7559, weight: 0.9 },
      { name: 'Midtown', lng: -84.3833, lat: 33.7806, weight: 0.8 },
      { name: 'Old Fourth Ward', lng: -84.3669, lat: 33.7615, weight: 0.7 },
      { name: 'Little Five Points', lng: -84.3492, lat: 33.7649, weight: 0.6 },
    ],
  },
  {
    id: 'nyc',
    name: 'New York',
    short: 'NYC',
    center: [-73.9857, 40.7484],
    zoom: 12.0,
    incidents: 4880,
    hotspots: [
      { name: 'Midtown', lng: -73.9841, lat: 40.7549, weight: 0.95 },
      { name: 'Williamsburg', lng: -73.9571, lat: 40.7143, weight: 0.85 },
      { name: 'Lower East Side', lng: -73.9874, lat: 40.7155, weight: 0.78 },
      { name: 'Financial District', lng: -74.0099, lat: 40.7066, weight: 0.72 },
      { name: 'Astoria', lng: -73.9235, lat: 40.7643, weight: 0.6 },
    ],
  },
  {
    id: 'chi',
    name: 'Chicago',
    short: 'CHI',
    center: [-87.6298, 41.8781],
    zoom: 11.8,
    incidents: 3120,
    hotspots: [
      { name: 'The Loop', lng: -87.6291, lat: 41.8786, weight: 0.92 },
      { name: 'Wicker Park', lng: -87.6772, lat: 41.9088, weight: 0.82 },
      { name: 'Lincoln Park', lng: -87.6376, lat: 41.9214, weight: 0.74 },
      { name: 'Logan Square', lng: -87.7076, lat: 41.9234, weight: 0.66 },
      { name: 'Hyde Park', lng: -87.5946, lat: 41.7943, weight: 0.58 },
    ],
  },
  {
    id: 'bos',
    name: 'Boston',
    short: 'BOS',
    center: [-71.0589, 42.3601],
    zoom: 12.2,
    incidents: 2070,
    hotspots: [
      { name: 'Back Bay', lng: -71.0814, lat: 42.3503, weight: 0.88 },
      { name: 'Kendall Square', lng: -71.0905, lat: 42.3625, weight: 0.8 },
      { name: 'Allston', lng: -71.1311, lat: 42.3531, weight: 0.72 },
      { name: 'South End', lng: -71.0732, lat: 42.3411, weight: 0.62 },
    ],
  },
  {
    id: 'lax',
    name: 'Los Angeles',
    short: 'LA',
    center: [-118.2437, 34.0522],
    zoom: 11.2,
    incidents: 3960,
    hotspots: [
      { name: 'Downtown LA', lng: -118.2437, lat: 34.0407, weight: 0.9 },
      { name: 'Hollywood', lng: -118.3287, lat: 34.0983, weight: 0.8 },
      { name: 'Venice', lng: -118.4712, lat: 33.9912, weight: 0.76 },
      { name: 'Santa Monica', lng: -118.4912, lat: 34.0195, weight: 0.7 },
      { name: 'Koreatown', lng: -118.3004, lat: 34.0578, weight: 0.6 },
    ],
  },
  {
    id: 'sfo',
    name: 'San Francisco',
    short: 'SF',
    center: [-122.4194, 37.7749],
    zoom: 12.2,
    incidents: 4310,
    hotspots: [
      { name: 'SoMa', lng: -122.4012, lat: 37.7785, weight: 0.94 },
      { name: 'The Mission', lng: -122.4148, lat: 37.7599, weight: 0.86 },
      { name: 'Financial District', lng: -122.3999, lat: 37.7946, weight: 0.78 },
      { name: 'The Castro', lng: -122.4351, lat: 37.7609, weight: 0.66 },
      { name: 'Haight-Ashbury', lng: -122.4464, lat: 37.7701, weight: 0.6 },
    ],
  },
  {
    id: 'clt',
    name: 'Charlotte',
    short: 'CLT',
    center: [-80.8431, 35.2271],
    zoom: 12.0,
    incidents: 1180,
    hotspots: [
      { name: 'Uptown', lng: -80.8414, lat: 35.2271, weight: 0.82 },
      { name: 'NoDa', lng: -80.8041, lat: 35.2474, weight: 0.7 },
      { name: 'South End', lng: -80.8584, lat: 35.2118, weight: 0.64 },
      { name: 'Plaza Midwood', lng: -80.808, lat: 35.2196, weight: 0.56 },
    ],
  },
];

export const CITIES: City[] = RAW.map((c) => {
  const { heat, markers } = makeCityData(c.id, c.hotspots);
  return { ...c, heat, markers };
});

// Headline total across the network (used for the bird's-eye overview stat).
export const NETWORK_TOTAL = CITIES.reduce((sum, c) => sum + c.incidents, 0);

export const cityById = (id: string) => CITIES.find((c) => c.id === id);
