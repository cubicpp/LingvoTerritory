export type Theme = 'light' | 'dark';

const KEY = 'dialect-viz-theme';

export function getInitialTheme(): Theme {
  try { const v = localStorage.getItem(KEY); if (v === 'dark' || v === 'light') return v; } catch {}
  return 'dark';
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch {}
}

export function toggleTheme(t: Theme): Theme {
  const next = t === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}
