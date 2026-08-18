import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { dateTime, num } from '../core/format.js';
import { state, setState } from '../core/store.js';
import { DEFAULT_ROLES, TASK_FIELDS, TASK_PROJECTS } from '../data/tasks.js';
import { importTasks } from '../data/taskImporter.js';
import { toast } from './toast.js';

/** The Jira CSV counterpart of the Excel import — a separate file, a separate dataset. */

let backdrop = null;

export function closeTaskImportModal() {
  backdrop?.remove();
  backdrop = null;
  document.removeEventListener('keydown', onKeydown);
}

function onKeydown(e) {
  if (e.key === 'Escape') closeTaskImportModal();
}

/** "SECU 24 · ISMSKACT 11" — the split the two menu items are built on. */
function projectSummary(byProject) {
  return TASK_PROJECTS
    .map((project) => `${project.label} ${num(byProject[project.key] || 0)}`)
    .join(' · ');
}

async function handleFile(file, statusNode) {
  if (!file) return;

  statusNode.replaceChildren(el('span.muted', `Bezig met inlezen van ${file.name}…`));
  try {
    const { tasks, columns, visible, report } = await importTasks(file);
    setState({
      tasks,
      taskColumns: columns,
      taskVisible: visible,
      taskSource: report,
      taskQuery: '',
      taskPage: 1,
      taskColumnsOpen: false,
    });
    closeTaskImportModal();

    // Rows on a board without a page of its own are imported but invisible —
    // say so, rather than let the totals quietly not add up.
    const extra = report.otherCount
      ? ` ${num(report.otherCount)} taak/taken staan op een ander bord `
        + `(${report.otherProjects.join(', ')}) en hebben geen eigen pagina.`
      : '';
    toast(
      `${num(tasks.length)} taken geïmporteerd uit ${report.fileName}. `
      + `${projectSummary(report.byProject)} · ${num(report.columnCount)} kolommen.${extra}`,
      'success',
    );
  } catch (err) {
    statusNode.replaceChildren(el('.hint', { style: { color: 'var(--wash-fail-fg)' } }, err.message));
    toast('Import mislukt — zie het venster voor details.', 'error');
  }
}

function clearTasks() {
  setState({
    tasks: [],
    taskColumns: [],
    taskVisible: [],
    taskSource: null,
    taskQuery: '',
    taskPage: 1,
    taskColumnsOpen: false,
  });
  closeTaskImportModal();
  toast('Alle geïmporteerde taken gewist.');
}

export function openTaskImportModal() {
  closeTaskImportModal();

  const fileInput = el('input', {
    type: 'file',
    accept: '.csv,text/csv',
    style: { display: 'none' },
    onchange: (e) => handleFile(e.target.files[0], status),
  });

  const status = el('div');

  const dropzone = el('.dropzone', {
    role: 'button',
    tabindex: '0',
    onclick: () => fileInput.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } },
    ondragover: (e) => { e.preventDefault(); dropzone.classList.add('is-over'); },
    ondragleave: () => dropzone.classList.remove('is-over'),
    ondrop: (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-over');
      handleFile(e.dataTransfer.files[0], status);
    },
  }, [
    icon('upload', { size: 26 }),
    el('strong', 'Sleep je Jira CSV-export hierheen'),
    el('span', 'of klik om te bladeren — .csv'),
  ]);

  const defaults = DEFAULT_ROLES
    .map((role) => TASK_FIELDS.find((field) => field.role === role))
    .filter(Boolean)
    .map((field) => `<code>${field.label}</code>`)
    .join(', ');

  const current = state.taskSource && el('.hint', [
    el('strong', 'Huidige taken: '),
    `${state.taskSource.fileName} — ${num(state.taskSource.rowCount)} taken, `
    + `${num(state.taskSource.columnCount)} kolommen, ingelezen ${dateTime(state.taskSource.importedAt)}.`,
  ]);

  const modal = el('.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Jira CSV importeren' }, [
    el('.modal-head', [
      el('h2', 'Jira CSV importeren'),
      el('button.btn.btn-ghost.btn-sm', { type: 'button', 'aria-label': 'Sluiten', onclick: closeTaskImportModal },
        icon('x', { size: 18 })),
    ]),
    el('.modal-body', [
      dropzone,
      fileInput,
      status,
      el('.hint', {
        html: 'Alle kolommen uit de export worden ingelezen; met <strong>Kolommen</strong> boven de tabel '
          + `bepaal je welke je ziet. Standaard staan aan: ${defaults}.`,
      }),
      el('.hint', {
        html: 'De export wordt gesplitst op <code>Project key</code>: '
          + `${TASK_PROJECTS.map((p) => `<code>${p.label}</code>`).join(' en ')} krijgen elk hun eigen pagina `
          + 'onder Taken. Ontbreekt die kolom, dan wordt het bord uit de issue key afgeleid. '
          + 'Taken van een ander bord worden wel ingelezen, maar hebben nergens een pagina.',
      }),
      el('.hint', {
        html: 'Rijen worden gemarkeerd op basis van <code>Due date</code>: deadline deze week is een '
          + 'gele vlag, een week verstreken oranje, langer verstreken rood.',
      }),
      current,
    ]),
    el('.modal-foot', [
      el('button.btn.btn-danger', {
        type: 'button',
        disabled: !state.tasks.length,
        onclick: clearTasks,
      }, [icon('trash', { size: 15 }), 'Taken wissen']),
      el('button.btn', { type: 'button', onclick: closeTaskImportModal }, 'Annuleren'),
    ]),
  ]);

  backdrop = el('.modal-backdrop', {
    onclick: (e) => { if (e.target === backdrop) closeTaskImportModal(); },
  }, modal);

  document.body.append(backdrop);
  document.addEventListener('keydown', onKeydown);
  dropzone.focus();
}
