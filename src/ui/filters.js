import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { state, setFilter, resetFilters } from '../core/store.js';
import { ownerOptions, domainOptions } from '../data/selectors.js';
import { MATURITY_PASS_THRESHOLD } from '../data/schema.js';

/** Explains the exact-match syntax; shown on hover of either search box. */
export const SEARCH_HELP =
  'Zoekt op deel van de tekst. Wil je exact zoeken, zet het tussen aanhalingstekens '
  + '("A.5.1") of geef een kolom op: Control_ID:"A.5.1", Owner:"GRC-team".';

function select({ label, value, options, placeholder, onchange, focusId }) {
  return el('.field', [
    el('label.field-label', { for: focusId }, label),
    el('select.select', {
      id: focusId,
      value,
      dataset: { focusId },
      onchange: (e) => onchange(e.target.value),
    }, [
      el('option', { value: '' }, placeholder),
      ...options.map((opt) => {
        const item = typeof opt === 'string' ? { value: opt, label: opt } : opt;
        return el('option', { value: item.value, selected: item.value === value }, item.label);
      }),
    ]),
  ]);
}

export function filterBar(controls) {
  const { filters } = state;
  const hasActive = Object.values(filters).some(Boolean);

  return el('.card.filterbar', [
    el('.search', [
      icon('search', { size: 17 }),
      el('input.input', {
        type: 'search',
        value: filters.query,
        placeholder: 'Zoek Control ID of beschrijving...',
        'aria-label': 'Zoek in de tabel',
        title: SEARCH_HELP,
        dataset: { focusId: 'table-search' },
        oninput: (e) => setFilter({ query: e.target.value }),
      }),
    ]),

    select({
      label: 'Eigenaar',
      focusId: 'filter-owner',
      value: filters.owner,
      placeholder: 'Alle eigenaren',
      options: ownerOptions(controls),
      onchange: (owner) => setFilter({ owner }),
    }),

    select({
      label: 'Domein',
      focusId: 'filter-domain',
      value: filters.domain,
      placeholder: 'Alle domeinen',
      options: domainOptions(controls),
      onchange: (domain) => setFilter({ domain }),
    }),

    select({
      label: 'ISO27002 Maturiteit',
      focusId: 'filter-maturity',
      value: filters.maturity,
      placeholder: 'Alle scores',
      options: [
        { value: 'pass', label: `Score ≥ ${MATURITY_PASS_THRESHOLD}` },
        { value: 'fail', label: `Score < ${MATURITY_PASS_THRESHOLD}` },
        ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Exact ${n} / 5` })),
        { value: 'none', label: 'Nog niet beoordeeld' },
      ],
      onchange: (maturity) => setFilter({ maturity }),
    }),

    select({
      label: 'Evidence',
      focusId: 'filter-evidence',
      value: filters.evidence,
      placeholder: 'Alles',
      options: [
        { value: 'yes', label: 'Evidence gekoppeld' },
        { value: 'no', label: 'Geen evidence gekoppeld' },
      ],
      onchange: (evidence) => setFilter({ evidence }),
    }),

    el('button.btn', {
      type: 'button',
      disabled: !hasActive,
      onclick: resetFilters,
    }, [icon('refresh', { size: 16 }), 'Filters wissen']),
  ]);
}
