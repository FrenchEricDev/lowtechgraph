import * as cat from '../catalogue.js'
import Nav from '../Nav.jsx'
import { plateFor, plateSvg } from './plates.js'
import { sitePlateFor, sitePlateSvg } from './sitePlates.js'
import './plate.css'

/*
 * One drawing per section of Why (brief 11, C): a solution's close-up bubble from its plate (or,
 * for a plate without one, its focus zone squared), cut round, linking to its page. The plates'
 * labels are hidden at this size; the caption names the solution. The hand or person the mock-up
 * put in each bubble waits with the figure for scale (brief 02: not for now).
 */
function crop(plate, svg) {
  // The plate's close-up bubble where it has one (its centre and radius).
  const m = [...svg.matchAll(/<circle class="ov-fill" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
    .map((x) => x.slice(1).map(Number)).find((c) => c[2] > 30)
  if (m) {
    const [cx, cy, r] = m
    return [cx - r, cy - r, 2 * r, 2 * r, true]
  }
  // Else the plate's own tight framing (its crop) where it has one, then its focus zone, squared.
  const [x, y, w, h] = plate.crop || plate.zone
  const side = Math.max(w, h) * (plate.crop ? 1 : 1.1)
  return [x + w / 2 - side / 2, y + h / 2 - side / 2, side, side, false]
}

// A label's leader: a straight hair line from outside the crop (where the hidden word sits) to the
// object inside. Without its word it reads as a stray stroke, so it goes.
function dropLeaders(svg, [x, y, w, h]) {
  const round = w === h
  const inside = (px, py) => (round
    ? Math.hypot(px - (x + w / 2), py - (y + h / 2)) <= w / 2
    : px >= x && px <= x + w && py >= y && py <= y + h)
  return svg.replace(/<path class="ov-line hair(?: pl-leader)?" d="M([\d.]+),([\d.]+) ?L ?([\d.]+),([\d.]+)"\/>/g, (m, a1, b1, a2, b2) =>
    (inside(+a1, +b1) !== inside(+a2, +b2) ? '' : m))
}

export default function WhyBubble({ solId, go }) {
  const sol = cat.solById[solId]
  const plate = plateFor(solId) || sitePlateFor(solId)
  if (!sol || !plate) return null
  const t = (en, fr) => (cat.getLang() === 'fr' ? fr : en)
  const render = plate.base === 'site' ? sitePlateSvg : plateSvg
  let svg = render(plate, { t, chrome: false })
  const [cx, cy, cw, ch, isBubble] = crop(plate, svg)
  const box = [cx, cy, cw, ch]
  const vb = box.map((n) => Math.round(n * 10) / 10).join(' ')
  svg = dropLeaders(svg, box).replace(/viewBox="[^"]*"/, `viewBox="${vb}"`)
  const to = { view: 'solution', id: solId }
  return (
    <figure className="why-bubble">
      {/* The caption is the link to tab to; the drawing repeats it for a pointer only. */}
      <Nav route={to} go={go} className="why-bubble-link" tabIndex={-1} aria-hidden="true">
        <span className={'plate why-bubble-sheet' + (isBubble ? '' : ' is-section')} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
      </Nav>
      <figcaption><Nav route={to} go={go} className="link">{cat.tName(sol)}</Nav></figcaption>
    </figure>
  )
}
