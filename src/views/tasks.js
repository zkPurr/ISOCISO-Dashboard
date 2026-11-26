import { el } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { num, dateTime } from '../core/format.js';
import { state, setState } from '../core/store.js';
import { selectTaskView, tasksForProject, visibleColumns } from '../data/selectors.js';
import { dueSeverity, TASK_PROJECTS } from '../data/tasks.js';
import {
  distribution, assigneeOf, statusOf, labelsOf,
  createdColumn, createdBounds, tasksInRange,
} from '../data/taskStats.js';
import { donutChart } from '../charts/donut.js';
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

/** "2026-08-10" -> "10 aug 2026" */
const dayLabel = (value) => new Date(`${value}T00:00`).toLocaleDateString('nl-NL', {
  day: 'numeric', month: 'short', year: 'numeric',
});

/**
 * From / to on the Created date. An empty bound is open on that side, so the
 * inputs show the board's own first and last day until someone narrows them.
 */
function rangePicker(project, bounds, range) {
  const from = range?.from || '';
  const to = range?.to || '';

  const commit = (side, value) => {
    // Chrome reports "0002", "0020", "0202" while a year is still being typed;
    // committing those would re-render mid-keystroke.
    if (value && Number(value.slice(0, 4)) < 1900) return;

    const next = { from, to, [side]: value };
    // Moving one bound past the other drags the other one along.
    if (next.from && next.to && next.from > next.to) next[side === 'from' ? 'to' : 'from'] = value;
    // A bound at or beyond the data's own edge narrows nothing — store it as
    // open, so "full range" stays one state rather than several look-alikes.
    if (next.from && next.from <= bounds.from) next.from = '';
    if (next.to && next.to >= bounds.to) next.to = '';
    setState({ taskRange: { [project.key]: next } });
  };

  const dateInput = (side, props) => el('input.input', {
    type: 'date',
    id: `task-range-${side}`,
    name: `task-range-${side}`,
    dataset: { focusId: `task-range-${side}` },
    onchange: (e) => commit(side, e.target.value),
    ...props,
  });

  return el('.range-picker', [
    el('label.field-label', { for: 'task-range-from' }, 'Aangemaakt van'),
    dateInput('from', {
      value: from || bounds.from,
      min: bounds.from,
      max: to || bounds.to,
      'aria-label': 'Aangemaakt vanaf',
    }),
    el('label.field-label', { for: 'task-range-to' }, 't/m'),
    dateInput('to', {
      value: to || bounds.to,
      min: from || bounds.from,
      max: bounds.to,
      'aria-label': 'Aangemaakt tot en met',
    }),
    el('button.btn.btn-sm', {
      type: 'button',
      disabled: !from && !to,
      onclick: () => setState({ taskRange: { [project.key]: null } }),
    }, [icon('refresh', { size: 14 }), 'Volledige periode']),
  ]);
}

/**
 * The board at a glance: who has the work, what state it is in, what it is
 * tagged with — optionally narrowed to the tasks created in a date window.
 *
 * Deliberately the whole board, not the current search — a hue belongs to an
 * assignee, not to their rank, so a filter that reshuffles the counts must not
 * repaint the slices underneath you. The table below answers "what matches
 * what I typed"; this panel answers "what does this board look like". The
 * date window is the exception because it is this panel's own control, right
 * above the charts it changes.
 */
function boardCharts(boardTasks, columns, project) {
  const created = createdColumn(columns);
  const bounds = created ? createdBounds(boardTasks, created) : null;
  const range = bounds ? state.taskRange[project.key] : null;
  const tasks = bounds ? tasksInRange(boardTasks, created, range) : boardTasks;
  const narrowed = tasks !== boardTasks;

  const byAssignee = distribution(tasks, assigneeOf(columns), { emptyLabel: 'Niet toegewezen' });
  const byStatus = distribution(tasks, statusOf(columns), { emptyLabel: 'Geen status' });
  const byLabel = distribution(tasks, labelsOf(columns), { emptyLabel: 'Geen label' });

  const foldNote = (result) => (result.folded
    ? `${num(result.distinct)} in totaal — de kleinste ${result.folded === 1
      ? 'staat' : `${num(result.folded)} staan`} onder "Overig".`
    : null);

  // Tasks with no Created date cannot sit inside any window — say how many
  // dropped out for that reason, so the totals still add up.
  const undated = narrowed ? boardTasks.filter((task) => task.parsed[created.key] == null).length : 0;
  const scope = narrowed
    ? [
      `${num(tasks.length)} van ${num(boardTasks.length)} taken, aangemaakt `
        + `${dayLabel(range.from || bounds.from)} t/m ${dayLabel(range.to || bounds.to)}`,
      undated ? `${num(undated)} zonder aanmaakdatum niet meegeteld` : '',
    ].filter(Boolean).join(' · ')
    : `${num(tasks.length)} taken op dit bord`;

  return el('.card', [
    el('.card-head.chart-head', [
      el('div', [
        el('.card-title', `${project.label} in één oogopslag`),
        el('.table-foot-info', scope),
      ]),
      bounds && rangePicker(project, bounds, range),
    ]),
    el('.card-body', el('.viz-grid-3', [
      donutChart({
        title: 'Per behandelaar',
        centerValue: num(byAssignee.total),
        segments: byAssignee.slices,
        noun: 'taken',
        legendPercent: true,
        note: foldNote(byAssignee),
      }),
      donutChart({
        title: 'Per status',
        centerValue: num(byStatus.total),
        segments: byStatus.slices,
        noun: 'taken',
        legendPercent: true,
        note: foldNote(byStatus),
      }),
      donutChart({
        title: 'Per label',
        centerValue: num(byLabel.total),
        segments: byLabel.slices,
        noun: 'keer',
        legendPercent: true,
        // A task with three labels is counted three times, so this total is not
        // the number of tasks — say so rather than let the numbers not add up.
        note: byLabel.total === tasks.length
          ? foldNote(byLabel)
          : [`${num(byLabel.total)} labels over ${num(tasks.length)} taken — een taak met`,
            'meerdere labels telt bij elk label mee.', foldNote(byLabel)].filter(Boolean).join(' '),
      }),
    ])),
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
      boardCharts(tasksForProject(state.tasks, project.key), state.taskColumns, project),
      toolbar(view, project),
      el('.card', [
        flagSummary(view.all),
        taskTable(view.rows, columns),
        tableFooter(view, {
          noun: 'taken',
          pageSize: state.taskPageSize,
          onPage: (page) => setState({ taskPage: page }),
          onPageSize: (size) => setState({ taskPageSize: size, taskPage: 1 }),
        }),
      ]),
      sourceHint(),
    ]);
  };
}
