import { el } from '../core/dom.js';
import { num, pct, dateTime } from '../core/format.js';
import { state } from '../core/store.js';
import { summarise, applyFilters, selectView } from '../data/selectors.js';
import { MATURITY_PASS_THRESHOLD } from '../data/schema.js';
import { filterBar } from '../ui/filters.js';
import { controlsTable } from '../ui/table.js';
import { tableFooter } from '../ui/pagination.js';
import { noDataView } from './emptyState.js';

/** A one-line read on the current selection — updates with the filters. */
function selectionSummary(controls) {
  const filtered = applyFilters(controls, state.filters);
  const summary = summarise(filtered);
  const isFiltered = filtered.length !== controls.length;

  return el('.card-head', { style: { paddingBottom: 'var(--sp-5)' } }, [
    el('.card-title', isFiltered
      ? `${num(filtered.length)} van ${num(controls.length)} controls`
      : `Alle ${num(controls.length)} controls`),
    el('.legend-inline', [
      el('.legend-row', [
        el('.legend-swatch', { style: { background: 'var(--viz-pass)' } }),
        el('span.legend-name', `Maturiteit ≥ ${MATURITY_PASS_THRESHOLD}: ${num(summary.passed)} (${pct(summary.passed, summary.total)}%)`),
      ]),
      el('.legend-row', [
        el('.legend-swatch', { style: { background: 'var(--viz-fail)' } }),
        el('span.legend-name', `Maturiteit < ${MATURITY_PASS_THRESHOLD}: ${num(summary.failed)} (${pct(summary.failed, summary.total)}%)`),
      ]),
      el('.legend-row', [
        el('.legend-swatch', { style: { background: 'var(--viz-neutral)' } }),
        el('span.legend-name', `Niet beoordeeld: ${num(summary.unscored)}`),
      ]),
    ]),
  ]);
}

export function controlsView() {
  const { controls, source } = state;
  if (!controls.length) return noDataView();

  const view = selectView(state);

  return el('div', [
    filterBar(controls),
    el('.card', [
      selectionSummary(controls),
      controlsTable(view.rows),
      tableFooter(view),
    ]),
    source && el('.hint', { style: { marginTop: 'var(--sp-4)' } }, [
      el('strong', 'Bron: '),
      `${source.fileName}`,
      source.sheetName && source.sheetName !== '—' ? ` · werkblad "${source.sheetName}"` : '',
      ` · ${num(source.rowCount)} rijen · ingelezen ${dateTime(source.importedAt)}`,
      source.unmatched?.length
        ? ` · niet-herkende kolommen: ${source.unmatched.join(', ')}`
        : '',
    ]),
  ]);
}
