/**
 * Maturiteitsrapport as a PDF — drawn with jsPDF primitives (rects + text), so
 * the output is vector, prints sharp and does not depend on how the page
 * happens to be laid out on screen. Every number comes from data/maturity.js,
 * the same functions the Maturiteit page uses.
 *
 * jsPDF is loaded on demand, like SheetJS: only an actual export pays for it.
 */

import {
  MATURITY_LEVELS, MATURITY_UNSCORED, MATURITY_DIMENSIONS, MATURITY_PASS_THRESHOLD, maturityLevel,
} from '../data/schema.js';
import {
  SCORE_SERIES, distribution, distributionByDomain, averageMatrix, groupByDomain,
  maturityKpis, weakestControls, formatAvg, scoreOf, shortControlLabel, isOverride,
} from '../data/maturity.js';
import { compareControlId, dateTime, pct } from '../core/format.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
let jspdfPromise = null;

function loadJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jspdfPromise) {
    jspdfPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = JSPDF_URL;
      script.async = true;
      script.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF niet gevonden')));
      script.onerror = () => {
        script.remove();
        jspdfPromise = null; // a retry after a dropped connection actually retries
        reject(new Error('Kon de PDF-bibliotheek niet laden. Controleer je internetverbinding en probeer opnieuw.'));
      };
      document.head.append(script);
    });
  }
  return jspdfPromise;
}

/* ------------------------------------------------------------------ Page geometry (mm, A4 landscape) */

const PAGE_W = 297;
const PAGE_H = 210;
const M = 12;                 // margin
const CONTENT_W = PAGE_W - M * 2;
const TOP = 24;               // below the running header
const BOTTOM = PAGE_H - 12;   // above the footer

const INK = '#0f172a';
const INK_2 = '#52596b';
const INK_3 = '#8a91a3';
const RULE = '#e6e9f0';
const PLANE = '#f4f6fa';
const BRAND = '#2563eb';

const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** The built-in PDF fonts are WinAnsi: anything outside it would print as garbage. */
const safe = (value) => String(value ?? '')
  .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2022\u2026\u20AC]/g, '?');

/* ------------------------------------------------------------------ Drawing helpers */

function painter(doc) {
  const fill = (hex) => doc.setFillColor(...rgb(hex));
  const color = (hex) => doc.setTextColor(...rgb(hex));
  const font = (size, style = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size); };

  /** Text clipped with an ellipsis to `maxW`. */
  const fit = (text, maxW) => {
    let out = safe(text);
    if (doc.getTextWidth(out) <= maxW) return out;
    while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxW) out = out.slice(0, -1);
    return `${out.trimEnd()}…`;
  };

  const text = (value, x, y, opts = {}) => doc.text(safe(value), x, y, { baseline: 'middle', ...opts });
  const box = (x, y, w, h, hex, r = 0) => {
    fill(hex);
    if (r) doc.roundedRect(x, y, w, h, r, r, 'F');
    else doc.rect(x, y, w, h, 'F');
  };
  const rule = (x1, y1, x2, y2, hex = RULE, width = 0.2) => {
    doc.setDrawColor(...rgb(hex));
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
  };

  return { fill, color, font, fit, text, box, rule };
}

/* ------------------------------------------------------------------ Sections */

function sectionTitle(p, title, y, aside) {
  p.font(11.5, 'bold'); p.color(INK);
  p.text(title, M, y);
  if (aside) {
    p.font(8); p.color(INK_3);
    p.text(aside, PAGE_W - M, y, { align: 'right' });
  }
  return y + 6;
}

function legend(p, doc, x, y, { withUnscored = true } = {}) {
  p.font(7.5);
  const items = [...MATURITY_LEVELS, ...(withUnscored ? [MATURITY_UNSCORED] : [])];
  let cx = x;
  for (const item of items) {
    const label = item.level != null ? `${item.level} ${item.name}` : item.name;
    p.box(cx, y - 1.6, 3.2, 3.2, item.color, 0.6);
    p.color(INK_2);
    p.text(label, cx + 4.4, y);
    cx += 4.4 + doc.getTextWidth(safe(label)) + 5;
  }
  return cx;
}

