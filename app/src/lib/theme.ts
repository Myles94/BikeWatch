// Live-switchable accent palette. The whole UI (logo, demo, Ask BikeWatch,
// city pins, buttons) and the risk heatmap read from these CSS variables, so
// applyAccent() can retheme everything on the spot.

export interface Accent {
  id: string;
  name: string;
  hex: string; // solid accent
  hex2: string; // darker accent (hover/secondary)
  rgb: string; // space-separated for rgb(var(--signal-rgb) / a)
  rgb2: string;
  peakRgb: string; // bright tint for the heatmap peak
  onText: string; // legible text color on a filled accent
  classicHeat?: boolean; // use the original multi-hue danger heat ramp
}

export const ACCENTS: Accent[] = [
  {
    id: 'classic',
    name: 'Classic',
    hex: '#ffb000',
    hex2: '#d99400',
    rgb: '255 176 0',
    rgb2: '217 148 0',
    peakRgb: '255 214 120',
    onText: '#1a1300',
    classicHeat: true,
  },
  {
    id: 'amber',
    name: 'Amber',
    hex: '#ffb000',
    hex2: '#d99400',
    rgb: '255 176 0',
    rgb2: '217 148 0',
    peakRgb: '255 214 120',
    onText: '#1a1300',
  },
  {
    id: 'violet',
    name: 'Violet',
    hex: '#7c6cff',
    hex2: '#5b4bdb',
    rgb: '124 108 255',
    rgb2: '91 75 219',
    peakRgb: '190 184 255',
    onText: '#ffffff',
  },
  {
    id: 'azure',
    name: 'Azure',
    hex: '#4f8cff',
    hex2: '#2f6ae0',
    rgb: '79 140 255',
    rgb2: '47 106 224',
    peakRgb: '168 200 255',
    onText: '#ffffff',
  },
  {
    id: 'teal',
    name: 'Teal',
    hex: '#2dd4bf',
    hex2: '#14b8a6',
    rgb: '45 212 191',
    rgb2: '20 184 166',
    peakRgb: '153 246 228',
    onText: '#05201c',
  },
  {
    id: 'mono',
    name: 'Mono',
    hex: '#cdd9f5',
    hex2: '#94a3c8',
    rgb: '205 217 245',
    rgb2: '148 163 200',
    peakRgb: '233 239 252',
    onText: '#0a0f1c',
  },
];

export function applyAccent(a: Accent) {
  const root = document.documentElement;
  root.style.setProperty('--signal', a.hex);
  root.style.setProperty('--signal-2', a.hex2);
  root.style.setProperty('--signal-rgb', a.rgb);
  root.style.setProperty('--signal2-rgb', a.rgb2);
  root.style.setProperty('--signal-peak-rgb', a.peakRgb);
  root.style.setProperty('--on-signal', a.onText);
}
