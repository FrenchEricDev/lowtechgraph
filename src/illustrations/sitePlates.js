// The SITE-PLAN plates: the second base drawing, for the catalogue rows that are not in the house
// (a spring, a stream, a mast, a reed bed, a cleared buffer). EXTRACTED from Demo-Site-Plan.html by
// scripts/port_site_plates.py, the same way plates.js is extracted from the section demo, so the
// drawings Eric reviewed and the drawings the app renders cannot drift apart.
//
// THE PROJECTION is a plan oblique: the plan rotated but never distorted, heights extruded straight
// up at true length -- so distances, angles and falls all read true in one drawing. The house, the
// terrain, the stream and the existing trees are the base, drawn on every plate and dimmed outside
// the plate's focus zone; a plate's overlay holds only what a person builds.
//
// WHAT IS DIFFERENT FROM THE DEMO, as with the section plates: no cartouche and no title (the page's
// <h1> names the solution), the site's colour tokens instead of a print palette (plate.css), and a
// scale bar drawn along the east axis -- the only horizontal direction this projection keeps true.
//
// PROPOSALS STAY OUT. A plate flagged `proposal: true` in the demo is awaiting Eric's review; it is
// carried across with the rest but sitePlateFor() never returns it.
//
// Edit the DEMO, never the spliced region below, then run:  python scripts/port_site_plates.py

import { titleBlockSvg, titleBand } from './plateLegend.js'
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
let uid = 0
// rounds drawing coordinates to a tenth of a unit; the demo defines it just above the spliced
// stretch, so the app declares it here
const r1 = (v) => Math.round(v * 10) / 10

/* >>> spliced from Demo-Site-Plan.html -- do not edit here */
/* ==========================================================================
   THE PROJECTION -- plan oblique, 30/60.
   The plan is RIGIDLY ROTATED (not sheared, not foreshortened) and height is extruded
   straight up at true length. The consequences are the whole reason for choosing it:
     - a distance measured in plan is true, in any direction
     - an angle measured in plan is true
     - a height is true, and it displaces a mark straight DOWN the page and nowhere else
     - so ONE scale bar serves all three axes -- drawn along an axis, never flat across
       the page, because a page-horizontal length is not a direction this projection measures
   Axes on screen, for (e metres east, n metres north, z metres up):
     east  -> ( cos -30, sin -30) = ( .866, -.500)   right and up
     north -> ( cos-120, sin-120) = (-.500, -.866)   left and up     (perpendicular: dot = 0)
     up    -> ( 0, -1 )
   North is therefore upper-LEFT and south lower-RIGHT, which is the section sheet's own
   left-to-right order, so the two drawings can be read against one another.
   ========================================================================== */
const S = 6.6, OX = 170, OY = 498
const P = (e, n, z = 0) =>
  [r1(OX + S * (0.866 * e - 0.5 * n)), r1(OY - S * (0.5 * e + 0.866 * n + z))]

/* The land. ONE surface: a cross-slope profile f(e) falling west to the stream, plus a steady
   0.14 m per metre fall to the south. That second term is what gives the stream its own
   gradient -- 14%, and SOL-177 asks for "roughly 10%+". The bench at e 19..35 is where the
   house sits, and it shows on the drawing as the place the contours spread apart. */
const SITE = { e0: 0, e1: 54, n0: 0, n1: 30 }
function f(e) {
  if (e <= 10) return 0.1900 * e                      // the bank above the stream
  if (e <= 19) return 1.90 + 0.0667 * (e - 10)        // the lower field
  if (e <= 35) return 2.50 + 0.0150 * (e - 19)        // the bench
  return 2.74 + 0.2200 * (e - 35)                     // the upper slope
}
const Zg = (e, n) => f(e) + 0.14 * n
const G  = (e, n) => P(e, n, Zg(e, n))                // a point lying ON the ground
const pathOf = (pts, close) =>
  pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ') + (close ? ' Z' : '')

/* the house, on a bench cut level at 4.70 m. 12 m east-west by 9 m north-south, ridge running
   EAST-WEST -- which is why the section, cut north-south at e = 27, sees a gable. */
const H = { e0: 21, e1: 33, n0: 10.5, n1: 19.5, z: 4.70, wall: 4.2, ridge: 6.3, cut: 27 }
const HTOP = H.z + H.wall, HRIDGE = H.z + H.ridge, HMID = (H.n0 + H.n1) / 2

/* The house's outline ON THE SHEET. Ground behind the house is hidden by it, so a plate whose marks
   run round the house -- a zone ring, arrows on every side -- sets `behind: 'mask'` and those marks
   are masked by this silhouette, painted in the order the eye would see them. Ground in front of
   the south and west walls projects outside the silhouette, so only the hidden part goes. Found by
   SiteQA.occlusion(): SOL-118's rings had been drawn across the roof since the first test sheet. */
const HOUSE_SIL = (() => {
  const pts = []
  for (const e of [H.e0, H.e1]) for (const n of [H.n0, H.n1]) for (const z of [H.z, HTOP]) pts.push(P(e, n, z))
  pts.push(P(H.e0, HMID, HRIDGE), P(H.e1, HMID, HRIDGE))
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const s2 = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), lo = [], up = []
  for (const q of s2) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q) }
  for (const q of s2.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q) }
  return pathOf(lo.slice(0, -1).concat(up.slice(0, -1)), true)
})()

/* the water. The stream is base, authored once and drawn on every plate. The weir, the ram and
   the tank are SOL-177's -- kept here only so the long section and the plan read one set of
   numbers.
   THE TANK STANDS HIGH ON PURPOSE (Eric, 2026-09-14: does it need to be uphill?). Yes: a
   gravity-fed tank's height above the taps IS the water pressure, 10 m for 1 bar, and the ram
   lifts it there for nothing. So it goes in the south-east corner -- the nearest ground that is
   higher than the house floor, reached by a pipe that is straight in plan -- and a 2.5 m stand
   makes up what that corner lacks in height. */
const W = {
  streamE: 2.2, bankA: 1.0, bankB: 3.4, depth: 0.32,
  weir:  [2.2, 27], pump: [2.4, 5], tank: [51.5, 3], stand: 2.5, spring: [51, 26],
}
const zWater = (e, n) => Zg(e, n) - W.depth
const HEAD_DRIVE = r1(zWater(2.2, 27) - (Zg(2.4, 5) - 0.10))     // 2.8 m
const TANK_Z     = Zg(51.5, 3) + 2.5                              // the tank floor, on its stand
const HEAD_LIFT  = r1(TANK_Z - (Zg(2.4, 5) - 0.10))               // 8.2 m: the ram's lift

/* existing vegetation. BASE, not overlay: SOL-118 manages trees that are already there and
   SOL-010 is about what one of them hides. */
const TREES = [[7, 24, 6.0, 2.6], [12, 1.8, 5.0, 2.2], [17, 26, 4.2, 1.9], [25, 6.8, 4.6, 2.0],
               [38, 6, 5.2, 2.2], [44, 27, 7.0, 3.0], [49, 12, 6.0, 2.6], [41, 23, 6.0, 2.6],
               [5, 9, 5.0, 2.2], [48, 10, 4.4, 2.0], [36, 25, 4.8, 2.1], [34, 17, 4.0, 1.8]]

/* ------------------------------------------------------------- base parts */
const EB = [0, 10, 19, 35, 54]                         // the profile's break points

function hatchPath(d, step) {
  const id = 'hp' + (uid++)
  let s = `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">`
  for (let i = -260; i < 760; i += step) s += `<line class="dr-line hair" x1="${26 + i}" y1="545" x2="${26 + i + 62}" y2="170"/>`
  return s + '</g>'
}
function groundSolid() {
  const south = EB.map((e) => G(e, SITE.n0))
  const north = EB.slice().reverse().map((e) => G(e, SITE.n1))
  const face = pathOf(south.concat([G(SITE.e1, SITE.n1)], north, [G(SITE.e0, SITE.n0)]), true)
  /* The cut face on the two NEAR edges stands on ONE horizontal datum (Eric, 2026-09-14). Its
     bottom line is therefore straight, its top line is the ground, and the hatched face grows
     where the hill rises -- which is the slope, drawn, with nothing else needed to say it. The
     earlier version hung the face a fixed depth below the ground, so both lines climbed
     together and the slope read as a tilted slab. */
  const DATUM = -1.2
  const skirtS = pathOf(south.concat([P(SITE.e1, SITE.n0, DATUM), P(SITE.e0, SITE.n0, DATUM)]), true)
  const wN = []
  for (let n = SITE.n0; n <= SITE.n1 + .001; n += 3) wN.push(G(SITE.e0, n))
  const skirtW = pathOf(wN.concat([P(SITE.e0, SITE.n1, DATUM), P(SITE.e0, SITE.n0, DATUM)]), true)
  return `<path class="dr-fill" d="${face}"/><path class="dr-fill" d="${skirtS}"/>
          <path class="dr-fill" d="${skirtW}"/>${hatchPath(skirtS, 7)}${hatchPath(skirtW, 7)}`
}

/* the stream, in the channel the profile already makes at the west edge. It flows SOUTH.
   WATER READS AS WATER (Eric, 2026-09-14): straight banks and a straight centre line looked like
   a ditch drawn with a ruler. The banks now wander -- two sines of different period, so the
   wobble never repeats in step -- and the channel carries short wave marks, the drafting sign for
   moving water, instead of a line down its middle. The flow arrow stays. */
function stream() {
  const wob = (n, ph) => 0.28 * Math.sin(n * 0.9 + ph) + 0.14 * Math.sin(n * 2.3 + ph * 1.7)
  const a = [], b = []
  for (let n = SITE.n0; n <= SITE.n1 + .001; n += 0.5) {
    a.push(G(W.bankA + wob(n, 0), n)); b.push(G(W.bankB + wob(n, 2.1), n))
  }
  /* a wave mark: a short S laid along the flow, on the water surface */
  const wave = (e, n) => {
    const pts = []
    for (let k = 0; k <= 8; k++) {
      const u = k / 8, nn = n - 1.6 * u
      pts.push(P(e + 0.22 * Math.sin(u * Math.PI * 2), nn, zWater(e, nn) + 0.1))
    }
    return `<path class="dr-line hair" d="${pathOf(pts)}"/>`
  }
  let marks = ''
  for (let n = 29; n > 1.5; n -= 3.1) marks += wave(1.75, n) + wave(2.65, n - 1.55)
  return `<path class="dr-line hair" d="${pathOf(a)}"/><path class="dr-line hair" d="${pathOf(b)}"/>
          ${marks}
          ${arrowAt(P(W.streamE, 8, zWater(W.streamE, 8)), P(W.streamE, 11, zWater(W.streamE, 11)), 'dr-line hair')}`
}

/* the spring, high on the east slope: a seep, a short rivulet, and then it sinks away */
function spring() {
  const a = G(W.spring[0], W.spring[1]), b = G(49.4, 24.6), c = G(48.2, 22.6)
  return `<path class="dr-line" d="M${a[0] - 6},${a[1]} a6,3.4 0 0 1 12,0"/>
          <path class="dr-line hair" d="${pathOf([a, b, c])}"/>
          <path class="dr-line hair" style="opacity:.45" d="${pathOf([c, G(47.6, 21), G(47.4, 19.6)])}"/>`
}

function trees(list, cls) {
  return list.map(([e, n, h, r]) => {
    const foot = G(e, n), top = P(e, n, Zg(e, n) + h * 0.72)
    return `<line class="${cls} hair" x1="${foot[0]}" y1="${foot[1]}" x2="${foot[0]}" y2="${r1(top[1] + r * S * 0.55)}"/>
            <circle class="${cls} hair" cx="${top[0]}" cy="${top[1]}" r="${r1(r * S)}" fill="none"/>`
  }).join('')
}

/* the house as a solid. We look from above the south-west, so the visible faces are the south
   wall, the west wall and the west gable -- and BOTH roof planes, because the view looks down
   on the ridge. Painter's order: far side first. */
function house() {
  const q = (pts) => pathOf(pts.map((p) => P(p[0], p[1], p[2])), true)
  const bench = pathOf([G(19.5, 9), G(34.5, 9), G(34.5, 21), G(19.5, 21)], true)
  return `
    <path class="dr-line hair" style="opacity:.7" d="${bench}"/>
    <path class="dr-fill" d="${q([[H.e0, HMID, HRIDGE], [H.e1, HMID, HRIDGE], [H.e1, H.n1, HTOP], [H.e0, H.n1, HTOP]])}"/>
    <path class="dr-fill" d="${q([[H.e0, H.n0, H.z], [H.e0, H.n1, H.z], [H.e0, H.n1, HTOP], [H.e0, HMID, HRIDGE], [H.e0, H.n0, HTOP]])}"/>
    <path class="dr-fill" d="${q([[H.e0, H.n0, H.z], [H.e1, H.n0, H.z], [H.e1, H.n0, HTOP], [H.e0, H.n0, HTOP]])}"/>
    <path class="dr-fill" d="${q([[H.e0, H.n0, HTOP], [H.e1, H.n0, HTOP], [H.e1, HMID, HRIDGE], [H.e0, HMID, HRIDGE]])}"/>
    <path class="dr-line hair" d="${q([[26, H.n0, H.z], [27.3, H.n0, H.z], [27.3, H.n0, H.z + 2.1], [26, H.n0, H.z + 2.1]])}"/>
    <path class="dr-line hair" d="${q([[29.2, H.n0, H.z + 1], [31.8, H.n0, H.z + 1], [31.8, H.n0, H.z + 2.6], [29.2, H.n0, H.z + 2.6]])}"/>
    <path class="dr-line hair" d="${q([[H.e0, 14, H.z + 1], [H.e0, 16.8, H.z + 1], [H.e0, 16.8, H.z + 2.6], [H.e0, 14, H.z + 2.6]])}"/>`
}

