import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { HeatPoint, Incident, SafeRoute, SafeZone, TripPlan, TripPoint, Zone } from '../lib/types';
import type { HeatStyle, RiskFC } from '../lib/heatStyles';
import { CITY } from '../data/incidents';
import { DARK_STYLE } from '../lib/mapStyle';

interface MapViewProps {
  incidents: Incident[];
  heatPoints: HeatPoint[];
  zones: Zone[];
  safeZones: SafeZone[];
  landmarks: TripPoint[];
  activeRoute: SafeRoute | null;
  highlightZoneId: string | null;
  avoidHotspot: { lat: number; lng: number; label: string } | null;
  flyTarget: { lat: number; lng: number; key: number } | null;
  cinematic: { lng: number; lat: number; zoom: number; pitch: number; bearing: number; duration?: number; key: number } | null;
  openPopup: { id: string; key: number } | null;
  expandBounds: boolean;
  showHeatmap: boolean;
  heatStyle: HeatStyle;
  riskPolygons: RiskFC;
  trip: TripPlan | null;
  tripVisible: boolean;
  selectedId: 'safe' | 'fast';
  onMapClick: (lng: number, lat: number) => void;
  onLandmarkClick: (point: TripPoint) => void;
  onMatchSighting: (sightingId: string) => void;
  onEscalate: (theftId: string) => void;
  onReady: () => void;
}

// Top-N risk zones to annotate in heatmap mode (keeps the overlay uncluttered).
const ZONE_CARDS = 7;

function heatFeatureCollection(points: HeatPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((p) => ({
      type: 'Feature' as const,
      properties: { w: p.w },
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    })),
  };
}

const timeAgo = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

const MONO = "'JetBrains Mono',ui-monospace,monospace";

function tagFor(inc: Incident): { color: string; text: string } {
  if (inc.recovered) return { color: '#21d07a', text: 'RECOVERED' };
  if (inc.type === 'sighting') return { color: '#38bdf8', text: 'SIGHTED STOLEN BIKE' };
  if (inc.type === 'theft') return { color: '#ff453a', text: 'THEFT' };
  return { color: '#ffb000', text: 'SUSPICIOUS' };
}

function popupHtml(inc: Incident) {
  const { color: accent, text: tagText } = tagFor(inc);
  const img = inc.imageUrl
    ? `<div style="position:relative">
         <img src="${inc.imageUrl}" alt="" style="width:100%;height:172px;object-fit:cover;display:block" />
         <div style="position:absolute;top:9px;left:9px;display:flex;align-items:center;gap:6px;background:rgba(6,8,13,0.82);border:1px solid ${accent};padding:3px 7px">
           <span style="height:6px;width:6px;border-radius:999px;background:${accent}"></span>
           <span style="font-family:${MONO};font-size:9px;letter-spacing:0.14em;color:${accent}">${tagText}</span>
         </div>
       </div>`
    : '';
  const verb = inc.type === 'sighting' ? 'Spotted by' : 'Reported by';
  const who = inc.recovered
    ? `<span style="color:#21d07a">♺ Reunited via ${inc.recoveredBy ?? 'the community'}</span>`
    : inc.reporter
      ? `${verb} <span style="color:${accent}">${inc.reporter}</span>`
      : '';
  const watch =
    inc.watchers && !inc.recovered
      ? `<span style="display:inline-flex;align-items:center;gap:4px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7c8699" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>${inc.watchers} watching</span>`
      : '';
  const community =
    who || watch
      ? `<div style="display:flex;justify-content:space-between;align-items:center;font-family:${MONO};font-size:10px;letter-spacing:0.06em;color:#9fb0d0;margin-bottom:9px">
           <span>${who}</span><span>${watch}</span>
         </div>`
      : '';
  const matchCta =
    inc.type === 'sighting'
      ? inc.matchedTheftId
        ? `<div style="display:flex;align-items:center;gap:6px;width:100%;justify-content:center;background:rgba(33,208,122,0.12);border:1px solid #21d07a;color:#21d07a;font-family:${MONO};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;padding:8px;margin-bottom:9px">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
             Reunited with owner
           </div>`
        : `<button onclick="window.__bwMatch&&window.__bwMatch('${inc.id}')" style="display:flex;align-items:center;gap:6px;width:100%;justify-content:center;background:#38bdf8;border:none;color:#04222e;font-family:${MONO};font-weight:700;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;padding:9px;margin-bottom:9px;cursor:pointer">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
             Match to a stolen bike
           </button>`
      : '';
  const escalateCta =
    (inc.type === 'theft' || inc.type === 'sighting') && !inc.recovered
      ? `<button onclick="window.__bwEscalate&&window.__bwEscalate('${inc.id}')" style="display:flex;align-items:center;gap:6px;width:100%;justify-content:center;background:rgba(255,69,58,0.12);border:1px solid #ff453a;color:#ff453a;font-family:${MONO};font-weight:700;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;padding:9px;margin-bottom:9px;cursor:pointer">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v6c0 5 3.8 8.3 9 9 5.2-.7 9-4 9-9V7l-9-5Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
           Call APD dispatch
         </button>`
      : '';
  return `<div style="width:288px">
    ${img}
    <div style="padding:11px 13px 13px">
      <div style="font-family:'Archivo',sans-serif;font-weight:700;font-size:15px;color:#f1f5ff;margin-bottom:6px;line-height:1.25">${inc.title}</div>
      <div style="font-size:13px;color:#c7d2ec;margin-bottom:11px;line-height:1.5">${inc.description}</div>
      ${community}
      ${matchCta}
      ${escalateCta}
      <div style="display:flex;justify-content:space-between;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#7c8699;border-top:1px solid #1b2233;padding-top:9px">
        <span>${inc.neighborhood ?? ''}</span>
        <span>${timeAgo(inc.timestamp)}</span>
      </div>
    </div>
  </div>`;
}

