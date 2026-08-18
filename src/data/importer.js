import { matchHeaders, buildControl, buildRecord, refKey, LOOKUP_SHEETS } from './schema.js';
import { toLink, bestLink } from '../core/url.js';
import { loadXlsx, readWorkbook } from './xlsx.js';

/**
 * The header row is not always row 1 in practice (title rows, logos, blank
 * rows). Scan the first 15 rows and take the one that matches the most fields.
 */
function findHeaderRow(rows, fields) {
  let best = { index: -1, score: -1, result: null };

  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    const row = (rows[i] || []).map((c) => String(c ?? ''));
    if (!row.some(Boolean)) continue;

    const result = matchHeaders(row, fields);
    const score = Object.keys(result.map).length;
    if (score > best.score) best = { index: i, score, result };
  }
  return best;
}

const isBlankRow = (row) => !row.some((cell) => String(cell ?? '').trim());

const normaliseSheetName = (value) =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Finds the tab for a lookup sheet by name, falling back to its position in
 * the reference workbook. Both candidates are still validated by the caller —
 * a positional guess that has no id column is dropped rather than imported.
 */
function candidateSheets(sheetNames, definition, used) {
  const normalised = sheetNames.map(normaliseSheetName);
  const out = [];

  for (const pass of ['exact', 'contains']) {
    sheetNames.forEach((name, i) => {
      if (used.has(name) || out.includes(name)) return;
      const hit = definition.sheetAliases.some((alias) =>
        (pass === 'exact' ? normalised[i] === alias : normalised[i].includes(alias)));
      if (hit) out.push(name);
    });
  }

  const positional = sheetNames[definition.fallbackIndex];
  if (positional && !used.has(positional) && !out.includes(positional)) out.push(positional);
  return out;
}

/**
 * Excel keeps the hyperlink separate from the cell text: the cell can read
 * "Pentestrapport Q1" while the actual destination lives in `cell.l.Target`.
 * Losing that would turn every properly-linked sheet into plain text.
 */
function hyperlinkAt(XLSX, sheet, origin, rowOffset, colOffset) {
  if (colOffset == null) return '';
  const address = XLSX.utils.encode_cell({ r: origin.r + rowOffset, c: origin.c + colOffset });
  return sheet[address]?.l?.Target ? String(sheet[address].l.Target) : '';
}

/**
 * Reads one lookup worksheet (Evidence / Beleid / Risk).
 * @returns {{ ok: true, records: LookupRecord[], report: object } | { ok: false, reason: string }}
 */
function readLookupSheet(XLSX, sheet, sheetName, definition) {
  // blankrows:true keeps the array index aligned with the worksheet row, which
  // is what hyperlinkAt() needs to find the cell back.
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: true,
    defval: '',
    raw: true,
  });
  if (!rows.length) return { ok: false, reason: 'het werkblad is leeg' };

  const header = findHeaderRow(rows, definition.fields);
  if (!header.result || header.index === -1) {
    return { ok: false, reason: 'geen headerrij gevonden' };
  }
  if (header.result.missing.length) {
    return { ok: false, reason: `kolom ${header.result.missing.join(', ')} niet gevonden` };
  }

  const { map, unmatched } = header.result;
  const origin = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).s : { r: 0, c: 0 };
  const urlField = definition.fields.find((f) => f.role === 'url');

  const records = [];
  const byId = new Map();
  let skipped = 0;
  let duplicates = 0;
  let brokenLinks = 0;

  for (let i = header.index + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (isBlankRow(row)) continue;

    const record = buildRecord(row, map, definition.fields);
    record.id = refKey(record.rawId);
    if (!record.id) { skipped += 1; continue; }

    const target = urlField ? hyperlinkAt(XLSX, sheet, origin, i, map[urlField.key]) : '';
    record.link = urlField
      ? bestLink(toLink(target), toLink(record[urlField.key]))
      : toLink('');
    if (urlField && !record.link.ok && record.link.reason !== 'empty') brokenLinks += 1;

    // Duplicate ids happen in a work-in-progress register; last row wins.
    if (byId.has(record.id)) {
      records[byId.get(record.id)] = record;
      duplicates += 1;
    } else {
      byId.set(record.id, records.length);
      records.push(record);
    }
  }

  return {
    ok: true,
    records,
    report: {
      sheetName,
      count: records.length,
      skippedRows: skipped,
      duplicates,
      brokenLinks,
      mapped: Object.keys(map),
      unmatched,
    },
  };
}

/** Reads every lookup sheet declared in LOOKUP_SHEETS. Missing = empty, not fatal. */
function readLookupSheets(XLSX, workbook, controlsSheetName) {
  const library = {};
  const report = {};
  const used = new Set([controlsSheetName]);

  for (const definition of LOOKUP_SHEETS) {
    library[definition.key] = [];
    report[definition.key] = { sheetName: null, count: 0, reason: 'geen werkblad gevonden' };

    for (const name of candidateSheets(workbook.SheetNames, definition, used)) {
      const result = readLookupSheet(XLSX, workbook.Sheets[name], name, definition);
      if (!result.ok) continue;

      used.add(name);
      library[definition.key] = result.records;
      report[definition.key] = result.report;
      break;
    }
  }

  return { library, report };
}

/**
 * Parses an .xlsx/.xls/.csv file into controls plus the linked registers.
 * @param {File} file
 * @returns {Promise<{ controls: Control[], library: object, report: object }>}
 */
export async function importWorkbook(file) {
  const XLSX = await loadXlsx();

  let workbook;
  try {
    workbook = await readWorkbook(XLSX, file, { cellDates: true });
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
    if (isBlankRow(row)) continue;

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

  const { library, report: libraries } = readLookupSheets(XLSX, workbook, sheetName);

  return {
    controls,
    library,
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
      libraries,
      isDemo: false,
    },
  };
}