/* the access track, in from the road along the south edge */
function track() {
  const spine = [[46, 1.5], [42, 2.6], [38, 4.6], [34, 6.4], [30.5, 8.2]]
  const a = spine.map(([e, n]) => G(e, n + 1.5)), b = spine.map(([e, n]) => G(e, n - 1.5))
  return `<path class="dr-line hair" d="${pathOf(a)}"/><path class="dr-line hair" d="${pathOf(b)}"/>`
}

/* THE CUT, which is the whole reason the section can say A-A again */
function cutline() {
  const a = G(H.cut, 6), b = G(H.cut, 27)
  return `<path class="dr-dash" d="${pathOf([a, b])}"/>
          <text class="dr-txt" x="${a[0] + 4}" y="${a[1] + 14}" style="font-size:11px">A</text>
          <text class="dr-txt" x="${b[0] + 4}" y="${b[1] - 5}" style="font-size:11px">A</text>`
}

/* an arrowhead at a, pointing away from b. Same discipline as the section sheet: the direction
   comes from the line the mark sits on and is never re-guessed. */
function arrowAt(a, b, cls, size = 8) {
  const dx = a[0] - b[0], dy = a[1] - b[1], m = Math.hypot(dx, dy) || 1
  const ux = dx / m, uy = dy / m, nx = -uy, ny = ux, w = size * .5
  const bx = a[0] - ux * size, by = a[1] - uy * size
  return `<path class="${cls}" d="M${r1(bx + nx * w)},${r1(by + ny * w)} L${a[0]},${a[1]} L${r1(bx - nx * w)},${r1(by - ny * w)}"/>`
}

/* the north point, in the clear column at the sheet's left edge */
function chrome() {
  return `<path class="dr-line" d="M72,368 L50,330"/>${arrowAt([50, 330], [72, 368], 'dr-line')}
          <text class="dr-txt" x="42" y="324" style="font-size:12px">N</text>`
}

/* `ghostHouse`: for a plate that IS the house's form, the standard house fades to a faint reference so
   the form reads as the building, not as something inside it (Eric, 2026-09-16) */
const SITEBASE = (ghostHouse = false) => `
  <g>${groundSolid()}${stream()}${spring()}${track()}
     ${trees(TREES, 'dr-line')}<g opacity="${ghostHouse ? 0.18 : 1}">${house()}</g>${cutline()}${chrome()}</g>`

/* ------------------------------------------------------------------ notes */
/* LABELS, NOT EXPLANATIONS (Eric, 2026-09-14). Text on a plate is a few words naming what is
   drawn -- the indoor plates' way -- never a rewrite of the solution description, which the page
   already carries. So these are short labels set on the drawing, with a leader only where a
   label cannot sit beside its thing.
   One rule, learned the expensive way on the section sheet: a leader leaves from the END of
   the label NEAREST its target. Drawn from anywhere else it lies across the words between. */
const CW = 6.9                                        // mean advance of .ov-txt at 11.5px
function notes(t, list) {
  return list.map((o) => {
    const s = t(o.en, o.fr), a = o.a || 'end', size = o.fs || 11.5, w = s.length * CW * size / 11.5
    const off = (o.key && LABEL_AT[o.key]) || [0, 0]
    o = { ...o, x: r1(o.x + off[0]), y: r1(o.y + off[1]) }
    if (o.key && !o.to && Math.hypot(off[0], off[1]) > 26) o.to = o.at
    const x0 = a === 'end' ? o.x - w : a === 'middle' ? o.x - w / 2 : o.x
    const x1 = a === 'end' ? o.x : a === 'middle' ? o.x + w / 2 : o.x + w
    if (o.key && o.to && !o.from) o.from = Math.abs(x0 - o.to[0]) < Math.abs(x1 - o.to[0]) ? 'start' : 'end'
    let lead = ''
    if (o.to) {
      const from = o.from === 'start' ? [x0 - 5, o.y - 3.5] : [x1 + 5, o.y - 3.5]
      lead = `<path class="ov-line hair" d="${pathOf([from, o.to])}"/>`
           + `<circle class="ov-line hair" cx="${o.to[0]}" cy="${o.to[1]}" r="2.4" fill="none"/>`
    }
    const mark = o.key ? ` data-key="${o.key}" data-at="${o.at ? o.at.join(',') : ''}"` : ''
    return `<g${mark}>${lead}<text class="ov-txt" x="${o.x}" y="${o.y}" text-anchor="${a}"${o.fs ? ` style="font-size:${o.fs}px"` : ''}>${esc(s)}</text></g>`
  }).join('')
}

/* ------------------------------------------------------ the long section */
/* THE FINDING OF THIS TEST SHEET. At 6.6 units per metre a 2.8 m head is nineteen units, and
   for the rows whose entire content is a head of one to three metres that is a dimension
   rather than a drawing. So those rows get a true vertical slice along the run, at a larger
   scale, with its exaggeration stated on the face of it -- the yard inset's device, turned on
   its side. Roughly eight of the twenty will want one. */
const LS = { x: 34, y: 50, w: 216, h: 120, u: 7.6, z: 20, u0: 48, zBase: 158, z0: 0.9 }
const LSx = (u) => r1(LS.u0 + u * LS.u)
const LSz = (z) => r1(LS.zBase - (z - LS.z0) * LS.z)
function longSection(t, title, inner) {
  return `
    <path class="dr-fill" d="M${LS.x},${LS.y} h${LS.w} v${LS.h} h${-LS.w} z"/>
    <text class="dr-txt" x="${LS.x + 10}" y="${LS.y + 16}" style="font-size:8.5px">${esc(t(title[0], title[1]))}</text>
    <text class="dr-txt" x="${LS.x + LS.w - 10}" y="${LS.y + 16}" text-anchor="end"
          style="font-size:8px;opacity:.7">&#215;${r1(LS.z / LS.u)} ${t('VERT', 'VERT')}</text>
    <line class="dr-line hair" x1="${LS.x + 10}" y1="${LS.y + 22}" x2="${LS.x + LS.w - 10}" y2="${LS.y + 22}"/>
    ${inner}`
}

/* =========================================================== the overlays */
/* ---------------------------------------------------- overlay helpers (site) */
/* a polyline given in PLAN metres, laid on the ground and sampled every `step` m so it rides the
   slope instead of cutting through it; dz lifts it (a mound top, a pipe above grade) */
function lay(pts, step = 1, dz = 0) {
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [e0, n0] = pts[i], [e1, n1] = pts[i + 1]
    const k = Math.max(1, Math.ceil(Math.hypot(e1 - e0, n1 - n0) / step))
    for (let j = 0; j < k; j++) {
      const e = e0 + (e1 - e0) * j / k, n = n0 + (n1 - n0) * j / k
      out.push(P(e, n, Zg(e, n) + dz))
    }
  }
  const [e, n] = pts[pts.length - 1]
  out.push(P(e, n, Zg(e, n) + dz))
  return out
}
const head = (pts) => arrowAt(pts[pts.length - 1], pts[pts.length - 2], 'ov-line hair', 7)
const flow = (pts, every = 5, from = 3) => {
  let s = ''
  for (let i = from; i < pts.length; i += every) s += arrowAt(pts[i], pts[i - 1], 'ov-line hair', 7)
  return s
}
const patch = (pts, dz = 0) => pathOf(lay(pts.concat([pts[0]]), 1, dz), true)
const oval = (ce, cn, re, rn, k = 28) =>
  Array.from({ length: k }, (_, i) => [ce + re * Math.cos(i / k * 2 * Math.PI), cn + rn * Math.sin(i / k * 2 * Math.PI)])
const tuft = (e, n) => { const p = G(e, n); return `<path class="ov-line hair" d="M${p[0] - 3},${p[1]} l3,-5 l3,5 M${p[0]},${p[1]} v-6"/>` }
/* a label anchored on the thing it names; LABEL_AT holds the offset a placement pass chose by
   measuring the ink under each candidate position, so no label is placed by guesswork */
const lab = (key, at, en, fr) => ({ key, at, x: at[0], y: at[1] + 4, a: 'middle', fs: 10, en, fr })
/* a detail box in the long section's slot, for a side view rather than a section along a run --
   so it carries no vertical-exaggeration stamp */
function insetBox(t, title, inner) {
  return `
    <path class="dr-fill" d="M${LS.x},${LS.y} h${LS.w} v${LS.h} h${-LS.w} z"/>
    <text class="dr-txt" x="${LS.x + 10}" y="${LS.y + 16}" style="font-size:8.5px">${esc(t(title[0], title[1]))}</text>
    <line class="dr-line hair" x1="${LS.x + 10}" y1="${LS.y + 22}" x2="${LS.x + LS.w - 10}" y2="${LS.y + 22}"/>
    ${inner}`
}
/* a small built volume -- turbine house, workshop, spring box, tank -- standing on the ground at
   its centre. Only the faces this view sees: west, south, and the top. */
function hut(e0, e1, n0, n1, h) {
  const z = Zg((e0 + e1) / 2, (n0 + n1) / 2)
  const q = (pts) => pathOf(pts.map(([e, n, dz]) => P(e, n, z + dz)), true)
  return `<path class="ov-fill" d="${q([[e0, n0, 0], [e0, n1, 0], [e0, n1, h], [e0, n0, h]])}"/>`
       + `<path class="ov-fill" d="${q([[e0, n0, 0], [e1, n0, 0], [e1, n0, h], [e0, n0, h]])}"/>`
       + `<path class="ov-fill" d="${q([[e0, n0, h], [e1, n0, h], [e1, n1, h], [e0, n1, h]])}"/>`
}
/* a wheel standing in the stream, its axis across the flow (along east), its lower rim dipping
   below the water. A circle in a vertical north-up plane, so on this projection an ellipse. */
function wheel(e, n, R) {
  const zc = zWater(e, n) + R * 0.55
  const pt = (a, r) => P(e, n + r * Math.cos(a), zc + r * Math.sin(a))
  const rim = []
  for (let i = 0; i <= 36; i++) rim.push(pt(i / 36 * 2 * Math.PI, R))
  let spokes = ''
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 2 * Math.PI
    spokes += `<path class="ov-line hair" d="${pathOf([pt(a, 0.15 * R), pt(a, R)])}"/>`
            + `<path class="ov-line" d="${pathOf([pt(a, R), pt(a, R * 1.25)])}"/>`
  }
  return { svg: `<path class="ov-line" d="${pathOf(rim, true)}"/>${spokes}`, hub: pt(0, 0), zc }
}

/* a small dome standing on the ground: an ellipsoid of radius R and height Hh, drawn as the outline
   of its sampled surface (a convex hull, so no hidden-line bookkeeping), with two latitude lines on
   the side this view sees and a door on the south face */
function dome(e, n, R, Hh) {
  const z0 = Zg(e, n), pts = []
  for (let la = 0; la <= 90; la += 10)
    for (let lo = 0; lo < 360; lo += 12) {
      const a = la * Math.PI / 180, b = lo * Math.PI / 180
      pts.push(P(e + R * Math.cos(a) * Math.cos(b), n + R * Math.cos(a) * Math.sin(b), z0 + Hh * Math.sin(a)))
    }
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const srt = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), lo_ = [], up = []
  for (const q of srt) { while (lo_.length >= 2 && cross(lo_[lo_.length - 2], lo_[lo_.length - 1], q) <= 0) lo_.pop(); lo_.push(q) }
  for (const q of srt.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q) }
  const hull = lo_.slice(0, -1).concat(up.slice(0, -1))
  const lat = (deg) => {
    const a = deg * Math.PI / 180, q = []
    for (let lo = 150; lo <= 330; lo += 10) {
      const b = lo * Math.PI / 180
      q.push(P(e + R * Math.cos(a) * Math.cos(b), n + R * Math.cos(a) * Math.sin(b), z0 + Hh * Math.sin(a)))
    }
    return `<path class="ov-line hair" d="${pathOf(q)}"/>`
  }
  const door = []
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * k / 12
    door.push(P(e + 0.42 * Math.cos(a), n - R * 0.97, z0 + 1.15 + 0.42 * Math.sin(a)))
  }
  door.unshift(P(e + 0.42, n - R * 0.97, z0)); door.push(P(e - 0.42, n - R * 0.97, z0))
  return `<path class="ov-fill" d="${pathOf(hull, true)}"/><path class="ov-tint" d="${pathOf(hull, true)}"/>`
       + lat(28) + lat(58) + `<path class="ov-line hair" d="${pathOf(door)}"/>`
}

