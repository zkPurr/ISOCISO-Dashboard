/**
 * The Jira side of the app: the shape of a task, the columns a Jira CSV export
 * can carry, and the two derived values the tables are built on — priority and
 * the due-date severity flag.
 *
 * Unlike the controls sheet, the column set here is *not* fixed: a Jira export
 * carries whatever fields the board happens to have, so every column is
 * imported and the user picks which ones to show. TASK_FIELDS only names the
 * handful that get special treatment (a role, a type, a default seat in the
 * table); everything else is imported as plain text.
 *
 * @typedef {Object} Task
 * @property {string} project   Project key — "SECU" or "ISMSKACT"
 * @property {string} issueKey  "SECU-42", or '' when the export has no key
 * @property {Record<string,string>} cells   Column key -> display text
 * @property {Record<string,number|null>} parsed  Column key -> sortable number
 *                                                (dates as ms, priority as 1-3)
 * @property {number|null} due  Due date in ms, or null
 * @property {number} priority  1 (high) .. 3 (default)
 */

import { normaliseHeader } from './schema.js';

/** The two boards the Taken section splits on, in menu order. */
export const TASK_PROJECTS = [
  { key: 'SECU', label: 'SECU', route: 'taken/secu' },
  { key: 'ISMSKACT', label: 'ISMSKACT', route: 'taken/ismskact' },
];

export const TASK_PROJECT_BY_ROUTE = Object.fromEntries(
  TASK_PROJECTS.map((project) => [project.route, project]),
);

export const TASK_ROUTES = new Set(TASK_PROJECTS.map((project) => project.route));

/**
 * Columns with a role. `type` drives how the cell renders and sorts; `aliases`
 * are matched against the normalised header, exactly — Jira's header names are
 * stable, and fuzzy matching here would let "Status Category" swallow
 * "Status Category Changed".
 */
export const TASK_FIELDS = [
  { role: 'summary', label: 'Summary', type: 'text', aliases: ['summary', 'samenvatting'] },
  { role: 'issueKey', label: 'Issue key', type: 'key', aliases: ['issuekey', 'key'] },
  { role: 'priority', label: 'Priority', type: 'priority', aliases: ['priority', 'prioriteit'] },
  { role: 'statusCategory', label: 'Status Category', type: 'status', aliases: ['statuscategory', 'statuscategorie'] },
  { role: 'created', label: 'Created', type: 'date', aliases: ['created', 'aangemaakt'] },
  { role: 'statusCategoryChanged', label: 'Status Category Changed', type: 'date', aliases: ['statuscategorychanged'] },
  { role: 'dueDate', label: 'Due date', type: 'date', aliases: ['duedate', 'due', 'vervaldatum'] },
  { role: 'assignee', label: 'Assignee', type: 'text', aliases: ['assignee', 'behandelaar', 'toegewezenaan'] },
  { role: 'projectKey', label: 'Project key', type: 'text', aliases: ['projectkey', 'projectsleutel'] },
  { role: 'status', label: 'Status', type: 'status', aliases: ['status'] },
];

const FIELD_BY_ALIAS = new Map(
  TASK_FIELDS.flatMap((field) => field.aliases.map((alias) => [alias, field])),
);

/**
 * The columns shown before anyone touches the picker, in this order.
 * `Project key` is deliberately absent: every row on a board page has the same
 * one, so showing it would cost a column and tell you nothing.
 */
export const DEFAULT_ROLES = [
  'summary', 'issueKey', 'priority', 'statusCategory',
  'created', 'statusCategoryChanged', 'dueDate', 'assignee',
];

/* ------------------------------------------------------------------ Columns */

/**
 * Turns a Jira header row into column definitions.
 *
 * Jira repeats a header once per value for multi-value fields — three
 * `Comment` columns, five `Label` columns. Those are folded into one column
 * whose cells join the non-empty values, which is what the header actually
 * meant; keeping them apart would give the picker five identical entries.
 *
 * @param {unknown[]} headerRow
 * @returns {{ key: string, label: string, role: string|null, type: string, sources: number[] }[]}
 */
