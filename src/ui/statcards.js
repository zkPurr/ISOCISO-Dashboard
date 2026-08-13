import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { num, pct } from '../core/format.js';
import { MATURITY_PASS_THRESHOLD } from '../data/schema.js';

/**
 * @param {{ value: number, label: string, icon: string, color: string,
 *           footValue: string, footLabel: string, footColor?: string }} card
 */
function statCard(card) {
  return el('.stat', [
    el('.stat-main', [
      el('.stat-icon', { style: { background: card.color } }, icon(card.icon, { size: 21, stroke: 2.2 })),
      el('div', [
        el('.stat-value.tnum', num(card.value)),
        el('.stat-label', card.label),
      ]),
    ]),
    el('.stat-foot', [
      el('strong', { style: { color: card.footColor || 'var(--brand)' } }, card.footValue),
      ` ${card.footLabel}`,
    ]),
  ]);
}

export function statRow(summary) {
  const { total } = summary;

  return el('.stat-row', [
    statCard({
      value: total,
      label: 'Totaal controls',
      icon: 'clipboard',
      color: 'var(--brand)',
      footValue: '100%',
      footLabel: 'van geïmporteerde controls',
    }),
    statCard({
      value: summary.passed,
      label: `ISO27002 Maturiteit ≥ ${MATURITY_PASS_THRESHOLD}`,
      icon: 'check',
      color: 'var(--viz-pass)',
      footValue: `${pct(summary.passed, total)}%`,
      footLabel: 'van alle controls',
      footColor: 'var(--wash-pass-fg)',
    }),
    statCard({
      value: summary.failed,
      label: `ISO27002 Maturiteit < ${MATURITY_PASS_THRESHOLD}`,
      icon: 'x',
      color: 'var(--viz-fail)',
      footValue: `${pct(summary.failed, total)}%`,
      footLabel: 'van alle controls',
      footColor: 'var(--wash-fail-fg)',
    }),
    statCard({
      value: summary.withEvidence,
      label: 'Evidence beschikbaar',
      icon: 'file',
      color: 'var(--viz-evidence)',
      footValue: `${pct(summary.withEvidence, total)}%`,
      footLabel: 'van alle controls',
      footColor: 'var(--viz-evidence)',
    }),
    statCard({
      value: summary.withRisks,
      label: "Risico's gekoppeld",
      icon: 'shield',
      color: 'var(--viz-risk)',
      footValue: `${pct(summary.withRisks, total)}%`,
      footLabel: 'van alle controls',
      footColor: 'var(--viz-risk)',
    }),
  ]);
}
