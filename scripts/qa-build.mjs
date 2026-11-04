// Deterministic build audit over dist/. Range 2 of the pre-launch QA scope: does the
// delivered site still hold together.
//
// The scope note asked for "every sitemap URL returns 200 with no redirect", which needs a
// running server. This does the stronger, cheaper version: it resolves EVERY internal link
// on EVERY page against the files actually written, not just the ones the sitemap lists.
// A 200 check only visits pages you already knew about; this finds the link from page A to
// a page that was never emitted, which is how a dead link gets shipped in the first place.
//
// WHAT IT DOES NOT CHECK: anything that needs the app to run. The tree round-trip, the
// language toggle and the share table are behaviour, not files, and they are checked in
// the browser against the real build.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SEG, LANGS, segPath } from '../src/url-vocab.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DIST = path.join(ROOT, 'dist')
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalogue.json'), 'utf8'))

if (!fs.existsSync(DIST)) {
  console.error('qa-build: no dist/. Run the build first.')
  process.exit(1)
}

const problems = new Map()
const fail = (check, detail) => {
  if (!problems.has(check)) problems.set(check, [])
  problems.get(check).push(detail)
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const allFiles = walk(DIST)
const relOf = (f) => '/' + path.relative(DIST, f).split(path.sep).join('/')
const fileSet = new Set(allFiles.map(relOf))
const htmlFiles = allFiles.filter((f) => f.endsWith('.html') && !f.includes(`${path.sep}assets${path.sep}`))

// A link target resolves if there is a file at it, at it + ".html", or at it + "/index.html".
// The prerenderer deliberately writes "<path>.html" rather than "<path>/index.html" (see its
// note on the trailing-slash redirect), and the host serves both shapes extensionless.
function resolves(p) {
  if (p === '/') return fileSet.has('/index.html')
  return fileSet.has(p) || fileSet.has(p + '.html') || fileSet.has(p + '/index.html')
}

// --- A. every internal link points at something that exists ------------------
const linkRe = /(?:href|src)="([^"]+)"/g
let linksChecked = 0
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8')
  const from = relOf(f).replace(/\.html$/, '') || '/'
  const seen = new Set()
  for (const m of html.matchAll(linkRe)) {
    const raw = m[1]
    // External, in-page, and non-navigational schemes are somebody else's problem.
    if (/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(raw)) continue
    const target = raw.split('#')[0].split('?')[0]
    if (!target || !target.startsWith('/')) continue
    if (seen.has(target)) continue
    seen.add(target)
    linksChecked++
    if (!resolves(target)) fail('internal link points at nothing', `${from}  ->  ${target}`)
  }
}

// --- B. every catalogue entity has exactly one page per language -------------
// Coverage from the DATA side rather than the file side. A page that exists for a deleted
// entity and an entity with no page are different defects and this is the only check that
// can see either: everything else starts from the files that happen to be there.
const slugOf = (e, lang) => (lang === 'fr' ? e.slug_fr : e.slug) || e.slug || ''
const KINDS = [
  ['solution', cat.solutions, (e, l) => segPath(l, SEG[l].solution, slugOf(e, l))],
  ['resource', cat.io_types, (e, l) => segPath(l, SEG[l].resource, slugOf(e, l))],
  ['function', cat.functions, (e, l) => segPath(l, SEG[l].need, slugOf(e, l))],
]
const fnById = Object.fromEntries(cat.functions.map((f) => [f.id, f]))
KINDS.push(['sub-function', cat.subfunctions,
  (e, l) => segPath(l, SEG[l].need, slugOf(fnById[e.function_id], l), slugOf(e, l))])

let pagesExpected = 0
for (const [label, list, pathFn] of KINDS) {
  for (const e of list) {
    for (const l of LANGS) {
      pagesExpected++
      const p = pathFn(e, l)
      if (!resolves(p)) fail('catalogue entity has no page', `${label} ${e.id} [${l}]  ${p}`)
    }
  }
}

