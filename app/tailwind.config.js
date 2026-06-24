/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tactical base — desaturated near-black with a cold cast
        ink: '#06080d',
        panel: '#0a0d15',
        'panel-2': '#10141f',
        edge: '#1b2233',
        'edge-2': '#262f44',
        // Signal system: accent driven by CSS vars so it can be themed live
        brand: 'rgb(var(--signal-rgb) / <alpha-value>)',
        'brand-2': 'rgb(var(--signal2-rgb) / <alpha-value>)',
        warn: 'rgb(var(--signal-rgb) / <alpha-value>)',
        // Escalation = active theft only
        danger: '#ff453a',
        // Verified safe only
        safe: '#21d07a',
        muted: '#7c8699',
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        display: ['"Archivo Expanded"', 'Archivo', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        signage: '0.18em',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.7)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bootIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0', clipPath: 'inset(0 100% 0 0)' },
          '60%': { clipPath: 'inset(0 0 0 0)' },
          '100%': { transform: 'translateY(0)', opacity: '1', clipPath: 'inset(0 0 0 0)' },
        },
        scanSweep: {
          '0%': { transform: 'translateY(-12%)', opacity: '0' },
          '12%': { opacity: '0.9' },
          '90%': { opacity: '0.5' },
          '100%': { transform: 'translateY(112%)', opacity: '0' },
        },
        livePulse: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.82)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.8s ease-out infinite',
        slideUp: 'slideUp 0.25s ease-out',
        bootIn: 'bootIn 0.55s cubic-bezier(0.22,1,0.36,1) both',
        scanSweep: 'scanSweep 1.1s ease-in-out',
        livePulse: 'livePulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
