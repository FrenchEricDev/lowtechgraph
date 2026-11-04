/*
 * Plate QA, in the app (brief 02, step 11). Replaces scripts/plate-text-qa.js and
 * site-plate-qa.js, which ran inside the retired demo page. Run it on the dev server, in any
 * page that loads plate.css (a solution page):
 *
 *   const qa = await import('/scripts/qa-plates.browser.js'); await qa.run()
 *
 * Every plate, English and French, at two sheet widths: 840 (the desktop sheet, words on the
 * drawing, the title block) and 380 (a phone: numbered discs, dimensions enlarged, strokes x1.8).
 * Checks, all in drawing units (840 x 560):
 *   overlap   two of a plate's own texts or discs overlapping (boxes trimmed 2.5 top and bottom)
 *   frame     a visible text or disc outside the drawing's inner frame (26-814 x 26-534)
 *   title     a drawing's line or text under the title block (desktop)
 *   on-line   a label's letters on the plate's lines (> 8 shared pixels), as the old QA did
 *   house     a word across the roof, a wall, a floor or the ceiling tie (section plates,
 *             desktop; not inside a bubble, which paints over the house), as the old QA did;
 *             the riser's dashed edges and the partition hairline are left out, as there
 *   compass   the house's N or S (or the site's N) on the solution's own marks (desktop)
 *   far       the leader rule: a label whose box, grown by 24 units, reaches none of its own
 *             solution's marks or tinted areas (desktop). It needs moving next to its object,
 *             or a leader.
 * Resolves to { findings, counts }.
 */
import { PLATES, plateSvg } from '/src/illustrations/plates.js'
import { SITE_PLATES, sitePlateSvg } from '/src/illustrations/sitePlates.js'
import { numberLabels } from '/src/illustrations/plateLegend.js'

const W = 840, FAR = 24
let H = 560   // the sheet's height: 604 with its title band

async function mask(svgEl, keep) {
  // A black-on-transparent raster of the elements `keep` selects, strokes at a fixed width.
  const c = svgEl.cloneNode(true)
  c.setAttribute('width', W); c.setAttribute('height', H)
  for (const el of c.querySelectorAll('*')) {
    if (el.tagName === 'g' || el.tagName === 'clipPath' || el.tagName === 'mask' || el.tagName === 'defs') continue
    // A mask's own shapes (white sheet, black house) must stay as drawn, or what it masks vanishes.
    if (el.closest('mask')) continue
    if (!keep(el)) { el.setAttribute('display', 'none'); continue }
    if (el.tagName === 'text') el.setAttribute('style', 'fill:#000;stroke:none;font:600 11.5px "Source Sans 3",sans-serif')
    // A tint is an area: its fill counts (a label set in the room it names is next to it).
    else if (el.classList.contains('ov-tint')) el.setAttribute('style', 'fill:#000;stroke:none')
    else el.setAttribute('style', 'fill:none;stroke:#000;stroke-width:2.3')
  }
  const src = new XMLSerializer().serializeToString(c)
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src)
  await img.decode()
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H)
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 60 ? 1 : 0
  return m
}
const countIn = (m, b) => {
  let n = 0
  for (let y = Math.max(0, Math.floor(b.y)); y < Math.min(H, Math.ceil(b.y + b.h)); y++)
    for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(W, Math.ceil(b.x + b.w)); x++) n += m[y * W + x]
  return n
}
const inter = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

// The section house's solid lines: roof (outer and inner), both walls (both faces), the ceiling
// tie, the upper floor (both faces) and the ground floor.
const HOUSE = [[104, 196, 420, 68], [420, 68, 736, 196], [116, 196, 420, 84], [420, 84, 724, 196],
  [150, 186, 150, 448], [168, 186, 168, 448], [672, 186, 672, 448], [690, 186, 690, 448],
  [150, 186, 690, 186], [168, 300, 672, 300], [168, 312, 672, 312], [150, 434, 690, 434]]
