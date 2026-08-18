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

/**
 * @param {object} view          A paginate() result
 * @param {object} [opts]
 * @param {string} [opts.noun]   What is being counted, for the footer sentence
 * @param {(page: number) => void} [opts.onPage]      Defaults to the controls table
 * @param {(size: number) => void} [opts.onPageSize]
 */
export function tableFooter(
  { from, to, total, page, pageCount },
  {
    noun = 'controls',
    onPage = (next) => setState({ page: next }),
    onPageSize = (size) => setState({ pageSize: size, page: 1 }),
  } = {},
) {
  const buttons = pageNumbers(page, pageCount).map((entry) =>
    entry === '…'
      ? el('span.gap', '…')
      : el('button', {
        type: 'button',
        className: entry === page ? 'is-active' : '',
        'aria-current': entry === page ? 'page' : null,
        'aria-label': `Pagina ${entry}`,
        onclick: () => onPage(entry),
      }, String(entry)));

  return el('.table-foot', [
    el('.table-foot-info', total
      ? `Weergave ${num(from)} t/m ${num(to)} van ${num(total)} ${noun}`
      : `Geen ${noun} om weer te geven`),

    el('.pager', [
      el('button', {
        type: 'button',
        disabled: page <= 1,
        'aria-label': 'Vorige pagina',
        onclick: () => onPage(page - 1),
      }, icon('chevronLeft', { size: 16 })),
      ...buttons,
      el('button', {
        type: 'button',
        disabled: page >= pageCount,
        'aria-label': 'Volgende pagina',
        onclick: () => onPage(page + 1),
      }, icon('chevronRight', { size: 16 })),
    ]),

    el('select.select', {
      style: { width: 'auto' },
      'aria-label': 'Aantal rijen per pagina',
      id: 'page-size',
      name: 'page-size',
      dataset: { focusId: 'page-size' },
      onchange: (e) => onPageSize(Number(e.target.value)),
    }, PAGE_SIZES.map((size) =>
      el('option', { value: size, selected: size === state.pageSize }, `${size} / pagina`))),
  ]);
}
