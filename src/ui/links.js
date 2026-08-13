import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { LINK_REASONS } from '../core/url.js';

/**
 * Renders a register row's URL. A cell that did not survive toLink() becomes
 * muted text with the reason in the tooltip — never a dead anchor, so a broken
 * link in the sheet is visibly broken rather than quietly failing on click.
 *
 * The caller always decides the anchor text; there is no single sensible
 * default across the table, the pane and the register pages.
 *
 * @param {import('../data/schema.js').LookupRecord} record
 * @param {{ label?: string, fallback?: string }} [opts]
 */
export function recordLink(record, { label, fallback = 'Openen' } = {}) {
  const link = record.link;
  const text = String(label ?? '').trim() || fallback;

  // The label lives in its own span so it can ellipsise inside a table cell
  // without pushing the icon out of view.
  const labelNode = el('span.link-label', text);

  if (!link?.ok) {
    const reason = LINK_REASONS[link?.reason] || LINK_REASONS.invalid;
    return el('span.link-dead', {
      title: link?.raw ? `${reason}: "${link.raw}"` : reason,
    }, [labelNode, icon('alert', { size: 13 })]);
  }

  return el('a.link', {
    href: link.href,
    target: '_blank',
    rel: 'noopener noreferrer',
    title: `${text} — ${link.href}`,
  }, [labelNode, icon('external', { size: 13 })]);
}

/** The id of a register row, as a compact monospace pill. */
export const refBadge = (record) => el('span.ref-badge', record.rawId || record.id);

/** An id a control points at that has no row in the register. */
export const missingRef = (id) =>
  el('span.ref-badge.is-missing', { title: 'Deze id staat niet in het werkblad' }, id);
