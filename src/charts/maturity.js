import { el } from '../core/dom.js';
import { num, pct } from '../core/format.js';
import { attachTooltip } from './tooltip.js';
import { donutChart } from './donut.js';
import { MATURITY_LEVELS, MATURITY_UNSCORED, MATURITY_PASS_THRESHOLD, maturityLevel } from '../data/schema.js';
import { SCORE_SERIES, scoreOf, formatAvg, shortControlLabel, isOverride } from '../data/maturity.js';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/** The segments of a distribution in scale order, unscored last. */
function segmentsOf(dist) {
  return [
    ...MATURITY_LEVELS.map((level) => ({ ...level, label: `${level.level} — ${level.name}`, value: dist.counts[level.level] })),
    { ...MATURITY_UNSCORED, label: MATURITY_UNSCORED.name, value: dist.unscored },
  ];
}

/** Legend for the 0..5 scale. Always shown beside the colour — never colour alone. */
export function levelLegend({ withUnscored = true } = {}) {
  const items = [...MATURITY_LEVELS, ...(withUnscored ? [MATURITY_UNSCORED] : [])];
  return el('.legend-inline.mat-legend', items.map((item) => el('.legend-row', [
    el('.legend-swatch', { style: { background: item.color } }),
    el('span.legend-name', item.level != null ? `${item.level} ${item.name}` : item.name),
  ])));
}

/**
 * One long 100%-stacked bar: the share of controls at each level. Segments
 * wide enough carry their percentage; every segment has a tooltip.
 *
 * @param {{ total: number, counts: number[], unscored: number, avg: number|null }} dist
 * @param {{ label: string, sub?: string, noun?: string }} opts
 */
export function levelBar(dist, { label, sub, noun = 'controls' }) {
  const segments = segmentsOf(dist).filter((s) => s.value > 0);

  const track = el('.mat-bar', { role: 'img', 'aria-label': `${label}: ${segmentsOf(dist).map((s) => `${s.label} ${s.value}`).join(', ')}` },
    segments.map((segment) => {
      const share = pct(segment.value, dist.total);
      const exact = (segment.value / dist.total) * 100;
      const node = el('.mat-seg', {
        style: { flexBasis: `${exact}%`, background: segment.color, color: segment.ink },
      }, exact >= 7 ? `${share}%` : null);
      attachTooltip(node, () =>
        `<strong>${escape(label)} — ${escape(segment.label)}</strong><br>${num(segment.value)} van ${num(dist.total)} ${noun} · ${share}%`);
      return node;
    }));

  return el('.mat-bar-row', [
    el('.mat-bar-label', [
      el('strong', label),
      el('span', sub ?? `${num(dist.total)} controls · gem. ${formatAvg(dist.avg)}`),
    ]),
    dist.total ? track : el('.mat-bar.is-empty'),
  ]);
}

/**
 * Pie (donut) of the level distribution for one domain. The centre shows the
 * average; the legend lists every level that occurs, so a slice is never
 * identified by colour alone. Levels with no controls are left out of the
 * legend to keep four of these side by side readable.
 */
export function levelDonut(dist, { title, series }) {
  const atTarget = dist.counts.slice(MATURITY_PASS_THRESHOLD).reduce((a, b) => a + b, 0);
  const segments = segmentsOf(dist)
    .filter((s) => s.value > 0)
    .map((s) => ({ label: s.label, value: s.value, color: s.color }));

  return donutChart({
    title,
    centerValue: formatAvg(dist.avg),
    segments: segments.length ? segments : [{ label: 'Geen controls', value: 0, color: MATURITY_UNSCORED.color }],
    legendPercent: true,
    note: `${num(dist.total)} controls · gem. ${series.toLowerCase()} ${formatAvg(dist.avg)} · ${pct(atTarget, dist.total)}% op niveau ≥ ${MATURITY_PASS_THRESHOLD}`,
  });
}

/** Matrix of averages: domains down, Score / Proces / Beleid / Evidence across. */
export function averageTable(matrix) {
  const cell = (value) => {
    if (value == null) return el('td.is-center', el('span.muted', '—'));
    const level = maturityLevel(Math.floor(value));
    return el('td.is-center', el('span.mat-avg', {
      style: { background: level.color, color: level.ink },
      title: `Gemiddeld ${formatAvg(value)} — ${level.name}`,
    }, formatAvg(value)));
  };

  return el('.table-wrap', el('table.data.mat-matrix', [
    el('thead', el('tr', [
      el('th', { scope: 'col' }, 'Domein'),
      el('th.is-center', { scope: 'col' }, 'Controls'),
      ...SCORE_SERIES.map((s) => el('th.is-center', { scope: 'col' }, s.key === 'maturity' ? 'Score (min)' : s.label)),
    ])),
    el('tbody', matrix.map((row) => el('tr', { className: row.label === 'Totaal' ? 'is-total' : '' }, [
      el('td', row.label),
      el('td.is-center.tnum', num(row.count)),
      ...row.values.map(cell),
    ]))),
  ]));
}

function cellTooltip(control) {
  const lines = SCORE_SERIES.map(({ key, label }) => {
    const score = scoreOf(control, key);
    const level = maturityLevel(score);
    return `${label}: <strong>${score ?? '—'}</strong> ${escape(level.name)}`;
  });
  return [
    `<strong>${escape(control.id)}</strong> ${escape(control.title || '')}`,
    control.owner ? `Eigenaar: ${escape(control.owner)}` : '',
    ...lines,
    isOverride(control) ? '<em>Score handmatig afwijkend van MIN</em>' : '',
    '<span style="opacity:.75">Klik voor groeiadvies</span>',
  ].filter(Boolean).join('<br>');
}

/**
 * Heatmap for one domain: a strip of cells, one per control, labelled with
 * the control's number inside the domain (5.12 -> "12"). With `detail`, the
 * Proces / Beleid / Evidence strips sit underneath, aligned per control, so
 * you can see which leg pulls a score down.
 */
export function domainHeatmap({ domain, controls }, { detail, onOpen }) {
  const series = detail ? SCORE_SERIES : SCORE_SERIES.slice(0, 1);

  const rows = series.map(({ key, label }) => el('.hm-row', { className: `hm-row${key === 'maturity' ? ' is-main' : ''}` }, [
    el('.hm-row-label', label),
    el('.hm-cells', controls.map((control) => {
      const score = scoreOf(control, key);
      const level = maturityLevel(score);
      const cell = el('button.hm-cell', {
        type: 'button',
        className: `hm-cell${score == null ? ' is-unscored' : ''}`,
        style: { background: level.color, color: level.ink },
        'aria-label': `${control.id} ${label}: ${score ?? 'niet beoordeeld'}`,
        onclick: () => onOpen(control),
      }, key === 'maturity' ? shortControlLabel(control.id) : null);
      attachTooltip(cell, () => cellTooltip(control));
      return cell;
    })),
  ]));

  return el('.hm-domain', rows);
}
