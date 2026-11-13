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
import { compareControlId, pct } from '../core/format.js';
import { ADVICE, controlAdvice } from '../data/advice.js';

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

/* ------------------------------------------------------------------ Pies */

/** Filled annular sector as a polygon — jsPDF has no arc primitive. */
function sector(doc, cx, cy, r0, r1, a0, a1) {
  const steps = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 72));
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps - Math.PI / 2;
    pts.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)]);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const a = a0 + ((a1 - a0) * i) / steps - Math.PI / 2;
    pts.push([cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)]);
  }
  const deltas = pts.slice(1).map(([x, y], i) => [x - pts[i][0], y - pts[i][1]]);
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true);
}

function donut(p, doc, dist, { cx, cy, r }) {
  const segments = [
    ...MATURITY_LEVELS.map((level) => ({ ...level, value: dist.counts[level.level] })),
    { ...MATURITY_UNSCORED, value: dist.unscored },
  ].filter((s) => s.value > 0);
  const inner = r * 0.62;
  const gap = segments.length > 1 ? 0.6 / ((r + inner) / 2) : 0;

  if (!dist.total) {
    p.fill(MATURITY_UNSCORED.color); sector(doc, cx, cy, inner, r, 0, Math.PI * 2 - 0.001);
  } else {
    let cursor = 0;
    for (const segment of segments) {
      const sweep = (segment.value / dist.total) * Math.PI * 2;
      const a0 = cursor + gap / 2;
      const a1 = cursor + sweep - gap / 2;
      cursor += sweep;
      if (a1 <= a0) continue;
      p.fill(segment.color);
      sector(doc, cx, cy, inner, r, a0, Math.min(a1, a0 + Math.PI * 2 - 0.001));
      // Percentage on the slice itself when the slice is big enough to hold it.
      const share = pct(segment.value, dist.total);
      if (share >= 9) {
        const mid = (a0 + a1) / 2 - Math.PI / 2;
        const lr = (r + inner) / 2;
        p.font(6, 'bold'); p.color(segment.ink);
        p.text(`${share}%`, cx + lr * Math.cos(mid), cy + lr * Math.sin(mid), { align: 'center' });
      }
    }
  }
  p.font(10, 'bold'); p.color(INK);
  p.text(formatAvg(dist.avg), cx, cy - 1, { align: 'center' });
  p.font(5.5); p.color(INK_3);
  p.text('gem.', cx, cy + 3, { align: 'center' });
}

/** Matrix of pies: one row per series (Score, Proces, Beleid, Evidence), one column per domain. */
function pieMatrix(p, doc, controls, y) {
  const columns = [{ domain: 'Alle controls', controls }, ...groupByDomain(controls)];
  const labelW = 26;
  const colW = (CONTENT_W - labelW) / columns.length;
  const rowH = 38;
  const r = 14;

  p.font(8.5, 'bold'); p.color(INK);
  columns.forEach((col, i) => p.text(col.domain, M + labelW + colW * i + colW / 2, y, { align: 'center' }));
  y += 4;

  for (const { key, label } of SCORE_SERIES) {
    p.font(8.5, 'bold'); p.color(INK);
    p.text(key === 'maturity' ? 'Score (min)' : label, M, y + rowH / 2 - 2);
    columns.forEach((col, i) => {
      const dist = distribution(col.controls, key);
      const cx = M + labelW + colW * i + colW / 2;
      donut(p, doc, dist, { cx, cy: y + r + 2, r });
      const atTarget = dist.counts.slice(MATURITY_PASS_THRESHOLD).reduce((a, b) => a + b, 0);
      p.font(6.5); p.color(INK_2);
      p.text(`${pct(atTarget, dist.total)}% op niveau >= ${MATURITY_PASS_THRESHOLD}`, cx, y + r * 2 + 6, { align: 'center' });
    });
    p.rule(M, y + rowH - 1, M + CONTENT_W, y + rowH - 1);
    y += rowH;
  }
  return y;
}

/* ------------------------------------------------------------------ Groeipad + actieplan */

