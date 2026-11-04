// Deterministic SEO audit over the BUILT site. Range 5 of the pre-launch QA scope.
//
// WHY THIS EXISTS RATHER THAN A ONE-OFF PASS. Every SEO defect this found on its first
// run was a GENERATOR bug or a data gap, not a page that needed better wording: one
// template producing 153 over-long titles, one fallback producing 222 thin descriptions,
// one missing branch producing 6 pages with no hreflang. A hand pass fixes those once. A
// check in the build stops them coming back, and it runs for nothing.
//
// WHAT IT DOES NOT DO, so a green run is not read as "the SEO is good": it never judges
// whether a title is WELL WRITTEN, whether a description would earn a click, or whether
// the internal linking is any use. Those are judgement and they are a separate pass.
// This checks that the machinery is correct: unique, present, within length, reciprocal,
// self-consistent, and matching what the sitemap claims.
//
// Run:  node scripts/qa-seo.mjs        (also the last step of `npm run build`)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DIST = path.join(ROOT, 'dist')

// Length budgets. Not laws of nature: Google renders roughly 580px of title and truncates
// on width, not characters, so these are the conventional character proxies. They are a
// FAIL rather than a warning because a budget nobody has to meet is not a budget, and
// because every breach found so far came from a template, where one fix clears hundreds.
const TITLE_MAX = 65
const DESC_MIN = 70
const DESC_MAX = 160

// ---------------------------------------------------------------------------
// Read every built page
// ---------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== 'assets') walk(p, out)
    } else if (e.name.endsWith('.html')) out.push(p)
  }
  return out
}

// "dist/en/solution/foo.html" -> "/en/solution/foo";  "dist/en.html" -> "/en";
// "dist/index.html" -> "/". The prerenderer writes "<path>.html" rather than
// "<path>/index.html" on purpose (see its comment on the trailing-slash redirect), so
// this mapping is the inverse of that decision and has to stay in step with it.
function urlPath(file) {
  const rel = path.relative(DIST, file).split(path.sep).join('/')
  if (rel === 'index.html') return '/'
  return '/' + rel.replace(/\.html$/, '')
}

// Decode before measuring. The prerenderer escapes into the attribute, so a raw read
// counts `&#39;` as five characters and `&amp;` as five: the first run of this script
// reported two descriptions "over 160" that were 156 and 158 once decoded, and inflated
// every title containing an apostrophe. A length check that measures the encoding rather
// than the text invents defects, which is worse than missing them.
const decode = (s) => String(s)
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&')          // last: an entity may be double-encoded

const attr = (html, re) => {
  const m = html.match(re)
  return m ? decode(m[1]).trim() : ''
}

function parsePage(file) {
  const html = fs.readFileSync(file, 'utf8')
  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
    .map((m) => ({ lang: m[1], href: m[2] }))
  let ld = null
  let ldError = ''
  // NOT decoded: the JSON-LD block is JSON.stringify output written straight into a
  // <script>, never passed through the HTML escaper, so decoding it could only corrupt it.
  const ldm = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  const ldRaw = ldm ? ldm[1].trim() : ''
  if (ldRaw) {
    try { ld = JSON.parse(ldRaw) } catch (e) { ldError = e.message }
  }
  // The visible breadcrumb the prerenderer writes, so the structured trail can be
  // compared against what a reader actually sees rather than against itself.
  const navRaw = attr(html, /<nav class="pr-crumbs">([\s\S]*?)<\/nav>/)
  return {
    file,
    url: urlPath(file),
    lang: attr(html, /<html lang="([^"]+)"/),
    title: attr(html, /<title>([\s\S]*?)<\/title>/),
    desc: attr(html, /<meta name="description" content="([^"]*)"/),
    robots: attr(html, /<meta name="robots" content="([^"]*)"/),
    canonical: attr(html, /<link rel="canonical" href="([^"]+)">/),
    alts,
    ogTitle: attr(html, /<meta property="og:title" content="([^"]*)"/),
    ogDesc: attr(html, /<meta property="og:description" content="([^"]*)"/),
    ogImage: attr(html, /<meta property="og:image" content="([^"]*)"/),
    ld,
    ldError,
    ldRaw,
    crumbDepth: navRaw ? navRaw.split('›').length : 0,
  }
}

if (!fs.existsSync(DIST)) {
  console.error('qa-seo: no dist/. Run the build first.')
  process.exit(1)
}
/* THE OFFLINE SHELL IS NOT A PAGE. dist/app-shell.html is a copy of the raw Vite shell that
   the service worker falls back to when a reader is offline on a URL it has not cached
   (vite.config.js, src/sw.js). It has no content, no canonical and no counterpart, by design:
   it boots the app, which renders the route from the URL. It carries `noindex` so a crawler
   that finds it leaves it alone, and it is skipped here so it cannot fail checks written for
   pages that are meant to be read. */
