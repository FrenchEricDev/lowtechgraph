// The section plates, EXTRACTED from Demo-Overlay-Illustrations.html rather than
// retyped, so the drawings Eric reviewed on 2026-09-09 and the drawings the app renders
// cannot drift apart. Regenerate with scripts/port_plates.py if the demo changes.
//
// WHAT IS DIFFERENT HERE, and why:
//   - No cartouche and no title in the corner. On the demo sheet they carried the solution
//     name; on a solution page the <h1> already does, and a drawing that repeats the page
//     title is chrome rather than information. The scale bar stays -- it is the one piece
//     of that block a reader actually uses, because it says how big the thing is.
//   - The colours come from the SITE's tokens, not from a fixed print palette. The demo
//     argued the opposite ("the sheet is an object on the page, like a photograph"), and
//     that was right for comparing whiteprint against blueprint. It is wrong here: a pale
//     sheet stranded in a dark-mode page glares, and the plate is not a guest on this page,
//     it is part of it.
//   - Mobile gets the CROP, not the plate. Same finding as the demo's thumbnails: the full
//     section is unreadable below about 600px, and the focus zone is the readable part.
//
// PREVIEW ONLY for now: nothing renders unless the design preview is active, so the 221
// solutions with no plate and every visitor who has not opted in see exactly what they
// see today.

/* --- geometry helpers ---------------------------------------------------- */
const earth = () => {
  let s = ''
  for (let x = 30; x <= 812; x += 15) s += `<line class="dr-line hair" x1="${x}" y1="450" x2="${x - 12}" y2="462"/>`
  return s
}

function arrow(x, y, dx, dy, size = 9) {
  const m = Math.hypot(dx, dy) || 1
  const ux = dx / m, uy = dy / m, nx = -uy, ny = ux
  const bx = x - ux * size, by = y - uy * size, w = size * 0.5
  const f = (n) => Math.round(n * 10) / 10
  return `<path class="ov-line hair" d="M${f(bx + nx * w)},${f(by + ny * w)} L${x},${y} `
       + `L${f(bx - nx * w)},${f(by - ny * w)}"/>`
}

let uid = 0
import { titleBlockSvg, titleBand } from './plateLegend.js'
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const escAttr = (v) => esc(v).replace(/"/g, '&quot;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function hatchAcc(x, y, w, h, step = 9) {
  const id = 'ha' + (uid++)
  let s = `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})">`
  for (let i = -h; i < w; i += step)
    s += `<line class="ov-line hair" x1="${x + i}" y1="${y + h}" x2="${x + i + h}" y2="${y}"/>`
  return s + '</g>'
}

/* --- the base section ----------------------------------------------------- */
const BASE = `
  <g>
    <!-- roof -->
    <path class="dr-fill" d="M104,196 L420,68 L736,196 L724,196 L420,84 L116,196 Z"/>
    <!-- chimney at the RIDGE since 2026-09-10 (the slot plan): a central core. Masked over the
         roof the way a real section stacks; below the roof it continues as the riser, drawn
         hidden because a chase is a column in plan and air and people pass around it. -->
    <path class="dr-fill" d="M402,30 h36 v62 h-36 z"/>
    <line class="dr-line hair" x1="398" y1="30" x2="442" y2="30"/>
    <!-- walls -->
    <path class="dr-fill" d="M150,186 h18 v262 h-18 z"/>
    <path class="dr-fill" d="M672,186 h18 v262 h-18 z"/>
    <!-- slabs -->
    <path class="dr-fill" d="M150,434 h540 v14 h-540 z"/>
    <path class="dr-fill" d="M168,300 h504 v12 h-504 z"/>
    <!-- footings -->
    <path class="dr-line" d="M142,448 h34 v26 h-34 z"/>
    <path class="dr-line" d="M664,448 h34 v26 h-34 z"/>
    <!-- ceiling tie -->
    <line class="dr-line" x1="150" y1="186" x2="690" y2="186"/>
    <!-- openings: south (right) upper and lower, north (left) -->
    <path class="dr-fill" d="M672,210 h18 v58 h-18 z"/>
    <line class="dr-line hair" x1="680" y1="212" x2="680" y2="266"/>
    <path class="dr-fill" d="M672,338 h18 v70 h-18 z"/>
    <line class="dr-line hair" x1="680" y1="340" x2="680" y2="406"/>
    <!-- the north window sits ABOVE the kitchen counter (sill 1.07 m, over a 0.90 m worktop) -->
    <path class="dr-fill" d="M150,328 h18 v42 h-18 z"/>
    <line class="dr-line hair" x1="158" y1="330" x2="158" y2="368"/>
    <!-- the riser, and the one partition the plan needs: kitchen | bath. Full height: the cut
         passes beside its door (a door gap floating mid-wall was a drawing of nothing). -->
    <line class="dr-hide" x1="402" y1="92" x2="402" y2="434"/>
    <line class="dr-hide" x1="438" y1="92" x2="438" y2="434"/>
    <line class="dr-line hair" x1="300" y1="312" x2="300" y2="434"/>
    <!-- the kitchen counter run, on the far (west) wall seen beyond the cut: worktop at 0.90 m,
         four modules (pantry | sink | appliance | cooker), a tap, the sink bowl, the hob.
         Cabinet doors are left off so that what stands inside them can be drawn. -->
    <path class="dr-fill" d="M168,377 h130 v4 h-130 z"/>
    <path class="dr-line hair" d="M168,428 H298 V381 M198,381 V428 M234,381 V428 M264,381 V428"/>
    <path class="dr-line hair" d="M202,381 V393 Q202,396 205,396 H227 Q230,396 230,393 V381 M216,396 V402"/>
    <path class="dr-line hair" d="M222,377 V362 Q222,356 216.5,356 Q211,356 211,361"/>
    <path class="dr-line hair" d="M267,377 V375 H295 V377"/>
    <!-- ground -->
    <line class="dr-line fat" x1="30" y1="448" x2="812" y2="448"/>
    ${earth()}
    <!-- dimensions -->
    <line class="dr-line hair" x1="150" y1="504" x2="690" y2="504"/>
    <line class="dr-line hair" x1="144" y1="498" x2="156" y2="510"/>
    <line class="dr-line hair" x1="684" y1="498" x2="696" y2="510"/>
    <line class="dr-line hair" x1="150" y1="452" x2="150" y2="510"/>
    <line class="dr-line hair" x1="690" y1="452" x2="690" y2="510"/>
    <text class="dr-num" x="420" y="500" text-anchor="middle">9.00</text>
    <line class="dr-line hair" x1="86" y1="186" x2="86" y2="448"/>
    <line class="dr-line hair" x1="80" y1="192" x2="92" y2="180"/>
    <line class="dr-line hair" x1="80" y1="454" x2="92" y2="442"/>
    <line class="dr-line hair" x1="82" y1="186" x2="146" y2="186"/>
    <text class="dr-num" x="80" y="320" text-anchor="middle" transform="rotate(-90 80 320)">5.20</text>
    <!-- orientation -->
    <text class="dr-txt" x="112" y="474">N</text>
    <text class="dr-txt" x="722" y="474">S</text>
  </g>`

/* --- the overlays --------------------------------------------------------- */
/* >>> plate helpers -- spliced into the app by scripts/port_plates.py; edit HERE only */
/* ONE WALL BUILD-UP, MANY PLATES (2026-09-10, the slot plan's first batch). Eric: similar
   solutions share one drawing, and views are reused wherever they can be. So every wall-layer
   solution is the same magnified slice through the NORTH wall -- outside on the left -- and a
   plate differs only in which layer is lit and named. Bands, outside to inside: cladding,
   ventilated gap, external insulation, structure (a timber frame with its insulated cavity, or
   a solid mass wall), airtight membrane, service gap, interior finish.
   The north wall because the south one is busy with windows, overhang and sunspace. */
let wduid = 0
const WD = { CX: 290, CY: 252, R: 92,
  B: { cladding: [224, 232], gap: [232, 240], extins: [240, 262], structure: [262, 306],
       cavity: [265, 303], membrane: [305, 308], finish: [316, 324] } }
function wallBubble(t, body, label, mid) {
  const { CX, CY, R } = WD, id = 'wdc' + (wduid++)
  return `<circle class="ov-dash" cx="159" cy="250" r="20"/>
    <path class="ov-line hair" d="M179,250 L198,251"/>
    <circle class="ov-fill" cx="${CX}" cy="${CY}" r="${R}"/>
    <clipPath id="${id}"><circle cx="${CX}" cy="${CY}" r="${R - 2}"/></clipPath>
    <g clip-path="url(#${id})">${body}</g>
    <text class="dr-num" x="206" y="256" font-size="9">${t('OUT', 'EXT')}</text>
    <text class="dr-num" x="376" y="256" font-size="9" text-anchor="end">${t('IN', 'INT')}</text>
    <path class="ov-line hair" d="M${mid},${CY + R - 8} L${CX},${CY + R + 10}"/>
    <text class="ov-txt" x="${CX}" y="${CY + R + 22}" text-anchor="middle">${t(label[0], label[1])}</text>`
}
function wallDetail(t, { variant = 'frame', hl = [], label, extra = '' }) {
  const { CY, R, B } = WD, top = CY - R, h = 2 * R
  const lit = (k) => hl.includes(k)
  const edge = (k) => `<path class="${lit(k) ? 'ov-line' : 'dr-line hair'}" d="M${B[k][0]},${top} V${top + h} M${B[k][1]},${top} V${top + h}"/>`
  const tint = (k) => lit(k) ? `<rect class="ov-tint" x="${B[k][0]}" y="${top}" width="${B[k][1] - B[k][0]}" height="${h}"/>` : ''
  const hatch = (k, step) => { let o = ''; const [a, b] = B[k], c = lit(k) ? 'ov-line hair' : 'dr-line hair'
    for (let y = top - (b - a); y < top + h; y += step) o += `<line class="${c}" x1="${a}" y1="${y + (b - a)}" x2="${b}" y2="${y}"/>`
    return o }
  const dots = (k) => { let o = ''; const [a, b] = B[k], c = lit(k) ? 'ov-num' : 'dr-num'
    for (let y = top + 5, r = 0; y < top + h; y += 8, r++) for (let x = a + 4 + (r % 2) * 4; x < b - 2; x += 8) o += `<circle class="${c}" cx="${x}" cy="${y}" r="1.2"/>`
    return o }
  const battens = () => [200, 252, 304].map((y) => `<rect class="${lit('gap') ? 'ov-line hair' : 'dr-line hair'}" x="233" y="${y}" width="6" height="12"/>`).join('')
  let body = ['cladding', 'gap', 'extins'].map(tint).join('') + tint(variant === 'frame' && lit('cavity') ? 'cavity' : 'structure')
    + tint('membrane') + tint('finish')
    + edge('cladding') + battens() + edge('extins') + hatch('extins', 7)
  if (variant === 'frame') {
    body += edge('structure') + `<path class="${lit('structure') ? 'ov-line' : 'dr-line hair'}" d="M265,${top} V${top + h} M303,${top} V${top + h}"/>`
      + `<rect class="${lit('structure') ? 'ov-hide' : 'dr-hide'}" x="279" y="${top}" width="10" height="${h}"/>`
      + (lit('cavity') ? `<path class="ov-line" d="M265,${top} V${top + h} M303,${top} V${top + h}"/>` : '') + hatch('cavity', 9)
  } else {
    body += edge('structure') + dots('structure')
  }
  body += `<path class="${lit('membrane') ? 'ov-line' : 'dr-line hair'}" d="M306.5,${top} V${top + h}"/>` + edge('finish') + extra
  // A membrane lit on its own is a 3-unit line beside black ones, and did not read (review,
  // 2026-09-10). What makes it THIS solution is the taped joints, so those are what is drawn.
  if (lit('membrane')) body += [196, 252, 308].map((y) => `<rect class="ov-line" x="301" y="${y - 2}" width="11" height="4"/>`).join('')
  const k = hl[0], mid = (B[k][0] + B[k][1]) / 2
  return wallBubble(t, body, label, mid)
}
/* The eave junction, for the one wall-layer plate that is about a CONNECTION rather than a
   layer: the strap tying rafter to wall top. Same bubble, same place, different slice. */
function eaveDetail(t) {
  const body = `<path class="dr-line hair" d="M252,344 V250 M300,344 V250"/>
    <path class="dr-fill" d="M246,238 h58 v12 h-58 z"/>
    <path class="dr-fill" d="M200,272 L380,192 L380,178 L200,258 Z"/>
    <path class="ov-line" d="M252,318 V246 L262,236 L286,226"/>
    <circle class="ov-num" cx="252" cy="300" r="2"/><circle class="ov-num" cx="252" cy="276" r="2"/>
    <circle class="ov-num" cx="276" cy="231" r="2"/>`
  return wallBubble(t, body, ['STRAP, RAFTER TO WALL', 'FEUILLARD, CHEVRON AU MUR'], 262)
    .replace('cx="159" cy="250" r="20"', 'cx="160" cy="190" r="20"').replace('M179,250 L198,251', 'M178,196 L204,212')
    .replace('x="206" y="256"', 'x="212" y="286"')   // OUT, off the rafter
}
/* ONE KITCHEN, MANY PLATES (2026-09-10, the second batch). The kitchen is a counter run on the
   far wall, in the base drawing: pantry | sink | appliance | cooker, worktop at 0.90 m. Each
   plate draws ONE object where it stands on that counter, at true size -- which is what the
   built house composes (`site`) -- and then a MAGNIFYING bubble: the same house, BASE and all,
   drawn again at 2.6x around the object. Unlike the wall bubble, which is a stylised slice, this
   one is literally a closer look, so an object is drawn once and cannot disagree with itself.
   Objects take `k`, their arrowhead size: 6 on the house, 3.5 inside the bubble.
   Labels are placed in house units and mapped into the bubble.
   Renamed closeUp() for the wet core (2026-09-10): it is the magnifier for ANY small object, not
   a kitchen thing. Long runs -- a stack, a duct, a drain -- need no magnifier and use annotated(). */
let kduid = 0
const KD = { CX: 300, CY: 186, R: 92, M: 2.6 }
// A note sits at SHEET coordinates -- inside the bubble or just outside it, wherever there is
// room -- and its optional leader points at a HOUSE-unit spot, mapped into the bubble by P
// (`site: true` points at the house drawing itself, unmapped).
// `fs` is set as a STYLE: the .ov-num class sets font-size, and a class beats an SVG attribute,
// so a font-size attribute here would be silently ignored (as every one on these plates is).
function noteSvg(t, P, { x, y, en, fr, a = 'start', to, from, rot = 0, fs, site = false }) {
  let s = `<text class="ov-num" x="${x}" y="${y}" text-anchor="${a}"${fs ? ` style="font-size:${fs}px"` : ''}${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${t(en, fr)}</text>`
  if (to) {
    const [px, py] = site ? to : P(to[0], to[1])
    // from: 'end' starts the leader where the text ends, in whichever language is showing: .ov-num
    // is monospace at 0.6 em, so the width is exact without measuring
    const w = t(en, fr).length * 0.6 * (fs || 11)
    const [fx, fy] = from === 'end' ? [x + w + 3, y - 3] : from || (a === 'start' ? [x - 4, y - 3] : a === 'end' ? [x + 4, y - 3] : [x, y - 10])
    s += `<path class="ov-line hair" d="M${fx},${fy} L${px},${py}"/>`
  }
  return s
}
// `at` moves the bubble: the utility room sits right under the default one, so its plates magnify
// into a bubble below, over the ground floor (UB). Magnification stays KD.M, so .mag holds.
function closeUp(t, { focus, obj, extra = () => '', notes = [], label, ring = 20, labelAt = null, at = null }) {
  const { CX, CY, R } = at || KD, M = KD.M, [ox, oy] = focus, id = 'kdc' + (kduid++)
  const f = (n) => Math.round(n * 10) / 10
  const P = (x, y) => [f(CX + M * (x - ox)), f(CY + M * (y - oy))]
  const d = Math.hypot(CX - ox, CY - oy), ux = (CX - ox) / d, uy = (CY - oy) / d
  // The name sits under the bubble, to the right, starting clear of where the leader crosses its
  // line. (Naming to the LEFT for objects east of centre ran long names into the north wall.)
  const sx = ox + ux * ring, sy = oy + uy * ring, ex = CX - ux * R, ey = CY - uy * R
  const ly = CY + R + 16, xl = sx + ((ly - sy) / (ey - sy)) * (ex - sx)
  // `labelAt` [x, y, anchor] overrides, for a plate whose own drawing runs through that spot
  const [lx, lyy, la] = labelAt || [f(Math.max(CX + 12, xl + 10)), ly, 'start']
  return `${obj(6)}
    <circle class="ov-dash" cx="${ox}" cy="${oy}" r="${ring}"/>
    <path class="ov-line hair" d="M${f(ox + ux * ring)},${f(oy + uy * ring)} L${f(CX - ux * R)},${f(CY - uy * R)}"/>
    <circle class="ov-fill" cx="${CX}" cy="${CY}" r="${R}"/>
    <clipPath id="${id}"><circle cx="${CX}" cy="${CY}" r="${R - 2}"/></clipPath>
    <g clip-path="url(#${id})"><g class="mag" transform="translate(${f(CX - M * ox)} ${f(CY - M * oy)}) scale(${M})">${BASE}${obj(3.5)}${extra()}</g></g>
    ${notes.map((n) => noteSvg(t, P, n)).join('')}
    <text class="ov-txt" x="${lx}" y="${lyy}" text-anchor="${la}">${t(label[0], label[1])}</text>`
}
// No bubble: the object on the house, its notes pointing straight at it, the name where it fits.
// `to` [x, y] gives the name a leader to that point of its object (brief 02, C: a name more than
// 24 units from what it names, or across a wall, floor or roof line, gets one).
function annotated(t, { obj, notes = [], label }) {
  const [en, fr, x, y, a = 'start', to = null] = label
  return `${obj(6)}${notes.map((n) => noteSvg(t, (px, py) => [px, py], n)).join('')}
    <text class="ov-txt" x="${x}" y="${y}" text-anchor="${a}">${t(en, fr)}</text>${to ? leaderSvg(t(en, fr), x, y, a, to) : ''}`
}
/*
 * A leader (brief 02, C): a hair line from the side of a label nearest its object, ending in a
 * 3-unit dot on it. The label's box is estimated from its letters (.ov-txt capitals run about
 * 7.8 units, a space 3.6, I and punctuation 4.5), so it holds in either language.
 */