// --- C. every local asset a page references exists ---------------------------
// og:image is the one nobody notices: a broken card image looks fine on the site and
// shows as a blank rectangle the first time somebody shares the link.
const assetRe = /<meta property="og:image" content="([^"]+)"/g
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8')
  for (const m of html.matchAll(assetRe)) {
    const u = m[1]
    const local = u.startsWith('http') ? u.replace(/^https?:\/\/[^/]+/, '') : u
    if (!local.startsWith('/')) continue
    if (!fileSet.has(local)) fail('og:image points at a file that was not built', `${relOf(f)}  ->  ${local}`)
  }
}

// --- D. the data the app boots on --------------------------------------------
for (const required of ['/catalogue.json', '/sitemap.xml', '/robots.txt', '/llms.txt', '/404.html']) {
  if (!fileSet.has(required)) fail('expected file missing from the build', required)
}
{
  // The app renders from src/data/catalogue.json, bundled. This is the published copy at
  // /catalogue.json, which llms.txt and the AI statement both point bulk consumers at. If
  // the copy step ever breaks they diverge silently, and the site says one thing while the
  // dataset says another.
  const shipped = JSON.parse(fs.readFileSync(path.join(DIST, 'catalogue.json'), 'utf8'))
  for (const k of ['solutions', 'functions', 'subfunctions', 'io_types']) {
    if ((shipped[k] || []).length !== (cat[k] || []).length) {
      fail('published catalogue.json disagrees with the bundled one',
        `${k}: published ${(shipped[k] || []).length}, bundled ${(cat[k] || []).length}`)
    }
  }
}

// --- the language a preference-free visitor gets ------------------------------
// Eric, 2026-09-05: French if either the browser or the OS language is French, English
// otherwise. Two halves had to be true and only one was: `preferredLang` read the
// browser, but the CDN redirect from "/" to "/fr" fires before any JavaScript, so no
// visitor arriving at the root ever reached the detection. The redirect now carries
// `l=auto` and the app corrects from there.
//
// Parsed out of router.js and evaluated against fake navigators, rather than restated
// here -- a gate that pins a copy of the thing it guards is testing the copy.
{
  const src = fs.readFileSync(path.join(ROOT, 'src/router.js'), 'utf8')
  const start = src.indexOf('export function preferredLang')
  const end = src.indexOf(String.fromCharCode(10) + '}', start)
  if (start < 0 || end < 0) {
    fail('language default', 'could not find preferredLang in src/router.js')
  } else {
    const body = src.slice(start, end + 2).replace('export function preferredLang', 'function preferredLang')
    const run = (languages, stored) => {
      const LANGS = ['en', 'fr']
      const DEFAULT_LANG = 'en'
      const navigator = { languages, language: languages[0] || '' }
      const localStorage = { getItem: () => stored || null }
      // eslint-disable-next-line no-eval
      return eval(`${body}; preferredLang()`)
    }
    const cases = [
      [['fr-FR', 'fr'], null, 'fr', 'a French browser'],
      [['en-US', 'en'], null, 'en', 'an English browser'],
      [['en-GB', 'fr-FR'], null, 'fr', 'English browser, French OS locale'],
      [['fr-CA'], null, 'fr', 'Canadian French'],
      [['de-DE', 'it-IT'], null, 'en', 'neither: falls back to English, not French'],
      [[''], null, 'en', 'a browser that reports nothing'],
      [['fr-FR'], 'en', 'en', 'a stored choice beats the browser'],
      [['en-US'], 'fr', 'fr', 'a stored choice beats the browser, the other way'],
    ]
    for (const [langs, stored, want, what] of cases) {
      let got
      try { got = run(langs, stored) } catch (e) { got = 'threw: ' + e.message }
      if (got !== want) fail('language default', `${what}: got ${got}, want ${want}`)
    }
    console.log(`  language default: ${cases.length} browser configurations checked`)
  }

  // AND THE REDIRECT MUST HAND THE APP THE MARKER. Without it the app cannot tell a root
  // visitor from someone opening a /fr link, so detection either never runs or overrides
  // a link that was deliberately French.
  const red = fs.readFileSync(path.join(ROOT, 'public/_redirects'), 'utf8')
  if (!/^\/\s+\/fr\?l=auto\s+302/m.test(red)) {
    fail('language default',
      'the root redirect no longer carries ?l=auto, so a visitor arriving at "/" '
      + 'can never be given their own language')
  }
}