const pages = walk(DIST).map(parsePage).filter((p) => p.url !== '/app-shell')
const byUrl = new Map(pages.map((p) => [p.url, p]))

// The canonical origin, taken from the pages themselves rather than configured twice.
const origins = pages.map((p) => p.canonical).filter(Boolean)
  .map((c) => { try { return new URL(c).origin } catch { return '' } }).filter(Boolean)
const SITE = origins.sort((a, b) =>
  origins.filter((o) => o === b).length - origins.filter((o) => o === a).length)[0] || ''

const indexable = (p) => !/noindex/i.test(p.robots)

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------
const problems = new Map()
function fail(check, detail) {
  if (!problems.has(check)) problems.set(check, [])
  problems.get(check).push(detail)
}

// --- 1. titles -------------------------------------------------------------
for (const p of pages) {
  if (!p.title) fail('title missing', p.url)
  else if (indexable(p) && p.title.length > TITLE_MAX) {
    fail(`title over ${TITLE_MAX} chars`, `${p.url}  (${p.title.length})  ${p.title.slice(0, 70)}`)
  }
}

// Uniqueness is checked WITHIN a language, never across. An English page and its French
// counterpart legitimately share a title when the word is the same in both languages
// ("Distribution", "Circulation"); that is what hreflang exists to resolve, and counting
// it as a duplicate sends you chasing 30 defects when there are 8.
for (const lang of new Set(pages.map((p) => p.lang))) {
  for (const [field, label] of [['title', 'title'], ['desc', 'description']]) {
    const seen = new Map()
    for (const p of pages) {
      if (p.lang !== lang || !indexable(p) || !p[field]) continue
      const k = p[field]
      if (!seen.has(k)) seen.set(k, [])
      seen.get(k).push(p.url)
    }
    for (const [value, urls] of seen) {
      if (urls.length > 1) {
        fail(`duplicate ${label} within one language`,
          `[${lang}] ${value.slice(0, 60)}  ->  ${urls.join(', ')}`)
      }
    }
  }
}

// --- 2. descriptions -------------------------------------------------------
for (const p of pages) {
  if (!indexable(p)) continue
  if (!p.desc) fail('description missing', p.url)
  else if (p.desc.length < DESC_MIN) {
    fail(`description under ${DESC_MIN} chars`, `${p.url}  (${p.desc.length})  ${p.desc}`)
  } else if (p.desc.length > DESC_MAX) {
    fail(`description over ${DESC_MAX} chars`, `${p.url}  (${p.desc.length})`)
  }
}

// --- 3. canonical ----------------------------------------------------------
for (const p of pages) {
  if (p.url === '/404') continue
  if (!p.canonical) { fail('canonical missing', p.url); continue }
  const want = SITE + p.url
  if (p.canonical !== want) fail('canonical does not point at the page itself', `${p.url}  ->  ${p.canonical}`)
}

// --- 4. hreflang reciprocity ----------------------------------------------
// The rule that actually matters: if A names B as its alternate, B must name A back, and
// both files must exist. A one-way declaration is ignored by Google, silently.
// Every page under a language prefix has a counterpart BY CONSTRUCTION: the prerenderer
// loops over LANGS and emits both, app-only routes included. So "is there a counterpart"
// needs no clever URL mapping (slugs differ per language and are not derivable) -- being
// under /en or /fr is itself the evidence. 404 and the root are the two real exceptions.
const LANG_PREFIXES = new Set(['en', 'fr'])
const underLang = (p) => LANG_PREFIXES.has(p.url.split('/')[1])

for (const p of pages) {
  if (!p.alts.length) {
    if (underLang(p)) fail('hreflang missing on a page that has a counterpart', p.url)
    continue
  }
  if (!p.alts.some((a) => a.lang === 'x-default')) fail('hreflang x-default missing', p.url)
  for (const a of p.alts) {
    if (a.lang === 'x-default') continue
    const target = a.href.startsWith(SITE) ? a.href.slice(SITE.length) : a.href
    const t = byUrl.get(target)
    if (!t) { fail('hreflang points at a page that does not exist', `${p.url}  ->  ${a.href}`); continue }
    if (t.url === p.url) continue
    const back = t.alts.some((b) => {
      const h = b.href.startsWith(SITE) ? b.href.slice(SITE.length) : b.href
      return h === p.url
    })
    if (!back) fail('hreflang not reciprocal', `${p.url}  ->  ${t.url}  (which does not point back)`)
  }
}

