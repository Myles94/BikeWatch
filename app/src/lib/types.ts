export type IncidentType = 'theft' | 'suspicious';

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
  id: 'safe' | 'direct';
  kind: 'safe' | 'direct';
  label: string;
  coordinates: [number, number][]; // [lng, lat]
  distanceKm: number;
  etaMin: number;
  safetyScore: number; // 0..100
  hotspotsPassed: number;
}

export interface TripPlan {
  origin: TripEndpoint;
  destination: TripEndpoint;
  options: RouteOption[]; // [safe, direct]
  selectedId: 'safe' | 'direct';
}
