/**
 * localStorage persistence. Versioned so a schema change can invalidate old
 * payloads instead of rendering something half-migrated.
 */

const KEY = 'isociso.dashboard.v1';

export function save({ controls, library, source, ui, pageSize }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ controls, library, source, ui, pageSize }));
  } catch {
    // Quota exceeded or private mode — the app stays usable, just not sticky.
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.controls)) return null;

    // Payloads written before the linked registers existed simply have no
    // `library` — their controls stay usable, the registers start out empty.
    return {
      ...parsed,
      library: {
        evidence: [],
        policies: [],
        risks: [],
        ...(parsed.library || {}),
      },
    };
  } catch {
    return null;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
