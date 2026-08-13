# ISOCISO Dashboard

Statische webapp voor het overzicht van ISO 27001 / 27002 beheersmaatregelen.
Geen build-stap, geen framework, geen backend — puur HTML, CSS en ES-modules.
Klaar om te deployen op Netlify of Cloudflare Pages.

## Lokaal draaien

ES-modules werken niet via `file://`, dus start een klein servertje:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deployen

**Netlify** — sleep de map naar Netlify Drop, of koppel de repo.
`netlify.toml` staat er al in (`publish = "."`, geen build command).

**Cloudflare Pages** — nieuw project → build command leeg → output directory `/`.

De app gebruikt hash-routing (`#/dashboard`), dus er zijn geen redirect-regels
nodig voor deep links.

## Excel importeren

Klik op **Importeren** rechtsboven en sleep je `.xlsx`, `.xls` of `.csv` erin.
Het **eerste werkblad** is de controlsheet; de headerrij wordt automatisch
gezocht in de eerste 15 rijen.

Herkende kolommen (hoofdletters, spaties en underscores maken niet uit):

| Kolom | Verplicht | Toelichting |
|---|---|---|
| `Control_ID` | ja | `5.1`, `8.34`, `A.5.1` — wordt genormaliseerd naar `A.5.1` |
| `Control_Title` | nee | |
| `Domain` | nee | `Organizational` / `People` / `Physical` / `Technological` worden vertaald naar Organisatorisch / Mensgericht / Fysiek / Technologisch |
| `Owner` | nee | |
| `Kwaliteitsmaturiteit_27002` | nee | 1–5; leeg = "nog niet beoordeeld" |
| `Evidence`, `Beleid`, `Risico's` | nee | id's naar de gelijknamige werkbladen; meerdere per cel mag (`1, 4, 7`) |

Ontbrekende kolommen zijn **geen fout**: die velden blijven leeg en de app
toont "Geen evidence gekoppeld", "Geen beleid gekoppeld" en "Geen risico's
gekoppeld". Rijen zonder `Control_ID` worden overgeslagen; dubbele
`Control_ID`'s worden overschreven door de laatste rij.

### De gekoppelde werkbladen

Naast de controlsheet leest de importer drie registers. Het werkblad wordt
gezocht op tabnaam (`Evidence`, `Beleid`, `Risk` — ook als deel van een langere
naam); wordt er niets gevonden, dan valt hij terug op werkblad 2, 3 en 4, maar
alleen als daar een `ID`-kolom in staat.

| Werkblad | Kolommen |
|---|---|
| `Evidence` | `ID` (verplicht), `Description`, `Link` |
| `Beleid` | `ID` (verplicht), `Description`, `URL` |
| `Risk` | `ID` (verplicht), `Description`, `Status` |

Koppelen gebeurt op id. `1`, `01` en `1.0` zijn dezelfde rij; niet-numerieke
id's (`R-01`) werken ook. Een id in de controlsheet dat nergens op slaat wordt
**getoond** als "staat niet in het werkblad", niet stilzwijgend genegeerd.

Ontbreekt een werkblad, dan blijft de bijbehorende pagina simpelweg leeg met
uitleg — dat is geen importfout.

**Links** komen uit de celtekst óf uit de Excel-hyperlink achter die cel (een
cel die "Pentestrapport Q1" toont maar naar een URL linkt, werkt dus gewoon).
Wat geen bruikbare URL is — een lege cel, `\\fileserver\...`, "zie SharePoint" —
wordt als gewone tekst getoond met de reden in de tooltip, nooit als een
kapotte link. Alleen `http`, `https` en `mailto` worden gelinkt.

`Status` op het Risk-werkblad wordt wél ingelezen en getoond, maar er wordt nog
niets mee berekend.

Data blijft in `localStorage` van de browser — er gaat niets naar een server.
Met **Data wissen** in het importvenster gooi je alles weg.

## Zoeken

De zoekbalk zoekt standaard op **een deel van** de tekst. Dat is handig tijdens
het typen, maar `A.5.1` vindt dan ook A.5.10 en A.5.11. Voor exact zoeken:

| Zoekopdracht | Betekenis |
|---|---|
| `beleid` | bevat "beleid" (Control ID, titel, eigenaar, domein) |
| `"A.5.1"` | exact gelijk aan `A.5.1`, in welk veld dan ook |
| `Control_ID:"A.5.1"` | exact, alleen op Control ID — aanhalingstekens mogen weg |
| `Owner:"GRC-team"` | exact op eigenaar |
| `Evidence:"15"` | controls die aan evidence-id 15 hangen |

