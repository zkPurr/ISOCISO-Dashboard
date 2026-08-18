/**
 * THE expansion point of this app.
 *
 * Every column the importer understands is declared here, once. To support a
 * new Excel column you add one entry to FIELDS — the importer, the header
 * matcher, the "welke kolommen zijn gevonden" report and the control objects
 * all pick it up automatically. Nothing else needs to change.
 *
 * The same holds for whole worksheets: LOOKUP_SHEETS declares the Evidence,
 * Beleid and Risk sheets that the controls sheet points at by id.
 *
 * @typedef {Object} Control
 * @property {string}      id         Display id, e.g. "A.5.1"
 * @property {string}      rawId      Id exactly as it appeared in the sheet
 * @property {string}      title
 * @property {string}      domain     Normalised Dutch domain label
 * @property {string}      owner
 * @property {number|null} maturity   1..5, or null when not scored yet
 * @property {number|null} severity   Severity_Flag 1..3, or null for no flag
 * @property {string[]}    evidence   Ids into the Evidence sheet, as written
 * @property {string[]}    policies   Ids into the Beleid sheet
 * @property {string[]}    risks      Ids into the Risk sheet
 *
 * @typedef {Object} LookupRecord
 * @property {string} id           Normalised key used for matching
 * @property {string} rawId        Id exactly as it appeared in the sheet
 * @property {string} description
 * @property {string} [status]     Risk only — carried, not yet acted upon
 * @property {import('../core/url.js').Link} link
 */

/** Domain labels, normalised to Dutch. Keys are matched case/space-insensitively. */
export const DOMAIN_LABELS = {
  organizational: 'Organisatorisch',
  organisational: 'Organisatorisch',
  organisatorisch: 'Organisatorisch',
  organizatorisch: 'Organisatorisch',
  people: 'Mensgericht',
  mensgericht: 'Mensgericht',
  personeel: 'Mensgericht',
  physical: 'Fysiek',
  fysiek: 'Fysiek',
  technological: 'Technologisch',
  technical: 'Technologisch',
  technologisch: 'Technologisch',
};

/** Fixed display order, so charts never re-order when data changes. */
export const DOMAIN_ORDER = ['Organisatorisch', 'Mensgericht', 'Fysiek', 'Technologisch'];

export const DOMAIN_UNKNOWN = 'Onbekend';

/** The maturity score at and above which a control counts as "passed". */
export const MATURITY_PASS_THRESHOLD = 3;

/** Placeholder copy for controls without any link in the sheet. */
export const EMPTY_LABELS = {
  evidence: 'Geen evidence gekoppeld',
  policies: 'Geen beleid gekoppeld',
  risks: "Geen risico's gekoppeld",
};

/** Anchor text for a policy row whose Description cell is empty. */
export const POLICY_FALLBACK_LABEL = 'Ga naar beleid';

export const normaliseHeader = (value) =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Field definitions.
 *  key      — property name on the Control object
 *  label    — human label, used in the import report
 *  aliases  — accepted header spellings (normalised: lowercase, alphanumerics only)
 *  required — import fails without it
 *  parse    — raw cell -> stored value
 */