const crosses = (b, [x1, y1, x2, y2]) => {
  for (let i = 0; i <= 80; i++) { const x = x1 + (x2 - x1) * i / 80, y = y1 + (y2 - y1) * i / 80; if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true }
  return false
}
const isFrame = (el) => el.tagName === 'rect' && ['18', '26'].includes(el.getAttribute('x'))
const inTitle = (el) => !!el.closest('.pl-title')
const inDisc = (el) => !!el.closest('.pl-disc')

export async function run({ widths = [840, 380], langs = ['en', 'fr'], only = null, debug = false } = {}) {
  await document.fonts.ready
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-12000px;top:0'
  document.body.appendChild(host)
  const findings = []
  const all = [...PLATES.map((p) => [p, plateSvg]), ...SITE_PLATES.map((p) => [p, sitePlateSvg])]
    .filter(([p]) => !only || only.includes(p.id))
  for (const [plate, render] of all) for (const lang of langs) for (const width of widths) {
    globalThis.__qaAt = `${plate.id} ${lang} ${width}`   // progress, for a long run
    const t = (en, fr) => (lang === 'fr' ? fr : en)
    // As the page shows it: no title block since 2026-10-21 (the title check stays for the day
    // a shared image carries one).
    const titleBlock = null
    const html = render(plate, { t, post: (p, f) => numberLabels(f).fragment, titleBlock })
    host.innerHTML = `<figure class="plate has-legend" style="width:${width}px;margin:0"><div class="plate-wide">${html}</div></figure>`
    const svg = host.querySelector('svg')
    H = +svg.getAttribute('viewBox').split(' ')[3]
    const sr = svg.getBoundingClientRect(), k = W / sr.width
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: (r.left - sr.left) * k, y: (r.top - sr.top) * k, w: r.width * k, h: r.height * k } }
    const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const tag = `${lang} ${width} ${plate.id}`
    // Visible texts (a disc counts as one item), with their words.
    const items = [
      ...[...svg.querySelectorAll('text')].filter((el) => !inDisc(el) && !inTitle(el) && shown(el) && /\bov-/.test(el.getAttribute('class') || ''))
        .map((el) => ({ el, b: box(el), word: el.textContent.trim(), label: el.classList.contains('ov-txt') })),
      // A disc is its circle (its leader, when it has one, would stretch the box).
      ...[...svg.querySelectorAll('.pl-disc')].filter(shown).map((el) => ({ el, b: box(el.querySelector('circle:not(.pl-disc-dot)')), word: '#' + el.textContent.trim(), disc: true })),
    ].filter((i) => i.word)
    // overlap
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = { ...items[i].b }, b = { ...items[j].b }
      // Two discs: by their centres (diagonal neighbours' boxes meet at the corners).
      if (items[i].disc && items[j].disc) {
        if (Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) < (a.w + b.w) / 2 - 3) findings.push(`${tag} overlap "${items[i].word}" / "${items[j].word}"`)
        continue
      }
      if (!items[i].disc) { a.y += 2.5; a.h -= 5 }
      if (!items[j].disc) { b.y += 2.5; b.h -= 5 }
      if (inter(a, b)) findings.push(`${tag} overlap "${items[i].word}" / "${items[j].word}"`)
    }
    // frame
    for (const it of items) {
      const b = it.b
      if (b.x < 26 || b.y < 26 || b.x + b.w > 814 || b.y + b.h > 534) findings.push(`${tag} frame "${it.word}"`)
    }
    const lines = await mask(svg, (el) => el.tagName !== 'text' && !isFrame(el) && !inTitle(el) && !inDisc(el)
      && !el.classList.contains('pl-paper') && !el.classList.contains('ov-tint'))
    // title block (desktop)
    const tb = svg.querySelector('.pl-title-box')
    if (tb && shown(tb)) {
      const tbb = box(tb)
      const n = countIn(lines, tbb)
      if (n > 4) findings.push(`${tag} title lines under the title block (${n} px)`)
      for (const it of items) if (inter(it.b, tbb)) findings.push(`${tag} title "${it.word}" under the title block`)
    }
    // on-line, per visible label
    const texts = await mask(svg, (el) => el.tagName === 'text' && el.classList.contains('ov-txt') && !inDisc(el) && shown(el))
    for (const it of items.filter((i) => i.label)) {
      let n = 0
      const b = it.b
      for (let y = Math.max(0, Math.floor(b.y)); y < Math.min(H, Math.ceil(b.y + b.h)); y++)
        for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(W, Math.ceil(b.x + b.w)); x++) n += texts[y * W + x] & lines[y * W + x]
      if (n > 8) findings.push(`${tag} on-line "${it.word}" (${n} px)`)
    }
    // house (section, desktop)
    if (width >= 600 && render === plateSvg) {
      const bubbles = [...svg.querySelectorAll('circle.ov-fill')].map((c) => [+c.getAttribute('cx'), +c.getAttribute('cy'), +c.getAttribute('r')]).filter((c) => c[2] > 30)
      const inBubble = (b) => bubbles.some(([cx, cy, r]) => Math.hypot(b.x - cx, b.y - cy) < r && Math.hypot(b.x + b.w - cx, b.y + b.h - cy) < r)
      for (const it of items.filter((i) => !i.disc && !i.el.hasAttribute('transform'))) {
        const b = { x: it.b.x, y: it.b.y + 2.5, w: it.b.w, h: it.b.h - 5 }
        if (!inBubble(b) && HOUSE.some((g) => crosses(b, g))) findings.push(`${tag} house "${it.word}" across the house`)
      }
    }
    // far (desktop): the label's own solution marks, grown by FAR
    if (width >= 600) {
      const marks = await mask(svg, (el) => el.tagName !== 'text' && [...el.classList].some((c) => /^ov-(line|fill|dash|hide|tint)$/.test(c)))
      // compass: the base's single letters, in the focus copy (the dimmed copy is under it)
      for (const el of svg.querySelectorAll('text.dr-txt')) {
        if (!/^[NS]$/.test(el.textContent.trim()) || !shown(el)) continue
        const b = box(el)
        if (countIn(marks, b) > 3) findings.push(`${tag} compass "${el.textContent.trim()}" on the drawing`)
      }
      // A name and the second lines set just under it ("SHADE SAIL" / "ON HOOKS", whose leader
      // reaches the object) are one annotation: their boxes are taken together.
      const subs = items.filter((i) => !i.label && !i.disc)
      for (const it of items.filter((i) => i.label)) {
        let u = { ...it.b }
        for (const s of subs) {
          const below = s.b.y - (u.y + u.h)
          if (below > -2 && below < 48 && s.b.x < u.x + u.w + 12 && u.x < s.b.x + s.b.w + 12) {
            const x2 = Math.max(u.x + u.w, s.b.x + s.b.w), y2 = Math.max(u.y + u.h, s.b.y + s.b.h)
            u = { x: Math.min(u.x, s.b.x), y: Math.min(u.y, s.b.y), w: 0, h: 0 }; u.w = x2 - u.x; u.h = y2 - u.y
          }
        }
        const g = { x: u.x - FAR, y: u.y - FAR, w: u.w + 2 * FAR, h: u.h + 2 * FAR }
        const near = countIn(marks, g)
        if (debug) findings.push(`${tag} debug "${it.word}" box ${[g.x, g.y, g.w, g.h].map(Math.round)} marks ${near} total ${marks.reduce((a, v) => a + v, 0)}`)
        if (!near) findings.push(`${tag} far "${it.word}"`)
      }
    }
  }
  host.remove()
  const counts = {}
  for (const f of findings) { const kind = f.split(' ')[3]; counts[kind] = (counts[kind] || 0) + 1 }
  return { plates: all.length, findings, counts }
}