function kpiTiles(p, kpis, y) {
  const { total } = kpis;
  const tiles = [
    { value: `${formatAvg(kpis.avg)} / 5`, label: 'Gemiddelde maturiteit',
      foot: kpis.avg == null ? 'Nog niets beoordeeld' : maturityLevel(Math.floor(kpis.avg)).name },
    { value: String(kpis.atTarget), label: `Op of boven niveau ${MATURITY_PASS_THRESHOLD}`, foot: `${pct(kpis.atTarget, total)}% van alle controls`, accent: '#0ca30c' },
    { value: String(kpis.belowTarget), label: `Onder niveau ${MATURITY_PASS_THRESHOLD}`, foot: `${pct(kpis.belowTarget, total)}% van alle controls`, accent: '#d03b3b' },
    { value: String(kpis.notPerformed), label: 'Niet uitgevoerd (0)', foot: 'op score of een dimensie', accent: MATURITY_LEVELS[0].color },
    { value: kpis.weakest?.label ?? '—', label: 'Zwakste dimensie', foot: kpis.weakest ? `gem. ${formatAvg(kpis.weakest.avg)}` : 'geen dimensiescores' },
    { value: `${pct(kpis.fullyAssessed, total)}%`, label: 'Volledig beoordeeld', foot: `${kpis.fullyAssessed} van ${total} controls` },
    { value: String(kpis.unbalanced), label: 'Onevenwichtig', foot: '>= 2 niveaus verschil' },
  ];
  const gap = 3;
  const w = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  const h = 24;

  tiles.forEach((tile, i) => {
    const x = M + i * (w + gap);
    p.box(x, y, w, h, PLANE, 1.5);
    p.box(x, y + h - 0.8, w, 0.8, tile.accent || RULE);
    p.font(15, 'bold'); p.color(INK);
    p.text(p.fit(tile.value, w - 6), x + 3, y + 7);
    p.font(7.5, 'bold'); p.color(INK_2);
    p.text(p.fit(tile.label, w - 6), x + 3, y + 14);
    p.font(7); p.color(INK_3);
    p.text(p.fit(tile.foot, w - 6), x + 3, y + 19);
  });
  return y + h;
}

/** One long 100%-stacked bar of levels. */
function levelBar(p, dist, { x, y, w, labelW, label, sub, h = 7 }) {
  p.font(8.5, 'bold'); p.color(INK);
  p.text(p.fit(label, labelW - 2), x, y + h / 2 - (sub ? 1.6 : 0));
  if (sub) { p.font(6.5); p.color(INK_3); p.text(p.fit(sub, labelW - 2), x, y + h / 2 + 2.2); }

  const bx = x + labelW;
  const bw = w - labelW;
  if (!dist.total) { p.box(bx, y, bw, h, MATURITY_UNSCORED.color, 1); return; }

  const segments = [
    ...MATURITY_LEVELS.map((level) => ({ ...level, value: dist.counts[level.level] })),
    { ...MATURITY_UNSCORED, value: dist.unscored },
  ].filter((s) => s.value > 0);

  const gap = 0.5;
  const usable = bw - gap * (segments.length - 1);
  let cx = bx;
  for (const segment of segments) {
    const sw = (segment.value / dist.total) * usable;
    p.box(cx, y, sw, h, segment.color);
    const share = pct(segment.value, dist.total);
    p.font(7, 'bold');
    if (sw >= 9) {
      p.color(segment.ink);
      p.text(`${share}%`, cx + sw / 2, y + h / 2, { align: 'center' });
    }
    cx += sw + gap;
  }
}