export const FIELDS = [
  {
    key: 'rawId',
    label: 'Control_ID',
    required: true,
    aliases: ['controlid', 'control', 'id', 'beheersmaatregelid', 'beheersmaatregel', 'nummer', 'nr', 'code'],
    parse: (v) => String(v ?? '').trim(),
  },
  {
    key: 'title',
    label: 'Control_Title',
    required: false,
    aliases: ['controltitle', 'title', 'titel', 'controlnaam', 'naam', 'beschrijving', 'description', 'omschrijving'],
    parse: (v) => String(v ?? '').trim(),
  },
  {
    key: 'domain',
    label: 'Domain',
    required: false,
    aliases: ['domain', 'domein', 'thema', 'theme', 'categorie', 'category'],
    parse: (v) => {
      const raw = String(v ?? '').trim();
      if (!raw) return DOMAIN_UNKNOWN;
      return DOMAIN_LABELS[normaliseHeader(raw)] || raw;
    },
  },
  {
    key: 'owner',
    label: 'Owner',
    required: false,
    aliases: ['owner', 'eigenaar', 'controlowner', 'verantwoordelijke', 'ownername'],
    parse: (v) => String(v ?? '').trim(),
  },
  {
    key: 'maturity',
    label: 'Kwaliteitsmaturiteit_27002',
    required: false,
    aliases: [
      'kwaliteitsmaturiteit27002', 'kwaliteitsmaturiteit', 'maturiteit27002',
      'iso27002maturiteit', 'maturiteit', 'maturity', 'maturityscore', 'volwassenheid',
    ],
    parse: (v) => {
      if (v == null || v === '') return null;
      // Tolerates "4", 4, "4 / 5", "niveau 4", "3,5".
      const match = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
      if (!match) return null;
      const score = Math.round(parseFloat(match[0]));
      return score >= 1 && score <= 5 ? score : null;
    },
  },
  {
    key: 'severity',
    label: 'Severity_Flag',
    required: false,
    aliases: [
      'severityflag', 'severity', 'ernst', 'flag', 'vlag', 'actienodig',
      'actievereist', 'prioriteitsvlag', 'severityscore',
    ],
    // 1 / 2 / 3 raise a flag on the row; anything else — empty, 0, text — does
    // not. An out-of-range number is treated as "no flag" rather than clamped:
    // a 7 in the sheet is a data error, and inventing a severity for it would
    // hide that.
    parse: (v) => {
      if (v == null || v === '') return null;
      const match = String(v).match(/-?\d+/);
      if (!match) return null;
      const level = parseInt(match[0], 10);
      return level >= 1 && level <= 3 ? level : null;
    },
  },

  /* ---------------------------------------------------------------------
     Relations. These cells hold ids into the Evidence / Beleid / Risk
     worksheets — "3" or "1, 4, 7" — not the linked content itself.
     --------------------------------------------------------------------- */
  {
    key: 'evidence',
    label: 'Evidence',
    required: false,
    aliases: ['evidence', 'bewijs', 'evidencelink', 'evidenceid', 'evidenceids', 'bewijsmateriaal'],
    parse: parseList,
  },
  {
    key: 'policies',
    label: 'Beleid',
    required: false,
    aliases: ['beleid', 'policy', 'policies', 'beleidsdocument', 'policyid', 'beleidid', 'beleidsid'],
    parse: parseList,
  },
  {
    key: 'risks',
    label: "Risico's",
    required: false,
    aliases: ['risico', 'risicos', 'risk', 'risks', 'riskid', 'riskids', 'gekoppelderisicos'],
    parse: parseList,
  },
];

const text = (v) => String(v ?? '').trim();

/**
 * The worksheets the controls sheet points at by id.
 *
 * `sheetAliases` matches the tab name (case/punctuation-insensitive, also as a
 * substring, so "Evidence register" hits). `fallbackIndex` is the position the
 * sheet has in the reference workbook — used only when no tab name matches and
 * the sheet at that position actually carries the required id column.
 * A field marked `role: 'url'` is also read from the cell's Excel hyperlink.
 */