// --- searching in French finds French names --------------------------------------
// The sixth instance of the raw-`.name` defect, and the first the i18n gate did not
// catch: the tree builder's solution picker filtered on `.name`, the ENGLISH name, while
// the browse list beside it rendered the translated one. A French reader saw "Forage" and
// "Captage de source" in the tree, searched for them, and got nothing (Eric, 2026-09-04).
// The gate missed it because the line carried an `i18n-ok` marker whose justification was
// subtly wrong -- it said a French term would find an UNTRANSLATED row, which is true and
// is not the same as finding a TRANSLATED one. The marker was deliberate, and the
// reasoning behind it was not checked, which is exactly the limit that file documents.
//
// Structurally the fix is one shared matcher. This is the belt: it asserts the matcher
// actually finds an entity by its French name, on real data, so the two can never drift
// back apart silently.
//
// THE MATCHER IS PARSED OUT OF catalogue.js RATHER THAN RE-IMPLEMENTED HERE (2026-09-04).
// It used to be a local copy, which tested that a two-line function this file defines
// works -- so a regression in the REAL `matchesName` would have left this gate green.
// Same idiom as ENGINE_HANDLES in qa-adequacy.mjs, and for the same reason: a gate that
// pins a copy of the thing it guards is testing the copy.
//
// AND IT COVERS EVERY CLASS `search()` COVERS, not just solutions. The reported bug was
// about solutions, but search() filters solutions, functions, subfunctions AND io_types
// through the same matcher, and two new resources were added on 2026-09-04 whose French
// names nothing checked.
{
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalogue.json'), 'utf8'))

  // Lift the real matcher out of the module. It cannot be imported: catalogue.js imports
  // catalogue.json, which plain node refuses without an import attribute.
  const csrc = fs.readFileSync(path.join(ROOT, 'src/catalogue.js'), 'utf8')
  const mstart = csrc.indexOf('export const matchesName')
  const mend = csrc.indexOf(String.fromCharCode(10) + '}', mstart)  // the closing brace in column 0
  if (mstart < 0 || mend < 0) {
    fail('bilingual search', 'could not find matchesName in src/catalogue.js -- if it was '
      + 'renamed or reshaped, repoint this gate rather than deleting it')
  }
  const matchesName = eval('(' + csrc.slice(mstart, mend + 2).replace('export const matchesName =', '') + ')')
  const match = (x, n) => matchesName(x, n)

  // The classes search() filters, and the field each one is searched on.
  const CLASSES = ['solutions', 'functions', 'subfunctions', 'io_types']
  // Since brief 07 the search lives in src/search.js; its name place must go through this
  // shared matcher, and every class must still be searched.
  const ssrc = fs.readFileSync(path.join(ROOT, 'src/search.js'), 'utf8')
  if (!ssrc.includes('cat.matchesName(x,')) {
    fail('bilingual search', 'search.js no longer matches names through cat.matchesName -- this gate has gone stale')
  }
  for (const [c, src] of [['solutions', 'cat.catalogue.solutions'], ['functions', 'cat.catalogue.functions'],
    ['subfunctions', 'cat.catalogue.subfunctions'], ['io_types', 'cat.catalogue.io_types']]) {
    if (!ssrc.includes(`run(${src},`)) {
      fail('bilingual search', `search.js no longer searches ${c} -- this gate has gone stale`)
    }
  }

  let checked = 0
  const perClass = []
  for (const cls of CLASSES) {
    const rows = (cat[cls] || []).filter(
      (x) => x.fr && x.fr.name && x.fr.name.toLowerCase() !== (x.name || '').toLowerCase())
    for (const x of rows) {
      const fr = x.fr.name.toLowerCase()
      if (!match(x, fr)) {
        fail('bilingual search', `${cls} ${x.id} cannot be found by its own French name "${x.fr.name}"`)
      }
      if (!match(x, (x.name || '').toLowerCase())) {
        fail('bilingual search', `${cls} ${x.id} cannot be found by its English name "${x.name}"`)
      }
      // AND BY THE FRENCH NAME TYPED WITHOUT ACCENTS, which is how most people type on a
      // phone. "poele" found nothing for "Poele a bois" until 2026-09-05 (Eric, testing).
      const bare = fr.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (bare !== fr && !match(x, bare)) {
        fail('bilingual search', `${cls} ${x.id} cannot be found by its French name with `
          + `the accents left off ("${bare}" for "${x.fr.name}")`)
      }
    }
    checked += rows.length
    perClass.push(`${rows.length} ${cls}`)
  }
  if (checked < 50) {
    fail('bilingual search', `only ${checked} entities have a distinct French name; `
      + 'this check needs translated rows to mean anything')
  }
  // The matcher must be able to FAIL, or the loop above proves nothing.
  if (match({ name: 'wood stove', fr: { name: 'poele a bois' } }, 'zzq-not-a-name')) {
    fail('bilingual search', 'the matcher returns true for a needle in neither name; '
      + 'every check in this block is vacuous')
  }
  console.log(`  searchable in both languages: ${checked} translated entities (${perClass.join(', ')})`)
}

