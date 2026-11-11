// Contrast floors for both themes, checked from the token file rather than from a
// screenshot. Range 3 of the pre-launch QA scope, the part that is decidable.
//
// WHY FROM THE TOKENS. The 2026-08-20 UI pass measured contrast by eye and by hand, once.
// Every colour in this app comes from a token in index.css and every theme is that same
// token set redefined, so the whole question reduces to arithmetic over three blocks:
// the bare :root (light), the prefers-color-scheme override, and the [data-theme="dark"]
// stamp, plus a fourth since 2026-11-06: higher contrast over light. That is checkable on every build, for nothing, in both themes at once.
//
// WHAT IT CANNOT SEE, and this matters: it checks the PAIRS listed below, not every pair
// the app actually renders. If a component puts --muted on --accent-bg and nobody adds
// that pair here, this stays green. It is a floor under the palette, not a proof about
// the screen. The pairs are listed explicitly for that reason: each one is a claim
// somebody made about how the app is coloured, and it is reviewable as a list.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8')

// WCAG 2.2: 4.5:1 for body text, 3:1 for non-text UI that a reader must be able to
// PERCEIVE to use the page. The distinction matters and the first run of this script got
// it wrong: it held hairline dividers to 3:1 and reported nine failures that are not
// failures. 1.4.11 exempts purely decorative parts, and a rule between two list rows is
// decorative, because the rows are already separated by their own text. A focus ring is
// not decorative: it is the only thing telling a keyboard user where they are.
// So dividers and badge borders are MEASURED and reported, never failed: floor null.
const TEXT = 4.5
const UI = 3.0
const DECOR = null

