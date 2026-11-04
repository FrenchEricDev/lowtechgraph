/*
 * Labels on a phone (brief 02, B; agreed 2026-10-20). Below about 500 px the words leave the
 * drawing: each label gets a numbered disc beside the point it names, and the words are listed
 * under the sheet as a legend at text size, in the reading language. The legend and the
 * drawing's text alternative come from the one list built here (A-A17).
 *
 * Works on a plate's own fragment (its draw() output), never the base, so the house's N and S
 * and the scale bar are left alone. The words stay in the SVG; CSS shows words or discs by the
 * sheet's width (plate.css, the `plate` container).
 */

// On screen the disc is about 16 px at a phone's 356 px sheet: 0.42 px per unit.
const R = 18
const GAP = 2 * R + 3

// Kept in capitals when the legend turns a label into sentence case.
const KEEP = new Set(['AC', 'DC', 'CA', 'CC', 'LED', 'PV', 'WC', 'TLUD'])

// A dimension stays a dimension on the drawing ("+8.2 m", "TO 9 m"), enlarged, not numbered.
export const isDimension = (w) => /\d/.test(w) && !/[A-Za-zÀ-ÿ]{3,}/.test(w.replace(/\b(TO|À)\b/g, ''))

/* "INVERTER, DC TO AC" -> "Inverter, DC to AC". */
export function sentenceCase(raw) {
  const s = raw.replace(/\s+/g, ' ').trim()
  const low = s.split(/([^A-Za-zÀ-ÿ0-9]+)/).map((p) => (KEEP.has(p) ? p : p.toLowerCase())).join('')
  const i = low.search(/[A-Za-zÀ-ÿ]/)
  return i < 0 ? low : low.slice(0, i) + low[i].toUpperCase() + low.slice(i + 1)
}

const attr = (a, k) => { const m = a.match(new RegExp(`\\b${k}="([^"]*)"`)); return m ? m[1] : null }

/*
 * Numbers the labels of one plate fragment. Returns the fragment with a disc after each
 * numbered label (the label gains `pl-word`, which hides it on a narrow sheet) and the legend
 * list. A label drawn twice keeps one number (the ram pump draws two weirs and two rams).
 */
