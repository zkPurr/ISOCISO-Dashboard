/**
 * Everything the Maturiteit page and its PDF export compute. Pure functions
 * over the control list — the page and the PDF call the same ones, so the
 * report can never disagree with the screen.
 */

import {
  DOMAIN_ORDER, DOMAIN_UNKNOWN, MATURITY_DIMENSIONS, MATURITY_LEVELS, MATURITY_PASS_THRESHOLD,
} from './schema.js';
import { compareControlId } from '../core/format.js';

/** The overall score first, then its three legs. */
export const SCORE_SERIES = [
  { key: 'maturity', label: 'Score', short: 'S' },
  ...MATURITY_DIMENSIONS.map(({ key, label, short }) => ({ key, label, short })),
];

const LEVELS = MATURITY_LEVELS.map((l) => l.level);

/** `?? null`: controls persisted before the dimensions existed lack the keys. */
export const scoreOf = (control, key) => control[key] ?? null;

const average = (values) =>
  (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

/** One decimal, Dutch comma; an em dash when nothing was scored. */
export const formatAvg = (value) =>
  (value == null ? '—' : value.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/**
 * Count per level 0..5 plus the unscored remainder.
 * @returns {{ total: number, counts: number[], unscored: number, scored: number, avg: number|null }}
 */
export function distribution(controls, key = 'maturity') {
  const counts = LEVELS.map(() => 0);
  const values = [];
  for (const control of controls) {
    const score = scoreOf(control, key);
    if (score == null) continue;
    counts[score] += 1;
    values.push(score);
  }
  return {
    total: controls.length,
    counts,
    scored: values.length,
    unscored: controls.length - values.length,
    avg: average(values),
  };
}

/** Controls grouped per domain, in the fixed domain order, each sorted by id. */
export function groupByDomain(controls) {
  const groups = new Map(DOMAIN_ORDER.map((d) => [d, []]));
  for (const control of controls) {
    const key = control.domain || DOMAIN_UNKNOWN;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(control);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length)
    .map(([domain, list]) => ({ domain, controls: [...list].sort((a, b) => compareControlId(a.id, b.id)) }));
}

/** Per domain: the distribution of one series. */
export function distributionByDomain(controls, key = 'maturity') {
  return groupByDomain(controls).map(({ domain, controls: list }) => ({
    domain,
    ...distribution(list, key),
  }));
}

/** Average of every series, per domain plus a "Totaal" row. */
export function averageMatrix(controls) {
  const row = (label, list) => ({
    label,
    count: list.length,
    values: SCORE_SERIES.map(({ key }) => distribution(list, key).avg),
  });
  return [
    ...groupByDomain(controls).map(({ domain, controls: list }) => row(domain, list)),
    row('Totaal', controls),
  ];
}

/**
 * "A.5.12" -> "12": the number inside its own domain, which is what a heatmap
 * cell has room for. Anything that is not an ISO-style id keeps its full text.
 */
export function shortControlLabel(id) {
  const match = /^A\.\d+\.(\d+(?:\.\d+)*)$/.exec(String(id));
  return match ? match[1] : String(id);
}

/** Headline numbers for the KPI row (and the first page of the PDF). */
export function maturityKpis(controls) {
  const total = controls.length;
  const score = distribution(controls, 'maturity');
  const atTarget = score.counts.slice(MATURITY_PASS_THRESHOLD).reduce((a, b) => a + b, 0);

  const dimensions = MATURITY_DIMENSIONS.map((dimension) => ({
    ...dimension,
    ...distribution(controls, dimension.key),
  }));
  const ranked = dimensions.filter((d) => d.avg != null).sort((a, b) => a.avg - b.avg);

  const fullyAssessed = controls.filter((c) =>
    MATURITY_DIMENSIONS.every(({ key }) => scoreOf(c, key) != null)).length;

  // A 0 anywhere means part of the control is simply not done.
  const notPerformed = controls.filter((c) =>
    SCORE_SERIES.some(({ key }) => scoreOf(c, key) === 0)).length;

  // Gap between the strongest and weakest leg — a 5/5/1 control is a
  // documentation problem, not a capability problem, and worth spotting.
  const gaps = controls
    .map((c) => MATURITY_DIMENSIONS.map(({ key }) => scoreOf(c, key)).filter((v) => v != null))
    .filter((values) => values.length >= 2)
    .map((values) => Math.max(...values) - Math.min(...values));
  const unbalanced = gaps.filter((gap) => gap >= 2).length;

  return {
    total,
    avg: score.avg,
    scored: score.scored,
    unscored: score.unscored,
    atTarget,
    belowTarget: score.scored - atTarget,
    fullyAssessed,
    notPerformed,
    unbalanced,
    dimensions,
    weakest: ranked[0] || null,
    strongest: ranked.length > 1 ? ranked[ranked.length - 1] : null,
  };
}

/**
 * The controls most in need of attention: scored, lowest score first, then the
 * lowest average across the dimensions, then id. Unscored controls are a
 * separate problem (assessment, not improvement) and are left out.
 */
export function weakestControls(controls, limit = 10) {
  const dimAvg = (c) => average(MATURITY_DIMENSIONS.map(({ key }) => scoreOf(c, key)).filter((v) => v != null)) ?? 0;
  return controls
    .filter((c) => c.maturity != null && c.maturity < MATURITY_PASS_THRESHOLD)
    .sort((a, b) => a.maturity - b.maturity || dimAvg(a) - dimAvg(b) || compareControlId(a.id, b.id))
    .slice(0, limit);
}

/** True when the sheet's Maturiteit_Score does not equal MIN of the dimensions. */
export function isOverride(control) {
  const values = MATURITY_DIMENSIONS.map(({ key }) => scoreOf(control, key)).filter((v) => v != null);
  return control.maturity != null && values.length > 0 && control.maturity !== Math.min(...values);
}
