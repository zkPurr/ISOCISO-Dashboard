/**
 * SheetJS is loaded on demand from the CDN — the dashboard boots, routes and
 * renders without it, and only an actual import pays for the download. Both
 * importers (Excel controls, Jira CSV) share this one loader so the library is
 * fetched at most once per session.
 */

const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
let xlsxPromise = null;

export function loadXlsx() {
  if (!xlsxPromise) {
    xlsxPromise = import(/* @vite-ignore */ XLSX_URL).catch((err) => {
      // Cleared so a retry after a dropped connection actually retries.
      xlsxPromise = null;
      throw new Error(
        'Kon de bibliotheek voor het inlezen van bestanden niet laden. '
        + 'Controleer je internetverbinding en probeer opnieuw.',
        { cause: err },
      );
    });
  }
  return xlsxPromise;
}

/* ------------------------------------------------------------------ Reading */

const CSV_NAME = /\.csv$/i;

const isCsv = (file) =>
  CSV_NAME.test(file.name || '') || file.type === 'text/csv';

/**
 * Decodes CSV bytes to text.
 *
 * SheetJS reading a CSV from an ArrayBuffer assumes codepage 1252, so a UTF-8
 * export comes out mojibaked: an em dash (E2 80 94) turns into "â€", and every
 * non-breaking space (C2 A0) into "Â ". Decoding here instead means the bytes
 * are read as what they are.
 *
 * UTF-8 first, strictly — if the file is genuinely Windows-1252, strict mode
 * throws on the first byte that cannot be UTF-8 and we fall back rather than
 * filling the table with replacement characters.
 */
export function decodeCsv(buffer) {
  const bytes = new Uint8Array(buffer);

  // A BOM is a byte-order mark, not data — left in place it becomes an
  // invisible character on the front of the very first column name.
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = hasBom ? bytes.subarray(3) : bytes;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return new TextDecoder('windows-1252').decode(body);
  }
}

/**
 * Reads a File into a SheetJS workbook, taking the CSV text path when the file
 * is a CSV so its encoding is handled rather than guessed.
 */
export async function readWorkbook(XLSX, file, options = {}) {
  const buffer = await file.arrayBuffer();
  return isCsv(file)
    ? XLSX.read(decodeCsv(buffer), { type: 'string', ...options })
    : XLSX.read(buffer, { type: 'array', ...options });
}
