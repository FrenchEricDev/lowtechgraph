/*
 * The adequacy engine: does this graph work out?
 *
 * Pure: no React, no user-facing strings. It takes a graph and a scenario and returns numbers
 * and reason codes; the sentences live in the strings files.
 *
 * Rules. Propagate low with low and high with high: a band entirely below 1 is red, entirely
 * above is green, straddling is yellow; never a percentage. Grey (could not compute) is its own
 * state, never a shade of yellow. Compute annual and worst month and report the worse. Union
 * bases for one quantity only within a precision class. One verdict per IO family, no roll-up.
 * Behaviour is never asked: a behavioural basis widens the band.
 *
 * Flows are pooled per IO type and nodes processed by kind (sources, capacities, ratios,
 * demands), not by walking edges. Two ratios competing for one pool apply in sheet order.
 *
 * Only what is linked is counted, where the caller asks for it (`graph.linkedOnly`, set by the
 * builder; Eric, 2026-10-12): a card with no link at all is left out of every sum and returned in
 * `unlinked`, so the panel can say so. One card alone on the canvas is still checked: it has
 * nothing to be linked to. Known limit: two separately linked groups still share a pool.
 *
 * Known limits: a ratio with an empty input pool produces nothing and says so (RATIO_NO_INPUT);
 * the worst-month rainwater profile is source-dependent, so that verdict is weaker evidence
 * than the annual one.
 */
import { drinkingWater } from './water.js'

/* Defaults are the answer for most readers, so the panel states them inside the verdict. */
export const DEFAULT_SCENARIO = {
  people: 2,            // Charter 3 working placeholder: 2 full-time occupants
  catchmentArea: 100,   // m2 of roof
  collectorArea: 4,     // m2 of solar collector
  arrayKwp: 3,          // a common domestic array
  // Empty by design, like the energy label: a default would assert a stream the reader may not have,
  // and a ram pump read 225 times the need on a stream nobody had mentioned (Eric, 2026-10-30).
  head: null,           // m
  flow: null,           // m3/s
  dryYearFactor: 0.80,  // p10 of the 34-year series: a TYPICAL dry year, not the worst
  zone: 'SITE-CAEN',
  floorArea: 100,      // m2 heated. Close to the French median for a house.
  // Empty by design: a default energy label would assert something about the reader's building,
  // and the band differs sixfold between A and G.
  fabricClass: '',
  // Fuel brought in, per IO type, per year, in that fuel's density unit (kg, or m3 for gas).
  // Empty by default.
  fuelStock: {},
  feedstock: 0,       // kg of wet kitchen waste per year, for a digester
  // What if the mains stopped: every societal supply contributes nothing and the ordinary
  // arithmetic runs.
  mainsOff: false,
}

/*
 * SUPPLIED is its own state: a mains connection does not have to balance. A subscription's kVA
 * limits instantaneous power, not the daily energy summed here, so computing a band from it
 * would print green for the wrong reason.
 */
export const VERDICT = { RED: 'red', YELLOW: 'yellow', GREEN: 'green', GREY: 'grey', SUPPLIED: 'supplied' }

export const REASON = {
  NO_FIGURE: 'no-figure',                 // a placed row carries no coefficient
  NOT_A_FLOW: 'not-a-flow',               // a sizing figure, shown but never summed
  RATIO_APPLIED: 'ratio-applied',         // a conversion changed the numbers
  RATIO_NO_INPUT: 'ratio-no-input',       // a converter with nothing feeding it
  CONVERTER_TOOK_POOL: 'converter-took-pool', // a converter consumed a shared supply
  CAPACITY_CLAMPED: 'capacity-clamped',   // a throughput limit bound the flow
  CAPACITY_STARVED: 'capacity-starved',   // a pass-through with nothing reaching it
  PARALLEL_CAPACITY: 'parallel-capacity', // several pass-throughs share the load
  SERIES_ASSUMED: 'series-assumed',       // could not tell parallel from series
  PARTIAL_COVERAGE: 'partial-coverage',   // some placed rows counted, others not
  NO_SUPPLY: 'no-supply',                 // demand present, nothing produces it
  NO_DEMAND: 'no-demand',                 // supply present, nothing consumes it
  BEHAVIOUR_WIDENS: 'behaviour-widens',   // a behavioural basis is in the band
  BASES_UNIONED: 'bases-unioned',         // two sourced bases for one quantity
  BASIS_SET_ASIDE: 'basis-set-aside',     // a less precise basis for it was not used
  WORST_MONTH_BINDS: 'worst-month-binds', // worst month is worse than annual
  UNIT_MISMATCH: 'unit-mismatch',         // a conversion would mix incompatible units
  FUEL_SUPPLIED: 'fuel-supplied',         // a fuel stock the reader entered was used
  FUEL_NEEDED: 'fuel-needed',             // something burns fuel and none was entered
  MISSING_SCENARIO: 'missing-scenario',   // a needed scale input was not supplied
  MONTHLY_IS_P2: 'monthly-is-p2',         // worst-month rainfall is source-dependent
  MONTHLY_ONE_SOURCE: 'monthly-one-source', // the same, outside France: one source, none to compare
  DRINKING_UNUSED: 'drinking-unused',     // a fed card makes drinking water and nothing takes it
  NO_DRINKING: 'no-drinking',             // something asks for drinking water and nothing fed makes it
  MAINS_SUPPLIED: 'mains-supplied',       // a societal connection covers this family
  MAINS_OFF: 'mains-off',                 // the reader asked what happens without it
  HOUSEHOLD_DEMAND: 'household-demand',   // the household's own need was added in
  BYPRODUCT_SPARE: 'byproduct-spare',     // a waste stream nothing on the canvas uses
  OUTPUT_UNLINKED: 'output-unlinked',     // a pass-through whose output is linked to nothing
}

/*
 * The daily unit of each family. Everything entering a family must be in its unit; a conversion
 * between units is refused (UNIT_MISMATCH).
 */
export const FAMILY_UNIT = {
  water: 'L/day', electricity: 'kWh/day', heat: 'kWh/day', fuel: 'kWh/day',
  cooling: 'kWh/day', hotwater: 'kWh/day', cooking: 'kWh/day', personal: 'kWh/day',
  flue: 'kWh/day', reject: 'L/day',
}

/*
 * Byproduct families are pooled like any other but never get a verdict: what they report is
 * what is going spare. Each needs its own family: reject water in `water` would overstate
 * supply, and flue heat is not room heat.
 */
export const BYPRODUCT_FAMILIES = new Set(['flue', 'reject'])

/*
 * IO families that share a unit. A shared unit is not a shared pool: cooling is not heat
 * supply, and hot water is not space heat.
 */
export const FAMILIES = {
  water: ['IO-08', 'IO-09', 'IO-10', 'IO-11', 'IO-16', 'IO-17', 'IO-26', 'IO-33'],
  electricity: ['IO-03', 'IO-18'],
  heat: ['IO-35', 'IO-36', 'IO-37'],
  fuel: ['IO-04', 'IO-29', 'IO-30', 'IO-34'],
  cooling: ['IO-24'],
  hotwater: ['IO-41'],
  // A heat IO names a use, not a temperature. Cooking and personal heating have their own
  // pools: a room-sized stove must not satisfy a cooking demand, and personal heating
  // substitutes for space heat rather than supplying it.
  cooking: ['IO-44'],
  personal: ['IO-45'],
  flue: ['IO-42'],
  reject: ['IO-43'],
}

/*
 * Is there a directed path between two solutions? Used only to tell parallel pass-throughs
 * (throughputs add) from series ones.
 */
function connected(edges, a, b) {
  const adj = new Map()
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from).push(e.to)
  }
  const reach = (from, to) => {
    const seen = new Set([from])
    const stack = [from]
    while (stack.length) {
      const n = stack.pop()
      if (n === to) return true
      for (const nx of adj.get(n) || []) if (!seen.has(nx)) { seen.add(nx); stack.push(nx) }
    }
    return false
  }
  return reach(a, b) || reach(b, a)
}

const familyOf = (ioId) =>
  Object.keys(FAMILIES).find((f) => FAMILIES[f].includes(ioId)) || null

const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const YEAR = 365.25

/** Multiply two [lo,hi] bands.  Bands are non-negative here by construction. */
const mul = (a, b) => [a[0] * b[0], a[1] * b[1]]
const addInto = (acc, b) => [acc[0] + b[0], acc[1] + b[1]]
/*
 * Union: the widest span covering both. Only for defensible bases of one quantity in the same
 * precision class.
 */
const union = (a, b) => (a ? [Math.min(a[0], b[0]), Math.max(a[1], b[1])] : b)
/*
 * Precision class as a rank, lower is better. Across classes the better basis is used and the
 * other goes to the reference figures.
 */
