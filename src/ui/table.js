import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { num } from '../core/format.js';
import { state, setState } from '../core/store.js';
import { EMPTY_LABELS, MATURITY_PASS_THRESHOLD } from '../data/schema.js';

/**
 * Maturity as a badge. The colour is a status role, and it is always paired
 * with the number itself — so the score is never carried by colour alone.
 */
function maturityBadge(score) {
  if (score == null) return el('span.badge.badge-none', 'n.v.t.');

  const tone = score >= 4 ? 'pass'
    : score >= MATURITY_PASS_THRESHOLD ? 'pass'
      : score === 2 ? 'warn' : 'fail';

  return el('span.badge', { className: `badge badge-${tone}` }, `${score} / 5`);
}

/**
 * Link cell for evidence / beleid / risico's. The sheet does not carry these
 * relations yet, so the empty state is the normal case, not an error.
 */
function linkCell(items, verb, emptyLabel) {
  if (!items || items.length === 0) {
    return el('span.link-cell.is-empty', { title: 'Nog niet gekoppeld in de bronsheet' }, emptyLabel);
  }
  return el('a.link-cell', {
    href: '#/beheersmaatregelen',
    title: items.join(', '),
    onclick: (e) => e.preventDefault(),
  }, [`${verb} (${items.length})`, icon('external', { size: 14 })]);
}

const COLUMNS = [
  { key: 'id',        label: 'Control ID',                   sortable: true },
  { key: 'title',     label: 'Beschrijving',                 sortable: true },
  { key: 'domain',    label: 'Domein',                       sortable: true },
  { key: 'owner',     label: 'Eigenaar',                     sortable: true },
  { key: 'maturity',  label: 'ISO27002 Maturiteit Beoordeling', sortable: true, center: true },
  { key: 'evidence',  label: 'Evidence',                     center: true },
  { key: 'policies',  label: 'Beleid',                       center: true },
  { key: 'risks',     label: "Risico's",                     center: true },
];

function toggleSort(key) {
  const { sort } = state;
  const dir = sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc';
  setState({ sort: { key, dir }, page: 1 });
}

function headerCell(column) {
  const isSorted = state.sort.key === column.key;
  const caret = !column.sortable ? null
    : icon(isSorted ? (state.sort.dir === 'asc' ? 'arrowUp' : 'arrowDown') : 'sort', { size: 13 });
  if (caret) caret.setAttribute('class', `sort-caret${isSorted ? ' is-active' : ''}`);

  return el('th', {
    className: `${column.sortable ? 'sortable ' : ''}${column.center ? 'is-center' : ''}`.trim(),
    scope: 'col',
    'aria-sort': isSorted ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : null,
    onclick: column.sortable ? () => toggleSort(column.key) : null,
  }, el('span.th-inner', [column.label, caret]));
}

export function controlsTable(rows) {
  if (!rows.length) {
    return el('.empty', [
      el('.empty-icon', icon('search', { size: 24 })),
      el('h2', 'Geen controls gevonden'),
      el('p', 'Geen enkele control voldoet aan de huidige filters. Pas de filters aan of wis ze.'),
    ]);
  }

  const body = rows.map((control) => el('tr', [
    el('td.col-id', control.id),
    el('td.col-title', control.title || el('span.muted', 'Geen beschrijving')),
    el('td.col-domain', control.domain || el('span.muted', 'Onbekend')),
    el('td.col-owner', control.owner || el('span.muted', 'Geen eigenaar')),
    el('td.is-center', maturityBadge(control.maturity)),
    el('td.is-center', linkCell(control.evidence, 'Evidence bekijken', EMPTY_LABELS.evidence)),
    el('td.is-center', linkCell(control.policies, 'Beleid bekijken', EMPTY_LABELS.policies)),
    el('td.is-center', linkCell(control.risks, "Risico's bekijken", EMPTY_LABELS.risks)),
  ]));

  return el('.table-wrap', el('table.data', [
    el('caption.sr-only', `${num(rows.length)} beheersmaatregelen op deze pagina`),
    el('thead', el('tr', COLUMNS.map(headerCell))),
    el('tbody', body),
  ]));
}
