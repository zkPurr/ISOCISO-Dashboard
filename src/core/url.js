/**
 * URL handling for links that come out of a spreadsheet.
 *
 * Sheet cells are the wildest input this app accepts: empty, "zie SharePoint",
 * a bare domain, a network path, an e-mail address, or an Excel hyperlink whose
 * visible text says something else entirely. Everything funnels through
 * toLink(), so a bad cell degrades to plain text with an explanation instead of
 * a broken — or dangerous — anchor.
 */

/** Anything outside this list never becomes an href. Keeps `javascript:` out. */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/** Bare domains: needs an alphabetic TLD, so "5.1" is not mistaken for a host. */
const DOMAINISH = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([/?#].*)?$/i;
const EMAILISH = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const LOCAL_PATH = /^(file:|[a-z]:[\\/]|\\\\|\.{1,2}[\\/])/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Why a cell did not become a link — shown in a tooltip, in Dutch. */
export const LINK_REASONS = {
  empty: 'Geen link opgegeven in de bronsheet',
  local: 'Lokaal pad of netwerkschijf — een browser kan dit niet openen',
  scheme: 'Niet-ondersteund linktype — alleen http, https en mailto',
  invalid: 'Geen geldige URL',
};

/**
 * @typedef {Object} Link
 * @property {boolean}     ok      Safe to render as an anchor
 * @property {string|null} href    Normalised absolute URL, or null
 * @property {string}      raw     The cell text exactly as it came in
 * @property {string|null} reason  Key into LINK_REASONS when !ok
 */

const fail = (raw, reason) => ({ ok: false, href: null, raw, reason });

/**
 * @param {unknown} raw Cell text or an Excel hyperlink target
 * @returns {Link}
 */
export function toLink(raw) {
  const text = String(raw ?? '').trim().replace(/^["']|["']$/g, '');
  if (!text) return fail('', 'empty');
  if (LOCAL_PATH.test(text)) return fail(text, 'local');

  let candidate = text;
  if (!HAS_SCHEME.test(candidate)) {
    if (/^www\./i.test(candidate) || DOMAINISH.test(candidate)) candidate = `https://${candidate}`;
    else if (EMAILISH.test(candidate)) candidate = `mailto:${candidate}`;
    else return fail(text, 'invalid');
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return fail(text, 'invalid');
  }
  if (!SAFE_SCHEMES.has(url.protocol)) return fail(text, 'scheme');

  return { ok: true, href: url.href, raw: text, reason: null };
}

/** Picks the better of two candidate links — a valid one always wins. */
export function bestLink(a, b) {
  if (a.ok) return a;
  if (b.ok) return b;
  return a.raw ? a : b;
}

/** "https://intranet.example.com/isms/beleid.pdf" -> "intranet.example.com/isms/beleid.pdf" */
export function shortUrl(href) {
  try {
    const url = new URL(href);
    if (url.protocol === 'mailto:') return url.pathname;
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${url.host}${path}${url.search}`;
  } catch {
    return String(href ?? '');
  }
}