function leaderSvg(word, x, y, a, [tx, ty]) {
  const w = [...word].reduce((n, c) => n + (c === ' ' ? 3.6 : /[I1.,:;'’()]/.test(c) ? 4.5 : 7.8), 0)
  const x0 = a === 'start' ? x : a === 'end' ? x - w : x - w / 2, x1 = x0 + w, y0 = y - 10, y1 = y + 3
  const cx = Math.min(Math.max(tx, x0), x1), cy = Math.min(Math.max(ty, y0), y1)
  const d = Math.hypot(tx - cx, ty - cy) || 1
  const sx = Math.round((cx + (tx - cx) / d * 3) * 10) / 10, sy = Math.round((cy + (ty - cy) / d * 3) * 10) / 10
  return `<path class="ov-line hair pl-leader" d="M${sx},${sy} L${tx},${ty}"/><circle class="ov-dot" cx="${tx}" cy="${ty}" r="3"/>`
}
// Every kitchen plate focuses the same room and frames the same bubble.
const KZ = { zone: [132, 306, 174, 130], crop: [200, 90, 200, 200], mobile: [140, 88, 450, 300] }
/* The objects, in house units. Counter: worktop 377-381, cabinets 381-428, plinth to 434.
   Modules: pantry 168-198 | sink 198-234 | appliance 234-264 | cooker 264-298. */
const KO = {
  // a cool cupboard on the north wall, vented straight through it: in low, out high
  pantry: (k) => `
    <path class="ov-line" d="M169,381 V428 H198 V381"/>
    <path class="ov-line hair" d="M170,397 h4 m2,0 h4 m2,0 h4 m2,0 h4 m2,0 h3 M170,413 h4 m2,0 h4 m2,0 h4 m2,0 h4 m2,0 h3"/>
    <path class="ov-fill" d="M150,385 h18 v6 h-18 z"/><path class="ov-fill" d="M150,418 h18 v6 h-18 z"/>
    <path class="ov-line hair" d="M140,421 H181 Q187,421 187,415 V394 Q187,388 181,388 H140"/>
    ${arrow(166, 421, 1, 0, k)}${arrow(187, 402, 0, -1, k)}${arrow(146, 388, -1, 0, k)}`,
  // three bins on a pull-out under the sink; the first, food waste, tinted
  bins: () => `
    <path class="ov-tint" d="M202,407 h9 v21 h-9 z"/>
    <path class="ov-line" d="M202,407 h9 v21 h-9 z M212.5,407 h9 v21 h-9 z M223,407 h9 v21 h-9 z"/>
    <path class="ov-line hair" d="M201.5,405 h10 M212,405 h10 M222.5,405 h10"/>`,
  // two basins in the sink: wash, then rinse
  basins: () => `
    <path class="ov-tint" d="M203.5,388 L204.5,395 H213.5 L214.5,388 Z M217.5,388 L218.5,395 H227.5 L228.5,388 Z"/>
    <path class="ov-line" d="M203,384 L204.5,395 H213.5 L215,384 M217,384 L218.5,395 H227.5 L229,384"/>`,
  dishwasher: () => `
    <path class="ov-line" d="M235.5,382 h27 v46 h-27 z"/>
    <path class="ov-line hair" d="M235.5,388 h27 M244,391.5 h10"/>
    <path class="ov-hide" d="M238,402 h22 M238,415 h22 M243,423 h12"/>`,
  // an under-counter fridge; the compressor behind, low
  fridge: () => `
    <path class="ov-line" d="M235.5,382 h27 v46 h-27 z"/>
    <path class="ov-line hair" d="M239.5,387 v10"/>
    <path class="ov-hide" d="M242,396 h16 M242,409 h16 M246,419 h12 v7 h-12 z"/>`,
  // hob, a pan, the knobs, and a hood ducted north along the ceiling and out through the wall
  hob: (k) => `
    <path class="ov-line" d="M267,375 H295"/>
    <path class="ov-line" d="M269,366 h11 v9 h-11 z"/><path class="ov-line hair" d="M269,368 h-4"/>
    <circle class="ov-line hair" cx="272" cy="386" r="1.6"/><circle class="ov-line hair" cx="281" cy="386" r="1.6"/><circle class="ov-line hair" cx="290" cy="386" r="1.6"/>
    <path class="ov-fill" d="M150,314 h18 v8 h-18 z"/>
    <path class="ov-line" d="M264,338 h34 l-8,-8 h-18 z"/>
    <path class="ov-line" d="M277,330 V322 H150 M285,330 V314 H150"/>
    <path class="ov-line hair" d="M150,311 h-6 v14 h6"/>
    ${arrow(281, 326, 0, -1, k)}${arrow(236, 318, -1, 0, k)}${arrow(196, 318, -1, 0, k)}`,
  // a pressure canner on the second burner: jars standing in a little water, a weighted valve
  canner: () => `
    <path class="ov-tint" d="M283,370 h14 v5 h-14 z"/>
    <path class="ov-line" d="M283,375 V353 H297 V375 Z"/>
    <path class="ov-line" d="M282,353 Q290,346 298,353"/>
    <path class="ov-line hair" d="M290,349.5 V345.5"/><circle class="ov-line hair" cx="290" cy="343.8" r="1.6"/>
    <path class="ov-hide" d="M285.5,374 v-9 q0,-2 2,-2 h0.5 q2,0 2,2 v9 M291.5,374 v-9 q0,-2 2,-2 h0.5 q2,0 2,2 v9"/>`,
  // an insulated box in the cooker module: hay all round, a removable cushion on top, the pot
  haybox: () => `
    <path class="ov-tint" fill-rule="evenodd" d="M267,396 h29 v32 h-29 z M273,402 h17 v21 h-17 z"/>
    <path class="ov-line" d="M267,396 h29 v32 h-29 z M273,402 h17 v21 h-17 z"/>
    <path class="ov-line hair" d="M267,402 h6 M290,402 h6"/>
    <path class="ov-line hair" d="M275,407 h13 v16 h-13 z M274,407 h15"/>
    <path class="ov-line hair" d="M268.5,412 l3,-3 M268.5,420 l3,-3 M291.5,412 l3,-3 M291.5,420 l3,-3 M277,400 l3,-2 M284,400 l3,-2"/>`,
  // two pots, wet sand between, a wet cloth over; by the north window, in the shade and the draught
  zeer: () => `
    <path class="ov-tint" fill-rule="evenodd" d="M174,355 L176,377 H192 L194,355 Z M178,355 L179,372 H189 L190,355 Z"/>
    <path class="ov-line" d="M174,355 L176,377 H192 L194,355"/>
    <path class="ov-line hair" d="M178,353 L179,372 H189 L190,353"/>
    <path class="ov-line hair" d="M171,358 L173,352 Q184,347 195,352 L197,358"/>`,
  // a gravity filter on the counter: raw water above, the candles standing in it, clean below
  filter: () => `
    <path class="ov-tint" d="M240,344 h17 v14 h-17 z M240,368 h17 v9 h-17 z"/>
    <path class="ov-line" d="M240,341 h17 v36 h-17 z M240,358.5 h17"/>
    <path class="ov-line hair" d="M239,341 h19 M247,341 v-3 h3 v3"/>
    <path class="ov-line hair" d="M244,358 v-9 q0,-2 2,-2 q2,0 2,2 v9 M250,358 v-9 q0,-2 2,-2 q2,0 2,2 v9"/>
    <path class="ov-line hair" d="M257,371 h4 v3"/>`,
  // a sleeve round the pan on the first burner, a narrow gap between: the heat stays on the pan
  skirt: () => `
    <path class="ov-line" d="M269,366 h11 v9 h-11 z"/><path class="ov-line hair" d="M269,368 h-4"/>
    <path class="ov-tint" d="M266,363 h1.6 v12 h-1.6 z M281.4,363 h1.6 v12 h-1.6 z"/>
    <path class="ov-line" d="M266,363 V375 M283,363 V375"/>`,
  // a deep pot on the second burner: the jars wholly under boiling water, a plain lid, no valve
  bath: () => `
    <path class="ov-tint" d="M283.5,357 h13 v17.5 h-13 z"/>
    <path class="ov-line" d="M283,375 V351 H297 V375 Z"/>
    <path class="ov-line hair" d="M282,351 H298 M288,351 v-2 h4 v2"/>
    <path class="ov-hide" d="M285.5,374 v-10 q0,-2 2,-2 h0.5 q2,0 2,2 v10 M291.5,374 v-10 q0,-2 2,-2 h0.5 q2,0 2,2 v10"/>`,
  // a cool box standing in the appliance recess: thick walls, ice packs down the sides, a lid
  coolbox: () => `
    <path class="ov-line" d="M237,406 h24 v22 h-24 z"/>
    <path class="ov-line hair" d="M236,404 h26 v2 h-26 z"/>
    <path class="ov-hide" d="M240,409 h18 v16 h-18 z"/>
    <path class="ov-tint" d="M241,410 h3 v14 h-3 z M254,410 h3 v14 h-3 z"/>`,
  // salt crystals in a bottle over a tray, on the pantry's middle shelf: the damp drips out
  absorber: () => `
    <path class="ov-tint" d="M172.5,400 h8 v5 h-8 z"/>
    <path class="ov-line hair" d="M172,399 h9 v6.5 l-2,1.5 h-5 l-2,-1.5 z"/>
    <path class="ov-line hair" d="M176.5,407 v2"/>
    <path class="ov-line" d="M171,409.5 h11 v3 h-11 z"/><path class="ov-line hair" d="M169,412.5 h16"/>`,
}
/* THE WET CORE (2026-09-10, third batch): the bath and the riser beside it. Bath, partition to
   riser: WC 302-348 (back to the partition, seen in profile) | shower 354-400. Riser lanes, west to
   east: supply 405 | flue 410 | soil-and-vent stack 413-419 | dry-toilet vent 426-434.
   Under the shower, IN the floor slab: the trap (outlet x 360) and its branch east to the stack at
   y 440, kept inside the slab so it clears the dry toilet's chamber below (296-376 x 450-500).
   A plate draws everything it needs to stand -- the handwash basin draws the WC it sits on -- and
   shared parts come from ONE function, so composed they coincide instead of nearly-coinciding. */
const KB = {
  wc: () => `
    <path class="ov-tint" d="M318,413 H334 Q332,420 326,421 H320 Z"/>
    <path class="ov-line" d="M303,407 H343 Q344,416 333,423 L331,434 H311 L311,421 Q303,417 303,407 Z"/>
    <path class="ov-line hair" d="M314,404.5 H344"/>
    <path class="ov-line" d="M302,383 h12 v24 h-12 z"/><path class="ov-line hair" d="M314,388 h3"/>
    <path class="ov-hide" d="M314,434 V446 M328,398 H314"/>`,
  tray: () => `<path class="ov-line" d="M356,428 h44 v6 h-44 z"/><path class="ov-line hair" d="M357.5,431 h5"/>`,
  trap: () => `
    <path class="ov-tint" d="M360,442 Q360,446 365,446 Q370,446 370,442 Z"/>
    <path class="ov-line" d="M360,434 V441 Q360,446 365,446 Q370,446 370,441 V440 H413"/>`,
  stack: (k) => `
    <path class="ov-line" d="M413,22 V466 Q413,481 428,481 H452 M419,22 V466 Q419,475 428,475 H452"/>
    <path class="ov-line hair" d="M411,22 V16 H421 V22"/>${arrow(416, 36, 0, 1, k)}`,
  shower: () => `${KB.tray()}
    <path class="ov-line hair" d="M354,428 V336"/>
    <path class="ov-line" d="M362,378 h7 v10 h-7 z"/>
    <path class="ov-line hair" d="M365.5,378 V330 H373"/>
    <path class="ov-line" d="M372,328 h11 v3 h-11 z"/>
    <path class="ov-dash" d="M374,334 L369,426 M377.5,334 V426 M381,334 L386,426"/>
    <path class="ov-hide" d="M402,386 H369"/>`,
  // a basin on the cistern lid, fed from the cistern's own fill valve; it drains into the cistern
  basin: () => `${KB.wc()}
    <path class="ov-tint" d="M301.5,379 H315.5 L314.5,383 H302.5 Z"/>
    <path class="ov-line" d="M300.5,376 H316.5 L314.5,383 H302.5 Z"/>
    <path class="ov-line hair" d="M304,376 V368 Q304,365 307,365 H311 V368"/>
    <path class="ov-hide" d="M304,383 V392"/>`,
  // a bucket in the shower catches the water; poured into the bowl, it flushes it
  bucket: (k) => `${KB.wc()}${KB.tray()}
    <path class="ov-tint" d="M379.6,416 L380,428 H392 L392.4,416 Z"/>
    <path class="ov-line" d="M378,410 L379.5,428 H392.5 L394,410"/>
    <path class="ov-line hair" d="M378,410 Q386,403 394,410"/>
    <path class="ov-dash" d="M384,400 Q358,374 336,402"/>${arrow(336, 402, -22, 28, k)}`,
  // a sleeve round the drain: warm water out, cold feed in -- counterflow, so the coldest feed
  // meets the coolest drain water and the warmest drain water warms the feed last
  sleeve: (k) => `${KB.trap()}
    <path class="ov-line hair" d="M374,436 h22 v8 h-22 z"/>
    <path class="ov-line hair" d="M376,436 L378,444 L380,436 L382,444 L384,436 L386,444 L388,436 L390,444 L392,436 L394,444"/>
    <path class="ov-line hair" d="M404,426 V438 H396 M376,444 V447 H407 V426"/>
    ${arrow(397, 438, -1, 0, k * 0.6)}${arrow(407, 424, 0, -1, k * 0.6)}`,
  // grey and black leave in two lines, grey via the stack's foot, black straight from the WC
  split: (k) => `${KB.trap()}
    <path class="ov-line" d="M413,440 H416 V478 H698 M314,434 V486 H698"/>
    ${arrow(698, 478, 1, 0, k)}${arrow(698, 486, 1, 0, k)}`,
  // extract where the damp is made: over the shower, straight up beside the riser, out at the roof
  extract: (k) => `
    <path class="ov-line" d="M388,313 h12 v6 h-12 z"/><path class="ov-line hair" d="M391,313 v6 M394,313 v6 M397,313 v6"/>
    <path class="ov-line" d="M391,313 V70 M398,313 V70"/>
    <path class="ov-line hair" d="M388,68 h13 v-4 h-13 z"/>
    <circle class="ov-line hair" cx="394.5" cy="282" r="2.6"/><path class="ov-line hair" d="M394.5,279.4 V284.6 M391.9,282 H397.1"/>
    <path class="ov-line hair" d="M391,348 Q393,336 394,323"/>${arrow(394, 321, 1, -13, k)}
    ${arrow(394.5, 240, 0, -1, k)}${arrow(394.5, 140, 0, -1, k)}`,
  // a tank under the roof, above every tap: no pump, the height is the pressure
  tank: (k) => `
    <path class="ov-tint" d="M326,160 h56 v25 h-56 z"/>
    <path class="ov-line" d="M326,150 h56 v35 h-56 z"/><path class="ov-line hair" d="M323,150 h62"/>
    <path class="ov-dash" d="M328,160 H380"/>
    <path class="ov-line" d="M382,180 H405 V386 H398"/>
    ${arrow(405, 300, 0, 1, k)}${arrow(396, 386, -1, 0, k)}`,
  // the riser made reachable: a panel on each floor
  chase: () => `
    <path class="ov-hide" d="M402,92 V434 M438,92 V434"/>
    <path class="ov-line" d="M407,344 h26 v40 h-26 z M407,222 h26 v40 h-26 z"/>
    <path class="ov-line hair" d="M407,344 L433,364 L407,384 M407,222 L433,242 L407,262"/>`,
}
// Every bath plate focuses the same room and frames the same bubble.
const BZ = { zone: [290, 306, 152, 150], crop: [200, 90, 200, 200] }
/* THE UTILITY ROOM (2026-09-11, fourth batch): upstairs, north, floor y 300, ceiling tie 186; the
   bath extract rises at x 391-398, so the room's usable width is 168-388. Along the far wall, north
   to south: water heater 176-210 (by the north wall, so gas can flue straight out) | power board
   222-266 over the battery bank | gas boiler on the wall 276-300 over the pedal generator |
   pump and pressure vessel on a bracket 322-372 over the laundry spot. The single-room heat
   recovery unit goes through the north wall under the window; the central one in the north attic.
   Its small parts magnify into a bubble BELOW (UB), over the ground floor: the usual one would sit
   on the room itself. Flues through the north wall: the boiler at y 190, a gas water heater at 199,
   both above the window (210-268). */
const UB = { CX: 272, CY: 384, R: 72 }
const UZ = { zone: [140, 180, 252, 126], crop: [140, 150, 260, 170] }
const KU = {
  // one cylinder, three ways to heat it: an element, a burner and flue, a heat pump on top
  tank: (v) => (k) => {
    const top = v === 'heatpump' ? 222 : 206, hot = v === 'heatpump' ? 230 : 214
    let s = `<path class="ov-line" d="M176,${top + 6} Q176,${top} 182,${top} H204 Q210,${top} 210,${top + 6} V300 H176 Z"/>
      <path class="ov-line hair" d="M214,292 H210 M210,${hot} H214"/>${arrow(211, 292, -1, 0, k * 0.6)}${arrow(215.5, hot, 1, 0, k * 0.6)}`
    if (v === 'electric') s += `<path class="ov-hide" d="M187,300 V281 Q187,277 191,277 Q195,277 195,281 V300"/>`
    if (v === 'gas') s += `<path class="ov-line hair" d="M181,296 q2.5,-5 5,0 q2.5,-5 5,0 q2.5,-5 5,0 q2.5,-5 5,0 q2.5,-5 5,0"/>
      <path class="ov-hide" d="M193,293 V206"/><path class="ov-fill" d="M150,196 h18 v6 h-18 z"/>
      <path class="ov-line" d="M193,206 V199 H147"/>${arrow(144, 199, -1, 0, k * 0.6)}`
    if (v === 'heatpump') s += `<path class="ov-line" d="M178,222 V204 Q178,200 182,200 H204 Q208,200 208,204 V222"/>
      <circle class="ov-line hair" cx="193" cy="211" r="6"/><path class="ov-line hair" d="M193,205 V217 M187,211 H199"/>
      <path class="ov-line hair" d="M169,208 H175 M210,208 H215"/>${arrow(177, 208, 1, 0, k * 0.6)}${arrow(217, 208, 1, 0, k * 0.6)}
      <path class="ov-hide" d="M179,244 H207 M179,256 H207 M179,268 H207"/>`
    return s
  },
  battery: (k) => `
    <path class="ov-line" d="M222,272 h42 v28 h-42 z"/>
    <path class="ov-line hair" d="M225,276 h8 v22 h-8 z M235,276 h8 v22 h-8 z M245,276 h8 v22 h-8 z M255,276 h7 v22 h-7 z M227,274 h4 M237,274 h4 M247,274 h4 M257,274 h3"/>
    <path class="ov-line hair" d="M252,272 V266 M249,260 h6 v6 h-6 z M252,260 V254"/>${arrow(252, 252, 0, -1, k * 0.6)}`,
  inverter: (k) => `
    <path class="ov-line" d="M242,204 h20 v32 h-20 z"/>
    <path class="ov-line hair" d="M245,212 v20 M248,212 v20 M251,212 v20 M255,208 h5 v5 h-5 z"/>
    <path class="ov-line hair" d="M252,236 V272 M242,211 H239"/>${arrow(237.5, 211, -1, 0, k * 0.6)}`,
  // DC essentials straight off the battery; AC for the rest, through the inverter
  panels: () => `
    <path class="ov-line" d="M222,204 h16 v14 h-16 z M222,222 h16 v14 h-16 z"/>
    <path class="ov-line hair" d="M225,208 v6 M229,208 v6 M233,208 v6 M225,226 v6 M229,226 v6 M233,226 v6"/>
    <path class="ov-line hair" d="M225,204 V197 M230,204 V197 M235,204 V197 M225,236 V242 M230,236 V242 M235,236 V242"/>
    <path class="ov-line hair" d="M239.5,272 V229 H238"/>`,
  diverter: (k) => `${KU.tank('electric')(k)}
    <path class="ov-line" d="M222,248 h14 v14 h-14 z"/><path class="ov-line hair" d="M225,252 h8 M225,256 h5"/>
    <path class="ov-line hair" d="M218,186 V252 H222 M229,262 V267 H213 V284 H210"/><path class="ov-hide" d="M210,284 H196"/>
    ${arrow(218, 200, 0, 1, k * 0.6)}`,
  // wall-hung, room-sealed: its flue out through the north wall above the window
  boiler: (k) => `
    <path class="ov-line" d="M276,202 h24 v40 h-24 z"/><path class="ov-line hair" d="M280,226 h16 v8 h-16 z"/>
    <path class="ov-fill" d="M150,187 h18 v6 h-18 z"/>
    <path class="ov-line" d="M288,202 V190 H147"/>${arrow(144, 190, -1, 0, k * 0.6)}
    <path class="ov-hide" d="M282,242 V312 M294,242 V312"/>${arrow(282, 316, 0, 1, k * 0.6)}${arrow(294, 300, 0, -1, k * 0.6)}`,
  // a bicycle on a stand, a generator roller on the tyre, a cable to the battery
  pedal: (k) => `${KU.battery(k)}
    <circle class="ov-line" cx="300" cy="283" r="14"/><path class="ov-line hair" d="M293,300 L300,283 L307,300"/>
    <circle class="ov-line hair" cx="282" cy="288" r="4"/><path class="ov-line hair" d="M279,284 L285,292 M277,284 h4 M283,292 h4"/>
    <path class="ov-line" d="M282,288 L300,283 M282,288 L278,260 L300,283 M278,260 H268 M282,288 L268,260 M268,260 L266,300"/>
    <path class="ov-line hair" d="M273,258 h10 M268,260 V255 M266,255 h7 M262,300 h8 M282,284 L300,279 M282,292 L300,287"/>
    <path class="ov-line" d="M304,258 h10 v7 h-10 z"/><circle class="ov-line hair" cx="309" cy="269" r="2.5"/>
    <path class="ov-line hair" d="M309,258 V250 H262 V272"/>`,
  // the pump on rubber pads on a wall bracket; a pressure vessel beside it on the discharge
  pumpSet: (k) => `
    <path class="ov-line" d="M322,242 H372"/><path class="ov-line hair" d="M324,242 V248 L330,242 M370,242 V248 L364,242"/>
    <path class="ov-line hair" d="M330,238 h4 v4 h-4 z M344,238 h4 v4 h-4 z M326,238 H350"/>
    <path class="ov-line" d="M324,224 h8 v14 h-8 z M332,226 h16 v12 h-16 z"/>
    <path class="ov-line hair" d="M336,226 v12 M340,226 v12 M344,226 v12"/>
    <path class="ov-line" d="M319,312 V231 H324 M328,224 V206 H384"/>
    <path class="ov-line" d="M354,212 Q354,208 358,208 H366 Q370,208 370,212 V241 H354 Z"/><path class="ov-line hair" d="M362,206 V208"/>
    ${arrow(387, 206, 1, 0, k * 0.6)}${arrow(319, 296, 0, -1, k * 0.6)}`,
  valves: () => `
    <path class="ov-line hair" d="M314,257 H324 L314,267 H324 Z M324,262 h5 M335,202 V210 L345,202 V210 Z M340,202 V196"/>`,
  smart: () => `
    <path class="ov-line hair" d="M373,202 V210 L383,202 V210 Z"/><path class="ov-line" d="M374,192 h8 v8 h-8 z"/>
    <path class="ov-line hair" d="M378,200 V202"/><path class="ov-line" d="M378,296 h8 v4 h-8 z"/>
    <path class="ov-dash" d="M380,294 V201"/>`,
  laundry: (v) => () => {
    if (v === 'electric') return `<path class="ov-line" d="M328,252 h40 v48 h-40 z"/><path class="ov-line hair" d="M328,258 h40"/>
      <circle class="ov-line" cx="348" cy="280" r="11"/><circle class="ov-line hair" cx="348" cy="280" r="8"/>`
    if (v === 'pedal') return `<circle class="ov-line" cx="357" cy="277" r="13"/><circle class="ov-line hair" cx="357" cy="277" r="6"/>
      <path class="ov-line hair" d="M348,300 L357,277 L366,300 M334,284 L357,264 M334,292 L357,290 M330,284 L338,292 M325,259 h10 M324,300 h10"/>
      <circle class="ov-line hair" cx="334" cy="288" r="4"/><path class="ov-line" d="M334,288 L330,260 M334,288 L328,300"/>`
    return `<path class="ov-tint" d="M335,284 L336,300 H360 L361,284 Z"/>
      <path class="ov-line" d="M334,272 L336,300 H360 L362,272"/><path class="ov-line hair" d="M333,272 h30"/>
      <path class="ov-hide" d="M338,276 L339,298 H357 L358,276"/>
      <path class="ov-line" d="M348,254 V280"/><path class="ov-line hair" d="M344,254 h8"/><path class="ov-line" d="M342,286 Q348,277 354,286"/>`
  },
  // the rubber pads lit (051), the motor lit with its cable (221), a cable straight from the panels (190)
  pads: () => `<path class="ov-tint" d="M330,238 h4 v4 h-4 z M344,238 h4 v4 h-4 z"/>`,
  motorLit: () => `<path class="ov-tint" d="M332,226 h16 v12 h-16 z"/><path class="ov-line hair" d="M342,226 V214"/>`,
  pvFeed: (k) => `<path class="ov-line hair" d="M344,186 V226"/>${arrow(344, 198, 0, 1, k * 0.6)}`,
  // one small unit through the north wall, under the window: a fan and a ceramic core
  hrv: (k) => `
    <path class="ov-fill" d="M150,278 h18 v14 h-18 z"/>
    <path class="ov-line hair" d="M153,280 v10 M156,280 v10 M159,280 v10 M162,280 v10"/>
    <path class="ov-line" d="M168,276 h4 v18 h-4 z"/><path class="ov-line hair" d="M150,276 H146 V294 H150"/>
    <circle class="ov-line hair" cx="165" cy="285" r="2"/>
    <path class="ov-line hair" d="M136,282 H171 M173,288 H138"/>${arrow(173, 282, 1, 0, k * 0.6)}${arrow(136, 288, -1, 0, k * 0.6)}`,
  // the central unit in the north attic: two ducts through the roof, two down into the house. The
  // exhaust leaves 0.8 m up-slope of the intake and higher, so stale air is not drawn straight back in
  mvhr: (k) => `
    <path class="ov-line" d="M232,162 h60 v22 h-60 z"/><path class="ov-line hair" d="M248,164 L276,182 M248,182 L276,164"/>
    <circle class="ov-line hair" cx="239" cy="173" r="3.5"/><circle class="ov-line hair" cx="285" cy="173" r="3.5"/>
    <path class="ov-line" d="M240,162 V128 M288,162 V106 M270,184 V198 M284,198 V184"/>
    <path class="ov-line hair" d="M236,126 h8 M284,104 h8"/>
    ${arrow(240, 150, 0, 1, k * 0.6)}${arrow(288, 128, 0, -1, k * 0.6)}${arrow(270, 200, 0, 1, k * 0.6)}${arrow(284, 190, 0, -1, k * 0.6)}`,
}
/* THE LIVING ROOM (2026-09-11, fifth batch): ground floor, south, floor 434, ceiling 312. The
   rocket heater's bench (442-624) and barrel (536-600, top at 322 -- nearly the ceiling) are
   already here. North end, by the riser: the wood stove (446-482), its flue rising all the way into
   the riser's flue lane (x 410), and the flue coil, whose thermosiphon tank must sit ABOVE it: in
   the bedroom (446-478, 262-298). Middle: the ceiling fan (x 512), clear of the barrel. South end:
   a shelf (y 356) for the router and the radio, the LED pendant above it, the evaporative cooler
   on the floor (630-658). The gravity lamp and the charcoal box go up to the bedroom: the living
   floor is taken. Small things magnify into LB (over the bedroom) or, from the bedroom, BB (over
   the living room). */
const LB = { CX: 556, CY: 244, R: 72 }
const BB = { CX: 548, CY: 380, R: 72 }
const LZ = { zone: [436, 306, 240, 132], crop: [430, 290, 250, 150] }
const KL = {
  // one body; the cook variant adds an oven and a pot on the top plate
  stove: (v) => (k) => `
    <path class="ov-line" d="M448,388 h32 v42 h-32 z"/><path class="ov-line" d="M446,384 h36 v4 h-36 z"/>
    <path class="ov-line hair" d="M451,430 v4 M477,430 v4"/>
    ${v === 'cook'
      ? `<path class="ov-line hair" d="M452,396 h10 v24 h-10 z M466,396 h10 v24 h-10 z M468,404 h6"/>
         <path class="ov-line hair" d="M450,384 V374 H462 V384 M449,374 h14"/>`
      : `<path class="ov-line hair" d="M454,396 h20 v24 h-20 z M457,399 h14 v18 h-14 z"/>
         <path class="ov-line hair" d="M452,384 Q451,376 458,375 Q465,376 464,384 M464,379 l4,-3"/>`}
    <path class="ov-line" d="M470,384 V356 L410,330 V36"/>
    ${arrow(470, 366, 0, -1, k * 0.6)}${arrow(436, 341.3, -60, -26, k * 0.6)}${arrow(410, 250, 0, -1, k * 0.6)}
    <path class="ov-line hair" d="M442,426 H452"/>${arrow(454, 426, 1, 0, k * 0.5)}`,
  // the stove body with a pellet hopper standing on it: the pellets fall into the fire by their
  // own weight and the flue's draught pulls the air in. No fan, no auger, no plug. Same flue lane.
  pellet: (k) => `
    <path class="ov-line" d="M448,388 h32 v42 h-32 z"/><path class="ov-line" d="M446,384 h36 v4 h-36 z"/>
    <path class="ov-line hair" d="M451,430 v4 M477,430 v4"/>
    <path class="ov-line hair" d="M454,402 h14 v18 h-14 z"/>
    <path class="ov-tint" d="M451,367 h12 v17 h-12 z"/>
    <path class="ov-line" d="M450,384 V362 H464 V384"/><path class="ov-line hair" d="M449,362 h16"/>
    <path class="ov-hide" d="M457,384 V399"/>${arrow(457, 399, 0, 1, k * 0.5)}
    <path class="ov-line" d="M470,384 V356 L410,330 V36"/>
    ${arrow(470, 366, 0, -1, k * 0.6)}${arrow(436, 341.3, -60, -26, k * 0.6)}${arrow(410, 250, 0, -1, k * 0.6)}
    <path class="ov-line hair" d="M442,426 H452"/>${arrow(454, 426, 1, 0, k * 0.5)}`,
  // a copper coil on the flue; hot rises to a tank above, cold falls back: thermosiphon, no pump
  coil: (k) => `${KL.stove('heater')(k)}
    <path class="ov-line hair" d="M464,360 L476,363 L464,366 L476,369 L464,372 L476,375 L464,378"/>
    <path class="ov-line" d="M476,360 H480 V268 H478 M478,292 H486 V378 H476"/>
    <path class="ov-tint" d="M446,270 h32 v28 h-32 z"/>
    <path class="ov-line" d="M446,262 h32 v36 h-32 z"/><path class="ov-line hair" d="M462,262 V252"/>
    ${arrow(480, 300, 0, -1, k * 0.6)}${arrow(486, 340, 0, 1, k * 0.6)}`,
  fan: (k) => `
    <path class="ov-line hair" d="M512,312 V324"/><path class="ov-line" d="M507,324 h10 v5 h-10 z"/>
    <path class="ov-line" d="M491,328 H507 M517,328 H533"/>
    <path class="ov-line hair" d="M500,336 V352 M524,336 V352"/>${arrow(500, 356, 0, 1, k * 0.6)}${arrow(524, 356, 0, 1, k * 0.6)}`,
  shelf: () => `<path class="ov-line" d="M624,356 H670"/><path class="ov-line hair" d="M626,356 V362 L632,356 M668,356 V362 L662,356"/>`,
  router: () => `${KL.shelf()}
    <path class="ov-line" d="M627,348 h15 v8 h-15 z"/><path class="ov-line hair" d="M630,348 V340 M636,348 V340"/>
    <circle class="ov-num" cx="632" cy="352" r="0.9"/><circle class="ov-num" cx="635" cy="352" r="0.9"/><circle class="ov-num" cx="638" cy="352" r="0.9"/>`,
  radio: () => `${KL.shelf()}
    <path class="ov-line" d="M646,344 h20 v12 h-20 z"/><circle class="ov-line hair" cx="652" cy="350" r="3.5"/>
    <path class="ov-line hair" d="M650,344 Q656,339 662,344 M658,346 h6 v3 h-6 z M659,346 v3 M661,346 v3 M666,350 h3 v4"/>`,
  led: () => `
    <path class="ov-line hair" d="M648,312 V326"/><path class="ov-line" d="M641,332 L644,326 H652 L655,332 Z"/>
    <path class="ov-tint" d="M641,332 L637,338 H659 L655,332 Z"/><path class="ov-line hair" d="M645,332 h6"/>`,
  // a fan pulls room air through a wet pad; the water that evaporates takes its heat from the air
  cooler: (k) => `
    <path class="ov-tint" d="M630,424 h28 v10 h-28 z"/>
    <path class="ov-line" d="M630,400 h28 v34 h-28 z"/><path class="ov-line hair" d="M630,424 h28"/>
    <path class="ov-line hair" d="M633,403 v18 M636,403 v18 M639,403 v18"/>
    <circle class="ov-line hair" cx="649" cy="411" r="6"/><path class="ov-line hair" d="M649,405 V417 M643,411 H655"/>
    <path class="ov-line hair" d="M644,398 V390"/>${arrow(644, 387, 0, -1, k * 0.6)}`,
  // the bag of weight on a strap; the unit's gears turn a generator as it sinks
  gravity: (k) => `
    <path class="ov-line" d="M500,214 h14 v16 h-14 z"/><circle class="ov-line hair" cx="507" cy="221" r="3.5"/>
    <path class="ov-tint" d="M502,230 L498,236 H516 L512,230 Z"/>
    <path class="ov-line hair" d="M510,230 V262"/><path class="ov-line" d="M505,262 h10 v16 h-10 z"/>
    ${arrow(519, 274, 0, 1, k * 0.6)}<path class="ov-line hair" d="M519,262 V270"/>`,
  // a perforated box of activated charcoal; no fan, so the air reaches it slowly
  charcoal: () => `
    <path class="ov-tint" d="M522,284 h18 v14 h-18 z"/><path class="ov-line" d="M522,284 h18 v14 h-18 z"/>
    <circle class="ov-num" cx="526" cy="288" r="0.9"/><circle class="ov-num" cx="531" cy="288" r="0.9"/><circle class="ov-num" cx="536" cy="288" r="0.9"/>
    <circle class="ov-num" cx="528.5" cy="293" r="0.9"/><circle class="ov-num" cx="533.5" cy="293" r="0.9"/>`,
}
/* THE NORTH YARD (2026-09-11, sixth batch). On this sheet the north yard is 2 m wide -- frame
   to wall -- and the rainwater tank already fills it, so the house section keeps only what
   belongs AGAINST the house: the heliostat on its pole and the worm bin sheltered by the north
   wall. Everything that stands further out goes in a YARD INSET, in the empty sky top-left:
   the section continued northwards at ONE THIRD of the house's scale (20 units a metre), with
   its own scale bar and ground line, far north on the left as on the section. It is drawn only
   when a yard solution is selected -- Eric's rule of 2026-09-10 for views that are "not
   something constantly visible but empty". Along its ground (y 116): tank 40-80, engine 88-108,
   biochar pit 112-130, digester 138-168, compost bays 176-216; the gas and the preheated water
   leave at the right edge, towards the house. Clear of the MVHR's roof ducts (x 236+) and the
   roof itself (the inset's bottom, y 140, sits above the north slope at x 230). */
const YZ = { zone: [30, 54, 204, 90], crop: [26, 50, 300, 200] }
const KY = {
  // the inset itself, shared by every yard plate so they coincide when composed
  frame: () => {
    let hatch = ''
    for (let x = 38; x <= 226; x += 8) hatch += `M${x},116 l-5,6 `
    // OUTLINE ONLY: every yard plate draws this frame, and a filled one painted each plate
    // over the last in the built house, leaving only whichever came last (caught 2026-09-11).
    // The inset sits in empty sky, so there is nothing behind it to hide.
    return `<rect class="dr-line hair" x="34" y="58" width="196" height="82"/>
      <path class="dr-line" d="M34,116 H230"/><path class="dr-line hair" d="${hatch}"/>
      <text class="dr-txt" x="38" y="68" style="font-size:8px">NORTH YARD, FURTHER OUT · 1:3</text>
      <path class="dr-line hair" d="M188,62 h40 v3 h-40 z M188,62 h20 v3 h-20 z"/>
      <text class="dr-num" x="228" y="72" text-anchor="end" style="font-size:7px">2 m</text>`
  },
  // a horizontal pressure vessel on saddles: propane / heating oil, or compressed air
  tank: (v) => (k) => `${KY.frame()}
    <path class="ov-line" d="M46,100 H74 Q80,100 80,106 Q80,112 74,112 H46 Q40,112 40,106 Q40,100 46,100 Z"/>
    <path class="ov-line hair" d="M46,112 L44,116 H52 L50,112 M70,112 L68,116 H76 L74,112"/>
    ${v === 'propane'
      ? `<path class="ov-line hair" d="M58,100 v-3 h4 v3 M80,106 h4 v14"/>${arrow(84, 123, 0, 1, k * 0.5)}`
      : `<path class="ov-line hair" d="M44,94 h12 v6 h-12 z M47,94 v-2 M53,94 v-2"/><circle class="ov-line hair" cx="70" cy="106" r="2.5"/>
         <path class="ov-line hair" d="M80,106 h4 v14"/>${arrow(84, 123, 0, 1, k * 0.5)}`}`,
  // an engine on a skid: driving an alternator (generator) or, off its shaft, a pump
  engine: (v) => (k) => `${KY.frame()}
    ${v === 'generator'
      ? `<path class="ov-line" d="M88,104 h18 v12 h-18 z"/><path class="ov-line hair" d="M97,104 V116"/>
         <circle class="ov-line hair" cx="92.5" cy="110" r="3"/><path class="ov-line hair" d="M90,104 V97 h-3 M106,110 h3 v8"/>`
      : `<path class="ov-line" d="M88,106 h11 v10 h-11 z"/><path class="ov-line hair" d="M90,106 V99 h-3 M99,111 h4"/>
         <circle class="ov-line" cx="106" cy="111" r="3.2"/><path class="ov-line hair" d="M106,107.8 V100"/>`}`,
  // a pit, fired, then capped with earth: no air, so the wood chars rather than burns
  pit: () => `${KY.frame()}
    <path class="ov-tint" d="M114,116 V124 Q114,126 116,126 H126 Q128,126 128,124 V116 Z"/>
    <path class="ov-line" d="M114,116 V124 Q114,126 116,126 H126 Q128,126 128,124 V116"/>
    <path class="ov-line hair" d="M112,116 Q121,109 130,116"/>
    <path class="ov-line hair" d="M121,110 q-2,-3 0,-6"/>
    <circle class="ov-num" cx="118" cy="121" r="0.9"/><circle class="ov-num" cx="122" cy="119" r="0.9"/><circle class="ov-num" cx="125" cy="122" r="0.9"/>`,
  // a fixed dome, half buried: feed in at the funnel, digestate out, gas off the top
  digester: (k) => `${KY.frame()}
    <path class="ov-tint" d="M139,136 V120 H167 V136 Z"/>
    <path class="ov-line" d="M138,136 V112 Q153,98 168,112 V136 Z"/>
    <path class="ov-line hair" d="M133,104 H138 L136.5,108 V126 H138 M168,130 H172 V112"/>
    <path class="ov-line hair" d="M153,105 V90 H226"/>${arrow(229, 90, 1, 0, k * 0.5)}`,
  // two bays: the hot pile nearest the house, the curing bay beside it, kept apart
  bays: () => `${KY.frame()}
    <path class="ov-tint" d="M178,116 Q186,101 194,116 Z M198,116 Q206,99 214,116 Z"/>
    <path class="ov-line" d="M176,96 V116 M196,96 V116 M216,96 V116"/>
    <path class="ov-line hair" d="M176,100 H216 M176,106 H216 M176,112 H216"/>
    <path class="ov-line hair" d="M206,110 V102"/><circle class="ov-line hair" cx="206" cy="110" r="1.4"/>`,
  // a coil in the hot pile: cold in low, preheated out high, on to the water heater
  coil: (k) => `${KY.bays()}
    <path class="ov-line hair" d="M200,113 L203,108 L206,113 L209,108 L212,113 M212,113 H226 M212,108 H226"/>
    ${arrow(214, 113, -1, 0, k * 0.4)}${arrow(229, 108, 1, 0, k * 0.5)}`,
  // stacked trays against the north wall: the worms climb to the fresh food
  worms: (k) => `
    <path class="ov-line" d="M114,404 h32 v4 h-32 z M114,408 h32 v12 h-32 z M114,420 h32 v12 h-32 z M114,432 h32 v10 h-32 z"/>
    <path class="ov-line hair" d="M117,442 V448 M143,442 V448 M146,438 h3 v3"/>
    <path class="ov-line hair" d="M119,416 q2,-2 4,0 q2,2 4,0 M131,428 q2,-2 4,0 q2,2 4,0"/>
    <path class="ov-line hair" d="M140,430 V422"/>${arrow(140, 419, 0, -1, k * 0.5)}`,
  // a two-axis mirror on a 4 m pole, bisecting the sun and the kitchen window. The mirror
  // line is computed, not sketched: the normal is the sum of the unit vectors towards the sun
  // (42 deg, an equinox noon) and towards the window, so angle in = angle out.
  helio: (k) => `
    <path class="ov-hide" d="M52,448 V356"/><path class="ov-line hair" d="M52,356 V218"/>
    <path class="ov-line" d="M53.4,190.1 L50.6,217.9"/>
    <path class="ov-line hair" d="M42,199 h7 v9 h-7 z"/>
    <path class="ov-dash" d="M104,157.2 L55,201.3"/>${arrow(55, 201.3, -49, 44.1, k * 0.8)}
    <circle class="ov-line hair" cx="108" cy="153.6" r="4"/>
    <path class="ov-dash" d="M54,206.7 L157,346.3"/>${arrow(157, 346.3, 103, 139.6, k * 0.8)}`,
}
/* THE SOUTH FACE (2026-09-12, seventh batch). The sunny side, from the ridge down: the roof
   slope, the eaves, the two south windows, the wall itself, and what stands against it.
   Geometry it all hangs on, from BASE: the south wall is CUT, x 672-690, so a window is seen
   edge-on -- the lower opening is 672-690 x 338-408 with the glass plane at x 680, the upper
   one 210-268. The roof's south slope runs (420,68) to (736,196) on its outer face.
   The sunspace (SOL-035) already fills 690-800 x 286-448 and the solar collector (SOL-059)
   sits at 520-666 on the slope, so anything drawn in those two places COMPETES with them
   rather than standing beside them -- which is what the collision test should say, and does.
   Small window parts magnify into the default bubble: at 2.6x an 18-unit wall is 47 units,
   enough to show three panes and a frame. */
const SZ = { zone: [640, 320, 84, 110], crop: [600, 296, 200, 150] }      // the lower window
const RZ = { zone: [430, 60, 306, 136], crop: [420, 44, 336, 180] }       // the south roof slope
const KS = {
  /* ---- the lower south window, seen in section ------------------------------------------ */
  // n panes in an insulated frame, the outer one carrying the low-E coating on its room side,
  // where it reflects heat back in. Two panes or three differ by one line, which is the whole
  // argument for drawing them once.
  panes: (n) => () => {
    const xs = n === 3 ? [676.5, 681, 685.5] : [677.5, 684]
    const a = xs[0], b = xs[xs.length - 1]
    return `<path class="ov-tint" d="M${a},342 H${b} V404 H${a} Z"/>`
      + xs.map((x) => `<path class="ov-line" d="M${x},342 V404"/>`).join('')
      + `<path class="ov-line hair" d="M${a + 1.2},344 V402"/>`
      + `<path class="ov-line" d="M673,338 h15 v5 h-15 z M673,403 h15 v5 h-15 z"/>`
  },
  // the same opening with a tint that is switched rather than chosen once: a coating between
  // the panes, a low-voltage pair down the jamb to a control.
  electro: () => `
    <path class="ov-tint" d="M677,342 h8 v62 h-8 z"/>
    <path class="ov-line" d="M677,342 V404 M685,342 V404"/>
    <path class="ov-line" d="M673,338 h15 v5 h-15 z M673,403 h15 v5 h-15 z"/>
    <path class="ov-line hair" d="M681,408 V414 H664 V420"/>
    <path class="ov-line" d="M659,420 h10 v7 h-10 z"/>`,
  // the window SIZED for the winter sun: the low December ray (18.5 deg at 48 N, the angle the
  // overhang plate is drawn at) comes in and lands on the mass floor, and the glazing is
  // dimensioned. Daylight reaches about 2.5 times the head height into the room.
  sized: (k) => `
    <path class="ov-line" d="M673,338 h15 v70 h-15 z"/>
    <path class="ov-dash" d="M806,318 L560,412"/>${arrow(560, 412, -246, 94, k * 0.7)}
    <path class="ov-line hair" d="M704,338 h22 M704,408 h22 M718,342 V404"/>
    <path class="ov-line hair" d="M714,348 l4,-6 l4,6 M714,398 l4,6 l4,-6"/>
    <path class="ov-dash" d="M666,414 H520"/><path class="ov-line hair" d="M520,410 V418 M666,410 V418"/>`,
  // an insulated panel over the glass at night, drawn open with its closed position hidden.
  // The security variant is the same panel with a lock, which is the row's own point: a shutter
  // is both, and the same object again as summer shade.
  shutter: (v) => (k) => `
    <path class="ov-line" d="M690,338 h5 v70 h-5 z"/>
    <path class="ov-line" d="M695,340 L717,318 V386 L695,408 Z"/>
    <path class="ov-line hair" d="M700,348 L712,336 M700,362 L712,350 M700,376 L712,364"/>
    ${v === 'lock'
      ? `<circle class="ov-line hair" cx="692.5" cy="373" r="3.4"/><path class="ov-line hair" d="M689,372 v-4 q3.5,-5 7,0 v4"/>`
      : `<path class="ov-line hair" d="M691,350 h3 v14 h-3 z M691,382 h3 v14 h-3 z"/>`}
    <path class="ov-hide" d="M690,336 h8 v74 h-8 z"/>
    <path class="ov-line hair" d="M714,420 H700"/>${arrow(697, 420, -1, 0, k * 0.6)}`,
  // the soft version: two layers on a rail, sealed to the frame all round. The seal is what
  // makes it more than a curtain, so the seal is what the drawing marks.
  curtain: () => `
    <path class="ov-line" d="M638,330 H672"/>
    <path class="ov-tint" d="M650,334 h14 v84 h-14 z"/>
    <path class="ov-line" d="M650,334 q4,7 0,14 q-4,7 0,14 q4,7 0,14 q-4,7 0,14 q4,7 0,14 q-4,7 0,14"/>
    <path class="ov-line hair" d="M664,334 q4,7 0,14 q-4,7 0,14 q4,7 0,14 q-4,7 0,14 q4,7 0,14 q-4,7 0,14"/>
    <path class="ov-line" d="M648,332 h18 v4 h-18 z M648,416 h18 v4 h-18 z"/>`,
  // slats inside the glass: the sun is already through the pane when they catch it, so this is
  // glare control and not heat control. The ray arrives and stops at a slat.
  blind: (k) => `
    <path class="ov-line" d="M660,334 h12 v4 h-12 z"/>
    ${[348, 358, 368, 378, 388, 398].map((y) => `<path class="ov-line" d="M662,${y + 3} L672,${y - 3}"/>`).join('')}
    <path class="ov-dash" d="M768,318 L674,364"/>${arrow(674, 364, -94, 46, k * 0.7)}`,
  // cloth OUTSIDE the glass, on hooks, taken down in winter: the shade that never has to become
  // a fixed brise-soleil. The summer sun is stopped before it reaches the pane.
  sail: (k) => `
    <path class="ov-line" d="M696,306 L734,352"/>
    <path class="ov-line hair" d="M694,302 h6 v6 M732,348 h6 v6"/>
    <path class="ov-dash" d="M754,232 L722,322"/>${arrow(722, 322, -32, 90, k * 0.7)}
    <path class="ov-line hair" d="M690,304 h6 M734,352 v6"/>`,
  // containers of water standing in the sun inside the window: more heat held per litre than
  // masonry, and one way to fail -- a leak, which is why the drawing shows a sealed drum.
  waterWall: (k) => `
    <path class="ov-tint" d="M640,352 h22 v76 h-22 z"/>
    <path class="ov-line" d="M640,352 h22 v76 h-22 z"/>
    <path class="ov-line hair" d="M640,378 h22 M640,404 h22 M651,352 V428 M646,348 h5 v4 h-5 z"/>
    <path class="ov-dash" d="M806,318 L666,368"/>${arrow(666, 368, -140, 50, k * 0.7)}`,
  /* ---- the roof ------------------------------------------------------------------------- */
  // modules on rails, following the slope, their cable down into the house. What they make is
  // DC; where it goes from there is the utility room's four plates.
  pv: (k) => `
    <path class="ov-line" d="M544,126 L676,180 L672,190 L540,136 Z"/>
    <path class="ov-line hair" d="M562,141 L558,151 M594,154 L590,164 M626,167 L622,177 M658,180 L654,190"/>
    <path class="ov-line" d="M676,180 L692,187 V214"/>
    ${arrow(692, 218, 0, 1, k * 0.7)}`,
  // a dome on the slope, a mirrored tube through the roof space, a diffuser in the ceiling
  // below: how daylight reaches a room with no outside wall to put a window in.
  lightTube: (k) => `
    <path class="ov-line" d="M484,113 q11,-13 22,0"/>
    <path class="ov-line hair" d="M482,113 h26"/>
    <path class="ov-line" d="M487,115 V180 M503,115 V180"/>
    <path class="ov-line hair" d="M490,130 L500,140 M490,152 L500,162"/>
    <path class="ov-line" d="M482,180 h26 v6 h-26 z"/>
    ${arrow(495, 170, 0, 1, k * 0.7)}
    <path class="ov-dash" d="M470,196 L488,210 M495,196 V212 M520,196 L502,210"/>`,
  // a panel that looks at the open sky: after dark it radiates heat upward and can fall below
  // the air around it, so water run past it comes back cooler. Cloud sends the radiation back.
  nightSky: (k) => `
    <path class="ov-line" d="M544,126 L676,180 L672,190 L540,136 Z"/>
    <path class="ov-line hair" d="M552,134 L668,182"/>
    <path class="ov-dash" d="M570,122 V92 M610,138 V108 M650,154 V124"/>
    ${arrow(570, 88, 0, -1, k * 0.6)}${arrow(610, 104, 0, -1, k * 0.6)}${arrow(650, 120, 0, -1, k * 0.6)}
    <path class="ov-line" d="M676,180 L694,188 V222 H660"/>
    <path class="ov-line" d="M540,136 L526,130 V222 H562"/>
    ${arrow(657, 222, -1, 0, k * 0.6)}${arrow(565, 222, 1, 0, k * 0.6)}`,
  /* ---- the eaves, the wall, and what stands against it ----------------------------------- */
  // the overhang that keeps driven rain off the WALL -- a different job from the overhang that
  // shades the window (SOL-026), which is why it is drawn at the eaves and not at the glass.
  overhang: (k) => `
    <path class="ov-line" d="M736,196 L768,209 L764,219 L732,206 Z"/>
    <path class="ov-line hair" d="M758,215 V226"/>
    <path class="ov-dash" d="M784,182 L748,248 M798,198 L762,264"/>
    ${arrow(748, 248, -36, 66, k * 0.6)}${arrow(762, 264, -36, 66, k * 0.6)}
    <path class="ov-line hair" d="M712,230 V300"/>
    <path class="ov-line hair" d="M708,234 l4,-6 l4,6"/>`,
  // a high window and the shelf under it: the shelf throws the light at the ceiling, which
  // carries it deeper into the room than the window could on its own.
  clerestory: (k) => `
    <path class="ov-line" d="M673,210 h15 v58 h-15 z"/>
    <path class="ov-line" d="M626,262 h47 v5 h-47 z"/>
    <path class="ov-dash" d="M762,196 L668,240"/>${arrow(668, 240, -94, 44, k * 0.6)}
    <path class="ov-dash" d="M662,258 L524,192"/>${arrow(524, 192, -138, -66, k * 0.6)}
    <path class="ov-dash" d="M520,190 L486,286"/>${arrow(486, 286, -34, 96, k * 0.6)}`,
  // a small lamp on the wall and the cone it watches: on when somebody comes and off the rest
  // of the night, which is the whole of its energy argument.
  motionLight: () => `
    <path class="ov-line" d="M690,238 h11 v9 h-11 z"/>
    <path class="ov-line hair" d="M694,234 h3 v4 h-3 z"/>
    <path class="ov-tint" d="M701,247 L748,300 L712,300 Z"/>
    <path class="ov-line hair" d="M701,247 L748,300 M701,247 L712,300"/>
    <path class="ov-line hair" d="M722,258 q5,-5 10,0 M726,250 q7,-7 14,0"/>`,
  // a glazed box on the south wall with a dark absorber behind it: room air in low, out high,
  // moved by nothing but the lift of the air the sun has warmed.
  airHeater: (k) => `
    <path class="ov-line" d="M690,236 h24 v78 h-24 z"/>
    <path class="ov-line hair" d="M712,238 V312"/>
    <path class="ov-tint" d="M692,238 h14 v74 h-14 z"/>
    <path class="ov-line hair" d="M694,248 h10 M694,262 h10 M694,276 h10 M694,290 h10 M694,304 h10"/>
    <path class="ov-line" d="M690,242 h-18 v8 h18 M690,300 h-18 v8 h18"/>
    ${arrow(668, 246, -1, 0, k * 0.6)}${arrow(676, 304, 1, 0, k * 0.6)}
    <path class="ov-line hair" d="M702,296 V248"/>${arrow(702, 244, 0, -1, k * 0.5)}`,
  // a roof on posts against the south wall: shade in summer, shelter at the door, and the
  // cheapest square metres a house ever gains.
  porch: (k) => `
    <path class="ov-line" d="M690,300 L778,330 L778,338 L690,308 Z"/>
    <path class="ov-line" d="M770,338 V448 M776,338 V448"/>
    <path class="ov-line hair" d="M690,448 H778"/>
    <path class="ov-dash" d="M806,244 L760,330"/>${arrow(760, 330, -46, 86, k * 0.6)}
    <path class="ov-dash" d="M806,330 L690,378"/>${arrow(690, 378, -116, 48, k * 0.6)}`,
  // a flat roof or terrace, shared, carrying the solar equipment the households below have
  // nowhere to stand. What matters is the arrangement, not which cooker is on it.
  terrace: (k) => `
    <path class="ov-line" d="M690,352 h96 v8 h-96 z"/>
    <path class="ov-line hair" d="M778,360 V448 M784,360 V448 M690,448 H786"/>
    <path class="ov-line" d="M714,352 q15,-28 30,0"/>
    <path class="ov-line hair" d="M729,338 v-9 M725,329 h9"/>
    <path class="ov-line hair" d="M752,352 h20 v-11 h-20 z M762,341 v-5"/>
    <path class="ov-dash" d="M806,258 L744,326"/>${arrow(744, 326, -62, 68, k * 0.6)}`,
}
/* THE SOUTH YARD (2026-09-12, eighth batch). Everything that stands on the ground beyond the
   south wall: the tree, the elevated cistern, the solar boxes, the two wood cookers and the
   washing line. Nine plates, nine solutions, and every one of them has a tutorial -- which is
   the order the plan sets, draw what a reader can build.
   THE STRIP IS 68 UNITS WIDE, x 744 to the frame at 812, because the sunspace and the porch
   already reach x 800 at ground level. That is a metre and a bit: room for one object at a
   time, which is honest -- a household picks one of these, and the collision test says so.
   The SKY above the south roof is the free space here (the slope at x 700 is down at y 181, so
   anything above that line is open), and it is where the three big objects put their notes.
   The small ones -- the boxes and the stoves -- magnify into the usual bubble instead. */
const PZ = { zone: [736, 280, 76, 170], crop: [700, 264, 120, 190] }        // the south yard strip
const PB = { zone: [744, 380, 68, 70], crop: [716, 340, 110, 120] }         // just the ground
const KP = {
  // deciduous: leaves in summer, bare in winter. One drawing has to say both, so the canopy is
  // drawn once with foliage and the WINTER ray is the one that gets through it.
  tree: (k) => `
    <path class="ov-line" d="M778,448 V366 M778,396 L764,378 M778,384 L792,366"/>
    <path class="ov-tint" d="M778,300 q34,4 30,34 q-2,30 -30,32 q-28,-2 -30,-32 q-4,-30 30,-34 z"/>
    <path class="ov-line" d="M778,300 q34,4 30,34 q-2,30 -30,32 q-28,-2 -30,-32 q-4,-30 30,-34 z"/>
    <path class="ov-line hair" d="M760,318 q6,6 0,12 M796,318 q-6,6 0,12 M770,352 q8,-5 16,0"/>
    <path class="ov-dash" d="M812,236 L790,300"/>${arrow(790, 300, -22, 64, k * 0.6)}
    <path class="ov-dash" d="M812,352 L690,398"/>${arrow(690, 398, -122, 46, k * 0.6)}`,
  // a tank on a stand: everything below its water line can be fed without a pump, and filling it
  // is the half that is not passive unless the source is higher still.
  cistern: (k) => `
    <path class="ov-tint" d="M750,364 h56 v30 h-56 z"/>
    <path class="ov-line" d="M750,352 h56 v42 h-56 z"/><path class="ov-line hair" d="M747,352 h62"/>
    <path class="ov-dash" d="M752,364 H804"/>
    <path class="ov-line hair" d="M756,394 V448 M800,394 V448 M756,420 H800"/>
    <path class="ov-line" d="M750,386 H738 V408 H690"/>${arrow(687, 408, -1, 0, k * 0.6)}
    <path class="ov-line hair" d="M742,364 V448"/>
    <path class="ov-line hair" d="M738,370 l4,-6 l4,6 M738,442 l4,6 l4,-6"/>`,
  /* THE FOUR SOLAR BOXES were one family in the audit until they were drawn (2026-09-12). They
     share a glazed box and nothing else: a cooker holds a pot, a dryer holds trays and has to
     BREATHE, a still is a basin under sloping glass with a channel to catch what runs down, and
     the electric oven is not a solar box at all -- it is an insulated mass heated off a panel,
     which is why it works on a grey afternoon and the others do not. */
  cooker: (k) => `
    <path class="ov-tint" d="M752,410 h48 v24 h-48 z"/>
    <path class="ov-line" d="M752,404 h48 v30 h-48 z"/>
    <path class="ov-line" d="M752,404 L736,376"/><path class="ov-line hair" d="M754,402 L740,376"/>
    <path class="ov-line" d="M768,412 h16 v14 h-16 z"/><path class="ov-line hair" d="M766,412 h20 M776,412 v-4"/>
    <path class="ov-dash" d="M812,340 L748,392"/>${arrow(748, 392, -64, 52, k * 0.6)}
    <path class="ov-dash" d="M744,384 L770,410"/>${arrow(770, 410, 26, 26, k * 0.6)}`,
  dryer: (k) => `
    <path class="ov-line" d="M752,396 h48 v38 h-48 z"/>
    <path class="ov-line hair" d="M756,404 h40 M756,414 h40 M756,424 h40"/>
    <path class="ov-line" d="M752,396 L800,386 V396"/>
    <path class="ov-line hair" d="M748,428 h4 M800,400 h4"/>
    ${arrow(750, 428, 1, 0, k * 0.5)}${arrow(806, 400, 1, 0, k * 0.5)}
    <path class="ov-dash" d="M812,346 L776,386"/>${arrow(776, 386, -36, 40, k * 0.6)}`,
  still: (k) => `
    <path class="ov-tint" d="M752,424 h48 v10 h-48 z"/>
    <path class="ov-line" d="M752,434 h48 v-10 h-48 z"/>
    <path class="ov-line" d="M750,424 L802,398 V434"/>
    <path class="ov-line hair" d="M764,414 q2,4 4,0 M776,408 q2,4 4,0 M788,402 q2,4 4,0"/>
    <path class="ov-line" d="M750,424 h-8 v6 h8"/>
    <path class="ov-line hair" d="M744,430 V440 H738"/>${arrow(735, 440, -1, 0, k * 0.5)}
    <path class="ov-dash" d="M812,352 L784,392"/>${arrow(784, 392, -28, 40, k * 0.6)}`,
  oven: (k) => `
    <path class="ov-tint" d="M758,404 h36 v30 h-36 z"/>
    <path class="ov-line" d="M752,398 h48 v36 h-48 z"/>
    <path class="ov-line hair" d="M758,404 h36 v24 h-36 z"/>
    <path class="ov-line hair" d="M762,412 q4,-4 8,0 q4,4 8,0 q4,-4 8,0"/>
    <path class="ov-line" d="M752,410 H740 V300 H690"/>${arrow(693, 300, -1, 0, k * 0.6)}
    <path class="ov-line hair" d="M736,296 h8 v8 h-8 z"/>`,
  /* TWO WOOD COOKERS, and they are not one drawing either: a rocket burns a stick pushed in at
     the side and draws its air under it; a TLUD is lit on TOP, gasifies the charge below and
     burns the gas at a ring of holes at the rim. The fuel path is the difference and the
     efficiency claim rests on it. */
  rocket: (k) => `
    <path class="ov-line" d="M766,434 h26 v-30 h-12 v18 h-14 z"/>
    <path class="ov-line hair" d="M766,422 h-10 v12 h10"/>
    <path class="ov-line" d="M762,400 h34 v5 h-34 z"/>
    <path class="ov-line hair" d="M770,400 V392 q8,-6 16,0 v8"/>
    ${arrow(758, 428, 1, 0, k * 0.5)}${arrow(786, 398, 0, -1, k * 0.5)}`,
  tlud: (k) => `
    <path class="ov-line" d="M768,434 V400 h24 v34 z"/>
    <path class="ov-line hair" d="M768,412 h24"/>
    <circle class="ov-num" cx="772" cy="405" r="1"/><circle class="ov-num" cx="778" cy="405" r="1"/>
    <circle class="ov-num" cx="784" cy="405" r="1"/><circle class="ov-num" cx="790" cy="405" r="1"/>
    <path class="ov-line hair" d="M770,430 h20"/>
    <path class="ov-line" d="M762,396 h36 v4 h-36 z"/>
    ${arrow(780, 394, 0, -1, k * 0.5)}${arrow(780, 424, 0, -1, k * 0.4)}`,
  // a line between two posts: the only laundry solution that removes a load rather than making
  // it more efficient, which is the row's own argument.
  line: (k) => `
    <path class="ov-line" d="M748,448 V368 M806,448 V378"/>
    <path class="ov-line" d="M748,372 Q777,382 806,382"/>
    <path class="ov-line hair" d="M756,375 h12 v16 h-12 z M774,378 h12 v16 h-12 z M792,381 h10 v14 h-10 z"/>
    <path class="ov-line hair" d="M744,384 q6,-6 12,0 M744,396 q6,-6 12,0"/>
    ${arrow(742, 390, -1, 0, k * 0.5)}`,
}
/* THE PLAN, ON A SECTION (2026-09-12, ninth batch). Ten of the rows left are decisions about
   ARRANGEMENT -- which room is where, what it is separated from, what can move later. A plan
   would show them better, and there is no plan: so each is drawn as the thing in the section
   that the decision actually changes. Zoning tints the two halves of a floor; a movable
   partition is drawn with the structure that does NOT depend on it; a future bay is dashed
   where it would be built. The rooms, from BASE: utility 168-402 and bedroom 438-672 upstairs
   (floor 300, tie 186), kitchen 168-300, bath 300-402 and living 438-672 below (floor 434),
   riser 402-438 between them.
   Notes go in the ATTIC -- x 300 to 600, y 130 to 180 -- which is inside the roof, above the
   tie, and the one band these plates leave empty. */
const NZ = { zone: [150, 186, 540, 262], crop: [150, 180, 546, 280] }
const KN = {
  // the compartment: a fire-rated partition and the floor over it, with the door that has to
  // hold as long as the wall does, and the way out
  fire: (k) => `
    <path class="ov-line fat" d="M300,312 V434"/>
    <path class="ov-line" d="M168,300 h504 v12 h-504 z"/>
    <path class="ov-line hair" d="M296,344 h8 M296,360 h8 M296,376 h8 M296,392 h8"/>
    <path class="ov-line" d="M300,398 h4 v34 h-4 z"/><path class="ov-line hair" d="M304,398 L318,412"/>
    <path class="ov-dash" d="M560,420 H316"/>${arrow(316, 420, -1, 0, k * 0.7)}`,
  // the two halves of the plan: glass and living to the south, the rooms that can be cold to
  // the north. The one decision that costs nothing and cannot be retrofitted.
  orient: (k) => `
    <path class="ov-tint" d="M438,190 h234 v108 h-234 z M438,314 h234 v118 h-234 z"/>
    <path class="ov-line hair" d="M438,190 h234 v108 h-234 z M438,314 h234 v118 h-234 z"/>
    <path class="ov-line hair" d="M168,190 h234 v108 h-234 z M168,314 h132 v118 h-132 z"/>
    <path class="ov-dash" d="M812,330 L680,380 M812,214 L680,250"/>
    ${arrow(680, 380, -132, 50, k * 0.7)}${arrow(680, 250, -132, 36, k * 0.7)}
    <path class="ov-dash" d="M60,240 H160 M60,360 H160"/>
    ${arrow(163, 240, 1, 0, k * 0.6)}${arrow(163, 360, 1, 0, k * 0.6)}`,
  // noisy and quiet, kept apart by the PLAN rather than by the wall between them: the riser and
  // the stair sit in the middle, and the bedroom is the far corner from the living room
  zones: () => `
    <path class="ov-tint" d="M438,314 h234 v118 h-234 z"/>
    <path class="ov-line hair" d="M438,314 h234 v118 h-234 z M168,190 h234 v108 h-234 z"/>
    <path class="ov-line hair" d="M486,360 q10,-10 0,-20 M496,366 q16,-16 0,-32 M506,372 q22,-22 0,-44"/>
    <path class="ov-line" d="M466,352 h14 v16 h-14 z"/>
    <path class="ov-line hair" d="M236,236 q6,-8 12,0 q6,8 12,0 M244,220 q6,-8 12,0 q6,8 12,0"/>
    <path class="ov-line fat" d="M402,190 V434 M438,190 V434"/>`,
  // one room where the plan had three: the partition goes, a beam takes its load, and what is
  // lost is the quiet on the other side of it
  openPlan: (k) => `
    <path class="ov-tint" d="M168,314 h504 v118 h-504 z"/>
    <path class="ov-hide" d="M300,318 V430"/>
    <path class="ov-line" d="M168,314 h504 v10 h-504 z"/>
    <path class="ov-line hair" d="M290,324 v8 h20 v-8"/>
    <path class="ov-line hair" d="M212,400 h56 M212,392 h56 M226,400 V414 M254,400 V414"/>
    ${arrow(330, 372, 1, 0, k * 0.6)}${arrow(500, 372, 1, 0, k * 0.6)}`,
  // a bed that folds into the wall: the room is a room all day and a guest room at night, so
  // the house does not carry a permanent one
  convertible: (k) => `
    <path class="ov-line" d="M596,214 h20 v84 h-20 z"/>
    <path class="ov-line" d="M528,290 h68 v8 h-68 z"/><path class="ov-line hair" d="M532,290 V282 h12"/>
    <path class="ov-dash" d="M596,222 h-60 M536,222 v68"/>
    ${arrow(560, 250, -1, 1, k * 0.6)}`,
  // storage where a room cannot be: built into the wall thickness, and up under the roof
  builtIn: () => `
    <path class="ov-tint" d="M438,214 h24 v84 h-24 z"/>
    <path class="ov-line" d="M438,214 h24 v84 h-24 z"/>
    <path class="ov-line hair" d="M438,238 h24 M438,262 h24 M438,286 h24"/>
    <path class="ov-line" d="M470,186 h60 v4 h-60 z"/>
    <path class="ov-line hair" d="M478,182 h44 v-28 h-44 z M486,154 V182 M500,154 V182 M514,154 V182"/>`,
  // a bay with a bench and what hangs over it: the room that stops the kitchen table being the
  // workshop
  workshop: () => `
    <path class="ov-line" d="M196,254 h96 v6 h-96 z"/>
    <path class="ov-line hair" d="M200,260 V298 M288,260 V298 M200,280 H288"/>
    <path class="ov-line hair" d="M212,254 V246 h10 v8 M236,254 V242 M252,254 V244 h8 v10"/>
    <path class="ov-line" d="M196,214 h96 v4 h-96 z"/>
    <path class="ov-line hair" d="M208,218 V232 M226,218 V228 M244,218 V236 M262,218 V226 M280,218 V234"/>`,
  // the wall that is only a wall: the floor over it is carried by the structure, so it can be
  // moved without touching anything that holds the house up
  movable: (k) => `
    <path class="ov-line" d="M296,318 h8 v112 h-8 z"/>
    <path class="ov-line hair" d="M296,326 h8 M296,342 h8 M296,358 h8 M296,374 h8 M296,390 h8 M296,406 h8"/>
    <path class="ov-line fat" d="M168,300 h504"/>
    <path class="ov-line hair" d="M268,372 H240 M332,372 H360"/>
    ${arrow(236, 372, -1, 0, k * 0.6)}${arrow(364, 372, 1, 0, k * 0.6)}`,
  // the frame set out so the house can grow: the bays are marked, and the next one is dashed
  // where it would go, on a foundation that is already there
  bays: () => `
    <path class="ov-line hair" d="M200,186 V434 M290,186 V434 M380,186 V434 M470,186 V434 M560,186 V434 M650,186 V434"/>
    <path class="ov-line hair" d="M200,168 H290 M290,168 H380"/>
    <path class="ov-line hair" d="M196,164 l4,4 l-4,4 M286,164 l4,4 l-4,4 M376,164 l4,4 l-4,4"/>
    <path class="ov-dash" d="M690,300 h90 v148 h-90 M690,300 L735,262 L780,300"/>
    <path class="ov-dash" d="M690,448 h90"/>`,
  // a platform under the roof instead of a room beside one: the floor under it is still floor
  mezzanine: (k) => `
    <path class="ov-tint" d="M470,240 h150 v6 h-150 z"/>
    <path class="ov-line" d="M470,240 h150 v8 h-150 z"/>
    <path class="ov-line hair" d="M470,248 V298 M620,248 V298"/>
    <path class="ov-line" d="M480,252 h58 v6 h-58 z"/>
    <path class="ov-line hair" d="M624,248 L648,296 M628,248 L652,296 M628,258 L636,254 M634,270 L642,266 M640,282 L648,278"/>
    ${arrow(560, 276, 0, 1, k * 0.5)}`,
}
/* BELOW GROUND AND AT THE FOOTINGS (2026-09-12, tenth batch). Everything under the ground
   line: the foundations themselves, what drains around them, the well and the treatment on the
   south side, and the cool ground on the north.
   TWO CONSTRAINTS SHAPE THIS BLOCK. The demo's title block covers 566-814 x 492-534, so the
   south side has a band of 40 units (y 452-492) to work in, and anything that must go deeper is
   drawn with a BREAK -- the drafting convention for "this continues further than the sheet
   shows", which is the truthful way to draw a borehole on a 5 m sheet. The footings are at
   142-176 and 664-698, y 448-474, and the slab is 150-690 x 434-448.
   Notes sit below the ground at x 150, y 470 down -- the band the plan batch settled on, kept
   clear of the title block -- or beside the object where there is room. */
const GZ = { zone: [680, 440, 132, 60], crop: [640, 420, 176, 110] }      // below ground, south
const GN = { zone: [28, 440, 130, 70], crop: [26, 420, 180, 120] }        // below ground, north
const GF = { zone: [130, 430, 580, 60], crop: [120, 410, 300, 110] }      // the footings
const KGr = {
  // a break in a line: what a section does when the thing it draws runs off the sheet
  brk: (x, y) => `<path class="ov-line hair" d="M${x - 6},${y} q3,-5 6,0 q3,5 6,0"/>`,
  // a borehole: a cased hole to the aquifer, deeper than any section of a house can show
  well: (k) => `
    <path class="ov-line" d="M756,448 V520 M772,448 V520"/>
    <path class="ov-tint" d="M756,486 h16 v34 h-16 z"/>
    <path class="ov-dash" d="M736,486 H792"/>
    ${KGr.brk(764, 505)}
    <path class="ov-line" d="M750,448 h28 v-6 h-28 z"/>
    <path class="ov-line" d="M760,442 V424 h-14 v8"/><path class="ov-line hair" d="M746,432 L724,424"/>
    ${arrow(722, 423, -1, 0, k * 0.5)}
    <path class="ov-line hair" d="M764,470 V456"/>${arrow(764, 452, 0, -1, k * 0.5)}`,
  // a loop of rope with washers on it, pulled through a rising pipe: a well pump anyone can
  // rebuild, and the reason it appears in every low-tech catalogue
  rope: (k) => `
    <path class="ov-line" d="M756,448 V516 M772,448 V516"/>
    <path class="ov-tint" d="M756,490 h16 v26 h-16 z"/>
    <path class="ov-dash" d="M740,490 H788"/>${KGr.brk(764, 505)}
    <path class="ov-line" d="M761,448 V496 M767,448 V496"/>
    <circle class="ov-num" cx="764" cy="462" r="1.4"/><circle class="ov-num" cx="764" cy="478" r="1.4"/><circle class="ov-num" cx="764" cy="494" r="1.4"/>
    <circle class="ov-line" cx="764" cy="430" r="10"/><path class="ov-line hair" d="M764,420 V440 M754,430 H774"/>
    <path class="ov-line hair" d="M774,430 h10 v6"/>${arrow(784, 440, 0, 1, k * 0.5)}`,
  // pipes laid below the depth frost reaches, and insulated where they cannot be
  frost: (k) => `
    <path class="ov-dash" d="M700,470 H812"/>
    <circle class="ov-line" cx="740" cy="484" r="7"/><circle class="ov-line hair" cx="740" cy="484" r="3.5"/>
    <circle class="ov-line" cx="766" cy="484" r="7"/><circle class="ov-line hair" cx="766" cy="484" r="3.5"/>
    <path class="ov-line hair" d="M726,484 H698"/>
    ${arrow(695, 484, -1, 0, k * 0.5)}
    <path class="ov-line hair" d="M700,462 h20 M700,478 h20"/>`,
  // a bed of sand and gravel in a box: water goes in at the top, comes out slower and cleaner
  sand: (k) => `
    <path class="ov-line" d="M704,456 h92 v34 h-92 z"/>
    <path class="ov-tint" d="M706,462 h88 v14 h-88 z"/>
    <path class="ov-line hair" d="M706,476 h88 M706,482 h88"/>
    <circle class="ov-num" cx="712" cy="479" r="1"/><circle class="ov-num" cx="722" cy="479" r="1"/><circle class="ov-num" cx="732" cy="479" r="1"/>
    <circle class="ov-num" cx="742" cy="486" r="1.4"/><circle class="ov-num" cx="758" cy="486" r="1.4"/><circle class="ov-num" cx="774" cy="486" r="1.4"/>
    <path class="ov-line" d="M698,452 H716 V460"/>${arrow(716, 462, 0, 1, k * 0.5)}
    <path class="ov-line" d="M796,486 h10 v-30"/>${arrow(806, 452, 0, -1, k * 0.5)}`,
  // the tank settles what sinks and floats, and what leaves it soaks away through the field --
  // gravity all the way, no pump and no power
  septic: (k) => `
    <path class="ov-tint" d="M700,462 h58 v26 h-58 z"/>
    <path class="ov-line" d="M698,454 h62 v34 h-62 z"/><path class="ov-line hair" d="M732,454 V488"/>
    <path class="ov-dash" d="M700,464 H758"/>
    <path class="ov-line hair" d="M702,484 h26 M736,484 h20"/>
    <path class="ov-line" d="M690,458 H698 M760,470 H776 V480"/>
    <path class="ov-line hair" d="M768,486 h24 M772,480 v10 M780,480 v10 M788,480 v10"/>
    ${arrow(694, 458, -1, 0, k * 0.5)}${arrow(780, 492, 0, 1, k * 0.5)}`,
  // greywater through a bed of wood chips: the chips are the filter and the food for what does
  // the work, and they are replaced rather than cleaned
  chips: (k) => `
    <path class="ov-line" d="M700,458 h96 v32 h-96 z"/>
    <path class="ov-tint" d="M702,464 h92 v24 h-92 z"/>
    <path class="ov-line hair" d="M708,470 l6,4 M720,468 l7,-3 M734,474 l6,4 M748,468 l7,4 M762,474 l6,-4 M776,470 l6,4 M712,482 l7,3 M730,484 l6,-4 M750,482 l7,3 M770,484 l6,-4"/>
    <path class="ov-line" d="M690,452 H710 V462"/>${arrow(710, 464, 0, 1, k * 0.5)}
    <path class="ov-line" d="M796,486 h12"/>${arrow(810, 486, 1, 0, k * 0.5)}`,
  // a membrane the water is pulled through, with air bubbled past it to keep it clean: it works
  // in a small box, and it stops the day the power does
  mbr: (k) => `
    <path class="ov-line" d="M700,454 h92 v36 h-92 z"/>
    <path class="ov-tint" d="M702,460 h88 v28 h-88 z"/>
    <path class="ov-line" d="M744,462 h8 v24 h-8 z M756,462 h8 v24 h-8 z M768,462 h8 v24 h-8 z"/>
    <circle class="ov-num" cx="712" cy="482" r="1.2"/><circle class="ov-num" cx="720" cy="474" r="1.2"/>
    <circle class="ov-num" cx="728" cy="484" r="1.2"/><circle class="ov-num" cx="736" cy="476" r="1.2"/>
    <path class="ov-line hair" d="M706,488 h28"/>
    <path class="ov-line" d="M690,458 H700 M792,470 h16"/>
    <path class="ov-line hair" d="M760,462 V440 h-40 v10"/>
    ${arrow(694, 458, -1, 0, k * 0.5)}${arrow(810, 470, 1, 0, k * 0.5)}${arrow(720, 454, 0, 1, k * 0.4)}`,
  // a tank with air blown through it: the same bacteria as a septic tank, working faster
  // because they are given oxygen, and needing the blower that provides it
  micro: (k) => `
    <path class="ov-line" d="M700,454 h94 v36 h-94 z"/>
    <path class="ov-tint" d="M702,462 h90 v26 h-90 z"/>
    <path class="ov-line hair" d="M732,454 V490 M764,454 V490"/>
    <circle class="ov-num" cx="742" cy="480" r="1.2"/><circle class="ov-num" cx="748" cy="470" r="1.2"/>
    <circle class="ov-num" cx="754" cy="482" r="1.2"/><circle class="ov-num" cx="758" cy="472" r="1.2"/>
    <path class="ov-line hair" d="M738,486 h20"/>
    <path class="ov-line" d="M748,454 V436 h-36 v12"/>
    <path class="ov-line" d="M690,458 H700 M794,472 h14"/>
    ${arrow(694, 458, -1, 0, k * 0.5)}${arrow(810, 472, 1, 0, k * 0.5)}${arrow(712, 452, 0, 1, k * 0.4)}`,
  /* ---- the foundations ------------------------------------------------------------------ */
  // piles taken down past the ground that swells and shrinks with the weather
  piles: (k) => `
    <path class="ov-line" d="M156,448 h18 v62 h-18 z M420,448 h18 v62 h-18 z M666,448 h18 v62 h-18 z"/>
    <path class="ov-line hair" d="M156,458 h18 M420,458 h18 M666,458 h18"/>
    <path class="ov-dash" d="M120,484 H700"/>
    ${KGr.brk(165, 500)}${KGr.brk(429, 500)}${KGr.brk(675, 500)}
    <path class="ov-line hair" d="M140,448 V484"/>
    <path class="ov-line hair" d="M136,454 l4,-6 l4,6 M136,478 l4,6 l4,-6"/>`,
  // the floor lifted clear of the ground on point supports: water, damp and vermin all pass
  // underneath instead of through
  skids: (k) => `
    <path class="ov-line" d="M150,420 h540 v14 h-540 z"/>
    <path class="ov-line" d="M176,434 h26 v20 h-26 z M406,434 h26 v20 h-26 z M636,434 h26 v20 h-26 z"/>
    <path class="ov-line hair" d="M172,454 h34 M402,454 h34 M632,454 h34"/>
    <path class="ov-line hair" d="M250,442 h120"/>${arrow(374, 442, 1, 0, k * 0.5)}
    <path class="ov-line hair" d="M480,442 h120"/>${arrow(604, 442, 1, 0, k * 0.5)}`,
  // a trench of stone with a perforated pipe in it, taking the water that reaches the footing
  // away before it can stand against it
  french: (k) => `
    <path class="ov-line" d="M108,452 h34 v42 h-34 z"/>
    <circle class="ov-num" cx="115" cy="462" r="1.6"/><circle class="ov-num" cx="127" cy="460" r="1.6"/><circle class="ov-num" cx="136" cy="466" r="1.6"/>
    <circle class="ov-num" cx="118" cy="474" r="1.6"/><circle class="ov-num" cx="131" cy="476" r="1.6"/>
    <circle class="ov-line" cx="125" cy="486" r="6"/><path class="ov-line hair" d="M121,482 h2 M128,482 h2 M119,489 h2 M126,489 h3"/>
    <path class="ov-dash" d="M150,440 L134,470"/>${arrow(134, 470, -16, 30, k * 0.5)}
    <path class="ov-line hair" d="M119,492 H60"/>${arrow(57, 492, -1, 0, k * 0.5)}`,
  // mesh where the gaps are: rodents use the same three openings every time -- the vent, the
  // service entry and the gap under the cladding
  rodent: () => `
    <path class="ov-line" d="M142,448 h34 v26 h-34 z"/>
    <path class="ov-line" d="M150,436 h10 v10 h-10 z"/>
    <path class="ov-line hair" d="M151,437 v8 M154,437 v8 M157,437 v8 M150,439 h10 M150,443 h10"/>
    <path class="ov-line" d="M664,448 h34 v26 h-34 z"/>
    <path class="ov-line" d="M680,436 h10 v10 h-10 z"/>
    <path class="ov-line hair" d="M681,437 v8 M684,437 v8 M687,437 v8 M680,439 h10 M680,443 h10"/>
    <path class="ov-line hair" d="M176,444 h20 M644,444 h20"/>`,
  /* ---- the cool ground, north ------------------------------------------------------------ */
  // a duct buried where the ground barely changes temperature: the air arrives having taken
  // that temperature, warmer in January and cooler in July than the air outside
  earthTube: (k) => `
    <path class="ov-line" d="M40,470 h70 q18,0 18,-18 V448"/>
    <path class="ov-line" d="M40,486 h78 q22,0 22,-22 V448"/>
    <path class="ov-line hair" d="M40,470 v16"/>
    <path class="ov-dash" d="M30,458 H150"/>
    ${arrow(60, 478, 1, 0, k * 0.6)}${arrow(134, 452, 0, -1, k * 0.6)}
    <path class="ov-line" d="M34,462 h10 v14 h-10 z"/>`,
  // a room in the ground: the earth around it holds a few degrees all year, which is the whole
  // of the machinery
  cellar: (k) => `
    <path class="ov-line" d="M36,458 h104 v64 h-104 z"/>
    <path class="ov-tint" d="M38,462 h100 v58 h-100 z"/>
    <path class="ov-line hair" d="M44,470 h40 v10 h-40 z M44,486 h40 v10 h-40 z"/>
    <path class="ov-line" d="M96,486 h36 v30 h-36 z"/>
    <circle class="ov-num" cx="104" cy="496" r="1.2"/><circle class="ov-num" cx="114" cy="500" r="1.2"/><circle class="ov-num" cx="124" cy="494" r="1.2"/>
    <path class="ov-line" d="M126,458 V440 h10 v18"/>${arrow(131, 436, 0, -1, k * 0.5)}
    <path class="ov-line hair" d="M46,458 V446 h8 v12"/>${arrow(50, 466, 0, 1, k * 0.5)}`,
  // a loop of pipe in the cold ground and a pump: what comes back is a few degrees below the
  // room, which cools it without a compressor anywhere
  loop: (k) => `
    <path class="ov-line" d="M40,466 h96 M40,482 h96 M40,498 h96"/>
    <path class="ov-line" d="M136,466 q12,0 12,8 q0,8 -12,8 M136,482 q12,0 12,8 q0,8 -12,8"/>
    <path class="ov-line" d="M40,466 q-10,0 -10,-9 V448 M40,498 q-10,0 -10,9 V520 h110"/>
    <path class="ov-dash" d="M26,456 H160"/>
    ${arrow(90, 466, 1, 0, k * 0.5)}${arrow(60, 498, -1, 0, k * 0.5)}`,
}
/* THE ROOF AND THE FLOOR, AS LAYERS (2026-09-12, eleventh batch). The walls got this treatment
   in the first batch: ONE build-up drawn once, and a plate differs only in which band is lit
   and named. The roof deserves the same -- a cool surface, a radiant barrier and a vented
   assembly are three layers of one roof, not three roofs -- and so does the slab edge.
   The roof detail is a slice through the SOUTH slope, magnified in the same bubble the wall
   detail uses, outside at the top: covering, battens and the vented gap, sarking, rafters with
   their insulation, the radiant barrier, and the ceiling under it. The slab detail is a slice
   at the south footing: floor finish, slab, insulation under and at the edge, the membrane
   below that, and the hardcore under everything. */
let rduid = 0
const RD = { CX: 300, CY: 176, R: 92 }
const RB = { cover: [150, 158], gap: [158, 168], sark: [168, 174], rafter: [174, 222],
             barrier: [222, 226], ceil: [236, 244] }
function roofDetail(t, { hl = [], label, extra = '' }) {
  const { CX, CY, R } = RD, id = 'rdc' + (rduid++), L = 212, Rt = 388
  const lit = (k) => hl.includes(k)
  const band = (k, cls) => `<rect class="${cls}" x="${L}" y="${RB[k][0]}" width="${Rt - L}" height="${RB[k][1] - RB[k][0]}"/>`
  let body = hl.map((k) => band(k, 'ov-tint')).join('')
  for (const k of Object.keys(RB)) {
    body += `<path class="${lit(k) ? 'ov-line' : 'dr-line hair'}" d="M${L},${RB[k][0]} H${Rt} M${L},${RB[k][1]} H${Rt}"/>`
  }
  // rafters, drawn as two cut members with the insulation between them
  body += `<path class="${lit('rafter') ? 'ov-line' : 'dr-line hair'}" d="M240,174 V222 M264,174 V222 M336,174 V222 M360,174 V222"/>`
  let hatch = ''
  for (let x = L; x < Rt; x += 9) hatch += `M${x},222 l9,-48 `
  body += `<path class="${lit('rafter') ? 'ov-line hair' : 'dr-line hair'}" d="${hatch}"/>`
  // battens holding the covering off the sarking, which is what makes the gap a gap
  body += [230, 290, 350].map((x) => `<rect class="${lit('gap') ? 'ov-line hair' : 'dr-line hair'}" x="${x}" y="158" width="8" height="10"/>`).join('')
  return `<circle class="ov-dash" cx="560" cy="128" r="22"/>
    <path class="ov-line hair" d="M538,128 L392,170"/>
    <circle class="ov-fill" cx="${CX}" cy="${CY}" r="${R}"/>
    <clipPath id="${id}"><circle cx="${CX}" cy="${CY}" r="${R - 2}"/></clipPath>
    <g clip-path="url(#${id})">${body}${extra}</g>
    <text class="dr-num" x="232" y="132" font-size="9">${t('OUT', 'EXT')}</text>
    <text class="dr-num" x="338" y="255" font-size="9" text-anchor="end">${t('IN', 'INT')}</text>
    <text class="ov-txt" x="${CX}" y="${CY + R + 22}" text-anchor="middle">${t(label[0], label[1])}</text>`
}
const RZ2 = { zone: [430, 60, 300, 130], crop: [200, 100, 200, 200] }
let sduid = 0
const SD = { CX: 300, CY: 380, R: 88 }
function slabDetail(t, { hl = [], label, extra = '' }) {
  const { CX, CY, R } = SD, id = 'sdc' + (sduid++)
  const lit = (k) => hl.includes(k)
  const B = { finish: [336, 342], slab: [342, 366], ins: [366, 380], memb: [380, 384], hard: [384, 404] }
  let body = hl.filter((k) => B[k]).map((k) => `<rect class="ov-tint" x="228" y="${B[k][0]}" width="150" height="${B[k][1] - B[k][0]}"/>`).join('')
  for (const k of Object.keys(B)) body += `<path class="${lit(k) ? 'ov-line' : 'dr-line hair'}" d="M228,${B[k][0]} H378 M228,${B[k][1]} H378"/>`
  // the wall standing on the edge, and the insulation that turns the corner with it
  body += `<path class="dr-line hair" d="M300,336 V250 M336,336 V250"/>`
  body += `<path class="${lit('edge') ? 'ov-line' : 'dr-line hair'}" d="M294,336 V262 h-8 V336"/>`
  if (lit('edge')) body += `<rect class="ov-tint" x="286" y="262" width="8" height="74"/>`
  let dots = ''
  for (let y = 388; y < 404; y += 7) for (let x = 232; x < 376; x += 9) dots += `<circle class="${lit('hard') ? 'ov-num' : 'dr-num'}" cx="${x + (y % 14 ? 4 : 0)}" cy="${y}" r="1.1"/>`
  body += dots
  return `<circle class="ov-dash" cx="664" cy="440" r="22"/>
    <path class="ov-line hair" d="M642,440 L388,412"/>
    <circle class="ov-fill" cx="${CX}" cy="${CY}" r="${R}"/>
    <clipPath id="${id}"><circle cx="${CX}" cy="${CY}" r="${R - 2}"/></clipPath>
    <g clip-path="url(#${id})">${body}${extra}</g>
    <text class="dr-num" x="242" y="332" font-size="9">${t('IN', 'INT')}</text>
    <text class="dr-num" x="360" y="422" font-size="9" text-anchor="end">${t('GROUND', 'SOL')}</text>
    <text class="ov-txt" x="${CX}" y="${CY + R + 20}" text-anchor="middle">${t(label[0], label[1])}</text>`
}
const SZ2 = { zone: [600, 400, 120, 90], crop: [200, 290, 200, 200] }
const KX = {
  // a roof rated for what falls on it: hail, a branch, a foot in the wrong place
  impact: (k) => `
    <path class="ov-line" d="M104,196 L420,68 L736,196 L724,196 L420,84 L116,196 Z"/>
    <path class="ov-dash" d="M300,30 L360,96 M420,26 L420,74 M540,30 L480,96"/>
    ${arrow(360, 96, 60, 66, k * 0.6)}${arrow(420, 74, 0, 1, k * 0.6)}${arrow(480, 96, -60, 66, k * 0.6)}
    <path class="ov-line hair" d="M352,104 q8,-6 16,0 M412,82 q8,-6 16,0 M472,104 q8,-6 16,0"/>`,
  // four slopes instead of two: less of the roof stands square to the wind, and there is no
  // gable end for it to push on
  hip: (k) => `
    <path class="ov-line" d="M104,196 L280,110 L560,110 L736,196"/>
    <path class="ov-line hair" d="M280,110 L340,150 M560,110 L500,150"/>
    <path class="ov-hide" d="M116,196 L288,118 L552,118 L724,196"/>
    <path class="ov-dash" d="M60,120 H240 M60,150 H210"/>
    ${arrow(244, 120, 1, 0, k * 0.6)}${arrow(214, 150, 1, 0, k * 0.6)}`,
  // pipe loops under the floor, one circuit per zone, each with its own control: the room
  // nobody is in is the room that is not heated
  zoned: (k) => `
    <path class="ov-line" d="M180,428 h108 M180,420 h108 M180,412 h108"/>
    <path class="ov-line hair" d="M288,412 q10,0 10,4 q0,4 -10,4 M288,420 q10,0 10,4 q0,4 -10,4"/>
    <path class="ov-line" d="M460,428 h180 M460,420 h180 M460,412 h180"/>
    <path class="ov-line hair" d="M640,412 q10,0 10,4 q0,4 -10,4 M640,420 q10,0 10,4 q0,4 -10,4"/>
    <path class="ov-line" d="M404,404 h32 v22 h-32 z"/>
    <path class="ov-line hair" d="M404,412 h32 M410,404 V398 M430,404 V398"/>
    <path class="ov-line hair" d="M180,412 V404 h-8 M460,412 V404 h-8"/>
    <circle class="ov-line hair" cx="168" cy="404" r="4"/><circle class="ov-line hair" cx="448" cy="404" r="4"/>
    ${arrow(240, 408, 1, 0, k * 0.5)}${arrow(560, 408, 1, 0, k * 0.5)}`,
  // a pipe from under the slab to above the roof, and what it takes with it: soil gas, before
  // it can find its way in through a crack
  radon: (k) => `
    <path class="ov-tint" d="M330,452 h40 v20 h-40 z"/>
    <path class="ov-line" d="M330,452 h40 v20 h-40 z"/>
    <circle class="ov-num" cx="338" cy="462" r="1.2"/><circle class="ov-num" cx="350" cy="466" r="1.2"/><circle class="ov-num" cx="362" cy="460" r="1.2"/>
    <path class="ov-line" d="M344,452 V40 M356,452 V40"/>
    <path class="ov-line hair" d="M341,40 h18 v-5 h-18 z"/>
    ${arrow(350, 300, 0, -1, k * 0.6)}${arrow(350, 120, 0, -1, k * 0.6)}
    <circle class="ov-line hair" cx="350" cy="240" r="7"/><path class="ov-line hair" d="M345,235 L355,245 M355,235 L345,245"/>`,
  // sound, and the mass that stops it: a heavy wall does not vibrate easily, which is the whole
  // of the acoustic argument for choosing mass in the first place
  dense: (k) => `
    <path class="ov-tint" d="M150,186 h18 v262 h-18 z M672,186 h18 v262 h-18 z"/>
    <path class="ov-line" d="M150,186 h18 v262 h-18 z M672,186 h18 v262 h-18 z"/>
    <path class="ov-line hair" d="M120,300 q-10,-12 0,-24 M108,306 q-16,-18 0,-36 M96,312 q-22,-24 0,-48"/>
    <path class="ov-line hair" d="M186,296 q6,-8 0,-16"/>
    ${arrow(140, 288, 1, 0, k * 0.5)}`,
}
/* THE LAST TWELVE (2026-09-12, twelfth batch): what is left over once the rooms, the yards,
   the roof, the floor and the ground are drawn -- the north wall's lean-tos and berm, the heat
   pump beside them, the solar chimney, the mains arriving at the sheet edge, the tanker that
   empties a septic tank, the mast on the north slope, and four ways of heating a PERSON rather
   than a room. */
const XN = { zone: [26, 240, 130, 210], crop: [26, 220, 200, 240] }        // against the north wall
const XE = { zone: [18, 170, 150, 300], crop: [18, 160, 220, 320] }        // the sheet edge
const XB = { zone: [440, 190, 240, 110], crop: [430, 180, 260, 130] }      // the bedroom
const KZ2 = {
  // earth banked against the north wall: the ground there is a few degrees warmer than the
  // January air and it does not blow
  berm: (k) => `
    <path class="ov-tint" d="M26,448 L26,330 Q90,330 150,400 L150,448 Z"/>
    <path class="ov-line" d="M26,330 Q90,330 150,400"/>
    <path class="ov-line hair" d="M40,344 l-8,10 M70,336 l-8,10 M100,352 l-8,10 M126,374 l-8,10"/>
    <path class="ov-dash" d="M32,300 H120"/>${arrow(124, 300, 1, 0, k * 0.6)}
    <path class="ov-line hair" d="M150,360 h-16"/>${arrow(130, 360, -1, 0, k * 0.5)}`,
  // an outdoor unit on the cold side, and what it does: move heat rather than make it
  heatPump: (k) => `
    <path class="ov-line" d="M96,360 h46 v46 h-46 z"/>
    <circle class="ov-line" cx="119" cy="383" r="14"/>
    <path class="ov-line hair" d="M119,369 q10,8 0,14 q-10,6 0,14"/>
    <path class="ov-line hair" d="M96,368 h-16 M96,398 h-16"/>
    ${arrow(76, 368, -1, 0, k * 0.5)}${arrow(76, 398, -1, 0, k * 0.5)}
    <path class="ov-line" d="M142,374 H150 M142,392 H150"/>
    <path class="ov-hide" d="M168,374 H196 M168,392 H196"/>
    ${arrow(199, 374, 1, 0, k * 0.5)}`,
  // a room against the cold side that is not heated: everything that leaves the house that way
  // has to cross it first
  buffer: (k) => `
    <path class="ov-tint" d="M60,330 h88 v118 h-88 z"/>
    <path class="ov-line" d="M60,330 h90 v6 h-90 z M60,336 V448"/>
    <path class="ov-line hair" d="M60,394 h24 v54 h-24 z"/>
    <path class="ov-line hair" d="M104,400 h30 v20 h-30 z M104,424 h30 v20 h-30 z"/>
    <path class="ov-dash" d="M40,368 H150"/>${arrow(153, 368, 1, 0, k * 0.5)}`,
  // a lean-to with its back to the wall and its face open: wood dries in moving air, not under
  // a tarpaulin
  woodshed: (k) => `
    <path class="ov-line" d="M62,344 L150,320 V330 L62,354 Z"/>
    <path class="ov-line" d="M62,354 V448 M150,448"/>
    <path class="ov-line hair" d="M70,430 h72 M70,412 h72 M70,394 h72"/>
    <circle class="ov-line hair" cx="78" cy="421" r="5"/><circle class="ov-line hair" cx="96" cy="421" r="5"/>
    <circle class="ov-line hair" cx="114" cy="403" r="5"/><circle class="ov-line hair" cx="132" cy="403" r="5"/>
    <path class="ov-line hair" d="M48,400 h12 M48,430 h12"/>
    ${arrow(63, 400, 1, 0, k * 0.5)}${arrow(63, 430, 1, 0, k * 0.5)}`,
  // a shaft that is deliberately warm at the top: the air in it rises, and what leaves has to
  // be replaced by air drawn in low. It works on a still day, which a window does not.
  chimney: (k) => `
    <path class="ov-tint" d="M446,40 h36 v260 h-36 z"/>
    <path class="ov-line" d="M446,300 V36 M482,300 V36"/>
    <path class="ov-line hair" d="M443,36 h42 v-6 h-42 z"/>
    <path class="ov-line" d="M446,300 h36"/>
    ${arrow(464, 200, 0, -1, k * 0.7)}${arrow(464, 90, 0, -1, k * 0.7)}
    <path class="ov-line hair" d="M486,60 L512,60 M486,80 L512,80"/>
    <path class="ov-line" d="M150,410 h18 v18 h-18 z"/>
    <path class="ov-line hair" d="M168,419 H300 Q340,419 360,400 L440,330"/>
    ${arrow(240, 419, 1, 0, k * 0.6)}${arrow(430, 338, 1, -1, k * 0.6)}`,
  // seven services, one drawing: a line arriving at the edge of the sheet, because what matters
  // about a mains connection in a section is that it comes from somewhere else
  mains: (k) => `
    <path class="ov-line" d="M18,214 H150 M18,246 H150 M18,278 H150"/>
    <path class="ov-line" d="M18,394 H92 V448 M18,426 H120"/>
    <path class="ov-line hair" d="M40,206 h18 v16 h-18 z M40,238 h18 v16 h-18 z M40,270 h18 v16 h-18 z"/>
    ${arrow(153, 214, 1, 0, k * 0.6)}${arrow(153, 246, 1, 0, k * 0.6)}${arrow(153, 278, 1, 0, k * 0.6)}
    ${arrow(123, 426, 1, 0, k * 0.6)}
    <path class="ov-dash" d="M26,180 V460"/>`,
  // the tanker that empties the tank every few years: the one part of an on-site treatment that
  // leaves the site, and the reason a septic tank is not maintenance-free
  tanker: (k) => `
    <path class="ov-line" d="M698,454 h62 v34 h-62 z"/>
    <path class="ov-line hair" d="M700,464 H758"/>
    <path class="ov-line" d="M716,454 V420 H660 V400"/>
    <path class="ov-line" d="M600,372 h60 v28 h-60 z"/>
    <circle class="ov-line hair" cx="614" cy="404" r="5"/><circle class="ov-line hair" cx="648" cy="404" r="5"/>
    <path class="ov-line hair" d="M596,376 h-10 v20 h14"/>
    ${arrow(700, 430, -1, -1, k * 0.6)}`,
  // a mast on the north slope with what hangs off it: a small antenna for the mesh, a dish for
  // the satellite. What matters in a section is the height and the clear line out.
  mast: (k) => `
    <path class="ov-line" d="M240,140 V40"/>
    <path class="ov-line hair" d="M240,140 L216,158 M240,140 L264,158"/>
    <path class="ov-line" d="M232,52 h16 M234,64 h12 M236,76 h8"/>
    <path class="ov-line" d="M258,86 q14,-14 0,-28"/><path class="ov-line hair" d="M258,72 h-12"/>
    <path class="ov-dash" d="M268,60 H420 M268,80 L420,140"/>
    ${arrow(424, 60, 1, 0, k * 0.6)}${arrow(424, 141, 1, 0.4, k * 0.6)}`,
  /* ---- heating the person, not the room ------------------------------------------------- */
  // the oldest of them: water that has already been heated for something else, in a cover,
  // against the body
  bottle: () => `
    <path class="ov-tint" d="M540,244 h44 v26 h-44 z"/>
    <path class="ov-line" d="M538,244 q0,-6 6,-6 h36 q6,0 6,6 v26 q0,6 -6,6 h-36 q-6,0 -6,-6 z"/>
    <path class="ov-line hair" d="M552,238 v-6 h18 v6 M556,232 v-4 h10 v4"/>
    <path class="ov-line hair" d="M544,252 h32 M544,262 h32"/>`,
  // a table with a heater under it and a quilt over it: it heats the volume a person is
  // actually in, which is a fraction of the room
  kotatsu: (k) => `
    <path class="ov-line" d="M500,250 h120 v6 h-120 z"/>
    <path class="ov-line hair" d="M506,256 V298 M614,256 V298"/>
    <path class="ov-tint" d="M488,256 h144 v34 h-144 z"/>
    <path class="ov-line" d="M488,250 h144 l-10,44 h-124 z"/>
    <path class="ov-line hair" d="M548,262 h24 v8 h-24 z"/>
    ${arrow(560, 280, 0, 1, k * 0.5)}`,
  // a heated cube for the feet, run off the panels: cold feet are what a person notices first,
  // and warming them costs a fraction of warming the air
  footStove: (k) => `
    <path class="ov-tint" d="M540,276 h44 v22 h-44 z"/>
    <path class="ov-line" d="M540,270 h44 v28 h-44 z"/>
    <path class="ov-line hair" d="M548,278 h28 M548,286 h28"/>
    <path class="ov-line" d="M584,282 H620 V190"/>
    <path class="ov-line hair" d="M612,186 h16 v8 h-16 z"/>
    ${arrow(620, 200, 0, -1, k * 0.5)}
    <path class="ov-line hair" d="M552,270 V262 M572,270 V262"/>`,
  // a hooded chair facing the room's heat, its back and hood to the cold south glazing, and a
  // folding screen behind it: the draught and the cold window never reach the person
  hoodedChair: (k) => `
    <path class="ov-tint" d="M600,434 V352 Q600,338 584,336 H568 Q580,344 582,356 V406 H600 Z"/>
    <path class="ov-line" d="M600,434 V352 Q600,338 584,336 H566 Q580,344 582,356 V406"/>
    <path class="ov-line" d="M556,406 H600 M560,406 V434 M556,388 H582"/>
    <path class="ov-line hair" d="M556,388 V406"/>
    <path class="ov-line" d="M612,434 V346 H620 V434"/>
    <path class="ov-line hair" d="M612,370 h8 M612,410 h8"/>
    <path class="ov-line hair" d="M650,380 H628"/>${arrow(626, 380, -1, 0, k * 0.5)}`,
  // a bed in a box with a curtain across it: the volume being heated is the bed, and the body
  // in it is the heater. A medieval answer, and still the cheapest one here.
  boxBed: (k) => `
    <path class="ov-line" d="M470,206 h120 v92 h-120 z"/>
    <path class="ov-tint" d="M474,248 h112 v46 h-112 z"/>
    <path class="ov-line" d="M474,248 h112 v10 h-112 z"/>
    <path class="ov-line hair" d="M478,248 V240 h26 v8"/>
    <path class="ov-line" d="M540,206 q4,46 0,92 M556,206 q-4,46 0,92 M572,206 q4,46 0,92"/>
    <path class="ov-line hair" d="M600,250 h-14"/>${arrow(583, 250, -1, 0, k * 0.5)}`,
}
/* <<< plate helpers */

export const PLATES = [
  {
    id: 'SOL-053', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Rainwater harvesting and storage', fr: 'Récupération et stockage de l’eau de pluie',
    // NORTH since 2026-09-10 (the slot plan): the south side is the sunspace's, and stored
    // water wants shade -- a cool tank grows no algae. Mirrored about the ridge (x' = 840 - x).
    // FIRST FLUSH runs UP the downpipe since the kitchen batch: read across, it ran through the
    // north wall into the pantry's vents.
    zone: [8, 172, 200, 288], crop: [12, 330, 168, 140],
    draw: (t) => `
      <path class="ov-line" d="M114,196 l-24,9 v11 l28,-6 z"/>
      <path class="ov-line" d="M104,216 h-11 v212 h11 z"/>
      <path class="ov-line hair" d="M110,428 h-23 M99,436 v9 M106,445 h-14"/>
      <path class="ov-line" d="M93,350 h-9 v12 h9 z"/>
      <path class="ov-tint" d="M84,382 h-56 v66 h56 z"/>
      <path class="ov-line" d="M84,356 h-56 v92 h56 z"/>
      <line class="ov-line hair" x1="84" y1="368" x2="28" y2="368"/>
      <path class="ov-dash" d="M80,382 h-48"/>
      <path class="ov-line hair" d="M84,440 h5 M89,437 v7"/>
      ${arrow(98.5, 300, 0, 1)}${arrow(98.5, 340, 0, 1)}
      ${arrow(170, 169, -316, 128)}${arrow(134, 184, -316, 128)}
      <text class="ov-txt" x="56" y="348" text-anchor="middle">${t('TANK', 'CUVE')}</text>
      <text class="ov-txt" x="120" y="426" text-anchor="start" transform="rotate(-90 120 426)">${t('FIRST FLUSH', 'PREMIÈRES EAUX')}</text>`,
  },
  {
    id: 'SOL-059', members: ['SOL-132'], fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Thermosiphon solar water heater', fr: 'Chauffe-eau solaire à thermosiphon',
    zone: [430, 30, 300, 194], crop: [440, 34, 280, 150],
    draw: (t) => `
      <path class="ov-tint" d="M520,108 L660,165 L666,150 L526,93 Z"/>
      <path class="ov-line" d="M520,108 L660,165 L666,150 L526,93 Z"/>
      <path class="ov-line hair" d="M548,102 L542,117 M578,114 L572,129 M608,126 L602,141 M638,138 L632,153"/>
      <path class="ov-line hair" d="M528,88 L668,145 M526,93 L528,88 M666,150 L668,145"/>
      <path class="ov-dash" d="M444,70 H568"/>
      <text class="ov-num" x="572" y="72" text-anchor="start" font-size="10">${t('TANK ABOVE COLLECTOR', 'BALLON PLUS HAUT')}</text>
      <path class="ov-line" d="M460,44 h76 a11,11 0 0 1 0,22 h-76 a11,11 0 0 1 0,-22 z"/>
      <path class="ov-line hair" d="M472,66 V80 L516,104"/>
      <path class="ov-hide" d="M516,104 L659,162"/>
      <path class="ov-line hair" d="M659,162 L664,155"/>
      <path class="ov-line hair" d="M523,101 L528,46"/>
      ${arrow(496, 93, 44, 24)}${arrow(604, 140, 143, 58)}
      ${arrow(526, 68, 5, -55)}
      <path class="ov-line hair" d="M486,121 L491,92"/>
      <text class="ov-num" x="478" y="132" text-anchor="start">${t('COLD', 'FROIDE')}</text>
      <text class="ov-num" x="532" y="84" text-anchor="start">${t('HOT', 'CHAUDE')}</text>
      <text class="ov-txt" x="600" y="196" text-anchor="middle">${t('COLLECTOR', 'CAPTEUR')}</text>
      <text class="ov-txt" x="464" y="50" text-anchor="end">${t('TANK', 'BALLON')}</text>`,
  },
  {
    id: 'SOL-123', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Secondary glazing (retrofit inner pane)', fr: 'Survitrage (vitre intérieure ajoutée)',
    zone: [560, 300, 180, 150], crop: [152, 78, 194, 194], mobile: [150, 60, 560, 373],
    draw: (t) => `
      <circle class="ov-dash" cx="681" cy="373" r="30"/>
      <line class="ov-line hair" x1="656" y1="356" x2="329" y2="212"/>
      <circle class="ov-fill" cx="248" cy="176" r="88"/>
      <path class="ov-line hair" d="M190,112 h28 v128 h-28 z"/>
      ${hatchAcc(190, 112, 28, 128)}
      <path class="ov-line" d="M222,118 v118 M227,118 v118"/>
      <path class="ov-line" d="M270,126 v104 M275,126 v104"/>
      <path class="ov-line hair" d="M264,122 h17 v112 h-17 z"/>
      <path class="ov-line hair" d="M227,250 h43 M227,246 v8 M270,246 v8"/>
      <text class="ov-num" x="249" y="264" text-anchor="middle">60</text>
      <text class="ov-txt" x="204" y="96" text-anchor="end">${t('EXISTING', 'EXISTANT')}</text>
      <text class="ov-txt" x="268" y="113" text-anchor="middle">${t('ADDED', 'AJOUTÉ')}</text>`,
  },
  {
    id: 'SOL-026', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Fixed horizontal overhangs (south)', fr: 'Débords de toit horizontaux fixes (sud)',
    zone: [438, 214, 394, 236], crop: [600, 232, 232, 208],
    draw: (t) => `
      <path class="ov-line" d="M690,324 h46 v11 h-46 z"/>
      <path class="ov-dash" d="M786,238 L690,424"/>
      <path class="ov-dash" d="M802,320 L468,434"/>
      <path class="ov-line" d="M448,433 h44"/>
      <circle class="ov-line hair" cx="790" cy="232" r="7"/>
      <circle class="ov-line hair" cx="806" cy="314" r="7"/>
      <text class="ov-num" x="776" y="222" text-anchor="end">21 JUN</text>
      <text class="ov-num" x="812" y="302" text-anchor="end">21 DEC</text>
      <text class="ov-num" x="748" y="262" text-anchor="end">48° N</text>
      <path class="ov-line hair" d="M712,292 V322"/>
      <text class="ov-txt" x="694" y="288" text-anchor="start">${t('OVERHANG', 'DÉBORD')}</text>`,
  },
  {
    id: 'SOL-029', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Exposed thermal mass (masonry, rammed earth, slab)', fr: 'Inertie thermique apparente (maçonnerie, terre, dalle)',
    // A LAYER since 2026-09-10 (the slot plan): the mass is the floor slab itself, so solutions
    // can stand on it instead of competing with it. The free-standing wall went with the old
    // off-centre plan. Heat rises into the rooms where nothing stands on the floor -- which, since
    // the kitchen got its counter and the bath its shower, means the open end of the living room --
    // one arrow, by the window, since the living room's cooler took the rest of its floor.
    zone: [150, 392, 540, 86], crop: [330, 388, 280, 96],
    draw: (t) => `
      <path class="ov-tint" d="M150,434 h540 v14 h-540 z"/>
      <path class="ov-line" d="M150,434 h540 v14 h-540 z"/>
      ${hatchAcc(150, 434, 540, 14, 10)}
      <path class="ov-line hair" d="M666,430 v-16"/>${arrow(666, 408, 0, -1)}
      <text class="ov-txt" x="420" y="470" text-anchor="middle">${t('EXPOSED MASS', 'MASSE APPARENTE')}</text>`,
  },
  {
    id: 'SOL-126', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Rocket mass heater', fr: 'Poêle de masse rocket',
    // THE LIVING ROOM since 2026-09-10 (the slot plan): mirrored so the bench runs north to the
    // central riser. The gas path is now drawn the way the barrel actually sits on the bench:
    // down the gap between riser and barrel, into the bench, north along it, up the flue lane
    // (x 410) of the riser. The composting toilet's vent takes the other lane (x 426-434).
    zone: [384, 20, 290, 430], crop: [436, 300, 236, 150], mobile: [380, 250, 300, 200],
    draw: (t) => `
      <path class="ov-tint" d="M442,392 h182 v42 h-182 z"/>
      <path class="ov-line" d="M442,392 h182 v42 h-182 z"/>
      <path class="ov-line" d="M536,322 h64 v70 h-64 z"/>
      <path class="ov-line hair" d="M604,338 h18 v54 h-18 z"/>
      <path class="ov-line hair" d="M568,370 h36 v12 h-36 z"/>
      <path class="ov-line hair" d="M552,328 h16 v42 h-16 z"/>
      <path class="ov-dash" d="M560,336 V326 H546 V412 H410 V36"/>
      <path class="ov-line hair" d="M613,346 v10"/>${arrow(613, 364, 0, 1)}
      <path class="ov-line hair" d="M560,362 v-10"/>${arrow(560, 344, 0, -1)}
      <path class="ov-line hair" d="M486,412 h-6"/>${arrow(472, 412, -1, 0)}
      <text class="ov-txt" x="626" y="334" text-anchor="start" font-size="10">${t('FEED', 'BOIS')}</text>
      <text class="ov-txt" x="530" y="324" text-anchor="end">${t('HEAT RISER', 'COLONNE CHAUDE')}</text>
      <text class="ov-txt" x="488" y="386" text-anchor="middle">${t('MASS BENCH', 'BANC À INERTIE')}</text>
      <path class="ov-line hair" d="M443,203 H412"/>
      <text class="ov-txt" x="446" y="206" text-anchor="start">${t('FLUE', 'CONDUIT')}</text>`,
  },
  {
    id: 'SOL-038', members: ['SOL-032', 'SOL-210'], fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation', en: 'Cross-ventilation (opposed openings)', fr: 'Ventilation traversante (ouvertures opposées)',
    zone: [140, 176, 560, 140], crop: [150, 182, 546, 128],
    draw: (t) => `
      <path class="ov-line" d="M150,210 h18 v58 h-18 z"/>
      <path class="ov-line" d="M672,210 h18 v58 h-18 z"/>
      <path class="ov-line hair" d="M168,214 a54,54 0 0 1 40,50"/>
      <path class="ov-line hair" d="M672,214 a54,54 0 0 0 -40,50"/>
      <path class="ov-line" d="M186,240 C 300,218 520,266 656,238"/>
      <path class="ov-line" d="M646,232 l12,6 l-12,7"/>
      ${arrow(320, 235, 1, 0.05)}${arrow(482, 245, 1, -0.08)}
      <text class="ov-txt" x="420" y="274" text-anchor="middle">${t('OPPOSED OPENINGS', 'OUVERTURES OPPOSÉES')}</text>`,
  },
  {
    id: 'SOL-069', members: ['SOL-134', 'SOL-229'], fnEn: 'Blackwater / sewage management', fnFr: 'Gestion des eaux noires', en: 'Composting toilet (dry)', fr: 'Toilettes sèches à compost',
    // THE BATH since 2026-09-10 (the slot plan), its vent in the riser's second lane. It used to
    // rise through the solar collector -- the collision test's service-route clash. The last
    // hand-built arrowhead in the set (the one through the seat) is on the helper now.
    // Against the partition since the wet core (2026-09-10), so the shower fits between it and the
    // riser; chamber and bays moved with it, the in-use bay still under the chute.
    zone: [220, 18, 226, 492], crop: [240, 370, 200, 140], mobile: [200, 280, 300, 200],
    draw: (t) => `
      <path class="ov-line" d="M304,398 h44 v36 h-44 z"/>
      <line class="ov-line hair" x1="302" y1="398" x2="350" y2="398"/>
      <path class="ov-line hair" d="M326,404 v14"/>${arrow(326, 424, 0, 1, 7)}
      <path class="ov-line" d="M296,450 h80 v50 h-80 z"/>
      <line class="ov-line hair" x1="336" y1="450" x2="336" y2="500"/>
      <path class="ov-line hair" d="M376,458 H426"/>
      <path class="ov-line" d="M426,458 V36 M434,458 V36"/>
      <path class="ov-line hair" d="M420,28 h20 v6 h-20 z"/>
      ${arrow(430, 300, 0, -1)}${arrow(430, 210, 0, -1)}
      <path class="ov-line hair" d="M293,470 l14,4 M293,492 l62,-6"/>
      <text class="ov-txt" x="444" y="160" text-anchor="start">${t('VENT STACK', 'COLONNE DE VENT.')}</text>
      <text class="ov-txt" x="290" y="474" text-anchor="end">${t('IN USE', 'EN SERVICE')}</text>
      <text class="ov-txt" x="290" y="496" text-anchor="end">${t('RESTING', 'EN REPOS')}</text>`,
  },
  {
    id: 'SOL-035', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'South-facing attached sunspace / solar greenhouse', fr: 'Serre accolée exposée au sud',
    zone: [660, 260, 172, 200], crop: [664, 264, 164, 196],
    draw: (t) => `
      <path class="ov-tint" d="M690,286 L800,448 L690,448 Z"/>
      <path class="ov-line" d="M690,286 L800,448"/>
      <path class="ov-line hair" d="M698,282 L808,444"/>
      <path class="ov-line" d="M690,448 h114"/>
      <path class="ov-line hair" d="M718,327 l7,-5 M746,368 l7,-5 M774,409 l7,-5"/>
      <path class="ov-line" d="M672,296 h18 v18 h-18 z"/>
      <path class="ov-line" d="M672,410 h18 v18 h-18 z"/>
      <path class="ov-line hair" d="M700,305 h-28"/>${arrow(666, 305, -1, 0)}
      <path class="ov-line hair" d="M664,419 h28"/>${arrow(698, 419, 1, 0)}
      <text class="ov-txt" x="700" y="278" text-anchor="start">${t('SUNSPACE', 'SERRE ACCOLÉE')}</text>
      <text class="ov-num" x="706" y="292" text-anchor="start">${t('HIGH VENT', 'HAUTE')}</text>
      <text class="ov-num" x="706" y="440" text-anchor="start">${t('LOW VENT', 'BASSE')}</text>`,
  },
  /* ---- first batch, 2026-09-10: the walls, as layers. One detail, eight plates, 28 solutions. */
  {
    id: 'SOL-001', members: ['SOL-002'], fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Light timber frame construction', fr: 'Ossature bois légère', zone: [140, 150, 260, 236], crop: [192, 156, 196, 210], mobile: [130, 140, 330, 220], detailOnly: true,
    draw: (t) => wallDetail(t, { variant: 'frame', hl: ['structure'], label: ['TIMBER FRAME', 'OSSATURE BOIS'] }),
  },
  {
    id: 'SOL-115', members: ['SOL-116', 'SOL-141', 'SOL-142', 'SOL-144', 'SOL-145'], fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Cob / monolithic earthen wall construction', fr: 'Mur porteur en terre monolithique (bauge)', zone: [140, 150, 260, 236], crop: [192, 156, 196, 210], mobile: [130, 140, 330, 220], detailOnly: true,
    draw: (t) => wallDetail(t, { variant: 'mass', hl: ['structure'], label: ['MASS WALL', 'MUR MASSIF'] }),
  },
  {
    id: 'SOL-016', members: ['SOL-017', 'SOL-018', 'SOL-019', 'SOL-020', 'SOL-121', 'SOL-122', 'SOL-143', 'SOL-158', 'SOL-173', 'SOL-194'], fnEn: 'Thermal comfort', fnFr: 'Confort thermique',
    en: 'Wood wool insulation board', fr: 'Panneau isolant en laine de bois', zone: [140, 150, 260, 236], crop: [192, 156, 196, 210], mobile: [130, 140, 330, 220], detailOnly: true,
    draw: (t) => wallDetail(t, { variant: 'frame', hl: ['cavity'], label: ['INSULATION', 'ISOLANT'] }),
  },
  {
    id: 'SOL-021', members: ['SOL-146'], fnEn: 'Thermal comfort', fnFr: 'Confort thermique',
    en: 'Continuous exterior insulation detailing', fr: 'Isolation extérieure continue soignée', zone: [140, 150, 260, 236], crop: [192, 156, 196, 210], mobile: [130, 140, 330, 220], detailOnly: true,
    draw: (t) => wallDetail(t, { variant: 'frame', hl: ['extins'], label: ['EXTERNAL INSULATION', 'ISOLATION EXTÉRIEURE'] }),
  },
  {
    id: 'SOL-022', members: ['SOL-214'], fnEn: 'Thermal comfort', fnFr: 'Confort thermique',
    en: 'Airtight membrane with taped/sealed joints', fr: 'Membrane d’étanchéité à l’air avec joints scotchés', zone: [140, 150, 260, 236], crop: [192, 156, 196, 210], mobile: [130, 140, 330, 220], detailOnly: true,
    draw: (t) => wallDetail(t, { variant: 'frame', hl: ['membrane'], label: ['AIRTIGHT LAYER, TAPED', 'COUCHE ÉTANCHE, JOINTS SCOTCHÉS'] }),
  },
  {
    id: 'SOL-041', members: ['SOL-130'], fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation',
    en: 'Hygroscopic natural finishes (clay plaster, exposed wood)', fr: 'Enduits naturels hygroscopiques (terre, bois apparent)', zone: [140, 150, 260, 236], crop: [192, 156, 196, 210], mobile: [130, 140, 330, 220], detailOnly: true,
    draw: (t) => wallDetail(t, { variant: 'frame', hl: ['finish'], label: ['NATURAL FINISH', 'ENDUIT NATUREL'] }),
  },
  {
    id: 'SOL-100', members: ['SOL-103'], fnEn: 'Building durability & maintainability', fnFr: 'Durabilité et facilité d’entretien du bâtiment',
    en: 'Rainscreen cladding with drainage gap', fr: 'Bardage à lame d’air ventilée', zone: [140, 150, 260, 236], crop: [192, 156, 196, 210], mobile: [130, 140, 330, 220], detailOnly: true,
    // Air rises in the gap and water runs down it: the two reasons the gap exists.
    draw: (t) => wallDetail(t, { variant: 'frame', hl: ['cladding', 'gap'], label: ['CLADDING + VENTILATED GAP', 'BARDAGE + LAME D’AIR'],
      extra: `<path class="ov-line hair" d="M236,238 v-14"/>${arrow(236, 216, 0, -1, 5)}<path class="ov-line hair" d="M236,272 v14"/>${arrow(236, 294, 0, 1, 5)}` }),
  },
  {
    id: 'SOL-006', members: [], fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité',
    en: 'Reinforced roof-to-wall strapping (hurricane ties)', fr: 'Fixations renforcées toiture-mur (équerres anticyclone)', zone: [140, 150, 260, 236], crop: [192, 156, 196, 210], mobile: [130, 140, 330, 220], detailOnly: true,
    draw: (t) => eaveDetail(t),
  },
  /* ---- second batch, 2026-09-10: the kitchen. One counter, ten plates, 18 solutions. `site` is
     what the built house composes: the object where it stands, without the bubble. */
  {
    id: 'SOL-088', members: ['SOL-188'], fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Ventilated dry pantry', fr: 'Garde-manger sec ventilé', ...KZ,
    // Air in low, out high: the cupboard is warmer than the north air, so it rises through the
    // slatted shelves and leaves at the top. The bottom shelf is the coolest -- the multi-zone idea.
    site: () => KO.pantry(6),
    draw: (t) => closeUp(t, { focus: [172, 404], obj: KO.pantry, label: ['VENTILATED PANTRY', 'GARDE-MANGER VENTILÉ'], notes: [
      { x: 204, y: 140, a: 'end', en: 'WARM AIR OUT', fr: 'AIR TIÈDE', to: [152, 388] },
      { x: 146, y: 262, a: 'end', en: 'COOL AIR IN', fr: 'AIR FRAIS', to: [145, 421], from: [150, 259] },
      { x: 446, y: 222, en: 'COOLEST SHELF', fr: 'ÉTAGÈRE LA PLUS FRAÎCHE', to: [180, 413] }] }),
  },
  {
    id: 'SOL-148', members: ['SOL-056', 'SOL-131', 'SOL-149'], fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable',
    en: 'Ceramic candle filter (silver-impregnated)', fr: 'Filtre bougie céramique (argentée)', ...KZ,
    // The candles stand IN the raw water and drain through their cores into the vessel below.
    site: () => KO.filter(6),
    draw: (t) => closeUp(t, { focus: [249, 358], obj: KO.filter, label: ['WATER FILTER', 'FILTRE À EAU'],
      extra: () => `<path class="ov-line hair" d="M246,352 V364 M252,352 V364"/>${arrow(246, 366, 0, 1, 3.5)}${arrow(252, 366, 0, 1, 3.5)}`,
      notes: [
        { x: 446, y: 150, en: 'RAW WATER', fr: 'EAU BRUTE', to: [255.5, 346] },
        { x: 446, y: 180, en: 'FILTER', fr: 'FILTRE', to: [253.5, 353] },
        { x: 446, y: 225, en: 'CLEAN WATER', fr: 'EAU FILTRÉE', to: [261, 372.5] }] }),
  },
  {
    id: 'SOL-108', members: ['SOL-110', 'SOL-111', 'SOL-157', 'SOL-243'], fnEn: 'Solid waste management', fnFr: 'Gestion des déchets solides',
    en: 'Multi-bin sorting station', fr: 'Station de tri multi-bacs', ...KZ,
    site: () => KO.bins(6),
    draw: (t) => closeUp(t, { focus: [217, 414], obj: KO.bins, label: ['SORTING BINS', 'BACS DE TRI'], notes: [
      { x: 275.7, y: 194, a: 'middle', rot: -90, fs: 7.5, en: 'FOOD', fr: 'BIODÉCHETS' },
      { x: 303, y: 194, a: 'middle', rot: -90, fs: 7.5, en: 'RECYCLING', fr: 'RECYCLABLES' },
      { x: 329.7, y: 194, a: 'middle', rot: -90, fs: 7.5, en: 'RESIDUAL', fr: 'RÉSIDUELS' }] }),
  },
  {
    id: 'SOL-228', fnEn: 'Personal hygiene & sanitation', fnFr: 'Hygiène personnelle et sanitaires',
    en: 'Two-basin hand dishwashing', fr: 'Vaisselle à la main en deux bassines', ...KZ,
    site: () => KO.basins(6),
    draw: (t) => closeUp(t, { focus: [216, 389], obj: KO.basins, label: ['TWO BASINS: WASH, THEN RINSE', 'DEUX BASSINES : LAVER, PUIS RINCER'],
      extra: () => `<path class="ov-line hair" d="M209,389 Q216,382 223,389"/>${arrow(223, 389, 1, 1, 3.5)}`,
      notes: [
        { x: 297, y: 228, a: 'end', fs: 9.5, en: 'WASH', fr: 'LAVAGE' },
        { x: 303, y: 228, a: 'start', fs: 9.5, en: 'RINSE', fr: 'RINÇAGE' }] }),
  },
  {
    id: 'SOL-227', fnEn: 'Personal hygiene & sanitation', fnFr: 'Hygiène personnelle et sanitaires',
    en: 'Dishwasher', fr: 'Lave-vaisselle', ...KZ,
    site: () => KO.dishwasher(6),
    draw: (t) => closeUp(t, { focus: [249, 398], obj: KO.dishwasher, label: ['DISHWASHER', 'LAVE-VAISSELLE'], notes: [
      { x: 446, y: 196, en: 'RACKS', fr: 'PANIERS', to: [258, 402] },
      { x: 446, y: 250, en: 'SPRAY ARM', fr: 'BRAS D’ASPERSION', to: [254, 423] }] }),
  },
  {
    id: 'SOL-087', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Electric refrigerator', fr: 'Réfrigérateur électrique', ...KZ,
    // What a fridge does is MOVE heat: out of the box, into the kitchen, from coils at the back.
    site: () => KO.fridge(6),
    draw: (t) => closeUp(t, { focus: [249, 398], obj: KO.fridge, label: ['FRIDGE', 'RÉFRIGÉRATEUR'],
      // up the BACK edge, clear of the shelves: a line up the middle read as passing through the food
      extra: () => `<path class="ov-hide" d="M258,422 H260 V381"/><path class="ov-line hair" d="M260,377 V370"/>${arrow(260, 367, 0, -1, 3.5)}`,
      notes: [
        { x: 446, y: 166, en: 'HEAT OUT AT THE BACK', fr: 'CHALEUR REJETÉE DERRIÈRE', to: [260, 371] },
        { x: 446, y: 250, en: 'COMPRESSOR', fr: 'COMPRESSEUR', to: [252, 423] }] }),
  },
  {
    id: 'SOL-163', members: ['SOL-213'], fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Induction cooktop', fr: 'Plaque à induction', ...KZ,
    // Gas or induction, one drawing: the hob, and the hood that takes the fumes out through the
    // north wall -- along the ceiling, above the window, clear of the riser's two lanes.
    site: () => KO.hob(6),
    draw: (t) => closeUp(t, { focus: [281, 356], obj: KO.hob, label: ['HOB AND EXTRACT HOOD', 'PLAQUE ET HOTTE'],
      extra: () => `<path class="ov-dash" d="M274.5,364 V345"/>${arrow(274.5, 341, 0, -1, 3.5)}`,
      notes: [
        { x: 446, y: 162, en: 'HOOD, DUCTED NORTH', fr: 'HOTTE, VERS LE NORD', to: [294, 334] },
        { x: 446, y: 200, en: 'FUMES', fr: 'FUMÉES', to: [275, 352] }] }),
  },
  {
    id: 'SOL-179', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Pressure canning / autoclave sterilization', fr: 'Stérilisation par autoclave (mise en conserve sous pression)', ...KZ,
    // About 1 bar above the air, water boils at about 121 °C: hot enough for spores, which 100 °C is not.
    site: () => KO.canner(6),
    draw: (t) => closeUp(t, { focus: [290, 360], obj: KO.canner, label: ['PRESSURE CANNER', 'AUTOCLAVE'], notes: [
      { x: 446, y: 140, en: 'WEIGHTED VALVE', fr: 'SOUPAPE À POIDS', to: [291.5, 343.8] },
      { x: 446, y: 175, en: '121 °C UNDER PRESSURE', fr: '121 °C SOUS PRESSION', to: [296, 358] },
      { x: 446, y: 205, en: 'JARS', fr: 'BOCAUX', to: [295, 368] },
      { x: 446, y: 235, en: 'A LITTLE WATER', fr: 'UN FOND D’EAU', to: [296, 373] }] }),
  },
  {
    id: 'SOL-169', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Haybox / retained-heat cooker (fireless cooker)', fr: 'Marmite norvégienne (cuisson à chaleur retenue)', ...KZ,
    // Brought to the boil on the hob above, then shut in the box below it to finish on its own heat.
    site: () => KO.haybox(6),
    draw: (t) => closeUp(t, { focus: [282, 398], obj: KO.haybox, label: ['HAYBOX', 'MARMITE NORVÉGIENNE'],
      extra: () => `<path class="ov-dash" d="M271,371 C262,371 260,396 266,402"/>${arrow(266, 402, 1, 1, 3.5)}`,
      notes: [
        { x: 446, y: 166, en: 'HOT POT', fr: 'MARMITE CHAUDE', to: [289, 375] },
        { x: 446, y: 205, en: 'HAY ALL ROUND', fr: 'FOIN TOUT AUTOUR', to: [293.5, 412] }] }),
  },
  {
    id: 'SOL-184', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Zeer pot (evaporative pot-in-pot cooler)', fr: 'Pot zeer (rafraîchissement évaporatif pot-dans-pot)', ...KZ,
    // Water leaving the wet sand takes its heat from the inner pot. It wants shade and moving,
    // dry air: the north counter, by the window.
    site: () => KO.zeer(6),
    draw: (t) => closeUp(t, { focus: [184, 362], obj: KO.zeer, label: ['ZEER POT', 'POT ZEER'],
      extra: () => `<path class="ov-line hair" d="M175,366 L170,364.2 M193,366 L198,364.2 M184,347 V344"/>`
        + `${arrow(169, 363.8, -5, -1.8, 3.5)}${arrow(199, 363.8, 5, -1.8, 3.5)}${arrow(184, 342, 0, -1, 3.5)}`,
      notes: [
        { x: 300, y: 120, a: 'middle', en: 'EVAPORATION', fr: 'ÉVAPORATION' },
        { x: 292, y: 252, a: 'middle', en: 'WET SAND', fr: 'SABLE HUMIDE', to: [177, 368], from: [288, 243] }] }),
  },
  /* ---- 2026-09-24: four rows from the Low-tech Lab re-match, on the same counter run. */
  {
    id: 'SOL-242', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Insulating pot skirt', fr: 'Jupe isolante (casserole ou brûleur)', ...KZ,
    // On the hob's own pan: a skirt works with the hob, it is not a second one.
    site: () => KO.skirt(6),
    draw: (t) => closeUp(t, { focus: [275, 369], obj: KO.skirt, label: ['POT SKIRT', 'JUPE ISOLANTE'], notes: [
      { x: 446, y: 166, en: 'SKIRT', fr: 'JUPE', to: [266.8, 367] },
      { x: 446, y: 205, en: 'NARROW GAP', fr: 'ESPACE ÉTROIT', to: [267.8, 372] }] }),
  },
  {
    id: 'SOL-246', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Boiling-water bath preserving (pasteurisation)', fr: 'Conserves au bain-marie (pasteurisation)', ...KZ,
    // The canner's burner: a household preserves in one or the other, and acid foods only here.
    site: () => KO.bath(6),
    draw: (t) => closeUp(t, { focus: [290, 362], obj: KO.bath, label: ['BOILING-WATER BATH', 'BAIN-MARIE'], notes: [
      { x: 446, y: 150, en: '100 °C', fr: '100 °C', to: [296, 356] },
      { x: 446, y: 185, en: 'JARS UNDER WATER', fr: 'BOCAUX SOUS L’EAU', to: [293.5, 366] },
      { x: 446, y: 220, en: 'ACID FOODS ONLY', fr: 'ALIMENTS ACIDES SEULEMENT' }] }),
  },
  {
    id: 'SOL-245', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Insulated cool box', fr: 'Glacière isolée', ...KZ,
    // The fridge's recess: what keeps food cold when the fridge cannot.
    site: () => KO.coolbox(6),
    draw: (t) => closeUp(t, { focus: [249, 416], obj: KO.coolbox, label: ['COOL BOX', 'GLACIÈRE'], notes: [
      { x: 446, y: 222, en: 'ICE PACKS', fr: 'PAINS DE GLACE', to: [242.5, 417] },
      { x: 446, y: 250, en: 'THICK INSULATION', fr: 'ISOLATION ÉPAISSE', to: [238, 422] }] }),
  },
  {
    id: 'SOL-248', fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation',
    en: 'Desiccant moisture absorber', fr: 'Absorbeur d’humidité au sel', ...KZ,
    // A small damp space is what it treats; the pantry is the cupboard on this counter.
    site: () => KO.absorber(6),
    draw: (t) => closeUp(t, { focus: [176.5, 405], obj: KO.absorber, label: ['SALT MOISTURE ABSORBER', 'ABSORBEUR D’HUMIDITÉ'], notes: [
      { x: 446, y: 222, en: 'SALT', fr: 'SEL', to: [176.5, 402] },
      { x: 446, y: 250, en: 'DRIP TRAY', fr: 'BAC', to: [176.5, 411] }] }),
  },
  /* ---- third batch, 2026-09-10: the wet core -- the bath, and the riser beside it. */
  {
    id: 'SOL-070', members: ['SOL-216'], fnEn: 'Blackwater / sewage management', fnFr: 'Gestion des eaux noires et de l’assainissement',
    en: 'Low-flush toilet', fr: 'WC à faible chasse', ...BZ,
    // The water standing in the bowl IS a trap: the seal that keeps the drain's air out.
    site: () => KB.wc(),
    draw: (t) => closeUp(t, { focus: [322, 408], obj: KB.wc, label: ['FLUSH WC', 'WC À CHASSE'], notes: [
      { x: 204, y: 146, a: 'end', en: 'CISTERN', fr: 'RÉSERVOIR', to: [308, 392] },
      { x: 446, y: 160, en: 'FED FROM THE RISER', fr: 'ALIMENTÉ PAR LA GAINE', to: [326, 398] },
      { x: 446, y: 212, en: 'WATER SEAL', fr: 'GARDE D’EAU', to: [326, 417] },
      { x: 446, y: 262, en: 'TO THE DRAIN', fr: 'VERS L’ÉVACUATION', to: [314, 440] }] }),
  },
  {
    id: 'SOL-199', fnEn: 'Personal hygiene & sanitation', fnFr: 'Hygiène personnelle et sanitaires',
    en: 'Cistern-lid handwash basin (handwash water reused for flushing)', fr: 'Lave-mains sur réservoir de WC (eau de lavage réutilisée pour la chasse)', ...BZ,
    // Fresh water from the fill valve, over the hands, into the cistern: the next flush. No second
    // pipe and no waste connection -- which is why it draws the WC it cannot exist without.
    site: () => KB.basin(),
    draw: (t) => closeUp(t, { focus: [310, 380], obj: KB.basin, label: ['HANDWASH ON THE CISTERN', 'LAVE-MAINS SUR LE RÉSERVOIR'],
      extra: () => `<path class="ov-line hair" d="M311,368.5 V372"/>${arrow(311, 374, 0, 1, 2.6)}<path class="ov-line hair" d="M309,383 V389"/>${arrow(309, 391, 0, 1, 2.6)}`,
      notes: [
        { x: 446, y: 170, en: 'FROM THE FILL VALVE', fr: 'DU FLOTTEUR', to: [310, 366] },
        { x: 446, y: 196, en: 'WASH HANDS', fr: 'LAVAGE DES MAINS', to: [315, 378] },
        { x: 446, y: 232, en: 'INTO THE CISTERN', fr: 'VERS LE RÉSERVOIR', to: [311, 398] }] }),
  },
  {
    id: 'SOL-153', fnEn: 'Greywater management', fnFr: 'Gestion des eaux grises',
    en: 'Direct greywater diversion to toilet flushing', fr: 'Détournement direct des eaux grises vers la chasse d’eau', ...BZ,
    // By the bucket: a few litres poured fast into the bowl flush it. Untreated, so same day only.
    site: () => KB.bucket(6),
    draw: (t) => closeUp(t, { focus: [362, 404], obj: KB.bucket, label: ['SHOWER WATER TO FLUSH', 'EAU DE DOUCHE POUR LA CHASSE'], ring: 26,
      extra: () => `<path class="ov-dash" d="M383,390 V404 M388,388 V404"/>`,
      notes: [
        { x: 204, y: 150, a: 'end', en: 'POURED IN', fr: 'VERSÉE', to: [340, 398] },
        { x: 446, y: 226, en: 'SHOWER WATER, CAUGHT', fr: 'EAU DE DOUCHE, RECUEILLIE', to: [390, 420] }] }),
  },
  {
    id: 'SOL-091', members: ['SOL-092', 'SOL-170', 'SOL-230'], fnEn: 'Personal hygiene & sanitation', fnFr: 'Hygiène personnelle et sanitaires',
    en: 'Gravity-fed shower', fr: 'Douche gravitaire', ...BZ, zone: [290, 306, 152, 132], crop: [300, 300, 200, 150],
    // Too tall for the magnifier and big enough without it. Its supply comes out of the riser;
    // what feeds the riser -- a high tank, a pump, the mains -- is a plate of its own.
    site: () => KB.shower(),
    draw: (t) => annotated(t, { obj: KB.shower, label: ['SHOWER', 'DOUCHE', 446, 340], notes: [
      { x: 350, y: 331, a: 'end', en: 'HEAD', fr: 'POMMEAU', to: [371, 329.5], site: true },
      { x: 350, y: 386, a: 'end', en: 'MIXER', fr: 'MITIGEUR', to: [361, 383], site: true },
      { x: 350, y: 426, a: 'end', en: 'DRAIN', fr: 'ÉVACUATION', to: [357, 431], site: true },
      { x: 446, y: 368, en: 'SUPPLY FROM THE RISER', fr: 'ALIMENTATION PAR LA GAINE', to: [404, 386], site: true }] }),
  },
  {
    id: 'SOL-133', fnEn: 'Greywater management', fnFr: 'Gestion des eaux grises',
    en: 'Greywater heat recovery (drain water heat exchanger)', fr: 'Récupération de chaleur sur eaux grises (échangeur de vidange)', ...BZ,
    // Round the shower's drain, in the floor. The cold feed runs AGAINST the drain water and
    // leaves preheated, up the riser to the water heater -- the catalogue's "feeds directly into
    // domestic water heating", not the mixer.
    site: () => KB.sleeve(6),
    draw: (t) => closeUp(t, { focus: [388, 440], obj: KB.sleeve, label: ['DRAIN HEAT RECOVERY', 'RÉCUPÉRATION SUR VIDANGE'],
      extra: () => `${arrow(372, 440, 1, 0, 2.6)}${arrow(413, 440, 1, 0, 2.6)}`,
      notes: [
        { x: 258, y: 148, a: 'middle', en: 'WARM WATER', fr: 'EAU CHAUDE', to: [366, 438], from: [258, 152] },
        { x: 446, y: 150, en: 'COLD IN', fr: 'EAU FROIDE', to: [404, 430] },
        { x: 446, y: 230, en: 'TO THE WATER HEATER', fr: 'VERS LE CHAUFFE-EAU', to: [400, 447] }] }),
  },
  {
    id: 'SOL-075', fnEn: 'Blackwater / sewage management', fnFr: 'Gestion des eaux noires et de l’assainissement',
    en: 'Vented stack and trap plumbing', fr: 'Ventilation primaire et siphons', ...BZ, zone: [296, 10, 170, 480],
    // The trap holds a plug of water; the stack, open above the roof, lets air in behind falling
    // water so it cannot pull that plug out. Magnified: the trap. On the house: the whole stack.
    site: () => `${KB.trap()}${KB.stack(6)}`,
    draw: (t) => closeUp(t, { focus: [385, 446], obj: (k) => `${KB.trap()}${KB.stack(k)}`, label: ['VENTED STACK AND TRAPS', 'VENTILATION PRIMAIRE ET SIPHONS'], labelAt: [446, 222, 'start'], notes: [
      { x: 446, y: 44, en: 'OPEN ABOVE THE ROOF', fr: 'OUVERTE AU-DESSUS DU TOIT', to: [421, 20], site: true },
      { x: 446, y: 250, en: 'SOIL AND VENT STACK', fr: 'COLONNE DE CHUTE ET DE VENTILATION', to: [420, 250], site: true },
      { x: 204, y: 150, a: 'end', en: 'WATER SEAL', fr: 'GARDE D’EAU', to: [365, 444] },
      { x: 460, y: 470, en: 'TO THE DRAIN', fr: 'VERS L’ÉVACUATION', to: [452, 478], site: true }] }),
  },
  {
    id: 'SOL-064', fnEn: 'Greywater management', fnFr: 'Gestion des eaux grises',
    en: 'Separate greywater plumbing from blackwater', fr: 'Séparation des réseaux eaux grises / eaux noires', zone: [296, 424, 410, 72], crop: [296, 400, 410, 110],
    // Two lines out of the house, under the south footing, to two treatments. The grey leaves by
    // the stack's foot; the black straight down from the WC, never joining it.
    site: () => KB.split(6),
    draw: (t) => annotated(t, { obj: KB.split, label: ['GREY AND BLACK, KEPT APART', 'EAUX GRISES ET NOIRES, SÉPARÉES', 300, 527, 'middle', [313, 486]], notes: [
      { x: 424, y: 470, en: 'GREYWATER', fr: 'EAUX GRISES' },
      { x: 308, y: 499, a: 'end', en: 'BLACKWATER', fr: 'EAUX NOIRES' }] }),
  },
  {
    id: 'SOL-043', fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation',
    en: 'Localised extraction at odor sources (kitchen, bathroom)', fr: 'Extraction localisée aux sources d’odeurs (cuisine, sanitaires)', zone: [340, 56, 70, 290], crop: [300, 50, 150, 300],
    // The bath has no outside wall, so its extract rises beside the riser and leaves at the roof.
    // (The kitchen's is the hood, on the hob's plate.)
    site: () => KB.extract(6),
    draw: (t) => annotated(t, { obj: KB.extract, label: ['BATHROOM EXTRACT', 'EXTRACTION DE LA SALLE D’EAU', 386, 200, 'end'], notes: [
      { x: 384, y: 60, a: 'end', en: 'OUT, ABOVE THE ROOF', fr: 'SORTIE, AU-DESSUS DU TOIT', to: [388, 66], from: [386, 57], site: true },
      { x: 386, y: 285, a: 'end', en: 'FAN', fr: 'VENTILATEUR' },
      { x: 384, y: 350, a: 'end', en: 'DAMP AIR', fr: 'AIR HUMIDE', to: [391, 349], from: [387, 347], site: true }] }),
  },
  {
    id: 'SOL-057', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable',
    en: 'Gravity-fed distribution from elevated storage', fr: 'Distribution gravitaire depuis un stockage surélevé', zone: [318, 140, 96, 256], crop: [300, 120, 200, 280],
    // Water surface 3.35 m above the kitchen tap: about 0.33 bar, at 0.098 bar a metre. Weak
    // beside the mains' 3 bar, and it still flows in a power cut.
    site: () => KB.tank(6),
    draw: (t) => annotated(t, { obj: KB.tank, label: ['GRAVITY FROM A HIGH TANK', 'GRAVITÉ, RÉSERVOIR EN HAUTEUR', 446, 183], notes: [
      { x: 446, y: 206, en: 'TANK UNDER THE ROOF', fr: 'RÉSERVOIR SOUS LE TOIT', to: [384, 170], site: true },
      { x: 446, y: 252, en: '3.3 m OF HEAD ≈ 0.33 bar', fr: '3,3 m DE CHARGE ≈ 0,33 bar', to: [407, 252], site: true },
      { x: 446, y: 388, en: 'TO THE TAPS', fr: 'VERS LES ROBINETS', to: [406, 386], site: true }] }),
  },
  {
    id: 'SOL-102', fnEn: 'Building durability & maintainability', fnFr: 'Durabilité et facilité d’entretien du bâtiment',
    en: 'Reachable pipes and wiring', fr: 'Câbles et tuyaux accessibles', zone: [396, 86, 48, 352], crop: [380, 80, 200, 360],
    // The riser itself, with a panel on each floor: a repair is a panel off, not a wall opened.
    site: () => KB.chase(),
    draw: (t) => annotated(t, { obj: KB.chase, label: ['PIPES AND CABLES', 'GAINE TECHNIQUE', 446, 204], notes: [
      { x: 446, y: 245, en: 'ACCESS PANEL', fr: 'TRAPPE DE VISITE', to: [433, 242], site: true },
      { x: 446, y: 367, en: 'ACCESS PANEL', fr: 'TRAPPE DE VISITE', to: [433, 364], site: true }] }),
  },
  /* ---- fourth batch, 2026-09-11: the utility room. Twenty plates, 22 solutions. */
  {
    id: 'SOL-061', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Electric resistive water heater (cumulus)', fr: 'Chauffe-eau électrique à résistance (cumulus)', ...UZ,
    // Cold in at the bottom, hot out at the top: the tank stratifies, and the element sits low.
    site: () => KU.tank('electric')(6),
    draw: (t) => annotated(t, { obj: KU.tank('electric'), label: ['ELECTRIC WATER HEATER', 'CHAUFFE-EAU ÉLECTRIQUE', 186, 182], notes: [
      { x: 222, y: 217, en: 'HOT OUT', fr: 'EAU CHAUDE' },
      { x: 222, y: 281, en: 'ELEMENT', fr: 'RÉSISTANCE', to: [196, 282], site: true },
      { x: 222, y: 297, en: 'COLD IN', fr: 'EAU FROIDE' }] }),
  },
  {
    id: 'SOL-212', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Gas water heater', fr: 'Chauffe-eau au gaz', ...UZ,
    // The stored-cylinder kind: burner under the tank, flue up its middle, out through the wall.
    site: () => KU.tank('gas')(6),
    draw: (t) => annotated(t, { obj: KU.tank('gas'), label: ['GAS WATER HEATER', 'CHAUFFE-EAU AU GAZ', 186, 182], notes: [
      { x: 140, y: 206, a: 'end', en: 'FLUE OUT', fr: 'FUMÉES' },
      { x: 222, y: 217, en: 'HOT OUT', fr: 'EAU CHAUDE' },
      { x: 222, y: 250, en: 'FLUE UP THE MIDDLE', fr: 'CONDUIT AU CENTRE', to: [193, 250], site: true },
      { x: 222, y: 283, en: 'BURNER', fr: 'BRÛLEUR', to: [202, 293], site: true },
      { x: 222, y: 297, en: 'COLD IN', fr: 'EAU FROIDE' }] }),
  },
  {
    id: 'SOL-223', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Heat-pump water heater (chauffe-eau thermodynamique)', fr: 'Chauffe-eau thermodynamique', ...UZ,
    // The catalogue's own figure: 2 to 3.5 units of heat per unit of electricity, the rest drawn
    // from the room's air -- which is why it wants a big unheated room, and this is one.
    site: () => KU.tank('heatpump')(6),
    draw: (t) => annotated(t, { obj: KU.tank('heatpump'), label: ['HEAT-PUMP WATER HEATER', 'CHAUFFE-EAU THERMODYNAMIQUE', 186, 182], notes: [
      { x: 222, y: 211, en: 'COOLED AIR OUT', fr: 'AIR REFROIDI' },
      { x: 222, y: 233, en: 'HOT OUT', fr: 'EAU CHAUDE' },
      { x: 222, y: 258, en: 'CONDENSER COIL', fr: 'SERPENTIN', to: [207, 256], site: true },
      { x: 222, y: 298, en: 'COLD IN', fr: 'EAU FROIDE' }] }),
  },
  {
    id: 'SOL-211', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Gas boiler (condensing)', fr: 'Chaudière gaz à condensation', ...UZ,
    // For the radiators, not the taps (its function is thermal comfort): wall-hung, room-sealed,
    // flow and return down through the floor to the rooms.
    site: () => KU.boiler(6),
    draw: (t) => annotated(t, { obj: KU.boiler, label: ['CONDENSING GAS BOILER', 'CHAUDIÈRE GAZ À CONDENSATION', 252, 182], notes: [
      { x: 140, y: 214, a: 'end', en: 'FLUE OUT, AIR IN', fr: 'FUMÉES, AIR', to: [144, 193], from: [142, 205], site: true },
      { x: 272, y: 262, a: 'end', en: 'TO RADIATORS', fr: 'VERS RADIATEURS', to: [282, 262], site: true }] }),
  },
  {
    id: 'SOL-080', members: ['SOL-084', 'SOL-155'], fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Battery bank (low-voltage DC)', fr: 'Parc de batteries basse tension (CC)', ...UZ,
    // Bigger (084) or lithium (155), the same bank on the same floor.
    site: () => KU.battery(6),
    draw: (t) => annotated(t, { obj: KU.battery, label: ['BATTERY BANK', 'PARC DE BATTERIES', 222, 248], notes: [
      { x: 272, y: 265, en: 'FUSE', fr: 'FUSIBLE', to: [255, 263], site: true },
      { x: 272, y: 284, en: 'LOW-VOLTAGE DC', fr: 'BASSE TENSION CC' }] }),
  },
  {
    id: 'SOL-082', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Inverter (DC to AC)', fr: 'Onduleur (CC vers CA)', zone: [140, 180, 252, 126], crop: [180, 190, 220, 270],
    site: () => KU.battery(6) + KU.inverter(6),
    draw: (t) => closeUp(t, { at: UB, focus: [252, 222], obj: (k) => KU.battery(k) + KU.inverter(k), label: ['INVERTER, DC TO AC', 'ONDULEUR, CC VERS CA'], notes: [
      { x: 146, y: 356, a: 'end', en: 'AC OUT', fr: 'SORTIE CA', to: [239, 211] },
      { x: 446, y: 430, en: 'DC IN', fr: 'CC ENTRANT', to: [252, 244] }] }),
  },
  {
    id: 'SOL-081', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Dual-bus wiring (DC essentials + AC general)', fr: 'Câblage double bus (essentiels CC + réseau CA)', ...UZ,
    // The essentials take DC straight off the battery; only the rest goes through the inverter.
    site: () => KU.battery(6) + KU.inverter(6) + KU.panels(),
    draw: (t) => annotated(t, { obj: (k) => KU.battery(k) + KU.inverter(k) + KU.panels(), label: ['DUAL-BUS WIRING', 'CÂBLAGE DOUBLE BUS', 222, 182], notes: [
      { x: 142, y: 214, a: 'end', en: 'AC: THE REST', fr: 'CA : LE RESTE', to: [222, 211], site: true },
      { x: 142, y: 232, a: 'end', en: 'DC: ESSENTIALS', fr: 'CC : L’ESSENTIEL', to: [222, 229], site: true },
      ] }),
  },
  {
    id: 'SOL-193', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Solar power diverter / router (surplus-PV to resistive load)', fr: 'Routeur ou délesteur solaire (surplus PV vers charge résistive)', ...UZ,
    // It needs the resistive load it feeds, so it draws the electric tank it heats.
    site: () => KU.diverter(6),
    draw: (t) => annotated(t, { obj: KU.diverter, label: ['SOLAR DIVERTER', 'ROUTEUR SOLAIRE', 222, 182], notes: [
      { x: 224, y: 214, en: 'SURPLUS SOLAR IN', fr: 'SURPLUS SOLAIRE' },
      { x: 222, y: 292, en: 'INTO THE ELEMENT', fr: 'DANS LA RÉSISTANCE', to: [200, 285], from: [218, 288], site: true }] }),
  },
  {
    id: 'SOL-190', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Direct solar power (battery-free direct-PV supply)', fr: 'Alimentation solaire directe (PV sans batterie)', ...UZ,
    // Pumping is the catalogue's first "deferrable load": the pump runs off the panels while the
    // sun is up and fills a high tank, so the storage is water, not a battery.
    site: () => KU.pumpSet(6) + KU.pvFeed(6),
    draw: (t) => annotated(t, { obj: (k) => KU.pumpSet(k) + KU.pvFeed(k), label: ['DIRECT SOLAR PUMPING', 'POMPAGE SOLAIRE DIRECT', 340, 196, 'end'], notes: [
      { x: 446, y: 196, en: 'FROM THE PANELS', fr: 'DEPUIS LES PANNEAUX', to: [345, 193], from: [442, 193], site: true },
      ] }),
  },
  {
    id: 'SOL-058', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Pressurised pump distribution', fr: 'Distribution par pompe sous pression', ...UZ,
    // Up here, it lifts from the tank below by suction -- practical to about 7 m.
    site: () => KU.pumpSet(6),
    draw: (t) => annotated(t, { obj: KU.pumpSet, label: ['PRESSURE PUMP', 'SURPRESSEUR', 340, 196, 'end'], notes: [
      { x: 446, y: 206, en: 'TO THE TAPS', fr: 'VERS LES ROBINETS', to: [388, 206], from: [442, 203], site: true },
      { x: 446, y: 226, en: 'PRESSURE VESSEL', fr: 'BALLON DE PRESSION', to: [370, 224], from: [442, 223], site: true },
      { x: 296, y: 326, a: 'end', en: 'FROM THE TANK', fr: 'DEPUIS LA CUVE', to: [319, 308], from: [299, 320], site: true }] }),
  },
  {
    id: 'SOL-051', fnEn: 'Acoustic comfort', fnFr: 'Confort acoustique', en: 'Vibration-isolated mounting for pumps and fans', fr: 'Montage antivibratoire des pompes et ventilateurs', zone: [140, 180, 252, 126], crop: [180, 190, 220, 270],
    site: () => KU.pumpSet(6) + KU.pads(),
    draw: (t) => closeUp(t, { at: UB, focus: [339, 238], ring: 16, obj: (k) => KU.pumpSet(k) + KU.pads(), label: ['ANTI-VIBRATION MOUNTS', 'SUPPORTS ANTIVIBRATOIRES'], notes: [
      { x: 146, y: 392, a: 'end', en: 'RUBBER MOUNTS', fr: 'PLOTS SOUPLES', to: [332, 240] },
      ] }),
  },
  {
    id: 'SOL-063', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Manual isolation valves at key points', fr: 'Vannes d’isolement manuelles aux points clés', zone: [140, 180, 252, 126], crop: [180, 190, 220, 270],
    // One each side of the pump, so it comes out without draining the house.
    site: () => KU.pumpSet(6) + KU.valves(),
    draw: (t) => closeUp(t, { at: UB, focus: [338, 214], ring: 18, obj: (k) => KU.pumpSet(k) + KU.valves(), label: ['ISOLATION VALVES', 'VANNES D’ISOLEMENT'], notes: [
      { x: 146, y: 262, a: 'end', en: 'ONE EACH SIDE', fr: 'UNE DE CHAQUE CÔTÉ', to: [314, 262], site: true },
      { x: 446, y: 340, en: 'QUARTER-TURN VALVE', fr: 'VANNE QUART DE TOUR', to: [340, 198] },
      ] }),
  },
  {
    id: 'SOL-150', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Automatic smart leak-detection shut-off valve', fr: 'Vanne d’arrêt automatique à détection de fuite intelligente', zone: [140, 180, 252, 126], crop: [180, 190, 220, 270],
    site: () => KU.pumpSet(6) + KU.smart(),
    draw: (t) => closeUp(t, { at: UB, focus: [378, 202], ring: 16, obj: (k) => KU.pumpSet(k) + KU.smart(), label: ['LEAK SHUT-OFF VALVE', 'VANNE DE COUPURE SUR FUITE'], notes: [
      { x: 446, y: 360, en: 'MOTORISED VALVE', fr: 'VANNE MOTORISÉE', to: [382, 196] }] }),
  },
  {
    id: 'SOL-221', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Electric motor (mains or battery driven)', fr: 'Moteur électrique (secteur ou batterie)', zone: [140, 180, 252, 126], crop: [180, 190, 220, 270],
    // "Electricity in, a spinning shaft out": drawn as the one this house certainly has, the pump's.
    site: () => KU.pumpSet(6) + KU.motorLit(),
    draw: (t) => closeUp(t, { at: UB, focus: [340, 232], ring: 16, obj: (k) => KU.pumpSet(k) + KU.motorLit(), label: ['ELECTRIC MOTOR', 'MOTEUR ÉLECTRIQUE'], notes: [
      { x: 146, y: 384, a: 'end', en: 'SHAFT OUT', fr: 'ARBRE MOTEUR', to: [330, 232] },
      { x: 446, y: 350, en: 'ELECTRICITY IN', fr: 'ÉLECTRICITÉ', to: [342, 218] },
      { x: 446, y: 404, en: 'WINDINGS', fr: 'BOBINAGE', to: [344, 234] }] }),
  },
  {
    id: 'SOL-135', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Pedal / hand-crank generator', fr: 'Générateur à pédale ou à manivelle', ...UZ,
    // Beside the battery it charges. A fit adult sustains about 75 W: a few lights and a radio.
    site: () => KU.pedal(6),
    draw: (t) => annotated(t, { obj: KU.pedal, label: ['PEDAL GENERATOR', 'GÉNÉRATEUR À PÉDALE', 268, 242], notes: [
      { x: 446, y: 256, en: 'ROLLER ON THE TYRE', fr: 'GALET SUR LE PNEU', to: [312, 267], from: [442, 253], site: true },
      ] }),
  },
  {
    id: 'SOL-094', fnEn: 'Personal hygiene & sanitation', fnFr: 'Hygiène personnelle et sanitaires', en: 'Electric washing machine', fr: 'Machine à laver électrique', ...UZ,
    site: () => KU.laundry('electric')(),
    draw: (t) => annotated(t, { obj: KU.laundry('electric'), label: ['WASHING MACHINE', 'MACHINE À LAVER', 372, 246, 'end'], notes: [] }),
  },
  {
    id: 'SOL-093', fnEn: 'Personal hygiene & sanitation', fnFr: 'Hygiène personnelle et sanitaires', en: 'Pedal-powered washing machine', fr: 'Machine à laver à pédale', ...UZ,
    site: () => KU.laundry('pedal')(),
    draw: (t) => annotated(t, { obj: KU.laundry('pedal'), label: ['PEDAL WASHING MACHINE', 'MACHINE À LAVER À PÉDALE', 372, 246, 'end'], notes: [
      { x: 446, y: 290, en: 'DRUM, BELT-DRIVEN', fr: 'TAMBOUR À COURROIE', to: [370, 282], from: [442, 287], site: true }] }),
  },
  {
    id: 'SOL-181', fnEn: 'Personal hygiene & sanitation', fnFr: 'Hygiène personnelle et sanitaires', en: 'Hand-agitated bucket washing machine (manual plunger type)', fr: 'Machine à laver manuelle à seaux (type piston)', ...UZ,
    site: () => KU.laundry('bucket')(),
    draw: (t) => annotated(t, { obj: KU.laundry('bucket'), label: ['BUCKET WASHER', 'LAVEUSE À SEAUX', 372, 246, 'end'], notes: [
      { x: 446, y: 262, en: 'PLUNGER', fr: 'PISTON', to: [354, 283], from: [442, 259], site: true },
      { x: 446, y: 286, en: 'PERFORATED INNER BUCKET', fr: 'SEAU INTÉRIEUR PERCÉ', to: [358, 288], from: [442, 283], site: true }] }),
  },
  {
    id: 'SOL-128', fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation', en: 'Decentralised single-room heat-recovery ventilators', fr: 'VMC double flux décentralisée par pièce', zone: [130, 262, 60, 44], crop: [120, 230, 240, 110],
    // One fan, one ceramic core, through the wall: it blows out for about a minute, warming the
    // core, then reverses and draws fresh air in through the warm core.
    site: () => KU.hrv(6),
    draw: (t) => annotated(t, { obj: KU.hrv, label: ['SINGLE-ROOM HEAT RECOVERY', 'DOUBLE FLUX PAR PIÈCE', 180, 256], notes: [
      { x: 180, y: 272, en: 'CERAMIC CORE', fr: 'NOYAU CÉRAMIQUE', to: [160, 279], from: [178, 269], site: true }] }),
  },
  {
    id: 'SOL-040', fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation', en: 'Mechanical ventilation with heat recovery (MVHR)', fr: 'Ventilation mécanique double flux', zone: [196, 110, 132, 96], crop: [140, 80, 260, 170],
    // Two air streams through one core: heat crosses the plates, the air does not.
    site: () => KU.mvhr(6),
    draw: (t) => annotated(t, { obj: KU.mvhr, label: ['HEAT-RECOVERY VENTILATION', 'VENTILATION DOUBLE FLUX', 230, 96, 'end'], notes: [
      { x: 234, y: 108, a: 'end', en: 'STALE AIR OUT', fr: 'AIR VICIÉ', to: [285, 104], from: [237, 105], site: true },
      { x: 234, y: 136, a: 'end', en: 'FRESH AIR IN', fr: 'AIR NEUF', to: [239, 134], from: [237, 133], site: true },
      { x: 266, y: 214, a: 'end', en: 'TO THE ROOMS', fr: 'AUX PIÈCES', to: [270, 203], from: [267, 207], site: true },
      { x: 288, y: 214, en: 'FROM WET ROOMS', fr: 'DES PIÈCES D’EAU', to: [284, 201], from: [287, 207], site: true },
      ] }),
  },
  /* ---- sixth batch, 2026-09-11: the north yard. Ten plates, 13 solutions. */
  {
    id: 'SOL-109', members: ['SOL-074', 'SOL-164'], fnEn: 'Solid waste management', fnFr: 'Gestion des déchets solides', en: 'Active compost pile', fr: 'Compost actif en tas', ...YZ,
    // Two bays: the hot pile, held above 55 C for days so pathogens die, and the curing bay
    // beside it where the batch rests a year or two -- apart from the kitchen compost.
    site: () => KY.bays(),
    draw: (t) => closeUp(t, { focus: [196, 106], ring: 26, obj: KY.bays, labelAt: [300, 294, 'middle'], label: ['COMPOST BAYS', 'BACS À COMPOST'], notes: [
      { x: 446, y: 204, en: 'HOT BAY', fr: 'BAC CHAUD' },
      { x: 446, y: 218, en: 'THERMOMETER', fr: 'THERMOMÈTRE', to: [206, 104] },
      { x: 446, y: 232, en: 'CURING BAY', fr: 'MATURATION', to: [186, 108] }] }),
  },
  {
    id: 'SOL-060', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Compost-coil water pre-heater', fr: 'Préchauffeur d’eau par serpentin dans le compost', ...YZ,
    // The coil sits in the HOT bay; cold in low, warm out high, so it can thermosiphon.
    site: () => KY.coil(6),
    draw: (t) => closeUp(t, { focus: [208, 108], ring: 22, obj: KY.coil, labelAt: [300, 294, 'middle'], label: ['COMPOST-COIL PRE-HEATER', 'PRÉCHAUFFAGE PAR LE COMPOST'], notes: [
      { x: 446, y: 204, en: 'COIL IN THE HOT PILE', fr: 'SERPENTIN DANS LE TAS CHAUD', to: [206, 111] },
      { x: 446, y: 218, en: 'COLD IN, LOW', fr: 'EAU FROIDE, EN BAS', to: [218, 113] },
      { x: 446, y: 232, en: 'TO THE WATER HEATER', fr: 'VERS LE CHAUFFE-EAU', to: [222, 108] }] }),
  },
  {
    id: 'SOL-182', fnEn: 'Solid waste management', fnFr: 'Gestion des déchets solides', en: 'Vermicomposting (worm bin)', fr: 'Lombricompostage (bac à vers)', zone: [96, 396, 60, 56], crop: [80, 300, 280, 180],
    // Against the north wall: shaded in summer, sheltered in winter -- worms want room temperature.
    site: () => KY.worms(6),
    draw: (t) => closeUp(t, { at: UB, focus: [130, 424], ring: 26, obj: KY.worms, label: ['WORM BIN', 'LOMBRICOMPOSTEUR'], notes: [
      { x: 146, y: 330, a: 'end', en: 'TOP TRAY', fr: 'PLATEAU DU HAUT', to: [130, 410] },
      { x: 446, y: 404, en: 'WORM TEA', fr: 'THÉ DE VERS', to: [148, 440] }] }),
  },
  {
    id: 'SOL-139', fnEn: 'Solid waste management', fnFr: 'Gestion des déchets solides', en: 'Biochar production (pyrolysis of woody waste)', fr: 'Production de biochar (pyrolyse de déchets ligneux)', ...YZ,
    // The Low-tech Lab's pit method, which set this row's build skill: fired, then capped.
    site: () => KY.pit(),
    draw: (t) => closeUp(t, { focus: [121, 118], ring: 16, obj: KY.pit, labelAt: [300, 294, 'middle'], label: ['BIOCHAR PIT', 'FOSSE À BIOCHAR'], notes: [
      { x: 446, y: 204, en: 'EARTH CAP', fr: 'COUVERCLE DE TERRE', to: [124, 112] },
      { x: 446, y: 232, en: 'CHARCOAL', fr: 'CHARBON', to: [122, 121] }] }),
  },
  {
    id: 'SOL-083', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Backup generator', fr: 'Groupe électrogène de secours', ...YZ,
    // Out in the yard: it is loud and its exhaust is poison. Bought fuel, not wood.
    site: () => KY.engine('generator')(6),
    draw: (t) => closeUp(t, { focus: [98, 108], ring: 16, obj: KY.engine('generator'), labelAt: [300, 294, 'middle'], label: ['BACKUP GENERATOR', 'GROUPE ÉLECTROGÈNE'], notes: [
      { x: 446, y: 204, en: 'ENGINE AND ALTERNATOR', fr: 'MOTEUR ET ALTERNATEUR', to: [97, 110] },
      { x: 446, y: 218, en: 'EXHAUST', fr: 'ÉCHAPPEMENT', to: [88, 98] }] }),
  },
  {
    id: 'SOL-222', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Small petrol or diesel engine (direct drive)', fr: 'Petit moteur thermique (entraînement direct)', ...YZ,
    site: () => KY.engine('drive')(6),
    draw: (t) => closeUp(t, { focus: [98, 108], ring: 16, obj: KY.engine('drive'), labelAt: [300, 294, 'middle'], label: ['ENGINE, DIRECT DRIVE', 'MOTEUR, ENTRAÎNEMENT DIRECT'], notes: [
      { x: 446, y: 204, en: 'SHAFT TO A PUMP', fr: 'ARBRE VERS UNE POMPE', to: [106, 111] },
      ] }),
  },
  {
    id: 'SOL-156', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Bulk propane or heating-oil storage tank', fr: 'Cuve de stockage de propane ou de fioul', ...YZ,
    // At the far end of the yard: a tanker fills it, and a bulk tank keeps its distance.
    site: () => KY.tank('propane')(6),
    draw: (t) => closeUp(t, { focus: [62, 106], ring: 24, obj: KY.tank('propane'), labelAt: [300, 294, 'middle'], label: ['PROPANE OR OIL TANK', 'CUVE DE PROPANE OU DE FIOUL'], notes: [
      { x: 446, y: 204, en: 'FILLED BY TANKER', fr: 'REMPLIE PAR CAMION-CITERNE', to: [60, 98] },
      { x: 446, y: 218, en: 'BURIED LINE TO THE HOUSE', fr: 'CONDUITE ENTERRÉE VERS LA MAISON', to: [84, 120] }] }),
  },
  {
    id: 'SOL-192', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Small-scale compressed-air energy storage (CAES)', fr: 'Stockage d’énergie par air comprimé à petite échelle (CAES)', ...YZ,
    // Surplus electricity pumps air into the vessel; later the air drives a motor-generator.
    site: () => KY.tank('air')(6),
    draw: (t) => closeUp(t, { focus: [62, 104], ring: 24, obj: KY.tank('air'), labelAt: [300, 294, 'middle'], label: ['COMPRESSED-AIR STORE', 'STOCKAGE À AIR COMPRIMÉ'], notes: [
      { x: 446, y: 204, en: 'COMPRESSOR, AIR MOTOR', fr: 'COMPRESSEUR, MOTEUR À AIR', to: [50, 96] },
      { x: 446, y: 218, en: 'PRESSURE VESSEL', fr: 'RÉSERVOIR SOUS PRESSION', to: [70, 106] }] }),
  },
  {
    id: 'SOL-162', members: ['SOL-161'], fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments',
    en: 'Household anaerobic biodigester (biogas cooking fuel)', fr: 'Biodigesteur domestique anaérobie (biogaz de cuisson)', ...YZ,
    // Half buried, for the ground's warmth: digestion slows sharply when it is cold, the
    // catalogue's Normandy caveat. Gas off the dome to the hob; digestate out the far side.
    site: () => KY.digester(6),
    draw: (t) => closeUp(t, { focus: [153, 116], ring: 24, obj: KY.digester, labelAt: [300, 294, 'middle'], label: ['BIODIGESTER', 'BIODIGESTEUR'], notes: [
      { x: 204, y: 150, a: 'end', en: 'SCRAPS IN', fr: 'DÉCHETS', to: [135, 104] },
      { x: 446, y: 204, en: 'BIOGAS', fr: 'BIOGAZ', to: [180, 90] },
      { x: 446, y: 218, en: 'DIGESTATE', fr: 'DIGESTAT', to: [171, 114] }] }),
  },
  {
    id: 'SOL-183', fnEn: 'Light', fnFr: 'Lumière', en: 'Motorized heliostat mirror (north-facing daylighting)', fr: 'Miroir héliostat motorisé (éclairage nord)', zone: [26, 140, 150, 220], crop: [26, 140, 200, 220],
    // 4 m up, the sun clears the ridge above about 20 degrees: in deep winter (18.5 at noon, 48 N)
    // the roof shades it. The gain claim is the source's, not verified -- the plate claims less.
    site: () => KY.helio(6),
    draw: (t) => annotated(t, { obj: KY.helio, label: ['HELIOSTAT', 'HÉLIOSTAT', 30, 118, 'start'], notes: [
      { x: 30, y: 132, en: 'TRACKS THE SUN', fr: 'SUIT LE SOLEIL' },
      { x: 120, y: 110, en: 'SUN OVER THE ROOF', fr: 'SOLEIL AU-DESSUS DU TOIT' },
      { x: 180, y: 240, en: 'INTO THE NORTH WINDOW', fr: 'DANS LA FENÊTRE NORD', to: [118, 293], from: [178, 243], site: true }] }),
  },
  /* ---- seventh batch, 2026-09-12: the south face. Seventeen plates, 24 solutions. */
  {
    id: 'SOL-023', members: ['SOL-024'], fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Triple-glazed, low-E windows', fr: 'Fenêtres triple vitrage à faible émissivité', ...SZ,
    // Two panes or three differ by one line at this scale, so they are one drawing: what makes
    // either of them work is the COATING and the frame, and those are what the bubble shows.
    site: () => KS.panes(3)(),
    draw: (t) => closeUp(t, { focus: [681, 373], ring: 24, obj: KS.panes(3), label: ['TRIPLE GLAZING', 'TRIPLE VITRAGE'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'THREE PANES, TWO GAPS', fr: 'TROIS VERRES, DEUX LAMES', to: [681, 360] },
      ] }),
  },
  {
    id: 'SOL-159', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Electrochromic (smart) glazing', fr: 'Vitrage électrochrome (intelligent)', ...SZ,
    // What changes here is not the glass but what the glass is told: the tint is switched
    // rather than chosen once at installation, which is the whole of its case against a fixed
    // coating -- and the reason it is the one glazing that needs a wire.
    site: () => KS.electro(),
    draw: (t) => closeUp(t, { focus: [681, 373], ring: 24, obj: KS.electro, label: ['SWITCHABLE TINT', 'TEINTE COMMUTABLE'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'COATING BETWEEN THE PANES', fr: 'COUCHE ENTRE LES VERRES', to: [681, 358] },
      { x: 446, y: 218, en: 'LOW-VOLTAGE PAIR', fr: 'PAIRE BASSE TENSION' },
      ] }),
  },
  {
    id: 'SOL-025', members: ['SOL-046'], fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'South-facing glazing sized for winter gain', fr: 'Surface vitrée sud dimensionnée pour l’apport d’hiver', zone: [500, 320, 230, 120], crop: [480, 300, 300, 150],
    // The december ray at 48 N is 18.5 degrees, the angle the overhang plate is drawn at: it
    // comes in low, crosses the room and lands on the mass floor. Daylight follows the same
    // opening -- about two and a half times the head height into the room -- which is why
    // sizing for gain and sizing by daylight factor are one drawing.
    site: () => KS.sized(6),
    draw: (t) => annotated(t, { obj: KS.sized, label: ['GLAZING SIZED FOR WINTER SUN', 'VITRAGE DIMENSIONNÉ POUR L’HIVER', 664, 204, 'end', [672, 337]], notes: [
      { x: 664, y: 218, a: 'end', en: '21 DEC, 18.5° AT 48° N', fr: '21 DÉC, 18,5° À 48° N' },
      { x: 592, y: 430, a: 'middle', en: 'DAYLIGHT REACHES HERE', fr: 'LE JOUR VA JUSQUE-LÀ' }] }),
  },
  {
    id: 'SOL-124', members: ['SOL-011'], fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Insulated operable shutters', fr: 'Volets isolants manœuvrables', ...SZ,
    // Shut at night, when the glass is losing and the sun is not arriving; open by day. The
    // same panel with a lock is the security row, which is the catalogue's own point: a shutter
    // is storm protection, night insulation and summer shade, and nobody buys three of them.
    site: () => KS.shutter('pad')(6),
    draw: (t) => closeUp(t, { focus: [700, 373], ring: 30, obj: KS.shutter('pad'), label: ['INSULATED SHUTTER', 'VOLET ISOLANT'], labelAt: [300, 294, 'middle'], notes: [] }),
  },
  {
    id: 'SOL-186', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Insulated draft-blocking curtains', fr: 'Rideaux isolants coupe-froid', ...SZ,
    // The soft version of the shutter: an outer fabric and an inner reflective layer, sealed to
    // the frame all round. The SEAL is what separates it from an ordinary curtain -- air moving
    // behind the cloth carries away most of what the cloth was for.
    site: () => KS.curtain(),
    draw: (t) => closeUp(t, { focus: [657, 376], ring: 28, obj: KS.curtain, label: ['INSULATED CURTAIN', 'RIDEAU ISOLANT'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'CLOTH, THEN REFLECTIVE', fr: 'TISSU, PUIS RÉFLÉCHISSANT', to: [657, 350] },
      ] }),
  },
  {
    id: 'SOL-198', fnEn: 'Light', fnFr: 'Lumière', en: 'Interior adjustable louvre blind (glare control)', fr: 'Store à lamelles orientables intérieur (anti-éblouissement)', ...SZ,
    // GLARE, NOT HEAT, and the distinction is drawn rather than written: the ray is already
    // through the pane when a slat stops it, so the heat is inside the room either way.
    site: () => KS.blind(6),
    draw: (t) => closeUp(t, { focus: [667, 373], ring: 26, obj: KS.blind, label: ['LOUVRE BLIND', 'STORE À LAMELLES'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'SLATS', fr: 'LAMELLES', to: [667, 358] },
      ] }),
  },
  {
    id: 'SOL-174', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'DIY shade-sail window screen', fr: 'Voile d’ombrage maison pour fenêtre', zone: [660, 280, 120, 110], crop: [650, 270, 180, 150],
    // OUTSIDE the glass, which is where shade has to be to keep the heat out at all, and on
    // hooks, which is how it comes down in September. Sewing, no structural fixing.
    site: () => KS.sail(6),
    draw: (t) => annotated(t, { obj: KS.sail, label: ['SHADE SAIL', 'VOILE D’OMBRAGE', 446, 204], notes: [
      { x: 446, y: 246, en: 'ON HOOKS', fr: 'SUR CROCHETS', to: [714, 330], from: 'end', site: true }] }),
  },
  {
    id: 'SOL-125', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Water-based thermal mass (drum / water wall)', fr: 'Inertie thermique par l’eau (fûts, mur d’eau)', zone: [600, 320, 130, 130], crop: [590, 300, 200, 170],
    // Water holds about twice as much heat per litre as masonry, which is why a drum standing
    // in the sun does the work of a much thicker wall. It is also the only thermal mass that
    // can leak, so the drawing shows a closed drum rather than an open tank.
    site: () => KS.waterWall(6),
    draw: (t) => annotated(t, { obj: KS.waterWall, label: ['WATER WALL', 'MUR D’EAU', 446, 204], notes: [
      { x: 446, y: 260, en: 'SEALED', fr: 'FERMÉ', to: [651, 366], from: 'end', site: true }] }),
  },
  {
    id: 'SOL-076', fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Solar PV array', fr: 'Champ photovoltaïque', ...RZ,
    // On the south slope, on rails, its cable down into the house. What it makes is DC; what
    // happens to it after that is the utility room's four plates (battery, inverter, dual bus,
    // diverter), which is why this plate stops at the wall.
    site: () => KS.pv(6),
    draw: (t) => annotated(t, { obj: KS.pv, label: ['PV ARRAY', 'CHAMP PHOTOVOLTAÏQUE', 446, 204, 'start', [538, 136]], notes: [
      { x: 446, y: 218, en: 'MODULES ON RAILS', fr: 'MODULES SUR RAILS', to: [608, 158], from: [598, 214], site: true },
      ] }),
  },
  {
    id: 'SOL-129', fnEn: 'Light', fnFr: 'Lumière', en: 'Solar / light tubes', fr: 'Conduits de lumière', zone: [460, 100, 90, 120], crop: [440, 84, 160, 160],
    // A dome, a mirrored tube, a diffuser: daylight for a room with no outside wall to put a
    // window in -- which in this house is the middle of the upper floor, under the ridge.
    site: () => KS.lightTube(6),
    draw: (t) => annotated(t, { obj: KS.lightTube, label: ['LIGHT TUBE', 'CONDUIT DE LUMIÈRE', 446, 226], notes: [
      { x: 446, y: 240, en: 'DOME ON THE SLOPE', fr: 'DÔME EN TOITURE', to: [495, 112], from: [590, 236], site: true },
      ] }),
  },
  {
    id: 'SOL-205', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Night-sky radiative cooling', fr: 'Rafraîchissement radiatif nocturne', ...RZ,
    // The panel radiates to the open sky after dark and can fall BELOW the air around it, so
    // water pumped past it comes back cooler than the night. Cloud sends the radiation back,
    // which is the caveat the catalogue leads with and the plate says out loud.
    site: () => KS.nightSky(6),
    draw: (t) => annotated(t, { obj: KS.nightSky, label: ['NIGHT-SKY COOLING', 'RAFRAÎCHISSEMENT NOCTURNE', 446, 240], notes: [] }),
  },
  {
    id: 'SOL-101', fnEn: 'Building durability & maintainability', fnFr: 'Durabilité et facilité d’entretien du bâtiment', en: 'Generous roof overhangs', fr: 'Larges débords de toit', zone: [690, 170, 120, 140], crop: [670, 160, 170, 170],
    // Rain control, not shading: driven rain is kept off the WALL, which is the cheapest way to
    // make a wall last. The overhang that shades the window is a different plate (SOL-026) at a
    // different height, and they are drawn apart so the two jobs stay apart.
    site: () => KS.overhang(6),
    draw: (t) => annotated(t, { obj: KS.overhang, label: ['GENEROUS OVERHANG', 'LARGE DÉBORD', 446, 204], notes: [
      { x: 446, y: 218, en: 'DRIVEN RAIN KEPT OFF', fr: 'LA PLUIE BATTANTE ÉCARTÉE', to: [755, 240], from: 'end', site: true },
      ] }),
  },
  {
    id: 'SOL-048', fnEn: 'Light', fnFr: 'Lumière', en: 'Clerestory windows / light shelves', fr: 'Fenêtres hautes et tablettes réfléchissantes', zone: [470, 180, 230, 120], crop: [460, 170, 250, 150],
    // The shelf is the whole idea: light that would have landed on the floor by the window is
    // thrown at the ceiling instead, and the ceiling carries it deep into the room. High up, so
    // it adds no sun in anybody's eyes.
    site: () => KS.clerestory(6),
    draw: (t) => annotated(t, { obj: KS.clerestory, label: ['CLERESTORY AND LIGHT SHELF', 'FENÊTRE HAUTE ET TABLETTE', 648, 297, 'end'], notes: [] }),
  },
  {
    id: 'SOL-119', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité', en: 'Motion-activated exterior lighting', fr: 'Éclairage extérieur à détection de mouvement', zone: [686, 226, 80, 86], crop: [660, 215, 150, 120],
    // Lit when somebody comes and dark the rest of the night, which is both the deterrent and
    // the entire energy argument. Drawn with the cone it actually watches.
    site: () => KS.motionLight(),
    draw: (t) => annotated(t, { obj: KS.motionLight, label: ['MOTION-SWITCHED LIGHT', 'ÉCLAIRAGE À DÉTECTION', 446, 204], notes: [
      { x: 446, y: 218, en: 'LIT WHEN SOMEBODY COMES', fr: 'ALLUMÉ QUAND QUELQU’UN VIENT', to: [696, 243], from: 'end', site: true },
      ] }),
  },
  {
    id: 'SOL-189', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Slate-clad solar air heater (wall-mounted thermosiphon collector)', fr: 'Capteur à air solaire en ardoise (thermosiphon mural)', zone: [660, 226, 120, 100], crop: [650, 215, 170, 130],
    // Room air in at the bottom, out at the top, moved by nothing but its own lift once the
    // slate behind the glass is warm. No fan and no electricity, which is what separates it
    // from every other wall-mounted collector.
    site: () => KS.airHeater(6),
    draw: (t) => annotated(t, { obj: KS.airHeater, label: ['SOLAR AIR HEATER', 'CAPTEUR À AIR SOLAIRE', 446, 204], notes: [
      { x: 446, y: 218, en: 'DARK SLATE BEHIND GLASS', fr: 'ARDOISE NOIRE SOUS VERRE', to: [699, 274], from: 'end', site: true },
      ] }),
  },
  {
    id: 'SOL-099', fnEn: 'Space & occupancy', fnFr: 'Espace et occupation', en: 'South-facing covered porch/terrace', fr: 'Terrasse couverte exposée au sud', zone: [686, 290, 120, 160], crop: [670, 280, 160, 180],
    // A roof on posts: the cheapest square metres a house gains, and a summer shade for the
    // wall and the lower window into the bargain. The winter sun still comes in under it,
    // which is the test of where its edge goes.
    site: () => KS.porch(6),
    draw: (t) => annotated(t, { obj: KS.porch, label: ['COVERED PORCH', 'TERRASSE COUVERTE', 664, 236, 'end', [689, 298]], notes: [] }),
  },
  {
    id: 'SOL-232', fnEn: 'Space & occupancy', fnFr: 'Espace et occupation', en: 'Shared solar terrace', fr: 'Terrasse solaire partagée', zone: [686, 320, 130, 130], crop: [670, 300, 170, 160],
    // Solar cooking needs somewhere unshaded to leave something standing for hours, and a flat
    // roof or a shared terrace is where a household without a garden finds it. What the plate
    // draws is the ARRANGEMENT -- the place and its equipment -- not any one cooker.
    site: () => KS.terrace(6),
    draw: (t) => annotated(t, { obj: KS.terrace, label: ['SHARED TERRACE', 'TERRASSE PARTAGÉE', 664, 250, 'end', [743, 322]], notes: [] }),
  },
  /* ---- eighth batch, 2026-09-12: the south yard. Nine plates, nine solutions, all buildable. */
  {
    id: 'SOL-028', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Deciduous vegetation shading', fr: 'Ombrage par végétation caduque', ...PZ,
    // The one shading device that knows what month it is: in leaf when the sun is high and
    // unwanted, bare when it is low and wanted. The plate draws the winter ray going THROUGH
    // the canopy to the window, which is the whole of the argument for a deciduous tree.
    site: () => KP.tree(6),
    draw: (t) => annotated(t, { obj: KP.tree, label: ['DECIDUOUS SHADE', 'OMBRAGE CADUC', 810, 226, 'end', [788, 296]], notes: [] }),
  },
  {
    id: 'SOL-055', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Elevated cistern/tank storage', fr: 'Réservoir surélevé', ...PZ,
    // Everything below the water line runs without a pump; filling it is the half that is not
    // passive, unless what feeds it is higher still. The head is dimensioned because that is
    // the number the whole solution turns on.
    site: () => KP.cistern(6),
    draw: (t) => annotated(t, { obj: KP.cistern, label: ['ELEVATED CISTERN', 'RÉSERVOIR SURÉLEVÉ', 560, 60], notes: [
      { x: 560, y: 74, en: 'ABOVE EVERY TAP IT FEEDS', fr: 'PLUS HAUT QUE LES ROBINETS', to: [778, 358], from: 'end', site: true },
      ] }),
  },
  {
    id: 'SOL-090', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments', en: 'Solar cooker', fr: 'Cuiseur solaire', ...PB,
    // A glazed box and a reflector that throws a second helping of sun in. No fuel at all, and
    // no cooking on a grey day: the catalogue's own caveat, drawn as the sun it depends on.
    site: () => KP.cooker(6),
    draw: (t) => closeUp(t, { focus: [776, 412], ring: 30, obj: KP.cooker, label: ['SOLAR COOKER', 'CUISEUR SOLAIRE'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'GLAZED BOX, DARK INSIDE', fr: 'CAISSON VITRÉ, NOIR DEDANS', to: [790, 420] },
      ] }),
  },
  {
    id: 'SOL-166', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments', en: 'Solar dryer (dehydration)', fr: 'Séchoir solaire (déshydratation)', ...PB,
    // A dryer is not a cooker with trays: it has to BREATHE. Air in low, out high, carrying the
    // water away -- a sealed box would simply cook the fruit in its own moisture.
    site: () => KP.dryer(6),
    draw: (t) => closeUp(t, { focus: [776, 412], ring: 30, obj: KP.dryer, label: ['SOLAR DRYER', 'SÉCHOIR SOLAIRE'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'TRAYS IN A GLAZED BOX', fr: 'CLAIES DANS UN CAISSON VITRÉ', to: [776, 414] },
      ] }),
  },
  {
    id: 'SOL-219', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Solar still (solar distillation)', fr: 'Distillateur solaire', ...PB,
    // DISTILLATION, not filtration: what leaves the basin is vapour, so what reaches the channel
    // is very nearly pure water -- and it is slow, which is the other half of the truth.
    site: () => KP.still(6),
    draw: (t) => closeUp(t, { focus: [776, 416], ring: 30, obj: KP.still, label: ['SOLAR STILL', 'DISTILLATEUR SOLAIRE'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'BLACK BASIN UNDER SLOPING GLASS', fr: 'BAC NOIR SOUS VERRE INCLINÉ', to: [776, 428] },
      { x: 446, y: 232, en: 'CONDENSATE CHANNEL', fr: 'GOUTTIÈRE', to: [748, 427] }] }),
  },
  {
    id: 'SOL-191', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments', en: 'Solar-powered insulated electric oven', fr: 'Four électrique isolé alimenté par le solaire', ...PB,
    // Not a solar box at all: an insulated mass with an element in it, run off the array. It
    // converts sunlight to heat and KEEPS it, so supper does not depend on the sun still being
    // out -- which is the one thing the reflective cooker cannot do.
    site: () => KP.oven(6),
    draw: (t) => closeUp(t, { focus: [776, 414], ring: 30, obj: KP.oven, label: ['INSULATED ELECTRIC OVEN', 'FOUR ÉLECTRIQUE ISOLÉ'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'HEAVY INSULATION', fr: 'FORTE ISOLATION', to: [756, 416] },
      ] }),
  },
  {
    id: 'SOL-136', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments', en: 'Rocket stove cooker', fr: 'Réchaud rocket', ...PB,
    // Sized for a pot, not for a room -- the distinction from the rocket mass heater indoors.
    // A stick goes in at the side, the air goes under it, and the elbow does the rest.
    site: () => KP.rocket(6),
    draw: (t) => closeUp(t, { focus: [778, 416], ring: 26, obj: KP.rocket, label: ['ROCKET STOVE COOKER', 'RÉCHAUD ROCKET'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'A STICK IN AT THE SIDE', fr: 'UN BÂTON SUR LE CÔTÉ', to: [760, 428] },
      ] }),
  },
  {
    id: 'SOL-180', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments', en: 'Micro-gasifier (TLUD) cookstove', fr: 'Réchaud micro-gazéifieur (TLUD)', ...PB,
    // Top-lit, which is the whole trick: the charge below pyrolyses, the gas rises, and a ring
    // of holes feeds it the air it needs to burn cleanly at the rim. Char is left over, and the
    // biochar pit in the north yard is where that goes.
    site: () => KP.tlud(6),
    draw: (t) => closeUp(t, { focus: [780, 412], ring: 26, obj: KP.tlud, label: ['TLUD GASIFIER STOVE', 'RÉCHAUD TLUD'], labelAt: [300, 294, 'middle'], notes: [
      { x: 446, y: 204, en: 'LIT ON TOP', fr: 'ALLUMÉ PAR LE HAUT', to: [780, 404] },
      ] }),
  },
  {
    id: 'SOL-215', fnEn: 'Personal hygiene & sanitation', fnFr: 'Hygiène personnelle et sanitaires', en: 'Line or rack drying for clothes', fr: 'Séchage sur fil ou sur étendoir', ...PZ,
    // The one laundry solution that REMOVES a load instead of making it more efficient: the
    // tumble dryer is usually the larger of the two, and a line costs two posts.
    site: () => KP.line(6),
    draw: (t) => annotated(t, { obj: KP.line, label: ['LINE DRYING', 'SÉCHAGE SUR FIL', 810, 366, 'end'], notes: [] }),
  },
  /* ---- ninth batch, 2026-09-12: the plan. Ten plates -- arrangement, drawn on a section. */
  {
    id: 'SOL-007', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité', en: 'Fire-rated compartmentalization', fr: 'Compartimentage coupe-feu', ...NZ,
    // A compartment is a box: the wall AND the floor over it, and a door that holds as long as
    // the wall does. What it buys is not a house that cannot burn but a way out while it does.
    site: () => KN.fire(6),
    draw: (t) => annotated(t, { obj: KN.fire, label: ['FIRE COMPARTMENT', 'COMPARTIMENT COUPE-FEU', 150, 470, 'start', [298, 433]], notes: [] }),
  },
  {
    id: 'SOL-015', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'South-glazed / north-buffered orientation', fr: 'Orientation : vitrages au sud, pièces tampons au nord', ...NZ,
    // The decision that costs nothing at the drawing stage and cannot be bought back later:
    // living rooms and glass to the south, the rooms that may be cold to the north.
    site: () => KN.orient(6),
    draw: (t) => annotated(t, { obj: KN.orient, label: ['SOUTH GLAZED, NORTH BUFFERED', 'VITRÉ AU SUD, TAMPON AU NORD', 150, 470, 'start', [167, 432]], notes: [] }),
  },
  {
    id: 'SOL-050', fnEn: 'Acoustic comfort', fnFr: 'Confort acoustique', en: 'Room layout separating noisy and quiet zones', fr: 'Plan séparant les zones bruyantes et calmes', ...NZ,
    // Distance and the riser between them do what a heavier wall would have had to do, and they
    // do it for nothing: this is the cheapest acoustic move in the catalogue.
    site: () => KN.zones(),
    draw: (t) => annotated(t, { obj: KN.zones, label: ['NOISY AND QUIET, KEPT APART', 'BRUYANT ET CALME, SÉPARÉS', 150, 470, 'start', [401, 433]], notes: [] }),
  },
  {
    id: 'SOL-095', fnEn: 'Space & occupancy', fnFr: 'Espace et occupation', en: 'Open-plan shared living/kitchen/dining', fr: 'Séjour, cuisine et repas en plan ouvert', ...NZ,
    // One room where the plan had three: fewer square metres do more work, and what is spent is
    // the quiet on the other side of a wall that is no longer there.
    site: () => KN.openPlan(6),
    draw: (t) => annotated(t, { obj: KN.openPlan, label: ['ONE SHARED ROOM', 'UNE SEULE PIÈCE PARTAGÉE', 150, 470, 'start', [168, 431]], notes: [] }),
  },
  {
    id: 'SOL-096', fnEn: 'Space & occupancy', fnFr: 'Espace et occupation', en: 'Convertible/multi-use guest space', fr: 'Espace d’accueil convertible', ...NZ,
    // A bed that folds into the wall: the room does its own job all day and takes a guest at
    // night, so the house is not carrying a room that is empty fifty weeks a year.
    site: () => KN.convertible(6),
    draw: (t) => annotated(t, { obj: KN.convertible, label: ['A BED THAT FOLDS AWAY', 'UN LIT QUI SE REPLIE', 652, 208, 'end'], notes: [] }),
  },
  {
    id: 'SOL-097', fnEn: 'Space & occupancy', fnFr: 'Espace et occupation', en: 'Built-in and loft storage', fr: 'Rangements intégrés et sous comble', ...NZ,
    // Storage that takes no room from the room: in the thickness of the wall, and up under the
    // roof where the space is there whether it is used or not.
    site: () => KN.builtIn(),
    draw: (t) => annotated(t, { obj: KN.builtIn, label: ['BUILT-IN AND LOFT STORAGE', 'RANGEMENTS INTÉGRÉS ET COMBLE', 180, 214, 'start', [437, 213]], notes: [] }),
  },
  {
    id: 'SOL-098', fnEn: 'Space & occupancy', fnFr: 'Espace et occupation', en: 'Dedicated workshop/tool bay', fr: 'Atelier ou coin outillage dédié', ...NZ,
    // A bench and a rack over it. Mending things needs somewhere to leave them half-mended,
    // which is the whole argument: without it the kitchen table is the workshop.
    site: () => KN.workshop(),
    draw: (t) => annotated(t, { obj: KN.workshop, label: ['WORKSHOP BAY', 'COIN ATELIER', 294, 208, 'end'], notes: [] }),
  },
  {
    id: 'SOL-106', fnEn: 'Building durability & maintainability', fnFr: 'Durabilité et facilité d’entretien du bâtiment', en: 'Non-load-bearing internal partitions', fr: 'Cloisons intérieures non porteuses', ...NZ,
    // The floor over it is carried by the frame, not by this wall -- which is what lets the plan
    // change in twenty years without touching what holds the house up.
    site: () => KN.movable(6),
    draw: (t) => annotated(t, { obj: KN.movable, label: ['A WALL THAT CARRIES NOTHING', 'UNE CLOISON QUI NE PORTE RIEN', 150, 470, 'start', [295, 430]], notes: [] }),
  },
  {
    id: 'SOL-107', fnEn: 'Building durability & maintainability', fnFr: 'Durabilité et facilité d’entretien du bâtiment', en: 'Structural bays sized for future extension', fr: 'Travées dimensionnées pour une extension future', ...NZ,
    // Set the bays out once and the next room is a frame away rather than a rebuild. The
    // extension is dashed because it is not there yet, and that is the point.
    site: () => KN.bays(),
    draw: (t) => annotated(t, { obj: KN.bays, label: ['BAYS SET OUT TO GROW', 'TRAVÉES PRÊTES À S’ÉTENDRE', 150, 470], notes: [] }),
  },
  {
    id: 'SOL-137', fnEn: 'Space & occupancy', fnFr: 'Espace et occupation', en: 'Loft / mezzanine sleeping space', fr: 'Couchage en mezzanine', ...NZ,
    // A platform under the roof instead of a room beside one: the floor under it is still floor,
    // and the height a room does not need above a bed is where the bed goes.
    site: () => KN.mezzanine(6),
    draw: (t) => annotated(t, { obj: KN.mezzanine, label: ['MEZZANINE SLEEPING PLATFORM', 'COUCHAGE EN MEZZANINE', 656, 234, 'end'], notes: [] }),
  },
  /* ---- tenth batch, 2026-09-12: below ground and the footings. Fifteen plates. */
  {
    id: 'SOL-052', members: ['SOL-147'], fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Drilled well', fr: 'Puits foré', ...GZ,
    // Independent of the rainfall year, dependent on an aquifer nobody can see: the borehole is
    // drawn with a BREAK because it goes deeper than a section of a house can show, and the
    // hand pump on top is the same hole with a lever on it.
    site: () => KGr.well(6),
    draw: (t) => annotated(t, { obj: KGr.well, label: ['DRILLED WELL', 'PUITS FORÉ', 806, 416, 'end'], notes: [] }),
  },
  {
    id: 'SOL-176', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Rope pump (manual, low-cost well pump)', fr: 'Pompe à corde (manuelle, à bas coût)', ...GZ,
    // A loop of rope with washers threaded on it, pulled up through a rising pipe: the washers
    // carry the water between them. Nothing in it is machined, which is why it is the pump a
    // village can repair and a household can build.
    site: () => KGr.rope(6),
    draw: (t) => annotated(t, { obj: KGr.rope, label: ['ROPE PUMP', 'POMPE À CORDE', 810, 390, 'end'], notes: [] }),
  },
  {
    id: 'SOL-062', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Buried/insulated pipe runs below frost line', fr: 'Canalisations enterrées sous le gel', ...GZ,
    // The dashed line is the depth frost reaches in a hard winter; everything that carries water
    // goes under it, and what cannot be buried that deep is insulated instead.
    site: () => KGr.frost(6),
    draw: (t) => annotated(t, { obj: KGr.frost, label: ['BELOW THE FROST LINE', 'SOUS LA LIMITE DE GEL', 810, 522, 'end'], notes: [] }),
  },
  {
    id: 'SOL-066', fnEn: 'Greywater management', fnFr: 'Gestion des eaux grises', en: 'Sand filter', fr: 'Filtre à sable', ...GZ,
    // Gravel below, sand above, water in at the top and out at the bottom, slowly. It is a
    // pre-treatment: it takes out what is IN the water, not what is dissolved in it.
    site: () => KGr.sand(6),
    draw: (t) => annotated(t, { obj: KGr.sand, label: ['SAND FILTER', 'FILTRE À SABLE', 702, 504], notes: [] }),
  },
  {
    id: 'SOL-071', fnEn: 'Blackwater / sewage management', fnFr: 'Gestion des eaux noires et de l’assainissement', en: 'Septic tank + drain field', fr: 'Fosse septique et épandage', ...GZ,
    // Two chambers and a field: what sinks stays, what floats stays, and what leaves soaks away
    // through the ground. Gravity the whole way -- no pump, no power, and a tanker every few
    // years, which is the row next door in this catalogue.
    site: () => KGr.septic(6),
    draw: (t) => annotated(t, { obj: KGr.septic, label: ['SEPTIC TANK AND FIELD', 'FOSSE SEPTIQUE ET ÉPANDAGE', 810, 522, 'end'], notes: [] }),
  },
  {
    id: 'SOL-152', fnEn: 'Greywater management', fnFr: 'Gestion des eaux grises', en: 'Wood-chip filter (Filtres à Broyat de Bois)', fr: 'Filtre à broyat de bois', ...GZ,
    // A bed of chips that is the filter and the food at once: the life in it does the work, and
    // when the chips are spent they are composted rather than cleaned.
    site: () => KGr.chips(6),
    draw: (t) => annotated(t, { obj: KGr.chips, label: ['WOOD-CHIP FILTER', 'FILTRE À BROYAT', 686, 522], notes: [] }),
  },
  {
    id: 'SOL-151', fnEn: 'Greywater management', fnFr: 'Gestion des eaux grises', en: 'Membrane bioreactor (MBR) greywater recycling', fr: 'Bioréacteur à membrane (MBR) pour eaux grises', ...GZ,
    // Water pulled through a membrane fine enough to stop what a sand bed would let past, with
    // air bubbled along it to keep it from blinding. It fits in a small box and it stops the
    // day the power does, which is the trade against every passive bed in this catalogue.
    site: () => KGr.mbr(6),
    draw: (t) => annotated(t, { obj: KGr.mbr, label: ['MEMBRANE BIOREACTOR', 'BIORÉACTEUR À MEMBRANE', 810, 522, 'end'], notes: [] }),
  },
  {
    id: 'SOL-154', fnEn: 'Blackwater / sewage management', fnFr: 'Gestion des eaux noires et de l’assainissement', en: 'Aerobic treatment unit / micro-station', fr: 'Micro-station d’épuration', ...GZ,
    // The same bacteria as a septic tank, given air so they work faster in a smaller tank. The
    // blower is what buys the size, and it is also what has to keep running.
    site: () => KGr.micro(6),
    draw: (t) => annotated(t, { obj: KGr.micro, label: ['AEROBIC MICRO-STATION', 'MICRO-STATION AÉROBIE', 810, 522, 'end'], notes: [] }),
  },
  {
    id: 'SOL-003', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité', en: 'Deep pile / screwed-pile foundation', fr: 'Fondation sur pieux (vissés ou forés)', ...GF,
    // Past the depth where clay swells and shrinks with the weather -- which is what moves a
    // shallow footing and cracks what stands on it. Each pile can be adjusted later.
    site: () => KGr.piles(6),
    draw: (t) => annotated(t, { obj: KGr.piles, label: ['PILES, PAST THE MOVING GROUND', 'PIEUX, SOUS LE SOL QUI TRAVAILLE', 510, 524, 'end'], notes: [] }),
  },
  {
    id: 'SOL-004', members: ['SOL-008'], fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité', en: 'Skid or point-support foundation', fr: 'Fondation sur plots ou longrines', ...GF,
    // The floor lifted clear of the ground: water, damp and vermin pass underneath instead of
    // through, and the same move is what raising the finished floor level is for.
    site: () => KGr.skids(6),
    draw: (t) => annotated(t, { obj: KGr.skids, label: ['THE FLOOR, LIFTED CLEAR', 'LE PLANCHER, DÉCOLLÉ DU SOL', 150, 470], notes: [] }),
  },
  {
    id: 'SOL-013', fnEn: 'Building durability & maintainability', fnFr: 'Durabilité et facilité d’entretien du bâtiment', en: 'French drain around foundation', fr: 'Drain français en pied de fondation', ...GF, zone: [60, 430, 180, 80], crop: [40, 410, 220, 120],
    // Stone, and a perforated pipe at the bottom of it: the water that reaches the footing is
    // taken away before it can stand against it. It is the cheapest thing here and the one that
    // decides how long the wall above lasts.
    site: () => KGr.french(6),
    draw: (t) => annotated(t, { obj: KGr.french, label: ['FRENCH DRAIN', 'DRAIN FRANÇAIS', 210, 470, 'start', [142, 458]], notes: [] }),
  },
  {
    id: 'SOL-104', fnEn: 'Building durability & maintainability', fnFr: 'Durabilité et facilité d’entretien du bâtiment', en: 'Rodent-proof foundation detailing', fr: 'Protection des fondations contre les rongeurs', ...GF,
    // They use the same three ways in every time: the vent, the service entry and the gap under
    // the cladding. Mesh at those three, fitted while the wall is open, and the problem does not
    // arise -- which is a different job from dealing with it afterwards.
    site: () => KGr.rodent(),
    draw: (t) => annotated(t, { obj: KGr.rodent, label: ['MESH AT THE WAYS IN', 'GRILLAGE AUX ACCÈS', 210, 470], notes: [] }),
  },
  {
    id: 'SOL-033', fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation', en: 'Earth tube / ground-coupled air pre-conditioning', fr: 'Puits canadien (échangeur air-sol)', ...GN,
    // The ground a metre or two down barely notices the season. Air drawn through a duct at that
    // depth arrives having taken the ground's temperature: warmer in January, cooler in July.
    // It has to fall to its inlet so condensation drains rather than standing in it.
    site: () => KGr.earthTube(6),
    draw: (t) => annotated(t, { obj: KGr.earthTube, label: ['EARTH TUBE', 'PUITS CANADIEN', 150, 470], notes: [] }),
  },
  {
    id: 'SOL-086', members: ['SOL-165'], fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments', en: 'Root cellar (passive cool storage)', fr: 'Cave à légumes (stockage frais passif)', ...GN,
    // A room in the ground, with air in low and out high so it stays damp and cool rather than
    // damp and still. The sand box in the corner is the same idea at the scale of a crate.
    site: () => KGr.cellar(6),
    draw: (t) => annotated(t, { obj: KGr.cellar, label: ['ROOT CELLAR', 'CAVE À LÉGUMES', 150, 470], notes: [] }),
  },
  {
    id: 'SOL-185', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Ground-coupled hydronic cooling loop', fr: 'Boucle hydraulique de rafraîchissement sur sol', ...GN,
    // A loop of pipe in the cold ground and a small pump: what comes back is a few degrees below
    // the room, which is enough to take the edge off a hot week with no compressor anywhere.
    site: () => KGr.loop(6),
    draw: (t) => annotated(t, { obj: KGr.loop, label: ['GROUND COOLING LOOP', 'BOUCLE DE RAFRAÎCHISSEMENT', 150, 470], notes: [] }),
  },
  /* ---- eleventh batch, 2026-09-12: the roof and floor, as layers. Ten plates. */
  {
    id: 'SOL-206', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Cool (high-reflectance) roof surface', fr: 'Toiture à haute réflectance (toit frais)', ...RZ2,
    // The outermost band: a surface that sends most of the sun back before the roof has to deal
    // with it. It is the cheapest of the three roof moves and the only one visible from outside.
    site: () => '',
    draw: (t) => roofDetail(t, { hl: ['cover'], label: ['COOL ROOF SURFACE', 'SURFACE RÉFLÉCHISSANTE'],
      extra: `<path class="ov-dash" d="M250,110 L268,150 M310,110 L292,150"/>` }),
  },
  {
    id: 'SOL-207', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Attic radiant barrier', fr: 'Barrière radiante en comble', ...RZ2,
    // A foil facing an air gap, low down in the build-up: it does nothing against conduction and
    // a great deal against the roof radiating its heat down into the room below.
    site: () => '',
    draw: (t) => roofDetail(t, { hl: ['barrier'], label: ['RADIANT BARRIER', 'BARRIÈRE RADIANTE'],
      extra: `<path class="ov-dash" d="M250,232 L250,244 M300,232 L300,244 M350,232 L350,244"/>` }),
  },
  {
    id: 'SOL-208', fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation', en: 'Vented roof / attic assembly', fr: 'Toiture ou comble ventilé', ...RZ2,
    // The gap under the covering, open at the eaves and at the ridge: it takes away both the
    // heat the covering collects and the moisture that gets past the ceiling.
    site: () => '',
    draw: (t) => roofDetail(t, { hl: ['gap'], label: ['VENTED ROOF ASSEMBLY', 'TOITURE VENTILÉE'],
      extra: `<path class="ov-line hair" d="M220,163 H370"/>` }),
  },
  {
    id: 'SOL-009', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité', en: 'Impact-resistant roofing', fr: 'Couverture résistante aux impacts', zone: [100, 26, 640, 180], crop: [180, 26, 480, 190],
    // Rated for what actually lands on it: hail, a branch, a foot in the wrong place during a
    // repair. It is a property of the covering, not of the structure under it.
    site: () => KX.impact(6),
    draw: (t) => annotated(t, { obj: KX.impact, label: ['IMPACT-RATED COVERING', 'COUVERTURE RÉSISTANTE', 238, 164], notes: [] }),
  },
  {
    id: 'SOL-117', fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité', en: 'Low-profile hip roof form', fr: 'Toiture en croupe à faible pente', zone: [60, 90, 700, 130], crop: [60, 90, 700, 140],
    // Four slopes instead of two: there is no gable end for the wind to push against, and less
    // of the roof stands square to it. The shape is the solution -- nothing is added.
    site: () => KX.hip(6),
    draw: (t) => annotated(t, { obj: KX.hip, label: ['HIP ROOF, LOW PITCH', 'TOITURE EN CROUPE', 398, 162, 'end'], notes: [] }),
  },
  {
    id: 'SOL-045', fnEn: 'Building durability & maintainability', fnFr: 'Durabilité et facilité d’entretien du bâtiment', en: 'Sealed slab and vapour barrier', fr: 'Dalle étanche et pare-vapeur', ...SZ2,
    // The membrane under the slab, and the slab sealed on top: ground moisture cannot rise
    // through concrete that has a barrier under it, and what it saves is every floor finish
    // above for the life of the building.
    site: () => '',
    draw: (t) => slabDetail(t, { hl: ['memb', 'finish'], label: ['SEALED SLAB, MEMBRANE UNDER', 'DALLE ÉTANCHE, MEMBRANE DESSOUS'] }),
  },
  {
    id: 'SOL-202', members: ['SOL-203'], fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Insulated slab edge and slab-to-wall thermal break', fr: 'Isolation de rive de dalle et rupture de pont thermique', ...SZ2,
    // The second path a thermal bridge takes: not through the wall but round the edge of the
    // slab, from the warm room to the cold ground. Insulation turns the corner with it, and the
    // retrofit version does the same from outside.
    site: () => '',
    draw: (t) => slabDetail(t, { hl: ['edge', 'ins'], label: ['INSULATED SLAB EDGE', 'RIVE DE DALLE ISOLÉE'] }),
  },
  {
    id: 'SOL-037', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Zoned radiant or convective heating circuits', fr: 'Circuits de chauffage par zones', zone: [150, 390, 540, 58], crop: [150, 380, 546, 80],
    // One circuit per zone, each with its own control: the room nobody is in is the room that is
    // not heated, which is the cheapest heat saved in any house.
    site: () => KX.zoned(6),
    draw: (t) => annotated(t, { obj: KX.zoned, label: ['ZONED CIRCUITS', 'CIRCUITS PAR ZONE', 150, 470, 'start', [180, 428]], notes: [] }),
  },
  {
    id: 'SOL-044', fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation', en: 'Sub-slab depressurisation / radon sump', fr: 'Puisard radon (dépressurisation sous dalle)', zone: [320, 26, 60, 460], crop: [300, 300, 200, 200],
    // A pit under the slab, a pipe from it to above the roof, and a fan that keeps the space
    // under the floor at a lower pressure than the room: the gas leaves that way instead of
    // finding a crack.
    site: () => KX.radon(6),
    draw: (t) => annotated(t, { obj: KX.radon, label: ['RADON SUMP', 'PUISARD RADON', 150, 470, 'start', [329, 458]], notes: [] }),
  },
  {
    id: 'SOL-049', fnEn: 'Acoustic comfort', fnFr: 'Confort acoustique', en: 'Dense/heavy envelope construction', fr: 'Enveloppe lourde (masse acoustique)', zone: [140, 180, 560, 276], crop: [120, 240, 200, 200],
    // Mass does not vibrate easily, and sound is vibration: the wall chosen for winter warmth
    // turns out to be the wall that keeps the road out. This one is a side effect worth naming.
    site: () => KX.dense(6),
    draw: (t) => annotated(t, { obj: KX.dense, label: ['MASS AGAINST NOISE', 'LA MASSE CONTRE LE BRUIT', 150, 470] }),
  },
  /* ---- twelfth batch, 2026-09-12: the last twelve. */
  {
    id: 'SOL-005', members: ['SOL-034'], fnEn: 'Structural integrity & safety', fnFr: 'Intégrité structurelle et sécurité', en: 'Earth-sheltered / semi-buried form', fr: 'Forme semi-enterrée (abritée par la terre)', ...XN,
    // Earth banked against the cold side does two jobs with one move, which is why the
    // catalogue lists it twice: the wind cannot get at the wall, and the ground behind it sits
    // a few degrees above the January air all winter.
    site: () => KZ2.berm(6),
    draw: (t) => annotated(t, { obj: KZ2.berm, label: ['EARTH AGAINST THE NORTH WALL', 'TERRE CONTRE LE MUR NORD', 250, 204, 'start', [83, 344]], notes: [] }),
  },
  {
    id: 'SOL-031', members: ['SOL-160'], fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Heat pump (air- or ground-source)', fr: 'Pompe à chaleur (air ou sol)', ...XN,
    // It MOVES heat rather than making it, which is where its efficiency comes from and also
    // what it depends on: a compressor, a refrigerant circuit and electricity, none of them
    // repairable at home. The reversible version runs the same circuit backwards in summer.
    site: () => KZ2.heatPump(6),
    draw: (t) => annotated(t, { obj: KZ2.heatPump, label: ['HEAT PUMP', 'POMPE À CHALEUR', 288, 350, 'end', [142, 383]], notes: [] }),
  },
  {
    id: 'SOL-036', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'North-facing unheated utility buffer room', fr: 'Pièce tampon non chauffée au nord', ...XN,
    // Not a collector and not a room anyone sits in: a layer of air and stored things between
    // the house and the cold side, which everything leaving that way has to cross first.
    site: () => KZ2.buffer(6),
    draw: (t) => annotated(t, { obj: KZ2.buffer, label: ['UNHEATED BUFFER ROOM', 'PIÈCE TAMPON NON CHAUFFÉE', 250, 204, 'start', [150, 329]], notes: [] }),
  },
  {
    id: 'SOL-085', fnEn: 'Building durability & maintainability', fnFr: 'Durabilité et facilité d’entretien du bâtiment', en: 'Dry, ventilated firewood storage', fr: 'Stockage de bois sec et ventilé', ...XN,
    // Wood dries in moving air, which is why this is a lean-to with an open face and not a
    // tarpaulin: covered on top, open to the wind, and off the ground.
    site: () => KZ2.woodshed(6),
    draw: (t) => annotated(t, { obj: KZ2.woodshed, label: ['VENTILATED WOOD STORE', 'BÛCHER VENTILÉ', 250, 204, 'start', [150, 318]], notes: [] }),
  },
  {
    id: 'SOL-039', fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation', en: 'Stack-effect / solar chimney ventilation', fr: 'Ventilation par effet de cheminée (cheminée solaire)', zone: [430, 26, 250, 420], crop: [420, 26, 280, 300],
    // A shaft kept deliberately warm at the top: the air in it rises and leaves, and what leaves
    // has to be replaced by air drawn in low on the cool side. It works on a still day, which is
    // exactly when opening a window does nothing.
    site: () => KZ2.chimney(6),
    draw: (t) => annotated(t, { obj: KZ2.chimney, label: ['SOLAR CHIMNEY', 'CHEMINÉE SOLAIRE', 458, 252], notes: [] }),
  },
  {
    id: 'SOL-079', members: ['SOL-112', 'SOL-195', 'SOL-196', 'SOL-197', 'SOL-217'], fnEn: 'Power & energy supply', fnFr: 'Production et fourniture d’énergie', en: 'Mains electricity', fr: 'Électricité du réseau', ...XE,
    // SEVEN CONNECTIONS, ONE DRAWING, and that is the honest way to draw them: what matters
    // about a mains supply in a section is that it comes from somewhere else and arrives at the
    // edge of the sheet. Power, water, gas, fibre, sewer, collection -- the line is the same.
    site: () => KZ2.mains(6),
    draw: (t) => annotated(t, { obj: KZ2.mains, label: ['THE MAINS, AT THE SHEET EDGE', 'LES RÉSEAUX, EN LIMITE DE FEUILLE', 250, 204, 'start', [154, 213]], notes: [] }),
  },
  {
    id: 'SOL-073', fnEn: 'Blackwater / sewage management', fnFr: 'Gestion des eaux noires et de l’assainissement', en: 'Periodic sludge pump-out', fr: 'Vidange périodique des boues', zone: [560, 360, 252, 140], crop: [560, 350, 256, 160],
    // The one part of on-site treatment that leaves the site: a tanker, every few years, and a
    // licensed destination for what it takes. A septic tank is not maintenance-free, and this
    // plate is where the catalogue says so.
    site: () => KZ2.tanker(6),
    draw: (t) => annotated(t, { obj: KZ2.tanker, label: ['SLUDGE PUMP-OUT', 'VIDANGE DES BOUES', 658, 426, 'end'], notes: [] }),
  },
  {
    id: 'SOL-140', members: ['SOL-172'], fnEn: 'Connectivity & communication', fnFr: 'Connectivité et communication', en: 'Local mesh / long-range radio network (LoRa)', fr: 'Réseau radio maillé longue portée (LoRa)', zone: [180, 26, 280, 180], crop: [170, 26, 300, 200],
    // A mast on the north slope and what hangs off it: a small antenna for the mesh, a dish for
    // the satellite. In a section the useful facts are the height and the clear line out -- both
    // of them are about where it is, not what it is.
    site: () => KZ2.mast(6),
    draw: (t) => annotated(t, { obj: KZ2.mast, label: ['MAST AND ANTENNA', 'MÂT ET ANTENNE', 212, 112, 'end', [239, 100]], notes: [] }),
  },
  {
    id: 'SOL-224', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Hot water bottle', fr: 'Bouillotte', ...XB,
    // The oldest of the personal heaters and still the cheapest: water heated for something
    // else, in a cover, against the body. Nothing is installed and nothing can break.
    site: () => KZ2.bottle(),
    draw: (t) => annotated(t, { obj: KZ2.bottle, label: ['HOT WATER BOTTLE', 'BOUILLOTTE', 500, 290], notes: [] }),
  },
  {
    id: 'SOL-225', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Electrically heated table (kotatsu)', fr: 'Table chauffante (kotatsu)', ...XB,
    // A quilt over the table and a small heater under it: what is heated is the volume a person
    // is actually in. A few dozen watts do what a few kilowatts would have to do to the room.
    site: () => KZ2.kotatsu(6),
    draw: (t) => annotated(t, { obj: KZ2.kotatsu, label: ['HEATED TABLE (KOTATSU)', 'TABLE CHAUFFANTE (KOTATSU)', 250, 204, 'start', [486, 249]], notes: [] }),
  },
  {
    id: 'SOL-226', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Solar-powered foot stove (heat cube)', fr: 'Chauffe-pieds solaire (cube chauffant)', ...XB,
    // Cold feet are what a person notices first, and warming them costs a fraction of warming
    // the air around them. Run off the panels, so it costs nothing to leave on.
    site: () => KZ2.footStove(6),
    draw: (t) => annotated(t, { obj: KZ2.footStove, label: ['FOOT STOVE', 'CHAUFFE-PIEDS', 618, 258, 'end'], notes: [] }),
  },
  {
    id: 'SOL-231', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Box-bed with thermal curtain', fr: 'Lit clos à rideau isolant', ...XB,
    // The volume being heated is the bed, and the body in it is the heater. A medieval answer to
    // an unheated bedroom, and still the one that uses no energy at all.
    site: () => KZ2.boxBed(6),
    draw: (t) => annotated(t, { obj: KZ2.boxBed, label: ['BOX BED WITH A CURTAIN', 'LIT CLOS À RIDEAU', 250, 204, 'start', [469, 205]], notes: [] }),
  },
  {
    id: 'SOL-239', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Insulating furniture (hooded chair, folding screen)', fr: 'Mobilier isolant (fauteuil à capuchon, paravent)', ...LZ,
    // Approved 2026-09-17: a hooded chair in the living room, its back to the south glazing, a folding
    // screen behind it. Labels only, as Eric asked of the site plates.
    site: () => KZ2.hoodedChair(6),
    draw: (t) => annotated(t, { obj: KZ2.hoodedChair, label: ['HOODED CHAIR AND SCREEN', 'FAUTEUIL À CAPUCHON ET PARAVENT', 552, 326, 'middle'] }),
  },
  /* ---- fifth batch, 2026-09-11: the living room. Ten plates, 10 solutions. */
  {
    id: 'SOL-030', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Wood stove / mass heater', fr: 'Poêle à bois / poêle de masse', ...LZ,
    // Beside the riser, its flue rising all the way into the flue lane: a pipe that falls anywhere
    // on its way to the chimney stalls the draught. One wood heater per house: it competes with the
    // rocket heater for this end of the room.
    site: () => KL.stove('heater')(6),
    draw: (t) => annotated(t, { obj: KL.stove('heater'), label: ['WOOD STOVE', 'POÊLE À BOIS', 490, 404], notes: [
      { x: 446, y: 326, en: 'FLUE', fr: 'CONDUIT', to: [452, 336], from: [450, 329], site: true }] }),
  },
  {
    id: 'SOL-089', fnEn: 'Food storage & preparation infrastructure', fnFr: 'Conservation et préparation des aliments', en: 'Wood cookstove', fr: 'Cuisinière à bois', ...LZ,
    // The same stove with an oven and a cooking top: one fire, two jobs.
    site: () => KL.stove('cook')(6),
    draw: (t) => annotated(t, { obj: KL.stove('cook'), label: ['WOOD COOKSTOVE', 'CUISINIÈRE À BOIS', 490, 390], notes: [
      { x: 490, y: 404, en: 'OVEN BESIDE THE FIREBOX', fr: 'FOUR À CÔTÉ DU FOYER', to: [476, 404], from: [488, 401], site: true },
      { x: 446, y: 326, en: 'FLUE', fr: 'CONDUIT', to: [452, 336], from: [450, 329], site: true }] }),
  },
  {
    id: 'SOL-247', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Gravity-fed pellet stove (no electricity)', fr: 'Poêle à granulés sans électricité (alimentation par gravité)', ...LZ,
    // The wood stove's place and flue (2026-09-24): one heater per house, so it competes with them.
    site: () => KL.pellet(6),
    draw: (t) => annotated(t, { obj: KL.pellet, label: ['PELLET STOVE', 'POÊLE À GRANULÉS', 490, 404], notes: [
      { x: 490, y: 368, en: 'HOPPER', fr: 'TRÉMIE', to: [464, 372], from: [488, 365], site: true },
      { x: 446, y: 326, en: 'FLUE', fr: 'CONDUIT', to: [452, 336], from: [450, 329], site: true }] }),
  },
  {
    id: 'SOL-178', fnEn: 'Potable water supply', fnFr: 'Alimentation en eau potable', en: 'Wood-stove flue water heater (thermosiphon coil)', fr: 'Chauffe-eau sur conduit de poêle (serpentin à thermosiphon)', zone: [436, 244, 64, 194], crop: [400, 230, 250, 210],
    // Thermosiphon: the tank must sit ABOVE the coil, so it is upstairs. Hot water rises to it; cold
    // falls back to the coil. And it is open-vented: a sealed loop on a fire can boil and burst.
    site: () => KL.coil(6),
    draw: (t) => annotated(t, { obj: KL.coil, label: ['FLUE WATER HEATER', 'CHAUFFE-EAU SUR CONDUIT', 496, 400], notes: [
      { x: 496, y: 368, en: 'COIL ROUND THE FLUE', fr: 'SERPENTIN SUR LE CONDUIT', to: [477, 369], from: [493, 365], site: true },
      { x: 496, y: 272, en: 'HOT, TO THE TANK', fr: 'CHAUDE, VERS LE BALLON', to: [481, 272], from: [493, 269], site: true },
      { x: 496, y: 288, en: 'COLD FALLS BACK', fr: 'LA FROIDE REDESCEND', to: [487, 300], from: [493, 285], site: true },
      ] }),
  },
  {
    id: 'SOL-209', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Ceiling fan', fr: 'Ventilateur de plafond', ...LZ,
    site: () => KL.fan(6),
    draw: (t) => annotated(t, { obj: KL.fan, label: ['CEILING FAN', 'VENTILATEUR DE PLAFOND', 446, 376], notes: [] }),
  },
  {
    id: 'SOL-113', fnEn: 'Connectivity & communication', fnFr: 'Connectivité et communication', en: 'Cellular router', fr: 'Routeur cellulaire', ...LZ,
    site: () => KL.router(),
    draw: (t) => closeUp(t, { at: LB, focus: [635, 346], ring: 14, obj: KL.router, label: ['CELLULAR ROUTER', 'ROUTEUR CELLULAIRE'], labelAt: [446, 386, 'start'], notes: [
      { x: 446, y: 354, en: 'SIM CARD', fr: 'CARTE SIM', to: [636, 352], from: 'end' }] }),
  },
  {
    id: 'SOL-114', fnEn: 'Connectivity & communication', fnFr: 'Connectivité et communication', en: 'Battery/solar-backed radio or satellite communicator', fr: 'Radio ou communicateur satellite sur batterie/solaire', ...LZ,
    site: () => KL.radio(),
    draw: (t) => closeUp(t, { at: LB, focus: [656, 348], ring: 14, obj: KL.radio, label: ['EMERGENCY RADIO', 'RADIO DE SECOURS'], labelAt: [446, 400, 'start'], notes: [
      { x: 446, y: 354, en: 'SOLAR CELL', fr: 'CELLULE SOLAIRE', to: [661, 347], from: 'end' },
      { x: 446, y: 368, en: 'HAND CRANK', fr: 'MANIVELLE À MAIN', to: [668, 352], from: 'end' }] }),
  },
  {
    id: 'SOL-047', fnEn: 'Light', fnFr: 'Lumière', en: 'LED lighting', fr: 'Éclairage LED', ...LZ,
    site: () => KL.led(),
    draw: (t) => annotated(t, { obj: KL.led, label: ['LED PENDANT', 'SUSPENSION LED', 628, 326, 'end'], notes: [] }),
  },
  {
    id: 'SOL-127', fnEn: 'Thermal comfort', fnFr: 'Confort thermique', en: 'Evaporative cooling', fr: 'Rafraîchissement évaporatif', ...LZ,
    // The catalogue's own caveat: it needs dry air, and a humid oceanic summer is not that.
    site: () => KL.cooler(6),
    draw: (t) => annotated(t, { obj: KL.cooler, label: ['EVAPORATIVE COOLER', 'RAFRAÎCHISSEUR ÉVAPORATIF', 624, 382, 'end'], notes: [
      { x: 624, y: 398, a: 'end', en: 'COOLER, DAMPER AIR', fr: 'AIR PLUS FRAIS, PLUS HUMIDE', to: [642, 392], from: [627, 395], site: true },
      { x: 624, y: 412, a: 'end', en: 'WET PAD', fr: 'TAMPON HUMIDE', to: [633, 412], site: true }] }),
  },
  {
    id: 'SOL-171', fnEn: 'Light', fnFr: 'Lumière', en: 'Gravity-powered lamp', fr: 'Lampe à gravité', zone: [490, 206, 60, 96], crop: [470, 200, 160, 260],
    // A task light, as the catalogue says -- 5 to 15 lumens -- so by the bed, not over the room.
    site: () => KL.gravity(6),
    draw: (t) => closeUp(t, { at: BB, focus: [507, 238], ring: 18, obj: KL.gravity, label: ['GRAVITY LAMP', 'LAMPE À GRAVITÉ'], labelAt: [548, 476, 'middle'], notes: [
      { x: 470, y: 330, a: 'end', en: 'GEARS AND A GENERATOR', fr: 'ENGRENAGES ET GÉNÉRATRICE', to: [507, 221] },
      { x: 470, y: 420, a: 'end', en: 'THE WEIGHT SINKS', fr: 'LE POIDS DESCEND', to: [510, 264] },
      ] }),
  },
  {
    id: 'SOL-175', fnEn: 'Air quality & ventilation', fnFr: 'Qualité de l’air et ventilation', en: 'DIY activated-charcoal air filter', fr: 'Filtre à air maison au charbon actif', zone: [514, 276, 34, 26], crop: [470, 250, 160, 210],
    // Passive, as the catalogue insists: no fan, so little air meets the charcoal. A complement to
    // ventilation, never a substitute -- the plate says so rather than dress it up.
    site: () => KL.charcoal(),
    draw: (t) => closeUp(t, { at: BB, focus: [531, 291], ring: 14, obj: KL.charcoal, label: ['CHARCOAL AIR FILTER', 'FILTRE AU CHARBON ACTIF'], labelAt: [548, 476, 'middle'], notes: [
      { x: 470, y: 364, a: 'end', en: 'ACTIVATED CHARCOAL', fr: 'CHARBON ACTIF', to: [531, 293] },
      ] }),
  },
]

