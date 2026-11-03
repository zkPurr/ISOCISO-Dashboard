/**
 * Groeiadvies: what a control has to *do* to climb one level on a dimension.
 * Derived from the Process / Policy / Traceability maturity model — each step
 * turns the description of the next level into concrete actions plus a
 * "klaar als" check you can verify.
 *
 * ADVICE[dimensionKey][from] is the step from `from` to `from + 1`, so index
 * 0 is 0 -> 1 and index 4 is 4 -> 5. Level 5 has no next step.
 */

import { MATURITY_DIMENSIONS, MATURITY_LEVELS } from './schema.js';
import { scoreOf } from './maturity.js';

/**
 * @typedef {Object} Step
 * @property {string}   title    Short imperative — fits a table cell
 * @property {string[]} actions  Concrete things to do
 * @property {string}   done     How you know the next level is reached
 */

/** @type {Record<string, Step[]>} */
export const ADVICE = {
  matProcess: [
    {
      title: 'Begin met uitvoeren',
      actions: [
        'Wijs één persoon aan die de control uitvoert.',
        'Voer de activiteit minstens één keer bewust uit.',
        'Noteer kort wat er gedaan is en wanneer.',
      ],
      done: 'Iemand voert het uit, ook al is het nog ad hoc.',
    },
    {
      title: 'Leg de werkwijze vast waar het al gebeurt',
      actions: [
        'Schrijf de stappen op die de uitvoerder nu volgt (checklist of werkinstructie).',
        'Begin met de onderdelen met het meeste risico; standaardiseer die eerst.',
        'Laat een tweede persoon het met die instructie uitvoeren.',
      ],
      done: 'Voor de belangrijkste onderdelen werkt iedereen op dezelfde manier — niet meer alleen afhankelijk van één persoon.',
    },
    {
      title: 'Maak er één standaardproces van',
      actions: [
        'Beschrijf het volledige proces in een procedure: rollen, stappen, frequentie, input en output.',
        'Leg eigenaarschap vast (bijv. RACI) en laat de procedure aansluiten op het beleid.',
        'Train iedereen die het uitvoert en maak de procedure vindbaar.',
      ],
      done: 'Het proces wordt overal volgens dezelfde gedocumenteerde procedure gevolgd.',
    },
    {
      title: 'Meet of het proces gevolgd wordt',
      actions: [
        "Kies 1–3 KPI's, bijv. % tijdig uitgevoerd, doorlooptijd of aantal afwijkingen.",
        'Verzamel ze periodiek uit de tooling (ticketsysteem, workflow, logging).',
        'Bespreek afwijkingen in een vast overleg en doe steekproeven of interne audits.',
      ],
      done: 'Je kunt met cijfers aantonen dat het proces daadwerkelijk wordt gevolgd.',
    },
    {
      title: 'Verbeter op basis van prestaties',
      actions: [
        "Stel doelen of drempelwaarden op de KPI's.",
        'Analyseer trends en de oorzaak van afwijkingen.',
        'Voer verbeteracties door via het verbeterregister (PDCA) en meet het effect.',
      ],
      done: 'De gemeten prestaties leiden aantoonbaar tot aanpassingen van het proces.',
    },
  ],

  matPolicy: [
    {
      title: 'Bepaal wat er moet gelden',
      actions: [
        'Spreek met de verantwoordelijke af welke regels voor deze control gelden.',
        'Zorg dat de eigenaar die regels kan uitleggen.',
      ],
      done: 'Er is iemand die weet wat de afspraken zijn — al staan ze nog niet op papier.',
    },
    {
      title: 'Zet het op papier',
      actions: [
        'Schrijf een concept: doel, scope, regels, rollen en uitzonderingen.',
        'Gebruik het ISMS-sjabloon zodat het herkenbaar is.',
        'Neem het op in het Beleid-werkblad en koppel het aan deze control.',
      ],
      done: 'Er bestaat een concept-document dat de afspraken beschrijft.',
    },
    {
      title: 'Laat het vaststellen en communiceer het',
      actions: [
        'Werk het concept bij: actuele organisatie, scope en verwijzing naar ISO 27002:2022.',
        'Laat het goedkeuren door de huidige eigenaar (versie, datum, akkoord vastgelegd).',
        'Publiceer het centraal en communiceer het: mail, awareness, onboarding.',
        'Plan een vaste reviewdatum (bijv. jaarlijks).',
      ],
      done: 'Het beleid is actueel, goedgekeurd door de huidige eigenaar en bekend bij wie het aangaat.',
    },
    {
      title: 'Controleer of het beleid werkt',
      actions: [
        'Bepaal hoe je naleving toetst: steekproeven, technische checks of interne audit.',
        'Leg bevindingen en uitzonderingen vast in een uitzonderingsregister.',
        'Rapporteer de naleving periodiek aan het management.',
      ],
      done: 'Je kunt aantonen dat het beleid wordt nageleefd en het beoogde effect heeft.',
    },
    {
      title: 'Verbeter op basis van data',
      actions: [
        'Gebruik nalevingscijfers, incidenten en auditbevindingen als input voor de review.',
        'Pas het beleid aan wanneer de data daar aanleiding toe geeft.',
        'Leg in de versiehistorie vast wélke data tot de wijziging leidde.',
      ],
      done: 'Elke beleidswijziging is onderbouwd met data.',
    },
  ],

  matEvidence: [
    {
      title: 'Bewaar een eerste bewijs',
      actions: [
        'Verzamel minstens één voorbeeld dat het gebeurt: mail, screenshot, notulen, log.',
      ],
      done: 'Er is (anekdotisch) bewijs dat de control bestaat.',
    },
    {
      title: 'Maak de belangrijkste stappen herleidbaar',
      actions: [
        'Bepaal welke processtappen bewijs opleveren.',
        'Bewaar dat bewijs op één vaste locatie.',
        'Registreer het in het Evidence-werkblad en koppel het aan deze control.',
      ],
      done: 'Delen van het proces zijn herleidbaar.',
    },
    {
      title: 'Maak het hele proces herleidbaar',
      actions: [
        'Zorg voor bewijs bij elke stap: aanvraag → goedkeuring → uitvoering → controle.',
        'Laat zien dat het aansluit op het beleid (verwijs naar het beleidsartikel).',
        'Leg bewaartermijn en locatie vast.',
      ],
      done: 'Een auditor kan het hele proces van begin tot eind volgen en tegen het beleid leggen.',
    },
    {
      title: 'Laat bewijs vanzelf ontstaan',
      actions: [
        'Leg het werk vast in tooling in plaats van handmatig: ticketsysteem, workflow, logging, SIEM, IAM-rapportages.',
        'Automatiseer exports en rapportages.',
        "Stop met 'bewijs verzamelen voor de audit' — het bestaat al.",
      ],
      done: 'Bewijs ontstaat als bijproduct van het werk zelf.',
    },
    {
      title: 'Stuur op het bewijs',
      actions: [
        'Gebruik de vastgelegde data in rapportages en dashboards.',
        'Bepaal prioriteiten en volgende stappen op basis daarvan (risicobeoordeling, roadmap).',
        'Koppel bevindingen direct aan verbeteracties.',
      ],
      done: 'Het bewijs bepaalt aantoonbaar de volgende stappen.',
    },
  ],
};