/* a bread oven: an earth dome on a raised base of the same earth, its mouth to the south (the
   face this view sees). Built outdoors so baking does not heat the house (SOL-244, 2026-09-24). */
function breadOven(e, n) {
  const plinth = 0.9, R = 0.75, Hh = 0.65, z0 = Zg(e, n) + plinth, pts = []
  for (let la = 0; la <= 90; la += 10)
    for (let lo = 0; lo < 360; lo += 12) {
      const a = la * Math.PI / 180, b = lo * Math.PI / 180
      pts.push(P(e + R * Math.cos(a) * Math.cos(b), n + R * Math.cos(a) * Math.sin(b), z0 + Hh * Math.sin(a)))
    }
  const hull = hullOf(pts)
  const mouth = []
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * k / 12
    mouth.push(P(e + 0.22 * Math.cos(a), n - R * 0.97, z0 + 0.3 * Math.sin(a)))
  }
  mouth.unshift(P(e + 0.22, n - R * 0.97, z0)); mouth.push(P(e - 0.22, n - R * 0.97, z0))
  return hut(e - 0.85, e + 0.85, n - 0.85, n + 0.85, plinth)
       + `<path class="ov-fill" d="${pathOf(hull, true)}"/><path class="ov-tint" d="${pathOf(hull, true)}"/>`
       + `<path class="ov-line hair" d="${pathOf(mouth)}"/>`
}

/* ------------------------------------------------ building forms, overprinted on the house */
/* A building form is the house's own shape, so it is drawn OVER the base house, in the same
   projection and at its real size (Eric, 2026-09-16): the house stays visible underneath and the
   form reads against it. Visible edges solid, edges on the far side dashed, the silhouette tinted.
   Visibility is the surface normal against the view direction V -- the vector this projection
   flattens to a point, (0.5, 0.866, -1) -- which is exact for the convex shapes drawn here. */
const VIEW = [-0.5, -0.866, 1]
const facing = (nx, ny, nz) => nx * VIEW[0] + ny * VIEW[1] + nz * VIEW[2] > 0
const FC = { e: 27, n: 15, z: H.z }                   // every form stands on the house's bench
function hullOf(pts) {
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const s2 = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), lo = [], up = []
  for (const q of s2) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q) }
  for (const q of s2.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q) }
  return lo.slice(0, -1).concat(up.slice(0, -1))
}
/* a curve of [e, n, z, visible] samples, split into solid and dashed runs */
function ghostCurve(samples, cls = 'ov-line') {
  let out = '', run = [], vis = null
  const flush = () => {
    if (run.length > 1) out += `<path class="${vis ? cls : 'ov-hide'}" d="${pathOf(run.map(([e, n, z]) => P(e, n, z)))}"/>`
  }
  for (const s of samples) {
    if (vis !== null && s[3] !== vis) { run.push(s); flush(); run = [s] } else run.push(s)
    vis = s[3]
  }
  flush()
  return out
}
const ghostHull = (pts3) => `<path class="ov-tint" d="${pathOf(hullOf(pts3.map(([e, n, z]) => P(e, n, z))), true)}"/>`
const ring = (k, fn) => Array.from({ length: k + 1 }, (_, i) => fn(i / k * 2 * Math.PI))

/* SOL-233, second version: a barrel vault over the house's own 12 x 9 m, a catenary rising 5.5 m */
function vaultForm() {
  const half = 4.5, rise = 5.5, e0 = H.e0, e1 = H.e1, n0 = FC.n
  let lo = 0.5, hi = 500
  for (let i = 0; i < 80; i++) { const a = (lo + hi) / 2; if (a * (Math.cosh(half / a) - 1) > rise) lo = a; else hi = a }
  const a = (lo + hi) / 2
  const zOf = (u) => FC.z + rise - a * (Math.cosh(u / a) - 1)
  const slope = (u) => -Math.sinh(u / a)
  const vis = (u) => facing(0, -slope(u), 1)
  const arch = (e, always) => ghostCurve(Array.from({ length: 41 }, (_, i) => {
    const u = -half + 2 * half * i / 40
    return [e, n0 + u, zOf(u), always || vis(u)]
  }), always ? 'ov-line' : 'ov-line hair')
  let s = ''
  const all = []
  for (const e of [e0, e1]) for (let i = 0; i <= 20; i++) { const u = -half + i * 0.45; all.push([e, n0 + u, zOf(u)]) }
  s += ghostHull(all)
  for (const e of [24, 27, 30]) s += arch(e, false)
  s += arch(e1, false) + arch(e0, true)
  for (const u of [-half, -half / 2, 0, half / 2, half])
    s += ghostCurve([[e0, n0 + u, zOf(u), vis(u) || Math.abs(u) === half], [e1, n0 + u, zOf(u), vis(u) || Math.abs(u) === half]],
                    Math.abs(u) === half || u === 0 ? 'ov-line' : 'ov-line hair')
  return { svg: s, top: P((e0 + e1) / 2, n0, FC.z + rise) }
}

/* SOL-235: a roundhouse, 9 m across, walls 2.4 m, a reciprocal-frame cone to 5.6 m */
function roundForm() {
  const R = 4.5, eave = 5.0, zE = 2.25, apex = 5.6, rr = 0.7, K = 48
  const at = (r, t, z) => [FC.e + r * Math.cos(t), FC.n + r * Math.sin(t), FC.z + z]
  const wallVis = (t) => facing(Math.cos(t), Math.sin(t), 0)
  const roofVis = (t) => facing(Math.cos(t), Math.sin(t), eave / (apex - zE))
  let s = ghostHull(ring(K, (t) => at(R, t, 0)).concat(ring(K, (t) => at(eave, t, zE)), [at(0, 0, apex)]))
  s += ghostCurve(ring(K, (t) => [...at(R, t, 0), wallVis(t)]))
  s += ghostCurve(ring(K, (t) => [...at(eave, t, zE), true]))
  for (let i = 0; i < 8; i++) {                         // rafters, each resting on the next near the top
    const t = (i + 0.5) / 8 * 2 * Math.PI, t2 = t + Math.PI / 2
    const a = at(eave, t, zE), b = [FC.e + rr * Math.cos(t2), FC.n + rr * Math.sin(t2), FC.z + apex - 0.25]
    s += ghostCurve([[...a, roofVis(t)], [...b, roofVis(t)]], 'ov-line hair')
  }
  s += ghostCurve(ring(16, (t) => [...at(rr, t, apex - 0.25), true]), 'ov-line hair')
  return { svg: s, top: P(FC.e, FC.n, FC.z + apex) }
}

/* SOL-240: a yurt, 7 m across, lattice wall 1.8 m, poles to a crown ring at 3.3 m */
function yurtForm() {
  const R = 3.5, wall = 1.8, apex = 3.3, cr = 0.7, K = 48
  const at = (r, t, z) => [FC.e + r * Math.cos(t), FC.n + r * Math.sin(t), FC.z + z]
  const wallVis = (t) => facing(Math.cos(t), Math.sin(t), 0)
  const roofVis = (t) => facing(Math.cos(t), Math.sin(t), (R - cr) / (apex - wall))
  let s = ghostHull(ring(K, (t) => at(R, t, 0)).concat(ring(K, (t) => at(R, t, wall)), ring(K, (t) => at(cr, t, apex))))
  s += ghostCurve(ring(K, (t) => [...at(R, t, 0), wallVis(t)]))
  s += ghostCurve(ring(K, (t) => [...at(R, t, wall), true]))
  s += ghostCurve(ring(24, (t) => [...at(cr, t, apex), true]), 'ov-line hair')
  for (let i = 0; i < 16; i++) {
    const t = i / 16 * 2 * Math.PI
    s += ghostCurve([[...at(R, t, wall), roofVis(t)], [...at(cr, t, apex), roofVis(t)]], 'ov-line hair')
  }
  for (let i = 0; i < 18; i++) {                        // the lattice, on the side this view sees
    const t = Math.PI * (0.55 + i / 18 * 0.95), t2 = t + 0.22
    if (!wallVis(t) || !wallVis(t2)) continue
    s += `<path class="ov-line hair" d="${pathOf([P(...at(R, t, 0)), P(...at(R, t2, wall))])}"/>`
       + `<path class="ov-line hair" d="${pathOf([P(...at(R, t2, 0)), P(...at(R, t, wall))])}"/>`
  }
  return { svg: s, top: P(FC.e, FC.n, FC.z + apex) }
}

/* SOL-236: an A-frame, 7.2 m wide at the ground, 60 degree sides, 9 m long, gable to the south */
function aframeForm() {
  const hw = 3.6, h = 6.24, n0 = H.n0, n1 = H.n1, e = FC.e, z = FC.z
  const W = [e - hw, 0], E = [e + hw, 0], T = [e, h]
  const vW = facing(-0.866, 0, 0.5), vE = facing(0.866, 0, 0.5), vS = facing(0, -1, 0), vN = facing(0, 1, 0)
  const L = (a, b, v, cls) => ghostCurve([[a[0], a[1], z + a[2], v], [b[0], b[1], z + b[2], v]], cls)
  let s = ghostHull([[W[0], n0, z], [E[0], n0, z], [T[0], n0, z + h], [W[0], n1, z], [E[0], n1, z], [T[0], n1, z + h]])
  s += L([W[0], n0, 0], [T[0], n0, h], vS || vW) + L([T[0], n0, h], [E[0], n0, 0], vS || vE) + L([W[0], n0, 0], [E[0], n0, 0], vS)
  s += L([W[0], n1, 0], [T[0], n1, h], vN || vW) + L([T[0], n1, h], [E[0], n1, 0], vN || vE) + L([W[0], n1, 0], [E[0], n1, 0], vN)
  s += L([T[0], n0, h], [T[0], n1, h], true) + L([W[0], n0, 0], [W[0], n1, 0], vW) + L([E[0], n0, 0], [E[0], n1, 0], vE || vS)
  // the glazed south gable and the loft floor behind it
  s += L([e - 2.2, n0, 2.6], [e + 2.2, n0, 2.6], vS, 'ov-line hair') + L([e, n0, 0], [e, n0, h], vS, 'ov-line hair')
  return { svg: s, top: P(e, n0, z + h) }
}

/* SOL-237: a geodesic hemisphere, 10 m across (the study's 77 m2 of floor), frequency 2 */
function geoForm() {
  // an icosahedron standing on a vertex, split once (2V): its belt edges then meet at the equator,
  // so the hemisphere has a flat base, as a built 2V dome does
  const R = 5, zr = 1 / Math.sqrt(5), rr = 2 / Math.sqrt(5)
  const up = [0, 0, 1], dn = [0, 0, -1]
  const U = Array.from({ length: 5 }, (_, k) => [rr * Math.cos(k * 1.2566), rr * Math.sin(k * 1.2566), zr])
  const L = Array.from({ length: 5 }, (_, k) => [rr * Math.cos(k * 1.2566 + 0.6283), rr * Math.sin(k * 1.2566 + 0.6283), -zr])
  const F = []
  for (let k = 0; k < 5; k++) {
    const k1 = (k + 1) % 5
    F.push([up, U[k], U[k1]], [U[k], L[k], U[k1]], [L[k], L[k1], U[k1]], [dn, L[k1], L[k]])
  }
  const norm = (q) => { const m = Math.hypot(...q); return q.map((c) => c / m) }
  const mid = (a, b) => norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])
  const edges = new Map()
  const add = (a, b) => { const k = [a, b].map((q) => q.map((c) => c.toFixed(4)).join(',')).sort().join('|'); edges.set(k, [a, b]) }
  for (const [a, b, c] of F) {
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a)
    for (const [q, r] of [[a, ab], [ab, b], [b, bc], [bc, c], [c, ca], [ca, a], [ab, bc], [bc, ca], [ca, ab]]) add(q, r)
  }
  const at = ([x, y, z]) => [FC.e + R * x, FC.n + R * y, FC.z + R * z]
  let lines = '', hullPts = []
  for (const [a, b] of edges.values()) {
    if (a[2] < -0.001 || b[2] < -0.001) continue
    const m = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])
    const base = Math.abs(a[2]) < 0.001 && Math.abs(b[2]) < 0.001
    const v = base ? facing(m[0], m[1], 0) : facing(...m)
    lines += ghostCurve([[...at(a), v], [...at(b), v]], base ? 'ov-line' : 'ov-line hair')
    hullPts.push(at(a), at(b))
  }
  return { svg: ghostHull(hullPts) + lines, top: P(FC.e, FC.n, FC.z + R) }
}

