import { columnByRole } from './tasks.js';
import { normaliseHeader } from './schema.js';

/**
 * Distributions behind the board's pie charts.
 *
 * Counting is the easy half; the hard half is that a Jira board has as many
 * assignees and labels as it likes, and a pie stops being readable well before
 * that. So every distribution folds its tail into one "Overig" slice — past
 * roughly seven classes adjacent hues are no longer tellable apart, and the
 * honest fix is fewer slices, not more colours.
 */

/** Six named slots plus the fold. Assigned by slot order, never cycled. */
const SERIES_COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--series-${n})`);
const OTHER_COLOR = 'var(--series-other)';

/** How many real categories get their own colour before the rest folds. */
const SLICE_LIMIT = SERIES_COLORS.length;

const COLLATOR = new Intl.Collator('nl', { sensitivity: 'base' });

/**
 * @param {import('./tasks.js').Task[]} tasks
 * @param {(task) => string[]} extract  Zero, one or many categories per task
 * @param {{ emptyLabel: string }} opts
 */
export function distribution(tasks, extract, { emptyLabel }) {
  const counts = new Map();
  let total = 0;

  for (const task of tasks) {
    const values = extract(task);
    // A task with nothing in the column is still a task — it counts under an
    // explicit "empty" category rather than silently shrinking the total.
    for (const value of values.length ? values : [emptyLabel]) {
      counts.set(value, (counts.get(value) || 0) + 1);
      total += 1;
    }
  }

  // Biggest first, ties alphabetical — so the same data always draws the same
  // chart, whatever order the rows arrived in.
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || COLLATOR.compare(a[0], b[0]));

  const head = ranked.slice(0, SLICE_LIMIT);
  const tail = ranked.slice(SLICE_LIMIT);

  const slices = head.map(([label, value], i) => ({
    label,
    value,
    color: SERIES_COLORS[i],
  }));

  if (tail.length) {
    slices.push({
      label: 'Overig',
      value: tail.reduce((sum, [, value]) => sum + value, 0),
      color: OTHER_COLOR,
      // The fold must stay inspectable — the tooltip names what went into it.
      detail: tail.map(([label, value]) => `${label} — ${value}`),
    });
  }

  return { slices, total, distinct: ranked.length, folded: tail.length };
}

/* ------------------------------------------------------------------
   The three groupings. Each returns the raw category values for one
   task; the counting above does not care how many there are.
   ------------------------------------------------------------------ */

const cellFor = (task, columns, role) => {
  const column = columnByRole(columns, role);
  return column ? (task.cells[column.key] || '').trim() : '';
};

export const assigneeOf = (columns) => (task) => {
  const value = cellFor(task, columns, 'assignee');
  return value ? [value] : [];
};

/**
 * The full Status, not the To Do / In Progress category — that is the coarser
 * field and it already has its own column. Boards without it fall back.
 */
export const statusOf = (columns) => (task) => {
  const value = cellFor(task, columns, 'status') || cellFor(task, columns, 'statusCategory');
  return value ? [value] : [];
};

/**
 * One row can carry several labels — either because Jira repeated the column
 * (folded to "a, b" at import) or because the cell itself is a list. Both are
 * split, and a task counts once per label it carries.
 */
export const labelsOf = (columns) => (task) => {
  const column = columns.find((c) => /^labels?$/i.test(c.label));
  if (!column) return [];
  return (task.cells[column.key] || '')
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
};

/* ------------------------------------------------------------------
   Closed. A task is closed when its Status says so, or — for exports
   whose Status is a custom word — when Jira's own Status Category is
   Done. The charts leave these out unless asked.
   ------------------------------------------------------------------ */

const CLOSED_WORDS = new Set([
  'closed', 'gesloten', 'done', 'gereed', 'afgerond', 'resolved', 'opgelost',
  'cancelled', 'canceled', 'geannuleerd', 'wontdo', 'wontfix',
]);

export const isClosedOf = (columns) => (task) => {
  const status = normaliseHeader(cellFor(task, columns, 'status'));
  const category = normaliseHeader(cellFor(task, columns, 'statusCategory'));
  return CLOSED_WORDS.has(status) || CLOSED_WORDS.has(category);
};

/* ------------------------------------------------------------------
   Date range. The charts can be narrowed to the tasks created in a
   window; an empty bound means "open on that side", so the default
   — both empty — is the whole board.
   ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, '0');

/** ms -> "2026-08-10", in local time — the value format of <input type="date">. */
export function toDayValue(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-08-10" -> local midnight in ms, or null for an empty or broken value. */
function fromDayValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

/** The column the range applies to. Null when the export has no Created. */
export const createdColumn = (columns) => columnByRole(columns, 'created');

/** First and last Created date on the board, as day values; null when none is filled in. */
export function createdBounds(tasks, column) {
  let min = Infinity;
  let max = -Infinity;
  for (const task of tasks) {
    const at = task.parsed[column.key];
    if (at == null) continue;
    if (at < min) min = at;
    if (at > max) max = at;
  }
  return min === Infinity ? null : { from: toDayValue(min), to: toDayValue(max) };
}

/**
 * The tasks created within `range`, both days inclusive.
 *
 * With no bound set nothing is dropped — not even a task without a Created
 * date. Once a bound is set such a task cannot be placed inside it, so it
 * falls out; the caller says how many did.
 *
 * @param {{ from?: string, to?: string }|null} range
 */
export function tasksInRange(tasks, column, range) {
  const from = fromDayValue(range?.from);
  const to = fromDayValue(range?.to);
  if (from == null && to == null) return tasks;

  // The end day counts in full: everything before the next midnight.
  const end = to == null ? null : new Date(to).setDate(new Date(to).getDate() + 1);

  return tasks.filter((task) => {
    const at = task.parsed[column.key];
    if (at == null) return false;
    return (from == null || at >= from) && (end == null || at < end);
  });
}
