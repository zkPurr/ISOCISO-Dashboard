import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { navigate, currentRoute } from '../core/router.js';
import { state, setState } from '../core/store.js';
import { TASK_PROJECTS } from '../data/tasks.js';

/**
 * Navigation. Entries are grouped under a heading: the GRC modules read the
 * ISMS sheet, Taken reads a Jira export, and the two datasets have nothing to
 * do with each other — the headings say so before anyone clicks.
 *
 * `enabled: false` renders the item but blocks the route, so the shape of the
 * product stays visible while Rapportages is still to come.
 */
export const NAV = [
  { route: 'dashboard', label: 'Dashboard', icon: 'grid', enabled: true },

  {
    header: 'GRC',
    items: [
      { route: 'beheersmaatregelen', label: 'Beheersmaatregelen', icon: 'shieldCheck', enabled: true },
      { route: 'evidence', label: 'Evidence', icon: 'clipboard', enabled: true },
      { route: 'beleid', label: 'Beleid', icon: 'doc', enabled: true },
      { route: 'risicos', label: "Risico's", icon: 'alert', enabled: true },
    ],
  },

  {
    header: 'Taken',
    items: TASK_PROJECTS.map((project) => ({
      route: project.route,
      label: project.label,
      title: `Taken — ${project.label}`,
      icon: 'list',
      enabled: true,
    })),
  },

  { route: 'rapportages', label: 'Rapportages', icon: 'chart', enabled: false },
];

/** Every nav entry, flattened — for route lookups that do not care about groups. */
export const NAV_ITEMS = NAV.flatMap((entry) => entry.items || [entry]);

/** Routes that list a linked register rather than the controls themselves. */
export const LIBRARY_ROUTES = new Set(['evidence', 'beleid', 'risicos']);

function navButton(item, active) {
  const isActive = item.route === active;
  return el('li', el('button.nav-item', {
    type: 'button',
    className: `nav-item${isActive ? ' is-active' : ''}`,
    disabled: !item.enabled,
    title: item.enabled ? (item.title || item.label) : `${item.label} — nog niet beschikbaar`,
    'aria-current': isActive ? 'page' : null,
    onclick: () => item.enabled && navigate(item.route),
  }, [
    icon(item.icon),
    el('span.nav-label', item.label),
    !item.enabled && el('span.nav-soon', 'Soon'),
  ]));
}

export function renderSidebar(host) {
  const active = currentRoute();

  // One <ul> per group, each preceded by its heading, so the grouping is in the
  // markup and not only in the spacing.
  const nav = NAV.flatMap((entry) => (entry.items
    ? [
      el('.nav-group-label', { 'aria-hidden': 'true' }, entry.header),
      el('ul.nav', { 'aria-label': entry.header }, entry.items.map((item) => navButton(item, active))),
    ]
    : [el('ul.nav', navButton(entry, active))]));

  host.replaceChildren(
    el('.brand', [
      el('.brand-mark', icon('shieldCheck', { size: 20 })),
      el('.brand-text', [
        el('span.brand-name', 'ISOCISO'),
        el('span.brand-sub', 'Dashboard'),
      ]),
    ]),
    el('nav', { 'aria-label': 'Hoofdnavigatie' }, nav),
    el('.sidebar-foot', el('button.nav-item', {
      type: 'button',
      title: state.ui.sidebarCollapsed ? 'Uitklappen' : 'Inklappen',
      onclick: () => setState({ ui: { sidebarCollapsed: !state.ui.sidebarCollapsed } }),
    }, [
      icon('chevronsLeft', {
        size: 18,
      }),
      el('span.nav-label collapse-label', state.ui.sidebarCollapsed ? 'Uitklappen' : 'Inklappen'),
    ])),
  );
}