// [foreground, background, floor, what it is]. A foreground may carry an opacity, 'TOKEN @ .85'
// (B5): the text is then blended into its background before it is measured, as the screen does.
const PAIRS = [
  ['--ink', '--bg', TEXT, 'body text on the page'],
  ['--ink', '--surface', TEXT, 'body text on a card'],
  ['--ink', '--surface-2', TEXT, 'body text on an inset panel'],
  ['--muted', '--bg', TEXT, 'secondary text on the page'],
  ['--muted', '--surface', TEXT, 'secondary text on a card'],
  ['--accent-ink', '--bg', TEXT, 'accent text on the page'],
  ['--accent-ink', '--accent-bg', TEXT, 'accent text on its own tint'],
  // Added 2026-08-27 with the tutorial block. The tint became a container for a
  // whole section rather than one line, so text that had only ever sat on --surface
  // now sits on it: the language badge and the "no tutorial yet" note are both
  // --muted. This is precisely the gap this file's own header warns about, which is
  // why the pairs are added at the same time as the markup rather than afterwards.
  // Kept as a GUARD rather than a live combination: the block uses --accent-ink for
  // its badge and note precisely because --muted measured 4.50:1 here, passing with
  // nothing to spare. If muted text ever lands on this tint again, this catches it.
  ['--muted', '--accent-bg', TEXT, 'secondary text on the accent tint (guard)'],
  ['--ink', '--accent-bg', TEXT, 'a tutorial row under the mouse'],
  ['--line', '--accent-bg', DECOR, 'language-badge border on the accent tint'],
  ['--accent-ink', '--accent-bg-2', TEXT, 'accent text on the lighter tint'],
  ['--muted', '--accent-bg-2', TEXT, 'a tutorial\'s source line on the Build it box'],
  ['--ink', '--accent-bg-2', TEXT, 'a tutorial\'s title on the Build it box'],
  ['--accent-ink', '--accent-bg-strong', TEXT, 'accent text on the selected-row tint'],
  ['--on-accent', '--accent', TEXT, 'label on a filled button'],
  // Added 2026-09-04 with the floating verdict button, at the same time as the
  // markup rather than afterwards, which is what this file's header asks for. It is
  // a filled button in its own colour (terracotta then, ink since 2026-10-20), so it is the
  // same shape as the pair above and nothing else in the palette would have caught it.
  ['--verdict-ink', '--verdict', TEXT, 'label on the verdict button'],
  ['--header-ink', '--header-bg', TEXT, 'header text on the bar'],
  // THE BAR'S OWN CONTROLS, added 2026-09-10 after three failures were found by hand in
  // one pass -- every one of them already failing before that day's palette change, and
  // invisible here because nothing on the bar except its text was listed. The composite
  // form 'A over B' exists for the pill: its fill is translucent white, and reading rgba()
  // as its bare channels made it solid white, against which nothing could ever fail.
  ['--header-ink', '--header-btn over --header-bg', TEXT, 'nav label on the filled pill'],
  ['--header-ink', '--header-btn-hover over --header-bg', TEXT, 'nav label on the pill, hovered'],
  ['--header-focus', '--header-bg', UI, 'focus ring on the header bar'],
  ['--header-dot-ring', '--header-bg', UI, 'the ring that makes the filter dot visible'],
  ['--benchmark', '--header-dot-ring', DECOR, 'badge fill inside its ring'],
  // Added 2026-09-23 when the dot became a count (filters on the gear, solutions on Build).
  ['--badge-ink', '--benchmark', TEXT, 'the number on a header badge'],
  ['--header-field-ink', '--header-field', TEXT, 'typed text in the search field'],
  ['--header-field-muted', '--header-field', UI, 'search placeholder'],
  ['--newbuild-ink', '--newbuild-bg', TEXT, 'new-build badge'],
  ['--benchmark-ink', '--benchmark-bg', TEXT, 'benchmark badge'],
  ['--benchmark-ink', '--benchmark-bg-2', TEXT, 'benchmark badge, second tint'],
  ['--resource-ink', '--resource-bg', TEXT, 'resource badge'],
  ['--line', '--bg', DECOR, 'divider on the page'],
  ['--line', '--surface', DECOR, 'divider on a card'],
  ['--accent-line', '--bg', DECOR, 'accent border (the badge also carries text)'],
  // THE DIAGNOSTICS PANEL, added 2026-09-10 when its colours moved here from TreeBuilder.css.
  // Declared there, they had never been through this file -- and the grey label failed on
  // arrival (4.47:1). Each verdict card is its tint over the panel's --surface; in dark the
  // tint is 10% of the verdict colour, which is why these use the composite form.
  ['--adq-green', '--adq-green-bg over --surface', TEXT, 'verdict label: works out'],
  ['--adq-yellow', '--adq-yellow-bg over --surface', TEXT, 'verdict label: tight'],
  ['--adq-red', '--adq-red-bg over --surface', TEXT, 'verdict label: does not work out'],
  ['--adq-grey', '--adq-grey-bg over --surface', TEXT, 'verdict label: could not compute'],
  ['--adq-supplied', '--adq-supplied-bg over --surface', TEXT, 'verdict label: supplied'],
  ['--muted-line', '--surface-2', DECOR, 'fabric card stripe (the card also carries text)'],
  ['--warm-line', '--surface-2', DECOR, 'summer-exposure card stripe'],
  ['--focus', '--bg', UI, 'focus ring on the page'],
  ['--focus', '--surface', UI, 'focus ring on a card'],
  // Text still drawn at an opacity (B5, 2026-10-21); the other dimmed states moved to --muted.
  ['--header-ink @ .85', '--header-bg', TEXT, 'footer text, at .85'],
  ['--ink @ .8', '--bg', TEXT, 'the About sign-off, at .8'],
]

// --- read the three token blocks ---------------------------------------------
function block(re) {
  const m = css.match(re)
  if (!m) return null
  const out = {}
  for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim()
  return out
}
const light = block(/:root\s*\{([\s\S]*?)\n\}/)
const darkMedia = block(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\n  \}/)
const darkStamp = block(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)
// The higher-contrast state over light (Settings, 2026-11-06).
const moreContrast = block(/:root\[data-contrast="more"\]\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)

const problems = []
if (!light) problems.push('could not read the :root token block from index.css')
if (!darkMedia) problems.push('could not read the prefers-color-scheme: dark block')
if (!darkStamp) problems.push('could not read the [data-theme="dark"] block')
if (!moreContrast) problems.push('could not read the [data-contrast="more"] block')

// --- colour maths -------------------------------------------------------------
// Alpha, for the one kind of background this app composes: translucent white over the
// header bar. parse() keeps only the channels, which is right for every solid colour and
// wrong for exactly this one.
function alphaOf(v, tokens, seen = new Set()) {
  v = String(v).trim()
  const varm = v.match(/^var\((--[\w-]+)/)
  if (varm) {
    if (seen.has(varm[1])) return 1
    seen.add(varm[1])
    return tokens[varm[1]] ? alphaOf(tokens[varm[1]], tokens, seen) : 1
  }
  const m = v.match(/^rgba\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+[\s,/]+([\d.]+)\s*\)/i)
  return m ? Number(m[1]) : 1
}