// A plate serves its whole family: the insulation plate is the page drawing for all eleven
// insulations, listed in its `members` (Eric, 2026-09-10: similar solutions share one drawing).
// A plate flagged `proposal: true` in the demo is awaiting Eric's review and never ships.
export const plateFor = (id) =>
  PLATES.find((p) => !p.proposal && (p.id === id || (p.members || []).includes(id))) || null

/**
 * The phone framing.
 *
 * NOT `plate.crop`, which is the 175px thumbnail framing and is wrong here for a reason
 * worth stating: text and stroke widths are in DRAWING units, so cropping magnifies them.
 * The thumbnail crop is ~210 units wide, which at 175px puts about 0.8 pixels on a unit and
 * makes an 11-unit label a readable 9px. The same crop filling a 500px phone column puts
 * 2.4 pixels on a unit and the labels come out at 26px, shouting across a quarter of a
 * house. The full sheet has the opposite problem: 840 units in 390px is 0.46, and every
 * annotation disappears.
 *
 * So the phone gets a THIRD framing, derived rather than authored: the focus zone grown to
 * at least 430x287 about its own centre and clamped to the sheet. That lands near 0.9
 * pixels per unit on a phone, which is where the annotations were drawn to be read, and it
 * keeps half the house in shot so the reader still knows what they are looking at.
 */