const PRECISION_RANK = { P1: 1, P2: 2, P3: 3 }
const precisionRank = (coef) => PRECISION_RANK[String((coef && coef.precision) || '').toUpperCase()] || 4

/*
 * How much of the annual-mean irradiance the period carries: 1 for annual, the worst month's
 * daily mean over the year's for the month.
 *
 * The PV profile stands in for all solar so PV and thermal cannot disagree about which month is
 * worst. It is optimistic for thermal collectors in winter (losses stay while gain falls), so a
 * thermal row should carry a wide low end.
 *
 * Null when the scale input is present but the climate is not, so the row becomes
 * missing-scenario rather than unscaled.
 */
/*
 * The seasonal share a basis declares through `climate_input`, never inferred from the case: a
 * fog net's yield is anti-correlated with sunshine and must not be scaled by it.
 */
function seasonalShare(basis, climate, period) {
  if (!basis || basis.climate_input !== 'irradiance') return 1
  return irradianceShare(climate, period)
}

// Base temperature for heating degree-days: 18 C, the French DJU convention.
const HEATING_BASE_C = 18

/*
 * How much harder the coldest month works than the average day. A normalised share, not a
 * magnitude: degree-days from monthly means understate, but as a share the bias mostly divides
 * out and leaves the worst month slightly worse, which is the tolerable direction.
 *
 * 1 for annual, null when the climate has no temperature profile.
 */
function heatingShare(climate, period) {
  if (period !== 'month') return heatingShares(climate) ? 1 : null
  const shares = heatingShares(climate)
  if (!shares) return null
  const worst = Math.max(...shares)
  const i = shares.indexOf(worst)
  // The coldest month's share of the year's heat, spread over its own days, against
  // the flat daily rate the annual figure implies.
  return (worst / DAYS[i]) * YEAR
}

/*
 * Each month's share of the year's heating degree-days. Prefers degree-days computed from daily
 * temperatures; the fallback from monthly means understates them.
 */
function heatingShares(climate) {
  const dd = climate && climate.degree_days
  // The ten-year window: a divisor is the wrong place for a short sample.
  const shape = dd && dd.shape && dd.shape.monthly_hdd_share
  if (Array.isArray(shape) && shape.length === 12) return shape
  const t = climate && climate.temperature
  if (!t || !Array.isArray(t.monthly_mean_c) || t.monthly_mean_c.length !== 12) return null
  const hdd = t.monthly_mean_c.map((c, i) => Math.max(0, HEATING_BASE_C - c) * DAYS[i])
  const total = hdd.reduce((a, b) => a + b, 0)
  if (!total) return null
  return hdd.map((h) => h / total)
}

// The fabric table is keyed by RE2020 zone. Caen is in H1a, not H2a (1988 of 2000 DPE records
// for the commune).
const FABRIC_ZONE = { 'SITE-CAEN': 'H1a' }
// Two zones' reference points have no confirmed station (scripts/data/climate-zones.json): the
// nearest town names them, or the panel would say Caen for figures that are not Caen's.
const UNNAMED_POINT = { H1c: 'Mâcon', H2d: 'Carpentras' }

/*
 * The heating need of a labelled house outside France (Eric, 2026-11-03: "scale by winters"). The
 * labels are French, so are the houses behind them: each zone's band is divided by that zone's
 * heating degree-days, the median across zones is taken, and it is multiplied by the reader's own.
 * Ten-year windows on both sides, so the scaling compares like with like. What it cannot see: how
 * building practice differs from France's, and the sun's share of the heat, so it is disclosed as
 * an estimate from French homes and its precision drops a step.
 */
function fabricAbroad(rows, zones, climate) {
  const hdd = (z) => z && z.degree_days && z.degree_days.shape && z.degree_days.shape.hdd18
  const here = hdd(climate)
  if (here == null) return null
  const perDd = rows.map((r) => ({ r, dd: hdd(zones[r.zone]) })).filter((x) => x.dd > 0)
  if (!perDd.length) return null
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b)
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
  }
  const lo = median(perDd.map((x) => Number(x.r.low) / x.dd))
  const hi = median(perDd.map((x) => Number(x.r.high) / x.dd))
  return {
    ...perDd[0].r,
    zone: null,
    low: lo * here,
    high: hi * here,
    sample: perDd.reduce((a, x) => a + (Number(x.r.sample) || 0), 0),
    precision: 'P3',
    scaledBy: { hdd: Math.round(here), zones: perDd.length },
  }
}

/*
 * Rescales an absolute solar yield measured at one place to the reader's location. Only rows
 * that declare a reference zone are touched: a national range scaled by a local ratio would
 * look more precise around the wrong centre. The ratio is applied, not a replacement, so the
 * band keeps its year-to-year width.
 */
function sitedYieldFactor(coef, climate, zones) {
  const ref = coef && coef.reference_zone
  if (!ref) return 1
  const here = climate && climate.pv && climate.pv.annual_kwh_per_kwp
  const there = zones && zones[ref] && zones[ref].pv && zones[ref].pv.annual_kwh_per_kwp
  // A region outside France with no solar figure: no yield, rather than the French one.
  if (!here && climate && climate.abroad) return null
  if (!here || !there) return 1
  return here / there
}

function irradianceShare(climate, period) {
  if (period !== 'month') return 1
  const pv = climate && climate.pv
  if (!pv || !pv.monthly_kwh_per_kwp || !pv.annual_kwh_per_kwp) return null
  const m = pv.monthly_kwh_per_kwp
  const worst = Math.min(...m)
  const perDay = worst / DAYS[m.indexOf(worst)]
  return perDay / (pv.annual_kwh_per_kwp / YEAR)
}

/**
 * Daily contribution of one coefficient row, as a band, for one period.
 * Returns null when the row cannot be turned into a daily quantity.
 */
function dailyBand(coef, basis, scenario, climate, period, ioById = {}, zonesForYield = {}) {
  if (!basis) return null
  // A sizing figure (m2 per person-equivalent) is a real sourced quantity and
  // belongs on a solution page, but it is not a flow and must never enter a pool
  // measured in litres or kWh per day. Data-driven so the rule extends with the
  // vocabulary rather than living as a list in here.
  if (basis.contributes_to_flow === false) return null
  let band = [Number(coef.low), Number(coef.high)]
  if (!Number.isFinite(band[0]) || !Number.isFinite(band[1])) return null

  const people = scenario.people
  const perDayFromYear = (b) => [b[0] / YEAR, b[1] / YEAR]

  switch (basis.basis) {
    case 'per m2 of catchment per mm of rain': {
      const area = scenario.catchmentArea
      const rain = climate && climate.rain
      if (!area || !rain) return null
      // Annual uses the dry-year basis, worst month the driest month; both mm/day (1 mm on 1 m2
      // is 1 L). The dry-year factor scales both periods, or the annual band comes out better
      // than the month inside it.
      const dry = scenario.dryYearFactor ?? 1
      let mmPerDay
      if (period === 'month') {
        const worst = Math.min(...rain.monthly_mm)
        mmPerDay = (worst * dry) / DAYS[rain.monthly_mm.indexOf(worst)]
      } else {
        mmPerDay = (rain.annual_mm * dry) / YEAR
      }
      return mul(band, [area * mmPerDay, area * mmPerDay])
    }
    case 'per kWp per year': {
      const kwp = scenario.arrayKwp
      if (!kwp) return null
      const share = seasonalShare(basis, climate, period)
      if (share === null) return null
      const sited = sitedYieldFactor(coef, climate, zonesForYield)
      if (sited === null) return null
      return mul(perDayFromYear(band), [kwp * share * sited, kwp * share * sited])
    }
    case 'per m2 of collector per year':
    case 'per m2 of collector': {
      // A solar collector: the same seasonal swing and location as PV apply, or the worst month
      // would equal the annual.
      const area = scenario.collectorArea
      if (!area) return null
      const share = seasonalShare(basis, climate, period)
      if (share === null) return null
      const b = basis.basis.endsWith('per year') ? perDayFromYear(band) : band
      const sitedC = sitedYieldFactor(coef, climate, zonesForYield)
      if (sitedC === null) return null
      return mul(b, [area * share * sitedC, area * share * sitedC])
    }
    case 'per person per day':
    case 'per person-equivalent':
    case 'per m2 per person-equivalent':
      if (!people) return null
      return mul(band, [people, people])
    case 'per person per year':
      if (!people) return null
      return mul(perDayFromYear(band), [people, people])
    case 'dimensionless ratio':
      // Not a daily quantity at all: a multiplier applied to whatever reaches it.
      // Returned unscaled, and only ever consumed by the RATIO branch.
      return band
    case 'per kg of wet feedstock': {
      // Biogas produced from the reader's own kitchen waste, then converted to kWh
      // by the RESOURCE's energy density -- the same two-step the fuel stock uses.
      // The coefficient is m3 per kg; the fuel family is kWh/day.
      const kg = scenario.feedstock
      const dens = (ioById[coef.io_type_id] || {}).energy_density
      if (!kg || !dens) return null
      return [band[0] * kg * dens.low / YEAR, band[1] * kg * dens.high / YEAR]
    }
    case 'per m3/s per metre of head': {
      // Micro-hydro: the coefficient already carries g and the chain efficiencies, so this is Q
      // x H, then kW to kWh/day over 24 hours. Drought is not modelled; the row says so.
      const q = scenario.flow
      const h = scenario.head
      if (!q || !h) return null
      return mul(band, [q * h * 24, q * h * 24])
    }
    case 'fraction of drive flow': {
      // A stream drives the device and a fraction of it is delivered. m3/s -> L/day.
      const q = scenario.flow
      if (!q) return null
      const litresPerDay = q * 86400 * 1000
      return [band[0] * litresPerDay, band[1] * litresPerDay]
    }
    case 'per year':
      return perDayFromYear(band)
    case 'per day':
      return band
    case 'per hour':
      return mul(band, [24, 24])
    default:
      break
  }

  // Behavioural bases: the reader is never asked, so the usage RANGE is what
  // turns a per-use figure into a daily one, and its width is the mechanism by
  // which behavioural uncertainty becomes yellow.
  if (basis.behavioural && basis.usage) {
    const u = basis.usage
    const lo = Number(u.low)
    const hi = Number(u.high)
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null
    let uses = [lo, hi]
    if (u.per === 'person-day') {
      if (!people) return null
      uses = [lo * people, hi * people]
    } else if (u.per !== 'household-day') {
      return null
    }
    return mul(band, uses)
  }

  return null
}