export default function MapView({
  incidents,
  heatPoints,
  zones,
  safeZones,
  landmarks,
  activeRoute,
  highlightZoneId,
  avoidHotspot,
  flyTarget,
  cinematic,
  openPopup,
  expandBounds,
  showHeatmap,
  heatStyle,
  riskPolygons,
  trip,
  tripVisible,
  selectedId,
  onMapClick,
  onLandmarkClick,
  onMatchSighting,
  onEscalate,
  onReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const incidentMarkers = useRef<maplibregl.Marker[]>([]);
  const incidentMarkerMap = useRef<Map<string, maplibregl.Marker>>(new Map());
  const zoneMarkers = useRef<maplibregl.Marker[]>([]);
  const analyticsMarkers = useRef<maplibregl.Marker[]>([]);
  const tripMarkers = useRef<maplibregl.Marker[]>([]);
  const landmarkMarkers = useRef<maplibregl.Marker[]>([]);
  const avoidMarker = useRef<maplibregl.Marker | null>(null);
  const fittedTripRef = useRef<TripPlan | null>(null);
  const pulseRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  const stopPulse = () => {
    if (pulseRef.current != null) {
      cancelAnimationFrame(pulseRef.current);
      pulseRef.current = null;
    }
    const map = mapRef.current;
    if (map && map.getLayer('risk-fill')) map.setPaintProperty('risk-fill', 'fill-opacity', 1);
  };
  const startPulse = () => {
    const t0 = performance.now();
    const step = (t: number) => {
      const map = mapRef.current;
      if (!map || !map.getLayer('risk-fill')) {
        pulseRef.current = null;
        return;
      }
      const o = 0.84 + 0.16 * (0.5 + 0.5 * Math.sin((t - t0) / 620));
      map.setPaintProperty('risk-fill', 'fill-opacity', o);
      pulseRef.current = requestAnimationFrame(step);
    };
    pulseRef.current = requestAnimationFrame(step);
  };

  const onMapClickRef = useRef(onMapClick);
  const onReadyRef = useRef(onReady);
  const onLandmarkClickRef = useRef(onLandmarkClick);
  onMapClickRef.current = onMapClick;
  onReadyRef.current = onReady;
  onLandmarkClickRef.current = onLandmarkClick;

  // Bridge popup buttons (raw HTML) -> React: register a window callback that
  // always points at the latest handler.
  const onMatchSightingRef = useRef(onMatchSighting);
  onMatchSightingRef.current = onMatchSighting;
  const onEscalateRef = useRef(onEscalate);
  onEscalateRef.current = onEscalate;
  useEffect(() => {
    const w = window as unknown as {
      __bwMatch?: (id: string) => void;
      __bwEscalate?: (id: string) => void;
    };
    w.__bwMatch = (id: string) => onMatchSightingRef.current(id);
    w.__bwEscalate = (id: string) => onEscalateRef.current(id);
    return () => {
      delete w.__bwMatch;
      delete w.__bwEscalate;
    };
  }, []);

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: CITY.center,
      zoom: CITY.zoom,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: [
        [-84.95, 33.42], // SW - greater Atlanta
        [-83.95, 34.12], // NE
      ],
      pitch: 50,
      bearing: -18,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      map.addSource('incidents', {
        type: 'geojson',
        data: heatFeatureCollection([]),
      });
      map.addSource('safezones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('riskpoly', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Hex risk polygons (shaded fill + neon outline) - "danger" heat style
      map.addLayer({
        id: 'risk-fill',
        type: 'fill',
        source: 'riskpoly',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'interpolate', ['linear'], ['get', 'risk'],
            0.04, 'rgba(255,176,0,0.20)',
            0.3, 'rgba(255,110,20,0.48)',
            0.55, 'rgba(255,54,40,0.7)',
            0.78, 'rgba(255,26,46,0.85)',
            1, 'rgba(255,40,70,0.96)',
          ],
        },
      });
      map.addLayer({
        id: 'risk-glow',
        type: 'line',
        source: 'riskpoly',
        layout: { visibility: 'none' },
        paint: {
          'line-color': [
            'interpolate', ['linear'], ['get', 'risk'],
            0.3, 'rgba(255,90,40,0.5)',
            1, 'rgba(255,40,60,0.95)',
          ],
          'line-width': ['interpolate', ['linear'], ['get', 'risk'], 0.04, 1, 1, 5],
          'line-blur': ['interpolate', ['linear'], ['get', 'risk'], 0.04, 1, 1, 6],
          'line-opacity': ['interpolate', ['linear'], ['get', 'risk'], 0.04, 0.2, 1, 0.9],
        },
      });
      map.addLayer({
        id: 'risk-line',
        type: 'line',
        source: 'riskpoly',
        layout: { visibility: 'none' },
        paint: {
          'line-color': [
            'interpolate', ['linear'], ['get', 'risk'],
            0.04, 'rgba(255,180,60,0.55)',
            0.6, 'rgba(255,110,70,0.9)',
            1, 'rgba(255,90,90,1)',
          ],
          'line-width': 1,
        },
      });

      // Advanced shaded heatmap (hidden until toggled)
      map.addLayer({
        id: 'incident-heat',
        type: 'heatmap',
        source: 'incidents',
        maxzoom: 18,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0.4, 1, 1.7],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 2, 13, 3, 16, 4.4],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(6,8,13,0)',
            0.1, 'rgba(38,95,110,0.35)',
            0.28, 'rgba(70,150,150,0.55)',
            0.45, 'rgba(255,176,0,0.82)',
            0.65, 'rgba(255,128,32,0.9)',
            0.82, 'rgba(255,69,58,0.95)',
            1, 'rgba(176,18,38,1)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 44, 13, 95, 16, 150],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.95, 17, 0.6],
        },
      });

      // Safe-zone heatmap (green) - shown alongside the risk heatmap
      map.addLayer({
        id: 'safezone-heat',
        type: 'heatmap',
        source: 'safezones',
        maxzoom: 18,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': 1.4,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 16, 3.6],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(8,12,24,0)',
            0.2, 'rgba(16,185,129,0.35)',
            0.45, 'rgba(34,197,94,0.6)',
            0.7, 'rgba(74,222,128,0.8)',
            1, 'rgba(134,239,172,0.92)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 40, 13, 80, 16, 130],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.85, 17, 0.5],
        },
      });

      // Route source + glow + line
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffb000', 'line-width': 14, 'line-blur': 12, 'line-opacity': 0.32 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffc94d', 'line-width': 3.5 },
      });

      // Trip planner: direct (dashed, risk-tinted) + safe (amber) routes
      map.addSource('trip-direct', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('trip-safe', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'trip-direct-line',
        type: 'line',
        source: 'trip-direct',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ff6b6b',
          'line-width': 2.5,
          'line-opacity': 0.5,
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: 'trip-safe-glow',
        type: 'line',
        source: 'trip-safe',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffb000', 'line-width': 16, 'line-blur': 12, 'line-opacity': 0.3 },
      });
      map.addLayer({
        id: 'trip-safe-line',
        type: 'line',
        source: 'trip-safe',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffc94d', 'line-width': 4 },
      });

      loadedRef.current = true;
      onReadyRef.current();
      map.fire('bikewatch:ready');
    });

    map.on('click', (e) => {
      onMapClickRef.current(e.lngLat.lng, e.lngLat.lat);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Heatmap source <- real KDE-weighted risk points
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('incidents') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(heatFeatureCollection(heatPoints));
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [heatPoints]);

  // Incident markers (curated + sampled real reports)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      incidentMarkers.current.forEach((m) => m.remove());
      incidentMarkerMap.current.clear();
      incidentMarkers.current = incidents.map((inc) => {
        const el = document.createElement('div');
        const recovered = inc.recovered ? 'recovered' : '';
        const kind = inc.type === 'suspicious' ? 'suspicious' : inc.type === 'sighting' ? 'sighting' : '';
        el.className = `incident-marker ${recovered || kind} ${inc.isNew ? 'new' : ''}`;
        if (inc.recovered) {
          el.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
        } else if (inc.type === 'sighting') {
          el.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
        el.style.opacity = showHeatmap ? '0.45' : '1';
        const popup = new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '320px' }).setHTML(
          popupHtml(inc),
        );
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([inc.lng, inc.lat])
          .setPopup(popup)
          .addTo(map);
        incidentMarkerMap.current.set(inc.id, marker);
        return marker;
      });
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [incidents, showHeatmap]);

  // Toggle heatmap layers + zone analytics overlays (real model-scored zones)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const on = showHeatmap;
      const blur = on && heatStyle === 'blur';
      const hex = on && heatStyle === 'hex';
      const setVis = (id: string, v: boolean) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
      };
      setVis('incident-heat', blur);
      setVis('safezone-heat', blur);
      setVis('risk-fill', hex);
      setVis('risk-glow', hex);
      setVis('risk-line', hex);

      // Subtle "danger" pulse on the hex fill so high-risk cells breathe.
      stopPulse();
      if (hex) startPulse();

      analyticsMarkers.current.forEach((m) => m.remove());
      analyticsMarkers.current = [];
      if (!showHeatmap) return;
      analyticsMarkers.current = zones.slice(0, ZONE_CARDS).map((z) => {
        const el = document.createElement('div');
        el.className = `zone-analytics tier-${z.tier.toLowerCase()}`;
        const pct = Math.round(z.stolenProbability * 100);
        el.innerHTML = `
          <div class="za-head">
            <span class="za-dot"></span>
            <span class="za-tier">${z.tier}</span>
            <span class="za-name">${z.label}</span>
          </div>
          <div class="za-prob">
            <span class="za-pct">${pct}%</span>
            <span class="za-prob-label">predicted theft odds</span>
          </div>
          <div class="za-bar"><span style="width:${pct}%"></span></div>
          <div class="za-meta">${z.count} reports · ${z.tier} risk</div>`;
        return new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -16] })
          .setLngLat([z.lng, z.lat])
          .addTo(map);
      });
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
    return () => stopPulse();
  }, [showHeatmap, heatStyle, zones]);

  // Risk polygon data (grid/hex styles)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('riskpoly') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(riskPolygons);
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [riskPolygons]);

  // Safe zone markers + safe-zone heatmap data
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('safezones') as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features: safeZones.map((z) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [z.lng, z.lat] },
          })),
        });
      }
      zoneMarkers.current.forEach((m) => m.remove());
      zoneMarkers.current = safeZones.map((z) => {
        const el = document.createElement('div');
        el.className = 'safe-zone-marker';
        el.innerHTML =
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#04130a" stroke-width="2.4"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/></svg>';
        el.style.transform = highlightZoneId === z.id ? 'scale(1.4)' : 'scale(1)';
        el.style.transition = 'transform 0.25s ease';
        const popup = new maplibregl.Popup({ offset: 18, maxWidth: '240px' }).setHTML(
          `<div style="width:212px;padding:11px 13px 12px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
              <span style="height:6px;width:6px;border-radius:999px;background:#21d07a"></span>
              <span style="font-family:${MONO};font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#21d07a">Verified Safe Zone</span>
            </div>
            <div style="font-family:'Archivo',sans-serif;font-weight:700;font-size:13px;color:#f1f5ff;margin-bottom:4px">${z.title}</div>
            <div style="font-size:12px;color:#c7d2ec;margin-bottom:7px;line-height:1.45">${z.description}</div>
            <div style="font-family:${MONO};font-size:10px;color:#7c8699;line-height:1.45;border-top:1px solid #1b2233;padding-top:8px">${z.rationale}</div>
          </div>`,
        );
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([z.lng, z.lat])
          .setPopup(popup)
          .addTo(map);
        if (highlightZoneId === z.id) m.togglePopup();
        return m;
      });
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [safeZones, highlightZoneId]);

  // Route rendering + fly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      if (activeRoute) {
        src.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: activeRoute.coordinates },
            },
          ],
        });
        const bounds = activeRoute.coordinates.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(
            activeRoute.coordinates[0] as [number, number],
            activeRoute.coordinates[0] as [number, number],
          ),
        );
        map.fitBounds(bounds, { padding: 160, duration: 1400, pitch: 55 });
      } else {
        src.setData({ type: 'FeatureCollection', features: [] });
      }
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [activeRoute]);

  // Avoid hotspot flyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    avoidMarker.current?.remove();
    avoidMarker.current = null;
    if (!avoidHotspot) return;
    const fly = () => {
      map.flyTo({
        center: [avoidHotspot.lng, avoidHotspot.lat],
        zoom: 14.5,
        pitch: 58,
        duration: 1600,
      });
    };
    if (loadedRef.current) fly();
    else map.once('bikewatch:ready', fly);
  }, [avoidHotspot]);

  // Trip planner: render safe + fast routes, O/D markers, emphasize selection.
  // Routes are only drawn while the planner is visible, and we only refit the
  // camera when the plan itself changes (not on select/visibility toggles).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const lineFC = (coords: [number, number][]) => ({
      type: 'FeatureCollection' as const,
      features: coords.length
        ? [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'LineString' as const, coordinates: coords },
            },
          ]
        : [],
    });
    const apply = () => {
      const directSrc = map.getSource('trip-direct') as maplibregl.GeoJSONSource | undefined;
      const safeSrc = map.getSource('trip-safe') as maplibregl.GeoJSONSource | undefined;
      if (!directSrc || !safeSrc) return;

      tripMarkers.current.forEach((m) => m.remove());
      tripMarkers.current = [];

      if (!trip || !tripVisible) {
        directSrc.setData(lineFC([]));
        safeSrc.setData(lineFC([]));
        fittedTripRef.current = null;
        return;
      }

      const safe = trip.options.find((o) => o.kind === 'safe');
      const direct = trip.options.find((o) => o.kind === 'fast');
      safeSrc.setData(lineFC(safe?.coordinates ?? []));
      directSrc.setData(lineFC(direct?.coordinates ?? []));

      const safeSel = selectedId === 'safe';
      if (map.getLayer('trip-safe-line')) {
        map.setPaintProperty('trip-safe-line', 'line-width', safeSel ? 4.5 : 2.5);
        map.setPaintProperty('trip-safe-line', 'line-opacity', safeSel ? 1 : 0.4);
      }
      if (map.getLayer('trip-safe-glow')) {
        map.setPaintProperty('trip-safe-glow', 'line-opacity', safeSel ? 0.32 : 0.1);
      }
      if (map.getLayer('trip-direct-line')) {
        map.setPaintProperty('trip-direct-line', 'line-width', safeSel ? 2.5 : 3.8);
        map.setPaintProperty('trip-direct-line', 'line-opacity', safeSel ? 0.45 : 0.95);
      }

      const makeEndpoint = (label: string, isDest: boolean, lat: number, lng: number) => {
        const el = document.createElement('div');
        el.className = `trip-endpoint ${isDest ? 'dest' : ''}`;
        el.textContent = label;
        return new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      };
      tripMarkers.current = [
        makeEndpoint('A', false, trip.origin.lat, trip.origin.lng),
        makeEndpoint('B', true, trip.destination.lat, trip.destination.lng),
      ];

      if (fittedTripRef.current !== trip) {
        const coords = [...(safe?.coordinates ?? []), ...(direct?.coordinates ?? [])];
        if (coords.length) {
          const bounds = coords.reduce(
            (b, c) => b.extend(c as [number, number]),
            new maplibregl.LngLatBounds(coords[0], coords[0]),
          );
          map.fitBounds(bounds, { padding: { top: 120, bottom: 90, left: 330, right: 110 }, duration: 1200, pitch: 48 });
        }
        fittedTripRef.current = trip;
      }
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [trip, tripVisible, selectedId]);

  // Clickable Atlanta landmarks (wayfinding) - fly + set as route origin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      landmarkMarkers.current.forEach((m) => m.remove());
      landmarkMarkers.current = landmarks.map((p) => {
        const el = document.createElement('button');
        el.className = 'landmark-pin';
        el.innerHTML = `<span class="lm-body"><span class="lm-dot"></span><span class="lm-label">${p.label}</span></span><span class="lm-tail"></span>`;
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onLandmarkClickRef.current(p);
        });
        return new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
      });
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [landmarks]);

  // Fly to a requested target (landmark click)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    const fly = () =>
      map.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: 14.6, pitch: 52, duration: 1400 });
    if (loadedRef.current) fly();
    else map.once('bikewatch:ready', fly);
  }, [flyTarget]);

  // Cinematic camera move (demo tour) - smooth eased flight with full framing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cinematic) return;
    const fly = () =>
      map.flyTo({
        center: [cinematic.lng, cinematic.lat],
        zoom: cinematic.zoom,
        pitch: cinematic.pitch,
        bearing: cinematic.bearing,
        duration: cinematic.duration ?? 2200,
        essential: true,
        curve: 1.5,
      });
    if (loadedRef.current) fly();
    else map.once('bikewatch:ready', fly);
  }, [cinematic]);

  // Programmatically open/close an incident popup (demo tour drives this).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !openPopup) return;
    const run = () => {
      incidentMarkerMap.current.forEach((mk) => {
        const p = mk.getPopup();
        if (p && p.isOpen()) mk.togglePopup();
      });
      if (openPopup.id) {
        const mk = incidentMarkerMap.current.get(openPopup.id);
        const p = mk?.getPopup();
        if (mk && p && !p.isOpen()) mk.togglePopup();
      }
    };
    if (loadedRef.current) run();
    else map.once('bikewatch:ready', run);
  }, [openPopup]);

  // Expand the camera bounds for the multi-city network flyover, then snap
  // back to the Atlanta constraint when the network mode closes.
  const boundsTimer = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (boundsTimer.current != null) {
      clearTimeout(boundsTimer.current);
      boundsTimer.current = null;
    }
    if (expandBounds) {
      map.setMaxBounds(undefined);
      map.setMinZoom(3);
    } else {
      // Let any in-flight flight back to Atlanta finish before re-clamping.
      boundsTimer.current = window.setTimeout(() => {
        map.setMinZoom(10);
        map.setMaxBounds([
          [-84.95, 33.42],
          [-83.95, 34.12],
        ]);
      }, 1700);
    }
    return () => {
      if (boundsTimer.current != null) clearTimeout(boundsTimer.current);
    };
  }, [expandBounds]);

  return <div ref={containerRef} className="h-full w-full" />;
}
