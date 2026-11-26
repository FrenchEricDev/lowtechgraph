#!/usr/bin/env node
/*
 * qa-measure -- no text gets a width cap of its own (Eric, 2026-10-21, and again 2026-11-26).
 *
 * WHY THIS EXISTS
 * Text runs to the edge of the column it is in; the column is the page's (--maxw), so every page
 * wraps at the same place. A capped line length (60-75 characters) is a common web habit, and it
 * kept coming back: a "measure cap" in the design checklist and in comments outlived the decision
 * to drop it, and each new section of the site got a max-width of its own (the solution page's
 * description, the example-home block, the guides index's section intros). Eric found it on a
 * wide screen each time. A written rule did not hold, so a check does (Core rule 8).
 *
 * WHAT IT CHECKS
 * Every `max-width` (and `max-inline-size`) declared in src/**\/*.css, outside a media query's
 * condition, whose value caps a width: a length in px, rem, em, ch, or a calc/min() holding one.
 * `none`, a plain percentage, and var(--maxw) (the page column itself) pass. Any other selector
 * must be in ALLOWED below, with the reason it is not running text. A new entry there is a
 * decision, not a fix: it needs one.
 *
 * WHAT IT DOES NOT CHECK
 *   - inline styles in JSX, or widths set from script
 *   - a `width:` that caps text without `max-width` (none known; a grid track could)
 *   - whether the page is laid out well; only that no text was given a narrower column
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

// selector (as written, whitespace collapsed) -> why its width is capped. Not running text.
const ALLOWED = {
  '.settings-select': 'a form control',
  '.notfound-search': 'a search form',
  '.search-again': 'a search form',
  '.media-photo img': 'a photo, kept at its own resolution',
  '.media-video': 'a video frame',
  '.why-bubble figcaption': 'a caption under a fixed-size picture',
  '.st-still': 'the site tour still, a fixed-size picture',
  '.add-toast-region': 'a notice, kept inside the viewport',
  '.bt-verdict': 'the builder tour bubble',
  '.tree-hint': 'a hint floating over the builder',
  '.tree-empty-inner': 'the empty-canvas prompt floating over the builder',
  '.adq-panel': 'a builder panel',
  '.tnode': 'a builder card',
  '.tnode.is-destination': 'a builder card',
  '.tnode.is-destination.is-wide': 'a builder card',
  '.modal': 'a dialog',
  '.cmp-single': 'one comparison card, as wide as a column of the two-card grid',
}

const files = []
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f)
  if (statSync(p).isDirectory()) walk(p)
  else if (p.endsWith('.css')) files.push(p)
})
walk(SRC)

const caps = (v) => {
  v = v.trim().replace(/\s*!important$/, '')
  if (v === 'none' || v === 'var(--maxw)' || /^-?[\d.]+%$/.test(v)) return false
  return /\d(px|rem|em|ch|vw)\b/.test(v) || /var\(--(?!maxw)/.test(v)
}

const found = []
for (const file of files) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const stack = []
  let start = 0
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    if (c === '{') {
      stack.push(css.slice(start, i).split(/[;}]/).pop().trim().replace(/\s+/g, ' '))
      start = i + 1
    } else if (c === '}') {
      const body = css.slice(start, i)
      const sel = stack.pop() || ''
      if (!sel.startsWith('@')) {
        for (const m of body.matchAll(/(?:^|;)\s*(max-width|max-inline-size)\s*:\s*([^;]+)/g)) {
          if (!caps(m[2])) continue
          const line = css.slice(0, start + m.index).split('\n').length
          for (const s of sel.split(',').map((x) => x.trim())) {
            found.push({ file: relative(SRC, file), line, sel: s, value: m[2].trim() })
          }
        }
      }
      start = i + 1
    } else if (c === ';' && stack.length && stack[stack.length - 1].startsWith('@')) {
      // a declaration directly inside @media is not possible; keep scanning
    }
  }
}

const bad = found.filter((f) => !ALLOWED[f.sel])
const unused = Object.keys(ALLOWED).filter((s) => !found.some((f) => f.sel === s))
console.log('\nmeasure: no text column narrower than the page\n')
if (bad.length) {
  console.log('  FAIL  a width cap on something not listed as non-text:')
  for (const b of bad) console.log(`        ${b.file}:${b.line}  ${b.sel} { max-width: ${b.value} }`)
  console.log('        Text runs to the column edge (Eric, 2026-10-21). Remove the cap, or, if this is not')
  console.log('        running text (a control, a picture, a builder panel), add it to ALLOWED with why.')
} else console.log(`  PASS  ${found.length} width caps, all on controls, pictures or builder parts`)
if (unused.length) console.log(`  NOTE  allowlisted but no longer in the CSS: ${unused.join(', ')}`)
console.log('\nNot checked: inline styles, widths set from script, or a plain width that caps text.')
process.exit(bad.length ? 1 : 0)
