/**
 * localStorage persistence. Versioned so a schema change can invalidate old
 * payloads instead of rendering something half-migrated.
 */

const KEY = 'isociso.dashboard.v1';

export function save({ controls, source, ui, pageSize }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ controls, source, ui, pageSize }));
  } catch {
    // Quota exceeded or private mode — the app stays usable, just not sticky.
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.controls) ? parsed : null;
  } catch {
    return null;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
