import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { state, setFilter } from '../core/store.js';
import { currentRoute, navigate } from '../core/router.js';
import { openImportModal } from './importModal.js';
import { NAV } from './sidebar.js';

const TITLES = {
  dashboard: 'ISO Beheersmaatregelen Overzicht',
  beheersmaatregelen: 'Beheersmaatregelen',
};

export function renderTopbar(host) {
  const route = currentRoute();
  const nav = NAV.find((n) => n.route === route);
  const title = TITLES[route] || nav?.label || 'ISOCISO Dashboard';

  // Typing here jumps to the list view — that is where results are readable.
  const search = el('.search.search-pill', [
    icon('search', { size: 17 }),
    el('input.input', {
      type: 'search',
      value: state.filters.query,
      placeholder: "Zoek controls, beleid, risico's...",
      'aria-label': 'Globaal zoeken',
      dataset: { focusId: 'global-search' },
      oninput: (e) => {
        setFilter({ query: e.target.value });
        if (e.target.value && currentRoute() === 'dashboard') navigate('beheersmaatregelen');
      },
    }),
  ]);

  host.replaceChildren(
    el('h1', title),
    el('.topbar-search', search),
    el('button.btn.btn-primary', {
      type: 'button',
      onclick: openImportModal,
    }, [icon('upload', { size: 17 }), 'Importeren']),
  );
}
