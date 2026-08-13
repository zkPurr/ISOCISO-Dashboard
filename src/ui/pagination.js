import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { num } from '../core/format.js';
import { state, setState } from '../core/store.js';

const PAGE_SIZES = [10, 25, 50, 100];

/** Window of page numbers around the current page, with ellipsis gaps. */
function pageNumbers(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const items = new Set([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...items].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);

  const out = [];
  let previous = 0;
  for (const n of sorted) {
    if (previous && n - previous > 1) out.push('…');
    out.push(n);
    previous = n;
  }
  return out;
}

export function tableFooter({ from, to, total, page, pageCount }) {
  const buttons = pageNumbers(page, pageCount).map((entry) =>
    entry === '…'
      ? el('span.gap', '…')
      : el('button', {
        type: 'button',
        className: entry === page ? 'is-active' : '',
        'aria-current': entry === page ? 'page' : null,
        'aria-label': `Pagina ${entry}`,
        onclick: () => setState({ page: entry }),
      }, String(entry)));

  return el('.table-foot', [
    el('.table-foot-info', total
      ? `Weergave ${num(from)} t/m ${num(to)} van ${num(total)} controls`
      : 'Geen controls om weer te geven'),

    el('.pager', [
      el('button', {
        type: 'button',
        disabled: page <= 1,
        'aria-label': 'Vorige pagina',
        onclick: () => setState({ page: page - 1 }),
      }, icon('chevronLeft', { size: 16 })),
      ...buttons,
      el('button', {
        type: 'button',
        disabled: page >= pageCount,
        'aria-label': 'Volgende pagina',
        onclick: () => setState({ page: page + 1 }),
      }, icon('chevronRight', { size: 16 })),
    ]),

    el('select.select', {
      style: { width: 'auto' },
      'aria-label': 'Aantal rijen per pagina',
      dataset: { focusId: 'page-size' },
      onchange: (e) => setState({ pageSize: Number(e.target.value), page: 1 }),
    }, PAGE_SIZES.map((size) =>
      el('option', { value: size, selected: size === state.pageSize }, `${size} / pagina`))),
  ]);
}
