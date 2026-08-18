import { el } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { num, dateTime } from '../core/format.js';
import { state, setState } from '../core/store.js';
import { selectTaskView, visibleColumns } from '../data/selectors.js';
import { dueSeverity, TASK_PROJECTS } from '../data/tasks.js';
import { taskTable } from '../ui/taskTable.js';
import { columnPicker } from '../ui/columnPicker.js';
import { tableFooter } from '../ui/pagination.js';
import { openTaskImportModal } from '../ui/taskImportModal.js';

/**
 * One page per Jira board. The two pages are the same view with a different
 * project key — the split is the only thing that differs, so it is a parameter
 * rather than two copies.
 */

/** Nothing imported yet: the same shape as the controls' empty state. */
function noTasksView(project) {
  return el('.card', el('.empty', [
    el('.empty-icon', icon('list', { size: 26 })),
    el('h2', 'Nog geen taken geïmporteerd'),
    el('p', [
      'Importeer een Jira CSV-export om ', el('strong', project.label), ' te vullen. ',
      'Alle kolommen worden ingelezen; welke je ziet bepaal je daarna zelf.',
    ]),
    el('.empty-actions', el('button.btn.btn-primary', {
      type: 'button',
      onclick: openTaskImportModal,
    }, [icon('upload', { size: 16 }), 'Jira CSV importeren'])),
  ]));
}

/** Imported, but nothing on this particular board. */
function emptyBoard(project) {
  const others = TASK_PROJECTS.filter((p) => p.key !== project.key).map((p) => p.label);
  const source = state.taskSource;

  return el('.card', el('.empty', [
    el('.empty-icon', icon('list', { size: 24 })),
    el('h2', `Geen taken op ${project.label}`),
    el('p', [
      `In ${source?.fileName || 'de import'} staat geen enkele taak met `,
      el('code', `Project key = ${project.key}`), '. ',
      others.length ? `Kijk eventueel bij ${others.join(', ')}.` : '',
    ]),
    el('.empty-actions', el('button.btn', {
      type: 'button',
      onclick: openTaskImportModal,
    }, [icon('upload', { size: 16 }), 'Andere export importeren'])),
  ]));
}

/** Search + column picker. Sits where the controls page has its filter bar. */
function toolbar(view, project) {
  return el('.card.toolbar', [
    el('.search', [
      icon('search', { size: 17 }),
      el('input.input', {
        type: 'search',
        value: state.taskQuery,
        placeholder: `Zoek in ${project.label}...`,
        'aria-label': `Zoek in ${project.label}`,
        title: 'Zoekt in alle geïmporteerde kolommen, ook de verborgen.',
        id: 'task-search',
        name: 'task-search',
        dataset: { focusId: 'task-search' },
        oninput: (e) => setState({ taskQuery: e.target.value, taskPage: 1 }),
      }),
    ]),
    el('span.table-foot-info', view.total === view.projectTotal
      ? `${num(view.projectTotal)} taken`
      : `${num(view.total)} van ${num(view.projectTotal)} taken`),
    el('.toolbar-spacer'),
    columnPicker(),
    el('button.btn', {
      type: 'button',
      disabled: !state.taskQuery,
      onclick: () => setState({ taskQuery: '', taskPage: 1 }),
    }, [icon('refresh', { size: 16 }), 'Zoekterm wissen']),
  ]);
}

/** How many rows on this board currently carry a flag, per level. */
function flagSummary(tasks) {
  const now = new Date();
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const task of tasks) {
    const level = dueSeverity(task.due, now);
    if (level) counts[level] += 1;
  }
  const flagged = counts[1] + counts[2] + counts[3];
  if (!flagged) return null;

  return el('.card-head', { style: { paddingBottom: 'var(--sp-5)' } }, [
    el('.card-title', `${num(flagged)} met een deadlinevlag`),
    el('.legend-inline', [
      ['Deze week', 1], ['Week verstreken', 2], ['Langer verstreken', 3],
    ].map(([label, level]) => el('.legend-row', [
      el('.legend-swatch', { style: { background: `var(--wash-sev${level}-fg)` } }),
      el('span.legend-name', `${label}: ${num(counts[level])}`),
    ]))),
  ]);
}

function sourceHint() {
  const source = state.taskSource;
  if (!source) return null;

  const notes = [
    source.skippedRows ? `${num(source.skippedRows)} lege rijen overgeslagen` : '',
    source.otherCount
      ? `${num(source.otherCount)} taken op ${source.otherProjects.join(', ')} zonder eigen pagina`
      : '',
  ].filter(Boolean);

  return el('.hint', { style: { marginTop: 'var(--sp-4)' } }, [
    el('strong', 'Bron: '),
    `${source.fileName} · ${num(source.rowCount)} taken · ${num(source.columnCount)} kolommen `
    + `· ingelezen ${dateTime(source.importedAt)}`,
    notes.length ? ` · ${notes.join(' · ')}` : '',
  ]);
}

/** Builds the view function for one board. */
export function tasksView(project) {
  return () => {
    if (!state.tasks.length) return noTasksView(project);

    const view = selectTaskView(state, project.key);
    if (!view.projectTotal) return emptyBoard(project);

    const columns = visibleColumns(state.taskColumns, state.taskVisible);

    return el('div', [
      toolbar(view, project),
      el('.card', [
        flagSummary(view.all),
        taskTable(view.rows, columns),
        tableFooter(view, {
          noun: 'taken',
          onPage: (page) => setState({ taskPage: page }),
          onPageSize: (size) => setState({ pageSize: size, taskPage: 1, page: 1 }),
        }),
      ]),
      sourceHint(),
    ]);
  };
}