// A background is either a token or 'TOP over BASE'.
function resolveBg(bg, tokens) {
  const [top, base] = bg.split(/\s+over\s+/)
  if (!base) return tokens[bg] && parse(tokens[bg], tokens)
  const t = tokens[top] && parse(tokens[top], tokens)
  const b = tokens[base] && parse(tokens[base], tokens)
  if (!t || !b) return null
  const a = alphaOf(tokens[top], tokens)
  return t.map((c, i) => a * c + (1 - a) * b[i])
}
function parse(v, tokens, seen = new Set()) {
  v = String(v).trim()
  const varm = v.match(/^var\((--[\w-]+)/)
  if (varm) {
    if (seen.has(varm[1])) return null
    seen.add(varm[1])
    return tokens[varm[1]] ? parse(tokens[varm[1]], tokens, seen) : null
  }
  let m = v.match(/^#([0-9a-f]{6})$/i)
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
  m = v.match(/^#([0-9a-f]{3})$/i)
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16))
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (m) return [1, 2, 3].map((i) => Number(m[i]))
  return null
}

const chan = (c) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const lum = (rgb) => 0.2126 * chan(rgb[0]) + 0.7152 * chan(rgb[1]) + 0.0722 * chan(rgb[2])
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// --- check each theme ----------------------------------------------------------
const THEMES = light ? [
  ['light', { ...light }],
  ['dark (OS preference)', { ...light, ...(darkMedia || {}) }],
  ['dark (explicit toggle)', { ...light, ...(darkStamp || {}) }],
  ['light, higher contrast', { ...light, ...(moreContrast || {}) }],
] : []

const rows = []
for (const [themeName, tokens] of THEMES) {
  for (const [fg, bg, floor, what] of PAIRS) {
    const [fgTok, fgA] = fg.split(/\s*@\s*/)
    const b = resolveBg(bg, tokens)
    let f = tokens[fgTok] && parse(tokens[fgTok], tokens)
    if (f && b && fgA) f = f.map((c, i) => Number(fgA) * c + (1 - Number(fgA)) * b[i])
    if (!f || !b) {
      problems.push(`${themeName}: cannot resolve ${!f ? fg : bg} (${what})`)
      continue
    }
    const r = ratio(f, b)
    rows.push({ themeName, what, fg, bg, r, floor })
    if (floor && r < floor) {
      problems.push(`${themeName}: ${what} — ${fg} on ${bg} is ${r.toFixed(2)}:1, floor ${floor}:1`)
    }
  }
}

// The two dark definitions must agree. If the toggle and the OS preference produce
// different palettes, a reader gets one look from their system and another from the
// switch, and only one of them was ever designed.
if (darkMedia && darkStamp) {
  const keys = new Set([...Object.keys(darkMedia), ...Object.keys(darkStamp)])
  for (const k of keys) {
    if ((darkMedia[k] || '').trim() !== (darkStamp[k] || '').trim()) {
      problems.push(`dark themes disagree on ${k}: media ${darkMedia[k] || '(unset)'} vs `
        + `toggle ${darkStamp[k] || '(unset)'}`)
    }
  }
}

if (problems.length) {
  console.log(`\nqa-contrast FAILED: ${problems.length} problem(s).\n`)
  for (const p of problems) console.log('  ' + p)
  console.log('')
  process.exit(1)
}

const enforced = rows.filter((x) => x.floor)
const worst = enforced.sort((a, b) => a.r / a.floor - b.r / b.floor)[0]
console.log(`qa-contrast: ${rows.length} pairs across ${THEMES.length} themes `
  + `(${enforced.length} enforced, ${rows.length - enforced.length} decorative) -- OK`)
console.log(`  tightest enforced: ${worst.what} in ${worst.themeName}, `
  + `${worst.r.toFixed(2)}:1 against a floor of ${worst.floor}:1`)
const decor = rows.filter((x) => !x.floor).sort((a, b) => a.r - b.r)[0]
console.log(`  faintest decorative: ${decor.what} in ${decor.themeName}, ${decor.r.toFixed(2)}:1 `
  + '(reported, not a failure)')
console.log('  NOT checked: pairs not listed in this file, anything a component composes')
console.log('  at runtime, and whether the palette is any good to look at.')