export function numberLabels(fragment) {
  const labels = []
  const numOf = new Map()
  const discs = []
  const keep = []   // dimensions left on the drawing: boxes the discs keep clear of
  // Names (.ov-txt) and their notes (.ov-num, the second lines) alike; a dimension in either
  // stays on the drawing (enlarged on a phone) and is not numbered.
  const re = /<text\b([^>]*\bclass="([^"]*\bov-(?:txt|num)\b[^"]*)"[^>]*)>([\s\S]*?)<\/text>/g
  const found = []
  for (const m of fragment.matchAll(re)) {
    const word = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (word) found.push({ m, word, attrs: m[1], cls: m[2], note: !/\bov-txt\b/.test(m[2]) })
  }
  // Names take the first numbers, notes the next: the legend reads name first.
  for (const f of [...found.filter((x) => !x.note), ...found.filter((x) => x.note)]) {
    if (isDimension(f.word)) continue
    if (!numOf.has(f.word)) { numOf.set(f.word, labels.length + 1); labels.push({ n: labels.length + 1, raw: f.word, text: sentenceCase(f.word) }) }
  }
  let at = 0, out = ''
  for (const f of found) {
    const { m, word, attrs, cls } = f
    out += fragment.slice(at, m.index)
    at = m.index + m[0].length
    const x = +attr(attrs, 'x'), y = +attr(attrs, 'y')
    const anchor = attr(attrs, 'text-anchor') || 'start'
    if (isDimension(word)) {
      // Its box at a phone's 19 px (monospace .ov-num: 0.6 em a character).
      const w = word.length * (f.note ? 11.4 : 12)
      const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
      keep.push([x0 - 3, y - 17, x0 + w + 3, y + 5])
      out += m[0].replace(`class="${cls}"`, `class="${cls} pl-keep"`)
      continue
    }
    // Beside the point the label hangs from: its start, its end, or its middle.
    let cx = anchor === 'start' ? x + R - 2 : anchor === 'end' ? x - R + 2 : x
    let cy = y - 4
    const rot = (attr(attrs, 'transform') || '').match(/rotate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/)
    if (rot) {
      const a = (+rot[1] * Math.PI) / 180, ox = +rot[2], oy = +rot[3]
      const dx = cx - ox, dy = cy - oy
      cx = ox + dx * Math.cos(a) - dy * Math.sin(a)
      cy = oy + dx * Math.sin(a) + dy * Math.cos(a)
    }
    out += m[0].replace(`class="${cls}"`, `class="${cls} pl-word"`) + `\u0000disc${discs.length}\u0000`
    discs.push({ cx, cy, n: numOf.get(word) })
  }
  out += fragment.slice(at)
  /*
   * A crowd (more than three discs, each within 90 units of another) is laid out in a line beside
   * it, on the side with the most room, each disc with a hair leader back to its part (Eric,
   * 2026-10-21: five discs stacked on the heat-recovery unit covered it).
   */
  const home = discs.map((d) => [d.cx, d.cy])
  const parent = discs.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < discs.length; i++) for (let j = i + 1; j < discs.length; j++) {
    if (Math.hypot(home[i][0] - home[j][0], home[i][1] - home[j][1]) < 90) parent[find(i)] = find(j)
  }
  const crowds = new Map()
  discs.forEach((_, i) => { const r = find(i); crowds.set(r, [...(crowds.get(r) || []), i]) })
  const MG = R + 4
  for (const g of crowds.values()) {
    if (g.length <= 3) continue
    const xs = g.map((i) => home[i][0]), ys = g.map((i) => home[i][1])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const room = { left: x0 - 26, right: 814 - x1, up: y0 - 26, down: 534 - y1 }
    const side = Object.keys(room).sort((a, b) => room[b] - room[a])[0]
    const span = (g.length - 1) * GAP
    const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
    if (side === 'left' || side === 'right') {
      const cx = clamp(side === 'left' ? x0 - 46 : x1 + 46, 26 + MG, 814 - MG)
      const top = clamp(mean(ys) - span / 2, 26 + MG, 534 - MG - span)
      g.sort((a, b) => home[a][1] - home[b][1]).forEach((i, k) => Object.assign(discs[i], { cx, cy: top + k * GAP, lead: home[i] }))
    } else {
      const cy = clamp(side === 'up' ? y0 - 46 : y1 + 46, 26 + MG, 534 - MG)
      const left = clamp(mean(xs) - span / 2, 26 + MG, 814 - MG - span)
      g.sort((a, b) => home[a][0] - home[b][0]).forEach((i, k) => Object.assign(discs[i], { cx: left + k * GAP, cy, lead: home[i] }))
    }
  }
  /*
   * Discs are pushed apart (stacked labels sit 22 units apart; a disc is 36 across), off the
   * dimensions that stay, and kept inside the inner frame, in the same passes so a clamp never
   * undoes a separation.
   */
  const M = R + 4
  for (let pass = 0; pass < 60; pass++) {
    let moved = false
    for (let i = 0; i < discs.length; i++) for (let j = i + 1; j < discs.length; j++) {
      const a = discs[i], b = discs[j]
      const dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy)
      if (d >= GAP) continue
      const ux = d ? dx / d : 0, uy = d ? dy / d : 1, push = (GAP - d) / 2
      a.cx -= ux * push; a.cy -= uy * push; b.cx += ux * push; b.cy += uy * push
      moved = true
    }
    for (const d of discs) for (const [x0, y0, x1, y1] of keep) {
      if (d.cx + M <= x0 || d.cx - M >= x1 || d.cy + M <= y0 || d.cy - M >= y1) continue
      // Out by the shortest way.
      const opts = [[x0 - M - d.cx, 0], [x1 + M - d.cx, 0], [0, y0 - M - d.cy], [0, y1 + M - d.cy]]
      const [mx, my] = opts.sort((p, q) => Math.hypot(...p) - Math.hypot(...q))[0]
      d.cx += mx; d.cy += my; moved = true
    }
    for (const d of discs) {
      const cx = Math.min(814 - M, Math.max(26 + M, d.cx)), cy = Math.min(534 - M, Math.max(26 + M, d.cy))
      if (cx !== d.cx || cy !== d.cy) { d.cx = cx; d.cy = cy; moved = true }
    }
    if (!moved) break
  }
  out = out.replace(/\u0000disc(\d+)\u0000/g, (m, i) => {
    const d = discs[+i]
    const cx = d.cx.toFixed(1), cy = d.cy.toFixed(1)
    // A disc moved out of a crowd: a hair line from its edge back to the part, a dot there.
    let lead = ''
    if (d.lead) {
      const [ax, ay] = d.lead, dx = ax - d.cx, dy = ay - d.cy, len = Math.hypot(dx, dy)
      if (len > R + 4) {
        const sx = (d.cx + dx / len * R).toFixed(1), sy = (d.cy + dy / len * R).toFixed(1)
        lead = `<path class="pl-disc-lead" d="M${sx},${sy} L${ax.toFixed(1)},${ay.toFixed(1)}"/><circle class="pl-disc-dot" cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3"/>`
      }
    }
    return `<g class="pl-disc" aria-hidden="true">${lead}<circle cx="${cx}" cy="${cy}" r="${R}"/>`
      + `<text x="${cx}" y="${(d.cy + 7.5).toFixed(1)}" text-anchor="middle">${d.n}</text></g>`
  })
  return { fragment: out, labels }
}

