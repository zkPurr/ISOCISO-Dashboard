import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { navigate } from '../core/router.js';
import { state } from '../core/store.js';
import { resolveRefs } from '../data/selectors.js';
import { LOOKUP_BY_KEY, POLICY_FALLBACK_LABEL } from '../data/schema.js';
import { shortUrl } from '../core/url.js';
import { recordLink, refBadge, missingRef } from './links.js';

/**
 * A bottom sheet with everything one control links to. It lives on
 * document.body rather than in the view tree, so a re-render of the table
 * underneath it cannot tear it down mid-read.
 */

let backdrop = null;
let returnFocus = null;

export function closeDetailPane() {
  if (!backdrop) return;
  backdrop.remove();
  backdrop = null;
  document.removeEventListener('keydown', onKeydown);
  returnFocus?.focus?.({ preventScroll: true });
  returnFocus = null;
}

function onKeydown(e) {
  if (e.key === 'Escape') closeDetailPane();
}

/** One register row inside the pane. */
function recordRow(kind, record) {
  const meta = [];

  if (kind === 'risks') {
    meta.push(el('.linkrow-meta', [
      el('span.meta-key', 'Status'),
      record.status
        ? el('span.badge.badge-none', { title: 'Status wordt nog niet gebruikt in berekeningen' }, record.status)
        : el('span.muted', 'Niet ingevuld'),
    ]));
  } else {
    // The description is already the row title, so the link line shows the
    // destination itself — that is the part you cannot see anywhere else.
    const link = record.link;
    meta.push(el('.linkrow-meta', [
      el('span.meta-key', kind === 'policies' ? 'Beleid' : 'Bron'),
      recordLink(record, {
        label: link?.ok ? shortUrl(link.href) : link?.raw,
        fallback: kind === 'policies' ? POLICY_FALLBACK_LABEL : 'Geen link opgegeven',
      }),
    ]));
  }

  return el('.linkrow', [
    refBadge(record),
    el('.linkrow-body', [
      el('.linkrow-title', record.description || el('span.muted', 'Geen beschrijving in het werkblad')),
      ...meta,
    ]),
  ]);
}

function paneBody(kind, control) {
  const definition = LOOKUP_BY_KEY[kind];
  const records = state.library[kind] || [];
  const { found, missing } = resolveRefs(control[kind], records);

  const rows = found.map((record) => recordRow(kind, record));

  // An id that points at nothing is a data problem in the sheet, so it is
  // shown as such instead of shrinking the list without explanation.
  if (missing.length) {
    rows.push(el('.linkrow.is-warning', [
      icon('alert', { size: 16 }),
      el('.linkrow-body', [
        el('.linkrow-title', missing.length === 1
          ? `Id ${missing[0]} staat niet in het werkblad ${definition.label}.`
          : `${missing.length} ids staan niet in het werkblad ${definition.label}:`),
        missing.length > 1 && el('.linkrow-meta', missing.map(missingRef)),
      ]),
    ]));
  }

  if (!rows.length) {
    rows.push(el('.linkrow.is-warning', [
      icon('info', { size: 16 }),
      el('.linkrow-body', el('.linkrow-title', records.length
        ? `Deze control verwijst niet naar ${definition.label.toLowerCase()}.`
        : `Er is nog geen werkblad ${definition.label} geïmporteerd.`)),
    ]));
  }

  return el('.pane-body', rows);
}

/**
 * @param {{ control: import('../data/schema.js').Control, kind: 'evidence'|'policies'|'risks' }} opts
 */
export function openDetailPane({ control, kind }) {
  const definition = LOOKUP_BY_KEY[kind];
  if (!definition) return;

  const opener = document.activeElement;
  closeDetailPane();
  returnFocus = opener instanceof HTMLElement ? opener : null;

  const closeButton = el('button.btn.btn-ghost.btn-sm', {
    type: 'button',
    'aria-label': 'Sluiten',
    onclick: closeDetailPane,
  }, icon('x', { size: 18 }));

  const pane = el('.pane', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': `${definition.label} bij ${control.id}`,
  }, [
    el('.pane-head', [
      el('.pane-head-main', [
        el('.pane-eyebrow', [
          icon(definition.icon, { size: 15 }),
          `${definition.label} bij ${control.id}`,
        ]),
        el('.pane-title', control.title || 'Geen beschrijving'),
      ]),
      closeButton,
    ]),
    paneBody(kind, control),
    el('.pane-foot', [
      el('span.muted', `${control[kind].length} gekoppeld in de bronsheet`),
      el('button.btn.btn-sm', {
        type: 'button',
        onclick: () => { closeDetailPane(); navigate(definition.route); },
      }, [`Alle ${definition.label.toLowerCase()} bekijken`, icon('chevronRight', { size: 15 })]),
    ]),
  ]);

  backdrop = el('.pane-backdrop', {
    onclick: (e) => { if (e.target === backdrop) closeDetailPane(); },
  }, pane);

  document.body.append(backdrop);
  document.addEventListener('keydown', onKeydown);
  closeButton.focus({ preventScroll: true });
}
