// Shortening a URL for display. No imports of its own, so scripts/prerender.mjs can import it
// directly and the app and the static page share one copy.

/*
 * A URL shortened for display; the href is always the real thing. Truncated in the middle,
 * keeping the host (who wrote it) and the last path segment (what it is). Derived at render,
 * never stored.
 */
export function displayUrl(url, max = 48) {
  const raw = String(url || '')
  let rest
  try {
    const u = new URL(raw)
    rest = u.host.replace(/^www\./, '') + decodeURI(u.pathname + u.search).replace(/\/$/, '')
  } catch {
    rest = raw.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
  }
  if (rest.length <= max) return rest

  const cut = rest.indexOf('/')
  const host = cut === -1 ? rest : rest.slice(0, cut)
  const tail = cut === -1 ? '' : rest.slice(cut + 1)
  const last = tail.split('/').filter(Boolean).pop() || ''
  // Keep the host whole: a truncated domain says nothing about who wrote the page.
  const room = max - host.length - 3            // 3 for the "/…/" joint
  if (room < 8) return host + '/…'
  if (last.length <= room) return `${host}/…/${last}`

  // Keep a file extension whole: it tells a reader this is a PDF to download.
  const m = last.match(/^(.*)(\.[a-z0-9]{2,5})$/i)
  const ext = m && m[2].length < room - 2 ? m[2] : ''
  const stem = ext ? m[1] : last
  return `${host}/…/${stem.slice(0, room - ext.length - 1)}…${ext}`
}

/*
 * The label for one tutorial link: its shortened URL, or the host alone when the row is flagged
 * `host-only` (an address that says nothing, like /INSERT-NAME/). `complex-tooling` is stored,
 * not rendered.
 */
export function tutorialLabel(t) {
  if ((t.flags || []).includes('host-only')) {
    try { return new URL(t.url).host.replace(/^www\./, '') } catch { /* fall through */ }
  }
  return displayUrl(t.url)
}
