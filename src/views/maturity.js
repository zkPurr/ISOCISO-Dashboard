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
import { levelBar, levelLegend, averageTable, domainHeatmap, levelDonut } from '../charts/maturity.js';
import { ADVICE, adviceSummary } from '../data/advice.js';
import { openAdvicePane } from '../ui/advicePane.js';
import { noDataView } from './emptyState.js';

/** Jumps to the control table pinned to exactly this control. */
function openControl(control) {
  resetFilters();
  setFilter({ query: exactControlQuery(control.id) });
  navigate('beheersmaatregelen');
}

/** Heatmap cells and the attention list open the advice, which links on to the table. */
const openAdvice = (control) => openAdvicePane(control, { onOpenControl: openControl });

/** A small segmented toggle bound to one state.ui key. */
function segToggle(label, uiKey, current, options) {
  return el('.seg', { role: 'group', 'aria-label': label }, options.map(({ value, text }) =>
    el('button', {
      type: 'button',
      className: value === current ? 'is-active' : '',
      'aria-pressed': String(value === current),
      onclick: () => setState({ ui: { [uiKey]: value } }),
    }, text)));
}

/** One donut per domain, for the series picked in the toggle. */
function pieCard(controls) {
  const seriesKey = SCORE_SERIES.some((s) => s.key === state.ui.pieSeries) ? state.ui.pieSeries : 'maturity';
  const series = SCORE_SERIES.find((s) => s.key === seriesKey);
  const label = seriesKey === 'maturity' ? 'Score' : series.label;

  return el('.card', [
    el('.card-head', [
      el('.card-title', `Verdeling per domein — ${label}`),
      segToggle('Welke score', 'pieSeries', seriesKey,
        SCORE_SERIES.map((s) => ({ value: s.key, text: s.key === 'maturity' ? 'Score' : s.label }))),
    ]),
    el('.card-body', el('.viz-grid-4', [
      levelDonut(distribution(controls, seriesKey), { title: 'Alle controls', series: label }),
      ...distributionByDomain(controls, seriesKey).map((row) =>
        levelDonut(row, { title: row.domain, series: label })),
    ])),
  ]);
}

/**
 * The growth path for one dimension, as a staircase: five steps, each with
 * what to do and how many controls are standing on that step right now.
 */
function growthCard(controls) {
  const dimension = MATURITY_DIMENSIONS.find((d) => d.key === state.ui.adviceDim) || MATURITY_DIMENSIONS[1];
  const dist = distribution(controls, dimension.key);

  const steps = ADVICE[dimension.key].map((step, from) => {
    const to = from + 1;
    const waiting = dist.counts[from];
    return el('.grow-step', { style: { '--rise': String(from), borderTopColor: MATURITY_LEVELS[to].color } }, [
      el('.grow-step-head', [
        el('span.mat-avg', { style: { background: MATURITY_LEVELS[from].color, color: MATURITY_LEVELS[from].ink } }, from),
        el('span.adv-arrow', '→'),
        el('span.mat-avg', { style: { background: MATURITY_LEVELS[to].color, color: MATURITY_LEVELS[to].ink } }, to),
        el('span.grow-step-name', MATURITY_LEVELS[to].name),
      ]),
      el('strong.grow-step-title', step.title),
      el('ul.adv-actions', step.actions.map((a) => el('li', a))),
      el('.adv-done', [icon('check', { size: 14 }), el('span', [el('strong', 'Klaar als: '), step.done])]),
      el('.grow-count', { className: `grow-count${waiting ? '' : ' is-zero'}` },
        waiting ? `${num(waiting)} ${waiting === 1 ? 'control staat' : 'controls staan'} op ${from} — ${pct(waiting, dist.total)}%` : `Geen controls op ${from}`),
    ]);
  });

  return el('.card', [
    el('.card-head', [
      el('.card-title', `Groeipad — ${dimension.label}`),
      segToggle('Dimensie', 'adviceDim', dimension.key,
        MATURITY_DIMENSIONS.map((d) => ({ value: d.key, text: d.label }))),
    ]),
    el('.card-body', [
      el('p.adv-why', [
        `Wat een control moet doen om op ${dimension.label} een niveau hoger te komen. `,
        'Klik op een cel in de heatmap of een control hieronder voor het advies voor die ene control.',
      ]),
      el('.grow-steps', steps),
    ]),
  ]);
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
        levelBar(distribution(controls, key), { label: key === 'maturity' ? 'Score (min)' : label, main: key === 'maturity' }))),
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
          domainHeatmap(group, { detail, onOpen: openAdvice }),
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
  const scoreCell = (score, main) => {
    const level = maturityLevel(score);
    return el('td.is-center', { className: main ? 'is-center is-score' : 'is-center' }, el('span.mat-avg', { style: { background: level.color, color: level.ink }, title: level.name }, score ?? '—'));
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
          ...SCORE_SERIES.map((s) => el('th.is-center', { className: s.key === 'maturity' ? 'is-center is-score' : 'is-center' },
            s.key === 'maturity' ? 'Score' : s.label)),
          el('th', 'Volgende stap'),
        ])),
        el('tbody', rows.map((control) => el('tr', [
          el('td.col-id', el('button.link-more', { type: 'button', title: 'Groeiadvies bekijken', onclick: () => openAdvice(control) }, control.id)),
          el('td.col-title', [control.title || el('span.muted', '—'), isOverride(control) && el('span.muted', ' (score handmatig)')]),
          el('td.col-owner', control.owner || el('span.muted', '—')),
          ...SCORE_SERIES.map(({ key }) => scoreCell(scoreOf(control, key), key === 'maturity')),
          el('td.adv-next', el('button.adv-next-btn', { type: 'button', onclick: () => openAdvice(control) },
            adviceSummary(control).map((line) => el('span', line)))),
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
    await exportMaturityPdf(state.controls);
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
    pieCard(controls),
    dimensionCard(controls),
    heatmapCard(controls),
    growthCard(controls),
    weakestCard(controls),
    modelCard(),
  ]);
}
