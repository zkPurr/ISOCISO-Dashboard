const nl = new Intl.NumberFormat('nl-NL');

export const num = (value) => nl.format(value ?? 0);

/** Safe percentage — returns 0 rather than NaN when the denominator is 0. */
export function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function dateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Natural sort for control ids: A.5.2 before A.5.10, and 8.x after 7.x. */
export function compareControlId(a, b) {
  const parts = (id) => String(id).replace(/^A\.?/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return String(a).localeCompare(String(b));
}
