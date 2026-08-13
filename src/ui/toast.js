import { el } from '../core/dom.js';
import { icon } from './icons.js';

const host = () => document.getElementById('toasts');

/**
 * @param {string} message
 * @param {'info'|'success'|'error'} kind
 */
export function toast(message, kind = 'info') {
  const stack = host();
  if (!stack) return;

  const glyph = { success: 'check', error: 'x', info: 'info' }[kind] || 'info';
  const node = el('.toast', {
    className: `toast is-${kind}`,
    role: kind === 'error' ? 'alert' : 'status',
  }, [
    icon(glyph, { size: 16 }),
    el('span', message),
  ]);

  stack.append(node);
  setTimeout(() => node.remove(), kind === 'error' ? 9000 : 4500);
}
