// Server-side usage counting. No client JavaScript, no cookies, no consent banner.
//
// WHY THIS SHAPE. The site is a Worker serving static assets, so every request already
// passes through Cloudflare's edge; this adds one write per request to Workers Analytics
// Engine and changes nothing else. The alternative, a client-side beacon, would need
// JavaScript to run (so it misses every crawler and every reader with JS off), would not
// see /catalogue.json at all because a file download is not a page view, and would put a
// third-party script on a site that currently has none.
//
// WHAT IS RECORDED, and it is deliberately the least that answers the question:
//   * the path, so "which solutions get read" is answerable
//   * the language, the kind of page, and the response status
//   * the country Cloudflare already knows, at country granularity
//   * the REFERRER'S HOSTNAME only, never the full referring URL
// WHAT IS NOT RECORDED: no IP address, no user agent, no cookie, no identifier of any
// kind, nothing that could distinguish one reader from another or link two requests
// together. These are counts of pages, not visits by people. That is the constraint the
// backlog set on 2026-08-19 and it is what keeps this side of a consent banner.
//
// The write is fire-and-forget inside a try/catch and happens AFTER the response is in
// hand: if Analytics Engine is unavailable, misconfigured, or the binding is missing, the
// reader still gets their page. Counting must never be able to take the site down.

/** Which of the site's three kinds of thing was asked for. Low cardinality on purpose:
 *  this is the Analytics Engine INDEX, which is what sampling groups by, so it must be a
 *  handful of values rather than a URL. */
function kindOf(pathname) {
  if (pathname === '/catalogue.json') return 'catalogue-json'
  if (pathname === '/llms.txt' || pathname === '/sitemap.xml' || pathname === '/robots.txt') return 'machine-file'
  if (/^\/(en|fr)(\/|$)/.test(pathname)) return 'page'
  return 'other'
}

/** The reading language from the path, since the URL carries it (router.js). */
function langOf(pathname) {
  const m = pathname.match(/^\/(en|fr)(?:\/|$)/)
  return m ? m[1] : ''
}

/** Hostname of the referrer, or ''. Never the path or the query: a full referring URL can
 *  carry a search term somebody typed on another site, which is exactly the kind of thing
 *  this is not here to collect. */
function referrerHost(request) {
  const raw = request.headers.get('referer')
  if (!raw) return ''
  try {
    const h = new URL(raw).hostname
    return h === new URL(request.url).hostname ? '' : h   // in-site navigation is not a referral
  } catch {
    return ''
  }
}

export default {
  async fetch(request, env) {
    // Assets first: whatever happens below, this is what the reader gets.
    const response = await env.ASSETS.fetch(request)

    try {
      if (env.USAGE && request.method === 'GET') {
        const url = new URL(request.url)
        const path = url.pathname
        const kind = kindOf(path)
        env.USAGE.writeDataPoint({
          // ONE index, and it must stay low-cardinality. Filtering by kind is what
          // separates "how many people read solution pages" from "how many took the
          // dataset", which is the question actually being asked.
          indexes: [kind],
          blobs: [
            path.slice(0, 200),
            langOf(path),
            kind,
            String(response.status),
            (request.cf && request.cf.country) || '',
            referrerHost(request),
          ],
          // A count of one. Sums in the query, and leaves room for a duration or a size
          // later without changing the schema shape.
          doubles: [1],
        })
      }
    } catch (err) {
      // Deliberately swallowed. A counting failure is not a serving failure.
      console.log('usage write failed:', err && err.message)
    }

    return response
  },
}