De kolomnaam mag elke spelling zijn die de importer ook accepteert
(`Control_ID`, `control id`, `Nummer`). Herkent hij de naam niet, dan wordt de
hele zoekopdracht als gewone tekst behandeld. `Control_ID:"5.1"` en
`Control_ID:"A.5.1"` vinden dezelfde control.

Klik je vanaf **Evidence**, **Beleid** of **Risico's** op een control-chip in de
kolom "Gekoppelde controls", dan springt de app naar Beheersmaatregelen met
precies zo'n exacte zoekopdracht.

## Waar zit wat

```
index.html
assets/css/
  tokens.css        design tokens — alle kleuren en maten staan hier
  base.css          reset + typografie
  layout.css        app-shell, sidebar, grids
  components.css    kaarten, knoppen, tabel, charts, modal
src/
  main.js           boot + renderloop
  core/
    dom.js          el() / svg() / mount() + focusbehoud bij re-render
    store.js        state + subscribe/setState
    router.js       hash-router
    format.js       nl-NL getallen, datums, Control-ID sortering
    url.js          celtekst → veilige link, of tekst met uitleg
  data/
    schema.js       ← kolom- én werkbladdefinities: HET uitbreidpunt
    importer.js     Excel/CSV → controls + registers (SheetJS, lazy geladen)
    selectors.js    filteren, sorteren, pagineren, KPI's, koppelingen
    query.js        zoeksyntax: substring, "exact" en Kolom:"exact"
    persist.js      localStorage
    demo.js         93 ISO 27002:2022 controls + demoregisters
  charts/           donut, gestapelde balken, tooltip
  ui/               sidebar, topbar, statcards, filters, tabel, paginering,
                    modal, detailPane (bottom sheet), links
  views/            dashboard, beheersmaatregelen, library (de drie registers),
                    placeholder, lege staat
```

## Uitbreiden

**Nieuwe Excel-kolom toevoegen** — voeg één entry toe aan `FIELDS` in
`src/data/schema.js` (key, label, aliassen, parse-functie). De importer, de
header-herkenning en het importrapport pikken hem automatisch op. Daarna kun je
hem tonen door een kolom toe te voegen aan `COLUMNS` in `src/ui/table.js`.

**Nieuw gekoppeld werkblad toevoegen** — voeg één entry toe aan `LOOKUP_SHEETS`
in `src/data/schema.js` (tabnaam-aliassen, kolommen, route, icoon). De importer,
de koppelingen en het importrapport pakken hem op; voor een eigen pagina komt er
een kolomdefinitie bij in `COLUMNS` in `src/views/library.js`.

**Nieuwe pagina toevoegen** — zet een entry in `NAV` in `src/ui/sidebar.js` en
koppel een viewfunctie in `ROUTES` in `src/main.js`. Met `enabled: false` blijft
het menu-item zichtbaar maar niet klikbaar (zo staat Rapportages er nu in).

**Nieuwe filter toevoegen** — één veld in `state.filters` (`src/core/store.js`),
één regel in `applyFilters` (`src/data/selectors.js`), één `select()` in
`src/ui/filters.js`.

**Kleuren aanpassen** — alles staat in `assets/css/tokens.css`. De chartkleuren
zijn gecontroleerd op kleurenblindheid-scheiding; pas je ze aan, valideer dan
opnieuw.

## Werkende pagina's

**Dashboard**, **Beheersmaatregelen**, **Evidence**, **Beleid** en **Risico's**
zijn actief. Rapportages staat in het menu maar is nog uitgeschakeld.

In de controltabel:

* **Evidence** en **Risico's** openen een detailpaneel dat van onderen
  opschuift, met per gekoppelde rij de beschrijving en de bron of de status.
  Sluiten met Escape, de knop of een klik naast het paneel.
* **Beleid** linkt direct door naar het document in een nieuw tabblad, met de
  `Description` als linktekst (of "Ga naar beleid" als die leeg is). Hangen er
  meer dan twee beleidsstukken aan één control, dan opent de rest in hetzelfde
  detailpaneel.

De drie registerpagina's tonen het werkblad zoals het is ingelezen, plus de
controls die eraan hangen — die staat nergens in het Excel-bestand zelf.
