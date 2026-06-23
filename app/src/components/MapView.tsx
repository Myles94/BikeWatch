import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Incident, SafeRoute, SafeZone } from '../lib/types';
import { CITY } from '../data/incidents';

interface MapViewProps {
  incidents: Incident[];
  safeZones: SafeZone[];
  activeRoute: SafeRoute | null;
  highlightZoneId: string | null;
  avoidHotspot: { lat: number; lng: number; label: string } | null;
  onMapClick: (lng: number, lat: number) => void;
  onReady: () => void;
}

// CARTO dark-matter vector style — free, no API key required.
const STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function incidentFeatureCollection(incidents: Incident[]) {
  return {
    type: 'FeatureCollection' as const,
    features: incidents.map((i) => ({
      type: 'Feature' as const,
      properties: { weight: i.riskWeight, type: i.type },
      geometry: { type: 'Point' as const, coordinates: [i.lng, i.lat] },
    })),
  };
}

export default function MapView({
  incidents,
  safeZones,
  activeRoute,
  highlightZoneId,
  avoidHotspot,
  onMapClick,
  onReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const incidentMarkers = useRef<maplibregl.Marker[]>([]);
  const zoneMarkers = useRef<maplibregl.Marker[]>([]);
  const avoidMarker = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);

  const onMapClickRef = useRef(onMapClick);
  const onReadyRef = useRef(onReady);
  onMapClickRef.current = onMapClick;
  onReadyRef.current = onReady;

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: CITY.center,
      zoom: CITY.zoom,
      pitch: 45,
      bearing: -17,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      // Heatmap source
      map.addSource('incidents', {
        type: 'geojson',
        data: incidentFeatureCollection([]),
      });

      map.addLayer({
        id: 'incident-heat',
        type: 'heatmap',
        source: 'incidents',
        maxzoom: 17,
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 3.2],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(13,20,36,0)',
            0.2, 'rgba(34,211,238,0.45)',
            0.4, 'rgba(250,204,21,0.7)',
            0.6, 'rgba(249,115,22,0.85)',
            0.8, 'rgba(239,68,68,0.92)',
            1, 'rgba(190,18,60,1)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 18, 14, 42, 16, 70],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 16.5, 0.35],
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
        paint: {
          'line-color': '#22c55e',
          'line-width': 14,
          'line-blur': 12,
          'line-opacity': 0.45,
        },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#86efac',
          'line-width': 4,
        },
      });

      loadedRef.current = true;
      onReadyRef.current();
      // trigger initial data render
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

  // Update heatmap + incident markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('incidents') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(incidentFeatureCollection(incidents));

      incidentMarkers.current.forEach((m) => m.remove());
      incidentMarkers.current = incidents.map((inc) => {
        const el = document.createElement('div');
        el.className = `incident-marker ${inc.type === 'suspicious' ? 'suspicious' : ''} ${
          inc.isNew ? 'new' : ''
        }`;
        const popup = new maplibregl.Popup({ offset: 16, closeButton: true }).setHTML(
          `<div style="min-width:180px">
            <div style="font-weight:600;font-size:13px;margin-bottom:2px">${inc.title}</div>
            <div style="font-size:12px;color:#9fb0d4;margin-bottom:6px">${inc.description}</div>
            <div style="font-size:11px;color:#7c8db5">${
              inc.neighborhood ?? ''
            } · ${inc.type === 'theft' ? 'Theft' : 'Suspicious'}</div>
          </div>`,
        );
        return new maplibregl.Marker({ element: el })
          .setLngLat([inc.lng, inc.lat])
          .setPopup(popup)
          .addTo(map);
      });
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [incidents]);

  // Safe zone markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      zoneMarkers.current.forEach((m) => m.remove());
      zoneMarkers.current = safeZones.map((z) => {
        const el = document.createElement('div');
        el.className = 'safe-zone-marker';
        el.textContent = '🛡';
        el.style.transform =
          highlightZoneId === z.id ? 'scale(1.45)' : 'scale(1)';
        el.style.transition = 'transform 0.25s ease';
        const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
          `<div style="min-width:190px">
            <div style="font-weight:600;font-size:13px;color:#86efac;margin-bottom:2px">${z.title}</div>
            <div style="font-size:12px;color:#9fb0d4;margin-bottom:6px">${z.description}</div>
            <div style="font-size:11px;color:#7c8db5">${z.rationale}</div>
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
        map.fitBounds(bounds, { padding: 120, duration: 1400, pitch: 50 });
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
        pitch: 55,
        duration: 1600,
      });
    };
    if (loadedRef.current) fly();
    else map.once('bikewatch:ready', fly);
  }, [avoidHotspot]);

  return <div ref={containerRef} className="h-full w-full" />;
}
