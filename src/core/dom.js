/**
 * Minimal DOM helpers. No framework, no build step — but enough structure
 * that views stay declarative and readable.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * el('div.card', { onclick }, [child, 'text'])
 * Tag syntax: 'tag.class1.class2' — tag defaults to 'div'.
 */
export function el(spec, props = null, children = null) {
  // Allow el('div', [children]) — skip the props argument.
  if (Array.isArray(props) || typeof props === 'string' || props instanceof Node) {
    children = props;
    props = null;
  }

  const [tagPart, ...classes] = String(spec).split('.');
  const node = document.createElement(tagPart || 'div');
  if (classes.length) node.className = classes.join(' ');

  applyProps(node, props);
  append(node, children);
  return node;
}

/** Same as el(), for SVG elements (which need the namespace). */
export function svg(spec, props = null, children = null) {
  if (Array.isArray(props) || typeof props === 'string' || props instanceof Node) {
    children = props;
    props = null;
  }
  const [tagPart, ...classes] = String(spec).split('.');
  const node = document.createElementNS(SVG_NS, tagPart);
  if (classes.length) node.setAttribute('class', classes.join(' '));

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else {
      node.setAttribute(key, value);
    }
  }
  append(node, children);
  return node;
}

function applyProps(node, props) {
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;

    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key in node && key !== 'list' && key !== 'type') {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? '' : value);
    }
  }
}

function append(node, children) {
  if (children == null) return;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replace every child of `target` with `children`. */
export function mount(target, children) {
  target.replaceChildren();
  append(target, children);
  return target;
}

export const $ = (selector, scope = document) => scope.querySelector(selector);

/* ------------------------------------------------------------------
   Focus preservation. Views re-render wholesale on every state change,
   which would otherwise blur the field you are typing in. Any control
   that must survive a re-render gets a stable `data-focus-id`.
   ------------------------------------------------------------------ */

export function captureFocus() {
  const active = document.activeElement;
  const id = active?.dataset?.focusId;
  if (!id) return null;

  let start = null;
  let end = null;
  try { start = active.selectionStart; end = active.selectionEnd; } catch { /* unsupported input type */ }
  return { id, start, end };
}

export function restoreFocus(snapshot) {
  if (!snapshot) return;
  const node = document.querySelector(`[data-focus-id="${snapshot.id}"]`);
  if (!node) return;

  node.focus({ preventScroll: true });
  if (snapshot.start != null && typeof node.setSelectionRange === 'function') {
    try { node.setSelectionRange(snapshot.start, snapshot.end); } catch { /* ignore */ }
  }
}
