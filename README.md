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
Het eerste werkblad wordt gelezen en de headerrij wordt automatisch gezocht in
de eerste 15 rijen.

Herkende kolommen (hoofdletters, spaties en underscores maken niet uit):

| Kolom | Verplicht | Toelichting |
|---|---|---|
| `Control_ID` | ja | `5.1`, `8.34`, `A.5.1` — wordt genormaliseerd naar `A.5.1` |
| `Control_Title` | nee | |
| `Domain` | nee | `Organizational` / `People` / `Physical` / `Technological` worden vertaald naar Organisatorisch / Mensgericht / Fysiek / Technologisch |
| `Owner` | nee | |
| `Kwaliteitsmaturiteit_27002` | nee | 1–5; leeg = "nog niet beoordeeld" |
| `Evidence`, `Beleid`, `Risico's` | nee | nog niet aanwezig in de bronsheet |

Ontbrekende kolommen zijn **geen fout**: die velden blijven leeg en de app
toont "Geen evidence gekoppeld", "Geen beleid gekoppeld" en "Geen risico's
gekoppeld". Rijen zonder `Control_ID` worden overgeslagen; dubbele
`Control_ID`'s worden overschreven door de laatste rij.

Data blijft in `localStorage` van de browser — er gaat niets naar een server.
Met **Data wissen** in het importvenster gooi je alles weg.

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
  data/
    schema.js       ← kolomdefinities: HET uitbreidpunt
    importer.js     Excel/CSV → controls (SheetJS, lazy geladen)
    selectors.js    filteren, sorteren, pagineren, KPI's
    persist.js      localStorage
    demo.js         93 echte ISO 27002:2022 controls als demoset
  charts/           donut, gestapelde balken, tooltip
  ui/               sidebar, topbar, statcards, filters, tabel, paginering, modal
  views/            dashboard, beheersmaatregelen, placeholder, lege staat
```

## Uitbreiden

**Nieuwe Excel-kolom toevoegen** — voeg één entry toe aan `FIELDS` in
`src/data/schema.js` (key, label, aliassen, parse-functie). De importer, de
header-herkenning en het importrapport pikken hem automatisch op. Daarna kun je
hem tonen door een kolom toe te voegen aan `COLUMNS` in `src/ui/table.js`.

**Nieuwe pagina toevoegen** — zet een entry in `NAV` in `src/ui/sidebar.js` en
koppel een viewfunctie in `ROUTES` in `src/main.js`. Met `enabled: false` blijft
het menu-item zichtbaar maar niet klikbaar (zo staan Beleid, Risico's en
Rapportages er nu in).

**Nieuwe filter toevoegen** — één veld in `state.filters` (`src/core/store.js`),
één regel in `applyFilters` (`src/data/selectors.js`), één `select()` in
`src/ui/filters.js`.

**Kleuren aanpassen** — alles staat in `assets/css/tokens.css`. De chartkleuren
zijn gecontroleerd op kleurenblindheid-scheiding; pas je ze aan, valideer dan
opnieuw.

## Werkende pagina's

Op dit moment zijn alleen **Dashboard** en **Beheersmaatregelen** actief.
Beleid, Risico's en Rapportages staan in het menu maar zijn uitgeschakeld tot de
bronsheet die koppelingen levert.