/** One dimension's five steps as a staircase of columns. */
function growthRow(p, doc, dimension, controls, y) {
  const dist = distribution(controls, dimension.key);
  const gap = 3;
  const colW = (CONTENT_W - gap * 4) / 5;
  const pad = 2.5;
  const lineH = 2.9;

  // Measure first so the whole row moves to a new page if it doesn't fit.
  const blocks = ADVICE[dimension.key].map((step, from) => {
    p.font(8, 'bold');
    const title = doc.splitTextToSize(safe(step.title), colW - pad * 2);
    p.font(6.8);
    const actions = step.actions.map((a) => doc.splitTextToSize(safe(a), colW - pad * 2 - 3));
    const done = doc.splitTextToSize(safe(`Klaar als: ${step.done}`), colW - pad * 2);
    const h = 8 + title.length * 3.4 + 1.5 + actions.reduce((n, l) => n + l.length, 0) * lineH
      + actions.length * 0.8 + 1.5 + done.length * lineH + 8;
    return { step, from, title, actions, done, h };
  });
  const rise = 3;
  const tallest = Math.max(...blocks.map((b, i) => b.h + (4 - i) * rise));
  if (y + 7 + tallest > BOTTOM) { doc.addPage(); y = TOP + 2; }

  p.font(10, 'bold'); p.color(INK);
  p.text(`${dimension.label}`, M, y);
  p.font(7.5); p.color(INK_3);
  p.text(`gem. ${formatAvg(dist.avg)} · ${dist.scored} van ${dist.total} beoordeeld`, M + doc.getTextWidth(safe(dimension.label)) + 14, y);
  y += 4;

  const baseY = y + tallest;
  blocks.forEach((b, i) => {
    const x = M + i * (colW + gap);
    const top = y + (4 - i) * rise;
    const to = b.from + 1;
    p.box(x, top, colW, baseY - top, PLANE, 1.2);
    p.box(x, top, colW, 1.2, MATURITY_LEVELS[to].color);

    let cy = top + 5;
    const chip = (lvl, cx) => {
      const l = MATURITY_LEVELS[lvl];
      p.box(cx, cy - 2, 5, 4, l.color, 0.6);
      p.font(7, 'bold'); p.color(l.ink); p.text(String(lvl), cx + 2.5, cy, { align: 'center' });
    };
    chip(b.from, x + pad);
    p.font(7, 'bold'); p.color(INK_3); p.text('->', x + pad + 6, cy);
    chip(to, x + pad + 10.5);
    p.font(6.5, 'bold'); p.color(INK_3);
    p.text(MATURITY_LEVELS[to].name.toUpperCase(), x + colW - pad, cy, { align: 'right' });
    cy += 5;

    p.font(8, 'bold'); p.color(INK);
    b.title.forEach((line) => { doc.text(line, x + pad, cy, { baseline: 'middle' }); cy += 3.4; });
    cy += 1.5;

    p.font(6.8); p.color(INK_2);
    for (const lines of b.actions) {
      p.box(x + pad + 0.3, cy - 0.5, 1, 1, INK_3, 0.5);
      lines.forEach((line) => { doc.text(line, x + pad + 3, cy, { baseline: 'middle' }); cy += lineH; });
      cy += 0.8;
    }
    cy += 1.5;
    p.color('#0a7d0a');
    b.done.forEach((line) => { doc.text(line, x + pad, cy, { baseline: 'middle' }); cy += lineH; });

    const waiting = dist.counts[b.from];
    p.font(6.8, 'bold'); p.color(waiting ? BRAND : INK_3);
    p.text(waiting ? `${waiting} ${waiting === 1 ? 'control staat' : 'controls staan'} op ${b.from}` : `Geen controls op ${b.from}`, x + pad, baseY - 3.5);
  });
  return baseY + 8;
}

