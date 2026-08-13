import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { state, setState, setFilter } from '../core/store.js';
import { currentRoute, navigate } from '../core/router.js';
import { openImportModal } from './importModal.js';
import { NAV, LIBRARY_ROUTES } from './sidebar.js';

const TITLES = {
  dashboard: 'ISO Beheersmaatregelen Overzicht',
  beheersmaatregelen: 'Beheersmaatregelen',
};

export function renderTopbar(host) {
  const route = currentRoute();
  const nav = NAV.find((n) => n.route === route);
  const title = TITLES[route] || nav?.label || 'ISOCISO Dashboard';

  // On a register page the box searches that register; everywhere else it
  // searches the controls — so it always searches what you are looking at.
  const isLibrary = LIBRARY_ROUTES.has(route);
  const search = el('.search.search-pill', [
    icon('search', { size: 17 }),
    el('input.input', {
      type: 'search',
      value: isLibrary ? state.libraryQuery : state.filters.query,
      placeholder: isLibrary
        ? `Zoek in ${nav.label.toLowerCase()}...`
        : "Zoek controls, beleid, risico's...",
      'aria-label': 'Globaal zoeken',
      dataset: { focusId: 'global-search' },
      oninput: (e) => {
        if (isLibrary) {
          setState({ libraryQuery: e.target.value });
          return;
        }
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