export function mobileView(plate) {
  // Two plates opt out, and both for the same reason: their subject is not inside their
  // focus zone. Secondary glazing lives in a detail bubble drawn 400 units away from the
  // window it magnifies, and deriving a frame around the window alone would crop out the
  // entire point of the plate. The composting stack needs a few units above the zone for
  // its cowl. Where the derivation is wrong, say so per plate rather than bending it.
  if (plate.mobile) return plate.mobile
  const [zx, zy, zw, zh] = plate.zone
  let w = Math.max(zw, 430), h = Math.max(zh, 287)
  if (w / h > 1.5) h = w / 1.5
  else w = h * 1.5
  w = Math.min(w, 820); h = Math.min(h, 546)
  const x = Math.max(10, Math.min(zx + zw / 2 - w / 2, 830 - w))
  const y = Math.max(10, Math.min(zy + zh / 2 - h / 2, 550 - h))
  return [Math.round(x), Math.round(y), Math.round(w), Math.round(h)]
}

/* 540 drawing units span the 9.00 m house, so 60 units is one metre and a 120-unit bar
   is two. Drawn in the building's own units, which is what keeps it true at any size. */
const scalebar = () => {
  let s = ''
  for (let i = 0; i < 4; i++)
    s += `<rect class="pl-hair" x="${40 + i * 30}" y="${514}" width="30" height="6"
           fill="${i % 2 ? 'none' : 'currentColor'}"/>`
  return s + `<text class="pl-num" x="40" y="531" font-size="8.5">0</text>
              <text class="pl-num" x="164" y="531" font-size="8.5">2 m</text>`
}