export function buildColumns(headerRow) {
  const columns = [];
  const byKey = new Map();
  const takenRoles = new Set();

  headerRow.forEach((raw, index) => {
    const label = String(raw ?? '').trim();
    if (!label) return;

    const key = normaliseHeader(label) || `kolom${index + 1}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.sources.push(index);
      return;
    }

    // A role can only be claimed once. Two columns that both look like the due
    // date would otherwise both be treated as *the* due date, and the second
    // would silently take a seat in the default table. It keeps its type — it
    // still renders as a date — but it is an ordinary column from here on.
    const field = FIELD_BY_ALIAS.get(key);
    const role = field && !takenRoles.has(field.role) ? field.role : null;
    if (role) takenRoles.add(role);

    const column = {
      key,
      label,
      role,
      type: field?.type ?? 'text',
      sources: [index],
    };
    byKey.set(key, column);
    columns.push(column);
  });

  return orderColumns(columns);
}

/** Default-visible columns first, in DEFAULT_ROLES order, then the CSV's own order. */
export function orderColumns(columns) {
  const rank = (column) => {
    const at = DEFAULT_ROLES.indexOf(column.role);
    return at === -1 ? DEFAULT_ROLES.length : at;
  };
  return columns
    .map((column, index) => ({ column, index }))
    .sort((a, b) => rank(a.column) - rank(b.column) || a.index - b.index)
    .map((entry) => entry.column);
}

/** The keys of the columns that start out visible. */
export function defaultColumnKeys(columns) {
  const found = columns.filter((column) => DEFAULT_ROLES.includes(column.role));
  // A CSV without any of the expected columns still has to show something, so
  // fall back to its first few columns rather than an empty table.
  if (!found.length) return columns.slice(0, 6).map((column) => column.key);
  return found.map((column) => column.key);
}

export const columnByRole = (columns, role) => columns.find((column) => column.role === role) || null;

/* -------------------------------------------------------------------- Dates */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  mrt: 2, mei: 4, okt: 9, // Dutch-locale exports
};

/** "10/Aug/26 5:00 AM", "3/Sep/26", "10/Aug/2026 17:00". */
const JIRA_DATE = /^(\d{1,2})\/([A-Za-z]{3,})\/(\d{2,4})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?$/;

/**
 * Jira's own date format first, ISO as a fallback — an export that was opened
 * and re-saved in Excel often comes back as ISO.
 * @returns {number|null} ms since epoch, or null when the cell is not a date
 */
export function parseTaskDate(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const match = text.match(JIRA_DATE);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (month == null) return null;

    let year = Number(match[3]);
    if (year < 100) year += 2000;

    let hour = Number(match[4] ?? 0);
    const meridiem = match[7]?.toLowerCase();
    if (meridiem === 'p' && hour < 12) hour += 12;
    if (meridiem === 'a' && hour === 12) hour = 0;

    const date = new Date(year, month, Number(match[1]), hour, Number(match[5] ?? 0), Number(match[6] ?? 0));
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/* ----------------------------------------------------------------- Priority */

/** 3 is the resting state, so a task without a priority is not made to look calm-but-special. */
export const PRIORITY_DEFAULT = 3;

export const PRIORITY_LABELS = { 1: 'Hoog', 2: 'Middel', 3: 'Standaard' };

/** 1 is the urgent end, so its badge is the loud one. */
export const PRIORITY_TONES = { 1: 'fail', 2: 'warn', 3: 'none' };

const PRIORITY_WORDS = {
  highest: 1, hoogste: 1, high: 1, hoog: 1, critical: 1, kritiek: 1, blocker: 1, urgent: 1,
  medium: 2, middel: 2, normal: 2, normaal: 2, gemiddeld: 2, major: 2,
  low: 3, laag: 3, lowest: 3, laagste: 3, minor: 3, trivial: 3,
};

/** @returns {1|2|3} */
export function parsePriority(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return PRIORITY_DEFAULT;

  const word = PRIORITY_WORDS[normaliseHeader(text)];
  if (word) return word;

  // "1", "P1", "1 - High" all mean the same thing.
  const number = text.match(/[1-3]/);
  if (number) return Number(number[0]);

  return PRIORITY_DEFAULT;
}

/* ------------------------------------------------------------------- Status */

export const STATUS_TONES = {
  todo: 'none',
  tedoen: 'none',
  inprogress: 'info',
  inuitvoering: 'info',
  inbehandeling: 'info',
  done: 'pass',
  gereed: 'pass',
  afgerond: 'pass',
};

export const statusTone = (raw) => STATUS_TONES[normaliseHeader(raw)] || 'none';

/* --------------------------------------------------------- Due-date flagging */

/** Monday 00:00 of the week `date` falls in, in local time. */
function weekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - weekday);
  return start;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How far past its due date a task has drifted, in whole weeks, on the same
 * 1-2-3 scale the controls use:
 *
 *   due later than this week  -> 0  no flag, there is still time
 *   due this week             -> 1  yellow
 *   one week past due         -> 2  amber
 *   two weeks past due or more-> 3  red
 *
 * Weeks rather than days on purpose: a Monday deadline and a Friday deadline in
 * the same week are the same piece of work, and should not flag differently
 * just because the calendar rolled over.
 *
 * @param {number|null} due ms since epoch
 * @param {Date} [now]
 * @returns {0|1|2|3}
 */
export function dueSeverity(due, now = new Date()) {
  if (due == null) return 0;

  // Rounded: a DST change shifts the difference by an hour, not by a week.
  const weeks = Math.round((weekStart(now) - weekStart(new Date(due))) / WEEK_MS);
  if (weeks < 0) return 0;
  return Math.min(weeks + 1, 3);
}

/** The tooltip on a due-date flag — the flag has to say why it is there. */
export function dueSeverityDetail(due, now = new Date()) {
  const level = dueSeverity(due, now);
  if (!level) return '';

  const weeks = Math.round((weekStart(now) - weekStart(new Date(due))) / WEEK_MS);
  if (weeks === 0) return 'deadline valt deze week';
  if (weeks === 1) return 'deadline is een week verstreken';
  return `deadline is ${weeks} weken verstreken`;
}

/* -------------------------------------------------------------------- Rows */

/**
 * Builds one Task from a raw CSV row.
 * @param {unknown[]} row
 * @param {ReturnType<typeof buildColumns>} columns
 */
export function buildTask(row, columns) {
  const cells = {};
  const parsed = {};

  for (const column of columns) {
    // Folded multi-value columns: join what is actually filled in.
    const value = column.sources
      .map((index) => String(row[index] ?? '').trim())
      .filter(Boolean)
      .join(', ');

    cells[column.key] = value;
    if (column.type === 'date') parsed[column.key] = parseTaskDate(value);
  }

  const issueKey = valueOf(cells, columns, 'issueKey');
  const priorityColumn = columnByRole(columns, 'priority');
  const dueColumn = columnByRole(columns, 'dueDate');

  const priority = parsePriority(priorityColumn ? cells[priorityColumn.key] : '');
  if (priorityColumn) parsed[priorityColumn.key] = priority;

  return {
    project: projectOf(valueOf(cells, columns, 'projectKey'), issueKey),
    issueKey,
    cells,
    parsed,
    due: dueColumn ? parsed[dueColumn.key] ?? null : null,
    priority,
  };
}

function valueOf(cells, columns, role) {
  const column = columnByRole(columns, role);
  return column ? cells[column.key] : '';
}

/**
 * The board a task belongs to. The Project key column is the source of truth;
 * an export without one still splits correctly, because a Jira issue key is
 * "<PROJECT>-<number>" by construction.
 */
export function projectOf(projectKey, issueKey) {
  const direct = String(projectKey ?? '').trim().toUpperCase();
  if (direct) return direct;

  const fromKey = String(issueKey ?? '').trim().toUpperCase().match(/^([A-Z][A-Z0-9_]*)-\d+$/);
  return fromKey ? fromKey[1] : '';
}
