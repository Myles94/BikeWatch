import type { Incident, SafeRoute, SafeZone, TripPoint } from '../lib/types';

// Demo city: Atlanta, GA
export const CITY = {
  name: 'Atlanta, GA',
  center: [-84.3853, 33.7701] as [number, number],
  zoom: 13.2,
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const BIKE_IMAGES = ['/reports/bike-1.jpg', '/reports/bike-2.jpg', '/reports/bike-3.jpg'];
const SCOOTER_IMAGE = '/reports/scooter-1.jpg';

export const pickImage = (title: string, idx: number): string => {
  if (/scooter|e-?bike|battery/i.test(title)) return SCOOTER_IMAGE;
  return BIKE_IMAGES[idx % BIKE_IMAGES.length];
};

// Helper to jitter points around a cluster center
const cluster = (
  baseId: string,
  lat: number,
  lng: number,
  neighborhood: string,
  points: Array<{
    dLat: number;
    dLng: number;
    type: Incident['type'];
    title: string;
    desc: string;
    risk: number;
    h: number;
  }>,
): Incident[] =>
  points.map((p, i) => ({
    id: `${baseId}-${i}`,
    type: p.type,
    title: p.title,
    description: p.desc,
    lat: lat + p.dLat,
    lng: lng + p.dLng,
    timestamp: hoursAgo(p.h),
    riskWeight: p.risk,
    neighborhood,
  }));

const RAW_INCIDENTS: Incident[] = [
  ...cluster('gt', 33.7756, -84.3963, 'Georgia Tech', [
    { dLat: 0.0008, dLng: 0.0011, type: 'theft', title: 'Bike stolen outside library', desc: 'U-lock cut overnight at the Clough Commons racks.', risk: 0.95, h: 6 },
    { dLat: -0.0012, dLng: 0.0009, type: 'theft', title: 'E-bike taken from dorm rack', desc: 'Cable lock defeated near Tech Square dorms.', risk: 0.9, h: 14 },
    { dLat: 0.0015, dLng: -0.0007, type: 'theft', title: 'Wheel + frame stolen', desc: 'Only the front wheel was left locked to the rack.', risk: 0.85, h: 20 },
    { dLat: -0.0006, dLng: -0.0014, type: 'suspicious', title: 'Person testing locks', desc: 'Individual seen checking multiple bikes near CULC.', risk: 0.55, h: 3 },
    { dLat: 0.0019, dLng: 0.0016, type: 'theft', title: 'Commuter bike stolen', desc: 'Daytime theft from an unmonitored rack.', risk: 0.8, h: 30 },
    { dLat: -0.0017, dLng: 0.0019, type: 'theft', title: 'Scooter battery stolen', desc: 'Locked scooter stripped overnight.', risk: 0.7, h: 40 },
  ]),

  // ---- Midtown (HIGH risk) ----
  ...cluster('mid', 33.7815, -84.3832, 'Midtown', [
    { dLat: 0.0009, dLng: 0.001, type: 'theft', title: 'Bike grabbed near MARTA', desc: 'Quick theft outside the Midtown station entrance.', risk: 0.9, h: 9 },
    { dLat: -0.001, dLng: 0.0008, type: 'theft', title: 'Lock cut at apartment garage', desc: 'Two bikes taken from a residential garage.', risk: 0.85, h: 18 },
    { dLat: 0.0014, dLng: -0.0011, type: 'suspicious', title: 'Van loading multiple bikes', desc: 'Reported by a resident late at night.', risk: 0.6, h: 5 },
    { dLat: -0.0016, dLng: -0.0009, type: 'theft', title: 'Road bike stolen at cafe', desc: 'Stolen during a short coffee stop on Peachtree.', risk: 0.8, h: 26 },
    { dLat: 0.0006, dLng: 0.0017, type: 'theft', title: 'Bike missing from office rack', desc: 'Indoor rack access door left propped open.', risk: 0.75, h: 33 },
  ]),

  // ---- Downtown / Five Points (MEDIUM-HIGH) ----
  ...cluster('dt', 33.7537, -84.3905, 'Downtown', [
    { dLat: 0.0011, dLng: 0.0012, type: 'theft', title: 'Bike stolen at Five Points', desc: 'Theft near the transit hub during rush hour.', risk: 0.8, h: 12 },
    { dLat: -0.0013, dLng: 0.001, type: 'suspicious', title: 'Group loitering by racks', desc: 'Suspicious activity near Woodruff Park.', risk: 0.5, h: 7 },
    { dLat: 0.0016, dLng: -0.0008, type: 'theft', title: 'Delivery bike taken', desc: 'Unattended delivery bike stolen in seconds.', risk: 0.7, h: 22 },
    { dLat: -0.0009, dLng: -0.0015, type: 'theft', title: 'Bike stolen near hotel', desc: 'Cut cable lock found on the sidewalk.', risk: 0.65, h: 38 },
  ]),

  // ---- Old Fourth Ward / BeltLine Eastside (MEDIUM) ----
  ...cluster('o4w', 33.7646, -84.3656, 'Old Fourth Ward', [
    { dLat: 0.001, dLng: 0.0009, type: 'theft', title: 'Bike stolen near Ponce City Market', desc: 'Taken from a street rack despite crowds.', risk: 0.7, h: 11 },
    { dLat: -0.0011, dLng: 0.0012, type: 'suspicious', title: 'Lock tampering on BeltLine', desc: 'Cyclist reported someone tampering with a U-lock.', risk: 0.45, h: 4 },
    { dLat: 0.0013, dLng: -0.001, type: 'theft', title: 'E-scooter stolen by trail', desc: 'Parked scooter taken near the Eastside Trail.', risk: 0.6, h: 28 },
  ]),

  // ---- Little Five Points / Inman Park (LOW-MEDIUM) ----
  ...cluster('l5p', 33.7639, -84.3496, 'Little Five Points', [
    { dLat: 0.0009, dLng: 0.001, type: 'suspicious', title: 'Person eyeing locked bikes', desc: 'Reported outside a shop on Euclid Ave.', risk: 0.4, h: 8 },
    { dLat: -0.001, dLng: -0.0009, type: 'theft', title: 'Bike stolen from porch', desc: 'Unlocked bike taken from a front porch.', risk: 0.5, h: 34 },
  ]),

  // ---- Scattered lower-risk ----
  { id: 'gp-0', type: 'theft', title: 'Bike stolen at Grant Park', description: 'Theft near the Zoo Atlanta parking area.', lat: 33.7385, lng: -84.3702, timestamp: hoursAgo(44), riskWeight: 0.45, neighborhood: 'Grant Park' },
  { id: 'we-0', type: 'suspicious', title: 'Suspicious cutting tool sighting', description: 'Resident reported a person with bolt cutters.', lat: 33.7352, lng: -84.4136, timestamp: hoursAgo(16), riskWeight: 0.4, neighborhood: 'West End' },
  { id: 'bh-0', type: 'theft', title: 'Bike stolen in Buckhead', description: 'Stolen from a retail bike rack midday.', lat: 33.8484, lng: -84.3671, timestamp: hoursAgo(50), riskWeight: 0.5, neighborhood: 'Buckhead' },
];

export const SEED_INCIDENTS: Incident[] = RAW_INCIDENTS.map((inc, i) => ({
  ...inc,
  imageUrl: pickImage(inc.title, i),
}));

export const SEED_SAFE_ZONES: SafeZone[] = [
  {
    id: 'sz-atlantic',
    title: 'Atlantic Station Secured Garage',
    description: 'Monitored garage with covered, camera-watched bike racks.',
    lat: 33.7925,
    lng: -84.3969,
    rationale: '24/7 security cameras and staff. No incidents reported in the last 30 days.',
  },
  {
    id: 'sz-pcm',
    title: 'Ponce City Market Bike Valet',
    description: 'Staffed bike valet area with high foot traffic.',
    lat: 33.7726,
    lng: -84.3654,
    rationale: 'Attended valet and constant pedestrian activity deter theft.',
  },
  {
    id: 'sz-centennial',
    title: 'Centennial Park Staffed Racks',
    description: 'Well-lit racks beside a staffed visitor plaza.',
    lat: 33.7603,
    lng: -84.3933,
    rationale: 'Open sightlines, lighting, and on-site staff lower risk significantly.',
  },
];

export const SEED_ROUTES: SafeRoute[] = [
  {
    id: 'route-beltline',
    title: 'Safer BeltLine Route',
    description: 'Avoids the Georgia Tech and Midtown hotspots by using the protected BeltLine Eastside Trail.',
    coordinates: [
      [-84.3853, 33.7701],
      [-84.3789, 33.7716],
      [-84.3712, 33.7724],
      [-84.3661, 33.7726],
      [-84.3654, 33.7686],
      [-84.3637, 33.7651],
      [-84.3589, 33.7628],
      [-84.3531, 33.7641],
    ],
  },
];

/**
 * Preset origins/destinations for the risk-aware trip planner. First entry is
 * the user's default origin; the rest are common Atlanta destinations.
 */
export const TRIP_POINTS: TripPoint[] = [
  { id: 'tp-you', label: 'Your location', lat: CITY.center[1], lng: CITY.center[0] },
  { id: 'tp-gt', label: 'Georgia Tech', lat: 33.7756, lng: -84.3963 },
  { id: 'tp-mid', label: 'Midtown', lat: 33.7815, lng: -84.3832 },
  { id: 'tp-dt', label: 'Downtown / Five Points', lat: 33.7537, lng: -84.3905 },
  { id: 'tp-o4w', label: 'Old Fourth Ward', lat: 33.7646, lng: -84.3656 },
  { id: 'tp-l5p', label: 'Little Five Points', lat: 33.7639, lng: -84.3496 },
  { id: 'tp-pcm', label: 'Ponce City Market', lat: 33.7726, lng: -84.3654 },
  { id: 'tp-atl', label: 'Atlantic Station', lat: 33.7925, lng: -84.3969 },
  { id: 'tp-cent', label: 'Centennial Park', lat: 33.7603, lng: -84.3933 },
  { id: 'tp-grant', label: 'Grant Park', lat: 33.7385, lng: -84.3702 },
  { id: 'tp-buck', label: 'Buckhead', lat: 33.8484, lng: -84.3671 },
  { id: 'tp-west', label: 'West End', lat: 33.7352, lng: -84.4136 },
];
