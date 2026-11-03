import { el } from '../core/dom.js';
import { num, pct, dateTime } from '../core/format.js';
import { state, setState, resetFilters, setFilter } from '../core/store.js';
import { navigate } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { exactControlQuery } from '../data/query.js';
import {
  MATURITY_DIMENSIONS, MATURITY_LEVELS, MATURITY_PASS_THRESHOLD, maturityLevel,
} from '../data/schema.js';
import {
  SCORE_SERIES, distribution, distributionByDomain, averageMatrix, groupByDomain,
  maturityKpis, weakestControls, formatAvg, scoreOf, isOverride,
} from '../data/maturity.js';
import { levelBar, levelLegend, averageTable, domainHeatmap } from '../charts/maturity.js';
import { noDataView } from './emptyState.js';

/** Jumps to the control table pinned to exactly this control. */
function openControl(control) {
  resetFilters();
  setFilter({ query: exactControlQuery(control.id) });
  navigate('beheersmaatregelen');
}

function kpiTile({ value, unit, label, foot, accent }) {
  return el('.stat.mat-kpi', [
    el('div', [
      el('.stat-value.tnum', [value, unit && el('span.mat-kpi-unit', unit)]),
      el('.stat-label', label),
    ]),
    el('.stat-foot', { style: accent ? { borderTopColor: accent } : null }, foot),
  ]);
}

function kpiRow(kpis) {
  const { total } = kpis;
  return el('.mat-kpis', [
    kpiTile({
      value: formatAvg(kpis.avg),
      unit: ' / 5',
      label: 'Gemiddelde maturiteit',
      foot: kpis.avg == null ? 'Nog niets beoordeeld' : `Niveau: ${maturityLevel(Math.floor(kpis.avg)).name}`,
    }),
    kpiTile({
      value: num(kpis.atTarget),
      label: `Op of boven niveau ${MATURITY_PASS_THRESHOLD}`,
      foot: `${pct(kpis.atTarget, total)}% van alle controls`,
      accent: 'var(--viz-pass)',
    }),
    kpiTile({
      value: num(kpis.belowTarget),
      label: `Onder niveau ${MATURITY_PASS_THRESHOLD}`,
      foot: `${pct(kpis.belowTarget, total)}% van alle controls`,
      accent: 'var(--viz-fail)',
    }),
    kpiTile({
      value: num(kpis.notPerformed),
      label: 'Niet uitgevoerd (0)',
      foot: 'Op score of op minstens één dimensie',
      accent: MATURITY_LEVELS[0].color,
    }),
    kpiTile({
      value: kpis.weakest ? kpis.weakest.label : '—',
      label: 'Zwakste dimensie',
      foot: kpis.weakest
        ? `gem. ${formatAvg(kpis.weakest.avg)}${kpis.strongest ? ` · sterkste: ${kpis.strongest.label} ${formatAvg(kpis.strongest.avg)}` : ''}`
        : 'Geen dimensiescores in de sheet',
    }),
    kpiTile({
      value: `${pct(kpis.fullyAssessed, total)}%`,
      label: 'Volledig beoordeeld',
      foot: `${num(kpis.fullyAssessed)} van ${num(total)} met Proces, Beleid én Evidence`,
    }),
    kpiTile({
      value: num(kpis.unbalanced),
      label: 'Onevenwichtig',
      foot: '≥ 2 niveaus verschil tussen dimensies',
    }),
  ]);
}

function domainCard(controls) {
  const total = distribution(controls);
  return el('.card', [
    el('.card-head', [el('.card-title', 'Maturiteitsniveaus per domein'), levelLegend()]),
    el('.card-body.mat-bars', [
      levelBar(total, { label: 'Alle controls' }),
      el('.mat-divider'),
      ...distributionByDomain(controls).map((row) => levelBar(row, { label: row.domain })),
    ]),
  ]);
}

function dimensionCard(controls) {
  return el('.mat-split', [
    el('.card', [
      el('.card-head', el('.card-title', 'Niveaus per dimensie')),
      el('.card-body.mat-bars', SCORE_SERIES.map(({ key, label }) =>
        levelBar(distribution(controls, key), { label: key === 'maturity' ? 'Score (min)' : label }))),
    ]),
    el('.card', [
      el('.card-head', el('.card-title', 'Gemiddelde per domein en dimensie')),
      averageTable(averageMatrix(controls)),
    ]),
  ]);
}

