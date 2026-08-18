import { el, svg } from '../core/dom.js';
import { num, pct } from '../core/format.js';
import { attachTooltip } from './tooltip.js';

const SIZE = 132;
const R_OUTER = 62;
const R_INNER = 44;
const GAP_PX = 2;          // 2px surface spacer between fills
const CENTER = SIZE / 2;

const polar = (angle, radius) => [
  CENTER + radius * Math.cos(angle - Math.PI / 2),
  CENTER + radius * Math.sin(angle - Math.PI / 2),
];

/** Annular sector path (outer arc → inner arc, reversed). */
function arcPath(start, end) {
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = polar(start, R_OUTER);
  const [x2, y2] = polar(end, R_OUTER);
  const [x3, y3] = polar(end, R_INNER);
  const [x4, y4] = polar(start, R_INNER);

  return [
    `M ${x1} ${y1}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/**
 * Full ring, for the 100%-of-one-segment and the all-zero cases.
 *
 * Drawn as a stroked circle rather than a path: an arc whose two endpoints
 * nearly coincide has two mathematically valid centres, and SVG will happily
 * pick the one that puts the circle off-canvas. A stroked circle has no such
 * ambiguity.
 */
function ring(color) {
  return svg('circle', {
    cx: CENTER,
    cy: CENTER,
    r: (R_OUTER + R_INNER) / 2,
    fill: 'none',
    stroke: color,
    'stroke-width': R_OUTER - R_INNER,
  });
}

/**
 * Donut with a hero percentage in the middle and a labelled legend beside it.
 * Identity is never colour-alone: every segment carries a label and a count.
 *
 * @param {{
 *   title: string,
 *   centerValue: string,
 *   segments: { label: string, value: number, color: string, detail?: string[] }[],
 *   note?: string,
 *   noun?: string,          What the values count, for the tooltip
 *   legendPercent?: boolean Show the share next to the count in the legend
 * }} config
 */
export function donutChart({
  title, centerValue, segments, note, noun = 'controls', legendPercent = false,
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  const canvas = svg('svg', {
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    width: SIZE,
    height: SIZE,
    role: 'img',
    'aria-label': `${title}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`,
  });

  const tooltipFor = (segment) => () => [
    `<strong>${segment.label}</strong><br>${num(segment.value)} ${noun} · ${pct(segment.value, total)}%`,
    // A fold is only honest if you can see what is inside it.
    segment.detail?.length ? `<br>${segment.detail.join('<br>')}` : '',
  ].join('');

  if (!total) {
    canvas.append(ring('var(--viz-neutral)'));
  } else if (visible.length === 1) {
    const only = visible[0];
    const full = ring(only.color);
    attachTooltip(full, tooltipFor(only));
    canvas.append(full);
  } else {
    // Convert the 2px spacer into an angle at the mid-radius.
    const gapAngle = GAP_PX / ((R_OUTER + R_INNER) / 2);
    let cursor = 0;

    for (const segment of visible) {
      const sweep = (segment.value / total) * Math.PI * 2;
      const start = cursor + gapAngle / 2;
      const end = cursor + sweep - gapAngle / 2;
      cursor += sweep;
      if (end <= start) continue;

      const path = svg('path', { d: arcPath(start, end), fill: segment.color });
      attachTooltip(path, tooltipFor(segment));
      canvas.append(path);
    }
  }

  return el('.viz', [
    el('.viz-title', title),
    el('.donut-row', [
      el('.donut', { style: { width: `${SIZE}px`, height: `${SIZE}px` } }, [
        canvas,
        el('.donut-center', centerValue),
      ]),
      el('.legend', segments.map((segment) => {
        const row = el('.legend-row', [
          el('.legend-swatch', { style: { background: segment.color } }),
          el('.legend-name', { title: segment.label }, segment.label),
          el('.legend-value', legendPercent
            ? `${num(segment.value)} · ${pct(segment.value, total)}%`
            : num(segment.value)),
        ]);
        if (total) attachTooltip(row, tooltipFor(segment));
        return row;
      })),
    ]),
    note && el('.bar-sub', note),
  ]);
}