function averageMatrix_(p, matrix, { x, y, w }) {
  const cols = ['Domein', 'Controls', ...SCORE_SERIES.map((s) => (s.key === 'maturity' ? 'Score (min)' : s.label))];
  const firstW = w * 0.3;
  const restW = (w - firstW) / (cols.length - 1);
  const rowH = 6.4;

  p.box(x, y, w, rowH, PLANE);
  p.font(7.5, 'bold'); p.color(INK_2);
  cols.forEach((label, i) => {
    const cx = i === 0 ? x + 2 : x + firstW + restW * (i - 1) + restW / 2;
    p.text(label, cx, y + rowH / 2, { align: i === 0 ? 'left' : 'center' });
  });
  let cy = y + rowH;

  for (const row of matrix) {
    const isTotal = row.label === 'Totaal';
    if (isTotal) p.box(x, cy, w, rowH, PLANE);
    p.font(8, isTotal ? 'bold' : 'normal'); p.color(INK);
    p.text(p.fit(row.label, firstW - 4), x + 2, cy + rowH / 2);
    p.text(String(row.count), x + firstW + restW / 2, cy + rowH / 2, { align: 'center' });
    row.values.forEach((value, i) => {
      const cx = x + firstW + restW * (i + 1);
      if (value == null) { p.color(INK_3); p.text('—', cx + restW / 2, cy + rowH / 2, { align: 'center' }); return; }
      const level = maturityLevel(Math.floor(value));
      p.box(cx + restW / 2 - 6, cy + 1, 12, rowH - 2, level.color, 0.8);
      p.font(7.5, 'bold'); p.color(level.ink);
      p.text(formatAvg(value), cx + restW / 2, cy + rowH / 2, { align: 'center' });
    });
    p.rule(x, cy + rowH, x + w, cy + rowH);
    cy += rowH;
  }
  return cy;
}

function heatmaps(p, doc, controls, y) {
  const groups = groupByDomain(controls);
  const labelW = 18;
  const longest = Math.max(...groups.map((g) => g.controls.length), 1);
  const pitch = Math.min(8, (CONTENT_W - labelW) / longest);
  const cellW = pitch - 0.6;
  const mainH = 6.5;
  const dimH = 2.8;

  for (const group of groups) {
    const blockH = 6 + mainH + (dimH + 0.6) * MATURITY_DIMENSIONS.length + 5;
    if (y + blockH > BOTTOM) { doc.addPage(); y = TOP; }

    const dist = distribution(group.controls);
    const atTarget = dist.counts.slice(MATURITY_PASS_THRESHOLD).reduce((a, b) => a + b, 0);
    p.font(9, 'bold'); p.color(INK);
    p.text(group.domain, M, y);
    const headW = doc.getTextWidth(safe(group.domain));
    p.font(7.5); p.color(INK_3);
    p.text(`${group.controls.length} controls · gem. ${formatAvg(dist.avg)} · ${pct(atTarget, dist.total)}% op niveau >= ${MATURITY_PASS_THRESHOLD}`, M + headW + 3, y);
    y += 4;

    SCORE_SERIES.forEach(({ key, label }, row) => {
      const isMain = key === 'maturity';
      const h = isMain ? mainH : dimH;
      p.font(isMain ? 7.5 : 6.5, isMain ? 'bold' : 'normal'); p.color(isMain ? INK : INK_2);
      p.text(label, M + labelW - 2, y + h / 2, { align: 'right' });

      group.controls.forEach((control, i) => {
        const score = scoreOf(control, key);
        const level = maturityLevel(score);
        const cx = M + labelW + i * pitch;
        p.box(cx, y, cellW, h, level.color, 0.6);
        if (isMain) {
          p.font(cellW < 5 ? 5.5 : 6.5, 'bold'); p.color(level.ink);
          p.text(shortControlLabel(control.id), cx + cellW / 2, y + h / 2, { align: 'center' });
        }
      });
      y += h + (row === 0 ? 0.9 : 0.6);
    });
    y += 4;
  }
  return y;
}

const MODEL_LABEL_W = 22;
const MODEL_COL_W = (CONTENT_W - MODEL_LABEL_W) / MATURITY_LEVELS.length;
const MODEL_HEAD_H = 7;

/** Wrapped cell text and row height per dimension, so the table can be measured before drawing. */
function modelRows(p, doc) {
  p.font(7);
  return MATURITY_DIMENSIONS.map((dimension) => {
    const lines = dimension.levels.map((t) => doc.splitTextToSize(safe(t), MODEL_COL_W - 4));
    return { dimension, lines, rowH: Math.max(...lines.map((l) => l.length)) * 3.2 + 3 };
  });
}

