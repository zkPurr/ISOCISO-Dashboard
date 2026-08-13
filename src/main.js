import { mount, captureFocus, restoreFocus } from './core/dom.js';
import { state, setState, subscribe } from './core/store.js';
import { defineRoutes, startRouter, resolve, currentRoute, navigate } from './core/router.js';
import { save, load } from './data/persist.js';
import { renderSidebar, NAV } from './ui/sidebar.js';
import { renderTopbar } from './ui/topbar.js';
import { dashboardView } from './views/dashboard.js';
import { controlsView } from './views/controls.js';
import { placeholderView } from './views/placeholder.js';

const app = document.getElementById('app');
const sidebarHost = document.getElementById('sidebar');
const topbarHost = document.getElementById('topbar');
const viewHost = document.getElementById('view');

/** Route table. A disabled NAV entry falls through to the placeholder. */
const ROUTES = {
  dashboard: dashboardView,
  beheersmaatregelen: controlsView,
};

function viewFor(route) {
  const nav = NAV.find((n) => n.route === route);
  if (nav && !nav.enabled) return () => placeholderView(nav.label);
  return ROUTES[route] || null;
}

let scheduled = false;

/** Batch renders — several setState calls in one tick paint once. */
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; render(); });
}

function render() {
  const route = currentRoute();
  const view = viewFor(route);

  const focus = captureFocus();

  app.classList.toggle('is-collapsed', state.ui.sidebarCollapsed);
  renderSidebar(sidebarHost);
  renderTopbar(topbarHost);

  if (view) {
    mount(viewHost, view());
  } else {
    navigate('dashboard');
    return;
  }

  restoreFocus(focus);
  persist();
}

function persist() {
  save({
    controls: state.controls,
    source: state.source,
    ui: state.ui,
    pageSize: state.pageSize,
  });
}

function boot() {
  const saved = load();
  if (saved) {
    state.controls = saved.controls;
    state.source = saved.source ?? null;
    if (saved.ui) Object.assign(state.ui, saved.ui);
    if (saved.pageSize) state.pageSize = saved.pageSize;
  }

  defineRoutes(ROUTES, { onNavigate: render });
  subscribe(scheduleRender);
  startRouter();
}

// Keeps the view honest if another tab imports a different sheet.
window.addEventListener('storage', () => {
  const saved = load();
  if (saved) setState({ controls: saved.controls, source: saved.source ?? null });
});

boot();

// Handy during development; harmless in production.
Object.assign(window, { __isociso: { state, setState, resolve } });
