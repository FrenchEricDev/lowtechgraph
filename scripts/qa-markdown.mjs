// The Markdown twins (TODO I3) and the worker's headers (TODO I7), checked against dist/.
//
// Runs the real worker (worker/index.js) against a stand-in for Cloudflare's asset binding
// that serves dist/ the way wrangler.jsonc configures it (drop-trailing-slash, a 404 page).
// NOT checked: Cloudflare itself (its asset store, its caches, how it treats Vary); the
// content-type Cloudflare gives a .md file served straight from the store; that the Markdown
// reads well. Re-run Cloudflare's agent-readiness scan after publishing for the first.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import worker, { LINK_HEADER, wantsMarkdown } from '../worker/index.js'

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const cat = JSON.parse(fs.readFileSync(path.join(DIST, 'catalogue.json'), 'utf8'))

let pass = 0
const fails = []
const check = async (label, fn) => {
  try { await fn(); pass += 1; console.log('  PASS  ' + label) }
  catch (e) { fails.push(label); console.log('  FAIL  ' + label + '\n          ' + e.message) }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg) }

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])
const files = walk(DIST)
const pages = files.filter((f) => f.endsWith('.html')
  && fs.readFileSync(f, 'utf8').includes('type="text/markdown"'))

console.log('\nmarkdown twins and worker headers\n')

await check(`every page announcing a Markdown twin has one (${pages.length} pages)`, () => {
  must(pages.length > 600, `only ${pages.length} pages announce a twin`)
  const missing = pages.filter((f) => !fs.existsSync(f.replace(/\.html$/, '.md')))
  must(!missing.length, `${missing.length} missing, e.g. ${missing[0]}`)
})

await check('no HTML tag survives in a Markdown file', () => {
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const m = fs.readFileSync(f, 'utf8').match(/<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i)
    must(!m, `${path.relative(DIST, f)} still holds ${m && m[0]}`)
  }
})

await check('a solution twin carries its name, tutorials, facts and sources, with absolute links', () => {
  const s = cat.solutions.find((x) => (x.tutorials || []).length && (x.sources || []).some((y) => y.url))
  const f = path.join(DIST, 'en', 'solution', s.slug + '.md')
  const md = fs.readFileSync(f, 'utf8')
  must(md.includes(`# ${s.short || s.name}`) || md.includes(`# ${s.name}`), 'no h1 with the name')
  must(md.includes('](' + s.tutorials[0].url.replace(/ /g, '%20')), 'first tutorial link missing')
  must(md.includes(s.sources.find((y) => y.url).url), 'linked source missing')
  must(/\n- \*\*[^*]+:\*\* /.test(md), 'no facts list')
  must(!/\]\(\/(?!\/)/.test(md), 'a site-relative link was left relative')
  must(md.startsWith('> '), 'no provenance header')
})

// --- the worker, against dist/ ------------------------------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.md': 'text/markdown', '.json': 'application/json',
  '.txt': 'text/plain', '.xml': 'application/xml', '.png': 'image/png' }
// Cloudflare applies dist/_redirects before any file: the stand-in does too, for exact paths,
// or the root's redirect goes untested (it did, until 2026-11-13).
const REDIRECTS = new Map(fs.readFileSync(path.join(DIST, '_redirects'), 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/))
  .map(([from, to, code]) => [from, { to, code: Number(code) || 302 }]))
const ASSETS = {
  async fetch(req) {
    const hit = REDIRECTS.get(new URL(req.url).pathname)
    if (hit) return new Response(null, { status: hit.code, headers: { location: hit.to } })
    const p = decodeURIComponent(new URL(req.url).pathname).replace(/\/$/, '') || '/index'
    const tries = path.extname(p) ? [p] : [p + '.html', p + '/index.html']
    for (const t of tries) {
      const f = path.join(DIST, t)
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        return new Response(fs.readFileSync(f), { status: 200, headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } })
      }
    }
    return new Response(fs.readFileSync(path.join(DIST, '404.html')), { status: 404, headers: { 'content-type': TYPES['.html'] } })
  },
}
const writes = []
const env = { ASSETS, USAGE: { writeDataPoint: (d) => writes.push(d) } }
const get = (p, accept) => worker.fetch(new Request('https://lowtechgraph.org' + p,
  { headers: accept ? { accept } : {} }), env)