function verdictFor(supply, demand) {
  if (!supply || !demand) return { verdict: VERDICT.GREY, band: null }
  if (demand[1] <= 0 || supply[1] <= 0) return { verdict: VERDICT.GREY, band: null }
  const band = [supply[0] / demand[1], supply[1] / demand[0]]
  if (band[1] < 1) return { verdict: VERDICT.RED, band }
  if (band[0] > 1) return { verdict: VERDICT.GREEN, band }
  return { verdict: VERDICT.YELLOW, band }
}

// SUPPLIED is deliberately absent: it replaces the comparison rather than entering
// it, and is applied after both periods have been resolved.
const WORSE = { [VERDICT.GREEN]: 3, [VERDICT.YELLOW]: 2, [VERDICT.RED]: 1, [VERDICT.GREY]: 0 }

/*
 * A way to use less, for one family (brief 04, Eric 2026-11): among the linked cards that draw on
 * this family, the one with another option for the same need whose sourced figure, for the same
 * resource in the same unit and basis, is at least a fifth lower. Deliberately one step: it
 * compares a card with its own alternatives and does not re-run the chain, so it points to a
 * comparison rather than promising a verdict. Null when no figure supports the claim.
 */
export function lessUsing(f, data) {
  const coefs = data.coefficients || []
  const sols = data.solutions || []
  const mid = (c) => (c.low + c.high) / 2
  const subOf = Object.fromEntries(sols.map((s) => [s.id, s.subfunction_id]))
  let best = null
  for (const row of f.rows || []) {
    const c = row.coef
    if (!c || c.role !== 'in' || !(mid(c) > 0)) continue
    for (const o of coefs) {
      if (o.solution_id === row.solutionId || o.role !== 'in' || o.engine_use === false) continue
      if (o.io_type_id !== c.io_type_id || o.unit !== c.unit || o.basis !== c.basis) continue
      if (subOf[o.solution_id] !== subOf[row.solutionId] || mid(o) > 0.8 * mid(c)) continue
      const saving = 1 - mid(o) / mid(c)
      if (!best || saving > best.saving) best = { solutionId: row.solutionId, betterId: o.solution_id, saving }
    }
  }
  return best
}

/*
 * The open ends of a linked system, read from the links and the cards alone, so a card with no
 * figure still shows: an electric motor with no power used to get no word at all. Inputs that are
 * alternatives count once. Natural and household resources are always there; only the resources
 * the check has families for are listed, not stale air or a jar of food.
 */
function openEnds(nodes, graph, solById, data) {
  if (!graph.linkedOnly) return { unfed: [], unused: [] }
  const free = new Set([...(data.natural_resources || []), ...(data.household_sources || [])].map((n) => n.io))
  const carried = (e, io, side) => (e.ios
    ? e.ios.includes(io)
    : ((solById[(nodes.find((n) => n.id === e[side]) || {}).sol] || {})[side === 'from' ? 'outputs' : 'inputs'] || []).some((x) => x.io === io))
  const edges = graph.edges || []
  const unfed = [], unused = []
  for (const n of nodes) {
    const s = solById[n.sol]
    if (!s) continue
    const done = new Set()
    for (const { io } of s.inputs || []) {
      if (done.has(io) || free.has(io)) continue
      const group = (s.input_groups || []).find((g) => g.includes(io)) || [io]
      group.forEach((x) => done.add(x))
      if (group.some((x) => free.has(x) || edges.some((e) => e.to === n.id && carried(e, x, 'from')))) continue
      const family = familyOf(io)
      if (family) unfed.push({ nodeId: n.id, solutionId: n.sol, io, family })
    }
    for (const { io } of s.outputs || []) {
      const family = familyOf(io)
      // A pass-through gives what entered it; the other quality it can carry is not going spare.
      if ((s.conduit_for || []).includes(io) && (s.input_groups || []).some((g) => g.includes(io) &&
          g.some((x) => x !== io && edges.some((e) => e.to === n.id && carried(e, x, 'from'))) &&
          !edges.some((e) => e.to === n.id && carried(e, io, 'from')))) continue
      if (family && !edges.some((e) => e.from === n.id && carried(e, io, 'to'))) unused.push({ nodeId: n.id, solutionId: n.sol, io, family })
    }
  }
  return { unfed, unused }
}