/*
 * A contact sheet for the review: the given plates at `w` px, words on, each finding's label
 * boxed in red. Close it with sheet([]).
 *   qa.sheet(['SOL-031', 'SOL-095'], r.findings)
 */
export function sheet(ids, findings = [], { w = 410, lang = 'en', narrow = false } = {}) {
  document.getElementById('qa-sheet')?.remove()
  if (!ids.length) return 0
  const o = document.createElement('div')
  o.id = 'qa-sheet'
  o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg);overflow:auto;padding:4px;display:flex;flex-wrap:wrap;gap:4px;align-content:flex-start'
  const flagged = new Set(findings.filter((x) => x.startsWith(lang + ' ')).map((x) => x.split(' ')[2] + '|' + (x.match(/"(.*?)"/) || [])[1]))
  const t = (en, fr) => (lang === 'fr' ? fr : en)
  o.innerHTML = ids.map((id) => {
    const sec = PLATES.find((p) => p.id === id), p = sec || SITE_PLATES.find((q) => q.id === id)
    if (!p) return ''
    // narrow: as a phone shows it, numbered, with its legend in the caption
    let labels = []
    const post = narrow ? (q, f) => { const r = numberLabels(f); labels = r.labels; return r.fragment } : undefined
    const svg = (sec ? plateSvg : sitePlateSvg)(p, { t, post })
    return `<figure class="plate${narrow ? ' has-legend' : ''}" data-id="${id}" style="width:${w}px;margin:0;position:relative"><div class="plate-wide">${svg}</div>`
      + (narrow ? `<figcaption>${labels.map((l) => l.n + ' ' + l.text).join(' · ')}</figcaption>` : '')
      + `<span style="position:absolute;left:6px;top:4px;font:700 11px sans-serif;color:#e33">${id}</span></figure>`
  }).join('')
  document.body.appendChild(o)
  for (const f of o.querySelectorAll('figure')) for (const el of f.querySelectorAll('text.ov-txt')) {
    if (!flagged.has(f.dataset.id + '|' + el.textContent.trim())) continue
    const b = el.getBBox()
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    for (const [k, v] of Object.entries({ x: b.x - 3, y: b.y - 3, width: b.width + 6, height: b.height + 6, fill: 'none', stroke: '#e33', 'stroke-width': 3 })) r.setAttribute(k, v)
    el.parentNode.insertBefore(r, el)
  }
  return ids.length
}

