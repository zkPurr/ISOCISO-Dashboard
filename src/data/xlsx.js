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
