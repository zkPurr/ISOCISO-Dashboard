import { el } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { navigate } from '../core/router.js';

/**
 * Disabled routes land here rather than 404-ing, so the intended scope of the
 * product stays visible while only Dashboard and Beheersmaatregelen are live.
 */
export function placeholderView(label) {
  return el('.card', el('.empty', [
    el('.empty-icon', icon('lock', { size: 24 })),
    el('h2', `${label} — nog niet beschikbaar`),
    el('p', [
      'Deze module is nog in ontwikkeling. Zodra de bronsheet ',
      el('strong', 'evidence'), ', ', el('strong', 'beleid'), ' en ', el('strong', "risico's"),
      ' aan controls koppelt, wordt deze pagina geactiveerd.',
    ]),
    el('.empty-actions', el('button.btn.btn-primary', {
      type: 'button',
      onclick: () => navigate('dashboard'),
    }, 'Terug naar dashboard')),
  ]));
}