const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
const sol = cat.solutions[0]
const solPath = '/en/solution/' + sol.slug

await check('the bare root redirects, and its redirect carries the Link header', async () => {
  const r = await get('/', BROWSER)
  must(r.status === 302 && r.headers.get('location') === '/fr?l=auto', `/: ${r.status} ${r.headers.get('location')}`)
  must(r.headers.get('link') === LINK_HEADER, '/: the redirect has no Link header')
})

await check('a browser gets HTML with the three Link relations and Vary: Accept', async () => {
  for (const p of ['/en', '/fr', solPath]) {
    const r = await get(p, BROWSER)
    must(r.status === 200, `${p}: ${r.status}`)
    must(r.headers.get('content-type').startsWith('text/html'), `${p}: ${r.headers.get('content-type')}`)
    const link = r.headers.get('link') || ''
    for (const rel of ['rel="describedby"', 'rel="alternate"; type="application/json"', 'rel="sitemap"']) {
      must(link.includes(rel), `${p}: Link lacks ${rel}`)
    }
    must(link === LINK_HEADER, `${p}: Link header is not exactly the declared one`)
    must(/accept/i.test(r.headers.get('vary') || ''), `${p}: no Vary: Accept`)
  }
})

await check('every file the Link header names exists in dist/', () => {
  for (const m of LINK_HEADER.matchAll(/<([^>]+)>/g)) must(fs.existsSync(path.join(DIST, m[1])), `${m[1]} missing`)
})

await check('Accept: text/markdown gets the twin, as text/markdown, for a page in each language', async () => {
  for (const p of ['/en', '/fr', solPath, '/fr/solution/' + (sol.slug_fr || sol.slug)]) {
    const r = await get(p, 'text/markdown')
    must(r.status === 200, `${p}: ${r.status}`)
    must(r.headers.get('content-type') === 'text/markdown; charset=utf-8', `${p}: ${r.headers.get('content-type')}`)
    const body = await r.text()
    must(body.startsWith('> '), `${p}: not the Markdown twin`)
  }
})

await check('Markdown ranked below HTML, or absent, gets HTML', async () => {
  for (const a of ['text/html, text/markdown;q=0.5', BROWSER, '*/*', '']) {
    const r = await get(solPath, a)
    must(r.headers.get('content-type').startsWith('text/html'), `"${a}" got ${r.headers.get('content-type')}`)
  }
  must(!wantsMarkdown(new Request('https://x/', { headers: { accept: 'text/markdown;q=0' } })), 'q=0 counted as wanted')
})

await check('the dataset, a .md URL and a missing page behave under Accept: text/markdown', async () => {
  const j = await get('/catalogue.json', 'text/markdown')
  must(j.headers.get('content-type') === 'application/json', 'catalogue.json was swapped')
  const d = await get(solPath + '.md', BROWSER)
  must(d.status === 200 && d.headers.get('content-type') === 'text/markdown; charset=utf-8', `.md direct: ${d.status} ${d.headers.get('content-type')}`)
  const n = await get('/en/solution/no-such-thing', 'text/markdown')
  must(n.status === 404, `missing page answered ${n.status}`)
})

await check('a Markdown request is counted as kind "markdown", a page as "page"', async () => {
  writes.length = 0
  await get(solPath, 'text/markdown'); await get(solPath, BROWSER)
  must(writes[0].indexes[0] === 'markdown' && writes[1].indexes[0] === 'page',
    `kinds were ${writes.map((w) => w.indexes[0]).join(', ')}`)
})

await check('a broken counter still serves the page', async () => {
  const r = await worker.fetch(new Request('https://lowtechgraph.org' + solPath, { headers: { accept: 'text/markdown' } }),
    { ASSETS, USAGE: { writeDataPoint() { throw new Error('down') } } })
  must(r.status === 200, String(r.status))
})

console.log(`\n${pass} passed, ${fails.length} failed`)
console.log('Not checked: Cloudflare itself (asset store, caches, Vary handling), the type it gives a .md served'
  + ' directly, or whether the Markdown reads well. Re-run the agent-readiness scan after publishing.')
if (fails.length) process.exit(1)