/* SOL-238: earth banked against the north, east and west walls to 0.4 m under the eaves, 1:1.4 */
function bermForm() {
  // one U-shaped mound wrapping the west, north and east walls, 2.6 m up them, running 4.2 m out;
  // the south face stays open to the sun
  const top = 2.6, run = 4.2, z = H.z, s0 = H.n0 + 1.2
  const T = [[H.e0, s0], [H.e0, H.n1], [H.e1, H.n1], [H.e1, s0]].map(([e, n]) => [e, n, z + top])
  const toe = [[H.e0 - run, s0 - 1], [H.e0 - run, H.n1 + run], [H.e1 + run, H.n1 + run], [H.e1 + run, s0 - 1]]
    .map(([e, n]) => [e, n, z])
  const pt = (q) => P(...q)
  let s = `<path class="ov-tint" d="${pathOf(T.map(pt).concat(toe.slice().reverse().map(pt)), true)}"/>`
  const seg = (a, b, v, cls) => ghostCurve([[...a, v], [...b, v]], cls)
  s += seg(T[0], T[1], true) + seg(T[1], T[2], false) + seg(T[2], T[3], false)          // along the walls
  s += seg(toe[0], toe[1], true) + seg(toe[1], toe[2], true) + seg(toe[2], toe[3], true) // the toe
  s += seg(T[0], toe[0], true) + seg(T[3], toe[3], true)                               // the two open ends
  s += seg(T[1], toe[1], true, 'ov-line hair') + seg(T[2], toe[2], false, 'ov-line hair') // the corners
  for (let n = s0 + 2; n < H.n1; n += 2) s += seg([H.e0, n, z + top], [H.e0 - run, n, z], true, 'ov-line hair')
  return { svg: s, top: P(H.e0 - run / 2, s0 + 2, z + top / 2) }
}

/* SOL-241: a courtyard 9 m square dug 6 m into the bench, rooms opening off its walls */
function courtyardForm() {
  const hw = 4.5, depth = 6, room = 3.6, ch = 3.2, e0 = FC.e - hw, e1 = FC.e + hw, n0 = FC.n - hw, n1 = FC.n + hw, z = FC.z
  const q = (pts) => pathOf(pts.map((p) => P(...p)), true)
  const S2 = (pts, v, cls) => ghostCurve(pts.map((p) => [...p, v]), cls)
  let s = ''
  // the inner faces this view sees: the north wall and the east wall, and the floor
  s += `<path class="ov-tint" d="${q([[e0, n1, z], [e1, n1, z], [e1, n1, z - depth], [e0, n1, z - depth]])}"/>`
  s += `<path class="ov-tint soft" d="${q([[e1, n0, z], [e1, n1, z], [e1, n1, z - depth], [e1, n0, z - depth]])}"/>`
  s += S2([[e0, n0, z], [e1, n0, z], [e1, n1, z], [e0, n1, z], [e0, n0, z]], true)
  s += S2([[e0, n1, z], [e0, n1, z - depth], [e1, n1, z - depth], [e1, n0, z - depth]], true) + S2([[e1, n1, z], [e1, n1, z - depth]], true)
  // doors and windows on the two seen walls
  for (const e of [e0 + 1.6, FC.e - 0.5, e1 - 2.4])
    s += S2([[e, n1, z - depth], [e, n1, z - depth + 2.1], [e + 1, n1, z - depth + 2.1], [e + 1, n1, z - depth]], true, 'ov-line hair')
  for (const n of [n0 + 2, n1 - 3])
    s += S2([[e1, n, z - depth + 1], [e1, n, z - depth + 2.2], [e1, n + 1.2, z - depth + 2.2], [e1, n + 1.2, z - depth + 1], [e1, n, z - depth + 1]], true, 'ov-line hair')
  // the rooms around it, under the ground: hidden
  const R0 = [e0 - room, n0 - room], R1 = [e1 + room, n1 + room], rz = z - depth + ch
  s += S2([[R0[0], R0[1], rz], [R1[0], R0[1], rz], [R1[0], R1[1], rz], [R0[0], R1[1], rz], [R0[0], R0[1], rz]], false)
  s += S2([[R0[0], R0[1], z - depth], [R1[0], R0[1], z - depth], [R1[0], R1[1], z - depth], [R0[0], R1[1], z - depth], [R0[0], R0[1], z - depth]], false)
  for (const [e, n] of [[R0[0], R0[1]], [R1[0], R0[1]], [R1[0], R1[1]], [R0[0], R1[1]]]) s += S2([[e, n, z - depth], [e, n, rz]], false)
  // the way down: a ramp cut in from the south-east
  s += S2([[e1 - 1.2, n0, z - depth + 0.1], [e1 - 1.2, n0 - 7, z], [e1 - 0.1, n0 - 7, z], [e1 - 0.1, n0, z - depth + 0.1]], true, 'ov-line hair')
  return { svg: s, top: P(e0, n1, z - depth / 2) }
}

const LABEL_AT = {
  '233-vault': [120, -50], '235-round': [120, -40], '236-aframe': [120, -40], '237-dome': [120, -40],
  '238-berm': [-60, 40], '240-yurt': [120, -40], '241-yard': [-120, -50],
  '234-annex': [-40, -48],
  '244-oven': [30, -60],
  // chosen by SiteQA.place() (scripts/site-plate-qa.js), 2026-09-14 -- rerun it after moving a plate
  '012-away': [10, 46],
  '120-garden': [-10, -42], '120-strip': [50, -12],
  '200-swale': [-10, -66], '200-out': [-10, -24],
  '201-berm': [70, -66], '201-split': [40, 18],
  '065-bed': [40, 36], '065-out': [-30, -42],
  '072-b1': [30, 36], '072-b2': [-40, 0], '072-out': [30, 48],
  '067-drip': [-60, -72],
  '068-field': [-60, -66],
  '078-intake': [-30, -48], '078-pen': [50, -18], '078-turb': [-10, 66], '078-cable': [0, -30],
  '218-wheel': [70, -24], '218-tank': [-10, 24],
  '220-wheel': [70, 12], '220-shaft': [50, -12], '220-shop': [30, -36],
  '054-box': [-10, -54], '054-line': [40, 6],
  '014-foot': [-10, 24],
  '027-fins': [10, 72], '027-sun': [10, 18],
  '077-rotor': [-40, 0], '077-mast': [50, 0], '077-cable': [-20, -12],
  '187-net': [0, -24], '187-gutter': [40, -6], '187-tank': [-20, 42], '187-fog': [-50, 0],
  '204-tarp': [60, -24], '204-box': [-10, 24],
}

