/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Values live in CSS variables (src/index.css) so one utility class
        // keeps its role in both themes: `paper` is the surface ramp,
        // `composite` is the ink ramp.
        paper: {
          50: 'var(--paper-50)',
          100: 'var(--paper-100)',
          200: 'var(--paper-200)',
          300: 'var(--paper-300)',
          400: 'var(--paper-400)',
        },
        kraft: {
          300: 'var(--kraft-300)',
          400: 'var(--kraft-400)',
          500: 'var(--kraft-500)',
          600: 'var(--kraft-600)',
          700: 'var(--kraft-700)',
        },
        composite: {
          800: 'var(--composite-800)',
          850: 'var(--composite-850)',
          900: 'var(--composite-900)',
          950: 'var(--composite-950)',
        },
        hazard: {
          400: 'var(--hazard-400)',
          500: 'var(--hazard-500)',
          600: 'var(--hazard-600)',
          700: 'var(--hazard-700)',
        },
        cyan: {
          400: 'var(--cyan-400)',
          500: 'var(--cyan-500)',
          600: 'var(--cyan-600)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Barlow Condensed"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
