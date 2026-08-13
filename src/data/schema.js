/**
 * THE expansion point of this app.
 *
 * Every column the importer understands is declared here, once. To support a
 * new Excel column you add one entry to FIELDS — the importer, the header
 * matcher, the "welke kolommen zijn gevonden" report and the control objects
 * all pick it up automatically. Nothing else needs to change.
 *
 * @typedef {Object} Control
 * @property {string}      id         Display id, e.g. "A.5.1"
 * @property {string}      rawId      Id exactly as it appeared in the sheet
 * @property {string}      title
 * @property {string}      domain     Normalised Dutch domain label
 * @property {string}      owner
 * @property {number|null} maturity   1..5, or null when not scored yet
 * @property {string[]}    evidence   Not yet delivered by the sheet — stays []
 * @property {string[]}    policies   idem
 * @property {string[]}    risks      idem
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

/** Placeholder copy for links the sheet does not deliver yet. */
export const EMPTY_LABELS = {
  evidence: 'Geen evidence gekoppeld',
  policies: 'Geen beleid gekoppeld',
  risks: "Geen risico's gekoppeld",
};

const normaliseHeader = (value) =>
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

  /* ---------------------------------------------------------------------
     Not in the sheet yet. Declared so the pipeline already carries them —
     when the columns appear, only `aliases` needs filling in.
     --------------------------------------------------------------------- */
  {
    key: 'evidence',
    label: 'Evidence',
    required: false,
    aliases: ['evidence', 'bewijs', 'evidencelink', 'evidenceid'],
    parse: parseList,
  },
  {
    key: 'policies',
    label: 'Beleid',
    required: false,
    aliases: ['beleid', 'policy', 'policies', 'beleidsdocument', 'policyid'],
    parse: parseList,
  },
  {
    key: 'risks',
    label: "Risico's",
    required: false,
    aliases: ['risico', 'risicos', 'risk', 'risks', 'riskid', 'gekoppelderisicos'],
    parse: parseList,
  },
];

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
 * @returns {{ map: Record<string, number>, missing: string[], unmatched: string[] }}
 */
export function matchHeaders(headerRow) {
  const normalised = headerRow.map(normaliseHeader);
  const map = {};
  const used = new Set();

  // Exact alias hits first, so a fuzzy "beschrijving" can never steal the slot
  // that an exact "Control_Title" should own.
  for (const pass of ['exact', 'fuzzy']) {
    for (const field of FIELDS) {
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

  const missing = FIELDS.filter((f) => f.required && !(f.key in map)).map((f) => f.label);
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

/** Builds a Control from a raw sheet row using a header map. */
export function buildControl(row, map) {
  const control = {};
  for (const field of FIELDS) {
    const index = map[field.key];
    control[field.key] = field.parse(index === undefined ? undefined : row[index]);
  }
  control.id = formatControlId(control.rawId);
  if (!control.domain) control.domain = DOMAIN_UNKNOWN;
  return control;
}