const SOLUTIONS = [
  {
    /* ------------------------------------------------------------ SOL-118 */
    /* The widest thing on the sheet, and the row that decided the projection. Defensible space
       is specified as a HORIZONTAL distance from the STRUCTURE -- so the zones are offsets of
       the house's footprint, not circles about its centre, and on this projection that offset
       is exactly true in every direction. The curve still rises and falls, because the ground
       does; that is the honest drawing rather than a plan pretending the land is flat.
       The finding the plate makes is worth more than the drawing: zone 3 does not fit. On a
       54 m site a 30 m buffer IS the site, so it is stated as a dimension running off the
       sheet instead of a ring nobody could have drawn. */
    id: 'SOL-118', base: 'site', behind: 'mask', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Defensible space / vegetation management', fr: 'Espace défendable et gestion de la végétation',
    zone: [96, 150, 430, 330], crop: [150, 200, 320, 224],
    draw: (t) => {
      /* the offset of the footprint by r: four true quarter-arcs joined by four straight
         edges, sampled and laid on the ground */
      const offset = (r) => {
        const C = [[H.e1, H.n1, 0], [H.e0, H.n1, 90], [H.e0, H.n0, 180], [H.e1, H.n0, 270]]
        const pts = []
        for (const [ce, cn, a0] of C)
          for (let a = a0; a <= a0 + 90; a += 5)
            pts.push(G(ce + r * Math.cos(a * Math.PI / 180), cn + r * Math.sin(a * Math.PI / 180)))
        return pts
      }
      const z1 = offset(1.5), z2 = offset(9)
      const inZone = (e, n, r) =>
        Math.hypot(Math.max(0, Math.max(H.e0 - e, e - H.e1)), Math.max(0, Math.max(H.n0 - n, n - H.n1))) <= r
      const clear = TREES.filter((x) => inZone(x[0], x[1], 1.5))
      const thin  = TREES.filter((x) => !inZone(x[0], x[1], 1.5) && inZone(x[0], x[1], 9))
      const crosses = clear.map(([e, n]) => {
        const p = G(e, n)
        return `<path class="ov-line" d="M${p[0] - 7},${p[1] - 7} L${p[0] + 7},${p[1] + 7} M${p[0] + 7},${p[1] - 7} L${p[0] - 7},${p[1] + 7}"/>`
      }).join('')
      const dimA = G(H.e1, HMID), dimB = G(SITE.e1, HMID)
      return `
        <path class="ov-tint" d="${pathOf(z2, true)} ${pathOf(z1.slice().reverse(), true)}" fill-rule="evenodd"/>
        <path class="ov-line" d="${pathOf(z1, true)}"/>
        <path class="ov-line" d="${pathOf(z2, true)}"/>
        ${trees(thin, 'ov-line')}${trees(clear, 'ov-line')}${crosses}
        <path class="ov-line hair" d="${pathOf([dimA, dimB])}"/>
        ${arrowAt(dimB, dimA, 'ov-line hair')}
        <text class="ov-num" x="${r1(dimB[0] - 6)}" y="${r1(dimB[1] + 17)}" text-anchor="end">30 m &#8594;</text>
        ${(() => { const bw = G(15.5, 17), bs = G(24.5, 4.6)   // bs - 4: further right, CLEARED ran
                                                              // into the A of the cut line
          return notes(t, [
            { x: bw[0] + 2, y: bw[1] - 3, a: 'middle', fs: 10, en: 'THINNED', fr: 'ÉCLAIRCI' },
            { x: bw[0] + 2, y: bw[1] + 12, a: 'middle', fs: 10, en: 'TO 9 m', fr: 'À 9 m' },
            { x: bs[0] - 4, y: bs[1] - 3, fs: 10, en: 'CLEARED', fr: 'DÉGAGÉ', to: G(27.6, 9), from: 'end' },
            { x: bs[0] - 4, y: bs[1] + 12, fs: 10, en: 'TO 1.5 m', fr: 'À 1,5 m' },
          ]) })()}`
    },
  },
  {
    /* ------------------------------------------------------------ SOL-177 */
    /* The most vertical-dependent row of the twenty, and the one that found the limit. Its
       whole content is two heads and the ratio between them, and at the sheet's own scale the
       drive head is nineteen units tall. The site drawing therefore says WHERE, and the long
       section beside it says HOW MUCH.
       The numbers are the base's, not invented for the plate: the stream falls 0.14 m per
       metre, so 22 m of drive pipe buys 2.8 m of head, and the ram lifts 8.2 m to a tank on a
       stand in the south-east corner, 4.6 m above the house floor, which feeds the house by
       gravity. Both pipes are straight in plan and only bend where the ground does. The
       catalogue asks for
       "roughly 10%+ slope and a real fall height between source and pump"; this is 12.8%. */
    id: 'SOL-177', base: 'site', fnEn: 'Water movement', fnFr: 'Circulation de l’eau',
    en: 'Hydraulic ram pump', fr: 'Bélier hydraulique',
    zone: [30, 40, 470, 460], crop: [30, 46, 250, 176],
    draw: (t) => {
      const weir = P(W.weir[0], W.weir[1], zWater(W.weir[0], W.weir[1]))
      const pump = P(W.pump[0], W.pump[1], Zg(W.pump[0], W.pump[1]) - 0.10)
      const foot = G(W.tank[0], W.tank[1])
      const tank = P(W.tank[0], W.tank[1], TANK_Z)
      const drive = [], deliver = []
      for (let n = W.weir[1]; n >= W.pump[1]; n -= 2.75) drive.push(P(2.6, n, zWater(2.6, n) + .05))
      /* straight in plan: sampled along the line and laid on the ground, then up the stand */
      const run = (a, b, k) => Array.from({ length: k + 1 }, (_, i) => {
        const e = a[0] + (b[0] - a[0]) * i / k, n = a[1] + (b[1] - a[1]) * i / k
        return P(e, n, Zg(e, n) + 0.2)
      })
      deliver.push(...run(W.pump, W.tank, 14), tank)
      const feed = run(W.tank, [33.6, 10.2], 8)
      /* the long section, along the stream: u = 0 at the weir, u = 22 at the pump */
      const bedA = zWater(W.weir[0], W.weir[1]), bedB = Zg(W.pump[0], W.pump[1]) - 0.10
      const U1 = W.weir[1] - W.pump[1]
      const gnd = `M${LSx(0)},${LSz(bedA)} L${LSx(U1)},${LSz(bedB)} L${LSx(U1)},${LS.y + LS.h} L${LSx(0)},${LS.y + LS.h} Z`
      const px = LSx(U1), pz = LSz(bedB)
      const detail = `
        ${hatchPath(gnd, 8)}
        <path class="dr-line" d="M${LSx(0)},${LSz(bedA)} L${LSx(U1)},${LSz(bedB)}"/>
        <path class="ov-line" d="M${LSx(0)},${LSz(bedA)} v-13"/>
        <path class="ov-line hair" d="M${LSx(0.6)},${LSz(bedA) - 4} L${px - 16},${pz - 6}"/>
        <path class="ov-line" d="M${px - 16},${pz - 6} h13 v-15 a5,5 0 0 1 10,0 v15 h8"/>
        <path class="ov-line hair" d="M${px - 7},${pz - 6} v7 h-6 m6,0 h6"/>
        <path class="ov-line hair" d="M${px + 15},${pz - 6} v-26"/>
        ${arrowAt([px + 15, pz - 32], [px + 15, pz - 22], 'ov-line hair')}
        <path class="ov-dash" d="M${LSx(0)},${LSz(bedB)} H${LSx(3.4)}"/>
        <path class="ov-line hair" d="M${LSx(2.1)},${LSz(bedA)} V${LSz(bedB)}"/>
        ${arrowAt([LSx(2.1), LSz(bedA)], [LSx(2.1), LSz(bedA) + 12], 'ov-line hair')}
        ${arrowAt([LSx(2.1), LSz(bedB)], [LSx(2.1), LSz(bedB) - 12], 'ov-line hair')}
        <text class="ov-num" x="${LSx(2.8)}" y="${r1((LSz(bedA) + LSz(bedB)) / 2)}" text-anchor="start" font-size="9">${HEAD_DRIVE} m</text>
        <text class="ov-txt" x="${LSx(0) + 5}" y="${LSz(bedA) - 17}" style="font-size:8px">${t('WEIR', 'SEUIL')}</text>
        <text class="ov-txt" x="${px + 18}" y="${pz - 30}" text-anchor="end" style="font-size:8px">+${HEAD_LIFT} m</text>
        <text class="ov-txt" x="${px - 4}" y="${pz + 15}" text-anchor="end" style="font-size:8px">${t('RAM', 'BÉLIER')}</text>
        <text class="ov-num" x="${LSx(11)}" y="${LS.y + LS.h - 7}" text-anchor="middle" font-size="8.5">${U1} m @ ${r1(HEAD_DRIVE / U1 * 100)}%</text>`
      return `
        <path class="ov-line" d="${pathOf(drive)}"/>
        <path class="ov-line hair" d="${pathOf(deliver)}"/>
        ${arrowAt(deliver[deliver.length - 1], deliver[deliver.length - 2], 'ov-line hair')}
        <path class="ov-line" d="M${weir[0] - 9},${weir[1] - 3} h18"/>
        <text class="ov-txt" x="${weir[0] - 14}" y="${weir[1] - 23}" text-anchor="end" style="font-size:10px">${t('WEIR', 'SEUIL')}</text>
        <text class="ov-txt" x="${tank[0] + 16}" y="${tank[1] - 6}" text-anchor="start" style="font-size:10px">${t('HEADER TANK', 'CUVE HAUTE')}</text>
        <circle class="ov-line" cx="${pump[0]}" cy="${pump[1]}" r="5" fill="none"/>
        <text class="ov-txt" x="${pump[0] + 11}" y="${pump[1] + 13}" style="font-size:10px">${t('RAM', 'BÉLIER')}</text>
        <path class="ov-line hair" d="M${foot[0] - 8},${foot[1]} V${tank[1]} M${foot[0] + 8},${foot[1]} V${tank[1]}"/>
        <path class="ov-line" d="M${tank[0] - 11},${tank[1] - 15} h22 v15 h-22 z"/>
        <path class="ov-line hair" d="${pathOf(feed)}"/>
        ${arrowAt(feed[feed.length - 1], feed[feed.length - 2], 'ov-line hair')}
        ${longSection(t, ['ALONG THE STREAM', 'LE LONG DU RUISSEAU'], detail)}`
    },
  },
  {
    /* ------------------------------------------------------------ SOL-010 */
    /* Nothing is built, which is exactly why it belongs on a site drawing and nowhere else.
       The content is angles across the ground, and this is the projection that keeps a plan
       angle true, so a sight fan drawn here can be measured off the sheet.
       The catalogue calls it "sightlines and entrance placement". So the plate draws the
       approach being overlooked from the rooms in daily use, and marks the one corner the
       existing planting hides -- and it can only say that because the tree was already on the
       sheet as base. An overlay that drew its own tree would be arguing with itself. */
    id: 'SOL-010', base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Passive-surveillance site layout', fr: 'Aménagement du site favorisant la surveillance naturelle',
    zone: [150, 175, 380, 300], crop: [175, 215, 320, 224],
    draw: (t) => {
      const fan = (e0, n0, a0, a1, len) => {
        const pts = [G(e0, n0)]
        for (let a = a0; a <= a1; a += 3) {
          const e = e0 + len * Math.cos(a * Math.PI / 180), n = n0 + len * Math.sin(a * Math.PI / 180)
          pts.push(G(Math.max(SITE.e0, Math.min(SITE.e1, e)), Math.max(SITE.n0, Math.min(SITE.n1, n))))
        }
        return pathOf(pts, true)
      }
      const sWin = [30.5, H.n0], wWin = [H.e0, 15.4], door = [26.6, H.n0]
      const blind = TREES[4]                             // [38, 6] -- beside the track
      const shadow = () => {
        const d = Math.hypot(blind[0] - sWin[0], blind[1] - sWin[1])
        const half = Math.atan2(blind[3], d) * 180 / Math.PI
        const base = Math.atan2(blind[1] - sWin[1], blind[0] - sWin[0]) * 180 / Math.PI
        return fan(sWin[0], sWin[1], base - half, base + half, 24)
      }
      const dp = G(door[0], door[1])
      return `
        <path class="ov-tint" d="${fan(sWin[0], sWin[1], -70, -4, 26)}"/>
        <path class="ov-tint" d="${fan(wWin[0], wWin[1], 152, 212, 22)}"/>
        <path class="ov-tint soft" d="${shadow()}"/>
        <path class="ov-line hair" d="${fan(sWin[0], sWin[1], -70, -4, 26)}"/>
        <path class="ov-line hair" d="${fan(wWin[0], wWin[1], 152, 212, 22)}"/>
        <path class="ov-dash" d="${shadow()}"/>
        <circle class="ov-line" cx="${dp[0]}" cy="${dp[1]}" r="5" fill="none"/>
        ${(() => { const inW = G(9, 15), se = G(SITE.e1, SITE.n0)
          /* the south-east corner is where the fan, the blind wedge, the track and the ground edge
             all meet, so nothing is set there: both fans wear one tint and need one IN VIEW, and
             BLIND SPOT sits in the clear sheet beside the block with a leader into the wedge */
          return notes(t, [
            { x: inW[0], y: inW[1] + 4, a: 'middle', fs: 10, en: 'IN VIEW', fr: 'EN VUE' },
            { x: se[0] - 8, y: se[1] - 36, a: 'start', fs: 10, en: 'BLIND SPOT', fr: 'ANGLE MORT', to: G(44.2, 2.26), from: 'start' },
            { x: dp[0] - 16, y: dp[1] + 28, fs: 10, en: 'ENTRANCE', fr: 'ENTRÉE', to: [dp[0] - 3, dp[1] + 5], from: 'end' },
          ]) })()}`
    },
  },
  {
    /* SOL-012: the ground round the walls is shaped to slope away from them. Grading ONLY since
       2026-09-14 (Eric): the uphill swale this plate used to draw is SOL-200's diversion channel,
       and the collision test had flagged the two as the same measure drawn twice. */
    id: 'SOL-012', base: 'site', behind: 'mask', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Site grading away from the foundation', fr: 'Modelé du terrain en pente depuis les fondations',
    zone: [156, 230, 194, 161], crop: [103, 206, 300, 210],
    draw: (t) => {
      const away = [[23, 9.4, 23, 6.6], [27, 9.4, 27, 6.6], [31, 9.4, 31, 6.6], [19.9, 13, 18.1, 13],
                    [19.9, 17, 18.1, 17], [34.1, 13, 36.6, 13], [34.1, 17, 36.6, 17]]
        // no arrows on the NORTH side: that ground lies behind the house in this view, and an
        // overlay drawn there sits on top of the roof instead of behind it
        .map(([a, b, c, d]) => { const q = lay([[a, b], [c, d]]); return `<path class="ov-line hair" d="${pathOf(q)}"/>${head(q)}` }).join('')
      return `${away}
        ${notes(t, [lab('012-away', G(18.6, 13), 'SLOPES AWAY FROM THE WALLS', 'SOL EN PENTE VERS L’EXTÉRIEUR')])}`
    },
  },
  {
    /* SOL-120: a planted basin below the house takes the roof's runoff and lets it soak in, and a
       planted strip along the stream catches what gets past -- slow and infiltrate, not channel. */
    id: 'SOL-120', base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Vegetated buffer strips / rain garden', fr: 'Bandes végétalisées et jardin de pluie',
    zone: [107, 236, 172, 224], crop: [33, 236, 320, 224],
    draw: (t) => {
      const basin = oval(14, 21, 2.6, 1.7), inner = oval(14, 21, 1.4, 0.9)
      const strip = [[7, 3], [8.6, 3], [8.6, 27], [7, 27]]
      const rill = lay([[21, 19.5], [18.4, 20.2], [16.6, 20.8]], 1)
      const spill = lay([[11.4, 21], [8.9, 21]], 0.5)
      let tufts = ''
      for (const [e, n] of [[13, 20.4], [15, 21.6], [14.2, 20.1], [12.8, 21.8]]) tufts += tuft(e, n)
      for (let n = 4.5; n < 27; n += 3) tufts += tuft(7.8, n)
      return `
        <path class="ov-tint soft" d="${patch(strip)}"/><path class="ov-line hair" d="${patch(strip)}"/>
        <path class="ov-tint" d="${patch(basin)}"/><path class="ov-line" d="${patch(basin)}"/>
        <path class="ov-dash" d="${patch(inner)}"/>${tufts}
        <path class="ov-line hair" d="${pathOf(rill)}"/>${head(rill)}
        <path class="ov-line hair" d="${pathOf(spill)}"/>${head(spill)}
        ${notes(t, [lab('120-garden', G(14, 21), 'RAIN GARDEN', 'JARDIN DE PLUIE'),
                    lab('120-strip', G(7.8, 12), 'PLANTED STRIP', 'BANDE PLANTÉE')])}`
    },
  },
  {
    /* SOL-200: a channel cut across the slope above the house, inclined from its uphill apex so the
       water keeps moving round both flanks to an outfall below. */
    id: 'SOL-200', base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Diversion swale / intercept ditch', fr: 'Noue de dérivation / fossé d’interception',
    zone: [151, 147, 252, 270], crop: [84, 147, 386, 270],
    draw: (t) => {
      const apex = [40, 20]
      const nArm = lay([apex, [38, 23.6], [30, 25.6], [20, 25.2], [13.5, 23.8]], 1.2)
      const sArm = lay([apex, [40.6, 13], [38.2, 7.2], [30, 4.4], [18.5, 3.4]], 1.2)
      const end = (q) => { const p = q[q.length - 1]; return `<circle class="ov-line hair" cx="${p[0]}" cy="${p[1]}" r="4" fill="none"/>` }
      return `
        <path class="ov-line" d="${pathOf(nArm)}"/><path class="ov-line" d="${pathOf(sArm)}"/>
        ${flow(nArm)}${flow(sArm)}${end(nArm)}${end(sArm)}
        ${notes(t, [lab('200-swale', G(40.4, 16), 'DIVERSION SWALE', 'NOUE DE DÉRIVATION'),
                    lab('200-out', G(18.5, 3.4), 'OUTFALL', 'EXUTOIRE')])}`
    },
  },
  {
    /* SOL-201: a compacted mound upslope of the house, apex pointing uphill, so a surge is split
       and passes down either flank. Drawn as a solid: its top at 1.2 m and the face towards the
       house, which is the one this view sees.
       Set EAST of the house, not straight up the slope from it: uphill here is north-east, and on
       this projection ground north-east of the house lies behind it, so the first version drew the
       mound on the roof. The apex still points up the gradient (0.22 east, 0.14 north), and the
       left-hand flow stops where it would pass behind the house. */
    id: 'SOL-201', base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Deflection berm (splitter wedge)', fr: 'Merlon de déviation (coin déflecteur)',
    zone: [298, 76, 215, 229], crop: [242, 76, 327, 229],
    draw: (t) => {
      const h = 1.2, apex = [48, 20], L = [39.5, 18.9], R = [43.7, 12.1]
      const top = lay([apex, L, R, apex], 1, h)
      const side = lay([L, R], 1, 0).concat(lay([R, L], 1, h))
      const inn = lay([[51.6, 22.4], [49.3, 20.9]], 1)
      const fl = lay([[47.2, 21.3], [39.2, 20.2], [37, 21.2]], 1.2)
      const fr_ = lay([[49.1, 19.3], [45, 11.5], [42, 6]], 1.5)
      return `
        <path class="ov-fill" d="${pathOf(side, true)}"/>
        <path class="ov-fill" d="${pathOf(top, true)}"/><path class="ov-tint" d="${pathOf(top, true)}"/>
        <path class="ov-line hair" d="${pathOf(inn)}"/>${head(inn)}
        <path class="ov-dash" d="${pathOf(fl)}"/>${head(fl)}
        <path class="ov-dash" d="${pathOf(fr_)}"/>${head(fr_)}
        ${notes(t, [lab('201-berm', P(apex[0], apex[1], Zg(apex[0], apex[1]) + h), 'BERM, APEX UPHILL', 'MERLON, POINTE EN AMONT'),
                    lab('201-split', G(45, 11.5), 'FLOW SPLITS', 'FLUX DIVISÉ')])}`
    },
  },
  {
    /* SOL-065: one lined bed of gravel and reeds below the house; greywater arrives by gravity at
       one side and leaves at the other. */
    id: 'SOL-065', base: 'site', fnEn: 'Greywater management', fnFr: 'Gestion des eaux grises',
    en: 'Constructed wetland / reed bed filtration', fr: 'Filtration par zone humide reconstituée (roselière)',
    zone: [100, 293, 177, 104], crop: [39, 240, 300, 210],
    draw: (t) => {
      const bed = [[10, 12], [17, 12], [17, 18], [10, 18]]
      const liner = [[10.6, 12.6], [16.4, 12.6], [16.4, 17.4], [10.6, 17.4]]
      const inlet = lay([[21, 15], [17, 15]], 1), outlet = lay([[10, 15], [7.6, 15]], 0.8)
      let reeds = ''
      for (let e = 11.8; e < 16.5; e += 2.6) for (let n = 13.9; n < 17.5; n += 2.2) reeds += tuft(e, n)
      return `
        <path class="ov-tint" d="${patch(bed)}"/><path class="ov-line" d="${patch(bed)}"/>
        <path class="ov-hide" d="${patch(liner)}"/>${reeds}
        <path class="ov-hide" d="${pathOf(inlet)}"/>${head(inlet)}
        <path class="ov-hide" d="${pathOf(outlet)}"/>${head(outlet)}
        ${notes(t, [lab('065-bed', G(13.5, 15), 'REED BED', 'ROSELIÈRE'),
                    lab('065-out', G(7.6, 15), 'OUTLET', 'SORTIE')])}`
    },
  },
  {
    /* SOL-072: the same idea as the greywater bed, with a longer train -- two beds in series, each
       lower than the one before. */
    id: 'SOL-072', base: 'site', fnEn: 'Blackwater / sewage management', fnFr: 'Gestion des eaux noires et de l’assainissement',
    en: 'Constructed wetland blackwater treatment', fr: 'Zone humide reconstituée pour eaux noires',
    zone: [106, 289, 153, 147], crop: [33, 258, 300, 210],
    draw: (t) => {
      const b1 = [[12, 13], [17, 13], [17, 18.5], [12, 18.5]], b2 = [[8.9, 13], [11.2, 13], [11.2, 18.5], [8.9, 18.5]]
      const inlet = lay([[21, 15.5], [17, 15.75]], 1)
      const link = lay([[12, 15.75], [11.2, 15.75]], 0.4), outlet = lay([[8.9, 14.5], [7.6, 14.5]], 0.5)
      let reeds = ''
      for (const [e0, n0, e1, n1] of [[12.6, 13.6, 16.6, 18], [9.2, 13.6, 11, 18]])
        for (let e = e0 + 0.4; e < e1; e += 2.6) for (let n = n0 + 0.4; n < n1; n += 2.2) reeds += tuft(e, n)
      return `
        <path class="ov-tint" d="${patch(b1)}"/><path class="ov-line" d="${patch(b1)}"/>
        <path class="ov-tint" d="${patch(b2)}"/><path class="ov-line" d="${patch(b2)}"/>${reeds}
        <path class="ov-hide" d="${pathOf(inlet)}"/>${head(inlet)}
        <path class="ov-hide" d="${pathOf(link)}"/>${head(link)}
        <path class="ov-hide" d="${pathOf(outlet)}"/>${head(outlet)}
        ${notes(t, [lab('072-b1', G(14.5, 15.75), 'BED 1', 'BASSIN 1'),
                    lab('072-b2', G(10, 15.75), 'BED 2', 'BASSIN 2'),
                    lab('072-out', G(7.6, 14.5), 'OUTLET', 'SORTIE')])}`
    },
  },
  {
    /* SOL-067: treated greywater fed into drip lines buried under planting, on ground below the
       treatment outlet so it runs by gravity. One label: the inflow arrow already says where the
       water comes from, and a FROM TREATMENT label sat on the tree and the cut line to say it. */
    id: 'SOL-067', base: 'site', fnEn: 'Greywater management', fnFr: 'Gestion des eaux grises',
    en: 'Subsurface irrigation reuse', fr: 'Réutilisation par irrigation souterraine',
    zone: [95, 293, 178, 138], crop: [34, 257, 300, 210],
    draw: (t) => {
      const header = lay([[18.8, 12], [18.8, 6]], 0.8)
      let rows = '', plants = ''
      for (const n of [6, 7.5, 9, 10.5]) rows += `<path class="ov-hide" d="${pathOf(lay([[18.8, n], [10.2, n]], 0.8))}"/>`
      // sparse on purpose: the buried lines are the subject, and a field of marks hid them
      for (let e = 10.5; e < 18; e += 3.8) for (const n of [6.75, 9.75]) plants += tuft(e, n)
      return `
        <path class="ov-tint soft" d="${patch([[10, 5.4], [18.8, 5.4], [18.8, 11.1], [10, 11.1]])}"/>
        <path class="ov-hide" d="${pathOf(header)}"/>${head(header)}${rows}${plants}
        ${notes(t, [lab('067-drip', G(13.5, 8.25), 'DRIP LINES, BURIED', 'GOUTTE-À-GOUTTE ENTERRÉ')])}`
    },
  },
  {
    /* SOL-068: where the water is not reused, a drainage field -- a box splitting the flow into
       gravel trenches, each with a perforated pipe along it, below the outlet. */
    id: 'SOL-068', base: 'site', fnEn: 'Greywater management', fnFr: 'Gestion des eaux grises',
    en: 'Permitted discharge to soil/drainage field', fr: 'Rejet autorisé vers un épandage',
    zone: [91, 298, 178, 134], crop: [30, 260, 300, 210],
    draw: (t) => {
      const feed = lay([[18.8, 12], [18.8, 9.1]], 0.8)
      const spine = lay([[18.3, 5.8], [18.3, 10.8]], 0.8)
      let trenches = ''
      for (const n of [5.8, 8.3, 10.8]) {
        trenches += `<path class="ov-line hair" d="${pathOf(lay([[17.8, n + 0.35], [9.6, n + 0.35]], 1))}"/>`
                  + `<path class="ov-line hair" d="${pathOf(lay([[17.8, n - 0.35], [9.6, n - 0.35]], 1))}"/>`
                  + `<path class="ov-hide" d="${pathOf(lay([[18.3, n], [10, n]], 1))}"/>`
      }
      return `
        <path class="ov-hide" d="${pathOf(feed)}"/>${head(feed)}
        <path class="ov-fill" d="${patch([[18.3, 7.8], [19.3, 7.8], [19.3, 8.8], [18.3, 8.8]])}"/>
        <path class="ov-hide" d="${pathOf(spine)}"/>${trenches}
        ${notes(t, [lab('068-field', G(13.5, 8.3), 'DRAINAGE TRENCHES', 'TRANCHÉES D’ÉPANDAGE')])}`
    },
  },
  {
    /* SOL-078: an intake on the stream, a penstock down the bank, a turbine house at the foot, and
       a cable to the house. The head it needs is the plate's point, so it gets the long section. */
    id: 'SOL-078', base: 'site', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie',
    en: 'Micro-hydro turbine', fr: 'Micro-turbine hydraulique',
    zone: [31, 243, 267, 296], crop: [0, 243, 423, 296],
    draw: (t) => {
      const weir = P(W.weir[0], W.weir[1], zWater(W.weir[0], W.weir[1]))
      const pen = lay([[2.6, 26.6], [3.9, 25.6], [3.9, 5.2], [4.4, 4.5]], 1.2, 0.3)
      const tail = lay([[4, 3.2], [2.2, 3.2]], 0.5)
      const cable = lay([[6, 3.6], [22.5, 4.4], [22.5, 10.5]], 1.5)
      const bedA = zWater(W.weir[0], W.weir[1]), bedB = Zg(W.pump[0], W.pump[1]) - 0.10
      const U1 = W.weir[1] - W.pump[1], px = LSx(U1), pz = LSz(bedB)
      const gnd = `M${LSx(0)},${LSz(bedA)} L${px},${pz} L${px},${LS.y + LS.h} L${LSx(0)},${LS.y + LS.h} Z`
      const detail = `
        ${hatchPath(gnd, 8)}
        <path class="dr-line" d="M${LSx(0)},${LSz(bedA)} L${px},${pz}"/>
        <path class="ov-line" d="M${LSx(0)},${LSz(bedA)} v-13"/>
        <path class="ov-line" d="M${LSx(0.6)},${LSz(bedA) - 6} L${px - 14},${pz - 10}"/>
        <rect class="ov-fill" x="${px - 14}" y="${pz - 20}" width="18" height="16"/>
        <circle class="ov-line hair" cx="${px - 5}" cy="${pz - 12}" r="5" fill="none"/>
        <path class="ov-dash" d="M${LSx(0)},${LSz(bedB)} H${LSx(3.4)}"/>
        <path class="ov-line hair" d="M${LSx(2.1)},${LSz(bedA)} V${LSz(bedB)}"/>
        ${arrowAt([LSx(2.1), LSz(bedA)], [LSx(2.1), LSz(bedA) + 12], 'ov-line hair')}
        ${arrowAt([LSx(2.1), LSz(bedB)], [LSx(2.1), LSz(bedB) - 12], 'ov-line hair')}
        <text class="ov-num" x="${LSx(2.8)}" y="${r1((LSz(bedA) + LSz(bedB)) / 2)}" text-anchor="start" font-size="9">${HEAD_DRIVE} m</text>
        <text class="ov-txt" x="${LSx(0) + 5}" y="${LSz(bedA) - 17}" style="font-size:8px">${t('INTAKE', 'PRISE')}</text>
        <text class="ov-txt" x="${px - 16}" y="${pz - 24}" text-anchor="end" style="font-size:8px">${t('TURBINE', 'TURBINE')}</text>
        <text class="ov-num" x="${LSx(11)}" y="${LS.y + LS.h - 7}" text-anchor="middle" font-size="8.5">${U1} m @ ${r1(HEAD_DRIVE / U1 * 100)}%</text>`
      return `
        <path class="ov-line" d="M${weir[0] - 9},${weir[1] - 3} h18"/>
        <path class="ov-line" d="${pathOf(pen)}"/>${head(pen)}
        ${hut(4, 6, 2.5, 4.5, 2)}
        <path class="ov-line hair" d="${pathOf(tail)}"/>${head(tail)}
        <path class="ov-hide" d="${pathOf(cable)}"/>
        ${longSection(t, ['ALONG THE STREAM', 'LE LONG DU RUISSEAU'], detail)}
        ${notes(t, [lab('078-intake', weir, 'INTAKE', 'PRISE D’EAU'),
                    lab('078-pen', G(3.9, 16), 'PENSTOCK', 'CONDUITE FORCÉE'),
                    lab('078-turb', G(5, 3.5), 'TURBINE HOUSE', 'LOCAL DE LA TURBINE'),
                    lab('078-cable', G(14, 4), 'CABLE', 'CÂBLE')])}`
    },
  },
  {
    /* SOL-218: a wheel turned by the current, a coil of pipe round it, and a delivery pipe from its
       hub up to a tank. It needs current rather than head, so the side view shows the wheel. */
    id: 'SOL-218', base: 'site', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable',
    en: 'Spiral pump (coil pump)', fr: 'Pompe à spirale',
    zone: [110, 255, 138, 159], crop: [29, 230, 300, 210],
    draw: (t) => {
      const wh = wheel(2.2, 15, 1.2)
      const hose = [wh.hub].concat(lay([[3.6, 15], [9.6, 20.2], [10.6, 24.4]], 1.2, 0.2))
      const cx = LS.x + 80, cy = LS.y + 80, R = 30
      let spiral = []
      for (let i = 0; i <= 180; i++) {
        const a = i / 180 * 6 * Math.PI, r = 6 + i / 180 * 20
        spiral.push([r1(cx + r * Math.cos(a)), r1(cy + r * Math.sin(a))])
      }
      let paddles = '', waves = ''
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * 2 * Math.PI
        paddles += `<path class="ov-line" d="M${r1(cx + R * Math.cos(a))},${r1(cy + R * Math.sin(a))} L${r1(cx + (R + 7) * Math.cos(a))},${r1(cy + (R + 7) * Math.sin(a))}"/>`
      }
      for (let x = 50; x < 236; x += 22) waves += `<path class="dr-line hair" d="M${x},154 q5,-4 10,0 t10,0"/>`
      const detail = `
        <line class="dr-line" x1="${LS.x + 8}" y1="150" x2="${LS.x + LS.w - 8}" y2="150"/>${waves}
        <circle class="ov-line" cx="${cx}" cy="${cy}" r="${R}" fill="none"/>${paddles}
        <path class="ov-line hair" d="${pathOf(spiral)}"/>
        <circle class="ov-fill" cx="${cx}" cy="${cy}" r="3"/>
        <path class="ov-line hair" d="M${cx + 3},${cy} H200 V86"/>${arrowAt([200, 86], [200, 100], 'ov-line hair')}
        <text class="ov-txt" x="150" y="114" style="font-size:8px">${t('COIL', 'SPIRALE')}</text>
        <text class="ov-txt" x="196" y="90" text-anchor="end" style="font-size:8px">${t('TO THE TANK', 'VERS LA CUVE')}</text>
        <text class="ov-txt" x="${LS.x + 12}" y="166" style="font-size:8px">${t('PADDLES', 'PALETTES')}</text>`
      return `
        ${wh.svg}
        <path class="ov-line hair" d="${pathOf(hose)}"/>${head(hose)}
        ${hut(9.9, 11.3, 24.4, 25.8, 1.3)}
        ${insetBox(t, ['THE WHEEL, FROM THE SIDE', 'LA ROUE, DE PROFIL'], detail)}
        ${notes(t, [lab('218-wheel', wh.hub, 'COIL WHEEL', 'ROUE À SPIRALE'),
                    lab('218-tank', G(10.6, 25.1), 'TANK', 'CUVE')])}`
    },
  },
  {
    /* SOL-220: a wheel in the stream driving a shaft, and the shaft driving the machine directly,
       on the bank -- the work happens where the water is. */
    id: 'SOL-220', base: 'site', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie',
    en: 'Water motor for direct mechanical drive', fr: 'Moteur hydraulique à entraînement direct',
    zone: [97, 283, 140, 102], crop: [17, 229, 300, 210],
    draw: (t) => {
      const wh = wheel(2.2, 20, 1.4)
      const shaft = [wh.hub, P(4.4, 20, wh.zc)]
      return `
        ${wh.svg}
        <path class="ov-line" d="${pathOf(shaft)}"/>
        ${hut(4.4, 6.6, 18.9, 21.1, 2.2)}
        ${notes(t, [lab('220-wheel', wh.hub, 'WATER WHEEL', 'ROUE HYDRAULIQUE'),
                    lab('220-shaft', P(3.3, 20, wh.zc), 'SHAFT', 'ARBRE'),
                    lab('220-shop', P(5.5, 18.9, Zg(5.5, 20) + 1.1), 'THE MACHINE', 'LA MACHINE')])}`
    },
  },
  {
    /* SOL-054: a box built over the spring the base already draws, and a buried line falling from
       it to the house -- no pump, because the spring is higher than the house. The line stops at
       the visible south-east corner: any wall it met further round is behind the house here. */
    id: 'SOL-054', base: 'site', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable',
    en: 'Spring capture', fr: 'Captage de source',
    zone: [311, 42, 130, 272], crop: [182, 42, 389, 272],
    draw: (t) => {
      const line = lay([[50.4, 25.3], [40, 14], [33.2, 10.6]], 1.5)
      return `
        ${hut(50.3, 51.7, 25.3, 26.7, 0.8)}
        <path class="ov-hide" d="${pathOf(line)}"/>${head(line)}
        ${notes(t, [lab('054-box', G(51, 26), 'SPRING BOX', 'CHAMBRE DE CAPTAGE'),
                    lab('054-line', G(40, 14), 'GRAVITY LINE', 'CONDUITE GRAVITAIRE')])}`
    },
  },
  {
    /* SOL-014: the house's own footprint, outlined, and beside it in plan the same floor area
       spread into an L. The L's perimeter is its bounding rectangle's, so the extra wall is
       arithmetic, not a claim: 42 m against 48 m for 108 square metres. */
    id: 'SOL-014', base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Compact rectangular footprint', fr: 'Emprise au sol compacte et rectangulaire',
    zone: [177, 272, 161, 111], crop: [108, 223, 300, 210],
    draw: (t) => {
      const q = (pts) => pathOf(pts.map(([e, n]) => P(e, n, H.z)))
      const k = 3.4, ox = 58, oy = 92
      const rect = `M${ox},${oy} h${12 * k} v${9 * k} h${-12 * k} z`
      const lx = ox + 12 * k + 26
      const ell = `M${lx},${oy} h${9.6 * k} v${5 * k} h${5.4 * k} v${4 * k} h${-15 * k} z`
      const detail = `
        <path class="ov-tint" d="${rect}"/><path class="ov-line" d="${rect}"/>
        <path class="ov-dash" d="${ell}"/>
        <text class="ov-num" x="${ox + 6 * k}" y="${oy + 9 * k + 16}" text-anchor="middle" font-size="8.5">42 m</text>
        <text class="ov-num" x="${lx + 7.5 * k}" y="${oy + 9 * k + 16}" text-anchor="middle" font-size="8.5">48 m</text>
        <text class="ov-txt" x="${ox + 6 * k}" y="${oy + 9 * k + 30}" text-anchor="middle" style="font-size:8px">${t('OF WALL', 'DE MUR')}</text>
        <text class="ov-txt" x="${lx + 7.5 * k}" y="${oy + 9 * k + 30}" text-anchor="middle" style="font-size:8px">${t('OF WALL', 'DE MUR')}</text>`
      return `
        <path class="ov-line" d="${q([[H.e0, H.n1], [H.e0, H.n0], [H.e1, H.n0]])}"/>
        ${insetBox(t, ['IN PLAN, SAME FLOOR AREA', 'EN PLAN, MÊME SURFACE'], detail)}
        ${notes(t, [lab('014-foot', P(H.e0, H.n0, H.z), 'COMPACT FOOTPRINT', 'EMPRISE COMPACTE')])}`
    },
  },
  {
    /* SOL-027: louvres on the west window, turned against the low evening sun that an overhang
       cannot reach. The plan inset shows the turn, which the site view is too small to. */
    id: 'SOL-027', base: 'site', fnEn: 'Thermal comfort', fnFr: 'Confort thermique',
    en: 'Adjustable brise-soleil / shutters (east-west)', fr: 'Brise-soleil ou volets orientables (est-ouest)',
    zone: [120, 273, 198, 115], crop: [69, 226, 300, 210],
    draw: (t) => {
      let fins = ''
      for (const n of [14.2, 14.9, 15.6, 16.3])
        fins += `<path class="ov-line hair" d="${pathOf([P(H.e0, n, H.z + 0.9), P(H.e0 - 0.6, n, H.z + 0.9), P(H.e0 - 0.6, n, H.z + 2.7), P(H.e0, n, H.z + 2.7)])}"/>`
      const rays = [0, 1].map((i) => {
        const a = P(7, 14.6 + i * 1.2, H.z + 5.4), b = P(20, 14.6 + i * 1.2, H.z + 2.2)
        return `<path class="ov-dash" d="${pathOf([a, b])}"/>${arrowAt(b, a, 'ov-line hair', 7)}`
      }).join('')
      let pf = ''
      for (let y = 100; y <= 140; y += 10) pf += `<path class="ov-line" d="M190,${y} L${r1(190 - 16 * Math.cos(0.7))},${r1(y - 16 * Math.sin(0.7))}"/>`
      const detail = `
        <path class="dr-line fat" d="M190,78 V96 M190,144 V162"/>
        ${pf}
        <path class="ov-dash" d="M58,150 L150,112"/>${arrowAt([150, 112], [58, 150], 'ov-line hair', 7)}
        <path class="ov-dash" d="M58,134 L150,96"/>${arrowAt([150, 96], [58, 134], 'ov-line hair', 7)}
        <text class="ov-txt" x="${LS.x + 12}" y="164" style="font-size:8px">${t('LOW SUN', 'SOLEIL BAS')}</text>
        <text class="ov-txt" x="200" y="124" style="font-size:8px">${t('WALL', 'MUR')}</text>`
      return `
        ${fins}${rays}
        ${insetBox(t, ['IN PLAN, THE LOUVRES TURN', 'EN PLAN, LES LAMES TOURNENT'], detail)}
        ${notes(t, [lab('027-fins', P(H.e0 - 0.6, 15.2, H.z + 2.7), 'ADJUSTABLE LOUVRES', 'LAMES ORIENTABLES'),
                    lab('027-sun', P(9, 15.2, H.z + 5), 'LOW EVENING SUN', 'SOLEIL BAS DU SOIR')])}`
    },
  },
  {
    /* SOL-077: a guyed mast on the high north-east corner, clear of the trees, and a buried cable
       to the house. Moved there by the collision test: on the upper slope its guys stood in
       SOL-201's inflow, the clear run that row asks for. */
    id: 'SOL-077', base: 'site', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie',
    en: 'Small wind turbine', fr: 'Petite éolienne',
    zone: [299, 18, 190, 305], crop: [176, 18, 436, 305],
    draw: (t) => {
      const me = 53, mn = 24.5, z0 = Zg(me, mn), top = z0 + 11, R = 1.8
      const foot = P(me, mn, z0), tip = P(me, mn, top)
      let blades = ''
      for (const a of [90, 210, 330]) {
        const r = a * Math.PI / 180
        blades += `<path class="ov-line" d="${pathOf([tip, P(me, mn + R * Math.cos(r), top + R * Math.sin(r))])}"/>`
      }
      const guyAt = P(me, mn, z0 + 7.5)
      let guys = ''
      for (const a of [120, 240, 0]) {
        const r = a * Math.PI / 180, ge = Math.min(53.8, me + 4 * Math.cos(r)), gn = mn + 4 * Math.sin(r)
        guys += `<path class="ov-line hair" d="${pathOf([guyAt, G(ge, gn)])}"/>`
      }
      const cable = lay([[me, mn], [50, 13], [31, 10.5]], 1.5)
      return `
        ${guys}
        <path class="ov-line" d="${pathOf([foot, tip])}"/>
        <path class="ov-fill" d="M${tip[0] - 5},${tip[1] - 3} h10 v6 h-10 z"/>${blades}
        <path class="ov-hide" d="${pathOf(cable)}"/>
        ${notes(t, [lab('077-rotor', tip, 'TURBINE', 'ÉOLIENNE'),
                    lab('077-mast', P(me, mn, z0 + 4), 'GUYED MAST', 'MÂT HAUBANÉ'),
                    lab('077-cable', G(41, 11.8), 'CABLE', 'CÂBLE')])}`
    },
  },
  {
    /* SOL-187: a mesh net between two posts on the exposed top corner, square to the fog-carrying
       wind; a gutter along its foot, and a pipe down to a tank lower on the slope. */
    id: 'SOL-187', base: 'site', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable',
    en: 'Fog collector (cloud net)', fr: 'Capteur de brouillard (filet à nuages)',
    zone: [251, 20, 200, 207], crop: [201, 19, 300, 210],
    draw: (t) => {
      const e0 = 47, e1 = 53, n = 29, zb = Zg(50, n)
      const at = (e, dz) => P(e, n, zb + dz)
      const net = [at(e0, 1.5), at(e1, 1.5), at(e1, 5.5), at(e0, 5.5)]
      let mesh = ''
      for (let e = e0 + 1; e < e1; e += 1) mesh += `<path class="ov-line hair" d="${pathOf([at(e, 1.5), at(e, 5.5)])}"/>`
      for (const dz of [2.5, 3.5, 4.5]) mesh += `<path class="ov-line hair" d="${pathOf([at(e0, dz), at(e1, dz)])}"/>`
      const posts = [e0, e1].map((e) => `<path class="ov-line" d="${pathOf([P(e, n, Zg(e, n)), at(e, 6)])}"/>`).join('')
      const pipe = [at(e0, 1.3)].concat(lay([[e0 - 0.3, n - 0.3], [38.6, 27.6]], 1.5, 0.1))
      const wind = [48.5, 51.5].map((e) => { const a = P(e, n + 3.2, zb + 3.5), b = P(e, n + 0.4, zb + 3.5); return `<path class="ov-dash" d="${pathOf([a, b])}"/>${arrowAt(b, a, 'ov-line hair', 7)}` }).join('')
      return `
        ${wind}
        <path class="ov-tint" d="${pathOf(net, true)}"/>${mesh}<path class="ov-line" d="${pathOf(net, true)}"/>${posts}
        <path class="ov-line" d="${pathOf([at(e0, 1.3), at(e1, 1.3)])}"/>
        <path class="ov-line hair" d="${pathOf(pipe)}"/>${head(pipe)}
        ${hut(37.8, 39.2, 26.9, 28.3, 1.2)}
        ${notes(t, [lab('187-net', at(50, 5.5), 'MESH NET', 'FILET'),
                    lab('187-gutter', at(e1, 1.3), 'GUTTER', 'GOUTTIÈRE'),
                    lab('187-tank', G(38.5, 27.6), 'TANK', 'CUVE'),
                    lab('187-fog', P(50, n + 3.2, zb + 3.5), 'FOG', 'BROUILLARD')])}`
    },
  },
  {
    /* SOL-204: a tarpaulin slung from four poles on open ground, sagging to a low point over a
       container -- no roof involved. */
    id: 'SOL-204', base: 'site', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable',
    en: 'Free-standing rainwater catchment', fr: 'Récupérateur d’eau de pluie autoporté',
    zone: [366, 214, 169, 106], crop: [301, 162, 300, 210],
    draw: (t) => {
      const c = [[44.5, 4.2], [48.5, 4.2], [48.5, 7.2], [44.5, 7.2]]
      const tops = c.map(([e, n]) => P(e, n, Zg(e, n) + 2.2))
      const low = P(46.5, 5.7, Zg(46.5, 5.7) + 1.2)
      const poles = c.map(([e, n], i) => `<path class="ov-line" d="${pathOf([G(e, n), tops[i]])}"/>`).join('')
      let sheet_ = ''
      for (let i = 0; i < 4; i++) sheet_ += `<path class="ov-tint" d="${pathOf([tops[i], tops[(i + 1) % 4], low], true)}"/>`
      const ridges = tops.map((p) => `<path class="ov-line hair" d="${pathOf([p, low])}"/>`).join('')
      return `
        ${hut(46, 47, 5.2, 6.2, 0.9)}
        ${poles}${sheet_}${ridges}
        <path class="ov-line" d="${pathOf(tops, true)}"/>
        ${notes(t, [lab('204-tarp', tops[1], 'TARPAULIN', 'BÂCHE'),
                    lab('204-box', G(46.5, 5.2), 'CONTAINER', 'RÉCIPIENT')])}`
    },
  },
  {
    /* SOL-234, drawn and approved 2026-09-15. Eric: a kerterre is an addition to a house (a garden shed)
       and/or one of several small buildings that together make a household. The site sheet shows
       the first -- one kerterre in the north-west corner of the garden, clear of the spiral pump's
       tank, the diversion swale's outfall and the trees (the first spot, beside the house, sat on
       the ram pump's feed pipe) -- and the inset shows the second, in plan. */
    id: 'SOL-234', base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Kerterre (small hand-sculpted hemp-lime building)', fr: 'Kerterre (petit bâtiment en chanvre et chaux)',
    zone: [22, 168, 191, 107], crop: [0, 117, 300, 210],
    draw: (t) => {
      const cx = 142, cy = 108
      const pods = [[cx - 40, cy + 10, 16], [cx, cy - 10, 21], [cx + 41, cy + 12, 15]]
      const plan = pods.map(([x, y, r]) =>
        `<circle class="ov-fill" cx="${x}" cy="${y}" r="${r}"/><circle class="ov-tint" cx="${x}" cy="${y}" r="${r}"/>`).join('')
      const detail = `
        ${plan}
        <path class="ov-line hair" d="M${cx - 26},${cy + 2} L${cx - 18},${cy - 3} M${cx + 19},${cy - 2} L${cx + 28},${cy + 5}"/>
        <text class="ov-txt" x="${cx}" y="${LS.y + LS.h - 21}" text-anchor="middle" style="font-size:8px">${t('OR SEVERAL, TOGETHER', 'OU PLUSIEURS, ENSEMBLE')}</text>
        <text class="ov-txt" x="${cx}" y="${LS.y + LS.h - 8}" text-anchor="middle" style="font-size:8px">${t('ONE HOUSEHOLD', 'UN FOYER')}</text>`
      return `
        ${dome(13.8, 28.2, 1.5, 2.3)}
        ${insetBox(t, ['IN PLAN', 'EN PLAN'], detail)}
        ${notes(t, [lab('234-annex', P(13.8, 28.2, Zg(13.8, 28.2) + 2.3), 'KERTERRE, AS A GARDEN SHED', 'KERTERRE, EN ABRI DE JARDIN')])}`
    },
  },
  {
    id: 'SOL-244', base: 'site', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Earth wood-fired bread oven', fr: 'Four à bois en terre crue',
    zone: [323, 41, 132, 114], crop: [239, 0, 300, 210],
    // Outdoors, among the trees east of the house: it bakes outside, so the house does not overheat.
    // Placed by an occupancy search of the sheet (2026-09-24): the ground north-west of the house
    // was a tree, then the rain garden and the earth berm; this is the one open patch it touches
    // nothing on, clear of the trees.
    draw: (t) => `${breadOven(48, 25.5)}${notes(t, [lab('244-oven', P(48, 25.5, Zg(48, 25.5) + 1.9), 'EARTH BREAD OVEN', 'FOUR EN TERRE')])}`,
  },
  /* ---- building forms, overprinted on the house (approved by Eric, 2026-09-17) ------------------------
     Eric: the form drawn over the house shape, in the same perspective and at its real size, so the
     base house reads underneath as the comparison. No inset: the overprint carries the idea. */
  {
    id: 'SOL-233', ghostHouse: true, base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Vault or dome shell (walls and roof in one)', fr: 'Voûte ou dôme autoportant (murs et toit d’un seul tenant)',
    zone: [205, 190, 150, 140], crop: [150, 160, 260, 200],
    draw: (t) => { const f = vaultForm(); return `${f.svg}${notes(t, [lab('233-vault', f.top, 'EARTH VAULT, SAME FLOOR', 'VOÛTE DE TERRE, MÊME SURFACE')])}` },
  },
  {
    id: 'SOL-235', ghostHouse: true, base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Roundhouse (round timber frame with a reciprocal roof)', fr: 'Maison ronde (ossature bois et toit réciproque)',
    zone: [205, 190, 150, 140], crop: [150, 160, 260, 200],
    draw: (t) => { const f = roundForm(); return `${f.svg}${notes(t, [lab('235-round', f.top, 'ROUNDHOUSE, 9 M ACROSS', 'MAISON RONDE, 9 M DE DIAMÈTRE')])}` },
  },
  {
    id: 'SOL-236', ghostHouse: true, base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'A-frame house', fr: 'Maison en A',
    zone: [205, 190, 150, 140], crop: [150, 160, 260, 200],
    draw: (t) => { const f = aframeForm(); return `${f.svg}${notes(t, [lab('236-aframe', f.top, 'A-FRAME, GABLE TO THE SOUTH', 'MAISON EN A, PIGNON AU SUD')])}` },
  },
  {
    id: 'SOL-237', ghostHouse: true, base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Geodesic dome', fr: 'Dôme géodésique',
    zone: [205, 190, 150, 140], crop: [150, 160, 260, 200],
    draw: (t) => { const f = geoForm(); return `${f.svg}${notes(t, [lab('237-dome', f.top, 'GEODESIC DOME, 10 M ACROSS', 'DÔME GÉODÉSIQUE, 10 M')])}` },
  },
  {
    id: 'SOL-238', base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Earth-bermed house (earth banked against the walls)', fr: 'Maison en butte de terre (murs remblayés)',
    zone: [180, 180, 200, 160], crop: [140, 160, 280, 200],
    draw: (t) => { const f = bermForm(); return `${f.svg}${notes(t, [lab('238-berm', f.top, 'EARTH BANKED ON THREE SIDES', 'TERRE REMBLAYÉE SUR TROIS CÔTÉS')])}` },
  },
  {
    id: 'SOL-240', ghostHouse: true, base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Yurt (round lattice-frame dwelling)', fr: 'Yourte (habitat rond à treillis démontable)',
    zone: [205, 190, 150, 140], crop: [150, 160, 260, 200],
    draw: (t) => { const f = yurtForm(); return `${f.svg}${notes(t, [lab('240-yurt', f.top, 'YURT, 7 M ACROSS', 'YOURTE, 7 M DE DIAMÈTRE')])}` },
  },
  {
    id: 'SOL-241', ghostHouse: true, base: 'site', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Underground courtyard house (sunken pit dwelling)', fr: 'Maison enterrée autour d’un patio',
    zone: [180, 180, 200, 180], crop: [140, 160, 280, 220],
    draw: (t) => { const f = courtyardForm(); return `${f.svg}${notes(t, [lab('241-yard', f.top, 'COURTYARD, 6 M DOWN', 'PATIO, 6 M SOUS TERRE')])}` },
  },
]
/* <<< spliced from Demo-Site-Plan.html */