export const LOOKUP_SHEETS = [
  {
    key: 'evidence',
    label: 'Evidence',
    route: 'evidence',
    icon: 'clipboard',
    fallbackIndex: 1,
    sheetAliases: ['evidence', 'bewijs', 'bewijsmateriaal', 'evidenceregister'],
    fields: [
      {
        key: 'rawId',
        label: 'ID',
        required: true,
        aliases: ['id', 'evidenceid', 'nr', 'nummer', 'code', 'volgnummer'],
        parse: text,
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        aliases: ['description', 'beschrijving', 'omschrijving', 'naam', 'titel', 'title', 'evidence'],
        parse: text,
      },
      {
        key: 'url',
        label: 'Link',
        required: false,
        role: 'url',
        aliases: ['link', 'url', 'hyperlink', 'locatie', 'location', 'pad', 'path', 'bestand', 'verwijzing'],
        parse: text,
      },
    ],
  },
  {
    key: 'policies',
    label: 'Beleid',
    route: 'beleid',
    icon: 'doc',
    fallbackIndex: 2,
    sheetAliases: ['beleid', 'policy', 'policies', 'beleidsdocumenten', 'beleidsstukken'],
    fields: [
      {
        key: 'rawId',
        label: 'ID',
        required: true,
        aliases: ['id', 'beleidid', 'policyid', 'nr', 'nummer', 'code', 'volgnummer'],
        parse: text,
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        aliases: ['description', 'beschrijving', 'omschrijving', 'naam', 'titel', 'title', 'beleid', 'policy', 'document'],
        parse: text,
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        role: 'url',
        aliases: ['url', 'link', 'hyperlink', 'locatie', 'location', 'verwijzing'],
        parse: text,
      },
    ],
  },
  {
    key: 'risks',
    label: "Risico's",
    route: 'risicos',
    icon: 'alert',
    fallbackIndex: 3,
    sheetAliases: ['risk', 'risks', 'risico', 'risicos', 'riskregister', 'risicoregister'],
    fields: [
      {
        key: 'rawId',
        label: 'ID',
        required: true,
        aliases: ['id', 'riskid', 'risicoid', 'nr', 'nummer', 'code', 'volgnummer'],
        parse: text,
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        aliases: ['description', 'beschrijving', 'omschrijving', 'naam', 'titel', 'title', 'risico', 'risk'],
        parse: text,
      },
      {
        // Carried through the pipeline and displayed, but nothing is derived
        // from it yet — the register's status values are not final.
        key: 'status',
        label: 'Status',
        required: false,
        aliases: ['status', 'stand', 'toestand', 'state', 'behandeling'],
        parse: text,
      },
    ],
  },
];

/** LOOKUP_SHEETS by key, for views that already know which one they want. */
export const LOOKUP_BY_KEY = Object.fromEntries(LOOKUP_SHEETS.map((s) => [s.key, s]));

/**
 * Normalises an id to a matching key, so the "3" in a control's Evidence cell
 * finds row "3", "03" or "3.0" in the Evidence sheet. Non-numeric ids
 * ("R-01") fall back to a lowercased, space-free form.
 */
export function refKey(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const numeric = Number(raw.replace(',', '.'));
  return Number.isFinite(numeric) ? String(numeric) : raw.toLowerCase().replace(/\s+/g, '');
}

/** Splits "R-01; R-02, R-03" into ["R-01", "R-02", "R-03"]. */
function parseList(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v)
    .split(/[;,|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Matches a row of sheet headers to field keys.
 * @param {string[]} headerRow
 * @param {typeof FIELDS} [fields] Defaults to the controls sheet's fields.
 * @returns {{ map: Record<string, number>, missing: string[], unmatched: string[] }}
 */
export function matchHeaders(headerRow, fields = FIELDS) {
  const normalised = headerRow.map(normaliseHeader);
  const map = {};
  const used = new Set();

  // Exact alias hits first, so a fuzzy "beschrijving" can never steal the slot
  // that an exact "Control_Title" should own.
  for (const pass of ['exact', 'fuzzy']) {
    for (const field of fields) {
      if (field.key in map) continue;
      const index = normalised.findIndex((header, i) => {
        if (!header || used.has(i)) return false;
        return pass === 'exact'
          ? field.aliases.includes(header)
          : field.aliases.some((alias) => header.includes(alias) || alias.includes(header));
      });
      if (index !== -1) {
        map[field.key] = index;
        used.add(index);
      }
    }
  }

  const missing = fields.filter((f) => f.required && !(f.key in map)).map((f) => f.label);
  const unmatched = headerRow.filter((h, i) => h && !used.has(i)).map(String);
  return { map, missing, unmatched };
}

/** Normalises "5.1" / "a.5.1" / "A 5.1" to the display form "A.5.1". */
export function formatControlId(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/^a[\s.]*/i, '').replace(/\s+/g, '');
  return /^\d+(\.\d+)*$/.test(digits) ? `A.${digits}` : trimmed;
}

/** Builds a plain record from a raw sheet row using a header map. */
export function buildRecord(row, map, fields) {
  const record = {};
  for (const field of fields) {
    const index = map[field.key];
    record[field.key] = field.parse(index === undefined ? undefined : row[index]);
  }
  return record;
}

/** Builds a Control from a raw sheet row using a header map. */
export function buildControl(row, map) {
  const control = buildRecord(row, map, FIELDS);
  control.id = formatControlId(control.rawId);
  if (!control.domain) control.domain = DOMAIN_UNKNOWN;
  return control;
}