export const stepFor = (dimensionKey, from) =>
  (from == null || from >= 5 ? null : ADVICE[dimensionKey]?.[from] ?? null);

/**
 * What a single control should do next.
 *
 * The score is the MIN of the three dimensions, so the only way up is to lift
 * every dimension that sits at that minimum — those are the "blocking" steps.
 * Dimensions above the minimum are listed as "also possible", lowest first.
 * Unscored dimensions come first of all: you cannot improve what has not been
 * assessed.
 */
export function controlAdvice(control) {
  const dims = MATURITY_DIMENSIONS.map((d) => ({ ...d, score: scoreOf(control, d.key) }));
  const unscored = dims.filter((d) => d.score == null);
  const scored = dims.filter((d) => d.score != null);

  if (!scored.length) {
    return { current: null, target: null, blocking: [], further: [], unscored, isTop: false };
  }

  const min = Math.min(...scored.map((d) => d.score));
  const toStep = (d) => ({ dimension: d, from: d.score, to: d.score + 1, step: stepFor(d.key, d.score) });

  return {
    current: control.maturity ?? min,
    target: min < 5 ? min + 1 : null,
    blocking: scored.filter((d) => d.score === min && min < 5).map(toStep),
    further: scored.filter((d) => d.score > min && d.score < 5).sort((a, b) => a.score - b.score).map(toStep),
    unscored,
    isTop: min === 5,
  };
}

/** "Beleid 2 → 3: Laat het vaststellen en communiceer het" — one line per blocking step. */
export function adviceSummary(control) {
  const advice = controlAdvice(control);
  if (advice.unscored.length === MATURITY_DIMENSIONS.length) return ['Eerst beoordelen op Proces, Beleid en Evidence'];
  if (advice.isTop) return ['Op niveau 5 — vasthouden en blijven verbeteren'];
  return advice.blocking.map((b) => `${b.dimension.label} ${b.from} → ${b.to}: ${b.step.title}`);
}

export const levelName = (level) => MATURITY_LEVELS[level]?.name ?? '';
