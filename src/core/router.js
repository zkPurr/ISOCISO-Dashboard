/**
 * Hash router. Hash-based on purpose: it works on Netlify / Cloudflare Pages
 * with zero redirect configuration.
 */

let routes = {};
let fallback = null;
let onChange = () => {};

export function defineRoutes(map, { notFound, onNavigate } = {}) {
  routes = map;
  fallback = notFound || null;
  if (onNavigate) onChange = onNavigate;
}

export function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
  return raw || 'dashboard';
}

export function navigate(route) {
  if (currentRoute() === route) return;
  location.hash = `#/${route}`;
}

export function resolve() {
  const name = currentRoute();
  const view = routes[name] || fallback;
  onChange(name, view);
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  if (!location.hash) location.replace('#/dashboard');
  resolve();
}
