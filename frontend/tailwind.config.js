/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#FAF6EE',
          100: '#F4EBD9', // Nažloutlý laboratorní papír
          200: '#EFE6D5',
          300: '#E4D8C2',
          400: '#D5C5A8',
        },
        kraft: {
          300: '#D6BEA2',
          400: '#C4A482', // Kraftový karton
          500: '#B89772',
          600: '#9E7B56',
          700: '#7D5F3F',
        },
        composite: {
          800: '#2D3237',
          850: '#23272A', // Uhlová šedá (břidlice)
          900: '#1A1D20', // Tmavý kompozitní plast
          950: '#121416', // Hluboký technický podklad
        },
        hazard: {
          400: '#FA9238',
          500: '#F58220', // Výstražná Valve/Hazard oranžová
          600: '#E06D10',
          700: '#C05608',
        },
        cyan: {
          400: '#5AC3FF',
          500: '#38B6FF', // Technická cyan
          600: '#0EA5E9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Barlow Condensed"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
}