const modelHeight = (p, doc) => MODEL_HEAD_H + modelRows(p, doc).reduce((sum, r) => sum + r.rowH, 0);

function modelTable(p, doc, y) {
  const labelW = MODEL_LABEL_W;
  const colW = MODEL_COL_W;
  const headH = MODEL_HEAD_H;

  p.box(M, y, CONTENT_W, headH, PLANE);
  MATURITY_LEVELS.forEach((level, i) => {
    const cx = M + labelW + i * colW;
    p.box(cx + 2, y + 1.5, 5, 4, level.color, 0.6);
    p.font(7, 'bold'); p.color(level.ink); p.text(String(level.level), cx + 4.5, y + headH / 2, { align: 'center' });
    p.color(INK); p.font(7.5, 'bold'); p.text(level.name, cx + 9, y + headH / 2);
  });
  y += headH;

  for (const { dimension, lines, rowH } of modelRows(p, doc)) {
    p.font(8, 'bold'); p.color(INK);
    p.text(dimension.label, M + 2, y + rowH / 2);
    p.font(7); p.color(INK_2);
    lines.forEach((l, i) => doc.text(l, M + labelW + i * colW + 2, y + 3.2, { baseline: 'middle' }));
    p.rule(M, y + rowH, M + CONTENT_W, y + rowH);
    y += rowH;
  }
  return y;
}

/** A table that breaks across pages and repeats its header. */
function controlTable(p, doc, rows, y, { title }) {
  const cols = [
    { label: 'Control', w: 16, get: (c) => c.id, bold: true },
    { label: 'Beschrijving', w: 108, get: (c) => `${c.title || '—'}${isOverride(c) ? ' (score handmatig)' : ''}` },
    { label: 'Domein', w: 30, get: (c) => c.domain },
    { label: 'Eigenaar', w: 44, get: (c) => c.owner || '—' },
    ...SCORE_SERIES.map((s) => ({ label: s.key === 'maturity' ? 'Score' : s.label, w: 18.75, score: s.key })),
  ];
  const rowH = 5.6;

  const header = () => {
    p.box(M, y, CONTENT_W, rowH + 0.6, PLANE);
    p.font(7.5, 'bold'); p.color(INK_2);
    let cx = M;
    for (const col of cols) {
      p.text(col.label, col.score ? cx + col.w / 2 : cx + 2, y + (rowH + 0.6) / 2, { align: col.score ? 'center' : 'left' });
      cx += col.w;
    }
    y += rowH + 0.6;
  };

  if (y + 6 + rowH * 3 > BOTTOM) { doc.addPage(); y = TOP; }
  y = sectionTitle(p, title, y);
  header();

  for (const control of rows) {
    if (y + rowH > BOTTOM) { doc.addPage(); y = TOP; header(); }
    let cx = M;
    for (const col of cols) {
      if (col.score) {
        const score = scoreOf(control, col.score);
        const level = maturityLevel(score);
        p.box(cx + col.w / 2 - 4.5, y + 0.8, 9, rowH - 1.6, level.color, 0.6);
        p.font(7, 'bold'); p.color(level.ink);
        p.text(score == null ? '—' : String(score), cx + col.w / 2, y + rowH / 2, { align: 'center' });
      } else {
        p.font(7.5, col.bold ? 'bold' : 'normal'); p.color(INK);
        p.text(p.fit(col.get(control), col.w - 4), cx + 2, y + rowH / 2);
      }
      cx += col.w;
    }
    p.rule(M, y + rowH, M + CONTENT_W, y + rowH);
    y += rowH;
  }
  return y + 6;
}

function runningHeadersAndFooters(p, doc, { subtitle, generated }) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    p.box(0, 0, PAGE_W, 3, BRAND);
    p.font(13, 'bold'); p.color(INK);
    p.text('ISMS Maturiteitsrapport', M, 12);
    p.font(8); p.color(INK_3);
    p.text(subtitle, M, 17.5);
    p.text(`Gegenereerd ${generated}`, PAGE_W - M, 12, { align: 'right' });
    p.rule(M, PAGE_H - 9, PAGE_W - M, PAGE_H - 9);
    p.font(7); p.color(INK_3);
    p.text('ISOCISO Dashboard · ISO/IEC 27002:2022 maturiteit (Proces · Beleid · Evidence)', M, PAGE_H - 6);
    p.text(`Pagina ${i} van ${pages}`, PAGE_W - M, PAGE_H - 6, { align: 'right' });
  }
}

