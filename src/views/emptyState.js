import { el } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { openImportModal } from '../ui/importModal.js';
import { setState } from '../core/store.js';
import { buildDemoControls, demoSource } from '../data/demo.js';
import { toast } from '../ui/toast.js';

/** Shown on every data-driven view while nothing has been imported. */
export function noDataView() {
  return el('.card', el('.empty', [
    el('.empty-icon', icon('upload', { size: 26 })),
    el('h2', 'Nog geen controls geïmporteerd'),
    el('p', [
      'Importeer je ISO 27001 / 27002 Excel-bestand om het dashboard te vullen. ',
      'Minimaal nodig is een ', el('code', 'Control_ID'), '-kolom; ',
      'ontbrekende kolommen worden netjes leeg gelaten.',
    ]),
    el('.empty-actions', [
      el('button.btn.btn-primary', { type: 'button', onclick: openImportModal },
        [icon('upload', { size: 16 }), 'Excel importeren']),
      el('button.btn', {
        type: 'button',
        onclick: () => {
          setState({ controls: buildDemoControls(), source: demoSource(), page: 1 });
          toast('Demoset met 93 ISO 27002:2022 controls geladen.', 'success');
        },
      }, 'Demoset bekijken'),
    ]),
  ]));
}
