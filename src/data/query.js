/**
 * Search syntax for the controls table.
 *
 * Plain text stays a substring search — that is what you want while typing.
 * Two forms ask for an exact match instead, because "A.5.1" as a substring
 * also drags in A.5.10 and A.5.11:
 *
 *   Control_ID:"A.5.1"   exact match on one field
 *   Control_ID:A.5.1     idem, quotes are optional
 *   "A.5.1"              exact match on any searchable field
 *
 * The field name is matched against the same aliases the importer uses, so
 * Control_ID, control id and Nummer all address the same column. An
 * unrecognised field name falls back to a plain substring search rather than
 * silently matching nothing.
 */

import { FIELDS, formatControlId, refKey } from './schema.js';

/** Fields a bare (unscoped) search looks at. */
const SEARCH_FIELDS = ['id', 'title', 'owner', 'domain'];

const norm = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Field token -> control property, built from the importer's own aliases. */
const FIELD_LOOKUP = (() => {
  const map = new Map();
  for (const field of FIELDS) {
    // The sheet's raw id is not what the table shows; point Control_ID at the
    // normalised display id instead.
    const key = field.key === 'rawId' ? 'id' : field.key;
    map.set(norm(field.label), key);
    for (const alias of field.aliases) map.set(norm(alias), key);
  }
  return map;
})();

const QUOTED = /^(?:([\w .-]+?)\s*:\s*)?["']([^"']*)["']$/;
const SCOPED = /^([\w .-]+?)\s*:\s*(.+)$/;

/**
 * @typedef {{ kind: 'empty' }
 *   | { kind: 'text', value: string }
 *   | { kind: 'exact', field: string|null, value: string }} ParsedQuery
 */

/** @returns {ParsedQuery} */
export function parseQuery(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { kind: 'empty' };

  const quoted = text.match(QUOTED);
  if (quoted) return exact(quoted[1], quoted[2], text);

  const scoped = text.match(SCOPED);
  if (scoped) return exact(scoped[1], scoped[2], text);

  return { kind: 'text', value: text.toLowerCase() };
}

function exact(fieldToken, value, original) {
  if (!fieldToken) return { kind: 'exact', field: null, value: value.trim() };

  const field = FIELD_LOOKUP.get(norm(fieldToken));
  // Unknown field name: treat the whole thing as ordinary text, so a typo
  // behaves like a search that finds nothing rather than a silent no-op.
  if (!field) return { kind: 'text', value: original.toLowerCase() };

  return { kind: 'exact', field, value: value.trim() };
}

function fieldEquals(control, key, value) {
  const needle = value.toLowerCase();

  // "5.1" and "A.5.1" address the same control, exactly as in the sheet.
  if (key === 'id') {
    return String(control.id).toLowerCase() === needle
      || String(control.id).toLowerCase() === formatControlId(value).toLowerCase();
  }
  if (key === 'maturity') {
    return control.maturity != null && control.maturity === Number(value);
  }
  // Evidence / Beleid / Risico's hold ids: match one of them, not the join.
  if (Array.isArray(control[key])) {
    return control[key].some((id) => refKey(id) === refKey(value));
  }
  return String(control[key] ?? '').trim().toLowerCase() === needle;
}

/**
 * @param {import('./schema.js').Control} control
 * @param {ParsedQuery} query
 */
export function matchesQuery(control, query) {
  if (query.kind === 'empty') return true;

  if (query.kind === 'text') {
    const haystack = SEARCH_FIELDS.map((key) => control[key]).join(' ').toLowerCase();
    return haystack.includes(query.value);
  }

  const fields = query.field ? [query.field] : SEARCH_FIELDS;
  return fields.some((key) => fieldEquals(control, key, query.value));
}

/** The query that pins the table to exactly one control. */
export const exactControlQuery = (id) => `Control_ID:"${id}"`;
