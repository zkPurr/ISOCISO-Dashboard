import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { openPane, closeDetailPane } from './detailPane.js';
import { MATURITY_DIMENSIONS, MATURITY_LEVELS, maturityLevel } from '../data/schema.js';
import { scoreOf, isOverride } from '../data/maturity.js';
import { controlAdvice, levelName } from '../data/advice.js';

const levelChip = (level) => {
  const l = maturityLevel(level);
  return el('span.mat-avg', { style: { background: l.color, color: l.ink }, title: l.name }, level ?? '—');
};

/**
 * Where each dimension stands on the 0..5 ladder: filled up to the current
 * level, the next level outlined when that dimension is holding the score down.
 */
function ladder(control, advice) {
  const blockingKeys = new Set(advice.blocking.map((b) => b.dimension.key));
  return el('.adv-ladder', MATURITY_DIMENSIONS.map((dimension) => {
    const score = scoreOf(control, dimension.key);
    return el('.adv-ladder-row', [
      el('span.adv-ladder-label', dimension.label),
      el('.adv-ladder-steps', MATURITY_LEVELS.map(({ level, color, ink }) => {
        const reached = score != null && level <= score;
        const isNext = blockingKeys.has(dimension.key) && level === score + 1;
        return el('span.adv-rung', {
          className: `adv-rung${reached ? ' is-reached' : ''}${isNext ? ' is-next' : ''}`,
          style: reached ? { background: color, color: ink } : null,
          title: `${level} ${MATURITY_LEVELS[level].name}${isNext ? ' — volgende stap' : ''}`,
        }, String(level));
      })),
      el('span.adv-ladder-note', score == null
        ? 'Niet beoordeeld'
        : blockingKeys.has(dimension.key) ? 'Houdt de score laag' : levelName(score)),
    ]);
  }));
}

/** One step card: which dimension, from → to, what to do, how you know it's done. */
export function stepCard({ dimension, from, to, step }, { compact = false } = {}) {
  return el('.adv-step', { style: { borderTopColor: MATURITY_LEVELS[to].color } }, [
    el('.adv-step-head', [
      el('span.adv-dim', dimension.label),
      levelChip(from), el('span.adv-arrow', '→'), levelChip(to),
      el('strong', step.title),
    ]),
    !compact && el('ul.adv-actions', step.actions.map((a) => el('li', a))),
    !compact && el('.adv-done', [icon('check', { size: 14 }), el('span', [el('strong', 'Klaar als: '), step.done])]),
  ]);
}

function adviceBody(control) {
  const advice = controlAdvice(control);
  const parts = [ladder(control, advice)];

  if (advice.unscored.length) {
    parts.push(el('.hint', [
      el('strong', 'Eerst beoordelen: '),
      advice.unscored.map((d) => d.label).join(', '),
      advice.unscored.length === MATURITY_DIMENSIONS.length
        ? ' — zonder scores is er nog geen advies te geven.'
        : ' heeft nog geen score; het advies hieronder gaat uit van de dimensies die wél gescoord zijn.',
    ]));
  }

  if (advice.isTop) {
    parts.push(el('.hint', 'Alle dimensies staan op 5 (Optimaliserend). Houd het vast: blijf meten, evalueren en verbeteren.'));
  } else if (advice.blocking.length) {
    parts.push(el('h3.adv-h', advice.blocking.length > 1
      ? `Naar niveau ${advice.target} (${levelName(advice.target)}): ${advice.blocking.length} dimensies tegelijk omhoog`
      : `Naar niveau ${advice.target} (${levelName(advice.target)})`));
    parts.push(el('p.adv-why', advice.blocking.length > 1
      ? 'De score is het laagste van de drie, dus ze moeten allemaal een stap omhoog voordat de score stijgt.'
      : `De score is het laagste van de drie — ${advice.blocking[0].dimension.label} is nu de beperkende factor.`));
    parts.push(...advice.blocking.map((b) => stepCard(b)));
  }

  if (advice.further.length) {
    parts.push(el('details.adv-more', [
      el('summary', `Ook mogelijk — de andere dimensies verder brengen (${advice.further.length})`),
      ...advice.further.map((b) => stepCard(b)),
    ]));
  }

  if (isOverride(control)) {
    parts.push(el('.hint', 'Let op: de score in de sheet is handmatig gezet en wijkt af van MIN(Proces, Beleid, Evidence).'));
  }

  return el('.pane-body.adv-body', parts);
}

/**
 * @param {import('../data/schema.js').Control} control
 * @param {{ onOpenControl?: (control) => void }} [opts]
 */
export function openAdvicePane(control, { onOpenControl } = {}) {
  openPane({
    label: `Groeiadvies voor ${control.id}`,
    eyebrow: `Groeiadvies · ${control.id}${control.owner ? ` · ${control.owner}` : ''}`,
    eyebrowIcon: 'gauge',
    title: control.title || 'Geen beschrijving',
    body: adviceBody(control),
    foot: [
      el('span.muted', ['Score nu: ', levelChip(control.maturity), ` ${control.maturity == null ? 'niet beoordeeld' : levelName(control.maturity)}`]),
      onOpenControl && el('button.btn.btn-sm', {
        type: 'button',
        onclick: () => { closeDetailPane(); onOpenControl(control); },
      }, ['Open in Beheersmaatregelen', icon('chevronRight', { size: 15 })]),
    ].filter(Boolean),
  });
}
