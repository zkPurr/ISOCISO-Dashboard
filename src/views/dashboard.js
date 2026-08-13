import { el } from '../core/dom.js';
import { pct } from '../core/format.js';
import { state } from '../core/store.js';
import { summarise, byDomain, selectView } from '../data/selectors.js';
import { MATURITY_PASS_THRESHOLD } from '../data/schema.js';
import { statRow } from '../ui/statcards.js';
import { filterBar } from '../ui/filters.js';
import { controlsTable } from '../ui/table.js';
import { tableFooter } from '../ui/pagination.js';
import { donutChart } from '../charts/donut.js';
import { domainBars } from '../charts/stackedbars.js';
import { noDataView } from './emptyState.js';

/**
 * KPI panel. The three donuts are ratio-of-total gauges; the fourth column
 * compares the same ratio across domains.
 */
function kpiPanel(controls) {
  const summary = summarise(controls);
  const { total } = summary;

  return el('.card', [
    el('.card-head', el('.card-title', 'KPI-overzicht')),
    el('.card-body', el('.kpi-grid', [
      donutChart({
        title: 'ISO27002 Maturiteit Beoordeling',
        centerValue: `${pct(summary.passed, total)}%`,
        segments: [
          { label: `Score ≥ ${MATURITY_PASS_THRESHOLD}`, value: summary.passed, color: 'var(--viz-pass)' },
          { label: `Score < ${MATURITY_PASS_THRESHOLD}`, value: summary.failed, color: 'var(--viz-fail)' },
        ],
        note: summary.unscored
          ? `${summary.unscored} controls nog niet beoordeeld — meegeteld als < ${MATURITY_PASS_THRESHOLD}.`
          : null,
      }),
      donutChart({
        title: 'Evidence beschikbaar',
        centerValue: `${pct(summary.withEvidence, total)}%`,
        segments: [
          { label: 'Ja', value: summary.withEvidence, color: 'var(--viz-evidence)' },
          { label: 'Nee', value: summary.withoutEvidence, color: 'var(--viz-neutral)' },
        ],
        note: summary.withEvidence === 0 ? 'Nog geen evidence gekoppeld in de bronsheet.' : null,
      }),
      donutChart({
        title: "Risico's gekoppeld",
        centerValue: `${pct(summary.withRisks, total)}%`,
        segments: [
          { label: 'Ja', value: summary.withRisks, color: 'var(--viz-risk)' },
          { label: 'Nee', value: summary.withoutRisks, color: 'var(--viz-neutral)' },
        ],
        note: summary.withRisks === 0 ? "Nog geen risico's gekoppeld in de bronsheet." : null,
      }),
      domainBars(byDomain(controls)),
    ])),
  ]);
}

export function dashboardView() {
  const { controls } = state;
  if (!controls.length) return noDataView();

  const view = selectView(state);

  return el('div', [
    statRow(summarise(controls)),
    kpiPanel(controls),
    filterBar(controls),
    el('.card', [
      controlsTable(view.rows),
      tableFooter(view),
    ]),
  ]);
}