/**
 * One plate as an SVG string.
 * `view` crops it (the mobile framing); omit for the whole sheet.
 * `t` picks the annotation language, so a plate is translated at render time rather than
 * being a second asset per language.
 */
/**
 * Several plates on ONE section sheet: the base once, every plate's drawing over it. With a
 * `selected` plate id, the base dims outside that plate's zone, the other drawings fade and the
 * selected one paints last, on top. Used by the guide pages to show a guide's picks together.
 */
export function composedSvg(plates, { t, selected = null, chrome = true, layerClass = () => '', at = null, post = (p, f) => f, label = null } = {}) {
  const fid = 'plc' + (uid++)
  const BASE_ = baseFor(plates)
  const sel = plates.find((p) => p.id === selected)
  const layer = (p) => `<g class="gh-layer${sel ? (p === sel ? ' is-on' : ' is-off') : ''}${layerClass(p)}" data-plate="${p.id}">${post(p, p.draw(t))}</g>`
  const base = sel
    ? `<clipPath id="${fid}"><rect x="${sel.zone[0]}" y="${sel.zone[1]}" width="${sel.zone[2]}" height="${sel.zone[3]}"/></clipPath>
       <g class="pl-dim">${BASE_}</g><g clip-path="url(#${fid})">${BASE_}</g>`
    : `<g class="pl-dim">${BASE_}</g>`
  return `
<svg ${at ? `x="${at[0]}" y="${at[1]}" width="${at[2]}" height="${at[3]}" ` : ''}viewBox="0 0 840 560" xmlns="http://www.w3.org/2000/svg" class="${at ? 'plate-sub' : 'plate-svg'}" role="img"${label ? ` aria-label="${escAttr(label)}"` : ''}>
  <rect class="pl-paper" x="-40" y="-40" width="920" height="640"/>
  ${chrome ? `<rect class="pl-line" x="18" y="18" width="804" height="524"/>
              <rect class="pl-hair" x="26" y="26" width="788" height="508"/>` : ''}
  ${base}
  ${plates.filter((p) => p !== sel).map(layer).join('')}${sel ? layer(sel) : ''}
  ${chrome ? scalebar() : ''}
</svg>`
}

