import { DOMAIN_ORDER, DOMAIN_UNKNOWN, MATURITY_PASS_THRESHOLD, refKey } from './schema.js';
import { compareControlId } from '../core/format.js';

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
  const query = filters.query.trim().toLowerCase();

  return controls.filter((control) => {
    if (query) {
      const haystack = `${control.id} ${control.title} ${control.owner} ${control.domain}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
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

export function paginate(rows, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    page: safePage,
    pageCount,
    from: rows.length ? start + 1 : 0,
    to: Math.min(start + pageSize, rows.length),
    total: rows.length,
  };
}

/** The visible slice, filtered + sorted + paged. Single source of truth for both views. */
export function selectView(state) {
  const filtered = applyFilters(state.controls, state.filters);
  const sorted = applySort(filtered, state.sort);
  return paginate(sorted, state.page, state.pageSize);
}
