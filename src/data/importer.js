import { matchHeaders, buildControl } from './schema.js';

/** SheetJS is loaded on demand — the dashboard boots without it. */
const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
let xlsxPromise = null;

function loadXlsx() {
  if (!xlsxPromise) {
    xlsxPromise = import(/* @vite-ignore */ XLSX_URL).catch((err) => {
      xlsxPromise = null;
      throw new Error(
        'Kon de Excel-bibliotheek niet laden. Controleer je internetverbinding en probeer opnieuw.',
        { cause: err },
      );
    });
  }
  return xlsxPromise;
}

/**
 * The header row is not always row 1 in practice (title rows, logos, blank
 * rows). Scan the first 15 rows and take the one that matches the most fields.
 */
function findHeaderRow(rows) {
  let best = { index: -1, score: -1, result: null };

  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    const row = (rows[i] || []).map((c) => String(c ?? ''));
    if (!row.some(Boolean)) continue;

    const result = matchHeaders(row);
    const score = Object.keys(result.map).length;
    if (score > best.score) best = { index: i, score, result };
  }
  return best;
}

/**
 * Parses an .xlsx/.xls/.csv file into controls.
 * @param {File} file
 * @returns {Promise<{ controls: Control[], report: object }>}
 */
export async function importWorkbook(file) {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch (err) {
    throw new Error('Dit bestand kon niet gelezen worden als Excel of CSV.', { cause: err });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Het werkboek bevat geen werkbladen.');

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
    raw: true,
  });
  if (!rows.length) throw new Error('Het eerste werkblad is leeg.');

  const header = findHeaderRow(rows);
  if (!header.result || header.index === -1) {
    throw new Error('Geen headerrij gevonden in de eerste 15 rijen.');
  }
  if (header.result.missing.length) {
    throw new Error(
      `Verplichte kolom(men) niet gevonden: ${header.result.missing.join(', ')}. ` +
      `Gevonden koppen: ${(rows[header.index] || []).filter(Boolean).join(', ') || '(geen)'}`,
    );
  }

  const { map, unmatched } = header.result;
  const controls = [];
  const skipped = [];
  const seen = new Set();

  for (let i = header.index + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (!row.some((cell) => String(cell ?? '').trim())) continue;

    const control = buildControl(row, map);
    if (!control.id) { skipped.push(i + 1); continue; }

    // Duplicate Control_IDs happen in a work-in-progress sheet; last one wins.
    if (seen.has(control.id)) {
      const at = controls.findIndex((c) => c.id === control.id);
      controls[at] = control;
    } else {
      seen.add(control.id);
      controls.push(control);
    }
  }

  if (!controls.length) throw new Error('Geen rijen met een geldig Control_ID gevonden.');

  return {
    controls,
    report: {
      fileName: file.name,
      sheetName,
      importedAt: new Date().toISOString(),
      rowCount: controls.length,
      skippedRows: skipped.length,
      // Position among the non-blank rows, not the spreadsheet row number —
      // blank rows are dropped before scanning.
      headerRowIndex: header.index + 1,
      mapped: Object.keys(map),
      unmatched,
      isDemo: false,
    },
  };
}
