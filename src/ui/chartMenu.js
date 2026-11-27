import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { state, setState } from '../core/store.js';

/**
 * The ⋯ menu beside the board charts. Holds the options that are not worth a
 * permanent control — today only "count closed tasks too". Same open-state
 * pattern as the column picker: the flag lives in the store, so the re-render
 * every toggle causes rebuilds it open.
 */

let bound = false;

function close() {
  unbind();
  setState({ taskChartMenuOpen: false });
}

function onPointerDown(e) {
  if (!e.target.closest?.('.chart-menu')) close();
}

function onKeydown(e) {
  if (e.key === 'Escape') close();
}

function bind() {
  if (bound) return;
  bound = true;
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeydown);
}

function unbind() {
  if (!bound) return;
  bound = false;
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('keydown', onKeydown);
}

/** Called when the Taken view unmounts, so no listener outlives its menu. */
export function closeChartMenu() {
  unbind();
  if (state.taskChartMenuOpen) state.taskChartMenuOpen = false;
}

/** @param {{ closedCount: number }} opts */
export function chartMenu({ closedCount }) {
  const open = state.taskChartMenuOpen;

  const button = el('button.btn.btn-ghost.btn-sm.icon-btn', {
    type: 'button',
    title: 'Meer opties',
    'aria-label': 'Meer opties voor de grafieken',
    'aria-expanded': String(open),
    'aria-haspopup': 'true',
    dataset: { focusId: 'chart-menu' },
    onclick: () => setState({ taskChartMenuOpen: !open }),
  }, icon('dots', { size: 18 }));

  if (!open) {
    unbind();
    return el('.popover-host.chart-menu', button);
  }

  bind();
  const panel = el('.popover.popover-sm', { role: 'group', 'aria-label': 'Grafiekopties' }, [
    el('.popover-list', el('label.checkrow', [
      el('input', {
        type: 'checkbox',
        checked: state.ui.showClosedTasks,
        id: 'chart-show-closed',
        name: 'chart-show-closed',
        dataset: { focusId: 'chart-show-closed' },
        onchange: (e) => setState({ ui: { showClosedTasks: e.target.checked } }),
      }),
      el('span', `Gesloten taken tonen (${closedCount})`),
    ])),
  ]);

  return el('.popover-host.chart-menu', [button, panel]);
}
