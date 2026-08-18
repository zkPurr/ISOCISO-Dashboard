/**
 * Demo dataset: the 93 real ISO/IEC 27002:2022 controls, so the dashboard is
 * explorable before the (still evolving) Excel sheet is imported. Owners,
 * maturity scores and the links into the three registers are fabricated but
 * deterministic — nothing moves between reloads. Importing a file replaces
 * this entirely.
 */

import { buildControl, refKey } from './schema.js';
import { toLink } from '../core/url.js';

const ORG = 'Organizational';
const PEO = 'People';
const PHY = 'Physical';
const TEC = 'Technological';

/** [Control_ID, Control_Title, Domain] — mirrors the sheet's own column shape. */
const ROWS = [
  ['5.1',  'Beleid voor informatiebeveiliging', ORG],
  ['5.2',  'Rollen en verantwoordelijkheden bij informatiebeveiliging', ORG],
  ['5.3',  'Scheiding van taken', ORG],
  ['5.4',  'Directieverantwoordelijkheden', ORG],
  ['5.5',  'Contact met overheidsinstanties', ORG],
  ['5.6',  'Contact met specialistische belangengroepen', ORG],
  ['5.7',  'Dreigingsinformatie', ORG],
  ['5.8',  'Informatiebeveiliging in projectmanagement', ORG],
  ['5.9',  'Inventaris van informatie en andere gerelateerde bedrijfsmiddelen', ORG],
  ['5.10', 'Aanvaardbaar gebruik van informatie en andere gerelateerde bedrijfsmiddelen', ORG],
  ['5.11', 'Teruggave van bedrijfsmiddelen', ORG],
  ['5.12', 'Classificatie van informatie', ORG],
  ['5.13', 'Labelen van informatie', ORG],
  ['5.14', 'Informatieoverdracht', ORG],
  ['5.15', 'Toegangsbeveiliging', ORG],
  ['5.16', 'Identiteitsbeheer', ORG],
  ['5.17', 'Authenticatie-informatie', ORG],
  ['5.18', 'Toegangsrechten', ORG],
  ['5.19', 'Informatiebeveiliging in leveranciersrelaties', ORG],
  ['5.20', 'Aandacht voor informatiebeveiliging in leveranciersovereenkomsten', ORG],
  ['5.21', 'Beheer van informatiebeveiliging in de ICT-toeleveringsketen', ORG],
  ['5.22', 'Monitoren, beoordelen en wijzigingsbeheer van leveranciersdiensten', ORG],
  ['5.23', 'Informatiebeveiliging voor het gebruik van clouddiensten', ORG],
  ['5.24', 'Planning en voorbereiding van incidentbeheer', ORG],
  ['5.25', 'Beoordeling van en besluitvorming over informatiebeveiligingsgebeurtenissen', ORG],
  ['5.26', 'Reactie op informatiebeveiligingsincidenten', ORG],
  ['5.27', 'Leren van informatiebeveiligingsincidenten', ORG],
  ['5.28', 'Verzamelen van bewijsmateriaal', ORG],
  ['5.29', 'Informatiebeveiliging tijdens verstoring', ORG],
  ['5.30', 'Gereedheid van ICT voor bedrijfscontinuïteit', ORG],
  ['5.31', 'Wettelijke, statutaire, regelgevende en contractuele eisen', ORG],
  ['5.32', 'Intellectuele-eigendomsrechten', ORG],
  ['5.33', 'Bescherming van registraties', ORG],
  ['5.34', 'Privacy en bescherming van PII', ORG],
  ['5.35', 'Onafhankelijke beoordeling van informatiebeveiliging', ORG],
  ['5.36', 'Naleving van beleid, regels en normen voor informatiebeveiliging', ORG],
  ['5.37', 'Gedocumenteerde bedieningsprocedures', ORG],

  ['6.1',  'Screening', PEO],
  ['6.2',  'Arbeidsvoorwaarden', PEO],
  ['6.3',  'Bewustzijn, opleiding en training voor informatiebeveiliging', PEO],
  ['6.4',  'Disciplinaire procedure', PEO],
  ['6.5',  'Verantwoordelijkheden bij beëindiging of wijziging van dienstverband', PEO],
  ['6.6',  'Vertrouwelijkheids- of geheimhoudingsovereenkomsten', PEO],
  ['6.7',  'Werken op afstand', PEO],
  ['6.8',  'Rapportage van informatiebeveiligingsgebeurtenissen', PEO],

  ['7.1',  'Fysieke beveiligingszones', PHY],
  ['7.2',  'Fysieke toegang', PHY],
  ['7.3',  'Beveiligen van kantoren, ruimten en faciliteiten', PHY],
  ['7.4',  'Fysieke beveiligingsbewaking', PHY],
  ['7.5',  'Beschermen tegen fysieke en omgevingsdreigingen', PHY],
  ['7.6',  'Werken in beveiligde gebieden', PHY],
  ['7.7',  'Clear desk en clear screen', PHY],
  ['7.8',  'Plaatsing en bescherming van apparatuur', PHY],
  ['7.9',  'Beveiliging van bedrijfsmiddelen buiten het terrein', PHY],
  ['7.10', 'Opslagmedia', PHY],
  ['7.11', 'Nutsvoorzieningen', PHY],
  ['7.12', 'Beveiliging van bekabeling', PHY],
  ['7.13', 'Onderhoud van apparatuur', PHY],
  ['7.14', 'Veilig verwijderen of hergebruiken van apparatuur', PHY],

  ['8.1',  'Eindpuntapparaten van gebruikers', TEC],
  ['8.2',  'Speciale toegangsrechten', TEC],
  ['8.3',  'Beperking van toegang tot informatie', TEC],
  ['8.4',  'Toegang tot broncode', TEC],
  ['8.5',  'Veilige authenticatie', TEC],
  ['8.6',  'Capaciteitsbeheer', TEC],
  ['8.7',  'Bescherming tegen malware', TEC],
  ['8.8',  'Beheer van technische kwetsbaarheden', TEC],
  ['8.9',  'Configuratiebeheer', TEC],
  ['8.10', 'Verwijderen van informatie', TEC],
  ['8.11', 'Datamaskering', TEC],
  ['8.12', 'Voorkomen van datalekken', TEC],
  ['8.13', 'Back-up van informatie', TEC],
  ['8.14', 'Redundantie van informatieverwerkende faciliteiten', TEC],
  ['8.15', 'Loggen', TEC],
  ['8.16', 'Monitoringactiviteiten', TEC],
  ['8.17', 'Kloksynchronisatie', TEC],
  ['8.18', 'Gebruik van speciale systeemhulpmiddelen', TEC],
  ['8.19', 'Installatie van software op operationele systemen', TEC],
  ['8.20', 'Beveiliging van netwerken', TEC],
  ['8.21', 'Beveiliging van netwerkdiensten', TEC],
  ['8.22', 'Scheiding van netwerken', TEC],
  ['8.23', 'Webfiltering', TEC],
  ['8.24', 'Gebruik van cryptografie', TEC],
  ['8.25', 'Veilige ontwikkellevenscyclus', TEC],
  ['8.26', 'Eisen voor applicatiebeveiliging', TEC],
  ['8.27', 'Veilige systeemarchitectuur en engineeringprincipes', TEC],
  ['8.28', 'Veilig coderen', TEC],
  ['8.29', 'Beveiligingstesten in ontwikkeling en acceptatie', TEC],
  ['8.30', 'Uitbestede ontwikkeling', TEC],
  ['8.31', 'Scheiding van ontwikkel-, test- en productieomgevingen', TEC],
  ['8.32', 'Wijzigingsbeheer', TEC],
  ['8.33', 'Testinformatie', TEC],
  ['8.34', 'Bescherming van informatiesystemen tijdens audittests', TEC],
];

