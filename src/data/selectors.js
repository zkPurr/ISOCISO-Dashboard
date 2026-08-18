import { DOMAIN_ORDER, DOMAIN_UNKNOWN, MATURITY_PASS_THRESHOLD, refKey } from './schema.js';
import { parseQuery, matchesQuery } from './query.js';
import { compareControlId } from '../core/format.js';
import { dueSeverity } from './tasks.js';

export const isPassed = (control) =>
  control.maturity != null && control.maturity >= MATURITY_PASS_THRESHOLD;

export const isScored = (control) => control.maturity != null;

/** Aggregate counts for the stat cards and the KPI donuts. */
export function summarise(controls) {
  const total = controls.length;
  const passed = controls.filter(isPassed).length;
  const scored = controls.filter(isScored).length;
  const withEvidence = controls.filter((c) => c.evidence.length > 0).length;
  const withPolicies = controls.filter((c) => c.policies.length > 0).length;
  const withRisks = controls.filter((c) => c.risks.length > 0).length;

  return {
    total,
    passed,
    // Unscored controls count as "niet passed" — an unassessed control is not evidence of compliance.
    failed: total - passed,
    scored,
    unscored: total - scored,
    withEvidence,
    withoutEvidence: total - withEvidence,
    withPolicies,
    withoutPolicies: total - withPolicies,
    withRisks,
    withoutRisks: total - withRisks,
  };
}

/** Per-domain pass/fail split, in fixed display order. */
export function byDomain(controls) {
  const buckets = new Map(DOMAIN_ORDER.map((d) => [d, { domain: d, total: 0, passed: 0 }]));

  for (const control of controls) {
    const key = control.domain || DOMAIN_UNKNOWN;
    if (!buckets.has(key)) buckets.set(key, { domain: key, total: 0, passed: 0 });
    const bucket = buckets.get(key);
    bucket.total += 1;
    if (isPassed(control)) bucket.passed += 1;
  }

  // Drop the fixed domains that this (still incomplete) sheet has no rows for.
  return [...buckets.values()].filter((b) => b.total > 0);
}

/** Distinct owners, alphabetical, for the filter dropdown. */
export function ownerOptions(controls) {
  return [...new Set(controls.map((c) => c.owner).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'nl'));
}

export function domainOptions(controls) {
  const present = new Set(controls.map((c) => c.domain).filter(Boolean));
  const ordered = DOMAIN_ORDER.filter((d) => present.has(d));
  const extra = [...present].filter((d) => !DOMAIN_ORDER.includes(d)).sort((a, b) => a.localeCompare(b, 'nl'));
  return [...ordered, ...extra];
}

export function applyFilters(controls, filters) {
  // Parsed once per call, not once per row — the syntax check is the same for
  // every control.
  const query = parseQuery(filters.query);

  return controls.filter((control) => {
    if (!matchesQuery(control, query)) return false;
    if (filters.owner && control.owner !== filters.owner) return false;
    if (filters.domain && control.domain !== filters.domain) return false;

    if (filters.maturity) {
      if (filters.maturity === 'pass' && !isPassed(control)) return false;
      if (filters.maturity === 'fail' && (isPassed(control) || !isScored(control))) return false;
      if (filters.maturity === 'none' && isScored(control)) return false;
      if (/^[1-5]$/.test(filters.maturity) && control.maturity !== Number(filters.maturity)) return false;
    }

    if (filters.evidence === 'yes' && control.evidence.length === 0) return false;
    if (filters.evidence === 'no' && control.evidence.length > 0) return false;

    return true;
  });
}

const COLLATOR = new Intl.Collator('nl', { sensitivity: 'base' });

export function applySort(controls, { key, dir }) {
  const factor = dir === 'desc' ? -1 : 1;

  return [...controls].sort((a, b) => {
    if (key === 'id') return compareControlId(a.id, b.id) * factor;
    if (key === 'severity') {
      // Unflagged rows sink in both directions — sorting on this column is
      // always about finding the rows that need action.
      if (a.severity == null && b.severity == null) return compareControlId(a.id, b.id);
      if (a.severity == null) return 1;
      if (b.severity == null) return -1;
      return (a.severity - b.severity) * factor || compareControlId(a.id, b.id);
    }
    if (key === 'maturity') {
      // Unscored rows always sink to the bottom, in both directions.
      if (a.maturity == null && b.maturity == null) return compareControlId(a.id, b.id);
      if (a.maturity == null) return 1;
      if (b.maturity == null) return -1;
      return (a.maturity - b.maturity) * factor || compareControlId(a.id, b.id);
    }
    const cmp = COLLATOR.compare(a[key] ?? '', b[key] ?? '');
    return cmp * factor || compareControlId(a.id, b.id);
  });
}

/* ------------------------------------------------------------------
   Links between the controls sheet and the Evidence / Beleid / Risk
   registers. Both directions are needed: a control lists record ids,
   and a register row wants to know which controls point at it.
   ------------------------------------------------------------------ */

// Keyed on the array itself, so a fresh import invalidates the index for free.
const indexCache = new WeakMap();

