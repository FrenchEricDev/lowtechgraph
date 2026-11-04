// The first-load budget (B2, 2026-10-26). What a reader's first visit downloads before the page
// works, compressed as the host sends it, measured from the built entry page rather than guessed:
// the entry script, everything it preloads, its stylesheet; and for a French reader the two French
// chunks on top (src/language.js). The budgets sit about a tenth above what was measured when
// they were set, so an ordinary change passes and a doubling does not. Raise one deliberately,
// with the reason, or not at all.
//
//   node scripts/qa-budget.mjs
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DIST = path.join(ROOT, 'dist')

// Measured 2026-10-26 (after B2): JS 262 KB, CSS 15 KB, the French extra 109 KB.
const BUDGET_KB = { js: 290, css: 18, frExtra: 130 }

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const refs = (re) => [...html.matchAll(re)].map((m) => m[1]).filter((u) => u.startsWith('/assets/'))
const scripts = [...refs(/<script[^>]*type="module"[^>]*src="([^"]+)"/g), ...refs(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)]
const styles = refs(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)
const gz = (rel) => zlib.gzipSync(fs.readFileSync(path.join(DIST, rel))).length
const kb = (n) => Math.round(n / 1024)
const assets = fs.readdirSync(path.join(DIST, 'assets'))
const french = assets.filter((f) => /^ui-strings\.fr-.*\.js$|^_virtual_catalogue-fr-.*\.js$/.test(f)).map((f) => '/assets/' + f)

const problems = []
if (!scripts.length) problems.push('found no entry script in dist/index.html')
if (french.length !== 2) problems.push(`expected the two French chunks, found ${french.length}`)
const size = { js: scripts.reduce((n, s) => n + gz(s), 0), css: styles.reduce((n, s) => n + gz(s), 0), frExtra: french.reduce((n, s) => n + gz(s), 0) }
for (const [k, budget] of Object.entries(BUDGET_KB)) {
  if (kb(size[k]) > budget) problems.push(`${k}: ${kb(size[k])} KB compressed, budget ${budget} KB`)
}

if (problems.length) {
  console.log(`\nqa-budget FAILED:\n${problems.map((p) => '  ' + p).join('\n')}\n`)
  console.log('  Look at what grew (the build lists chunk sizes) before raising a budget.\n')
  process.exit(1)
}
console.log(`qa-budget: first load ${kb(size.js)} KB of JS (budget ${BUDGET_KB.js}) and ${kb(size.css)} KB of CSS `
  + `(budget ${BUDGET_KB.css}), compressed; a French reader adds ${kb(size.frExtra)} KB (budget ${BUDGET_KB.frExtra}) -- OK`)
console.log(`  ${scripts.length} scripts and ${styles.length} stylesheet on the entry page; fonts, drawings and the builder load later.`)
