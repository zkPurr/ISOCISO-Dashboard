/** One shared tooltip element for every chart on the page. */

let node = null;

function ensure() {
  if (!node) node = document.getElementById('viz-tooltip');
  return node;
}

export function showTooltip(event, html) {
  const tip = ensure();
  if (!tip) return;
  tip.innerHTML = html;
  tip.hidden = false;
  moveTooltip(event);
}

export function moveTooltip(event) {
  const tip = ensure();
  if (!tip || tip.hidden) return;
  const pad = 8;
  const width = tip.offsetWidth;
  const x = Math.min(Math.max(event.clientX, width / 2 + pad), window.innerWidth - width / 2 - pad);
  tip.style.left = `${x}px`;
  tip.style.top = `${event.clientY}px`;
}

export function hideTooltip() {
  const tip = ensure();
  if (tip) tip.hidden = true;
}

/**
 * Attaches the standard hover layer to a mark.
 * @param {Element} mark
 * @param {() => string} render  Tooltip body (HTML string).
 */
export function attachTooltip(mark, render) {
  mark.addEventListener('pointerenter', (e) => showTooltip(e, render()));
  mark.addEventListener('pointermove', moveTooltip);
  mark.addEventListener('pointerleave', hideTooltip);
}