/*
 * The house's N and S sit under its two footings. Where a plate draws into that ground (a tank
 * by the north wall, a filter bed to the south), the letter moves above the ground on the same
 * side, so the sheet still says which way the house faces (Eric, 2026-10-21: move, not drop).
 */
const COMPASS_CLEAR = {
  'SOL-013': 'N', 'SOL-033': 'N', 'SOL-086': 'N', 'SOL-156': 'N', 'SOL-185': 'N', 'SOL-192': 'N',
  'SOL-062': 'S', 'SOL-066': 'S', 'SOL-071': 'S', 'SOL-073': 'S', 'SOL-151': 'S', 'SOL-152': 'S', 'SOL-154': 'S',
}
// Above the ground line (y 404), clear of the wall and of the yard plates' objects.
const COMPASS_UP = { N: [112, 396], S: [722, 396] }
const baseFor = (plates) => {
  const move = new Set(plates.map((p) => COMPASS_CLEAR[p.id]).filter(Boolean))
  let b = BASE
  if (move.has('N')) b = b.replace('<text class="dr-txt" x="112" y="474">N</text>', `<text class="dr-txt" x="${COMPASS_UP.N[0]}" y="${COMPASS_UP.N[1]}">N</text>`)
  if (move.has('S')) b = b.replace('<text class="dr-txt" x="722" y="474">S</text>', `<text class="dr-txt" x="${COMPASS_UP.S[0]}" y="${COMPASS_UP.S[1]}">S</text>`)
  return b
}

