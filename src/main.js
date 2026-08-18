import { mount, captureFocus, restoreFocus } from './core/dom.js';
import { state, setState, subscribe } from './core/store.js';
import { defineRoutes, startRouter, resolve, currentRoute, navigate } from './core/router.js';
import { save, load } from './data/persist.js';
import { renderSidebar, NAV_ITEMS } from './ui/sidebar.js';
import { renderTopbar } from './ui/topbar.js';
import { closeDetailPane } from './ui/detailPane.js';
import { closeColumnPicker } from './ui/columnPicker.js';
import { TASK_PROJECTS } from './data/tasks.js';
import { dashboardView } from './views/dashboard.js';
import { controlsView } from './views/controls.js';
import { evidenceView, beleidView, risicosView } from './views/library.js';
import { tasksView } from './views/tasks.js';
import { placeholderView } from './views/placeholder.js';

const app = document.getElementById('app');
const sidebarHost = document.getElementById('sidebar');
const topbarHost = document.getElementById('topbar');
const viewHost = document.getElementById('view');

/** Route table. A disabled NAV entry falls through to the placeholder. */
const ROUTES = {
  dashboard: dashboardView,
  beheersmaatregelen: controlsView,
  evidence: evidenceView,
  beleid: beleidView,
  risicos: risicosView,
  // One route per Jira board, built from the same view.
  ...Object.fromEntries(TASK_PROJECTS.map((project) => [project.route, tasksView(project)])),
};

function viewFor(route) {
  const nav = NAV_ITEMS.find((n) => n.route === route);
  if (nav && !nav.enabled) return () => placeholderView(nav.label);
  return ROUTES[route] || null;
}

let scheduled = false;
let renderedRoute = null;

/** Batch renders — several setState calls in one tick paint once. */
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; render(); });
}

function render() {
  const route = currentRoute();
  const view = viewFor(route);

  // The detail pane belongs to the row it was opened from — leaving the page
  // (browser back included) closes it rather than stranding it over a new view.
  if (route !== renderedRoute) {
    closeDetailPane();
    closeColumnPicker();
    renderedRoute = route;
  }

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
    library: state.library,
    source: state.source,
    tasks: state.tasks,
    taskColumns: state.taskColumns,
    taskVisible: state.taskVisible,
    taskSource: state.taskSource,
    taskSort: state.taskSort,
    taskPageSize: state.taskPageSize,
    ui: state.ui,
    pageSize: state.pageSize,
  });
}

function boot() {
  const saved = load();
  if (saved) {
    state.controls = saved.controls;
    state.library = saved.library;
    state.source = saved.source ?? null;
    state.tasks = saved.tasks;
    state.taskColumns = saved.taskColumns;
    state.taskVisible = saved.taskVisible;
    state.taskSource = saved.taskSource;
    // A payload from before these were persisted keeps the store's defaults;
    // the sort is re-derived from the data on the next import anyway.
    if (saved.taskSort) state.taskSort = saved.taskSort;
    if (saved.taskPageSize != null) state.taskPageSize = saved.taskPageSize;
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
  if (!saved) return;

  closeDetailPane();
  closeColumnPicker();

  // Adopt the view preferences too, not just the data. Every render persists
  // the whole snapshot, so a tab that kept its own sort and page size would
  // write them straight back over the other tab's — the two would sit there
  // reverting each other. Taking what arrived makes them converge instead.
  setState({
    controls: saved.controls,
    library: saved.library,
    source: saved.source ?? null,
    tasks: saved.tasks,
    taskColumns: saved.taskColumns,
    taskVisible: saved.taskVisible,
    taskSource: saved.taskSource,
    ...(saved.taskSort ? { taskSort: saved.taskSort } : null),
    ...(saved.taskPageSize != null ? { taskPageSize: saved.taskPageSize } : null),
    ...(saved.pageSize ? { pageSize: saved.pageSize } : null),
  });
});

boot();

// Handy during development; harmless in production.
Object.assign(window, { __isociso: { state, setState, resolve } });