const OWNERS = {
  [ORG]: ['GRC-team', 'CISO Office', 'Data Governance', 'Legal & Compliance', 'Security Operations'],
  [PEO]: ['HR / Security Awareness', 'HR Operations', 'CISO Office'],
  [PHY]: ['Facilities', 'Facility Security', 'IT Operations'],
  [TEC]: ['IT Operations', 'Security Operations', 'Security Architecture', 'Cloud Platform', 'Engineering'],
};

/** Stable string hash — keeps demo owners/scores identical across reloads. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Weighted so the mix looks like a real, partly-mature programme. */
const SCORE_CURVE = [1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, null];

/** Most rows carry no Severity_Flag at all — a flag has to stay exceptional. */
const SEVERITY_CURVE = [
  null, null, null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, 1, 1, 2, 3,
];

/* ------------------------------------------------------------------
   The three registers the controls sheet points at. [id, description,
   link] — with two deliberately awkward links, because a real register
   always has some: one network path and one empty cell.
   ------------------------------------------------------------------ */

const EVIDENCE_ROWS = [
  [1,  'Informatiebeveiligingsbeleid, vastgesteld door de directie', 'https://intranet.example.com/isms/beleid-2024.pdf'],
  [2,  'Notulen directiebeoordeling ISMS Q1', 'https://intranet.example.com/isms/mr-q1.docx'],
  [3,  'Rollen- en verantwoordelijkhedenmatrix (RACI)', 'https://intranet.example.com/isms/raci.xlsx'],
  [4,  'Registratie bedrijfsmiddelen (CMDB-export)', 'https://cmdb.example.com/reports/assets'],
  [5,  'Classificatierichtlijn informatie', 'https://intranet.example.com/isms/classificatie.pdf'],
  [6,  'Toegangsmatrix kritieke applicaties', 'https://intranet.example.com/iam/toegangsmatrix.xlsx'],
  [7,  'Kwartaalrapportage toegangsreview', 'https://iam.example.com/reviews/2024-q1'],
  [8,  'Screeningsprocedure nieuwe medewerkers', 'https://hr.example.com/beleid/screening'],
  [9,  'Deelnamerapport security-awarenesstraining', 'https://learning.example.com/reports/awareness'],
  [10, 'Getekende geheimhoudingsverklaringen', '\\\\fileserver\\HR\\NDA\\2024'],
  [11, 'Plattegrond fysieke beveiligingszones', 'https://facility.example.com/zones.pdf'],
  [12, 'Logboek bezoekersregistratie', ''],
  [13, 'Onderhoudscontract klimaatbeheersing serverruimte', 'https://facility.example.com/contracten/klimaat'],
  [14, 'Configuratiebaseline werkplekken (Intune)', 'https://endpoint.example.com/baselines/workplace'],
  [15, 'Maandrapportage patchmanagement', 'https://itops.example.com/reports/patching'],
  [16, 'Kwetsbaarhedenscan externe infrastructuur', 'https://scan.example.com/rapporten/extern-2024-03'],
  [17, 'Back-up- en hersteltestrapport', 'https://itops.example.com/reports/restore-test'],
  [18, 'SIEM-dashboard en alerteringsregels', 'https://siem.example.com/dashboards/detectie'],
  [19, 'Pentestrapport klantportaal', 'https://security.example.com/pentest/portaal-2024.pdf'],
  [20, 'Wijzigingsregistratie productieomgeving', 'https://itsm.example.com/changes'],
  [21, 'Leveranciersbeoordelingen en DPIA-dossiers', 'https://procurement.example.com/leveranciers'],
  [22, 'Evaluatierapport incidentoefening', 'https://security.example.com/oefeningen/2024-tabletop.pdf'],
];