export function plateSvg(plate, { view = null, t, chrome = true, post = (p, f) => f, label = null, titleBlock = null } = {}) {
  const fid = 'plf' + (uid++)
  const BASE_ = baseFor([plate])
  const [zx, zy, zw, zh] = plate.zone
  // With a title block the sheet gains a band under the drawing for it.
  const band = titleBand(titleBlock)
  const vb = view ? view.join(' ') : `0 0 840 ${560 + band}`
  return `
<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="plate-svg" role="img"
     aria-label="${escAttr(label || t(plate.en, plate.fr))}">
  <rect class="pl-paper" x="-40" y="-40" width="920" height="${640 + band}"/>
  ${chrome ? `<rect class="pl-line" x="18" y="18" width="804" height="${524 + band}"/>
              <rect class="pl-hair" x="26" y="26" width="788" height="${508 + band}"/>` : ''}
  <clipPath id="${fid}"><rect x="${zx}" y="${zy}" width="${zw}" height="${zh}"/></clipPath>
  <g class="pl-dim">${BASE_}</g>
  <g clip-path="url(#${fid})">${BASE_}</g>
  ${post(plate, plate.draw(t))}
  ${chrome ? scalebar() + titleBlockSvg(titleBlock, 534 + band) : ''}
</svg>`
}