// --- 5. Open Graph ---------------------------------------------------------
for (const p of pages) {
  if (!indexable(p)) continue
  if (!p.ogTitle) fail('og:title missing', p.url)
  if (!p.ogDesc) fail('og:description missing', p.url)
  if (!p.ogImage) fail('og:image missing', p.url)
}

// --- 6. structured data ----------------------------------------------------
for (const p of pages) {
  if (!indexable(p)) continue
  if (p.ldError) { fail('JSON-LD does not parse', `${p.url}  ${p.ldError}`); continue }
  if (!p.ld) { fail('JSON-LD missing', p.url); continue }
  if (!p.ld['@context']) fail('JSON-LD has no @context', p.url)
  const graph = p.ld['@graph'] || []
  const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList')
  if (p.crumbDepth > 1) {
    if (!crumbs) fail('visible breadcrumb but no BreadcrumbList', `${p.url}  (${p.crumbDepth} levels shown)`)
    else {
      // The defect this was written for: the structured trail was two levels deep while
      // the visible trail was three, so the rich result advertised a shallower position
      // in the site than the page actually holds.
      const n = (crumbs.itemListElement || []).length
      if (n !== p.crumbDepth + 1) {
        fail('BreadcrumbList depth does not match the visible trail',
          `${p.url}  visible ${p.crumbDepth + 1}, structured ${n}`)
      }
    }
  }
  for (const node of graph) {
    if (!node['@type']) fail('JSON-LD node with no @type', p.url)
  }
}

// --- 7. sitemap ------------------------------------------------------------
const smPath = path.join(DIST, 'sitemap.xml')
if (!fs.existsSync(smPath)) fail('sitemap.xml missing', DIST)
else {
  const sm = fs.readFileSync(smPath, 'utf8')
  const listed = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => (m[1].startsWith(SITE) ? m[1].slice(SITE.length) : m[1]))
  const listedSet = new Set(listed)
  const dupes = listed.filter((u, i) => listed.indexOf(u) !== i)
  if (dupes.length) fail('sitemap lists a URL twice', [...new Set(dupes)].join(', '))
  for (const u of listedSet) {
    const p = byUrl.get(u)
    if (!p) fail('sitemap lists a URL with no page', u)
    else if (!indexable(p)) fail('sitemap lists a noindex page', u)
  }
  for (const p of pages) {
    if (indexable(p) && p.url !== '/' && !listedSet.has(p.url)) {
      fail('indexable page missing from the sitemap', p.url)
    }
  }
}

// --- 8. robots.txt and llms.txt --------------------------------------------
const robotsPath = path.join(DIST, 'robots.txt')
if (!fs.existsSync(robotsPath)) fail('robots.txt missing', DIST)
else {
  const r = fs.readFileSync(robotsPath, 'utf8')
  if (!/^Sitemap:\s*\S+/m.test(r)) fail('robots.txt does not name the sitemap', robotsPath)
  // A Disallow that also appears in the sitemap is the classic self-contradiction.
  for (const m of r.matchAll(/^Disallow:\s*(\S+)/gm)) {
    const p = byUrl.get(m[1])
    if (p && indexable(p)) fail('robots.txt disallows a page that is not noindex', m[1])
  }
}
if (!fs.existsSync(path.join(DIST, 'llms.txt'))) fail('llms.txt missing', DIST)

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const total = [...problems.values()].reduce((n, l) => n + l.length, 0)
const idx = pages.filter(indexable).length

if (!total) {
  console.log(`qa-seo: ${pages.length} pages (${idx} indexable), origin ${SITE} -- OK`)
  console.log('  checked: titles present/unique/in-budget, descriptions present/unique/in-budget,')
  console.log('  canonical self-reference, hreflang reciprocity and x-default, Open Graph,')
  console.log('  JSON-LD validity and breadcrumb depth, sitemap agreement, robots and llms.')
  console.log('  NOT checked: whether any of it is well written. That is a separate pass.')
  process.exit(0)
}

console.log(`\nqa-seo FAILED: ${total} problem(s) across ${problems.size} check(s).`)
console.log(`${pages.length} pages scanned, ${idx} indexable, origin ${SITE}\n`)
for (const [check, list] of [...problems].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${check}  (${list.length})`)
  for (const d of list.slice(0, 8)) console.log(`      ${d}`)
  if (list.length > 8) console.log(`      ... and ${list.length - 8} more`)
  console.log('')
}
process.exit(1)
