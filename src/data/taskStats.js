import { columnByRole } from './tasks.js';

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
