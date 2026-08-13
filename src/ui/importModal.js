import { el } from '../core/dom.js';
import { icon } from './icons.js';
import { dateTime, num } from '../core/format.js';
import { state, setState } from '../core/store.js';
import { FIELDS, LOOKUP_SHEETS } from '../data/schema.js';
import { importWorkbook } from '../data/importer.js';
import { buildDemoControls, buildDemoLibrary, demoSource } from '../data/demo.js';
import { clear as clearStorage } from '../data/persist.js';
import { closeDetailPane } from './detailPane.js';
import { toast } from './toast.js';

let backdrop = null;

export function closeImportModal() {
  backdrop?.remove();
  backdrop = null;
  document.removeEventListener('keydown', onKeydown);
}

function onKeydown(e) {
  if (e.key === 'Escape') closeImportModal();
}

/** "Evidence 22 · Beleid 12 · Risico's 14", or the reason a sheet was skipped. */
function librarySummary(libraries) {
  return LOOKUP_SHEETS.map((definition) => {
    const info = libraries?.[definition.key];
    return info?.sheetName
      ? `${definition.label} ${num(info.count)}`
      : `${definition.label} niet gevonden`;
  }).join(' · ');
}

async function handleFile(file, statusNode) {
  if (!file) return;

  statusNode.replaceChildren(el('span.muted', `Bezig met inlezen van ${file.name}…`));
  try {
    const { controls, library, report } = await importWorkbook(file);
    closeDetailPane();
    setState({ controls, library, source: report, page: 1, libraryQuery: '' });
    closeImportModal();

    const extra = report.unmatched.length
      ? ` ${report.unmatched.length} kolom(men) niet herkend en overgeslagen.`
      : '';
    toast(
      `${num(controls.length)} controls geïmporteerd uit ${report.fileName}. ` +
      `${librarySummary(report.libraries)}.${extra}`,
      'success',
    );
  } catch (err) {
    statusNode.replaceChildren(el('.hint', { style: { color: 'var(--wash-fail-fg)' } }, err.message));
    toast('Import mislukt — zie het venster voor details.', 'error');
  }
}

function loadDemo() {
  closeDetailPane();
  setState({
    controls: buildDemoControls(),
    library: buildDemoLibrary(),
    source: demoSource(),
    page: 1,
    libraryQuery: '',
  });
  closeImportModal();
  toast('Demoset met 93 ISO 27002:2022 controls geladen.', 'success');
}

function clearAll() {
  clearStorage();
  closeDetailPane();
  setState({
    controls: [],
    library: { evidence: [], policies: [], risks: [] },
    source: null,
    page: 1,
    libraryQuery: '',
  });
  closeImportModal();
  toast('Alle geïmporteerde data gewist.');
}

export function openImportModal() {
  closeImportModal();

  const fileInput = el('input', {
    type: 'file',
    accept: '.xlsx,.xls,.xlsm,.csv',
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
    el('strong', 'Sleep je Excel-bestand hierheen'),
    el('span', 'of klik om te bladeren — .xlsx, .xls of .csv'),
  ]);

  const columnList = FIELDS
    .map((f) => `<code>${f.label}</code>${f.required ? ' (verplicht)' : ''}`)
    .join(', ');

  const sheetList = LOOKUP_SHEETS
    .map((s) => `<code>${s.label}</code> (${s.fields.map((f) => f.label).join(', ')})`)
    .join(', ');

  const current = state.source && el('.hint', [
    el('strong', 'Huidige dataset: '),
    `${state.source.fileName} — ${num(state.source.rowCount)} controls, ingelezen ${dateTime(state.source.importedAt)}.`,
  ]);

  const modal = el('.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Excel importeren' }, [
    el('.modal-head', [
      el('h2', 'Excel importeren'),
      el('button.btn.btn-ghost.btn-sm', { type: 'button', 'aria-label': 'Sluiten', onclick: closeImportModal },
        icon('x', { size: 18 })),
    ]),
    el('.modal-body', [
      dropzone,
      fileInput,
      status,
      el('.hint', {
        html: `Het eerste werkblad is de controlsheet; de headerrij wordt automatisch gezocht in de ` +
              `eerste 15 rijen. Herkende kolommen: ${columnList}. Kolommen die ontbreken worden leeg ` +
              `gelaten — dat is geen fout.`,
      }),
      el('.hint', {
        html: `De werkbladen ${sheetList} worden er los bij gelezen en gekoppeld op de id's die in de ` +
              `kolommen <code>Evidence</code>, <code>Beleid</code> en <code>Risico's</code> staan ` +
              `(meerdere per cel mag: <code>1, 4, 7</code>). Ontbreekt zo'n werkblad, dan blijft de ` +
              `bijbehorende pagina simpelweg leeg.`,
      }),
      current,
    ]),
    el('.modal-foot', [
      el('button.btn.btn-danger', {
        type: 'button',
        disabled: !state.controls.length,
        onclick: clearAll,
      }, [icon('trash', { size: 15 }), 'Data wissen']),
      el('button.btn', { type: 'button', onclick: loadDemo }, 'Demoset laden'),
      el('button.btn', { type: 'button', onclick: closeImportModal }, 'Annuleren'),
    ]),
  ]);

  backdrop = el('.modal-backdrop', {
    onclick: (e) => { if (e.target === backdrop) closeImportModal(); },
  }, modal);

  document.body.append(backdrop);
  document.addEventListener('keydown', onKeydown);
  dropzone.focus();
}
