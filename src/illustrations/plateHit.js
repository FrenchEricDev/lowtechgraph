/*
 * Which pick a tap on a drawing meant. A pick's layer is thin lines, so a tap had to land on a
 * stroke (a user's session, 2026-11-03: "very precise, hard to click"). A tap that misses every
 * layer now looks around it, in rings out to about 24 px, and takes the first pick it meets:
 * the nearest one, so two picks drawn close together never share a tap. A tap on a stroke still
 * wins outright.
 */
const RINGS = [6, 12, 18, 24]
const STEPS = 12

export function plateAt(e, root, wanted) {
  const hit = (el) => {
    const g = el && el.closest && el.closest('[data-plate]')
    return g && root.contains(g) && wanted(g.dataset.plate) ? g.dataset.plate : null
  }
  const direct = hit(e.target)
  if (direct) return direct
  const { clientX: x, clientY: y } = e
  for (const r of RINGS) {
    for (let i = 0; i < STEPS; i++) {
      const a = (i / STEPS) * 2 * Math.PI
      const found = hit(document.elementFromPoint(x + r * Math.cos(a), y + r * Math.sin(a)))
      if (found) return found
    }
  }
  return null
}
