/*
 * What quality of water each card hands on, read from the links alone (C10, Eric 2026-11-02). All
 * water stays one pool of litres; this only says whether the links make any of it drinkable, and
 * where raw water reaches a card that warns about it. Pure, so the engine and the builder read the
 * same answer. A pass-through or a heater gives what entered it, so a tank cannot launder rain.
 */
export const DRINKING = 'IO-09'
export const RAW = 'IO-16'
export const HOT = 'IO-17'

const has = (list, io) => (list || []).some((x) => x.io === io)
const isConduit = (s, io) => (s.conduit_for || []).includes(io)

export function waterQualities(nodes, edges, solById, { mainsOff = false } = {}) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const solOf = (id) => solById[(byId.get(id) || {}).sol]
  // A link named its flows when it was made; an older one carries whatever the two cards share.
  const carries = (e, io) => (e.ios && e.ios.length
    ? e.ios.includes(io)
    : has((solOf(e.from) || {}).outputs, io) && has((solOf(e.to) || {}).inputs, io))
  const out = new Map(nodes.map((n) => [n.id, { drinking: false, raw: false }]))
  const into = (id) => edges.filter((e) => e.to === id && out.has(e.from))

  for (let pass = 0, changed = true; changed && pass <= nodes.length; pass += 1) {
    changed = false
    for (const n of nodes) {
      const s = solById[n.sol]
      if (!s) continue
      const cur = out.get(n.id)
      const gets = (q, ...ios) => into(n.id).some((e) => out.get(e.from)[q] && ios.some((io) => carries(e, io)))
      const takesWater = has(s.inputs, RAW) || has(s.inputs, DRINKING)
      let drinking = false, raw = false
      if (s.societal === 'supply') {
        drinking = has(s.outputs, DRINKING) && !mainsOff
      } else if (isConduit(s, DRINKING) || isConduit(s, RAW) || has(s.outputs, HOT)) {
        drinking = gets('drinking', DRINKING)
        raw = gets('raw', RAW)
      } else if (has(s.outputs, DRINKING)) {
        drinking = gets('raw', RAW) || gets('drinking', DRINKING)
      } else if (has(s.outputs, RAW) && !takesWater) {
        raw = true
      }
      if (drinking !== cur.drinking || raw !== cur.raw) {
        out.set(n.id, { drinking, raw })
        changed = true
      }
    }
  }
  return { out, carries, into }
}

/*
 * Whether the system's drinking water is used. A fed filter makes drinking water, but with its
 * output linked to nothing it is not assumed to reach anyone (Eric, 2026-11-02): it is flagged, and
 * not counted until it is linked. Null where the system asks nothing of drinking water.
 *   ok       drinking water reaches a card or the humans in the home
 *   unused   a fed card makes it and nothing takes it
 *   none     something asks for it and nothing fed makes it
 */
export function drinkingWater(nodes, edges, solById, opts) {
  const { out, carries } = waterQualities(nodes, edges, solById, opts)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const carrying = edges.filter((e) => out.has(e.from) && carries(e, DRINKING))
  const passesOn = (id) => {
    const s = solById[(byId.get(id) || {}).sol]
    return !!s && isConduit(s, DRINKING)
  }
  const reached = carrying.some((e) => out.get(e.from).drinking && !passesOn(e.to))
  if (reached) return { state: 'ok' }
  const loose = nodes.find((n) => out.get(n.id).drinking && (solById[n.sol] || {}).societal !== 'supply'
    && !carrying.some((e) => e.from === n.id))
  if (loose) return { state: 'unused', nodeId: loose.id, solutionId: loose.sol }
  // A card with no raw alternative that nothing feeds with drinking water.
  const asks = nodes.some((n) => {
    const s = solById[n.sol]
    if (!s || !has(s.inputs, DRINKING)) return false
    const group = (s.input_groups || []).find((g) => g.includes(DRINKING)) || [DRINKING]
    return !group.includes(RAW) && !edges.some((e) => e.to === n.id && group.some((io) => io !== DRINKING && carries(e, io)))
  })
  return carrying.length || asks ? { state: 'none' } : null
}

/*
 * The cards raw water reaches and that warn about it, straight or through a heater: card id →
 * { from, mixed }. `from` lists the cards the untreated water arrives from; `mixed` is true when
 * treated water reaches the card too (a mains and a stove coil on one shower), so the warning
 * can name the one that is not, rather than read as if all of it were untreated.
 */
export function rawWaterWarnings(nodes, edges, solById) {
  const { out, carries, into } = waterQualities(nodes, edges, solById)
  const flagged = new Map()
  for (const n of nodes) {
    const warn = (solById[n.sol] || {}).input_warn
    if (!warn || !warn[RAW]) continue
    const links = into(n.id)
    const from = links.filter((e) => out.get(e.from).raw && (carries(e, RAW) || carries(e, HOT))).map((e) => e.from)
    if (!from.length) continue
    const mixed = links.some((e) => out.get(e.from).drinking && (carries(e, DRINKING) || carries(e, HOT)))
    flagged.set(n.id, { from: [...new Set(from)], mixed })
  }
  return flagged
}
