// The fifteen need icons. This file is the source of truth; the study page Demo-Need-Icons.html
// is not.
//
// Every need is drawn on the plates' small house: south on the right, ground at y=19. The house
// is thin faded ink, the need the one heavy accent mark, details at hair weight.
//
// Pure strings, no React: scripts/prerender.mjs imports this too, so the static page and the
// app draw the same icon.
//
// At 20px and under the room icons blur, so those sizes get the chip profile (need-icon.css).
// Prefer 24 as the floor.

const HOUSE = `<path class="nic-h" d="M1.5,19 H22.5 M5,19 V10.2 M19,19 V10.2 M3,11 L12,3 L21,11"/>`

// The same helper as the plates (illustrations/plates.js): an arrowhead derived from the
// direction of its line, so no arrow can point where its line does not go.
function arrow(x, y, dx, dy, size = 2.4) {
  const m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m, nx = -uy, ny = ux
  const bx = x - ux * size, by = y - uy * size, w = size * .62, f = (n) => Math.round(n * 100) / 100
  return `<path class="nic-a" d="M${f(bx + nx * w)},${f(by + ny * w)} L${x},${y} L${f(bx - nx * w)},${f(by - ny * w)}"/>`
}

const MARKS = {
  'FN-01': () => `<path class="nic-a" d="M5,19 V10.2 M19,19 V10.2 M5,19 L19,10.2"/>`,
  'FN-02': () => [8.8, 12, 15.2].map((x) => `<path class="nic-a" d="M${x},17.6 q-1.15,-1.2 0,-2.4 q1.15,-1.2 0,-2.4"/>`).join(''),
  'FN-03': () => `<path class="nic-a" d="M1.8,15.4 C7,12.6 15,17.6 20.4,14.6"/>${arrow(22.4, 13.6, 2, -1)}`,
  'FN-04': () => `<circle class="nic-a" cx="21" cy="6.4" r="1.25"/>
              <path class="nic-ah" d="M21,3.7 V4.3 M21,8.5 V9.1 M18.3,6.4 H18.9 M23.1,6.4 H23.7"/>
              <path class="nic-a" d="M17.9,12.2 H20.1 M17.9,15.6 H20.1"/>
              <path class="nic-at" d="M19,12.2 L19,15.6 L12.4,18.6 L8.4,18.6 Z"/>
              <path class="nic-a" d="M8.4,18.3 H12.4"/>`,
  'FN-05': () => `<path class="nic-a" d="M5,19 V10.2 M6.9,19 V11.4"/>
              <path class="nic-ah" d="M0.75,12.6 A2.7,2.7 0 0 1 0.75,17 M1.72,11.2 A4.4,4.4 0 0 1 1.72,18.4"/>`,
  'FN-06': () => `<path class="nic-a" d="M12,10.6 C12,10.6 9.2,13.9 9.2,15.7 A2.8,2.8 0 0 0 14.8,15.7 C14.8,13.9 12,10.6 12,10.6 Z"/>
              <path class="nic-a" d="M23,17.4 H17.6"/>${arrow(16.2, 17.4, -1, 0)}`,
  'FN-07': () => `<path class="nic-a" d="M9.1,15.2 A3,3 0 1 1 11.2,17.9"/>${arrow(9.4, 17.3, -1.1, -.9, 2.1)}`,
  'FN-08': () => `<path class="nic-a" d="M12,13.4 V18.2"/>${arrow(12, 19, 0, 1, 2.1)}
              <path class="nic-hid" d="M12,19.4 V20.6 M8.6,20.8 H15.4 V23.2 H8.6 Z"/>`,
  'FN-09': () => `<path class="nic-a" d="M14.2,4.3 L18.6,8.2"/>
              <path class="nic-a" d="M12.9,11.4 L10.8,14.6 H13.2 L11.1,17.9"/>`,
  'FN-10': () => `<path class="nic-a" d="M8.6,15.2 H15.4 V17.2 A1.6,1.6 0 0 1 13.8,18.8 H10.2 A1.6,1.6 0 0 1 8.6,17.2 Z M7.4,15.9 H8.6 M15.4,15.9 H16.6"/>
              <path class="nic-ah" d="M10.6,13.6 q-.8,-.9 0,-1.8 M13.4,13.6 q-.8,-.9 0,-1.8"/>`,
  'FN-11': () => `<path class="nic-a" d="M19,11 H13.4 M11.4,13 A2,2 0 0 1 15.4,13 Z"/>
              <path class="nic-ah" d="M12,14.7 L11.5,16.9 M13.4,14.7 V17.1 M14.8,14.7 L15.3,16.9"/>`,
  'FN-12': () => `<path class="nic-at" d="M5,19 V14.4 H11.4 V19 Z"/>
              <path class="nic-a" d="M5,14.4 H19 M11.4,14.4 V19 M15.6,14.4 V8.6"/>`,
  'FN-13': () => `<path class="nic-a" d="M8.4,17.6 L13,13 M13,13 A3,3 0 0 1 15.2,8.9 L13.9,10.9 L15.1,12.1 L17.1,10.8 A3,3 0 0 1 13,13"/>`,
  'FN-14': () => `<path class="nic-a" d="M20.2,14.6 H23.6 M20.6,14.6 L21,19 H22.8 L23.2,14.6 M21.4,13.6 H22.4"/>`,
  'FN-15': () => `<path class="nic-a" d="M8.4,14.4 A5,5 0 0 1 15.6,14.4 M10.1,16 A2.6,2.6 0 0 1 13.9,16"/>
              <circle class="nic-af" cx="12" cy="17.6" r="1.05"/>`,
}

// The needs that are a place in the house, as against those that happen in the rooms. Not used
// for drawing: the first half of the built house's slot plan.
export const PLACE_NEEDS = new Set(["FN-01", "FN-03", "FN-04", "FN-05", "FN-08", "FN-09", "FN-12", "FN-13", "FN-14"])

export const hasNeedIcon = (fnId) => Object.prototype.hasOwnProperty.call(MARKS, fnId)

/** One need icon as an SVG string. Decorative: it always sits beside the need's name. */
export function needIconSvg(fnId, { size = 32 } = {}) {
  const mark = MARKS[fnId]
  if (!mark) return ''
  const chip = size <= 20 ? ' nic-chip' : ''
  // Whitespace between tags is stripped: inside an <h1>, those text nodes became part of the
  // heading's textContent.
  return (`<svg class="nic${chip}" viewBox="0 0 24 24" width="${size}" height="${size}" `
    + `aria-hidden="true" focusable="false">${HOUSE}${mark()}</svg>`).replace(/>\s+</g, '><')
}