export const SITE_PLATES = SOLUTIONS.filter((p) => !p.proposal)

export const sitePlateFor = (id) => SITE_PLATES.find((p) => p.id === id) || null

/* Five metres along the east axis, bottom left, where the section plates keep theirs. A bar laid flat
   across the page would be a length this projection does not measure. */
const siteScalebar = () => {
  const U = [0.866, -0.5], L = 5 * S, x0 = 44, y0 = 532
  const at = (f) => [r1(x0 + U[0] * L * f), r1(y0 + U[1] * L * f)]
  let s = ''
  for (let i = 0; i < 5; i++) {
    const a = at(i / 5), b = at((i + 1) / 5)
    s += `<path class="pl-hair" d="${pathOf([a, b, [b[0], b[1] - 4], [a[0], a[1] - 4]], true)}"
            fill="${i % 2 ? 'none' : 'currentColor'}"/>`
  }
  const end = at(1)
  return s + `<text class="pl-num" x="${x0 - 6}" y="${y0}" font-size="8.5" text-anchor="end">0</text>
              <text class="pl-num" x="${end[0] + 4}" y="${y0}" font-size="8.5">5 m</text>`
}

/**
 * One site plate as an SVG string -- the same contract as plateSvg() in plates.js, so Plate.jsx can
 * call either. A plate whose marks run round the house (`behind: 'mask'`) has them masked by the
 * house's outline on the sheet, because on this projection the ground behind the house is hidden
 * by it.
 */