const POLICY_ROWS = [
  [1,  'Informatiebeveiligingsbeleid', 'https://intranet.example.com/beleid/informatiebeveiliging'],
  [2,  'Toegangsbeleid en autorisatiebeheer', 'https://intranet.example.com/beleid/toegang'],
  [3,  'Beleid aanvaardbaar gebruik', 'https://intranet.example.com/beleid/aanvaardbaar-gebruik'],
  [4,  'Classificatie- en labelingbeleid', 'https://intranet.example.com/beleid/classificatie'],
  [5,  'Personeelsbeleid informatiebeveiliging', 'https://intranet.example.com/beleid/personeel'],
  [6,  'Fysiek beveiligingsbeleid', 'https://intranet.example.com/beleid/fysiek'],
  [7,  'Cryptografiebeleid', 'https://intranet.example.com/beleid/cryptografie'],
  [8,  'Back-up- en continuïteitsbeleid', 'https://intranet.example.com/beleid/continuiteit'],
  [9,  'Beleid veilige softwareontwikkeling', 'https://intranet.example.com/beleid/sdlc'],
  [10, 'Leveranciers- en uitbestedingsbeleid', 'https://intranet.example.com/beleid/leveranciers'],
  [11, 'Incidentmanagementbeleid', 'https://intranet.example.com/beleid/incidenten'],
  [12, 'Cloudgebruiksbeleid', 'https://intranet.example.com/beleid/cloud'],
];