/*
 * The placer, for the leader rule's "moves next to it": for each label `run` found far, the
 * nearest place beside its own solution that touches no line, clears every other text, stays in
 * the frame, fits the longer of its English and French words, and is reached from the object
 * without crossing a wall, floor or roof line. Returns { id, en, x, y, anchor } suggestions
 * (baseline coordinates, as the plates write them), or { id, en, none: true }.
 */
export async function place(findings, { maxD = 24 } = {}) {
  await document.fonts.ready
  const far = findings.filter((x) => / far /.test(x) && x.startsWith('en '))
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-12000px;top:0'
  document.body.appendChild(host)
  const out = []
  const integral = (m) => {
    const s = new Float64Array((W + 1) * (H + 1))
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += m[y * W + x]; s[(y + 1) * (W + 1) + x + 1] = s[y * (W + 1) + x + 1] + row } }
    return (x0, y0, x1, y1) => {
      x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1))
      if (x1 <= x0 || y1 <= y0) return 0
      return s[y1 * (W + 1) + x1] - s[y0 * (W + 1) + x1] - s[y1 * (W + 1) + x0] + s[y0 * (W + 1) + x0]
    }
  }
  for (const f of far) {
    const id = f.split(' ')[2], word = f.match(/"(.*)"/)[1]
    const sec = PLATES.find((p) => p.id === id), plate = sec || SITE_PLATES.find((p) => p.id === id)
    const render = sec ? plateSvg : sitePlateSvg
    H = 560
    host.innerHTML = `<figure class="plate" style="width:840px;margin:0"><div class="plate-wide">${render(plate, { t: (e) => e })}</div></figure>`
    const svg = host.querySelector('svg')
    const sr = svg.getBoundingClientRect(), k = W / sr.width
    const box = (el) => { const r = el.getBoundingClientRect(); return [(r.left - sr.left) * k, (r.top - sr.top) * k, (r.right - sr.left) * k, (r.bottom - sr.top) * k] }
    const label = [...svg.querySelectorAll('text.ov-txt')].find((el) => el.textContent.trim() === word)
    // The French word, from the same plate rendered in French.
    const frHtml = render(plate, { t: (e, fr) => fr })
    const tmp = document.createElement('div'); tmp.innerHTML = frHtml
    const labelsEn = [...svg.querySelectorAll('text.ov-txt')], i = labelsEn.indexOf(label)
    const frWord = [...tmp.querySelectorAll('text.ov-txt')][i]?.textContent.trim() || word
    // Sizes of both words, as set: width, and the box's top and bottom about the baseline.
    const probe = (w) => { const el = label.cloneNode(); el.textContent = w; el.setAttribute('x', 0); el.setAttribute('y', 0); el.setAttribute('text-anchor', 'start'); el.removeAttribute('transform'); svg.appendChild(el); const b = el.getBBox(); el.remove(); return b }
    const be = probe(word), bf = probe(frWord)
    const lw = Math.max(be.width, bf.width) + 4, top = Math.min(be.y, bf.y) + 2, bot = Math.max(be.y + be.height, bf.y + bf.height) - 2
    const others = [...svg.querySelectorAll('text')].filter((el) => el !== label && el.getBoundingClientRect().width > 0).map(box)
    label.setAttribute('display', 'none')
    const lines = await mask(svg, (el) => el.tagName !== 'text' && !isFrame(el) && !el.classList.contains('pl-paper') && !el.classList.contains('ov-tint'))
    const marks = await mask(svg, (el) => el.tagName !== 'text' && [...el.classList].some((c) => /^ov-(line|fill|dash|hide|tint)$/.test(c)))
    const house = await mask(svg, (el) => el.tagName !== 'text' && !isFrame(el) && [...el.classList].some((c) => /^dr-(line|fill)$/.test(c)))
    const L = integral(lines), M = integral(marks)
    const txt = new Uint8Array(W * H)
    for (const [x0, y0, x1, y1] of others) for (let y = Math.max(0, y0 - 4 | 0); y < Math.min(H, y1 + 4); y++) for (let x = Math.max(0, x0 - 4 | 0); x < Math.min(W, x1 + 4); x++) txt[y * W + x] = 1
    const T = integral(txt)
    let cx = 0, cy = 0, cn = 0
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (marks[y * W + x]) { cx += x; cy += y; cn++ }
    cx /= cn || 1; cy /= cn || 1
    const cands = []
    for (let y = 40; y <= 528; y += 2) for (let x = 30; x <= 810; x += 2) for (const anchor of ['start', 'end']) {
      const x0 = anchor === 'start' ? x : x - lw, x1 = x0 + lw, y0 = y + top, y1 = y + bot
      if (x0 < 30 || x1 > 810 || y0 < 30 || y1 > 530) continue
      // As the on-line check allows: a few pixels of a line under a word's box.
      if (L(x0 - 1, y0 - 1, x1 + 1, y1 + 1) > 8 || T(x0, y0, x1, y1) > 0) continue
      let d = -1
      for (let g = 3; g <= maxD; g += 3) if (M(x0 - g, y0 - g, x1 + g, y1 + g) > 0) { d = g; break }
      if (d < 0 || M(x0, y0, x1, y1) > lw * 2) continue   // a label set on a tint is fine, on the object is not
      cands.push({ x, y, anchor, x0, y0, x1, y1, d, score: d + 0.015 * Math.hypot((x0 + x1) / 2 - cx, (y0 + y1) / 2 - cy) })
    }
    cands.sort((a, b) => a.score - b.score)
    let best = null
    for (const c of cands.slice(0, 400)) {
      // The nearest mark pixel to the box, and the straight way there: no house line on it.
      let bx = -1, by = -1, bd = 1e9
      const R = maxD + 2
      for (let y = Math.max(0, c.y0 - R | 0); y < Math.min(H, c.y1 + R); y++) for (let x = Math.max(0, c.x0 - R | 0); x < Math.min(W, c.x1 + R); x++) {
        if (!marks[y * W + x]) continue
        const dx = Math.max(c.x0 - x, 0, x - c.x1), dy = Math.max(c.y0 - y, 0, y - c.y1), dd = dx * dx + dy * dy
        if (dd < bd) { bd = dd; bx = x; by = y }
      }
      if (bx < 0) continue
      const sx = Math.min(Math.max(bx, c.x0), c.x1), sy = Math.min(Math.max(by, c.y0), c.y1)
      const n = Math.ceil(Math.hypot(bx - sx, by - sy))
      let crossed = 0
      for (let s = 1; s < n - 2; s++) { const px = Math.round(sx + (bx - sx) * s / n), py = Math.round(sy + (by - sy) * s / n); crossed += house[py * W + px] }
      if (crossed) continue
      best = { ...c, near: [bx, by] }; break
    }
    // Further than the rule's 24 units: the spot comes with a leader to the nearest point.
    if (best && best.d > 24) best.to = best.near
    out.push(best ? { id, en: word, fr: frWord, x: best.x, y: best.y, anchor: best.anchor, ...(best.to ? { to: best.to } : {}) } : { id, en: word, fr: frWord, none: true })
  }
  host.remove()
  return out
}