export function assess(graph, scenario, data) {
  const basisBy = new Map((data.bases || []).map((b) => [b.basis, b]))
  const coefBy = new Map()
  for (const c of data.coefficients || []) {
    if (!coefBy.has(c.solution_id)) coefBy.set(c.solution_id, [])
    coefBy.get(c.solution_id).push(c)
  }

  const zones = (data.climate && data.climate.zones) || {}

  // The reader knows their department, not their zone. Two answers come from it: the climate
  // from a reference point (a site station wins where one covers the department), and the
  // fabric figures per zone, never per site.
  const inFrance = !scenario.country || scenario.country === 'FR'
  const deptRow = (inFrance && ((data.departments && data.departments.departments) || [])
    .find((d) => d.code === scenario.department)) || null
  const siteFor = (code) => Object.keys(zones)
    .find((k) => (zones[k].departments || []).includes(code))
  const climateKey = (deptRow && (siteFor(deptRow.code) || deptRow.zone)) || scenario.zone
  const zoneClimate = zones[climateKey] || zones['SITE-CAEN'] || null
  // The sun, rain and temperature are the department's own where we have them (Eric, 2026-10-30):
  // PVGIS and NASA POWER at its most populous commune, not the zone's one point. Monthly profiles
  // come with them, so the worst-month checks follow the same place. Source and tier stay the
  // zone block's, the same service; the fabric figures stay per zone, as published.
  const own = (deptRow && deptRow.climate) || {}
  // Outside France (TODO C9) the reader's region carries all four blocks itself, fetched from the
  // same two services at its own town (scripts/build_world_climate.py), and the panel hands it in
  // as `data.region`. Source and tier still come from a zone block. No solar figure where PVGIS
  // has none: `abroad` stops the yield from falling back to a French one.
  const region = !inFrance && data.region ? data.region : null
  const climate = region && zoneClimate
    ? {
        ...zoneClimate,
        station: region.station,
        abroad: true,
        pv: region.pv ? { ...zoneClimate.pv, ...region.pv } : null,
        ...Object.fromEntries(['rain', 'temperature', 'degree_days', 'rain_interannual']
          .filter((k) => region[k]).map((k) => [k, { ...zoneClimate[k], ...region[k] }])),
      }
    : zoneClimate && deptRow && (deptRow.pv || deptRow.climate)
    ? {
        ...zoneClimate,
        ...(deptRow.pv ? {
          station: deptRow.climate ? deptRow.pv.station : zoneClimate.station,
          pv: { ...zoneClimate.pv, ...deptRow.pv, ...(data.departments.pv_source || {}) },
        } : {}),
        ...Object.fromEntries(['rain', 'temperature', 'degree_days', 'rain_interannual']
          .filter((k) => own[k]).map((k) => [k, { ...zoneClimate[k], ...own[k] }])),
      }
    : zoneClimate

  // Identity is per node, not per solution: two showers are two draws, and a second filter
  // relieves a bottleneck. `solutionIds` is still accepted, one node each.
  const allNodes = graph.nodes
    ? graph.nodes.map((n, i) => ({ id: n.id ?? `n${i}`, sol: n.sol }))
    : (graph.solutionIds || []).map((sol, i) => ({ id: `n${i}`, sol }))
  // A link to anything counts, a resource or a destination included: edges are in canvas ids.
  const linkEnds = new Set()
  for (const e of graph.edges || []) { linkEnds.add(e.from); linkEnds.add(e.to) }
  const unlinked = graph.linkedOnly && allNodes.length > 1
    ? allNodes.filter((n) => !linkEnds.has(n.id)) : []
  const nodes = unlinked.length ? allNodes.filter((n) => linkEnds.has(n.id)) : allNodes
  const placed = nodes.map((n) => n.sol)
  // Edges are OPTIONAL and read for one purpose only: telling parallel
  // pass-throughs from series ones. Absent, the engine assumes series and says so.
  // They are in NODE ids, matching `nodes` above.
  const edges = graph.edges || []
  const placedSet = new Set(placed)
  const ioById = Object.fromEntries((data.io_types || []).map((t) => [t.id, t]))
  const solById = Object.fromEntries((data.solutions || []).map((x) => [x.id, x]))
  const families = {}
  const neededInputs = new Set()
  const neededClimate = new Set()
  const work = []
  const reference = []   // sourced figures deliberately kept out of the sums

  const fabricRows = data.fabric_classes || []
  let fabricUsed = null

  const advisoryIos = new Set(
    (data.io_types || []).filter((t) => t.advisory).map((t) => t.id))

  const conduitIos = new Set()
  {
    const cIn = new Map(), cOut = new Map()
    for (const e of data.io_index || []) {
      const sol = e.sol || e.solution_id
      if (!placedSet.has(sol) || !((solById[sol] || {}).conduit_for || []).length) continue
      const io = e.io || e.io_type_id
      const m = (e.role || '').toLowerCase().startsWith('consume') ? cIn : cOut
      if (!m.has(sol)) m.set(sol, new Set())
      m.get(sol).add(io)
    }
    // The column is authored per io, and the engine still checks the shape: an io counts as a
    // conduit only where the row really takes it in and hands it out. A marking cannot excuse a
    // row that only eats the resource (fixture: 'the conduit marking cannot excuse a consumer').
    for (const [sol, ios] of cIn) {
      const named = new Set((solById[sol] || {}).conduit_for || [])
      for (const io of ios) if (named.has(io) && (cOut.get(sol) || new Set()).has(io)) conduitIos.add(sol + '|' + io)
    }
  }

  /*
   * What a solution hands on is not a gap in what it uses up: a water heater takes raw
   * water and gives heated water, so the litres are the shower's and the demand is counted
   * there. Not gated on `conduit_for`, which means a capacity-limited conduit. Three
   * conditions: the produced IO differs from the consumed one (a swale giving rainwater back is
   * a real gap); what comes out is not waste (a flush toilet with no figure stays a gap); and
   * it carries no figure of its own, checked at the sweep below (a rainwater tank is the
   * supply).
   */
  const WASTE_IOS = new Set(['IO-10', 'IO-11', 'IO-26', 'IO-43'])
  const carriesOn = new Set()   // 'family|solution': takes that family in and hands it on
  {
    const takes = new Map(), gives = new Map()
    for (const e of data.io_index || []) {
      const sol = e.sol || e.solution_id
      if (!placedSet.has(sol)) continue
      const io = e.io || e.io_type_id
      if (!familyOf(io)) continue
      const m = (e.role || '').toLowerCase().startsWith('consume') ? takes : gives
      if (!m.has(sol)) m.set(sol, new Set())
      m.get(sol).add(io)
    }
    for (const [sol, ins] of takes) {
      for (const out of gives.get(sol) || []) {
        if (WASTE_IOS.has(out)) continue
        for (const i of ins) {
          if (i !== out && familyOf(i) === familyOf(out)) carriesOn.add(familyOf(out) + '|' + sol)
        }
      }
    }
  }

  const inputsOf = new Map()
  const touches = {}   // family -> Set(solutionId)
  const householdIos = new Set()   // every io the placed graph touches, either side
  // An alternative a card merely offers is not a resource it touches: a toilet on a rain tank opens
  // no drinking-water need (C10). What a pass-through gives follows the same choice. With nothing
  // linked to the group, its first entry stands for it.
  const onlyOffered = (sol, io) => {
    const s = solById[sol] || {}
    const group = (s.input_groups || []).find((g) => g.includes(io))
    if (!group) return false
    const named = (graph.edges || []).filter((x) => nodes.some((n) => n.id === x.to && n.sol === sol))
      .flatMap((x) => x.ios || []).filter((i) => group.includes(i))
    return named.length ? !named.includes(io) : group[0] !== io
  }
  for (const e of data.io_index || []) {
    const sol = e.sol || e.solution_id
    const io = e.io || e.io_type_id
    const role = (e.role || '').toLowerCase()
    if (!placedSet.has(sol)) continue
    if (role.startsWith('consume')) {
      if (!inputsOf.has(sol)) inputsOf.set(sol, [])
      inputsOf.get(sol).push(io)
    }
    const fam = familyOf(io)
    // A societal connection is excluded from the coverage count: it carries no coefficient by
    // design.
    const isMains = (solById[sol] || {}).societal === 'supply'
    // A conduit is excluded only for the family it passes through, since it has nothing to
    // estimate there. Per family: a pressurised pump passes water but its electricity draw is a
    // real gap.
    const passesThrough = conduitIos.has(sol + '|' + io)
    if (fam && !isMains && !passesThrough) {
      for (const n of nodes) if (n.sol === sol) (touches[fam] ||= new Set()).add(n.id)
    }
    // Every io the graph touches at all, either side. This is what gates the
    // household's own demand: it enters only where the reader has placed something
    // for it.
    const passes = ((solById[sol] || {}).conduit_for || []).includes(io)
    if ((role.startsWith('consume') || passes) && onlyOffered(sol, io)) continue
    householdIos.add(io)
  }

  // A family may exist only because the household needs something from it; without this the
  // demand computes into nothing.
  const blankFamily = () => ({
    supply: { annual: null, month: null },
    demand: { annual: null, month: null },
    counted: new Set(), uncounted: [], rows: [], reasons: new Set(),
  })
  for (const io of householdIos) {
    const t = ioById[io]
    const fam = familyOf(io)
    if (!t || !t.household_demand || !fam) continue
    families[fam] ||= blankFamily()
    // A household demand priced per person needs the occupancy input, even when no placed
    // coefficient asks for it (IO-09 potable water and IO-41 hot water are per person; IO-44
    // cooking is per day). Otherwise the default of two is used and the control is hidden.
    if (/\/person\/day$/.test(String(t.household_demand.unit || ''))) neededInputs.add('people')
  }
  // The fabric-class demand lives in its own table, so it must open the heat family itself, or
  // a graph holding only thermal mass computes no heating demand.
  if (fabricRows.length && scenario.fabricClass && scenario.floorArea > 0) {
    const touchedFams = new Set()
    for (const io of householdIos) {
      const f = familyOf(io)
      if (f) touchedFams.add(f)
    }
    for (const anchor of new Set(fabricRows.map((r) => r.io_type_id))) {
      const fam = familyOf(anchor)
      if (!fam) continue
      const scope = (ioById[anchor] || {}).demand_scope || 'io'
      const ok = scope === 'family' ? touchedFams.has(fam) : householdIos.has(anchor)
      if (ok) families[fam] ||= blankFamily()
    }
  }

  for (const node of nodes) {
    const solId = node.sol
    for (const coef of coefBy.get(solId) || []) {
      const fam = familyOf(coef.io_type_id)
      if (!fam) {
        // An IO outside every family has no summable unit: its figure goes to the reference
        // list, never silently dropped.
        reference.push({ nodeId: node.id, solutionId: solId, coef, why: 'no-family' })
        continue
      }
      // Recorded but not summable: kept out of the arithmetic and shown with the reference
      // figures.
      if (coef.engine_use === false) {
        reference.push({ nodeId: node.id, solutionId: solId, coef, why: 'not-summable' })
        continue
      }
      const basis = basisBy.get(coef.basis)
      if (basis && basis.scale_input && basis.scale_input !== 'none') {
        neededInputs.add(basis.scale_input)
      }
      // A behavioural basis counted per person depends on household size, even with scale_input
      // 'none', so it must ask for the occupancy.
      if (basis && basis.behavioural && basis.usage && basis.usage.per === 'person-day') {
        neededInputs.add('people')
      }
      // Climate controls are offered only where a placed figure reads them: a control that
      // cannot move the answer is not offered.
      if (basis && basis.climate_input) neededClimate.add(basis.climate_input)

      const f = (families[fam] ||= {
        supply: { annual: null, month: null },
        demand: { annual: null, month: null },
        counted: new Set(),
        uncounted: [],
        rows: [],
        reasons: new Set(),
      })
      void f   // families are filled below, after the pools are resolved
      work.push({ nodeId: node.id, solId, coef, basis, fam })
    }
  }

  // Resolve the pools per period: sources fill, capacities clamp, ratios convert, demands
  // drain.
  const KIND_ORDER = { SOURCE: 0, CAPACITY: 1, RATIO: 2, DEMAND: 3 }
  const ordered = [...work].sort((a, b) => KIND_ORDER[a.coef.kind] - KIND_ORDER[b.coef.kind])
  const outputsOf = new Map()   // solution -> io ids it produces
  for (const e of data.io_index || []) {
    const sol = e.sol || e.solution_id
    const io = e.io || e.io_type_id
    const role = (e.role || '').toLowerCase()
    if (!placedSet.has(sol) || !role.startsWith('produce')) continue
    if (!outputsOf.has(sol)) outputsOf.set(sol, [])
    outputsOf.get(sol).push(io)
  }

  // Families supplied through a pipe or a wire, from the Solutions `societal` column. A
  // societal sink is not handled.
  //
  // Computed whether or not mains-off is set: off, these families are SUPPLIED; on, they are
  // the ones that lost their supply.
  //
  // A mains node must be wired in (have an outgoing edge) to supply its family. This is the one
  // place a verdict needs an edge: SUPPLIED is an optimistic claim and needs evidence, whereas
  // the no-edge rule only protects against pessimism. Any outgoing edge counts.
  const wiredIn = new Set(edges.map((e) => e.from))
  const mainsCapable = new Set()
  const mainsSolutions = []
  for (const node of nodes) {
    const sol = solById[node.sol]
    if (!sol || sol.societal !== 'supply') continue
    if (!wiredIn.has(node.id)) continue
    mainsSolutions.push(node.sol)
    for (const io of outputsOf.get(node.sol) || []) {
      const fam = familyOf(io)
      if (fam) mainsCapable.add(fam)
    }
  }
  // A mains supply reaches through converters (mains gas to a gas water heater), transitively.
  // Bounded by the number of ratio rows rather than looping until nothing changes, so a broken
  // body cannot hang the tests.
  const ratioRows = work.filter((w) => w.coef.kind === 'RATIO').length
  for (let pass = 0, changed = true; changed && pass <= ratioRows; pass += 1) {
    changed = false
    for (const item of work) {
      if (item.coef.kind !== 'RATIO') continue
      const src = item.coef.converts_from
      const srcFam = src && familyOf(src)
      if (!srcFam || !mainsCapable.has(srcFam)) continue
      if (mainsCapable.has(item.fam)) continue
      mainsCapable.add(item.fam)
      changed = true
    }
  }
  const mainsFamilies = scenario.mainsOff ? new Set() : mainsCapable

  // Fuel brought in from outside: nothing in the catalogue produces biomass fuel, so the reader
  // enters the quantity and the IO's energy density converts it.
  const fuelNeeds = []            // fuel IOs consumed by something placed, with a density
  for (const node of nodes) {
    for (const io of inputsOf.get(node.sol) || []) {
      if (familyOf(io) !== 'fuel') continue
      const t = ioById[io]
      if (!t || !t.energy_density) continue
      if (fuelNeeds.some((f) => f.io === io)) continue
      fuelNeeds.push({ io, name: t.name, unit: t.energy_density.unit, density: t.energy_density })
    }
  }
  const fuelSeed = {}
  for (const need of fuelNeeds) {
    const qty = Number((scenario.fuelStock || {})[need.io])
    if (!Number.isFinite(qty) || qty <= 0) continue
    // Annual stock -> daily energy, through the density band.
    fuelSeed[need.io] = [qty * need.density.low / YEAR, qty * need.density.high / YEAR]
  }

  // Feedstock derived from household size: people know how many live there, not how many kilos
  // of peelings they bin. Shown as a starting number the reader can overwrite.
  const wasteYield = (ioById['IO-13'] || {}).household_yield
  const feedstockDerived = wasteYield && scenario.people
    ? { kgPerYear: wasteYield.low * scenario.people, perPerson: wasteYield, people: scenario.people }
    : null
  const effectiveFeedstock = Number(scenario.feedstock) > 0
    ? Number(scenario.feedstock)
    : (feedstockDerived ? feedstockDerived.kgPerYear : 0)
  const scen = { ...scenario, feedstock: effectiveFeedstock }

  const resolved = {}
  const convertedIn = new Set()   // 'family|solution' pairs a RATIO drew from
  const drainedIos = new Set()    // io-types a RATIO consumed entirely
  const capacityClamped = new Set() // families where a throughput limit bound
  const clampedBy = new Map()       // family -> the solution ids doing the clamping
  const unioned = new Set()       // families where two bases described one quantity
  const setAside = new Set()      // coefficients outranked by a more precise basis
  const setAsideFams = new Set()  // families where that happened
  const unitMismatch = new Set()  // families a conversion could not legally enter
  const parallelCapacity = new Set()  // families where throughputs were added
  const seriesAssumed = new Set()     // families where series was assumed
  const householdCounted = new Set()  // ios where the household's own need was added
  for (const period of ['annual', 'month']) {
    const pool = {}      // io id -> band available
    for (const [io, band] of Object.entries(fuelSeed)) pool[io] = [...band]
    const demand = {}    // io id -> band demanded
    const perSolutionDemand = {}   // 'node|io' -> { band, rank, coefs }, unioned within a precision class
    const handledCapacity = new Set()  // pass-through groups already resolved
    const splitBase = new Map()  // (node, source io) -> the pool before any of its ratios ran
    const counted = new Set()
    const notes = []

    for (const item of ordered) {
      const band = dailyBand(item.coef, item.basis, scen, climate, period, ioById, zones)
      if (!band) {
        const why = item.basis && item.basis.contributes_to_flow === false
          ? REASON.NOT_A_FLOW : REASON.MISSING_SCENARIO
        notes.push({ ...item, why })
        continue
      }
      const io = item.coef.io_type_id

      if (item.coef.kind === 'RATIO') {
        // Convert the declared input pool (`converts_from`) into the destination. Never guess
        // the input: a water heater's thermal efficiency applied to its water volume shrinks
        // litres silently.
        const src = item.coef.converts_from
          || (item.coef.role === 'in' ? io : null)
          || (inputsOf.get(item.solId) || []).find((i) => pool[i])
        // The destination is the row's own IO when stated on the output; guessing the first
        // output with a family picks litres instead of kWh for a water heater.
        const dst = (item.coef.role === 'out' && familyOf(io))
          ? io
          : (outputsOf.get(item.solId) || []).find((o) => familyOf(o))
        if (!src || !pool[src] || !dst) {
          notes.push({ ...item, why: REASON.RATIO_NO_INPUT })
          continue
        }
        // A ratio moves only between pools of the same unit.
        if (FAMILY_UNIT[familyOf(src)] !== FAMILY_UNIT[familyOf(dst)]) {
          notes.push({ ...item, why: REASON.UNIT_MISMATCH })
          unitMismatch.add(familyOf(dst))
          continue
        }
        // A split, not a competition, when one node converts the same input more than once (a
        // stove's delivered heat and its flue heat): each row sees the pool as it was before
        // any of them ran, and the pool is emptied once.
        const groupKey = item.nodeId + '>' + src
        const through = splitBase.has(groupKey) ? splitBase.get(groupKey) : pool[src]
        splitBase.set(groupKey, through)
        pool[src] = [0, 0]
        pool[dst] = pool[dst] ? addInto(pool[dst], mul(through, band)) : mul(through, band)
        counted.add(item.nodeId)
        // A converter is accounted for on both sides: its source family must not report the
        // drained draw as uncounted.
        const srcFam = familyOf(src)
        if (srcFam) convertedIn.add(srcFam + '|' + item.nodeId)
        // Known limit: a converter takes the whole pool it draws from (no demand-driven
        // allocation). The specific IO drained is tracked, so an inverter feeding an AC load is
        // not reported as competing with it.
        drainedIos.add(src)
        notes.push({ ...item, why: REASON.RATIO_APPLIED })
        continue
      }

      if (item.coef.role === 'out') {
        if (item.coef.kind === 'CAPACITY') {
          // Pass-throughs sharing one input pool are resolved once, as a group, or the first
          // starves the rest.
          if (handledCapacity.has(item.nodeId + '|' + io)) continue
          // A CAPACITY is a throughput limit on a transfer, not a supply. It seeds only where
          // the solution draws on something not pooled (groundwater, a stream); on a pooled
          // flow of its own family it can only pass on what reaches it, capped at its rate.
          const fam = familyOf(io)
          const feeds = (inputsOf.get(item.solId) || []).filter((i) => familyOf(i) === fam)
          if (feeds.length) {
            // Every other pass-through in this period feeding the same pool into the
            // same output. Their bands are computed here so a group is resolved once.
            // Units fed from the same pool: parallel candidates. When some of them pass the flow on
            // to another card and others do not, only the ones passing it on count: a unit whose
            // output is linked to nothing beside one that is wired onward is not in that chain
            // (Eric, 2026-10-20: three bio-sand filters with their inputs linked and their
            // outputs loose turned the check green). A unit that ends the chain, its water drunk
            // by the household, still counts when none of its peers goes further.
            const group = ordered.filter((o) =>
              o.coef.kind === 'CAPACITY' && o.coef.role === 'out' &&
              o.coef.io_type_id === io &&
              (inputsOf.get(o.solId) || []).some((i) => feeds.includes(i)))
            const passesOn = (o) => edges.some((e) => e.from === o.nodeId)
            const onward = group.filter(passesOn)
            // In the builder, where only linked cards count (`linkedOnly`), a unit whose output
            // is linked to nothing passes nothing on, whatever reaches it (Eric, 2026-10-20):
            // drinking water must be linked to the household. Elsewhere, a unit ending the chain
            // still counts when none of its peers goes further.
            const peers = graph.linkedOnly ? onward
              : onward.length && onward.length < group.length ? onward : group
            for (const o of group) if (!peers.includes(o)) handledCapacity.add(o.nodeId + '|' + io)
            if (!peers.includes(item)) {
              if (!peers.length) notes.push({ ...item, why: REASON.OUTPUT_UNLINKED })
              continue
            }

            const bands = []
            for (const pr of peers) {
              const b = pr === item ? band : dailyBand(pr.coef, pr.basis, scen, climate, period, ioById, zones)
              if (b) bands.push({ item: pr, band: b })
              handledCapacity.add(pr.nodeId + '|' + io)
            }

            // Parallel throughputs add, series do not. Without edges, take the largest single
            // unit and say so.
            let capacity = bands[0].band
            if (bands.length > 1) {
              const ids = bands.map((b) => b.item.nodeId)
              const anyConnected = edges.length > 0 && ids.some((a, i) =>
                ids.slice(i + 1).some((b2) => connected(edges, a, b2)))
              if (edges.length > 0 && !anyConnected) {
                capacity = bands.reduce((acc, b) => addInto(acc, b.band), [0, 0])
                parallelCapacity.add(fam)
              } else {
                capacity = bands.reduce((acc, b) =>
                  [Math.max(acc[0], b.band[0]), Math.max(acc[1], b.band[1])], [0, 0])
                seriesAssumed.add(fam)
              }
            }

            let availLo = 0, availHi = 0
            for (const i of feeds) {
              if (!pool[i]) continue
              availLo += pool[i][0]
              availHi += pool[i][1]
              pool[i] = [0, 0]
            }
            if (availHi <= 0) {
              // Not counted: the reason reaches the reader only through the uncounted path.
              notes.push({ ...item, why: REASON.CAPACITY_STARVED })
              continue
            }
            const moved = [Math.min(availLo, capacity[0]), Math.min(availHi, capacity[1])]
            // Binding at either end of the range: the pessimistic case counts too (Eric,
            // 2026-10-20: two filters limited the low end long before the high one).
            if (moved[1] < availHi || moved[0] < availLo) {
              capacityClamped.add(fam)
              // Which distinct solutions are binding, since a bigger roof changes nothing when
              // a filter caps the flow.
              if (!clampedBy.has(fam)) clampedBy.set(fam, [...new Set(bands.map((b) => b.item.solId))])
            }
            pool[io] = pool[io] ? addInto(pool[io], moved) : moved
            for (const b of bands) counted.add(b.item.nodeId)
          } else {
            pool[io] = pool[io] ? addInto(pool[io], band) : band
          }
        } else {
          pool[io] = pool[io] ? addInto(pool[io], band) : band
        }
      } else {
        // Two bases for one (node, io) describe one quantity: union within a precision class,
        // else keep the more precise. Different nodes add.
        const k = item.nodeId + '|' + io
        const r = precisionRank(item.coef)
        const cur = perSolutionDemand[k]
        if (!cur || r < cur.rank) {
          if (cur) {
            for (const c of cur.coefs) setAside.add(c)
            setAsideFams.add(familyOf(io))
          }
          perSolutionDemand[k] = { band, rank: r, coefs: [item.coef] }
        } else if (r === cur.rank) {
          cur.band = union(cur.band, band)
          cur.coefs.push(item.coef)
          unioned.add(familyOf(io))
        } else {
          setAside.add(item.coef)
          setAsideFams.add(familyOf(io))
        }
      }
      counted.add(item.nodeId)
    }
    for (const [k, { band }] of Object.entries(perSolutionDemand)) {
      const io = k.split('|')[1]
      demand[io] = demand[io] ? addInto(demand[io], band) : band
    }

    // The household's own need, for resources people consume directly (a meal, a warm room).
    // Counted only where the graph already touches that IO, or every graph would be flagged for
    // needs the reader is not solving here.
    for (const [io, t] of Object.entries(ioById)) {
      const hd = t.household_demand
      if (!hd || !householdIos.has(io)) continue
      const per = String(hd.unit || '')
      let band = [Number(hd.low), Number(hd.high)]
      if (!Number.isFinite(band[0]) || !Number.isFinite(band[1])) continue
      // Only two denominators are accepted; an unrecognised one is dropped rather than guessed
      // (per year read as per day is wrong by 365).
      if (/\/person\/day$/.test(per)) {
        if (!scen.people) continue
        band = mul(band, [scen.people, scen.people])
      } else if (!/\/day$/.test(per)) {
        continue
      }
      demand[io] = demand[io] ? addInto(demand[io], band) : band
      householdCounted.add(io)
    }

    // Space heating: the band depends on the reader's energy label and climate zone.
    // Family-scoped: the demand hangs on an anchor IO but is weighed against the whole heat
    // family, so a stove plus a heat pump is not charged twice.
    if (fabricRows.length && scen.fabricClass && scen.floorArea > 0) {
      const cls = String(scen.fabricClass).toUpperCase()
      // The department's zone, not its climate point: fabric bands are published per zone.
      const zoneKey = (deptRow && deptRow.zone) || FABRIC_ZONE[scen.zone] || scen.zone
      const touchedFams = new Set()
      for (const io of householdIos) {
        const f = familyOf(io)
        if (f) touchedFams.add(f)
      }
      for (const anchor of new Set(fabricRows.map((r) => r.io_type_id))) {
        const fam = familyOf(anchor)
        if (!fam) continue
        const scope = (ioById[anchor] || {}).demand_scope || 'io'
        const touched = scope === 'family' ? touchedFams.has(fam) : householdIos.has(anchor)
        if (!touched) continue
        // The reader's own zone only. No national fallback: it would understate a mountain
        // house. Outside France, the French houses with that label scaled to the reader's winters.
        const row = region
          ? fabricAbroad(fabricRows.filter((r) => r.io_type_id === anchor && r.cls === cls), zones, climate)
          : fabricRows.find((r) => r.io_type_id === anchor && r.cls === cls && r.zone === zoneKey)
        if (!row) continue
        const share = heatingShare(climate, period)
        if (share === null) continue
        const lo = Number(row.low), hi = Number(row.high)
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue
        // kWh/m2/YEAR -> kWh/day for this dwelling, then shaped by the season.
        const perDay = scen.floorArea / YEAR
        const band = mul(mul([lo, hi], [perDay, perDay]), [share, share])
        demand[anchor] = demand[anchor] ? addInto(demand[anchor], band) : band
        householdCounted.add(anchor)
        if (period === 'annual') fabricUsed = { ...row, zoneUsed: row.zone, cls }
      }
    }

    resolved[period] = { pool, demand, counted, notes }
  }

  // ---- fold the pools back into per-family supply and demand ----------------
  for (const period of ['annual', 'month']) {
    const { pool, demand } = resolved[period]
    for (const [io, band] of Object.entries(pool)) {
      const fam = familyOf(io)
      if (!fam || !families[fam]) continue
      families[fam].supply[period] = families[fam].supply[period]
        ? addInto(families[fam].supply[period], band) : band
    }
    for (const [io, band] of Object.entries(demand)) {
      const fam = familyOf(io)
      if (!fam || !families[fam]) continue
      families[fam].demand[period] = families[fam].demand[period]
        ? addInto(families[fam].demand[period], band) : band
    }
  }

  for (const item of work) {
    const f = families[item.fam]
    if (!f) continue
    const note = resolved.annual.notes.find(
      (n) => n.nodeId === item.nodeId && n.coef === item.coef)
    if (setAside.has(item.coef)) {
      // Outranked by a more precise basis: shown with the reference figures, never in the rows
      // the total used.
      if (!reference.some((x) => x.nodeId === item.nodeId && x.coef === item.coef)) {
        reference.push({ nodeId: item.nodeId, solutionId: item.solId, coef: item.coef, why: 'outranked' })
      }
      continue
    }
    if (resolved.annual.counted.has(item.nodeId) || resolved.month.counted.has(item.nodeId)) {
      f.counted.add(item.nodeId)
      // `sited`: the factor this figure was scaled by for the reader's location, so the sources
      // list shows the figure actually used, not the one measured at the reference place.
      f.rows.push({ nodeId: item.nodeId, solutionId: item.solId, coef: item.coef, basis: item.basis,
                    sited: sitedYieldFactor(item.coef, climate, zones) })
      if (item.basis && item.basis.behavioural) f.reasons.add(REASON.BEHAVIOUR_WIDENS)
      if (note && note.why === REASON.RATIO_APPLIED) f.reasons.add(REASON.RATIO_APPLIED)
    } else {
      const why = (note && note.why) || REASON.MISSING_SCENARIO
      f.uncounted.push({ nodeId: item.nodeId, solutionId: item.solId, coef: item.coef, why })
      f.reasons.add(why)
    }
  }

  // A placed solution touching a family with no coefficient there is an uncounted flow, or a
  // partial total reads as complete.
  for (const [fam, ids] of Object.entries(touches)) {
    const f = families[fam]
    if (!f) continue           // family present only via uncovered rows: nothing to compare
    for (const id of ids) {
      if (f.counted.has(id)) continue
      if (convertedIn.has(fam + '|' + id)) continue   // spent by a converter, not missing
      if (f.uncounted.some((u) => u.nodeId === id)) continue
      const sol = (nodes.find((n) => n.id === id) || {}).sol
      // It hands this family on and carries no figure of its own (see WASTE_IOS above): not a
      // gap, and not in the denominator.
      if (carriesOn.has(fam + '|' + sol)) { ids.delete(id); continue }
      f.uncounted.push({ nodeId: id, solutionId: sol, coef: null, why: REASON.NO_FIGURE })
      f.reasons.add(REASON.NO_FIGURE)
    }
  }

  // Placed solutions contributing no figure to any family and not already listed under a
  // family's "not counted".
  const contributing = new Set()
  const namedUncounted = new Set()
  for (const f of Object.values(families)) {
    for (const id of f.counted) contributing.add(id)
    for (const u of f.uncounted) namedUncounted.add(u.nodeId)
  }
  // A conduit is left out unless some family it touches is not one it passes through (a pump's
  // electricity).
  const fullyConduit = (sol) => {
    if (!((solById[sol] || {}).conduit_for || []).length) return false
    const ios = new Set()
    for (const e of data.io_index || []) {
      const es = e.sol || e.solution_id
      if (es !== sol) continue
      const io = e.io || e.io_type_id
      if (familyOf(io)) ios.add(io)
    }
    return ios.size > 0 && [...ios].every((io) => conduitIos.has(sol + '|' + io))
  }
  // An advisory row has no per-technique figure by nature; it gets its own block instead of
  // being listed as a gap.
  const fullyAdvisory = (sol) => {
    const ios = new Set()
    for (const e of data.io_index || []) {
      const es = e.sol || e.solution_id
      if (es !== sol) continue
      ios.add(e.io || e.io_type_id)
    }
    return ios.size > 0 && [...ios].every((io) => advisoryIos.has(io))
  }
  // Offer the energy-label and floor-area fields only where the graph holds something in the
  // heat family, even before a label is chosen.
  const fabricInputs = []
  {
    const touchedFams = new Set()
    for (const io of householdIos) {
      const f = familyOf(io)
      if (f) touchedFams.add(f)
    }
    for (const anchor of new Set(fabricRows.map((r) => r.io_type_id))) {
      const fam = familyOf(anchor)
      if (!fam) continue
      const scope = (ioById[anchor] || {}).demand_scope || 'io'
      const ok = scope === 'family' ? touchedFams.has(fam) : householdIos.has(anchor)
      if (!ok) continue
      fabricInputs.push({
        io: anchor,
        family: fam,
        classes: [...new Set(fabricRows.filter((r) => r.io_type_id === anchor)
                                       .map((r) => r.cls))].sort(),
      })
    }
  }

  const withoutFigures = nodes
    .filter((n) => !contributing.has(n.id) && !namedUncounted.has(n.id)
                && !fullyConduit(n.sol) && !fullyAdvisory(n.sol))
    .map((n) => n.sol)

  // Placed measures that help without being measurable, grouped by IO so winter and summer
  // measures show apart.
  const advisory = []
  for (const n of nodes) {
    if (!n.sol || !fullyAdvisory(n.sol)) continue
    const ios = []
    for (const e of data.io_index || []) {
      const es = e.sol || e.solution_id
      const io = e.io || e.io_type_id
      if (es === n.sol && advisoryIos.has(io) && !ios.includes(io)) ios.push(io)
    }
    advisory.push({ nodeId: n.id, solutionId: n.sol, ios })
  }

  // Heat exposure, deliberately not a cooling demand. ADEME's cooling need tracks whether air
  // conditioning is installed (in H3, label A shows more than label G), so it would tell a
  // reader insulation increases cooling need. The climate is honest: days a year the daily mean
  // reaches 26 and 30 C, then and now. Offered only where the graph holds cooling or a
  // heat-gain measure.
  let heatExposure = null
  {
    const dd = climate && climate.degree_days
    const touchedIos = new Set(householdIos)
    const coolingFamily = (FAMILIES.cooling || []).some((io) => touchedIos.has(io))
    const gainMeasures = advisory.filter((a) => a.ios.includes('IO-47'))
    if (dd && dd.recent && (coolingFamily || gainMeasures.length)) {
      // Cooling machines are not missing measures: listed separately, with no number.
      const coolers = nodes.filter((n) => n.sol
        && (outputsOf.get(n.sol) || []).some((io) => familyOf(io) === 'cooling'))
      heatExposure = {
        station: (climate && climate.station) || null,
        recent: dd.recent,
        // What the reader has placed against the heat, split by what we can say about it.
        gainMeasures: gainMeasures.map((a) => a.solutionId),
        coolers: [...new Set(coolers.map((n) => n.sol))],
        source: dd.source,
        tier: dd.tier,
      }
    }
  }


  // The climate figures used, with their sources, for the disclosure: only what a placed figure
  // reads, plus hot-day counts when exposure shows.
  const climateFigures = []
  if (climate) {
    const add = (kind, value, unit, blk) => {
      if (value == null || !blk) return
      climateFigures.push({
        kind, value, unit,
        condition: blk.condition || null,
        source: blk.source || null,
        source_url: blk.source_url || null,
        tier: blk.tier || null,
        precision: blk.precision || null,
      })
    }
    if (neededClimate.has('rainfall')) {
      add('rainfall', climate.rain && climate.rain.annual_mm, 'mm/year', climate.rain)
    }
    if (neededClimate.has('irradiance')) {
      add('irradiance', climate.pv && climate.pv.annual_kwh_per_kwp, 'kWh/kWp/year', climate.pv)
    }
    if (heatExposure) {
      const dd = climate.degree_days
      add('hotDays', dd && dd.recent && dd.recent.hot_days['26'], 'days/year', dd)
    }
  }

  const out = {}
  for (const [fam, f] of Object.entries(families)) {
    const annual = verdictFor(f.supply.annual, f.demand.annual)
    const month = verdictFor(f.supply.month, f.demand.month)

    // A pool drained to zero is still an array: zero supply is no supply.
    const hasSupply = !!f.supply.annual && f.supply.annual[1] > 0
    // "Nothing produces it" must be true to be said. An entry point produces into the family
    // and consumes nothing from it: a washing machine's greywater and a filter's potable water
    // are not entry points; a solar cooker and a wood cookstove are.
    const entersFamily = nodes.some((n) => {
      if (!n.sol) return false
      const outs = outputsOf.get(n.sol) || []
      if (!outs.some((io) => familyOf(io) === fam)) return false
      return !(inputsOf.get(n.sol) || []).some((io) => familyOf(io) === fam)
    })
    if (!hasSupply && f.demand.annual && !entersFamily) f.reasons.add(REASON.NO_SUPPLY)
    // A genuine contest only: something demanded the IO a converter took, or the converter left
    // nothing while demand stood.
    const drainedHere = [...drainedIos].some((io) => familyOf(io) === fam)
    const contested = drainedHere &&
      ([...drainedIos].some((io) => familyOf(io) === fam && resolved.annual.demand[io]) ||
       (!hasSupply && f.demand.annual))
    if (contested) f.reasons.add(REASON.CONVERTER_TOOK_POOL)
    if (capacityClamped.has(fam)) f.reasons.add(REASON.CAPACITY_CLAMPED)
    if (unioned.has(fam)) f.reasons.add(REASON.BASES_UNIONED)
    if (setAsideFams.has(fam)) f.reasons.add(REASON.BASIS_SET_ASIDE)
    if (unitMismatch.has(fam)) f.reasons.add(REASON.UNIT_MISMATCH)
    // Fuel notes land on the family that wanted the fuel, which is where a stove's coefficient
    // is.
    if (FAMILIES.fuel.some((io) => fuelSeed[io])) {
      f.reasons.add(REASON.FUEL_SUPPLIED)
    } else if (fuelNeeds.length && f.reasons.has(REASON.RATIO_NO_INPUT)) {
      // Ask for fuel only where there is genuinely none (a digester already supplies biogas).
      f.reasons.add(REASON.FUEL_NEEDED)
    }
    if (parallelCapacity.has(fam)) f.reasons.add(REASON.PARALLEL_CAPACITY)
    if (seriesAssumed.has(fam)) f.reasons.add(REASON.SERIES_ASSUMED)
    if (f.supply.annual && !f.demand.annual) f.reasons.add(REASON.NO_DEMAND)
    if (f.uncounted.length && f.counted.size) f.reasons.add(REASON.PARTIAL_COVERAGE)
    if (month.verdict !== VERDICT.GREY && WORSE[month.verdict] < WORSE[annual.verdict]) {
      f.reasons.add(REASON.WORST_MONTH_BINDS)
    }
    if (fam === 'water' && month.verdict !== VERDICT.GREY && f.rows.some((x) => x.basis && x.basis.climate_input === 'rainfall')) {
      f.reasons.add(climate && climate.abroad ? REASON.MONTHLY_ONE_SOURCE : REASON.MONTHLY_IS_P2)
    }

    // Report the worse period. On a tie the worse band wins, never the annual one by default.
    let worse = annual
    if (month.verdict !== VERDICT.GREY) {
      if (WORSE[month.verdict] < WORSE[annual.verdict]) worse = month
      else if (WORSE[month.verdict] === WORSE[annual.verdict] &&
               month.band && annual.band && month.band[0] < annual.band[0]) worse = month
    }
    const binding = worse === month ? 'worst-month' : 'annual'

    // Enough litres is not enough drinking water (C10): where the links make none of it drinkable,
    // or leave what is made unused, water cannot read as covered. The litres are unchanged.
    const drinking = fam === 'water' && graph.linkedOnly && !mainsFamilies.has(fam)
      ? drinkingWater(nodes, graph.edges || [], solById, { mainsOff: scenario.mainsOff }) : null
    let drinkingCapped = false
    if (drinking && drinking.state !== 'ok') {
      f.reasons.add(drinking.state === 'unused' ? REASON.DRINKING_UNUSED : REASON.NO_DRINKING)
      if (worse.verdict === VERDICT.GREEN) {
        worse = { ...worse, verdict: VERDICT.YELLOW }
        drinkingCapped = true
      }
    }

    // A family fed from a pipe or a wire gets a state, not a band, applied last over the
    // arithmetic; the period objects stay underneath. The household-demand reason is added
    // before this so the suppression removes it.
    if ([...householdCounted].some((io) => familyOf(io) === fam)) {
      f.reasons.add(REASON.HOUSEHOLD_DEMAND)
    }
    if (mainsFamilies.has(fam)) {
      worse = { verdict: VERDICT.SUPPLIED, band: null }
      // Drop the reasons about a balance, since none is shown. An explicit drop list, so a
      // reason added later shows by default; step warnings (a clamping filter) stay true on
      // mains water.
      for (const r of [REASON.NO_SUPPLY, REASON.NO_DEMAND, REASON.NO_FIGURE,
                       REASON.PARTIAL_COVERAGE, REASON.BEHAVIOUR_WIDENS,
                       REASON.BASES_UNIONED, REASON.WORST_MONTH_BINDS,
                       REASON.MONTHLY_IS_P2, REASON.MONTHLY_ONE_SOURCE, REASON.FUEL_NEEDED,
                       REASON.HOUSEHOLD_DEMAND,
                       // A converter fed by the mains fills no pool, so its no-input reason is
                       // noise here.
                       REASON.RATIO_NO_INPUT]) f.reasons.delete(r)
      f.reasons.add(REASON.MAINS_SUPPLIED)
    } else if (scenario.mainsOff && mainsCapable.has(fam)) {
      f.reasons.add(REASON.MAINS_OFF)
    }

    // A byproduct never gets a verdict: what matters is whether any is going spare.
    const isByproduct = BYPRODUCT_FAMILIES.has(fam)
    let spare = null
    if (isByproduct) {
      // What is left in the pool after every converter took its share.
      spare = f.supply.annual && f.supply.annual[1] > 0 ? f.supply.annual : null
      f.reasons.clear()
      if (spare) f.reasons.add(REASON.BYPRODUCT_SPARE)
    }

    out[fam] = {
      byproduct: isByproduct,
      // The family's own daily unit, so the panel can say "3.2 to 7.5 kWh/day going
      // spare" without keeping a second copy of the unit table.
      unit: FAMILY_UNIT[fam],
      // The unused remainder of a byproduct stream, in the family's own daily unit.
      // Null when something consumed it, or when there was none to begin with.
      spare,
      verdict: isByproduct ? null : worse.verdict,
      band: isByproduct ? null : worse.band,
      binding,
      drinking,
      drinkingCapped,
      annual,
      worstMonth: month,
      // Resolved totals in the family's unit. Exposed so the panel can show the working and
      // tests do not pass vacuously on a missing field.
      supply: f.supply,
      demand: f.demand,
      counted: [...f.counted],
      // The solutions whose throughput is binding, when one is. Null otherwise.
      clampedBy: clampedBy.get(fam) || null,
      uncounted: f.uncounted,
      rows: f.rows,
      // Household demands declared on the IO, with their source. The space-heating demand is
      // disclosed separately through `fabricUsed`: it has no household_demand object.
      householdDemands: [...householdCounted]
        .filter((io) => (ioById[io] || {}).household_demand)
        .filter((io) => familyOf(io) === fam)
        .map((io) => ({ io, name: (ioById[io] || {}).name, demand: ioById[io].household_demand })),
      reasons: [...f.reasons],
      // Against the solutions touching this family, not every node on the canvas.
      coverage: {
        counted: f.counted.size,
        touching: (touches[fam] || new Set()).size || f.counted.size,
      },
    }
  }

  return {
    families: out,
    // Cards left out of every sum because nothing links them (`graph.linkedOnly`).
    unlinked: unlinked.map((n) => ({ nodeId: n.id, solutionId: n.sol })),
    // Resources a linked card needs and nothing linked gives it, figure or no figure, and what a
    // card makes that nothing takes (Eric, 2026-10-30). Only where the caller asks for links.
    ...openEnds(nodes, graph, solById, data),
    // The scenario menu is generated from this: the basis names its denominator.
    scaleInputs: [...neededInputs].sort(),
    // Present when the feedstock quantity was derived rather than entered, so the
    // panel can pre-fill it and the disclosure can say where the number came from.
    feedstockDerived: neededInputs.has('feedstock') ? feedstockDerived : null,
    // Fuels something on the canvas burns, with the unit the reader should enter and
    // the density that converts it. The menu renders one field per entry.
    fuelInputs: fuelNeeds,
    // Sourced figures not in any total: denominator not reconcilable, or outranked by a more
    // precise basis. Shown, never added.
    referenceFigures: reference,
    // Which climate variables the placed figures actually depend on.
    climateInputs: [...neededClimate].sort(),
    // Offer the mains-off switch only where there is a connection to stop.
    hasMains: mainsSolutions.length > 0,
    withoutFigures,
    // Which fabric-class row set the heating demand, if any.
    fabricUsed,
    // Where the label/floor-area fields should be offered. Empty on a graph with no heat.
    fabricInputs,
    // Days a year the daily mean reaches 26 and 30 C, then and now. Never a verdict.
    heatExposure,
    // Placed fabric measures: real, helpful, and deliberately uncounted. Never a verdict.
    advisory,
    // The department chosen and the town whose climate answered for it; the panel names the
    // town.
    departmentUsed: deptRow,
    // Outside France, the region whose town answered (TODO C9), or null.
    regionUsed: region ? { id: region.id, name: region.name, station: region.station, hasPv: !!region.pv } : null,
    // The climate numbers actually used, each with its source and tier.
    climateFigures,
    climateKey,
    // A summary of where the climate figures come from. `zone` follows the resolved key.
    climateUsed: climate
      ? {
          zone: region ? region.id : climateKey || 'SITE-CAEN',
          station: climate.station || UNNAMED_POINT[climateKey] || null,
          confirmed: !!(data.climate || {}).zone_table_confirmed,
        }
      : null,
  }
}