/* ------------------------------------------------------------------ Entry point */

/**
 * Builds the report and hands it to the browser as a download.
 * @param {import('../data/schema.js').Control[]} controls
 * @param {object|null} source  state.source — file name and import time
 */
export async function exportMaturityPdf(controls, source) {
  if (!controls.length) throw new Error('Er zijn geen controls om te exporteren.');
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const p = painter(doc);
  const now = new Date();

  const kpis = maturityKpis(controls);
  const subtitle = source
    ? `${source.fileName} · ingelezen ${dateTime(source.importedAt)} · ${controls.length} controls`
    : `${controls.length} controls`;

  doc.setProperties({ title: 'ISMS Maturiteitsrapport', subject: subtitle, creator: 'ISOCISO Dashboard' });

  /* Page 1 — headline numbers and distributions */
  let y = TOP + 2;
  y = kpiTiles(p, kpis, y) + 9;

  y = sectionTitle(p, 'Maturiteitsniveaus per domein', y, '% van de controls per niveau');
  legend(p, doc, M, y);
  y += 5;
  const barOpts = { x: M, w: CONTENT_W, labelW: 46 };
  levelBar(p, distribution(controls), { ...barOpts, y, label: 'Alle controls', sub: `${controls.length} controls · gem. ${formatAvg(kpis.avg)}` });
  y += 10.5;
  for (const row of distributionByDomain(controls)) {
    levelBar(p, row, { ...barOpts, y, label: row.domain, sub: `${row.total} controls · gem. ${formatAvg(row.avg)}` });
    y += 9.5;
  }
  y += 5;

  const colGap = 10;
  const leftW = (CONTENT_W - colGap) * 0.52;
  const rightX = M + leftW + colGap;
  const rightW = CONTENT_W - leftW - colGap;

  if (y + 50 > BOTTOM) { doc.addPage(); y = TOP; }
  sectionTitle(p, 'Niveaus per dimensie', y);
  p.font(11.5, 'bold'); p.color(INK);
  p.text('Gemiddelde per domein en dimensie', rightX, y);
  y += 6;
  let ly = y;
  for (const { key, label } of SCORE_SERIES) {
    const dist = distribution(controls, key);
    levelBar(p, dist, { x: M, y: ly, w: leftW, labelW: 30, h: 6.5,
      label: key === 'maturity' ? 'Score (min)' : label, sub: `gem. ${formatAvg(dist.avg)}` });
    ly += 9;
  }
  averageMatrix_(p, averageMatrix(controls), { x: rightX, y, w: rightW });

  /* Page 2 — heatmap per control and the model it scores against */
  doc.addPage();
  y = TOP + 2;
  y = sectionTitle(p, 'Heatmap per control', y, 'Bovenste rij: score (min) met controlnummer · daaronder Proces, Beleid, Evidence');
  legend(p, doc, M, y);
  y = heatmaps(p, doc, controls, y + 7);

  if (y + 6 + modelHeight(p, doc) > BOTTOM) { doc.addPage(); y = TOP + 2; }
  y = sectionTitle(p, 'Maturiteitsmodel', y);
  modelTable(p, doc, y);

  /* Page 3+ — the controls behind the numbers */
  doc.addPage();
  y = TOP + 2;
  const weakest = weakestControls(controls, 15);
  if (weakest.length) {
    y = controlTable(p, doc, weakest, y, { title: `Aandachtspunten — ${weakest.length} laagste scores onder niveau ${MATURITY_PASS_THRESHOLD}` });
  }
  const all = [...controls].sort((a, b) => compareControlId(a.id, b.id));
  controlTable(p, doc, all, y, { title: `Alle controls (${all.length})` });

  runningHeadersAndFooters(p, doc, {
    subtitle,
    generated: now.toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  });

  const stamp = now.toISOString().slice(0, 10);
  doc.save(`ISMS-maturiteit-${stamp}.pdf`);
}
