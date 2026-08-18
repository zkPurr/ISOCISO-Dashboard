import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { state, setState, setFilter } from '../core/store.js';
import { currentRoute, navigate } from '../core/router.js';
import { openImportModal } from './importModal.js';
import { openTaskImportModal } from './taskImportModal.js';
import { SEARCH_HELP } from './filters.js';
import { NAV_ITEMS, LIBRARY_ROUTES } from './sidebar.js';
import { TASK_ROUTES } from '../data/tasks.js';

const TITLES = {
  dashboard: 'ISO Beheersmaatregelen Overzicht',
  beheersmaatregelen: 'Beheersmaatregelen',
};

/** Which search box, and which import, the current page is asking for. */
function contextFor(route, nav) {
  if (TASK_ROUTES.has(route)) {
    return {
      value: state.taskQuery,
      placeholder: `Zoek in ${nav.label}...`,
      help: 'Zoekt in alle geïmporteerde kolommen, ook de verborgen.',
      oninput: (value) => setState({ taskQuery: value, taskPage: 1 }),
      // On a Taken page, Importeren means the Jira export — the button always
      // imports the data you are looking at.
      onImport: openTaskImportModal,
    };
  }

  if (LIBRARY_ROUTES.has(route)) {
    return {
      value: state.libraryQuery,
      placeholder: `Zoek in ${nav.label.toLowerCase()}...`,
      help: null,
      oninput: (value) => setState({ libraryQuery: value }),
      onImport: openImportModal,
    };
  }

  return {
    value: state.filters.query,
    placeholder: "Zoek controls, beleid, risico's...",
    help: SEARCH_HELP,
    oninput: (value) => {
      setFilter({ query: value });
      if (value && currentRoute() === 'dashboard') navigate('beheersmaatregelen');
    },
    onImport: openImportModal,
  };
}

export function renderTopbar(host) {
  const route = currentRoute();
  const nav = NAV_ITEMS.find((n) => n.route === route);
  const title = TITLES[route] || nav?.title || nav?.label || 'ISOCISO Dashboard';

  // The box always searches what you are looking at: the controls, one of the
  // registers, or the board that is open.
  const context = contextFor(route, nav);

  const search = el('.search.search-pill', [
    icon('search', { size: 17 }),
    el('input.input', {
      type: 'search',
      value: context.value,
      placeholder: context.placeholder,
      'aria-label': 'Globaal zoeken',
      title: context.help,
      id: 'global-search',
      name: 'global-search',
      dataset: { focusId: 'global-search' },
      oninput: (e) => context.oninput(e.target.value),
    }),
  ]);

  host.replaceChildren(
    el('h1', title),
    el('.topbar-search', search),
    el('button.btn.btn-primary', {
      type: 'button',
      onclick: context.onImport,
    }, [icon('upload', { size: 17 }), 'Importeren']),
  );
}
