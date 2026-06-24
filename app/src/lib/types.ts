export type IncidentType = 'theft' | 'suspicious' | 'sighting';

// PD dispatch hand-off lifecycle for a theft report
export type DispatchStatus = 'submitted' | 'acknowledged' | 'responding' | 'resolved';

export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  description: string;
  lat: number;
  lng: number;
  timestamp: string; // ISO
  riskWeight: number; // 0..1
  neighborhood?: string;
  imageUrl?: string;
  isNew?: boolean;
  source?: string; // 'apd' | 'featured' | 'user'
  // ---- Community / crowdsourcing ----
  reporter?: string; // community rider handle, e.g. '@atlbikecourier'
  watchers?: number; // riders keeping an eye out near this report
  // ---- Found-bike sighting ----
  matchedTheftId?: string; // sighting -> the theft report it may resolve
  // ---- Theft recovery + PD dispatch ----
  recovered?: boolean; // reunited with owner via a community match
  recoveredBy?: string; // rider whose sighting led to the recovery
  dispatch?: DispatchStatus; // APD dispatch hand-off status
}

// Real-data risk layer (from the APD pipeline)
export interface HeatPoint {
  lat: number;
  lng: number;
  w: number; // 0..1 KDE risk weight
  z?: number; // zone index into Temporal.zoneNames (-1 = none)
}

export interface DayProfile {
  wd: number[]; // 24 weekday multipliers (mean 1)
  we: number[]; // 24 weekend multipliers (mean 1)
}

export interface Temporal {
  hours: number;
  dayTypes: string[];
  global: DayProfile;
  zoneNames: string[];
  zones: Record<string, DayProfile>;
}

export interface Validation {
  method: string;
  trainN: number;
  testN: number;
  trainEnd: string;
  hotspotCoverage: number;
  topHotspotCapture: number;
  pai: number;
  captureCurve: Record<string, number>;
  gridCells: number;
}

export interface Zone {
  id: string;
  label: string;
  lat: number;
  lng: number;
  count: number;
  theftCount: number;
  tier: 'High' | 'Medium' | 'Low';
  stolenProbability: number; // 0..1 model-predicted theft odds
  nightShare?: number;
  weekendShare?: number;
  predictedRate?: number;
  avg?: number;
}

export interface RiskModel {
  method: string;
  proxy: string;
  source: string;
  window: string;
  nIncidents: number;
  nZones: number;
  features: string[];
  coefficients: Record<string, number>;
  validation?: Validation | null;
}

export interface SafeZone {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  rationale: string;
}

export type RecommendationKind = 'route' | 'parking' | 'avoid';

// Live community-watch activity feed
export type FeedKind = 'report' | 'sighting' | 'recovery' | 'watch';
export interface FeedEvent {
  id: string;
  kind: FeedKind;
  handle: string;
  action: string;
  place: string;
  at: number; // epoch ms
}

export interface CopilotRecommendation {
  kind: RecommendationKind;
  routeId?: string;
  safeZoneId?: string;
  avoidHotspot?: { lat: number; lng: number; label: string };
}

export interface CopilotResult {
  question: string;
  answer: string;
  bullets: string[];
  recommendation?: CopilotRecommendation;
}

export interface SafeRoute {
  id: string;
  title: string;
  description: string;
  coordinates: [number, number][]; // [lng, lat]
}

// ---- Risk-aware trip routing ----
export interface TripPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface TripEndpoint {
  label: string;
  lat: number;
  lng: number;
}

export interface RouteOption {
  id: 'safe' | 'fast';
  kind: 'safe' | 'fast';
  label: string;
  coordinates: [number, number][]; // [lng, lat]
  distanceKm: number;
  etaMin: number;
  safetyScore: number; // 0..100
  riskExposure: number; // mean model risk integrated along the path
  highRiskZones: string[]; // High-risk zone names the route passes through
  explanation: string; // defensible "why" for this route
}

export interface TripPlan {
  origin: TripEndpoint;
  destination: TripEndpoint;
  options: RouteOption[]; // [safe, fast]
  selectedId: 'safe' | 'fast';
  riskReductionPct?: number;
}
