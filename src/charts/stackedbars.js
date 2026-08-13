import { el } from '../core/dom.js';
import { num, pct } from '../core/format.js';
import { attachTooltip } from './tooltip.js';

/**
 * 100%-stacked bars, one per domain: passed (bottom, anchored to the baseline)
 * vs not-passed. Percentages are direct-labelled inside the segments, so the
 * legend is a confirmation rather than the only key.
 *
 * @param {{ domain: string, total: number, passed: number }[]} rows
 */
export function domainBars(rows) {
  const bars = rows.map((row) => {
    const passShare = pct(row.passed, row.total);
    const failShare = 100 - passShare;
    const failed = row.total - row.passed;

    const segments = [];

    if (failShare > 0) {
      const top = el('.bar-seg', {
        className: `bar-seg ${passShare > 0 ? 'is-top' : 'is-only'}`,
        style: { flexBasis: `${failShare}%`, background: 'var(--viz-neutral)', color: 'var(--text-secondary)' },
      }, failShare >= 12 ? `${failShare}%` : null);
      attachTooltip(top, () =>
        `<strong>${row.domain} — niet passed</strong><br>${num(failed)} van ${num(row.total)} controls · ${failShare}%`);
      segments.push(top);
    }

    if (passShare > 0) {
      const bottom = el('.bar-seg', {
        className: `bar-seg ${failShare > 0 ? 'is-bottom' : 'is-only'}`,
        style: { flexBasis: `${passShare}%`, background: 'var(--viz-pass)', color: '#fff' },
      }, passShare >= 12 ? `${passShare}%` : null);
      attachTooltip(bottom, () =>
        `<strong>${row.domain} — passed</strong><br>${num(row.passed)} van ${num(row.total)} controls · ${passShare}%`);
      segments.push(bottom);
    }

    return el('.bar-col', [
      el('.bar-stack', segments),
      el('.bar-label', row.domain),
      el('.bar-sub', `${num(row.passed)} / ${num(row.total)} passed`),
    ]);
  });

  return el('.viz', [
    el('.viz-head', [
      el('.viz-title', 'Verdeling per domein'),
      el('.legend-inline', [
        el('.legend-row', [
          el('.legend-swatch', { style: { background: 'var(--viz-pass)' } }),
          el('span.legend-name', '≥ 3 passed'),
        ]),
        el('.legend-row', [
          el('.legend-swatch', { style: { background: 'var(--viz-neutral)' } }),
          el('span.legend-name', '< 3 niet passed'),
        ]),
      ]),
    ]),
    rows.length
      ? el('.bars', bars)
      : el('.bar-sub', 'Geen domeinen in de dataset.'),
  ]);
}
