import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { num } from '../core/format.js';
import { state, setState } from '../core/store.js';
import { EMPTY_LABELS, MATURITY_PASS_THRESHOLD, POLICY_FALLBACK_LABEL } from '../data/schema.js';
import { resolveRefs } from '../data/selectors.js';
import { openDetailPane } from './detailPane.js';
import { recordLink } from './links.js';
import { SEVERITY_HEADER, severityCell, severityRowClass } from './severity.js';

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

const emptyCell = (label) =>
  el('span.link-cell.is-empty', { title: 'Niet gekoppeld in de bronsheet' }, label);

/**
 * Evidence and risks open the detail pane: their content is a description plus
 * a status or a source, which needs more room than a table cell.
 */
function paneCell(control, kind, verb, emptyLabel) {
  const ids = control[kind] || [];
  if (!ids.length) return emptyCell(emptyLabel);

  const { missing } = resolveRefs(ids, state.library[kind]);

  return el('button.link-cell', {
    type: 'button',
    title: `${verb} — id ${ids.join(', ')}`,
    onclick: () => openDetailPane({ control, kind }),
  }, [
    `${verb} (${ids.length})`,
    missing.length
      ? icon('alert', { size: 14 })
      : icon('chevronUp', { size: 14 }),
  ]);
}

/** How many policy links fit in a cell before the rest moves into the pane. */
const POLICY_CELL_LIMIT = 2;

/**
 * Beleid skips the pane: a policy is a document, so the row links straight to
 * it in a new tab, with the description as the anchor text.
 */
function policyCell(control) {
  const ids = control.policies || [];
  if (!ids.length) return emptyCell(EMPTY_LABELS.policies);

  const { found, missing } = resolveRefs(ids, state.library.policies);
  const shown = found.slice(0, POLICY_CELL_LIMIT);
  const rest = found.length - shown.length + missing.length;

  const links = shown.map((policy) =>
    recordLink(policy, { label: policy.description, fallback: POLICY_FALLBACK_LABEL }));

  if (!links.length || rest > 0) {
    links.push(el('button.link-more', {
      type: 'button',
      title: `Alle gekoppelde beleidsstukken bij ${control.id}`,
      onclick: () => openDetailPane({ control, kind: 'policies' }),
    }, links.length ? `+${rest} meer` : `${ids.length} gekoppeld — bekijken`));
  }

  return el('.link-stack', links);
}

const COLUMNS = [
  // The flag lives in its own leading column rather than inside the id cell,
  // so a flagged row lines up with an unflagged one instead of shifting.
  { key: 'severity',  label: SEVERITY_HEADER,                sortable: true, flag: true },
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
    className: [
      column.sortable && 'sortable',
      column.center && 'is-center',
      column.flag && 'col-flag',
    ].filter(Boolean).join(' '),
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

  const body = rows.map((control) => el('tr', {
    className: severityRowClass(control.severity),
  }, [
    severityCell(control.severity, `Severity_Flag ${control.severity} uit de bronsheet`),
    el('td.col-id', control.id),
    el('td.col-title', control.title || el('span.muted', 'Geen beschrijving')),
    el('td.col-domain', control.domain || el('span.muted', 'Onbekend')),
    el('td.col-owner', control.owner || el('span.muted', 'Geen eigenaar')),
    el('td.is-center', maturityBadge(control.maturity)),
    el('td.is-center', paneCell(control, 'evidence', 'Evidence', EMPTY_LABELS.evidence)),
    el('td.is-center', policyCell(control)),
    el('td.is-center', paneCell(control, 'risks', "Risico's", EMPTY_LABELS.risks)),
  ]));

  return el('.table-wrap', el('table.data', [
    el('caption.sr-only', `${num(rows.length)} beheersmaatregelen op deze pagina`),
    el('thead', el('tr', COLUMNS.map(headerCell))),
    el('tbody', body),
  ]));
}