/** id -> record, built once per register array. */
export function libraryIndex(records = []) {
  let index = indexCache.get(records);
  if (!index) {
    index = new Map(records.map((record) => [record.id, record]));
    indexCache.set(records, index);
  }
  return index;
}

/**
 * Resolves the ids in a control's cell against a register.
 * Unknown ids are kept in `missing` rather than dropped — a typo in the sheet
 * should be visible in the UI, not silently swallowed.
 */
export function resolveRefs(ids, records = []) {
  const index = libraryIndex(records);
  const found = [];
  const missing = [];
  const seen = new Set();

  for (const raw of ids || []) {
    const key = refKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const record = index.get(key);
    if (record) found.push(record);
    else missing.push(String(raw).trim());
  }
  return { found, missing, total: found.length + missing.length };
}

/** Reverse index: record id -> the controls that reference it. */
export function controlsByRef(controls, key) {
  const map = new Map();
  for (const control of controls) {
    for (const raw of control[key] || []) {
      const id = refKey(raw);
      if (!id) continue;
      if (!map.has(id)) map.set(id, []);
      const list = map.get(id);
      if (!list.includes(control)) list.push(control);
    }
  }
  return map;
}

/** Numeric-first ordering, so 2 comes before 10 and "R-01" still sorts sanely. */
export function compareRef(a, b) {
  const na = Number(a.id);
  const nb = Number(b.id);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  if (Number.isFinite(na)) return -1;
  if (Number.isFinite(nb)) return 1;
  return COLLATOR.compare(a.id, b.id);
}

/** Free-text search across a register, over every field the user can see. */
export function filterLibrary(records, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return records;

  return records.filter((record) => {
    const haystack = `${record.rawId} ${record.description} ${record.status ?? ''} ${record.link?.raw ?? ''}`;
    return haystack.toLowerCase().includes(needle);
  });
}

/** `pageSize` of 0 is the "Alles" option — everything on a single page. */
export function paginate(rows, page, pageSize) {
  const size = pageSize > 0 ? pageSize : Math.max(rows.length, 1);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    page: safePage,
    pageCount,
    from: rows.length ? start + 1 : 0,
    to: Math.min(start + size, rows.length),
    total: rows.length,
  };
}

/** The visible slice, filtered + sorted + paged. Single source of truth for both views. */
export function selectView(state) {
  const filtered = applyFilters(state.controls, state.filters);
  const sorted = applySort(filtered, state.sort);
  return paginate(sorted, state.page, state.pageSize);
}

/* ------------------------------------------------------------------
   Taken. The same filter -> sort -> paginate pipeline as the controls,
   but over a column set that is only known at import time.
   ------------------------------------------------------------------ */

export const tasksForProject = (tasks, project) =>
  tasks.filter((task) => task.project === project);

/**
 * Free-text search over every imported cell — including the columns that are
 * currently hidden. Searching only the visible columns would make the result
 * depend on the picker, which is not what a search box is for.
 */
export function filterTasks(tasks, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return tasks;

  return tasks.filter((task) =>
    Object.values(task.cells).some((value) => value.toLowerCase().includes(needle)));
}

/** Sorts by the flag column, or by any imported column, according to its type. */
export function sortTasks(tasks, { key, dir }, columns, now = new Date()) {
  const factor = dir === 'desc' ? -1 : 1;
  const column = columns.find((c) => c.key === key);

  // Ties fall back to the due date, then the issue key — so two rows with the
  // same status keep a stable, meaningful order instead of the CSV's.
  const tiebreak = (a, b) =>
    (a.due ?? Infinity) - (b.due ?? Infinity)
    || COLLATOR.compare(a.issueKey, b.issueKey);

  return [...tasks].sort((a, b) => {
    if (key === 'severity') {
      const diff = dueSeverity(a.due, now) - dueSeverity(b.due, now);
      return diff * factor || tiebreak(a, b);
    }
    if (!column) return tiebreak(a, b);

    if (column.type === 'date' || column.type === 'priority') {
      const left = a.parsed[key];
      const right = b.parsed[key];
      // Rows without a value sink in both directions, like an unscored control.
      if (left == null && right == null) return tiebreak(a, b);
      if (left == null) return 1;
      if (right == null) return -1;
      return (left - right) * factor || tiebreak(a, b);
    }

    const cmp = COLLATOR.compare(a.cells[key] ?? '', b.cells[key] ?? '');
    return cmp * factor || tiebreak(a, b);
  });
}

/** The visible slice of one board, filtered + sorted + paged. */
export function selectTaskView(state, project) {
  const mine = tasksForProject(state.tasks, project);
  const filtered = filterTasks(mine, state.taskQuery);
  const sorted = sortTasks(filtered, state.taskSort, state.taskColumns);
  return {
    ...paginate(sorted, state.taskPage, state.taskPageSize),
    // `rows` is the current page; `all` is everything the filters left over —
    // a count over the whole selection must not change when you turn a page.
    all: sorted,
    projectTotal: mine.length,
  };
}

/** The columns the picker has enabled, in canonical display order. */
export function visibleColumns(columns, visible) {
  const shown = new Set(visible);
  return columns.filter((column) => shown.has(column.key));
}
