/**
 * One shared, observable state object. Views subscribe; anything that mutates
 * state goes through `setState`, which notifies subscribers once per change.
 */

const listeners = new Set();

export const state = {
  /** @type {import('../data/schema.js').Control[]} */
  controls: [],
  /** Metadata about the last import: { fileName, importedAt, rowCount, mapped, missing, isDemo }. */
  source: null,

  filters: {
    query: '',
    owner: '',
    domain: '',
    maturity: '',   // '', 'pass' (>=3), 'fail' (<3), '1'..'5', 'none'
    evidence: '',   // '', 'yes', 'no'
  },

  sort: { key: 'id', dir: 'asc' },
  page: 1,
  pageSize: 10,

  ui: { sidebarCollapsed: false },
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

/** Shallow-merge a patch into state (one level deep for known object keys). */
export function setState(patch) {
  for (const [key, value] of Object.entries(patch)) {
    const current = state[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && current && !Array.isArray(current)) {
      Object.assign(current, value);
    } else {
      state[key] = value;
    }
  }
  notify();
}

/** Filter changes always reset paging — otherwise you land on an empty page. */
export function setFilter(patch) {
  setState({ filters: patch, page: 1 });
}

export function resetFilters() {
  setState({
    filters: { query: '', owner: '', domain: '', maturity: '', evidence: '' },
    page: 1,
  });
}
