import { el } from '../core/dom.js';
import { icon } from './icons.js';

/**
 * The 1-2-3 severity scale, shared by the controls table (Severity_Flag out of
 * the sheet) and the task tables (derived from the due date). One scale, one
 * set of colours, one column — so "kritiek" looks the same wherever it appears.
 */

export const SEVERITY_HEADER = 'Actie Nodig';

/** Never colour alone: the level is always in the tooltip and the a11y name. */
export const SEVERITY_LABELS = {
  1: 'Aandacht',
  2: 'Urgent',
  3: 'Kritiek',
};

/** Class for the <tr>, which tints the whole row. Empty when unflagged. */
export const severityRowClass = (level) => (level ? `sev-${level}` : '');

/**
 * The cell contents for the leading flag column.
 * @param {number|null} level 1..3, or null/0 for no flag
 * @param {string} [detail] Why this row is flagged — shown on hover
 * @returns {Node|null} null renders an empty cell, which is the point: an
 *   unflagged row shows nothing at all rather than a placeholder.
 */
export function severityFlag(level, detail) {
  if (!level) return null;

  const label = SEVERITY_LABELS[level] || `Niveau ${level}`;
  return el('span.sev-flag', {
    className: `sev-flag is-${level}`,
    title: detail ? `${label} — ${detail}` : label,
    'aria-label': label,
    role: 'img',
  }, icon('flag', { size: 16, fill: true }));
}

/** The leading `<td>`, ready to be unshifted onto a row. */
export const severityCell = (level, detail) =>
  el('td.col-flag', severityFlag(level, detail));