/* "Rocket mass heater, drawn in the house in section. Labelled: feed, heat riser, mass bench, flue." */
export function altText(name, base, labels, ui, fill) {
  const lead = fill(base === 'site' ? ui.illustration.altSite : ui.illustration.altSection, { name })
  if (!labels.length) return lead
  const list = labels.map((l) => l.text.charAt(0).toLowerCase() + l.text.slice(1))
    .map((w, i) => (KEEP.has(labels[i].text.split(/[^A-Za-z]/)[0]) ? labels[i].text : w))
  return lead + ' ' + fill(ui.illustration.altLabelled, { list: list.join(', ') })
}

/*
 * The title block (brief 02, D): the solution's name, its need and the site's name, at the
 * right of a band the sheet gains under its drawing (TITLE_BAND units): the house's width
 * dimension runs along the bottom of every section plate, so no corner of the drawing is free.
 * Drawn into the SVG, so the drawing says what it is wherever it goes. Widths are estimated
 * (an SVG string cannot measure text): about 0.56 em a letter at these sizes.
 */
export const TITLE_BAND = 44
const BRAND = 'Lowtech Graph'
const est = (s, px, ls = 0) => s.length * (px * 0.56 + ls)
function titleLayout(tb) {
  // A long name takes two lines, split at the space nearest its middle.
  let lines = [tb.name]
  if (tb.name.length > 40) {
    const mid = tb.name.length / 2
    let cut = -1
    for (let i = 0; i < tb.name.length; i++) if (tb.name[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i
    if (cut > 0) lines = [tb.name.slice(0, cut), tb.name.slice(cut + 1)]
  }
  const need = tb.need.toUpperCase()
  const brandW = est(BRAND, 9.5) + 16
  const w = Math.round(Math.min(440, Math.max(230, ...lines.map((l) => est(l, 13) + 18), est(need, 9, 0.9) + 18 + brandW)))
  const nameH = 8 + lines.length * 15
  return { lines, need, brandW, w, nameH, h: nameH + 17 }
}
/* The band a sheet gains for its title block: 44 units, or more for a name on two lines. */
export const titleBand = (tb) => (tb ? Math.max(TITLE_BAND, titleLayout(tb).h + 8) : 0)
export function titleBlockSvg(tb, bottom = 534 + TITLE_BAND) {
  if (!tb) return ''
  const q = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const { lines, need, brandW, w, nameH, h } = titleLayout(tb)
  const x = 814 - w, y = bottom - 4 - h
  return `<g class="pl-title">
  <rect class="pl-title-box" x="${x}" y="${y}" width="${w}" height="${h}"/>
  <path class="pl-title-rule" d="M${x} ${y + nameH}H${x + w}M${x + w - brandW} ${y + nameH}V${y + h}"/>
  ${lines.map((l, i) => `<text class="pl-title-name" x="${x + 9}" y="${y + 18 + i * 15}">${q(l)}</text>`).join('')}
  <text class="pl-title-need" x="${x + 9}" y="${y + h - 5.5}">${q(need)}</text>
  <text class="pl-title-brand" x="${x + w - brandW + 8}" y="${y + h - 5.5}">${BRAND}</text>
</g>`
}
