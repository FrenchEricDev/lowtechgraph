/*
 * The system check's next moves (B17), as data: which one thing to offer for a verdict, and which
 * solutions to offer when the move is to add a supply. Pure, so the panel and the random-system
 * batch (scripts/qa-random-systems.mjs) run the same logic; the panel turns a move into a button.
 */
import { FAMILIES } from './engine.js'

// Greywater, blackwater, treated effluent: dirty water is in the family but supplies nobody.
export const USED_WATER = ['IO-10', 'IO-11', 'IO-26']
// The inputs that make supply bigger, in the order a next move offers them.
export const SUPPLY_INPUTS = ['catchment-area', 'array-kwp', 'collector-area', 'head', 'flow', 'flow+head', 'feedstock']
const STREAM_INPUTS = ['flow', 'flow+head', 'head']


/*
 * What to offer for a resource something lacks (Eric, 2026-10-30, after the random systems: a toilet
 * short of water was offered three cards that need water, a dishwasher never saw a solar panel).
 * A card that takes the same resource in and gives it out supplies nothing, so it goes. Then low-tech
 * first, as everywhere; then what makes the resource from a natural or household one; then what we
 * hold the best figure for, so the check can answer once it is added (not the alphabet: that cut solar
 * panels from the list as soon as wind and pedals had figures).
 */
export function rankSupply(sols, io, data, limit = 3) {
  const free = new Set([...(data.natural_resources || []), ...(data.household_sources || [])].map((n) => n.io))
  // P1 is the most precise; a figure the check does not use is as good as none here.
  const figure = {}
  for (const c of data.coefficients || []) {
    if (c.role === 'in' || c.io_type_id !== io || c.engine_use === false) continue
    const p = Number(String(c.precision).replace('P', '')) || 3
    figure[c.solution_id] = Math.min(figure[c.solution_id] ?? 9, p)
  }
  const isSource = (s) => (s.inputs || []).every((i) => free.has(i.io))
  const name = (s) => s.sortName || s.name
  return sols
    .filter((s) => (s.outputs || []).some((o) => o.io === io) && !(s.inputs || []).some((i) => i.io === io))
    .sort((a, b) => (a.benchmark ? 1 : 0) - (b.benchmark ? 1 : 0)
      || (isSource(a) ? 0 : 1) - (isSource(b) ? 0 : 1)
      || (figure[a.id] ?? 9) - (figure[b.id] ?? 9)
      || name(a).localeCompare(name(b)))
    .slice(0, limit)
}

// The cards an uncounted conversion rests on: its own open inputs first, then any in the family.
const openFor = (fam, f, result) => {
  const stuck = new Set((f.uncounted || []).filter((u) => u.why === 'ratio-no-input' || u.why === 'capacity-starved').map((u) => u.nodeId))
  const open = result.unfed || []
  return open.find((u) => stuck.has(u.nodeId) && !USED_WATER.includes(u.io)) || open.find((u) => u.family === fam && !USED_WATER.includes(u.io)) || null
}

/* The one move for a verdict: { kind, ... }, or null when the site has nothing to point to. */
export function moveFor(fam, f, result, scenario, unlinkedSuppliers = () => []) {
  if (f.verdict === 'green') return null
  if (f.verdict === 'supplied') return result.hasMains ? { kind: 'mains' } : null
  const r = new Set(f.reasons)
  // Drinking water made and not used: a link to what needs it, or to the people, is the whole fix (C10).
  if (r.has('drinking-unused')) return { kind: 'link-drinking', nodeId: f.drinking.nodeId, io: 'IO-09', solutionId: f.drinking.solutionId }
  if (r.has('no-drinking')) {
    const open = openFor(fam, f, result)
    if (open) return { kind: 'supply', nodeId: open.nodeId, io: open.io, solutionId: open.solutionId }
  }
  if (f.verdict === 'grey') {
    // Figures that wait for the reader's stream: nothing else can be said until it is given.
    const stream = STREAM_INPUTS.find((i) => (result.scaleInputs || []).includes(i))
    if (r.has('missing-scenario') && stream && (!scenario.flow || (stream === 'flow+head' && !scenario.head))) {
      return { kind: 'stream', input: !scenario.flow ? stream : 'head' }
    }
    if (r.has('no-supply')) {
      const u = unlinkedSuppliers(fam)
      if (u.length) return { kind: 'reveal', nodes: u.map((x) => x.nodeId), solutionId: u[0].solutionId }
    }
    if (r.has('fuel-needed') && (result.fuelInputs || []).length) return { kind: 'fuel', io: result.fuelInputs[0].io }
    if (r.has('no-supply') || r.has('ratio-no-input') || r.has('capacity-starved')) {
      const open = openFor(fam, f, result)
      if (open) return { kind: 'supply', nodeId: open.nodeId, io: open.io, solutionId: open.solutionId }
    }
    if (r.has('no-demand')) {
      const out = (result.unused || []).find((u) => u.family === fam)
      if (out) return { kind: 'use', nodeId: out.nodeId, io: out.io, solutionId: out.solutionId }
    }
    return null
  }
  // Either way or unlikely: the step that limits the flow first, then a bigger supply. A step that
  // caps the flow: more of the same, side by side, is what lifts it (Eric, 2026-10-20), not another
  // kind of filter.
  if (f.clampedBy && f.clampedBy.length) return { kind: 'parallel', solutionId: f.clampedBy[0] }
  // The setting that makes THIS resource's supply bigger: the one its own rows scale with.
  const own = (f.rows || []).map((row) => row.basis && row.basis.scale_input).filter((i) => SUPPLY_INPUTS.includes(i))
  const input = SUPPLY_INPUTS.find((i) => own.includes(i) && (result.scaleInputs || []).includes(i))
  if (input) return { kind: 'field', input }
  const supplier = (f.rows || []).find((row) => row.coef && row.coef.role !== 'in')
  return supplier ? { kind: 'compare', solutionId: supplier.solutionId } : null
}

