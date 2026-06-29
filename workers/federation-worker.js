/*
 * Federation worker for a consuming child site.
 *
 * THE ONE JOB: make federated code appear same-origin.
 *   - Any request to /libs/*  -> fetched from the FEDERATED origin (foundation-kit-fed)
 *   - Everything else         -> fetched from THIS site's own origin
 *
 * Because the browser only ever talks to THIS domain, /libs/* is same-origin,
 * so there is NO CORS problem. The cross-origin hop happens server-side here,
 * inside the worker, where CORS rules don't apply.
 *
 * PREVIEW vs LIVE (?env=preview):
 *   By default the SITE content is served from the live tier (.aem.live).
 *   Add ?env=preview to see this site's DRAFT/preview content (.aem.page)
 *   through the worker — so you can preview unpublished pages WITH /libs
 *   working. Absent the param, you get live content.
 *
 * FED-BRANCH TESTING (?fed-ref=):
 *   By default /libs is served from FED's `main`. A federated block engineer
 *   can preview an UNMERGED FED branch against this site by adding
 *   ?fed-ref=<branch> to the URL. e.g. ?fed-ref=update-columns serves /libs
 *   from `update-columns--foundation-kit-fed--angelaccenture.aem.page`.
 *   This lets them see how a change impacts a consuming site BEFORE the PR.
 *   Absent the param, /libs always comes from main (safe for production).
 *
 * To reuse this worker for a NEW consuming site, change the SITE_* constants
 * to that site's repo/owner. The FED_* constants stay the same.
 */

// ---- THIS site (the consuming child) ----
const SITE_REPO = 'foundation-kit-fed-temp';
const SITE_OWNER = 'angelaccenture';
const SITE_BRANCH = 'main';

// ---- The federated project (the "/libs" source) ----
const FED_REPO = 'foundation-kit-fed';
const FED_OWNER = 'angelaccenture';
const FED_DEFAULT_REF = 'main';

// The URL prefix that signals "this is federated code, get it from FED".
const LIBS_PREFIX = '/libs';

// Build an aem origin. live=true -> .aem.live (published), else -> .aem.page (preview).
function aemOrigin(branch, repo, owner, live) {
  return `${branch}--${repo}--${owner}.${live ? 'aem.live' : 'aem.page'}`;
}

// This site's origin. ?env=preview -> draft (.aem.page); default -> live (.aem.live).
function siteOrigin(preview) {
  return aemOrigin(SITE_BRANCH, SITE_REPO, SITE_OWNER, !preview);
}

// FED origin for a given branch ref. main -> .aem.live; other branches -> .aem.page.
function fedOrigin(ref) {
  return aemOrigin(ref, FED_REPO, FED_OWNER, ref === FED_DEFAULT_REF);
}

// Only allow safe branch names (letters, numbers, dot, underscore, hyphen).
// Prevents a param from pointing an origin at somewhere arbitrary.
function safeRef(ref) {
  return ref && /^[\w.-]+$/.test(ref) ? ref : FED_DEFAULT_REF;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ?env=preview -> serve this site's draft content from .aem.page.
    const preview = url.searchParams.get('env') === 'preview';
    // ?fed-ref=<branch> -> serve /libs from that FED branch (default main).
    const fedRef = safeRef(url.searchParams.get('fed-ref'));

    // Decide which origin to fetch from, and what path to use there.
    let origin = siteOrigin(preview);
    let path = url.pathname;

    if (url.pathname === LIBS_PREFIX || url.pathname.startsWith(`${LIBS_PREFIX}/`)) {
      // Federated request: strip the /libs prefix and pull from the chosen FED ref.
      // e.g. /libs/scripts/ak.js  ->  <fedOrigin>/scripts/ak.js
      origin = fedOrigin(fedRef);
      path = url.pathname.slice(LIBS_PREFIX.length) || '/';
    }

    // Build the upstream request to the chosen origin (preserve query string).
    const upstreamUrl = `https://${origin}${path}${url.search}`;
    const upstreamReq = new Request(upstreamUrl, request);

    // AEM expects the original host forwarded so links/canonicals resolve right.
    upstreamReq.headers.set('x-forwarded-host', url.hostname);

    const resp = await fetch(upstreamReq);

    // Return the response as-is. Because it came back through THIS worker on
    // THIS domain, the browser treats it as same-origin -> no CORS.
    return new Response(resp.body, resp);
  },
};