/** Several site plates on one sheet: the same contract as composedSvg() in plates.js. */
export function composedSiteSvg(plates, { t, selected = null, chrome = true, layerClass = () => '', at = null, ghost = null, post = (p, f) => f, label = null } = {}) {
  const fid = 'spc' + (uid++)
  const sel = plates.find((p) => p.id === selected)
  const base = SITEBASE(ghost ?? !!(sel && sel.ghostHouse))
  const draw = (p) => (p.behind === 'mask'
    ? `<mask id="m${fid}${p.id}"><rect x="-40" y="-40" width="920" height="640" fill="#fff"/><path d="${HOUSE_SIL}" fill="#000"/></mask>
       <g mask="url(#m${fid}${p.id})">${post(p, p.draw(t))}</g>`
    : post(p, p.draw(t)))
  const layer = (p) => `<g class="gh-layer${sel ? (p === sel ? ' is-on' : ' is-off') : ''}${layerClass(p)}" data-plate="${p.id}">${draw(p)}</g>`
  const baseSvg = sel
    ? `<clipPath id="${fid}"><rect x="${sel.zone[0]}" y="${sel.zone[1]}" width="${sel.zone[2]}" height="${sel.zone[3]}"/></clipPath>
       <g class="pl-dim">${base}</g><g clip-path="url(#${fid})">${base}</g>`
    : `<g class="pl-dim">${base}</g>`
  return `
<svg ${at ? `x="${at[0]}" y="${at[1]}" width="${at[2]}" height="${at[3]}" ` : ''}viewBox="0 0 840 560" xmlns="http://www.w3.org/2000/svg" class="${at ? 'plate-sub' : 'plate-svg'}" role="img"${label ? ` aria-label="${esc(label).replace(/"/g, '&quot;')}"` : ''}>
  <rect class="pl-paper" x="-40" y="-40" width="920" height="640"/>
  ${chrome ? `<rect class="pl-line" x="18" y="18" width="804" height="524"/>
              <rect class="pl-hair" x="26" y="26" width="788" height="508"/>` : ''}
  ${baseSvg}
  ${plates.filter((p) => p !== sel).map(layer).join('')}${sel ? layer(sel) : ''}
  ${chrome ? siteScalebar() : ''}
