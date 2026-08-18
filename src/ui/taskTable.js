import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { num, dateTime } from '../core/format.js';
import { state, setState } from '../core/store.js';
import {
  dueSeverity, dueSeverityDetail, statusTone,
  PRIORITY_LABELS, PRIORITY_TONES,
} from '../data/tasks.js';
import { SEVERITY_HEADER, severityCell, severityRowClass } from './severity.js';

/**
 * The Taken table. Its columns come from the imported CSV rather than from a
 * fixed list, so everything here is driven by the column definitions: what a
 * cell looks like, how it sorts, and how wide it is allowed to get.
 */

/** Priority is 1 (high) .. 3 (default) — the number alone would not say which. */
function priorityBadge(task, raw) {
  const level = task.priority;
  const label = PRIORITY_LABELS[level] || raw;
  return el('span.badge', {
    className: `badge badge-${PRIORITY_TONES[level] || 'none'}`,
    title: `Prioriteit ${level}${raw && raw !== String(level) ? ` ("${raw}")` : ''} — 1 is hoog, 3 is standaard`,
  }, `${level} · ${label}`);
}

function dateCell(task, column, value) {
  const ms = task.parsed[column.key];
  if (ms == null) return value ? el('span.muted', value) : el('span.muted', '—');
  // The source text stays in the tooltip: Jira's own format is what you would
  // search for back in Jira.
  return el('span', { title: value }, dateTime(new Date(ms).toISOString()));
}

function cellContent(task, column) {
  const value = task.cells[column.key] || '';

  if (column.type === 'priority') return priorityBadge(task, value);
  if (column.type === 'date') return dateCell(task, column, value);
  if (column.type === 'status') {
    return value
      ? el('span.badge', { className: `badge badge-${statusTone(value)}` }, value)
      : el('span.muted', '—');
  }
  if (!value) return el('span.muted', '—');
  if (column.type === 'key') return value;

  // Free text — a Summary or a Description must not be allowed to set the
  // width of the whole table.
  return el('span.cell-clip', { title: value }, value);
}

const cellClass = (column) => ({
  date: 'col-date',
  key: 'col-key',
  priority: 'is-center',
  status: 'is-center',
}[column.type] || 'col-text');

function toggleSort(key) {
  const { taskSort } = state;
  // Severity and priority are most useful loudest-first, so their first click
  // sorts descending / most urgent instead of showing the calm rows first.
  const preferDesc = key === 'severity';
  const dir = taskSort.key === key
    ? (taskSort.dir === 'asc' ? 'desc' : 'asc')
    : (preferDesc ? 'desc' : 'asc');
  setState({ taskSort: { key, dir }, taskPage: 1 });
}

function headerCell({ key, label, center, flag }) {
  const isSorted = state.taskSort.key === key;
  const caret = icon(isSorted ? (state.taskSort.dir === 'asc' ? 'arrowUp' : 'arrowDown') : 'sort', { size: 13 });
  caret.setAttribute('class', `sort-caret${isSorted ? ' is-active' : ''}`);

  return el('th', {
    className: ['sortable', center && 'is-center', flag && 'col-flag'].filter(Boolean).join(' '),
    scope: 'col',
    'aria-sort': isSorted ? (state.taskSort.dir === 'asc' ? 'ascending' : 'descending') : null,
    onclick: () => toggleSort(key),
  }, el('span.th-inner', [label, caret]));
}

/**
 * @param {import('../data/tasks.js').Task[]} rows
 * @param {object[]} columns The visible columns, in display order
 */
export function taskTable(rows, columns) {
  if (!rows.length) {
    return el('.empty', [
      el('.empty-icon', icon('search', { size: 24 })),
      el('h2', 'Geen taken gevonden'),
      el('p', state.taskQuery
        ? `Geen enkele taak op dit bord bevat "${state.taskQuery}".`
        : 'Er staan geen taken van dit bord in de geïmporteerde export.'),
    ]);
  }

  const now = new Date();

  const head = el('tr', [
    headerCell({ key: 'severity', label: SEVERITY_HEADER, flag: true }),
    ...columns.map((column) => headerCell({
      key: column.key,
      label: column.label,
      center: column.type === 'priority' || column.type === 'status',
    })),
  ]);

  const body = rows.map((task) => {
    const level = dueSeverity(task.due, now);
    return el('tr', { className: severityRowClass(level) }, [
      severityCell(level, dueSeverityDetail(task.due, now)),
      ...columns.map((column) => el('td', {
        className: cellClass(column),
      }, cellContent(task, column))),
    ]);
  });

  return el('.table-wrap', el('table.data', [
    el('caption.sr-only', `${num(rows.length)} taken op deze pagina`),
    el('thead', head),
    el('tbody', body),
  ]));
}
