/**
 * Demo dataset: the 93 real ISO/IEC 27002:2022 controls, so the dashboard is
 * explorable before the (still evolving) Excel sheet is imported. Owners and
 * maturity scores are fabricated but deterministic — the numbers do not move
 * between reloads. Importing a file replaces this entirely.
 */

import { buildControl } from './schema.js';

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

export function buildDemoControls() {
  const map = { rawId: 0, title: 1, domain: 2 };

  return ROWS.map((row) => {
    const seed = hash(row[0]);
    const owners = OWNERS[row[2]];
    const control = buildControl(row, map);
    control.owner = owners[seed % owners.length];
    control.maturity = SCORE_CURVE[seed % SCORE_CURVE.length];
    return control;
  });
}

export function demoSource() {
  return {
    fileName: 'Demoset ISO 27002:2022',
    sheetName: '—',
    importedAt: new Date().toISOString(),
    rowCount: ROWS.length,
    skippedRows: 0,
    headerRowIndex: 1,
    mapped: ['rawId', 'title', 'domain', 'owner', 'maturity'],
    unmatched: [],
    isDemo: true,
  };
}
