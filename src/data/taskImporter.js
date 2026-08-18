import { loadXlsx, readWorkbook } from './xlsx.js';
import { buildColumns, buildTask, defaultColumnKeys, TASK_FIELDS, TASK_PROJECTS } from './tasks.js';

/**
 * Reads a Jira CSV export into tasks.
 *
 * Every column in the file is imported — a Jira board carries fields this app
 * has never heard of, and throwing them away at import time would mean a
 * re-export every time someone wants to see one. The picker decides what is
 * *shown*; the import decides nothing.
 */

const isBlankRow = (row) => !row.some((cell) => String(cell ?? '').trim());

const ROLES = new Set(TASK_FIELDS.map((field) => field.role));

/**
 * Jira puts its headers on row 1, but an export that has been through Excel
 * can pick up a title row first. Scan the top of the file and take the row
 * that names the most fields we recognise.
 */
function findHeaderRow(rows) {
  let best = { index: -1, score: -1 };

  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    const row = rows[i] || [];
    if (isBlankRow(row)) continue;

    const columns = buildColumns(row);
    const score = columns.filter((column) => ROLES.has(column.role)).length;
    if (score > best.score) best = { index: i, score };
    // A row naming every field we know is the header; no need to keep looking.
    if (score >= ROLES.size) break;
  }

  // Nothing recognisable anywhere: fall back to the first non-blank row, so a
  // board with entirely custom field names still imports as plain columns.
  if (best.score <= 0) {
    const first = rows.findIndex((row) => row && !isBlankRow(row));
    return first === -1 ? { index: -1 } : { index: first };
  }
  return best;
}

/**
 * @param {File} file
 * @returns {Promise<{ tasks: object[], columns: object[], visible: string[], report: object }>}
 */
export async function importTasks(file) {
  const XLSX = await loadXlsx();

  let workbook;
  try {
    workbook = await readWorkbook(XLSX, file, { raw: true });
  } catch (err) {
    throw new Error('Dit bestand kon niet gelezen worden als CSV.', { cause: err });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Het bestand bevat geen leesbare gegevens.');

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false, // Keep every cell as the text Jira wrote — dates are parsed here, not by SheetJS.
  });
  if (!rows.length) throw new Error('Het bestand is leeg.');

  const header = findHeaderRow(rows);
  if (header.index === -1) throw new Error('Geen headerrij gevonden in de eerste 15 rijen.');

  const columns = buildColumns(rows[header.index]);
  if (!columns.length) throw new Error('De headerrij bevat geen enkele kolomnaam.');

  const tasks = [];
  const byProject = {};
  let skipped = 0;

  for (let i = header.index + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (isBlankRow(row)) continue;

    const task = buildTask(row, columns);
    // A row with no content in any column we can show is not a task.
    if (!Object.values(task.cells).some(Boolean)) { skipped += 1; continue; }

    tasks.push(task);
    byProject[task.project || '—'] = (byProject[task.project || '—'] || 0) + 1;
  }

  if (!tasks.length) throw new Error('Geen taken gevonden onder de headerrij.');

  const known = new Set(TASK_PROJECTS.map((project) => project.key));
  // Rows on a board that has no page of its own would otherwise vanish without
  // a word. They are imported and counted, so the import report can say so.
  const otherProjects = Object.keys(byProject)
    .filter((key) => !known.has(key))
    .sort();

  return {
    tasks,
    columns,
    visible: defaultColumnKeys(columns),
    report: {
      fileName: file.name,
      importedAt: new Date().toISOString(),
      rowCount: tasks.length,
      skippedRows: skipped,
      headerRowIndex: header.index + 1,
      columnCount: columns.length,
      byProject,
      otherProjects,
      otherCount: otherProjects.reduce((sum, key) => sum + byProject[key], 0),
    },
  };
}