/** Per weak control: where it stands and the step(s) that raise its score. */
function actionPlan(p, doc, controls, y) {
  const textW = CONTENT_W - 70;
  y = sectionTitle(p, `Actieplan — ${controls.length} controls onder niveau ${MATURITY_PASS_THRESHOLD}, laagste eerst`, y,
    'De score is het minimum: alle beperkende dimensies moeten omhoog');

  for (const control of controls) {
    const advice = controlAdvice(control);
    p.font(7.2);
    const lines = advice.blocking.map((b) => ({
      head: `${b.dimension.label} ${b.from} -> ${b.to}: ${b.step.title}`,
      body: doc.splitTextToSize(safe(`${b.step.actions.join(' ')} Klaar als: ${b.step.done}`), textW),
    }));
    p.font(7.5);
    const titleLines = doc.splitTextToSize(safe(control.title || '—'), 52).slice(0, 2);
    const ownerOffset = 6.2 + titleLines.length * 3.1 + 0.6;
    const h = Math.max(ownerOffset + (control.owner ? 5 : 2), 4 + lines.reduce((n, l) => n + 3.6 + l.body.length * 3 + 1.5, 0));
    if (y + h > BOTTOM) { doc.addPage(); y = TOP + 2; }

    const level = maturityLevel(control.maturity);
    p.box(M, y, 9, 9, level.color, 1);
    p.font(10, 'bold'); p.color(level.ink); p.text(String(control.maturity), M + 4.5, y + 4.5, { align: 'center' });
    p.font(8.5, 'bold'); p.color(INK); p.text(control.id, M + 12, y + 2.5);
    p.font(7.5); p.color(INK_2);
    titleLines.forEach((line, i) => doc.text(line, M + 12, y + 6.2 + i * 3.1, { baseline: 'middle' }));
    if (control.owner) { p.font(6.8); p.color(INK_3); p.text(p.fit(control.owner, 52), M + 12, y + ownerOffset); }

    let cy = y + 2.5;
    const tx = M + 70;
    for (const line of lines) {
      p.font(8, 'bold'); p.color(INK); p.text(line.head, tx, cy);
      cy += 3.6;
      p.font(7.2); p.color(INK_2);
      line.body.forEach((l) => { doc.text(l, tx, cy, { baseline: 'middle' }); cy += 3; });
      cy += 1.5;
    }
    y += h + 2;
    p.rule(M, y - 2, M + CONTENT_W, y - 2);
  }
  return y + 4;
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
    p.text('ISO/IEC 27002:2022 maturiteit (Proces · Beleid · Evidence)', M, PAGE_H - 6);
    p.text(`Pagina ${i} van ${pages}`, PAGE_W - M, PAGE_H - 6, { align: 'right' });
  }
}

/* ------------------------------------------------------------------ Entry point */

/**
 * Builds the report and hands it to the browser as a download.
 * @param {import('../data/schema.js').Control[]} controls
 */
export async function exportMaturityPdf(controls) {
  if (!controls.length) throw new Error('Er zijn geen controls om te exporteren.');
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const p = painter(doc);
  const now = new Date();

  const kpis = maturityKpis(controls);
  const subtitle = `${controls.length} controls`;

  doc.setProperties({ title: 'ISMS Maturiteitsrapport', subject: subtitle });

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

  /* Page 2 — pies: every series per domain */
  doc.addPage();
  y = sectionTitle(p, 'Verdeling per domein — taartdiagrammen', TOP + 2, 'Midden: gemiddelde · rij per score/dimensie, kolom per domein');
  legend(p, doc, M, y);
  pieMatrix(p, doc, controls, y + 8);

  /* Page 3 — heatmap per control and the model it scores against */
  doc.addPage();
  y = TOP + 2;
  y = sectionTitle(p, 'Heatmap per control', y, 'Bovenste rij: score (min) met controlnummer · daaronder Proces, Beleid, Evidence');
  legend(p, doc, M, y);
  y = heatmaps(p, doc, controls, y + 7);

  if (y + 6 + modelHeight(p, doc) > BOTTOM) { doc.addPage(); y = TOP + 2; }
  y = sectionTitle(p, 'Maturiteitsmodel', y);
  modelTable(p, doc, y);

  /* Groeipad — what each step up means, per dimension */
  doc.addPage();
  y = sectionTitle(p, 'Groeipad — wat is er nodig voor het volgende niveau', TOP + 2, 'Per dimensie: acties en wanneer het niveau bereikt is');
  y += 2;
  for (const dimension of MATURITY_DIMENSIONS) y = growthRow(p, doc, dimension, controls, y);

  /* Actieplan + the controls behind the numbers */
  doc.addPage();
  y = TOP + 2;
  const weakest = weakestControls(controls, 15);
  if (weakest.length) y = actionPlan(p, doc, weakest, y);
  const all = [...controls].sort((a, b) => compareControlId(a.id, b.id));
  controlTable(p, doc, all, y, { title: `Alle controls (${all.length})` });

  runningHeadersAndFooters(p, doc, {
    subtitle,
    generated: now.toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  });

  const stamp = now.toISOString().slice(0, 10);
  doc.save(`ISMS-maturiteit-${stamp}.pdf`);
}