</svg>`
}

export function sitePlateSvg(plate, { view = null, t, chrome = true, post = (p, f) => f, label = null, titleBlock = null } = {}) {
  const fid = 'spf' + (uid++)
  const [zx, zy, zw, zh] = plate.zone
  // With a title block the sheet gains a band under the drawing for it.
  const band = titleBand(titleBlock)
  const vb = view ? view.join(' ') : `0 0 840 ${560 + band}`
  const base = SITEBASE(plate.ghostHouse)
  const overlay = plate.behind === 'mask'
    ? `<mask id="m${fid}"><rect x="-40" y="-40" width="920" height="640" fill="#fff"/><path d="${HOUSE_SIL}" fill="#000"/></mask>
       <g mask="url(#m${fid})">${post(plate, plate.draw(t))}</g>`
    : post(plate, plate.draw(t))
  return `
<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="plate-svg" role="img"
     aria-label="${esc(label || t(plate.en, plate.fr)).replace(/"/g, '&quot;')}">
  <rect class="pl-paper" x="-40" y="-40" width="920" height="${640 + band}"/>
  ${chrome ? `<rect class="pl-line" x="18" y="18" width="804" height="${524 + band}"/>
              <rect class="pl-hair" x="26" y="26" width="788" height="${508 + band}"/>` : ''}
  <clipPath id="${fid}"><rect x="${zx}" y="${zy}" width="${zw}" height="${zh}"/></clipPath>
  <g class="pl-dim">${base}</g>
  <g clip-path="url(#${fid})">${base}</g>
  ${overlay}
  ${chrome ? siteScalebar() + titleBlockSvg(titleBlock, 534 + band) : ''}
</svg>`
}