function heatmapCard(controls) {
  const detail = state.ui.heatmapDetail !== false;
  const toggle = el('.seg', { role: 'group', 'aria-label': 'Heatmap-weergave' }, [
    el('button', { type: 'button', className: detail ? '' : 'is-active', 'aria-pressed': String(!detail),
      onclick: () => setState({ ui: { heatmapDetail: false } }) }, 'Alleen score'),
    el('button', { type: 'button', className: detail ? 'is-active' : '', 'aria-pressed': String(detail),
      onclick: () => setState({ ui: { heatmapDetail: true } }) }, 'Score + dimensies'),
  ]);

  const groups = groupByDomain(controls);
  const longest = Math.max(...groups.map((g) => g.controls.length), 1);

  return el('.card', [
    el('.card-head', [el('.card-title', 'Heatmap per control'), toggle]),
    withCellCount(el('.card-body.hm-body', [
      el('.mat-hm-legend', levelLegend()),
      ...groups.map((group) => {
        const dist = distribution(group.controls);
        return el('.hm-block', [
          el('.hm-head', [
            el('strong', group.domain),
            el('span', `${num(group.controls.length)} controls · gem. ${formatAvg(dist.avg)} · ${pct(dist.counts.slice(MATURITY_PASS_THRESHOLD).reduce((a, b) => a + b, 0), dist.total)}% op niveau ≥ ${MATURITY_PASS_THRESHOLD}`),
          ]),
          domainHeatmap(group, { detail, onOpen: openControl }),
        ]);
      }),
    ]), longest),
  ]);
}

/** Custom properties need setProperty — the el() style shorthand can't set them. */
function withCellCount(node, count) {
  node.style.setProperty('--hm-n', String(count));
  return node;
}

function weakestCard(controls) {
  const rows = weakestControls(controls, 15);
  const scoreCell = (score) => {
    const level = maturityLevel(score);
    return el('td.is-center', el('span.mat-avg', { style: { background: level.color, color: level.ink }, title: level.name }, score ?? '—'));
  };

  return el('.card', [
    el('.card-head', [
      el('.card-title', `Aandachtspunten — laagste scores`),
      el('span.muted', `${num(rows.length)} controls onder niveau ${MATURITY_PASS_THRESHOLD}, laagste eerst`),
    ]),
    rows.length
      ? el('.table-wrap', el('table.data.mat-matrix', [
        el('thead', el('tr', [
          el('th', 'Control'), el('th', 'Beschrijving'), el('th', 'Eigenaar'),
          ...SCORE_SERIES.map((s) => el('th.is-center', s.key === 'maturity' ? 'Score' : s.label)),
        ])),
        el('tbody', rows.map((control) => el('tr', [
          el('td.col-id', el('button.link-more', { type: 'button', onclick: () => openControl(control) }, control.id)),
          el('td.col-title', [control.title || el('span.muted', '—'), isOverride(control) && el('span.muted', ' (score handmatig)')]),
          el('td.col-owner', control.owner || el('span.muted', '—')),
          ...SCORE_SERIES.map(({ key }) => scoreCell(scoreOf(control, key))),
        ]))),
      ]))
      : el('.card-body', el('span.muted', `Alle beoordeelde controls zitten op niveau ${MATURITY_PASS_THRESHOLD} of hoger.`)),
  ]);
}

function modelCard() {
  return el('.card', [
    el('.card-head', el('.card-title', 'Maturiteitsmodel')),
    el('.table-wrap', el('table.data.mat-model', [
      el('thead', el('tr', [
        el('th', ''),
        ...MATURITY_LEVELS.map((level) => el('th', [
          el('span.mat-avg', { style: { background: level.color, color: level.ink } }, level.level),
          ` ${level.name}`,
        ])),
      ])),
      el('tbody', MATURITY_DIMENSIONS.map((dimension) => el('tr', [
        el('th', { scope: 'row' }, dimension.label),
        ...dimension.levels.map((text) => el('td', text)),
      ]))),
    ])),
  ]);
}

async function exportPdf(button) {
  button.disabled = true;
  try {
    const { exportMaturityPdf } = await import('../report/maturityPdf.js');
    await exportMaturityPdf(state.controls, state.source);
    toast('PDF-rapport gedownload.', 'success');
  } catch (err) {
    console.error(err);
    toast(err.message || 'PDF-export mislukt.', 'error');
  } finally {
    button.disabled = false;
  }
}

export function maturityView() {
  const { controls, source } = state;
  if (!controls.length) return noDataView();

  const kpis = maturityKpis(controls);
  const hasDimensions = kpis.dimensions.some((d) => d.scored > 0);

  const pdfButton = el('button.btn.btn-primary', { type: 'button' }, [icon('download', { size: 16 }), 'Exporteer PDF']);
  pdfButton.addEventListener('click', () => exportPdf(pdfButton));

  return el('div', [
    el('.mat-toolbar', [
      el('span.muted', [
        source ? `${source.fileName} · ingelezen ${dateTime(source.importedAt)} · ` : '',
        `${num(controls.length)} controls — altijd de hele set, los van de filters`,
      ]),
      pdfButton,
    ]),
    !hasDimensions && el('.hint', { style: { marginBottom: 'var(--sp-4)' } }, [
      'Deze dataset heeft geen ', el('code', 'Maturiteit_Proces'), ', ', el('code', 'Maturiteit_Beleid'), ' of ',
      el('code', 'Maturiteit_Evidence'), '. De score-grafieken werken, de dimensie-grafieken blijven leeg tot je een sheet met die kolommen importeert.',
    ]),
    kpiRow(kpis),
    domainCard(controls),
    dimensionCard(controls),
    heatmapCard(controls),
    weakestCard(controls),
    modelCard(),
  ]);
}
