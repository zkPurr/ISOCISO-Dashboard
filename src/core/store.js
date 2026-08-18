/**
 * One shared, observable state object. Views subscribe; anything that mutates
 * state goes through `setState`, which notifies subscribers once per change.
 */

const listeners = new Set();

export const state = {
  /** @type {import('../data/schema.js').Control[]} */
  controls: [],

  /**
   * The registers the controls sheet points at by id. One array per
   * LOOKUP_SHEETS key; an absent worksheet simply leaves its array empty.
   * @type {Record<'evidence'|'policies'|'risks', import('../data/schema.js').LookupRecord[]>}
   */
  library: { evidence: [], policies: [], risks: [] },

  /** Metadata about the last import: { fileName, importedAt, rowCount, mapped, libraries, isDemo }. */
  source: null,

  /** Search box on the Evidence / Beleid / Risico's pages — separate from the control filters. */
  libraryQuery: '',

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

  /* ---------------------------------------------------------------------
     Taken. A separate dataset with its own import, so none of it touches
     the controls above — importing a Jira export leaves the ISMS sheet
     alone, and the other way round.
     --------------------------------------------------------------------- */

  /** @type {import('../data/tasks.js').Task[]} */
  tasks: [],

  /** Column definitions as discovered in the imported CSV, in display order. */
  taskColumns: [],

  /** Keys of the columns the picker currently shows. */
  taskVisible: [],

  /** Metadata about the last Jira import. */
  taskSource: null,

  /** Search box while on a Taken page — separate from the control filters. */
  taskQuery: '',

  // Flagged rows on top by default: the point of the page is what needs action.
  taskSort: { key: 'severity', dir: 'desc' },
  taskPage: 1,

  /** Column picker open state. Deliberately not persisted. */
  taskColumnsOpen: false,

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