/* The contact sheet with suggestions applied in place, to review them before they are written. */
export function preview(suggestions, opts = {}) {
  const ids = [...new Set(suggestions.map((s) => s.id))]
  const n = sheet(ids, [], opts)
  for (const s of suggestions) {
    if (s.none) continue
    const f = document.querySelector(`#qa-sheet figure[data-id="${s.id}"]`)
    const el = f && [...f.querySelectorAll('text.ov-txt')].find((x) => x.textContent.trim() === (opts.lang === 'fr' ? s.fr : s.en))
    if (!el) continue
    el.setAttribute('x', s.x); el.setAttribute('y', s.y); el.setAttribute('text-anchor', s.anchor)
    el.style.fill = '#e33'
  }
  return n
}

/*
 * For the leader rule's other remedy: for each far label, the nearest point of its object (its
 * outline, fill or tint; rays and dashed routes left out) to the label's box, the leader's
 * length, and whether the straight leader would cross another text.
 */
export async function leaders(findings) {
  await document.fonts.ready
  const far = findings.filter((x) => / far /.test(x) && x.startsWith('en '))
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-12000px;top:0'
  document.body.appendChild(host)
  const out = []
  for (const f of far) {
    const id = f.split(' ')[2], word = f.match(/"(.*)"/)[1]
    const sec = PLATES.find((p) => p.id === id), plate = sec || SITE_PLATES.find((p) => p.id === id)
    H = 560
    host.innerHTML = `<figure class="plate" style="width:840px;margin:0"><div class="plate-wide">${(sec ? plateSvg : sitePlateSvg)(plate, { t: (e) => e })}</div></figure>`
    const svg = host.querySelector('svg')
    const sr = svg.getBoundingClientRect(), k = W / sr.width
    const box = (el) => { const r = el.getBoundingClientRect(); return [(r.left - sr.left) * k, (r.top - sr.top) * k, (r.right - sr.left) * k, (r.bottom - sr.top) * k] }
    const label = [...svg.querySelectorAll('text.ov-txt')].find((el) => el.textContent.trim() === word)
    const [x0, y0, x1, y1] = box(label)
    const others = [...svg.querySelectorAll('text')].filter((el) => el !== label && el.getBoundingClientRect().width > 0).map(box)
    const obj = await mask(svg, (el) => el.tagName !== 'text' && [...el.classList].some((c) => /^ov-(line|fill|tint)$/.test(c)))
    let bx = -1, by = -1, bd = 1e9
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!obj[y * W + x]) continue
      const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1), dd = dx * dx + dy * dy
      if (dd < bd) { bd = dd; bx = x; by = y }
    }
    const sx = Math.min(Math.max(bx, x0), x1), sy = Math.min(Math.max(by, y0), y1)
    const hits = others.filter(([a, b, c, d]) => {
      for (let s = 0.05; s < 0.95; s += 0.02) { const px = sx + (bx - sx) * s, py = sy + (by - sy) * s; if (px > a && px < c && py > b && py < d) return true }
      return false
    }).length
    out.push({ id, en: word, to: [bx, by], len: Math.round(Math.sqrt(bd)), crossesText: hits })
  }
  host.remove()
  return out
}