/** [id, description, status] — status is carried through but not yet used. */
const RISK_ROWS = [
  [1,  'Onbevoegde toegang tot klantgegevens door verouderde autorisaties', 'Open'],
  [2,  'Datalek via onbeheerde eindpuntapparatuur', 'In behandeling'],
  [3,  'Uitval serverruimte door falende klimaatbeheersing', 'Open'],
  [4,  'Ransomware-infectie via phishing', 'In behandeling'],
  [5,  'Onvoldoende herstelbaarheid van back-ups', 'Open'],
  [6,  'Afhankelijkheid van één clouddienstverlener', 'Geaccepteerd'],
  [7,  'Kwetsbaarheden in extern benaderbare applicaties', 'In behandeling'],
  [8,  'Verlies van kennis bij vertrek sleutelmedewerkers', 'Geaccepteerd'],
  [9,  'Niet-naleving AVG bij verwerking van PII', 'Open'],
  [10, 'Onveilige configuratie van nieuwe cloudomgevingen', 'In behandeling'],
  [11, 'Ongeautoriseerde wijzigingen in productie', 'Open'],
  [12, 'Onvoldoende logging voor incidentonderzoek', ''],
  [13, 'Compromittering van de toeleveringsketen', 'Open'],
  [14, 'Fysieke diefstal van apparatuur buiten kantoor', 'Geaccepteerd'],
];

/** Turns a demo row into the same record shape the importer produces. */
function toRecord([id, description, third], { hasLink }) {
  const record = {
    id: refKey(id),
    rawId: String(id),
    description,
    link: toLink(hasLink ? third : ''),
  };
  if (!hasLink) record.status = third;
  return record;
}

export function buildDemoLibrary() {
  return {
    evidence: EVIDENCE_ROWS.map((row) => toRecord(row, { hasLink: true })),
    policies: POLICY_ROWS.map((row) => toRecord(row, { hasLink: true })),
    risks: RISK_ROWS.map((row) => toRecord(row, { hasLink: false })),
  };
}

/**
 * Spreads register ids over the controls the way a half-finished sheet does:
 * plenty of gaps, a few controls with several links.
 */
function pickRefs(seed, rows, counts) {
  const count = counts[seed % counts.length];
  const ids = new Set();
  for (let i = 0; i < count; i += 1) {
    ids.add(String(rows[(seed + i * 7 + i) % rows.length][0]));
  }
  return [...ids];
}

const EVIDENCE_COUNTS = [0, 0, 1, 1, 1, 2, 2, 3];
const POLICY_COUNTS = [0, 1, 1, 1, 2, 2];
const RISK_COUNTS = [0, 0, 1, 1, 2];

export function buildDemoControls() {
  const map = { rawId: 0, title: 1, domain: 2 };

  return ROWS.map((row) => {
    const seed = hash(row[0]);
    const owners = OWNERS[row[2]];
    const control = buildControl(row, map);
    control.owner = owners[seed % owners.length];
    control.maturity = SCORE_CURVE[seed % SCORE_CURVE.length];
    control.severity = SEVERITY_CURVE[(seed >> 9) % SEVERITY_CURVE.length];
    control.evidence = pickRefs(seed, EVIDENCE_ROWS, EVIDENCE_COUNTS);
    control.policies = pickRefs(seed >> 3, POLICY_ROWS, POLICY_COUNTS);
    control.risks = pickRefs(seed >> 6, RISK_ROWS, RISK_COUNTS);
    return control;
  });
}

export function demoSource() {
  const library = buildDemoLibrary();
  const sheet = (key, name) => ({
    sheetName: `${name} (demo)`,
    count: library[key].length,
    skippedRows: 0,
    duplicates: 0,
    brokenLinks: library[key].filter((r) => !r.link.ok && r.link.reason !== 'empty').length,
    mapped: ['rawId', 'description', key === 'risks' ? 'status' : 'url'],
    unmatched: [],
  });

  return {
    fileName: 'Demoset ISO 27002:2022',
    sheetName: '—',
    importedAt: new Date().toISOString(),
    rowCount: ROWS.length,
    skippedRows: 0,
    headerRowIndex: 1,
    mapped: ['rawId', 'title', 'domain', 'owner', 'maturity', 'severity', 'evidence', 'policies', 'risks'],
    unmatched: [],
    libraries: {
      evidence: sheet('evidence', 'Evidence'),
      policies: sheet('policies', 'Beleid'),
      risks: sheet('risks', 'Risk'),
    },
    isDemo: true,
  };
}