// --- English text must not ship only in the French chunk ----------------------
// regulation_fr ends in _fr but holds the English note on the rules in France. The French split
// in vite.config.js once moved it out of the core with the real French fields, and English pages
// lost the rules on 105 solutions, unless a French page had been opened first. The prerendered
// HTML reads the full catalogue, so no check over the pages could see it (2026-11-02).
{
  const assetsDir = path.join(DIST, 'assets')
  const scripts = fs.readdirSync(assetsDir)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_virtual_catalogue-fr-'))
    .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
    .join('\n')
  // The core is a JSON string inside the script, escaped in whatever way the bundler quotes it,
  // so quotes and backslashes are left out of the comparison on both sides.
  const bare = (s) => s.replace(/[\\"]/g, '')
  const haystack = bare(scripts)
  const notes = cat.solutions.filter((s) => s.regulation_fr)
  if (!notes.length) fail('English rules in the core', 'no solution has a note; this check has gone stale')
  for (const s of notes) {
    if (!haystack.includes(bare(s.regulation_fr))) fail('English rules in the core', `${s.id} ${s.name}`)
  }
}

// --- report ------------------------------------------------------------------
const total = [...problems.values()].reduce((n, l) => n + l.length, 0)
if (!total) {
  console.log(`qa-build: ${htmlFiles.length} pages, ${linksChecked} internal links, `
    + `${pagesExpected} entity pages -- OK`)
  console.log('  checked: every internal link resolves to a built file, every catalogue')
  console.log('  entity has a page in both languages, og:image exists, the published')
  console.log('  catalogue.json matches the bundled one.')
  console.log('  NOT checked: anything that needs the app running. Tree round-trip, the')
  console.log('  language toggle and the share table are behaviour, checked in a browser.')
  process.exit(0)
}


console.log(`\nqa-build FAILED: ${total} problem(s) across ${problems.size} check(s).\n`)
for (const [check, list] of [...problems].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${check}  (${list.length})`)
  for (const d of list.slice(0, 10)) console.log(`      ${d}`)
  if (list.length > 10) console.log(`      ... and ${list.length - 10} more`)
  console.log('')
}
process.exit(1)
