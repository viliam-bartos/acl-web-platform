/**
 * Theme selection. The chosen theme is stored in `localStorage` and applied as
 * a `dark` class on `<html>`, which is what the Tailwind `darkMode: 'class'`
 * setup and the CSS variables in `index.css` expect.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'acl-theme';

export function readStoredTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export interface ChartPalette {
  line: string;
  grid: string;
  axis: string;
  canvas: string;
  marker: string;
}

/** Recharts takes colours as plain values, so they cannot come from CSS. */
export function chartPalette(theme: Theme): ChartPalette {
  if (theme === 'dark') {
    return { line: '#f4ebd9', grid: '#343a40', axis: '#9aa1a8', canvas: '#1d2023', marker: '#1d2023' };
  }
  return { line: '#1a1d20', grid: '#ddd0b6', axis: '#7d5f3f', canvas: '#faf6ee', marker: '#faf6ee' };
}
