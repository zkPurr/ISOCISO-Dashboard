import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { state, setState } from '../core/store.js';
import { defaultColumnKeys } from '../data/tasks.js';

/**
 * Show/hide for the imported Jira columns.
 *
 * A Jira export routinely carries sixty columns, so the table shows a workable
 * default and this popover holds the rest. It is rendered inside the view like
 * everything else — its open state lives in the store, so a re-render (which
 * every checkbox causes) rebuilds it open instead of snapping it shut.
 */

let bound = false;

function close() {
  unbind();
  setState({ taskColumnsOpen: false });
}

function onPointerDown(e) {
  if (!e.target.closest?.('.popover-host')) close();
}

function onKeydown(e) {
  if (e.key === 'Escape') close();
}

/** Bound while the panel is open, so clicking the page behind it dismisses it. */
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

/** Called when the Taken view unmounts, so no listener outlives its panel. */
export function closeColumnPicker() {
  unbind();
  if (state.taskColumnsOpen) state.taskColumnsOpen = false;
}

function toggle(key, on) {
  const visible = new Set(state.taskVisible);
  if (on) visible.add(key);
  else visible.delete(key);

  // Canonical order, not click order: re-enabling a column puts it back where
  // it belongs rather than at the end.
  setState({
    taskVisible: state.taskColumns.filter((column) => visible.has(column.key)).map((c) => c.key),
    taskPage: 1,
  });
}

function checkRow(column, visible) {
  const on = visible.has(column.key);
  // The last visible column cannot be switched off — an empty table would
  // leave no way back except reopening this panel.
  const locked = on && visible.size === 1;

  return el('label.checkrow', { className: `checkrow${locked ? ' is-locked' : ''}` }, [
    el('input', {
      type: 'checkbox',
      checked: on,
      disabled: locked,
      id: `column-${column.key}`,
      name: `column-${column.key}`,
      dataset: { focusId: `column-${column.key}` },
      onchange: (e) => toggle(column.key, e.target.checked),
    }),
    el('span', { title: column.label }, column.label),
  ]);
}

export function columnPicker() {
  const { taskColumns: columns, taskVisible } = state;
  const visible = new Set(taskVisible);

  const button = el('button.btn', {
    type: 'button',
    'aria-expanded': String(state.taskColumnsOpen),
    'aria-haspopup': 'true',
    dataset: { focusId: 'column-picker' },
    onclick: () => setState({ taskColumnsOpen: !state.taskColumnsOpen }),
  }, [
    icon('columns', { size: 16 }),
    `Kolommen (${visible.size}/${columns.length})`,
  ]);

  if (!state.taskColumnsOpen) {
    unbind();
    return el('.popover-host', button);
  }

  bind();
  const panel = el('.popover', { role: 'group', 'aria-label': 'Kolommen tonen of verbergen' }, [
    el('.popover-head', [
      el('span', 'Kolommen'),
      el('.popover-actions', [
        el('button.btn.btn-ghost.btn-sm', {
          type: 'button',
          title: 'Terug naar de standaardkolommen',
          onclick: () => setState({ taskVisible: defaultColumnKeys(columns), taskPage: 1 }),
        }, 'Standaard'),
        el('button.btn.btn-ghost.btn-sm', {
          type: 'button',
          title: 'Alle geïmporteerde kolommen tonen',
          onclick: () => setState({ taskVisible: columns.map((c) => c.key), taskPage: 1 }),
        }, 'Alles'),
      ]),
    ]),
    el('.popover-list', columns.map((column) => checkRow(column, visible))),
  ]);

  return el('.popover-host', [button, panel]);
}
