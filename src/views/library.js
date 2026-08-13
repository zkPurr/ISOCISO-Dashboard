import { el } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { num } from '../core/format.js';
import { shortUrl } from '../core/url.js';
import { state, setState, setFilter } from '../core/store.js';
import { navigate } from '../core/router.js';
import { LOOKUP_BY_KEY, POLICY_FALLBACK_LABEL } from '../data/schema.js';
import { controlsByRef, compareRef, filterLibrary } from '../data/selectors.js';
import { exactControlQuery } from '../data/query.js';
import { recordLink, refBadge } from '../ui/links.js';
import { openImportModal } from '../ui/importModal.js';
import { noDataView } from './emptyState.js';

/**
 * The Evidence, Beleid and Risico's pages: a straight listing of the matching
 * worksheet, plus the controls that point at each row — which is the one thing
 * the worksheet itself cannot tell you.
 */

/** Column layout per register. `cell` gets (record) and returns a node or string. */
const COLUMNS = {
  evidence: [
    { key: 'description', label: 'Description', cell: describe },
    {
      key: 'link',
      label: 'Link',
      cell: (record) => recordLink(record, {
        label: record.link.ok ? shortUrl(record.link.href) : record.link.raw,
        fallback: 'Geen link opgegeven',
      }),
    },
  ],
  policies: [
    {
      key: 'description',
      label: 'Description',
      cell: (record) => recordLink(record, {
        label: record.description,
        fallback: POLICY_FALLBACK_LABEL,
      }),
    },
    {
      key: 'url',
      label: 'URL',
      cell: (record) => (record.link.ok
        ? el('span.url-text', { title: record.link.href }, shortUrl(record.link.href))
        : el('span.muted', record.link.raw || 'Geen URL opgegeven')),
    },
  ],
  risks: [
    { key: 'description', label: 'Description', cell: describe },
    {
      key: 'status',
      label: 'Status',
      center: true,
      cell: (record) => (record.status
        ? el('span.badge.badge-none', { title: 'Status wordt nog niet gebruikt in berekeningen' }, record.status)
        : el('span.muted', '—')),
    },
  ],
};

function describe(record) {
  return record.description || el('span.muted', 'Geen beschrijving');
}

/** Control ids that reference this row — click one to open it in the table. */
function linkedControls(controls) {
  if (!controls?.length) return el('span.muted', 'Niet gekoppeld');

  const shown = controls.slice(0, 6);
  const rest = controls.length - shown.length;

  return el('.chips', [
    // Exact query, so A.5.1 does not also drag in A.5.10 and A.5.11.
    ...shown.map((control) => el('button.chip', {
      type: 'button',
      title: `${control.title || control.id} — open in de controltabel`,
      onclick: () => {
        setFilter({ query: exactControlQuery(control.id) });
        navigate('beheersmaatregelen');
      },
    }, control.id)),
    rest > 0 && el('span.chip.is-quiet', `+${rest}`),
  ]);
}

/** Why a register page can be empty, in the words of the import that ran. */
function emptyRegister(definition) {
  const info = state.source?.libraries?.[definition.key];
  const detail = info?.sheetName
    ? `Het werkblad "${info.sheetName}" is wel gelezen, maar bevatte geen bruikbare rijen.`
    : `In het geïmporteerde bestand is geen werkblad "${definition.label}" gevonden${
      info?.reason ? ` (${info.reason})` : ''}.`;

  return el('.card', el('.empty', [
    el('.empty-icon', icon(definition.icon, { size: 24 })),
    el('h2', `Geen ${definition.label.toLowerCase()} beschikbaar`),
    el('p', [
      detail,
      ' Verwacht worden de kolommen ',
      ...definition.fields.flatMap((field, i) => [
        i ? ', ' : '',
        el('code', field.label),
      ]),
      '.',
    ]),
    el('.empty-actions', el('button.btn.btn-primary', {
      type: 'button',
      onclick: openImportModal,
    }, [icon('upload', { size: 16 }), 'Excel importeren'])),
  ]));
}

function searchBar(definition, shown, total) {
  return el('.card.filterbar.filterbar-single', [
    el('.search', [
      icon('search', { size: 17 }),
      el('input.input', {
        type: 'search',
        value: state.libraryQuery,
        placeholder: `Zoek in ${definition.label.toLowerCase()}...`,
        'aria-label': `Zoek in ${definition.label}`,
        dataset: { focusId: 'library-search' },
        oninput: (e) => setState({ libraryQuery: e.target.value }),
      }),
    ]),
    el('span.table-foot-info', shown === total
      ? `${num(total)} rijen`
      : `${num(shown)} van ${num(total)} rijen`),
    el('button.btn', {
      type: 'button',
      disabled: !state.libraryQuery,
      onclick: () => setState({ libraryQuery: '' }),
    }, [icon('refresh', { size: 16 }), 'Zoekterm wissen']),
  ]);
}

function registerTable(definition, records) {
  const reverse = controlsByRef(state.controls, definition.key);
  const columns = COLUMNS[definition.key];

  if (!records.length) {
    return el('.empty', [
      el('.empty-icon', icon('search', { size: 24 })),
      el('h2', 'Geen resultaten'),
      el('p', `Geen enkele rij in ${definition.label} bevat "${state.libraryQuery}".`),
    ]);
  }

  const head = el('tr', [
    el('th', { scope: 'col' }, 'ID'),
    ...columns.map((column) => el('th', {
      scope: 'col',
      className: column.center ? 'is-center' : '',
    }, column.label)),
    el('th', { scope: 'col' }, 'Gekoppelde controls'),
  ]);

  const body = records.map((record) => el('tr', [
    el('td.col-ref', refBadge(record)),
    ...columns.map((column) => el('td', {
      className: column.center ? 'is-center' : '',
    }, column.cell(record))),
    el('td', linkedControls(reverse.get(record.id))),
  ]));

  return el('.table-wrap', el('table.data', [
    el('caption.sr-only', `${num(records.length)} rijen uit het werkblad ${definition.label}`),
    el('thead', head),
    el('tbody', body),
  ]));
}

/** Builds the view function for one register. */
function registerView(key) {
  return () => {
    const definition = LOOKUP_BY_KEY[key];
    const records = state.library[key] || [];

    if (!state.controls.length && !records.length) return noDataView();
    if (!records.length) return emptyRegister(definition);

    const filtered = filterLibrary(records, state.libraryQuery).slice().sort(compareRef);

    return el('div', [
      searchBar(definition, filtered.length, records.length),
      el('.card', registerTable(definition, filtered)),
      sourceHint(definition),
    ]);
  };
}

function sourceHint(definition) {
  const info = state.source?.libraries?.[definition.key];
  if (!info?.sheetName) return null;

  const notes = [
    info.duplicates ? `${num(info.duplicates)} dubbele id('s) overschreven` : '',
    info.skippedRows ? `${num(info.skippedRows)} rijen zonder id overgeslagen` : '',
    info.brokenLinks ? `${num(info.brokenLinks)} onbruikbare link(s)` : '',
    info.unmatched?.length ? `niet-herkende kolommen: ${info.unmatched.join(', ')}` : '',
  ].filter(Boolean);

  return el('.hint', { style: { marginTop: 'var(--sp-4)' } }, [
    el('strong', 'Bron: '),
    `werkblad "${info.sheetName}" · ${num(info.count)} rijen`,
    notes.length ? ` · ${notes.join(' · ')}` : '',
  ]);
}

export const evidenceView = registerView('evidence');
export const beleidView = registerView('policies');
export const risicosView = registerView('risks');
