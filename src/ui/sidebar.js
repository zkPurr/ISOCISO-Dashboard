import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { navigate, currentRoute } from '../core/router.js';
import { state, setState } from '../core/store.js';

/**
 * Navigation. `enabled: false` renders the item but blocks the route — the
 * shape of the product stays visible while Rapportages is still to come.
 */
export const NAV = [
  { route: 'dashboard',          label: 'Dashboard',          icon: 'grid',        enabled: true  },
  { route: 'beheersmaatregelen', label: 'Beheersmaatregelen', icon: 'shieldCheck', enabled: true  },
  { route: 'evidence',           label: 'Evidence',           icon: 'clipboard',   enabled: true  },
  { route: 'beleid',             label: 'Beleid',             icon: 'doc',         enabled: true  },
  { route: 'risicos',            label: "Risico's",           icon: 'alert',       enabled: true  },
  { route: 'rapportages',        label: 'Rapportages',        icon: 'chart',       enabled: false },
];

/** Routes that list a linked register rather than the controls themselves. */
export const LIBRARY_ROUTES = new Set(['evidence', 'beleid', 'risicos']);

export function renderSidebar(host) {
  const active = currentRoute();

  const items = NAV.map((item) => {
    const isActive = item.route === active;
    const node = el('button.nav-item', {
      type: 'button',
      className: `nav-item${isActive ? ' is-active' : ''}`,
      disabled: !item.enabled,
      title: item.enabled ? item.label : `${item.label} — nog niet beschikbaar`,
      'aria-current': isActive ? 'page' : null,
      onclick: () => item.enabled && navigate(item.route),
    }, [
      icon(item.icon),
      el('span.nav-label', item.label),
      !item.enabled && el('span.nav-soon', 'Soon'),
    ]);
    return el('li', node);
  });

  host.replaceChildren(
    el('.brand', [
      el('.brand-mark', icon('shieldCheck', { size: 20 })),
      el('.brand-text', [
        el('span.brand-name', 'ISOCISO'),
        el('span.brand-sub', 'Dashboard'),
      ]),
    ]),
    el('nav', { 'aria-label': 'Hoofdnavigatie' }, el('ul.nav', items)),
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
