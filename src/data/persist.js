/**
 * localStorage persistence. Versioned so a schema change can invalidate old
 * payloads instead of rendering something half-migrated.
 */

const KEY = 'isociso.dashboard.v1';

export function save(snapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
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

    // Payloads written before the linked registers — or before Taken — existed
    // simply lack those keys. What they do carry stays usable; the rest starts
    // out empty rather than undefined.
    return {
      ...parsed,
      library: {
        evidence: [],
        policies: [],
        risks: [],
        ...(parsed.library || {}),
      },
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      taskColumns: Array.isArray(parsed.taskColumns) ? parsed.taskColumns : [],
      taskVisible: Array.isArray(parsed.taskVisible) ? parsed.taskVisible : [],
      taskSource: parsed.taskSource ?? null,
    };
  } catch {
    return null;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
