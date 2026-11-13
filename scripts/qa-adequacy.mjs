/**
 * Checks the adequacy engine against the rules it is supposed to implement.
 *
 * Every rule here was derived from evidence and is recorded in TODO.md; this file
 * is where each one stops being prose and becomes something that fails a build.
 * The numeric expectations are hand-computed from the catalogue's own sourced
 * figures, so if a coefficient changes, the arithmetic assertions change with it
 * and that is the point: they pin the engine, not the data.
 *
 * No test framework, deliberately: this follows the existing qa-*.mjs pattern and
 * adds no dependency to a project whose whole delivery model is a static bundle.
 *
 * Run:  node scripts/qa-adequacy.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { assess, lessUsing, DEFAULT_SCENARIO, VERDICT, REASON, FAMILIES, FAMILY_UNIT } from '../src/adequacy/engine.js'
import { moveFor, rankSupply } from '../src/adequacy/moves.js'
import { rawWaterWarnings, waterQualities } from '../src/adequacy/water.js'
import uiEn from '../src/ui-strings.js'
import uiFr from '../src/ui-strings.fr.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(resolve(HERE, '../src/data/catalogue.json'), 'utf8'))

const BASE = {
  people: 2, catchmentArea: 100, collectorArea: 4, arrayKwp: 3,
  dryYearFactor: 0.80, zone: 'SITE-CAEN',
}

let pass = 0
const fails = []

function check(label, fn) {
  try {
    fn()
    pass += 1
    console.log('  PASS  ' + label)
  } catch (err) {
    fails.push([label, err.message])
    console.log('  FAIL  ' + label + '\n          ' + err.message)
  }
}
const eq = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const near = (got, want, what, tol = 0.02) => {
  if (!Number.isFinite(got) || Math.abs(got - want) > tol) {
    throw new Error(`${what}: got ${got}, want ~${want}`)
  }
}
const has = (arr, v, what) => {
  if (!arr.includes(v)) throw new Error(`${what}: ${v} missing from [${arr.join(', ')}]`)
}
const hasNot = (arr, v, what) => {
  if (arr.includes(v)) throw new Error(`${what}: ${v} should NOT be present`)
}
const run = (ids, over = {}) => assess({ solutionIds: ids }, { ...BASE, ...over }, data)
// A graph with the first node WIRED to every other one. Needed wherever a mains
// connection is involved: a societal supply confers SUPPLIED only when it is actually
// connected to something, so the no-edge `run` form is the unconnected case.
const runWired = (ids, over = {}) => assess({
  nodes: ids.map((sol, i) => ({ id: `n${i}`, sol })),
  edges: ids.slice(1).map((_, i) => ({ from: 'n0', to: `n${i + 1}` })),
}, { ...BASE, ...over }, data)

console.log('\nadequacy engine\n')

// --- the three colours actually discriminate -------------------------------
check('band entirely above 1 is green', () => {
  const w = run(['SOL-053', 'SOL-094']).families.water
  eq(w.verdict, VERDICT.GREEN, 'verdict')
  if (!(w.band[0] > 1)) throw new Error('low end should exceed 1, got ' + w.band[0])
})

check('band straddling 1 is yellow', () => {
  const w = run(['SOL-053', 'SOL-092', 'SOL-094']).families.water
  eq(w.verdict, VERDICT.YELLOW, 'verdict')
  if (!(w.band[0] < 1 && w.band[1] > 1)) throw new Error('band should straddle 1: ' + w.band)
})

check('band entirely below 1 is red', () => {
  const w = run(['SOL-053', 'SOL-092'], { catchmentArea: 20 }).families.water
  eq(w.verdict, VERDICT.RED, 'verdict')
  if (!(w.band[1] < 1)) throw new Error('high end should be below 1, got ' + w.band[1])
})

// --- grey is a fourth state, never a shade of yellow ------------------------
check('a chain with no figures at all returns no families and no verdict', () => {
  const r = run(['SOL-012', 'SOL-013'])
  eq(Object.keys(r.families).length, 0, 'families')
  eq(r.withoutFigures.length, 2, 'withoutFigures')
})

check('a RATIO with nothing feeding it produces nothing, and says why', () => {
  // MVHR alone: its heat-recovery ratio has no input pool to convert, because no
  // solution placed produces into one of its summable inputs. Reporting "nothing
  // feeds this" beats inventing a supply.
  const h = run(['SOL-040']).families.heat
  eq(h.verdict, VERDICT.GREY, 'verdict')
  eq(h.band, null, 'band')
  has(h.reasons, REASON.RATIO_NO_INPUT, 'reasons')
})

// --- RATIO conversion, on a synthetic fixture --------------------------------
// Deliberately NOT seeded into the workbook: no Tier A source for a heat-pump
// SCOP was retrieved this session, and an unsourced figure does not get written
// (Methodology 4). The engine's conversion path is still testable without one.
const FIXTURE = {
  bases: [
    { basis: 'per kWp per year', scale_input: 'array-kwp', behavioural: false, usage: null },
    { basis: 'dimensionless ratio', scale_input: 'none', behavioural: false, usage: null },
    { basis: 'per day', scale_input: 'none', behavioural: false, usage: null },
  ],
  coefficients: [
    { solution_id: 'X-PV', io_type_id: 'IO-18', role: 'out', kind: 'SOURCE',
      low: 365.25, high: 365.25, unit: 'kWh/kWp/yr', basis: 'per kWp per year',
      condition: 'fixture', source: 'fixture', tier: 'A', precision: 'P1' },
    { solution_id: 'X-HP', io_type_id: 'IO-36', role: 'out', kind: 'RATIO',
      low: 3, high: 4, unit: 'ratio', basis: 'dimensionless ratio',
      condition: 'fixture', source: 'fixture', tier: 'A', precision: 'P1' },
    { solution_id: 'X-RAD', io_type_id: 'IO-36', role: 'in', kind: 'DEMAND',
      low: 2, high: 2, unit: 'kWh/day', basis: 'per day',
      condition: 'fixture', source: 'fixture', tier: 'A', precision: 'P1' },
  ],
  io_index: [
    { sol: 'X-PV', io: 'IO-18', role: 'produces' },
    { sol: 'X-HP', io: 'IO-18', role: 'consumes' },
    { sol: 'X-HP', io: 'IO-36', role: 'produces' },
    { sol: 'X-RAD', io: 'IO-36', role: 'consumes' },
  ],
  climate: { zone_table_confirmed: false, zones: {} },
}

check('a RATIO converts one pool into another, across families', () => {
  // 1 kWp x 365.25 kWh/yr = 1.0 kWh/day of DC electricity, converted at 3-4x
  // into 3.0-4.0 kWh/day of heat, against a 2.0 kWh/day heat demand.
  const r = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD'] },
                   { ...BASE, arrayKwp: 1 }, FIXTURE)
  const h = r.families.heat
  eq(h.verdict, VERDICT.GREEN, 'heat verdict')
  near(h.band[0], 1.5, 'low')     // 3.0 / 2.0
  near(h.band[1], 2.0, 'high')    // 4.0 / 2.0
  has(h.reasons, REASON.RATIO_APPLIED, 'reasons')
})

check('a RATIO drains the pool it converts, so nothing is counted twice', () => {
  // The electricity the heat pump consumed must not also stand as spare supply.
  const r = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD'] },
                   { ...BASE, arrayKwp: 1 }, FIXTURE)
  const e = r.families.electricity
  // This asserted against a field the engine did not expose, so it passed without
  // testing anything until supply/demand were surfaced. Guard against that here:
  // the field must EXIST before its value means anything.
  if (!e) throw new Error('no electricity family at all')
  if (!e.supply || !('annual' in e.supply)) throw new Error('supply not exposed; test is vacuous')
  if (e.supply.annual && e.supply.annual[1] > 0.001) {
    throw new Error('converted electricity still counted as supply: ' + e.supply.annual)
  }
})

check('a worse ratio can only make the verdict worse', () => {
  const worse = JSON.parse(JSON.stringify(FIXTURE))
  worse.coefficients[1].low = 0.5
  worse.coefficients[1].high = 0.6
  const r = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD'] },
                   { ...BASE, arrayKwp: 1 }, worse)
  eq(r.families.heat.verdict, VERDICT.RED, 'heat verdict')
})

check('demand with no supply is grey, not red', () => {
  const w = run(['SOL-094']).families.water
  eq(w.verdict, VERDICT.GREY, 'verdict')
  has(w.reasons, REASON.NO_SUPPLY, 'reasons')
})

// --- the partial-total failure, found by running the engine 2026-09-02 ------
// Asserted against the FIXTURE, not the live catalogue. The first version of this
// test used SOL-216, which then acquired a coefficient in the next sourcing pass
// and broke the test for a good reason: it was pinning the DATA rather than the
// engine. Sourcing will keep doing that, so the rule is tested where it cannot.
check('a placed solution touching the family with NO figure forces partial-coverage', () => {
  const f = JSON.parse(JSON.stringify(FIXTURE))
  f.io_index.push({ sol: 'X-MYSTERY', io: 'IO-36', role: 'consumes' })
  const r = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD', 'X-MYSTERY'] },
                   { ...BASE, arrayKwp: 1 }, f)
  const h = r.families.heat
  has(h.reasons, REASON.NO_FIGURE, 'reasons')
  has(h.reasons, REASON.PARTIAL_COVERAGE, 'reasons')
  eq(h.coverage.counted, 2, 'counted')
  eq(h.coverage.touching, 3, 'touching')
})

// --- solar collectors follow the seasons, found by probing 2026-09-03 --------
// The two collector bases ignored the climate entirely, so a collector figure came
// out the same in December as in July and the same in Caen as in Marseille. No
// coefficient used either basis yet, which is exactly why nothing failed: the
// defect was waiting for the first solar-thermal row rather than being caused by
// it. On the fixture, so a later sourcing pass cannot invalidate the rule.
const SOLAR_FIXTURE = {
  bases: [
    { basis: 'per m2 of collector per year', scale_input: 'collector-area',
      behavioural: false, usage: null, climate_input: 'irradiance' },
    { basis: 'per m2 of collector', scale_input: 'collector-area',
      behavioural: false, usage: null, climate_input: 'irradiance' },
    { basis: 'per day', scale_input: 'none', behavioural: false, usage: null },
  ],
  coefficients: [
    { solution_id: 'X-SUN', io_type_id: 'IO-16', role: 'out', kind: 'SOURCE',
      low: 365.25, high: 365.25, unit: 'L/m2/yr', basis: 'per m2 of collector per year',
      condition: 'fixture', source: 'fixture', tier: 'A', precision: 'P1' },
    { solution_id: 'X-TAP', io_type_id: 'IO-16', role: 'in', kind: 'DEMAND',
      low: 1, high: 1, unit: 'L/day', basis: 'per day',
      condition: 'fixture', source: 'fixture', tier: 'A', precision: 'P1' },
  ],
  io_index: [
    { sol: 'X-SUN', io: 'IO-16', role: 'produces' },
    { sol: 'X-TAP', io: 'IO-16', role: 'consumes' },
  ],
  // A deliberately extreme profile: one month at a quarter of the mean. Fixed
  // numbers, so the assertion is arithmetic rather than a comparison against
  // whatever the real zone happens to hold this month.
  climate: {
    zone_table_confirmed: false,
    zones: {
      'SITE-CAEN': {
        pv: {
          annual_kwh_per_kwp: 1200,
          monthly_kwh_per_kwp: [25, 60, 100, 130, 150, 160, 165, 150, 120, 80, 35, 25],
        },
      },
    },
  },
}

check('a collector figure falls with the seasons instead of staying flat', () => {
  const r = assess({ solutionIds: ['X-SUN', 'X-TAP'] },
                   { ...BASE, collectorArea: 1 }, SOLAR_FIXTURE)
  const w = r.families.water
  // 365.25 L/m2/yr on 1 m2 is 1.0 L/day as an annual mean, against 1 L/day of
  // demand: exactly 1.0. January carries 25/31 = 0.806 L/day against an annual
  // daily mean of 1200/365.25 = 3.286, a share of 0.2454.
  near(w.annual.band[1], 1.0, 'annual high')
  near(w.worstMonth.band[1], 0.2454, 'worst-month high', 0.005)
  if (!(w.worstMonth.band[1] < w.annual.band[1] * 0.5)) {
    throw new Error('worst month did not fall with irradiance: ' + JSON.stringify(w.worstMonth.band))
  }
  // And the worse of the two is what gets reported.
  eq(w.verdict, VERDICT.RED, 'verdict')
  has(w.reasons, REASON.WORST_MONTH_BINDS, 'reasons')
})

check('a collector that is not solar is not scaled by sunshine', () => {
  // "per m2 of collector" said collector and MEANT solar collector, because the scaling
  // was hardcoded per case. A fog net is the obvious next user of that denominator and
  // its yield is anti-correlated with sunshine, so it would have been made to peak in
  // July -- wrong in the flattering direction, in the month a reader cares about least.
  // Nothing would have failed. The basis now decides, through climate_input.
  const f = JSON.parse(JSON.stringify(SOLAR_FIXTURE))
  f.bases[0].climate_input = null          // a collector the weather does not shine on
  const r = assess({ solutionIds: ['X-SUN', 'X-TAP'] }, { ...BASE, collectorArea: 1 }, f)
  const w = r.families.water
  near(w.annual.band[1], 1.0, 'annual high')
  near(w.worstMonth.band[1], 1.0, 'worst month must equal annual when nothing declares a season')
  // And with the declaration restored it IS scaled, so the test is about the
  // declaration and not about the case having been removed.
  const solar = assess({ solutionIds: ['X-SUN', 'X-TAP'] },
                       { ...BASE, collectorArea: 1 }, SOLAR_FIXTURE).families.water
  near(solar.worstMonth.band[1], 0.2454, 'the solar one still falls with the seasons', 0.005)
})

check('the per-day collector basis is scaled the same way as the per-year one', () => {
  // The two differ only in their time unit. A fix applied to one and not the other
  // is the kind of half-fix that leaves a second row silently flat.
  const f = JSON.parse(JSON.stringify(SOLAR_FIXTURE))
  f.coefficients[0].basis = 'per m2 of collector'
  f.coefficients[0].low = 1
  f.coefficients[0].high = 1
  const r = assess({ solutionIds: ['X-SUN', 'X-TAP'] },
                   { ...BASE, collectorArea: 1 }, f)
  const w = r.families.water
  near(w.annual.band[1], 1.0, 'annual high')
  near(w.worstMonth.band[1], 0.2454, 'worst-month high', 0.005)
})

check('a solar row with no monthly profile goes grey rather than reporting its annual', () => {
  // The failure this replaces was silent and optimistic: with no profile the month
  // reused the annual figure, so a missing climate looked like a good winter.
  const f = JSON.parse(JSON.stringify(SOLAR_FIXTURE))
  delete f.climate.zones['SITE-CAEN'].pv.monthly_kwh_per_kwp
  const r = assess({ solutionIds: ['X-SUN', 'X-TAP'] },
                   { ...BASE, collectorArea: 1 }, f)
  eq(r.families.water.worstMonth.verdict, VERDICT.GREY, 'worst-month verdict')
})

check('a sizing figure is never summed into a flow pool', () => {
  // A constructed wetland is dimensioned in m2 per person-equivalent. Adding square
  // metres to a pool of litres per day would give a confident wrong verdict, so the
  // basis is flagged in the Bases sheet and the engine drops it from the arithmetic.
  const w = run(['SOL-053', 'SOL-094', 'SOL-065']).families.water
  has(w.reasons, REASON.NOT_A_FLOW, 'reasons')
  const without = run(['SOL-053', 'SOL-094']).families.water
  near(w.band[0], without.band[0], 'low end unchanged by the sizing row')
  near(w.band[1], without.band[1], 'high end unchanged by the sizing row')
})

check('every basis marked as not contributing to flow is a sizing basis', () => {
  const bad = data.bases.filter((b) => b.contributes_to_flow === false && b.behavioural)
  if (bad.length) throw new Error('behavioural and non-flow at once: ' + bad.map((b) => b.basis))
})

check('coverage counts against the family, not against every node on the canvas', () => {
  // Six-node graph, but the water verdict must not read "2 of 6".
  const r = run(['SOL-053', 'SOL-094', 'SOL-076', 'SOL-087'])
  eq(r.families.water.coverage.touching, 2, 'water touching')
  eq(r.families.electricity.coverage.touching, 3, 'electricity touching')
})

// --- worst-of-two-periods, the rule that would have shipped a false green ---
check('worst month binds when it is worse than annual', () => {
  const e = run(['SOL-076', 'SOL-087'], { arrayKwp: 0.4 }).families.electricity
  eq(e.annual.verdict, VERDICT.GREEN, 'annual')
  eq(e.worstMonth.verdict, VERDICT.YELLOW, 'worst month')
  eq(e.verdict, VERDICT.YELLOW, 'reported')
  eq(e.binding, 'worst-month', 'binding')
  has(e.reasons, REASON.WORST_MONTH_BINDS, 'reasons')
})

check('the reported verdict is never better than either period', () => {
  const cases = [
    [['SOL-076', 'SOL-087'], { arrayKwp: 0.4 }],
    [['SOL-076', 'SOL-087', 'SOL-094'], {}],
    [['SOL-053', 'SOL-094'], {}],
    [['SOL-053', 'SOL-092'], { catchmentArea: 20 }],
  ]
  const rank = { grey: 0, red: 1, yellow: 2, green: 3 }
  for (const [ids, over] of cases) {
    for (const f of Object.values(run(ids, over).families)) {
      const periods = [f.annual.verdict, f.worstMonth.verdict].filter((v) => v !== VERDICT.GREY)
      if (!periods.length) continue
      const worst = Math.min(...periods.map((v) => rank[v]))
      if (rank[f.verdict] > worst) {
        throw new Error(`${ids.join('+')}: reported ${f.verdict} but a period was worse`)
      }
    }
  }
})

// --- one verdict per family, no roll-up -------------------------------------
check('water and electricity are answered separately, with no combined score', () => {
  const r = run(['SOL-053', 'SOL-094', 'SOL-076', 'SOL-087'])
  has(Object.keys(r.families), 'water', 'families')
  has(Object.keys(r.families), 'electricity', 'families')
  if ('overall' in r || 'score' in r) throw new Error('engine must not produce a roll-up')
})

// --- the menu generates itself from the data --------------------------------
check('scale inputs are derived from the bases of the placed figures', () => {
  eq(run(['SOL-053']).scaleInputs.join(','), 'catchment-area', 'rainwater only')
  eq(run(['SOL-076']).scaleInputs.join(','), 'array-kwp', 'PV only')
  eq(run(['SOL-053', 'SOL-076']).scaleInputs.join(','), 'array-kwp,catchment-area', 'both')
  // SOL-094 is the electric washing machine. Its own coefficient is per CYCLE and needs no
  // scale input -- that half of this assertion is unchanged. But the machine consumes
  // IO-09 potable water, whose HOUSEHOLD demand is 8-12 L/person/day, so the graph does
  // depend on occupancy and the menu has to say so.
  // This line read `length, 0` until 2026-09-09 and was asserting a bug: the household
  // demand was computed at the default of two occupants while the control that sets it
  // stayed hidden, because the menu is gated on the same list this checks. Measured on the
  // corrected engine: a lone washing machine reports 40-61.8 L/day, of which 16-24 is the
  // per-person share.
  eq(run(['SOL-094']).scaleInputs.join(','), 'people',
     'a per-cycle demand asks for occupancy only because it touches a per-person household demand')
})

check('a per-person household demand always asks for occupancy', () => {
  // Eric's case, 2026-09-09: rainwater to a filter to the home. Every io carrying a
  // /person/day household demand must put `people` on the menu, whatever the placed
  // solutions' own bases happen to be, or the reader gets a verdict resting on an
  // assumption they were never shown and cannot change.
  const perPerson = (data.io_types || [])
    .filter((t) => /\/person\/day$/.test(String((t.household_demand || {}).unit || '')))
    .map((t) => t.id)
  if (!perPerson.length) throw new Error('expected at least one per-person household demand')
  for (const io of perPerson) {
    // Not a card that merely offers it as an alternative: that opens no need (C10).
    const sol = (data.solutions || []).find((s) =>
      (data.io_index || []).some((e) => (e.sol || e.solution_id) === s.id && (e.io || e.io_type_id) === io) &&
      !(s.input_groups || []).some((g) => g.includes(io) && g[0] !== io))
    if (!sol) continue
    const got = run([sol.id]).scaleInputs
    if (!got.includes('people')) {
      throw new Error(`${io} is priced per person but ${sol.id} did not ask for occupancy`)
    }
  }
})

// --- behaviour is absorbed, never asked -------------------------------------
check('a behavioural basis widens the band and is flagged', () => {
  const w = run(['SOL-053', 'SOL-094']).families.water
  has(w.reasons, REASON.BEHAVIOUR_WIDENS, 'reasons')
})

check('no scale input is ever requested for a behavioural basis', () => {
  const bases = new Map(data.bases.map((b) => [b.basis, b]))
  for (const b of data.bases) {
    if (b.behavioural && b.scale_input !== 'none') {
      throw new Error(`${b.basis} is behavioural but asks for ${b.scale_input}`)
    }
  }
  if (!bases.size) throw new Error('no bases exported')
})

// --- arithmetic, hand-computed from the catalogue's own sourced figures ------
check('PV supply matches the sourced band by hand', () => {
  // 3 kWp x 1047.7-1225.6 kWh/kWp/yr / 365.25 = 8.60-10.07 kWh/day.
  // Demand: fridge 150-400 kWh/yr = 0.411-1.095, washer 0.474-0.489 x 0.5-0.7
  // cycles/day = 0.237-0.342.  Total 0.648-1.437.  Ratio 5.99-15.54.
  const e = run(['SOL-076', 'SOL-087', 'SOL-094']).families.electricity
  near(e.annual.band[0], 5.99, 'low', 0.05)
  near(e.annual.band[1], 15.54, 'high', 0.10)
})

check('rainwater supply applies the dry-year factor and the collection efficiency', () => {
  // 100 m2 x 745 mm x 0.80 / 365.25 = 163.2 mm.m2/day, x 0.75-0.90 = 122.4-146.9 L/day.
  // ASSERTED ON THE SUPPLY, not on the band. It used to divide by a washing machine's
  // demand, so the arrival of the household's own drinking water -- a change on the
  // DEMAND side, nothing to do with rainfall -- broke a test about RAINFALL
  // (2026-09-04). Pin the quantity the check is named for.
  const w = run(['SOL-053', 'SOL-094']).families.water
  near(w.supply.annual[0], 122.4, 'supply low', 0.1)
  near(w.supply.annual[1], 146.9, 'supply high', 0.1)
})

check('a drier dry-year basis can only make a verdict worse, never better', () => {
  const ids = ['SOL-053', 'SOL-092', 'SOL-094']
  const wet = run(ids, { dryYearFactor: 1.0 }).families.water
  const dry = run(ids, { dryYearFactor: 0.64 }).families.water
  if (!(dry.band[0] <= wet.band[0])) {
    throw new Error(`driest basis raised the low end: ${dry.band[0]} > ${wet.band[0]}`)
  }
})

// --- three inconsistencies found by auditing the engine against itself ------
check('the menu offers every input the arithmetic actually uses', () => {
  // A behavioural basis counted per person depends on household size even though
  // its own scale_input is 'none'. It was silently using the default of 2 while
  // household size moved the band by 3x.
  const r = run(['SOL-053', 'SOL-216'])
  has(r.scaleInputs, 'people', 'scaleInputs')
  const two = run(['SOL-053', 'SOL-216'], { people: 2 }).families.water.band
  const six = run(['SOL-053', 'SOL-216'], { people: 6 }).families.water.band
  if (!(six[0] < two[0])) throw new Error('household size does not move the band')
})

check('any input that moves a band is offered in the menu', () => {
  // The general form of the rule above, so a new basis cannot reintroduce it.
  const ids = ['SOL-053', 'SOL-216', 'SOL-092', 'SOL-094', 'SOL-076', 'SOL-087']
  const base = run(ids)
  const probes = { people: 5, catchmentArea: 250, arrayKwp: 9 }
  const inputFor = { people: 'people', catchmentArea: 'catchment-area', arrayKwp: 'array-kwp' }
  for (const [key, value] of Object.entries(probes)) {
    const moved = run(ids, { [key]: value })
    for (const fam of Object.keys(base.families)) {
      const a = base.families[fam].band
      const b = moved.families[fam]?.band
      if (!a || !b) continue
      const changed = Math.abs(a[0] - b[0]) > 1e-9 || Math.abs(a[1] - b[1]) > 1e-9
      if (changed && !base.scaleInputs.includes(inputFor[key])) {
        throw new Error(`${key} changes the ${fam} band but ${inputFor[key]} is not offered`)
      }
    }
  }
})

check('the dry-year choice reaches the worst month, not only the annual figure', () => {
  const ids = ['SOL-053', 'SOL-094']
  const wet = run(ids, { dryYearFactor: 1.0 }).families.water
  const dry = run(ids, { dryYearFactor: 0.64 }).families.water
  if (!(dry.worstMonth.band[0] < wet.worstMonth.band[0])) {
    throw new Error('a drier year left the worst month untouched')
  }
})

check('the worst month is never better than the annual average', () => {
  // The incoherence this caught: only the annual figure was being scaled by the
  // dry-year factor, so "driest year on record" produced an annual band BETTER
  // than the worst month inside it.
  for (const f of [1.0, 0.8, 0.64]) {
    const w = run(['SOL-053', 'SOL-094'], { dryYearFactor: f }).families.water
    if (w.worstMonth.band[0] > w.annual.band[0] + 1e-9) {
      throw new Error(`dryYear=${f}: worst month (${w.worstMonth.band[0]}) beats annual (${w.annual.band[0]})`)
    }
  }
})

check('on a tied verdict the worse BAND is reported, never the rosier one', () => {
  // The tie used to be arranged by picking a catchment area, which meant any change to
  // the demand side could dissolve it -- and the household drinking-water demand did,
  // on 2026-09-04. Arranged on the fixture instead, where the two periods tie because
  // the climate profile is flat and nothing about sourcing can alter that.
  const f = JSON.parse(JSON.stringify(SOLAR_FIXTURE))
  // Flat PER DAY, not per month: twelve equal monthly totals are NOT a flat year,
  // because February is shorter and so carries the highest daily rate. Scaling each
  // month by its own length is what makes the two periods genuinely tie.
  const DAYS_IN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  f.climate.zones['SITE-CAEN'].pv.monthly_kwh_per_kwp = DAYS_IN.map((n) => n * 10)
  f.climate.zones['SITE-CAEN'].pv.annual_kwh_per_kwp = 3652.5
  // The tie that matters is a tie in VERDICT with DIFFERENT bands, which is the case the
  // rule exists for: showing "covers 2.0x" when the binding month only covers 1.98x is
  // optimistic in the number even where the colour is right. An exact numeric tie is not
  // arrangeable here anyway -- the engine counts February as 28.25 days, so a year that
  // is flat per calendar month is not quite flat per day.
  f.coefficients[1].low = 0.5
  f.coefficients[1].high = 0.5
  const w = assess({ solutionIds: ['X-SUN', 'X-TAP'] },
                   { ...BASE, collectorArea: 1 }, f).families.water
  eq(w.annual.verdict, w.worstMonth.verdict, 'the two periods should tie on the verdict')
  if (!(w.worstMonth.band[0] < w.annual.band[0])) {
    throw new Error('the fixture failed to make the month the worse of the two')
  }
  near(w.band[0], w.worstMonth.band[0], 'the worse band is the one reported', 0.001)
})

// --- CAPACITY is a transfer limit, not a supply ------------------------------
check('a pass-through with nothing upstream supplies nothing', () => {
  // A biosand filter with no water source invented 288-576 L/day of potable water
  // before this. It can only ever pass on what reaches it.
  const w = run(['SOL-131', 'SOL-092']).families.water
  eq(w.verdict, VERDICT.GREY, 'verdict')
  has(w.reasons, REASON.NO_SUPPLY, 'reasons')
})

check('adding a treatment step never improves a verdict', () => {
  // It turned yellow into green before the fix. A filter cannot make more water.
  const rank = { grey: 0, red: 1, yellow: 2, green: 3 }
  for (const area of [100, 300, 600, 1000]) {
    const plain = run(['SOL-053', 'SOL-092'], { catchmentArea: area }).families.water
    const with_ = run(['SOL-053', 'SOL-131', 'SOL-092'], { catchmentArea: area }).families.water
    if (rank[with_.verdict] > rank[plain.verdict]) {
      throw new Error(`roof ${area}: filter improved ${plain.verdict} to ${with_.verdict}`)
    }
    if (with_.band && plain.band && with_.band[1] > plain.band[1] + 1e-9) {
      throw new Error(`roof ${area}: filter raised the high end`)
    }
  }
})

check('a throughput limit binds once the supply exceeds it', () => {
  // 12-24 L/h is 288-576 L/day, so it only bites on a large catchment.
  const small = run(['SOL-053', 'SOL-131', 'SOL-092'], { catchmentArea: 100 }).families.water
  const large = run(['SOL-053', 'SOL-131', 'SOL-092'], { catchmentArea: 1000 }).families.water
  hasNot(small.reasons, REASON.CAPACITY_CLAMPED, 'small roof')
  has(large.reasons, REASON.CAPACITY_CLAMPED, 'large roof')
})

check('a saturated throughput stops responding to a bigger catchment', () => {
  const a = run(['SOL-053', 'SOL-131', 'SOL-092'], { catchmentArea: 600 }).families.water
  const b = run(['SOL-053', 'SOL-131', 'SOL-092'], { catchmentArea: 1000 }).families.water
  near(a.band[1], b.band[1], 'high end is capped by the filter, not the roof', 0.05)
})

// --- the union rule, now reachable ------------------------------------------
check('two bases for one quantity are unioned, not summed', () => {
  // The pressurised shower carries two sourced demand figures. Summing them would
  // double one shower; picking one would hide an editorial choice from the reader.
  const w = run(['SOL-053', 'SOL-092']).families.water
  has(w.reasons, REASON.BASES_UNIONED, 'reasons')
  const bases = w.rows.filter((r) => r.coef.role === 'in').map((r) => r.coef.basis)
  if (bases.length < 2) throw new Error('expected two demand bases, got ' + bases.length)
})

check('bases of different precision are not unioned: the better one is used', () => {
  // Eric, 2026-09-16: union only within one precision class. Across classes the more
  // precise figure is used and the other is shown as a reference figure. Tested on a copy
  // of the catalogue with the shower's per-minute basis downgraded, so the rule is pinned
  // on behaviour and not on today's grading.
  const graded = JSON.parse(JSON.stringify(data))
  const perMin = graded.coefficients.find((c) => c.solution_id === 'SOL-092'
    && c.role === 'in' && c.basis === 'per minute of showering')
  if (!perMin) throw new Error('fixture assumption changed: SOL-092 has no per-minute basis')
  perMin.precision = 'P3'
  const without = JSON.parse(JSON.stringify(data))
  without.coefficients = without.coefficients.filter((c) => !(c.solution_id === 'SOL-092'
    && c.role === 'in' && c.basis === 'per minute of showering'))
  const a = assess({ solutionIds: ['SOL-053', 'SOL-092'] }, BASE, graded)
  const b = assess({ solutionIds: ['SOL-053', 'SOL-092'] }, BASE, without)
  const w = a.families.water
  has(w.reasons, REASON.BASIS_SET_ASIDE, 'reasons')
  hasNot(w.reasons, REASON.BASES_UNIONED, 'reasons')
  eq(JSON.stringify(w.demand.annual), JSON.stringify(b.families.water.demand.annual),
     'demand equals the precise basis alone')
  if (!a.referenceFigures.some((r) => r.coef.basis === 'per minute of showering')) {
    throw new Error('the set-aside basis is not in the reference figures')
  }
  if (w.rows.some((r) => r.coef.basis === 'per minute of showering')) {
    throw new Error('the set-aside basis is still listed among the rows the total used')
  }
})

check('unioning widens, and never narrows, the demand', () => {
  // Guards the rule's direction: the union must cover both bases, so the resulting
  // band can only be wider than either alone.
  const w = run(['SOL-053', 'SOL-092']).families.water
  const perDay = 2 * 60           // low end of the per-person-per-day basis, 2 people
  const perMin = 2 * (6 * 5)      // low end of the per-minute-of-use basis
  const lowestDemand = Math.min(perDay, perMin)
  if (!(w.band[1] >= 0)) throw new Error('no band')
  if (lowestDemand !== perMin) throw new Error('fixture assumption changed; recheck by hand')
})

check('two different solutions consuming one io still ADD', () => {
  // Union is within a solution. Two showers are two draws, not one measured twice.
  const one = run(['SOL-053', 'SOL-092']).families.water
  const two = run(['SOL-053', 'SOL-092', 'SOL-091']).families.water
  if (!(two.band[0] < one.band[0])) {
    throw new Error('a second shower did not increase demand: union leaked across solutions')
  }
})

// --- honesty about the climate data -----------------------------------------
check('an unconfirmed zone table is reported as unconfirmed', () => {
  const r = run(['SOL-076'])
  if (!r.climateUsed) throw new Error('no climate reported')
  eq(r.climateUsed.confirmed, false, 'confirmed')
})

check('worst-month rainwater carries the monthly-is-P2 caveat', () => {
  // This project's own two rainfall sources disagree on which month is driest,
  // so a worst-month rainwater result is weaker evidence than an annual one.
  const w = run(['SOL-053', 'SOL-094']).families.water
  has(w.reasons, REASON.MONTHLY_IS_P2, 'reasons')
  const e = run(['SOL-076', 'SOL-087']).families.electricity
  hasNot(e.reasons, REASON.MONTHLY_IS_P2, 'electricity reasons')
})

// --- the converse of the rule above, which is what actually shipped broken ----
// The earlier check proved every input that MOVES a band is offered. It never
// proved the reverse, so the rainfall-year control was being shown on a solar-only
// graph where it changes nothing at all (Eric, 2026-09-02, on the power example).
// A control that cannot move the answer is worse than a missing one: it invites the
// reader to fiddle with something inert and quietly implies a dependency that is not
// there.
check('no control is offered that cannot move the answer', () => {
  const graphs = [
    ['power example', ['SOL-076', 'SOL-082', 'SOL-190', 'SOL-191']],
    ['water example', ['SOL-053', 'SOL-092']],
    ['mixed', ['SOL-053', 'SOL-092', 'SOL-076', 'SOL-087']],
    ['appliances only', ['SOL-094', 'SOL-087']],
  ]
  const probe = {
    'people': ['people', 2, 7],
    'catchment-area': ['catchmentArea', 100, 400],
    'array-kwp': ['arrayKwp', 3, 9],
    'collector-area': ['collectorArea', 4, 12],
  }
  for (const [label, ids] of graphs) {
    const base = run(ids)
    for (const input of base.scaleInputs) {
      const spec = probe[input]
      if (!spec) continue
      const [key, lo, hi] = spec
      const a = run(ids, { [key]: lo })
      const b = run(ids, { [key]: hi })
      // A control earns its place if it moves the band OR, where no verdict can be
      // computed yet, the underlying supply or demand. The power example has PV but
      // no electrical demand, so its array size legitimately moves a total without
      // moving a band.
      const totals = (r) => Object.keys(r.families).flatMap((fam) => {
        const f = r.families[fam]
        return [f.band, f.supply?.annual, f.demand?.annual]
      }).filter(Boolean).flat()
      const ta = totals(a), tb = totals(b)
      const moved = ta.length !== tb.length ||
        ta.some((v, i) => Math.abs(v - tb[i]) > 1e-9)
      if (!moved) throw new Error(`${label}: offers "${input}" but it changes nothing`)
    }
    // The rainfall control is gated on the climate dependency, not on scaleInputs.
    if (base.climateInputs.includes('rainfall')) {
      const a = run(ids, { dryYearFactor: 1.0 })
      const b = run(ids, { dryYearFactor: 0.64 })
      let moved = false
      for (const fam of Object.keys(a.families)) {
        const x = a.families[fam].band, y = b.families[fam]?.band
        if (x && y && Math.abs(x[0] - y[0]) > 1e-9) moved = true
      }
      if (!moved) throw new Error(`${label}: offers the rainfall year but it changes nothing`)
    }
  }
})

check('a solar-only graph is never asked about rainfall', () => {
  const p = run(['SOL-076', 'SOL-082', 'SOL-190', 'SOL-191'])
  hasNot(p.climateInputs, 'rainfall', 'power example climateInputs')
  has(p.climateInputs, 'irradiance', 'power example climateInputs')
  const a = run(['SOL-076'], { dryYearFactor: 1.0 }).families.electricity
  const b = run(['SOL-076'], { dryYearFactor: 0.64 }).families.electricity
  if (!a.supply || !a.supply.annual) throw new Error('supply not exposed; test is vacuous')
  if (a.supply.annual[0] !== b.supply.annual[0]) {
    throw new Error('the dry-year factor is reaching solar supply; the wording would need to change')
  }
})

// --- a grey must always carry a reason --------------------------------------
// Twice now a grey has shipped with no explanation: first when a converter took a
// shared pool, then again when a DRAINED pool of [0,0] read as "supply exists"
// because an array is truthy. A verdict of "not enough to say" with nothing beside
// it is the least useful output the tool can produce.
check('no family ever returns grey without saying why', () => {
  const graphs = [
    ['SOL-087'], ['SOL-094'], ['SOL-040'],
    ['SOL-076', 'SOL-031', 'SOL-087'],
    ['SOL-076', 'SOL-082'],
    ['SOL-131', 'SOL-092'],
    ['SOL-053'], ['SOL-076'],
  ]
  for (const ids of graphs) {
    const r = run(ids)
    for (const [fam, f] of Object.entries(r.families)) {
      if (f.verdict === VERDICT.GREY && f.reasons.length === 0) {
        throw new Error(`${ids.join('+')}: ${fam} is grey with no reason`)
      }
    }
  }
})

check('a converter serving a load is not reported as competing with it', () => {
  // PV -> inverter -> fridge: the inverter drains DC to FEED the AC the fridge
  // wants. It warned on every ordinary chain before this.
  const e = run(['SOL-076', 'SOL-082', 'SOL-087']).families.electricity
  hasNot(e.reasons, REASON.CONVERTER_TOOK_POOL, 'ordinary inverter chain')
  has(e.reasons, REASON.RATIO_APPLIED, 'ordinary inverter chain')
})

check('a converter that really does starve a load says so', () => {
  // Built on the fixture, because the live case stopped being a contest: once a
  // ratio DECLARES which input it converts from, the heat pump converts AC and no
  // longer competes for the PV's DC. A genuine contest needs both drawing on the
  // same io, which is what this fixture arranges.
  const f = JSON.parse(JSON.stringify(FIXTURE))
  f.coefficients[1].converts_from = 'IO-18'
  f.coefficients.push({ solution_id: 'X-LOAD', io_type_id: 'IO-18', role: 'in',
    kind: 'DEMAND', low: 0.5, high: 0.5, unit: 'kWh/day', basis: 'per day',
    condition: 'fixture', source: 'fixture', tier: 'A', precision: 'P1' })
  f.io_index.push({ sol: 'X-LOAD', io: 'IO-18', role: 'consumes' })
  const e = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD', 'X-LOAD'] },
                   { ...BASE, arrayKwp: 1 }, f).families.electricity
  eq(e.verdict, VERDICT.GREY, 'verdict')
  has(e.reasons, REASON.CONVERTER_TOOK_POOL, 'reasons')
})

check('a ratio applies to the input it names, not to whatever has a pool', () => {
  // A water heater's 0.90-1.00 is a THERMAL efficiency. Guessing the source made it
  // destroy 10 pc of the WATER VOLUME whenever a water pool existed upstream:
  // 122.38 L/day silently became 110.14.
  const plain = run(['SOL-053', 'SOL-092']).families.water
  const heated = run(['SOL-053', 'SOL-061', 'SOL-092']).families.water
  near(heated.supply.annual[0], plain.supply.annual[0], 'a water heater must not destroy water')
  near(heated.supply.annual[1], plain.supply.annual[1], 'nor at the high end')
})

check('every active ratio names the input it converts from', () => {
  for (const c of data.coefficients) {
    if (c.engine_use === false || c.basis !== 'dimensionless ratio') continue
    if (!c.converts_from) {
      throw new Error(`${c.solution_id} carries a ratio that does not say what it converts`)
    }
  }
})

check('conversion losses compound down a chain and never improve it', () => {
  const sup = (ids) => run(ids).families.electricity.supply.annual
  const pv = sup(['SOL-076', 'SOL-087'])
  const inv = sup(['SOL-076', 'SOL-082', 'SOL-087'])
  const batt = sup(['SOL-076', 'SOL-080', 'SOL-082', 'SOL-087'])
  if (!(inv[1] < pv[1])) throw new Error('the inverter did not cost anything')
  if (!(batt[1] < inv[1])) throw new Error('adding a battery did not cost anything')
})

// --- recorded but not summed -------------------------------------------------
// Eric, 2026-09-02: a sourced, trustworthy figure whose denominator will not
// reconcile should still be RECORDED and shown, not discarded. The risk is that it
// leaks into a total, which would be worse than not having it.
// REBUILT ON THE FIXTURE 2026-09-04, not deleted. Both of these used the LED lamp as
// their example of a solution carrying ONLY a reference figure, and a sourcing pass then
// gave it a real household demand. That is the third time a test has broken because it
// pinned the catalogue instead of the engine, and the rule is the same each time: a rule
// about behaviour belongs where sourcing cannot reach it.
const REF_FIXTURE = (() => {
  const f = JSON.parse(JSON.stringify(FIXTURE))
  f.coefficients.push(
    { solution_id: 'X-REF', io_type_id: 'IO-36', role: 'in', kind: 'DEMAND',
      low: 99, high: 99, unit: 'kWh/day', basis: 'per day',
      condition: 'fixture', source: 'fixture', tier: 'A', precision: 'P1',
      engine_use: false })
  f.io_index.push({ sol: 'X-REF', io: 'IO-36', role: 'consumes' })
  return f
})()

check('a reference figure never moves a total', () => {
  const base = ['X-PV', 'X-HP', 'X-RAD']
  const withOut = assess({ solutionIds: base }, { ...BASE, arrayKwp: 1 }, REF_FIXTURE)
  const withRef = assess({ solutionIds: [...base, 'X-REF'] }, { ...BASE, arrayKwp: 1 }, REF_FIXTURE)
  const da = withOut.families.heat.demand.annual
  const db = withRef.families.heat.demand.annual
  // 99 kWh/day would be impossible to miss if it leaked into the sum.
  near(da[0], db[0], 'demand low unchanged by a reference figure')
  near(da[1], db[1], 'demand high unchanged by a reference figure')
})

check('a reference figure is surfaced rather than silently dropped', () => {
  const r = run(['SOL-076', 'SOL-047', 'SOL-163'])
  const ids = r.referenceFigures.map((f) => f.solutionId)
  has(ids, 'SOL-047', 'referenceFigures')
  has(ids, 'SOL-163', 'referenceFigures')
})

check('every recorded-but-unused figure explains itself', () => {
  // An unexplained exclusion is invisible to a reader and to a later editor.
  for (const c of data.coefficients.filter((x) => x.engine_use === false)) {
    if (!c.notes || c.notes.length < 40) {
      throw new Error(`${c.solution_id} is excluded from the arithmetic without explaining why`)
    }
  }
})

check('a solution with only a reference figure still counts as uncovered', () => {
  // Recording a figure must not make a gap look filled: the row touches the family and
  // contributes nothing to it, so partial-coverage must still fire.
  const h = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD', 'X-REF'] },
                   { ...BASE, arrayKwp: 1 }, REF_FIXTURE).families.heat
  has(h.reasons, REASON.PARTIAL_COVERAGE, 'reasons')
  has(h.reasons, REASON.NO_FIGURE, 'reasons')
})

// --- a coefficient must be stated per the input its ratio describes ----------
// Eric, 2026-09-02: the heat-pump water heater listed ambient low-grade heat as an
// input while its two siblings did not. A COP describes heat moved per kWh of
// ELECTRICITY; had any IO-35 pool been filled, the ratio would have picked it as the
// source and multiplied compost or MVHR heat by an electrical COP. The free ambient
// energy is exactly what a COP above 1 already expresses, so drawing it as an input
// too is both inconsistent and arithmetically dangerous.
check('heat pumps are modelled consistently, on electricity alone', () => {
  const by = Object.fromEntries(data.solutions.map((x) => [x.id, x]))
  for (const id of ['SOL-031', 'SOL-160', 'SOL-223']) {
    const ins = (by[id].inputs || []).map((i) => i.io)
    if (ins.includes('IO-35')) {
      throw new Error(`${id} (${by[id].name}) draws ambient heat as an input; ` +
        'its COP already accounts for that, and an IO-35 pool would be multiplied by it')
    }
    if (!ins.includes('IO-03') && !ins.includes('IO-18')) {
      throw new Error(`${id} has no electrical input, so its COP has nothing to apply to`)
    }
  }
})

check('a dimensionless ratio has some summable input to apply to', () => {
  // The defensible half of a rule that was first written too strongly. The strong
  // version said a ratio must consume BOUGHT energy; MVHR disproves it, because its
  // 70-90% is heat recovery applied to a stale-air stream, not a COP. What does hold
  // is that a ratio must have SOMETHING it can convert, or it can only ever report
  // ratio-no-input.
  const by = Object.fromEntries(data.solutions.map((x) => [x.id, x]))
  for (const c of data.coefficients) {
    if (c.engine_use === false || c.basis !== 'dimensionless ratio') continue
    const ins = (by[c.solution_id]?.inputs || []).map((i) => i.io)
    const outs = (by[c.solution_id]?.outputs || []).map((i) => i.io)
    if (!ins.length || !outs.length) {
      throw new Error(`${c.solution_id} carries a ratio with nothing to convert between`)
    }
  }
})

// --- fuel comes from outside, so the reader supplies it ----------------------
// Measured before this landed: ZERO solutions produce biomass fuel, so every stove
// chain returned ratio-no-input and every fuel-family figure was inert. Fuel is
// bought or cut; the model had no way to say "I have this much wood".
check('a fuel-burning graph asks for the fuel, in the right unit', () => {
  const r = run(['SOL-030'])
  if (!r.fuelInputs.length) throw new Error('a wood stove did not ask for fuel')
  const wood = r.fuelInputs.find((f) => f.io === 'IO-04')
  if (!wood) throw new Error('IO-04 not offered')
  eq(wood.unit, 'kWh/kg', 'density unit')
})

check('no fuel entered means nothing to burn, said plainly', () => {
  const h = run(['SOL-030']).families.heat
  eq(h.verdict, VERDICT.GREY, 'verdict')
  has(h.reasons, REASON.RATIO_NO_INPUT, 'reasons')
})

check('fuel entered seeds the pool through the resource density', () => {
  // 2000 kg x 3.8-4.2 kWh/kg / 365.25 x 0.65-0.80 stove efficiency = 13.52-18.40.
  const h = run(['SOL-030'], { fuelStock: { 'IO-04': 2000 } }).families.heat
  near(h.supply.annual[0], 13.52, 'low', 0.05)
  near(h.supply.annual[1], 18.40, 'high', 0.05)
  has(h.reasons, REASON.FUEL_SUPPLIED, 'reasons')
  has(h.reasons, REASON.RATIO_APPLIED, 'reasons')
})

check('more fuel can only mean more heat', () => {
  const a = run(['SOL-030'], { fuelStock: { 'IO-04': 1000 } }).families.heat.supply.annual
  const b = run(['SOL-030'], { fuelStock: { 'IO-04': 3000 } }).families.heat.supply.annual
  if (!(b[0] > a[0] && b[1] > a[1])) throw new Error('tripling the wood did not raise the heat')
})

check('energy density lives on the resource, not repeated per appliance', () => {
  // One figure serves every appliance that burns it. If it were on solutions there
  // would be one copy per stove, free to drift.
  const fuels = data.io_types.filter((t) => t.energy_density)
  if (fuels.length < 4) throw new Error('expected densities on the four fuels')
  for (const t of fuels) {
    const dsy = t.energy_density
    if (!(dsy.low > 0 && dsy.high >= dsy.low)) throw new Error(`${t.id} density range is wrong`)
    if (!dsy.unit || !dsy.condition) throw new Error(`${t.id} density has no unit or condition`)
  }
  for (const c of data.coefficients) {
    if (/kWh\/kg|kWh\/m3/.test(c.unit) && c.engine_use !== false) {
      throw new Error(`${c.solution_id} carries an energy density; that belongs on the IO-type`)
    }
  }
})

check('a digester feeds the fuel family from kitchen waste', () => {
  // 400 kg x 0.075-0.179 m3/kg x 5-7 kWh/m3 / 365.25 = 0.411-1.372 kWh/day.
  const f = run(['SOL-161', 'SOL-162'], { feedstock: 400 }).families.fuel
  near(f.supply.annual[0], 0.411, 'low', 0.01)
  near(f.supply.annual[1], 1.372, 'high', 0.01)
  hasNot(f.reasons, REASON.FUEL_NEEDED, 'a supplied family must not ask for fuel')
})

check('the per-kg-VS figure is recorded but never summed', () => {
  // Nobody can weigh their volatile solids. The primary literature value is kept so
  // the derivation behind the per-kg-wet row is visible and checkable.
  const r = run(['SOL-161'], { feedstock: 400 })
  const ref = r.referenceFigures.find((x) => x.coef.basis === 'per kg of volatile solids')
  if (!ref) throw new Error('the per-kg-VS reference figure is not surfaced')
  const withRef = r.families.fuel.supply.annual
  if (!(withRef[1] < 2)) throw new Error('the VS figure leaked into the total: ' + withRef)
})

check('reverse osmosis costs water rather than making it', () => {
  // Recovery is 20-50%: three to four litres to the drain per litre produced on a
  // standard unit. Inserting it must make a chain worse, never better.
  const plain = run(['SOL-053', 'SOL-092'], { catchmentArea: 100 }).families.water
  const withRo = run(['SOL-053', 'SOL-149', 'SOL-092'], { catchmentArea: 100 }).families.water
  if (!(withRo.band[1] < plain.band[1])) throw new Error('RO did not cost anything')
  has(withRo.reasons, REASON.RATIO_APPLIED, 'reasons')
})

check('feedstock is derived from household size, not demanded of the reader', () => {
  // Nobody knows how many kilos of peelings they bin; everybody knows how many people
  // live there. 80 kg/person/year, ADEME.
  const r = run(['SOL-161', 'SOL-162'], { people: 2, feedstock: 0 })
  if (!r.feedstockDerived) throw new Error('no derivation offered')
  eq(r.feedstockDerived.kgPerYear, 160, 'two people at 80 kg each')
  if (!(r.families.fuel.supply.annual[1] > 0)) throw new Error('derived feedstock produced nothing')
})

check('more people means more feedstock and more biogas', () => {
  const two = run(['SOL-161', 'SOL-162'], { people: 2, feedstock: 0 }).families.fuel.supply.annual
  const six = run(['SOL-161', 'SOL-162'], { people: 6, feedstock: 0 }).families.fuel.supply.annual
  if (!(six[1] > two[1] * 2.5)) throw new Error('tripling the household barely moved the gas')
})

check('an entered feedstock overrides the derived one', () => {
  const derived = run(['SOL-161', 'SOL-162'], { people: 2, feedstock: 0 }).families.fuel.supply.annual
  const set = run(['SOL-161', 'SOL-162'], { people: 2, feedstock: 1000 }).families.fuel.supply.annual
  if (!(set[1] > derived[1])) throw new Error('the reader could not override the derivation')
})

check('a household yield is not confused with a whole-food-chain figure', () => {
  // 142 kg/person/year covers production and retail as well; using it here would
  // overstate feedstock by about 1.8x. The condition must say so.
  const io = data.io_types.find((t) => t.id === 'IO-13')
  if (!io.household_yield) throw new Error('no household yield on organic waste')
  if (!/142/.test(io.household_yield.condition)) {
    throw new Error('the condition does not warn against the whole-chain figure')
  }
})

check('a figure on an IO outside every family is surfaced, not dropped', () => {
  // Compost, human waste and daylight have no unit the engine sums in. A composting
  // toilet's chamber sizing is stated against human waste; before this it vanished
  // with no family, no reason and no mention -- the fourth variant of the same bug.
  const r = run(['SOL-069'])
  const ref = r.referenceFigures.find((x) => x.solutionId === 'SOL-069')
  if (!ref) throw new Error('the composting-toilet figure was dropped in silence')
  eq(ref.coef.unit, 'L/person/year', 'unit')
})

check('a ram pump scales with the stream, not with the pump', () => {
  // A ram pump lifts a fraction of the stream driving it; the rest runs on past. The
  // stream flow is the reader's, and it is bucket-and-stopwatch measurable, which is
  // what earns it a coefficient where wind gets a site prerequisite instead.
  const r = run(['SOL-177'], { flow: 0.002 })
  has(r.scaleInputs, 'flow', 'scaleInputs')
  const small = run(['SOL-177', 'SOL-092'], { flow: 0.0005 }).families.water.supply.annual
  const big = run(['SOL-177', 'SOL-092'], { flow: 0.01 }).families.water.supply.annual
  near(big[0] / small[0], 20, 'output must scale linearly with stream flow', 0.1)
})

check('a ram pump with no stream entered supplies nothing', () => {
  const w = run(['SOL-177', 'SOL-092'], { flow: 0 }).families.water
  eq(w.verdict, VERDICT.GREY, 'verdict')
  // The claim this test's NAME makes is "supplies nothing", and the GREY carries it.
  // It used to assert NO_SUPPLY as well, which is a different claim -- "nothing on the
  // canvas produces this" -- and that one became false on 2026-09-05: a ram pump plainly
  // does produce water, the reader has simply not said how much stream there is.
  // MISSING_SCENARIO is the sentence that was always true here.
  has(w.reasons, REASON.MISSING_SCENARIO, 'reasons')
  hasNot(w.reasons, REASON.NO_SUPPLY, 'reasons')
})

check('a producer with no figure is not reported as "nothing produces this"', () => {
  // Eric, testing 2026-09-05: a solar cooker with the household cooking demand showed
  // BOTH "some of what you placed carries no figure" AND "something here uses this, but
  // nothing on the canvas produces it". The second is false, and the reader has to work
  // out which half to believe.
  const cook = run(['SOL-090']).families.cooking
  has(cook.reasons, REASON.NO_FIGURE, 'reasons')
  hasNot(cook.reasons, REASON.NO_SUPPLY, 'reasons')

  // THE LINE THAT MAKES THIS HARD, and the reason the first fix was wrong. Producing
  // into a family is not the same as being a way INTO it:
  //   - a washing machine produces greywater, which is in the water family and is no
  //     kind of potable supply;
  //   - a bio-sand filter produces potable water and can only pass on what reaches it.
  // Both consume from the family they produce into. These two must keep NO_SUPPLY.
  const wash = run(['SOL-094']).families.water
  has(wash.reasons, REASON.NO_SUPPLY, 'a washing machine is not a water supply')
  const filt = run(['SOL-131', 'SOL-092']).families.water
  has(filt.reasons, REASON.NO_SUPPLY, 'a filter with nothing upstream is not a supply')
})

// --- units may never be mixed inside a family -------------------------------
// Second incident of this class. The first put m2 per person-equivalent into a pool
// of litres (patched with a flag on the basis); the second put kWh of heat there via
// a water-heater efficiency ratio, and the engine reported a confident RED from
// dividing kWh by litres. Two incidents is a class, so this is structural now.
check('a conversion between differently-measured families is refused', () => {
  // REBUILT 2026-09-03, not deleted. It used to run the real water-heater chain,
  // whose efficiency was stated on Heated Water and so aimed kWh at a pool of
  // litres. Domestic hot water heat then got its own io and its own family, the
  // conversion became legitimate, and the test stopped being a contest -- the same
  // expiry that hit the converts-from test. Moved onto a fixture where the mismatch
  // is arranged on purpose and no sourcing decision can dissolve it.
  const f = JSON.parse(JSON.stringify(FIXTURE))
  f.coefficients.push(
    { solution_id: 'X-ALCHEMY', io_type_id: 'IO-09', role: 'out', kind: 'RATIO',
      low: 1, high: 1, unit: 'L out / kWh in', basis: 'dimensionless ratio',
      converts_from: 'IO-18',
      condition: 'fixture', source: 'fixture', tier: 'A', precision: 'P1' })
  f.io_index.push({ sol: 'X-ALCHEMY', io: 'IO-18', role: 'consumes' },
                  { sol: 'X-ALCHEMY', io: 'IO-09', role: 'produces' })
  const w = assess({ solutionIds: ['X-PV', 'X-ALCHEMY'] },
                   { ...BASE, arrayKwp: 1 }, f).families.water
  has(w.reasons, REASON.UNIT_MISMATCH, 'reasons')
  if (w.supply.annual && w.supply.annual[1] > 0) {
    throw new Error('kWh leaked into the litres pool: ' + w.supply.annual)
  }
})

// --- decisions 1b / 2a / 3b / 4a, Eric 2026-09-03 ---------------------------
check('cooling does not count as heat supply', () => {
  // Cooling and heat are both kWh/day, so the unit guard was satisfied and an air
  // conditioner's output was summed as HEAT: it could satisfy a space-heating
  // demand. A shared unit is not evidence of a shared pool.
  if (FAMILIES.heat.includes('IO-24')) throw new Error('cooling is back inside the heat family')
  if (!FAMILIES.cooling.includes('IO-24')) throw new Error('cooling family does not hold IO-24')
})

check('a family fed from the mains is SUPPLIED, not computed', () => {
  const w = runWired(['SOL-195', 'SOL-092', 'SOL-216']).families.water
  eq(w.verdict, VERDICT.SUPPLIED, 'verdict')
  eq(w.band, null, 'band')
  has(w.reasons, REASON.MAINS_SUPPLIED, 'reasons')
  // The noise that goes with it: telling a reader on mains water that nothing
  // produces their water is answering a question they did not ask.
  hasNot(w.reasons, REASON.NO_SUPPLY, 'reasons')
  // And the connection itself must not be counted as a row missing a figure: it is
  // MEANT to carry none, and a partial-coverage warning beside a supplied verdict
  // would be a warning about the one node whose whole point is not being counted.
  hasNot(w.reasons, REASON.NO_FIGURE, 'reasons')
  // Nor any of the other reasons that are about a balance. No total is presented,
  // so "this total is built from part of the picture" is noise beside it.
  for (const r of [REASON.PARTIAL_COVERAGE, REASON.BASES_UNIONED,
                   REASON.BEHAVIOUR_WIDENS, REASON.NO_DEMAND]) {
    hasNot(w.reasons, r, 'balance reasons on a supplied family')
  }
})

// C11 (2026-11-13): the mains reaches a family only through a RATIO converting from it. The
// reversible heat pump had none, so a mains-fed one never read supplied, on its cooling or anywhere.
check('a mains-fed reversible heat pump supplies its cooling', () => {
  const cool = runWired(['SOL-079', 'SOL-160']).families.cooling
  if (!cool) throw new Error('no cooling family on a mains-fed reversible heat pump')
  eq(cool.verdict, VERDICT.SUPPLIED, 'cooling verdict')
})

check('turning the mains off makes the rest stand on its own', () => {
  const on = runWired(['SOL-195', 'SOL-092', 'SOL-216']).families.water
  const off = runWired(['SOL-195', 'SOL-092', 'SOL-216'], { mainsOff: true }).families.water
  eq(on.verdict, VERDICT.SUPPLIED, 'mains on')
  if (off.verdict === VERDICT.SUPPLIED) throw new Error('mains off still reported as supplied')
  has(off.reasons, REASON.MAINS_OFF, 'reasons')
})

check('the off-mains message fires only where a connection was actually drawn', () => {
  // Tested in both directions, because the first version of this derived the
  // supplied families only inside the "mains on" branch, so with the toggle on it
  // knew of none and would have said nothing at all.
  const r = runWired(['SOL-053', 'SOL-092'], { mainsOff: true }).families.water
  hasNot(r.reasons, REASON.MAINS_OFF, 'a rainwater-only graph lost nothing')
})

check('a mains connection nobody wired up supplies nothing', () => {
  // Eric, 2026-09-04: dropping a grid connection on the canvas and leaving it
  // unconnected switched off every electrical verdict. The engine reads edges for
  // ONE other question only, and this is the deliberate second: SUPPLIED is an
  // optimistic claim, so unlike a red it has to be earned by a drawn connection.
  const loose = run(['SOL-195', 'SOL-092', 'SOL-216']).families.water
  if (loose.verdict === VERDICT.SUPPLIED) throw new Error('an unconnected mains node supplied a family')
  hasNot(loose.reasons, REASON.MAINS_SUPPLIED, 'reasons')
  // The same graph WITH the connection drawn is supplied, so the difference is the
  // wiring and nothing else.
  eq(runWired(['SOL-195', 'SOL-092', 'SOL-216']).families.water.verdict, VERDICT.SUPPLIED, 'wired')
  // And the switch that turns the mains off is not offered for a node that is not
  // supplying anything: an input that cannot move the answer must not be shown.
  eq(assess({ solutionIds: ['SOL-195', 'SOL-092'] }, BASE, data).hasMains, false, 'toggle hidden')
})

check("the household's own need is added, and only where something provides it", () => {
  // A solar water heater alone: nothing on the canvas CONSUMES hot water, and before
  // this the family reported no-demand and could never answer.
  const withHeater = run(['SOL-059']).families.hotwater
  if (!withHeater) throw new Error('no hotwater family at all')
  has(withHeater.reasons, REASON.HOUSEHOLD_DEMAND, 'reasons')
  hasNot(withHeater.reasons, REASON.NO_DEMAND, 'reasons')
  // 2 people x 1.53-1.78 kWh/person/day.
  near(withHeater.demand.annual[0], 3.06, 'demand low')
  near(withHeater.demand.annual[1], 3.56, 'demand high')
  // And a graph with nothing touching hot water must not acquire the demand. Note
  // this is gated TWICE in the engine (the family is not created, and the demand is
  // not folded), so breaking either branch alone leaves this green. Verified red by
  // breaking both, 2026-09-03 -- and two existing invariants catch it as well.
  const without = run(['SOL-053', 'SOL-092']).families.hotwater
  if (without) throw new Error('hot-water demand appeared on a graph with no hot water in it')
})

// --- the space-heating demand (decision 1b, 2026-09-05) ---------------------
// Every one of these was written after a stress-testing round that found three real
// defects: Caen mapped to the wrong climate zone, a national fallback that was
// optimistic for cold zones, and a heat graph carrying no coefficient getting no family
// at all so the demand was computed into nothing. The tests exist to hold those closed.

// --- where the reader lives (2026-09-05) ------------------------------------

// --- summer exposure, and the cooling demand that was refused (2026-09-05) ---

check('every string the panel reaches for exists in both languages', () => {
  // ADDED AFTER IT BIT, 2026-09-05. Rewriting the exposure strings wholesale deleted the
  // day-word beside them, and the panel rendered "45 undefined a year" -- in the block
  // whose entire purpose is telling a reader about their own climate. Nothing caught it:
  // a missing string is not a crash, it is a word that quietly becomes "undefined".
  //
  // Parsed out of the panel rather than listed here, so a new string is covered the day
  // it is used. The dynamic lookups are excluded by name: those are objects indexed at
  // runtime (t.reasons[code], t.families[fam]) and are checked by their own tests.
  const src = readFileSync(resolve(HERE, '../src/adequacy/AdequacyPanel.jsx'), 'utf8')
  const DYNAMIC = new Set(['reasons', 'families', 'inputs', 'precisionLabels'])
  const keys = new Set()
  for (const m of src.matchAll(/\bt\.([A-Za-z][A-Za-z0-9_]*)/g)) {
    if (!DYNAMIC.has(m[1])) keys.add(m[1])
  }
  if (keys.size < 20) throw new Error(`only ${keys.size} strings found; the parse has gone stale`)
  const missing = []
  for (const k of [...keys].sort()) {
    if (uiEn.adequacy[k] === undefined) missing.push(`EN adequacy.${k}`)
    if (uiFr.adequacy[k] === undefined) missing.push(`FR adequacy.${k}`)
  }
  if (missing.length) throw new Error(missing.join(', '))

  // And the same for the field labels, which are a nested object the panel indexes by a
  // literal in a few places -- those literals are worth checking too.
  const inputKeys = new Set()
  for (const m of src.matchAll(/\bt\.inputs\.([A-Za-z][A-Za-z0-9_]*)/g)) inputKeys.add(m[1])
  for (const k of [...inputKeys].sort()) {
    if (uiEn.adequacy.inputs[k] === undefined) missing.push(`EN adequacy.inputs.${k}`)
    if (uiFr.adequacy.inputs[k] === undefined) missing.push(`FR adequacy.inputs.${k}`)
  }
  if (missing.length) throw new Error(missing.join(', '))
})

check('heat exposure is offered where summer is the question, and nowhere else', () => {
  // It is the CLIMATE, not the building, so it needs no figures at all -- but it is
  // still gated, because a reader building a water system did not ask about the weather.
  const shading = run(['SOL-026'], { department: '13' })
  if (!shading.heatExposure) throw new Error('no exposure on a graph holding shading')
  eq(shading.heatExposure.station, 'Marseille', 'station for Bouches-du-Rhone')
  // A cooling machine counts as asking too, even with no shading placed.
  const cooler = run(['SOL-205'], { department: '13' })
  if (!cooler.heatExposure) throw new Error('no exposure on a graph holding a cooler')
  // And it must NOT appear on graphs about something else.
  for (const g of [['SOL-030'], ['SOL-053', 'SOL-092']]) {
    if (run(g, { department: '13' }).heatExposure) {
      throw new Error(`exposure offered on ${g.join('+')}, which is not about summer`)
    }
  }
})

check('exposure reports recent years, and the south is hotter than the north', () => {
  const south = run(['SOL-026'], { department: '13' }).heatExposure
  const north = run(['SOL-026'], { department: '14' }).heatExposure
  const days = (e) => e.recent.hot_days['26']
  if (!(days(south) > days(north) + 5)) {
    throw new Error(`Marseille (${days(south)}) should see many more hot days than Caen (${days(north)})`)
  }
  // NO HISTORICAL BASELINE, deliberately (Eric, 2026-09-05). A 1990s average invited the
  // reader to average away the thing they are worried about, so the block quotes the last
  // two complete years and states the direction in words instead.
  if (south.baseline) throw new Error('a historical baseline is being carried again')
  const yrs = (south.recent.period || '').split('-').map(Number)
  if (!(yrs.length === 2 && yrs[1] - yrs[0] === 1)) {
    throw new Error(`exposure should quote a two-year window, got "${south.recent.period}"`)
  }
  // It is exposure, never a verdict: nothing here may become a family or a band.
  if (Object.prototype.hasOwnProperty.call(run(['SOL-026'], { department: '13' }).families, 'cooling')) {
    const c = run(['SOL-026'], { department: '13' }).families.cooling
    if (c && c.demand && c.demand.annual) throw new Error('a cooling DEMAND appeared; it was refused')
  }
})

check('night-sky radiative cooling can be placed and connected', () => {
  // It sat in FN-02 with no io at all until 2026-09-05: invisible to the graph, and
  // reading as a fabric measure when it is a machine. Same three ios as the ground-
  // coupled loop, which is the same machine against a different cold sink.
  const ios = (data.io_index || []).filter((e) => (e.sol || e.solution_id) === 'SOL-205')
  const produces = ios.filter((e) => e.role === 'produces').map((e) => e.io)
  const consumes = ios.filter((e) => e.role === 'consumes').map((e) => e.io)
  if (!produces.includes('IO-24')) throw new Error('night-sky cooling produces no cooling')
  if (!consumes.includes('IO-35')) throw new Error('it must take the heat it removes from somewhere')
  // It carries no figure, on purpose: published numbers are laboratory watts under clear
  // desert skies. So it must show up as placed-but-unquantified rather than silently.
  const r = run(['SOL-205'], { department: '13' })
  const named = r.withoutFigures.concat(
    Object.values(r.families).flatMap((f) => (f.uncounted || []).map((u) => u.solutionId)))
  if (!named.includes('SOL-205')) throw new Error('a cooler with no figure vanished from the report')
})

check('the heating season is shaped by real degree-days where we have them', () => {
  // build_climate_zones.py used to refuse degree-days outright, because computing them
  // from monthly means understates them one-directionally. Daily temperatures removed
  // the objection rather than working around it (2026-09-05).
  const zones = (data.climate && data.climate.zones) || {}
  for (const [key, z] of Object.entries(zones)) {
    const dd = z.degree_days
    if (!dd) throw new Error(`${key} carries no degree-days`)
    // The SHAPE comes from the ten-year window: a monthly distribution the engine
    // divides into wants a long sample, while the exposure headline wants a short one.
    const share = dd.shape && dd.shape.monthly_hdd_share
    if (!Array.isArray(share) || share.length !== 12) {
      throw new Error(`${key} has no monthly heating shape`)
    }
    if (!dd.recent || !dd.recent.hot_days) throw new Error(`${key} has no recent hot-day counts`)
    const total = share.reduce((a, b) => a + b, 0)
    if (Math.abs(total - 1) > 0.01) throw new Error(`${key} shares sum to ${total}, not 1`)
    // Heating happens in winter. If January ever stops outranking July, the months have
    // been transposed somewhere.
    if (!(share[0] > share[6])) throw new Error(`${key}: January should need more heat than July`)
    // A plausible French heating season. Loose on purpose: this guards against a window
    // arriving empty or in the wrong units, not against the climate moving.
    if (!(dd.shape.hdd18 > 800 && dd.shape.hdd18 < 5000)) {
      throw new Error(`${key}: ${dd.shape.hdd18} heating degree-days is not a French year`)
    }
  }
})

check('an absolute solar yield follows the reader south', () => {
  // Eric asked whether location affected the sun at all. It barely did (2026-09-05): a
  // rainwater coefficient is a CONVERSION FACTOR so the local climate flows through it,
  // but the PV figure is one place's answer -- 1047.7-1225.6 kWh/kWp/yr measured at Caen
  // -- and the climate touched only the worst-MONTH share. Every reader in France was
  // shown a Caen array's annual output, about 38 pc low in the Mediterranean.
  const pv = (department) => run(['SOL-076'], { department }).families.electricity.supply.annual
  const caen = pv('14')
  const marseille = pv('13')
  if (!(marseille[0] > caen[0] * 1.25)) {
    throw new Error(`Marseille PV (${marseille[0].toFixed(2)}) should beat Caen `
      + `(${caen[0].toFixed(2)}) by a third; the sited-yield scaling is not applied`)
  }
  // The band's WIDTH is year-to-year variation and must not shrink because the reader
  // moved south: the ratio is applied, not a replacement.
  const spread = (b) => b[1] / b[0]
  near(spread(marseille), spread(caen), 'relative band width')

  // ONLY ROWS THAT DECLARE A REFERENCE ARE SCALED. The solar water heater's
  // 350-600 kWh/m2/yr is stated for FRANCE; scaling a national range by a local ratio
  // would narrow it around the wrong centre while looking more precise.
  const shw = (department) => run(['SOL-059'], { department }).families.hotwater.supply.annual
  near(shw('13')[0], shw('14')[0], 'national solar-thermal figure must not move')

  // And a coefficient carrying a reference zone must name one the climate table holds,
  // or the scaling silently becomes 1 and nobody finds out.
  const zones = (data.climate && data.climate.zones) || {}
  for (const c of data.coefficients || []) {
    if (c.reference_zone && !zones[c.reference_zone]) {
      throw new Error(`${c.solution_id} references zone ${c.reference_zone}, which has no climate`)
    }
  }
})

check('a department sets both the climate point and the fabric zone', () => {
  const at = (department) => run(['SOL-030'],
    { fabricClass: 'E', floorArea: 100, department, fuelStock: { 'IO-04': 3650 } })
  const paris = at('75')
  eq(paris.climateUsed.zone, 'H1a', 'Paris climate zone')
  eq(paris.fabricUsed.zoneUsed, 'H1a', 'Paris fabric zone')
  const marseille = at('13')
  eq(marseille.climateUsed.zone, 'H3', 'Bouches-du-Rhone climate zone')
  // The south needs less heat than the Paris basin. If this ever inverts, either the
  // department map or the fabric table has been wired to the wrong key.
  const north = at('75').families.heat.demand.annual[0]
  const south = at('13').families.heat.demand.annual[0]
  if (!(south < north)) throw new Error(`Marseille (${south}) should need less heat than Paris (${north})`)
})

check('a department gets its own place, and the fabric figures stay with its zone', () => {
  // Calvados is in H1a, whose reference point is Trappes. Its climate is now read at Caen, its
  // most populous commune, which is a better climate for a Calvados reader than the Paris
  // basin. The FABRIC figures still come from H1a, because those are published per zone
  // and there is no Caen-specific version of them.
  const caen = run(['SOL-030'], { fabricClass: 'E', floorArea: 100, department: '14' })
  eq(caen.climateUsed.station, 'Caen', 'station for Calvados')
  eq(caen.fabricUsed.zoneUsed, 'H1a', 'fabric zone for Calvados')
  // and it must not leak to the rest of H1a
  const paris = run(['SOL-030'], { fabricClass: 'E', floorArea: 100, department: '75' })
  eq(paris.climateUsed.station, 'Paris', 'station for Paris')
})

// A region outside France (TODO C9), built from Caen's own numbers so the checks below do not
// depend on the fetched files: only what each check changes differs.
const caenZone = data.climate.zones['SITE-CAEN']
const abroad = (over = {}) => ({
  id: 'XX01', name: 'Testland', station: 'Testville',
  pv: { annual_kwh_per_kwp: caenZone.pv.annual_kwh_per_kwp * 1.5, monthly_kwh_per_kwp: caenZone.pv.monthly_kwh_per_kwp.map((m) => m * 1.5) },
  rain: { annual_mm: 1200, monthly_mm: Array(12).fill(100) },
  temperature: caenZone.temperature,
  degree_days: caenZone.degree_days,
  ...over,
})
const runAbroad = (ids, region, over = {}) => assess({ solutionIds: ids },
  { ...BASE, country: 'XX', region: region.id, ...over }, { ...data, region })

check('outside France, the region answers for the climate and a French department is ignored', () => {
  const r = runAbroad(['SOL-053'], abroad(), { department: '75' })
  eq(r.climateUsed.station, 'Testville', 'station')
  eq(r.departmentUsed, null, 'department left behind in France')
  eq(r.climateFigures.find((f) => f.kind === 'rainfall').value, 1200, 'the region\'s rain')
  // Back in France, the same scenario reads the department again.
  eq(runAbroad(['SOL-053'], abroad(), { department: '75', country: 'FR' }).climateUsed.station, 'Paris', 'France again')
})

check('outside France, heating scales with the winters, from the French houses with that label', () => {
  const base = runAbroad(['SOL-030'], abroad(), { fabricClass: 'E', floorArea: 100 })
  const dd = caenZone.degree_days
  const cold = runAbroad(['SOL-030'], abroad({ degree_days: { ...dd, shape: { ...dd.shape, hdd18: dd.shape.hdd18 * 2 } } }),
    { fabricClass: 'E', floorArea: 100 })
  if (!base.fabricUsed || !base.fabricUsed.scaledBy) throw new Error('no scaled fabric row')
  eq(base.fabricUsed.precision, 'P3', 'an estimate drops a step')
  near(cold.fabricUsed.low / base.fabricUsed.low, 2, 'twice the degree-days, twice the need', 0.001)
  // Near the French figure at Caen's own winters: within the spread of the eight zones.
  const h1a = data.fabric_classes.find((f) => f.cls === 'E' && f.zone === 'H1a')
  const ratio = base.fabricUsed.low / h1a.low
  if (ratio < 0.7 || ratio > 1.3) throw new Error(`Caen-like winters gave ${base.fabricUsed.low}, H1a has ${h1a.low}`)
})

check('outside France, no solar figure where PVGIS has none, rather than a French one', () => {
  const pv = runAbroad(['SOL-076'], abroad(), { arrayKwp: 3 })
  if (!pv.families.electricity || !pv.families.electricity.supply.annual) throw new Error('no supply where a figure exists')
  const none = runAbroad(['SOL-076'], abroad({ pv: null }), { arrayKwp: 3 })
  const fam = none.families.electricity
  if (fam && fam.supply.annual && fam.supply.annual[1] > 0) throw new Error(`borrowed a yield: ${fam.supply.annual}`)
  eq(none.regionUsed.hasPv, false, 'the panel is told')
})

check('outside France, the worst-month rain caveat says one source, not two that disagree', () => {
  const w = runAbroad(['SOL-053', 'SOL-094'], abroad()).families.water
  has(w.reasons, REASON.MONTHLY_ONE_SOURCE, 'reasons')
  hasNot(w.reasons, REASON.MONTHLY_IS_P2, 'the French two-source caveat')
})

check('a way to use less is offered only where a sourced figure backs it', () => {
  // Another option for the same need, same resource, unit and basis, at least a fifth lower.
  const row = (id, io, unit, basis) => {
    const coef = data.coefficients.find((c) => c.solution_id === id && c.role === 'in' && (!io || c.io_type_id === io) && (!unit || c.unit === unit) && (!basis || c.basis === basis))
    if (!coef) throw new Error('no row for ' + id)
    return { solutionId: id, coef }
  }
  const std = row('SOL-216')              // a standard flush toilet
  const less = lessUsing({ rows: [std] }, data)
  if (!less || less.solutionId !== 'SOL-216') throw new Error('nothing offered for a standard flush')
  const sub = (id) => data.solutions.find((s) => s.id === id).subfunction_id
  if (sub(less.betterId) !== sub('SOL-216')) throw new Error('offered an option for another need')
  const better = data.coefficients.find((c) => c.solution_id === less.betterId && c.role === 'in' && c.io_type_id === std.coef.io_type_id && c.unit === std.coef.unit && c.basis === std.coef.basis)
  if (!better || (better.low + better.high) / 2 > 0.8 * (std.coef.low + std.coef.high) / 2) throw new Error('not a fifth lower')
  // The lowest-using option has nothing to point at, and a supply row never does.
  if (lessUsing({ rows: [{ solutionId: less.betterId, coef: better }] }, data)?.betterId === 'SOL-216') throw new Error('pointed at the higher one')
  const supply = data.coefficients.find((c) => c.role === 'out')
  if (lessUsing({ rows: [{ solutionId: supply.solution_id, coef: supply }] }, data)) throw new Error('offered on a supply row')
})

check('solar follows the department, not only its zone, and the sources show the figure used', () => {
  // Eric, 2026-10-30. Two departments of one zone must get their own sun, in the verdict's figures
  // and in the sources list, and a department with no yield of its own falls back to the zone.
  const list = data.departments.departments
  const a = list.find((d) => d.code === '67'), b = list.find((d) => d.code === '08')
  if (a.zone !== b.zone) throw new Error('the test needs two departments of one zone')
  const pvIn = (code, d = data) => assess({ solutionIds: ['SOL-076'] }, { ...BASE, department: code, arrayKwp: 3 }, d)
  const row = (r) => Object.values(r.families).flatMap((f) => f.rows || []).find((x) => x.solutionId === 'SOL-076')
  const ra = row(pvIn('67')), rb = row(pvIn('08'))
  const want = a.pv.annual_kwh_per_kwp / b.pv.annual_kwh_per_kwp
  if (Math.abs(ra.sited / rb.sited - want) > 1e-6) throw new Error(`ratio ${ra.sited / rb.sited}, expected ${want}`)
  const caen = data.climate.zones['SITE-CAEN'].pv.annual_kwh_per_kwp
  if (Math.abs(ra.sited - a.pv.annual_kwh_per_kwp / caen) > 1e-6) throw new Error('not scaled from the Caen reference')
  // A zone point with no station still names its own place, never the default's.
  const gap = pvIn('05')
  if (gap.climateUsed.station !== 'Gap') throw new Error(`named ${gap.climateUsed.station}`)
  // No yield of its own: the zone's figure, as before.
  const bare = { ...data, departments: { ...data.departments, departments: list.map((d) => (d.code === '67' ? { ...d, pv: undefined } : d)) } }
  const zoneYield = data.climate.zones[a.zone].pv.annual_kwh_per_kwp
  if (Math.abs(row(pvIn('67', bare)).sited - zoneYield / caen) > 1e-6) throw new Error('no fallback to the zone')
})

check('a stream is never assumed: no flow, no verdict, and the move asks for it', () => {
  // Eric, 2026-10-30, after a ram pump read 225 times the need on a stream nobody had mentioned.
  const g = { nodes: [{ id: 'a', sol: 'SOL-177' }, { id: 'b', sol: 'SOL-216' }], edges: [{ from: 'a', to: 'b' }], linkedOnly: true }
  const scen = { ...DEFAULT_SCENARIO }
  const r = assess(g, scen, data)
  eq(r.families.water.verdict, 'grey', 'with no stream given')
  eq(moveFor('water', r.families.water, r, scen).kind, 'stream', 'the move')
  const given = assess(g, { ...scen, flow: 0.002 }, data)
  if (given.families.water.verdict === 'grey') throw new Error('a given flow should give a verdict')
})

check('an input nothing gives is said, figure or no figure', () => {
  // An electric motor has no coefficient, so it used to get no word at all.
  const g = { nodes: [{ id: 'a', sol: 'SOL-221' }, { id: 'b', sol: 'SOL-053' }], edges: [{ from: 'a', to: 'b', ios: ['IO-21'] }], linkedOnly: true }
  const r = assess(g, BASE, data)
  if (!r.unfed.some((u) => u.solutionId === 'SOL-221' && u.family === 'electricity')) throw new Error('the motor\'s power went unmentioned')
  // Linked, it goes; so does an input with an alternative already linked.
  const fed = assess({ ...g, nodes: [...g.nodes, { id: 'c', sol: 'SOL-080' }], edges: [...g.edges, { from: 'c', to: 'a', ios: data.solutions.find((x) => x.id === 'SOL-221').inputs.map((i) => i.io) }] }, BASE, data)
  if (fed.unfed.some((u) => u.solutionId === 'SOL-221')) throw new Error('still listed once fed')
  // Natural resources are always there.
  const pv = assess({ nodes: [{ id: 'a', sol: 'SOL-076' }], edges: [], linkedOnly: true }, BASE, data)
  if (pv.unfed.length) throw new Error('solar panels asked for sunshine')
})

check('a supply offer can supply: no pass-through, sources first, low-tech before mains', () => {
  const ids = (io) => rankSupply(data.solutions, io, data, 99)
  for (const io of ['IO-03', 'IO-18', 'IO-09', 'IO-16']) {
    const list = ids(io)
    if (list.some((x) => x.inputs.some((i) => i.io === io))) throw new Error(`${io}: offers a card that needs it`)
    const firstBench = list.findIndex((x) => x.benchmark)
    if (firstBench >= 0 && list.slice(firstBench).some((x) => !x.benchmark)) throw new Error(`${io}: high-tech ranked above low-tech`)
  }
  if (!rankSupply(data.solutions, 'IO-18', data).some((x) => x.id === 'SOL-076')) throw new Error('solar panels not offered for DC')
})

check('a converter with nothing feeding it, and a source with no use, each get a move', () => {
  const g = { nodes: [{ id: 'a', sol: 'SOL-082' }, { id: 'b', sol: 'SOL-221' }], edges: [{ from: 'a', to: 'b', ios: ['IO-03'] }], linkedOnly: true }
  const r = assess(g, BASE, data)
  eq(moveFor('electricity', r.families.electricity, r, BASE)?.kind, 'supply', 'an inverter with no DC')
  const pv = assess({ nodes: [{ id: 'a', sol: 'SOL-076' }], edges: [], linkedOnly: true }, { ...BASE, arrayKwp: 3 }, data)
  eq(moveFor('electricity', pv.families.electricity, pv, BASE)?.kind, 'use', 'solar panels alone')
})

check('rain and temperature follow the department, the fabric stays with the zone', () => {
  const list = data.departments.departments
  if (list.some((d) => !d.climate)) throw new Error('a department has no climate of its own')
  const a = list.find((d) => d.code === '74')
  const run = (d = data) => assess({ solutionIds: ['SOL-076'] }, { ...BASE, department: '74' }, d)
  if (run().climateUsed.station !== a.pv.station) throw new Error(`named ${run().climateUsed.station}`)
  // No climate of its own: the zone's point again, under the zone's own name.
  const bare = { ...data, departments: { ...data.departments, departments: list.map((d) => (d.code === '74' ? { ...d, climate: undefined } : d)) } }
  const zone = data.climate.zones[a.zone]
  if (run(bare).climateUsed.station !== (zone.station || 'Mâcon')) throw new Error(`fell back to ${run(bare).climateUsed.station}`)
})

check('every French department resolves to climate AND fabric figures', () => {
  // The coverage check. A department that resolved to a zone with no climate row would
  // silently fall back to the default site, and one with no fabric row would produce no
  // heating demand at all -- both of which look like "nothing to say" rather than like a
  // gap. 96 departments, and all of them must land somewhere real.
  const list = (data.departments && data.departments.departments) || []
  if (list.length !== 96) throw new Error(`expected 96 departments, got ${list.length}`)
  const zones = (data.climate && data.climate.zones) || {}
  const fabric = data.fabric_classes || []
  const bad = []
  for (const d of list) {
    if (!zones[d.zone]) bad.push(`${d.code} ${d.name}: no climate for ${d.zone}`)
    if (!fabric.some((f) => f.zone === d.zone && f.cls === 'E')) {
      bad.push(`${d.code} ${d.name}: no fabric row for ${d.zone}`)
    }
  }
  if (bad.length) throw new Error(bad.slice(0, 4).join('; '))
})

check('each climate reference point sits inside the zone it speaks for', () => {
  // FOUND BY CROSS-CHECKING, 2026-09-05: H1a and H1b had their reference points
  // TRANSPOSED. H1a was pointed at Nancy and H1b at Trappes, when ADEME's own
  // diagnostics place Nancy in H1b and Trappes in H1a -- so every H1a figure, including
  // the monthly temperatures that shape the heating season, came from a continental site
  // standing in for a northern maritime zone.
  // Two independent representations of one fact, built by different scripts from
  // different sources, each plausible alone, and nothing had ever compared them.
  // WHERE EACH HALF OF THIS CHECK LIVES, because only one half can be done offline.
  // Confirming a point sits in its zone needs geocoding, so that check runs in
  // build_departments.py against the live geo API. What CAN be checked here is the
  // consistency of the shipped data and one physical invariant: the H1 group is the cold
  // one, H3 the warm one, and no amount of mislabelling should survive that.
  const list = (data.departments && data.departments.departments) || []
  const zoneOfDept = Object.fromEntries(list.map((d) => [d.code, d.zone]))
  const zones = (data.climate && data.climate.zones) || {}
  // Every department a site point claims must actually be in the zone that site is used
  // for, and every zone key must be a zone some department is in.
  for (const [key, z] of Object.entries(zones)) {
    for (const code of z.departments || []) {
      if (!zoneOfDept[code]) throw new Error(`${key} claims department ${code}, which is not in the map`)
    }
    if (key.startsWith('SITE')) continue
    if (!list.some((d) => d.zone === key)) {
      throw new Error(`climate zone ${key} matches no department: it speaks for nobody`)
    }
  }
  // The physical ordering. January means, coldest group first.
  const jan = (k) => zones[k] && zones[k].temperature && zones[k].temperature.monthly_mean_c[0]
  const h1 = ['H1a', 'H1b', 'H1c'].map(jan).filter((v) => v != null)
  const h3 = jan('H3')
  if (h1.length && h3 != null && !(Math.max(...h1) < h3)) {
    throw new Error(`the H1 zones should all be colder in January than H3: `
      + `H1 max ${Math.max(...h1)}, H3 ${h3}`)
  }
  const h2c = jan('H2c')
  if (h2c != null && h3 != null && !(h2c < h3)) {
    throw new Error(`H2c should be colder in January than H3: ${h2c} vs ${h3}`)
  }
})

check('the heating demand is family-scoped, not per io', () => {
  // THE WHOLE POINT of Eric's choice over merging the three heat ios. All three heat the
  // house, so a per-io demand would charge a stove-and-heat-pump graph twice, and would
  // show a passive-solar house no heating need at all.
  const opts = { fabricClass: 'E', floorArea: 100 }
  const stove = run(['SOL-030'], opts).families.heat
  const pump = run(['SOL-031'], opts).families.heat
  const both = run(['SOL-030', 'SOL-031'], opts).families.heat
  if (!stove || !pump || !both) throw new Error('a heat family is missing')
  // The heat pump touches IO-36 and the anchor is IO-35: without family scope it would
  // have no demand at all.
  near(pump.demand.annual[0], stove.demand.annual[0], 'heat pump demand low')
  // And two producers must not add up to two households.
  near(both.demand.annual[0], stove.demand.annual[0], 'demand low with both')
  near(both.demand.annual[1], stove.demand.annual[1], 'demand high with both')
})

check('the heating demand scales with floor area and with the label', () => {
  const at = (o) => run(['SOL-030'], { fabricClass: 'E', floorArea: 100, ...o }).families.heat
  const base = at({})
  const twice = at({ floorArea: 200 })
  near(twice.demand.annual[0], base.demand.annual[0] * 2, 'demand at double the area')
  // A is a well-insulated house and G is an unrenovated one; the gap is the reason a
  // default label was refused, since guessing it would guess a factor of six.
  const a = at({ fabricClass: 'A' }).demand.annual[1]
  const g = at({ fabricClass: 'G' }).demand.annual[1]
  if (!(g > a * 3)) throw new Error(`label G (${g}) should dwarf label A (${a})`)
})

check('no energy label means no heating demand, and no invented one', () => {
  // The label is the one scenario field with no default. A default would assert
  // something about the reader's building that moves the answer by a factor of six.
  const none = run(['SOL-030'], { floorArea: 100 }).families.heat
  if (none && none.demand.annual) throw new Error('a heating demand appeared with no label set')
  // Nor may a bad one be guessed into something usable.
  for (const bad of ['Z', '', null, 0, 'nonsense']) {
    const r = run(['SOL-030'], { fabricClass: bad, floorArea: 100 }).families.heat
    if (r && r.demand.annual) throw new Error(`label ${JSON.stringify(bad)} produced a demand`)
  }
  // Nor by a floor area that is not an area.
  for (const bad of [0, -50, NaN]) {
    const r = run(['SOL-030'], { fabricClass: 'E', floorArea: bad }).families.heat
    if (r && r.demand.annual) throw new Error(`floor area ${bad} produced a demand`)
  }
})

check('heating is seasonal: the worst month asks more than the average day', () => {
  // Demands used to be flat across periods, which is fine for water and wrong for heat.
  // A flat heating demand understates January, and the worst-month half of the verdict
  // rule exists for exactly that.
  // Fuel is entered so the family actually resolves: with no supply both periods are
  // grey, they tie, and `binding` falls to annual for want of anything to compare.
  const h = run(['SOL-030'],
    { fabricClass: 'E', floorArea: 100, fuelStock: { 'IO-04': 3650 } }).families.heat
  const ratio = h.demand.month[0] / h.demand.annual[0]
  if (!(ratio > 1.4 && ratio < 2.6)) {
    throw new Error(`worst-month demand is ${ratio.toFixed(2)}x the annual daily rate, `
      + 'which is outside anything a French heating season plausibly produces')
  }
  // And the verdict must be the WORSE of the two, which for heating is the month.
  eq(h.binding, 'worst-month', 'binding period')
})

check('Caen is in climate zone H1a, and an unknown zone invents nothing', () => {
  // FOUND BY STRESS-TESTING, 2026-09-05. The zone map said H2a, which is Brittany and
  // the Manche; Calvados is H1a. Checked against the source data, where 1988 of 2000
  // records for the commune of Caen carry H1a. The error understated the reference
  // site's heating need by about 15 pc -- the optimistic direction.
  const caen = run(['SOL-030'], { fabricClass: 'E', floorArea: 100, zone: 'SITE-CAEN' })
  eq(caen.fabricUsed && caen.fabricUsed.zoneUsed, 'H1a', 'zone used for Caen')
  const brittany = run(['SOL-030'], { fabricClass: 'E', floorArea: 100, zone: 'H2a' })
  eq(brittany.fabricUsed && brittany.fabricUsed.zoneUsed, 'H2a', 'zone used for H2a')
  // H1a is colder than H2a and must ask for more.
  if (!(caen.families.heat.demand.annual[0] > brittany.families.heat.demand.annual[0])) {
    throw new Error('H1a should need more heat than H2a')
  }
  // NO NATIONAL FALLBACK. It used to exist and was not neutral: national is colder than
  // H3 and warmer than H1c, so falling back UNDERSTATED a mountain house. A zone we have
  // no figure for must produce no figure.
  const nowhere = run(['SOL-030'], { fabricClass: 'E', floorArea: 100, zone: 'NOWHERE' })
  if (nowhere.families.heat && nowhere.families.heat.demand.annual) {
    throw new Error('an unknown climate zone fell back to a figure instead of saying nothing')
  }
})

check('a heat graph with no figures still gets its demand', () => {
  // FOUND BY STRESS-TESTING, 2026-09-05. Exposed thermal mass carries no coefficient, so
  // no family was created for it, so the heating demand was added to nothing and the
  // reader was told nothing at all. The silent-contribution failure arriving through the
  // one door the existing guard did not cover: a demand that lives in its own table
  // rather than on the io row.
  const h = run(['SOL-029'], { fabricClass: 'E', floorArea: 100 }).families.heat
  if (!h) throw new Error('no heat family for a graph holding only thermal mass')
  if (!h.demand.annual) throw new Error('the heating demand was computed into nothing')
  has(h.reasons, REASON.HOUSEHOLD_DEMAND, 'reasons')
  // Thermal mass is a STORE, not a source: it consumes the family it produces into, so
  // it is not a way in and NO_SUPPLY is the honest reading.
  has(h.reasons, REASON.NO_SUPPLY, 'reasons')
})

check('every householdDemands entry carries a figure the panel can read', () => {
  // FOUND BY STRESS-TESTING, 2026-09-05, and it was a WHITE SCREEN rather than a wrong
  // number. The space-heating demand is counted in householdCounted -- it has to be, or
  // its reason never fires -- but its figures live in the fabric-class table, not on the
  // io row, so the io's household_demand is null. The sources disclosure read `.low` off
  // it and took the whole panel down.
  // The engine's job is to never hand the panel a null; the panel guards it too.
  const r = run(['SOL-030'], { fabricClass: 'E', floorArea: 100, fuelStock: { 'IO-04': 3650 } })
  for (const [fam, f] of Object.entries(r.families)) {
    for (const h of f.householdDemands || []) {
      if (!h || !h.demand) throw new Error(`${fam}: a householdDemands entry with no figure`)
      if (!Number.isFinite(Number(h.demand.low))) {
        throw new Error(`${fam}/${h.io}: household demand has no readable low`)
      }
    }
  }
  // And the heating demand must still be disclosed SOMEWHERE, or filtering it out of
  // that list would have hidden the figure instead of crashing on it.
  if (!r.fabricUsed) throw new Error('the heating demand is counted but not disclosed')
  if (!Number.isFinite(Number(r.fabricUsed.low))) throw new Error('fabricUsed carries no figure')
  eq(r.fabricUsed.cls, 'E', 'disclosed label')
})

check('the label field is offered only where the graph holds heat', () => {
  const heat = run(['SOL-030'], {}).fabricInputs
  if (!heat.length) throw new Error('no fabric input offered on a heat graph')
  eq(heat[0].io, 'IO-35', 'anchor io')
  // A reader building a water system is never asked about their insulation.
  for (const g of [['SOL-053', 'SOL-092'], ['SOL-090']]) {
    const r = run(g, {}).fabricInputs
    if (r.length) throw new Error(`fabric input offered on ${g.join('+')}, which holds no heat`)
  }
})

check('the cooking demand attaches per dwelling, and only to a cooking graph', () => {
  // Decision 4a, 2026-09-05. Cooking was refused three times on sourcing before the
  // real cause was found: cooking heat shared IO-37 with space heating, so a demand
  // there would have been met by a wood stove sized for a room. IO-44 made it
  // answerable. This asserts the resulting demand behaves.
  const cook = run(['SOL-090']).families.cooking   // solar cooker, no fuel, no figure
  if (!cook) throw new Error('no cooking family at all')
  has(cook.reasons, REASON.HOUSEHOLD_DEMAND, 'reasons')
  // PER DWELLING, NOT PER PERSON: the band must NOT move with the occupant count.
  // This is the point of the row and the one thing most likely to be "fixed" later by
  // someone making it consistent with water and hot water, which ARE per-person.
  near(cook.demand.annual[0], 0.63, 'demand low')
  near(cook.demand.annual[1], 1.68, 'demand high')
  const six = run(['SOL-090'], { people: 6 }).families.cooking
  near(six.demand.annual[0], 0.63, 'demand low at 6 people')
  near(six.demand.annual[1], 1.68, 'demand high at 6 people')
  // GREY, not red. Nothing carries a summable pot-delivered figure, and "you need
  // this much and we cannot measure what you drew" is not the same claim as "what you
  // drew is not enough". A red here would be the module inventing a failure.
  eq(cook.verdict, VERDICT.GREY, 'verdict')
  // And a graph with no cooking in it must not acquire the demand.
  const without = run(['SOL-053', 'SOL-092']).families.cooking
  if (without) throw new Error('cooking demand appeared on a graph with no cooking in it')
})

check('a mains supply reaches through a converter', () => {
  // Unlimited gas at 55 pc efficiency is still unlimited hot water. Without the
  // propagation this reported the fuel family supplied and the hot water family GREY
  // with "a conversion step here has nothing feeding it" -- true of the pool, absurd
  // to a reader looking at a gas main.
  const h = runWired(['SOL-197', 'SOL-212']).families.hotwater
  if (!h) throw new Error('no hotwater family at all')
  eq(h.verdict, VERDICT.SUPPLIED, 'verdict')
  hasNot(h.reasons, REASON.RATIO_NO_INPUT, 'reasons')
  hasNot(h.reasons, REASON.HOUSEHOLD_DEMAND, 'reasons')
  // And it must be the CONNECTION doing it, not the appliance: the same heater with
  // no gas supply drawn is not supplied by anything.
  const alone = runWired(['SOL-212', 'SOL-059']).families.hotwater
  if (alone.verdict === VERDICT.SUPPLIED) throw new Error('a lone appliance reported as mains-fed')
})

check('a tank that empties is not a network that does not', () => {
  // Grouping the connections behind one button put a bulk propane tank beside mains
  // water and made the mismatch visible: SUPPLIED claims "this does not have to
  // balance", true of a pipe and false of a tank. The tank is 'stock', not 'supply',
  // so it still introduces fuel from outside but never stops the arithmetic -- the
  // fuel-quantity input already asks the honest question, which is how much you buy.
  const r = runWired(['SOL-156', 'SOL-212'])
  for (const f of Object.values(r.families)) {
    if (f.verdict === VERDICT.SUPPLIED) {
      throw new Error('a stored tank reported as an unlimited supply')
    }
  }
  eq(r.hasMains, false, 'the off-mains switch is not offered for a tank')
  // Same shape wired to a network instead: that one IS supplied, so the difference is
  // the vocabulary value and nothing else about the graph.
  eq(runWired(['SOL-197', 'SOL-212']).families.hotwater.verdict, VERDICT.SUPPLIED, 'mains gas')
})

// --- byproducts, Eric 2026-09-04 -------------------------------------------
const WOOD = { fuelStock: { 'IO-04': 3650 } }   // 10 kg a day

check('a byproduct reports what is going spare, never a verdict', () => {
  const r = runWired(['SOL-030'], WOOD)
  const flue = r.families.flue
  if (!flue) throw new Error('no flue family at all')
  eq(flue.byproduct, true, 'byproduct flag')
  eq(flue.verdict, null, 'verdict')
  eq(flue.band, null, 'band')
  if (!flue.spare || !(flue.spare[0] > 0)) throw new Error('nothing reported spare: ' + JSON.stringify(flue.spare))
  has(flue.reasons, REASON.BYPRODUCT_SPARE, 'reasons')
})

check('two ratios on one node split their input instead of competing', () => {
  // A wood stove turns fuel into delivered heat AND into flue gas: shares of one
  // stream, not rivals for it. The first version zeroed the pool on the first ratio,
  // so the second read nothing and every byproduct came out empty.
  const r = runWired(['SOL-030'], WOOD)
  if (!(r.families.heat.supply.annual[1] > 0)) throw new Error('delivered heat is empty')
  if (!(r.families.flue.spare[1] > 0)) throw new Error('flue heat is empty')
  // Their shares should roughly account for the fuel: 0.65-0.80 plus 0.15-0.35.
  const fuelHigh = r.families.heat.supply.annual[1] + r.families.flue.spare[1]
  const heatOnly = r.families.heat.supply.annual[1]
  if (!(fuelHigh > heatOnly * 1.15)) {
    throw new Error('the flue share is missing or negligible: ' + fuelHigh + ' vs ' + heatOnly)
  }
})

check('a byproduct something consumes stops being spare', () => {
  const alone = runWired(['SOL-030'], WOOD).families.flue
  const used = runWired(['SOL-030', 'SOL-178'], WOOD).families.flue
  if (!alone.spare) throw new Error('nothing spare on the stove alone')
  eq(used.spare, null, 'spare once a coil takes it')
  hasNot(used.reasons, REASON.BYPRODUCT_SPARE, 'reasons')
  // And the recovery has to arrive somewhere: the coil now feeds hot water, which it
  // could not do at all while the flue stream did not exist.
  const hw = runWired(['SOL-030', 'SOL-178'], WOOD).families.hotwater
  if (!hw || !hw.band) throw new Error('the coil produced no hot water')
})

check('reject water is not counted as water supply', () => {
  // Folding it into `water` would have a reverse-osmosis graph report MORE water
  // available than it has, which is the optimistic error this module exists to stop.
  if (FAMILIES.water.includes('IO-43')) throw new Error('reject water is inside the water family')
  const r = runWired(['SOL-053', 'SOL-149'])
  if (!r.families.reject || !r.families.reject.spare) throw new Error('no reject stream reported')
  // The water family's supply must be what the roof caught minus what RO took, never
  // more than the roof caught.
  const rain = runWired(['SOL-053']).families.water.supply.annual[1]
  const withRo = r.families.water.supply.annual ? r.families.water.supply.annual[1] : 0
  if (withRo > rain + 0.001) throw new Error(`RO increased the water supply: ${withRo} > ${rain}`)
})

check('a clamped family names the step that is binding', () => {
  // Eric, 2026-09-04: on the water example, raising the roof area and changing the
  // rainfall year stopped moving the number and the reason why was the third of seven
  // caveats. The engine had the fact and was not reporting which step it was.
  const big = runWired(['SOL-053', 'SOL-131', 'SOL-091'], { catchmentArea: 1000 }).families.water
  has(big.reasons, REASON.CAPACITY_CLAMPED, 'reasons')
  if (!big.clampedBy || !big.clampedBy.length) throw new Error('clamped but did not say by what')
  if (!big.clampedBy.includes('SOL-131')) {
    throw new Error('named the wrong step: ' + JSON.stringify(big.clampedBy))
  }
  // Below the cap it must NOT claim a binding step, or the message would appear on
  // every graph and mean nothing.
  const small = runWired(['SOL-053', 'SOL-131', 'SOL-091'], { catchmentArea: 100 }).families.water
  hasNot(small.reasons, REASON.CAPACITY_CLAMPED, 'reasons')
  eq(small.clampedBy, null, 'clampedBy below the cap')
})

check('a filter whose output is linked to nothing does not add capacity beside one wired onward', () => {
  // Eric, 2026-10-20: three bio-sand filters, inputs linked, two outputs loose, turned it green.
  const g = (extraEdges) => assess({
    linkedOnly: true,
    nodes: [['r', 'SOL-053'], ['f1', 'SOL-131'], ['f2', 'SOL-131'], ['f3', 'SOL-131'], ['s', 'SOL-091']].map(([id, sol]) => ({ id, sol })),
    edges: ['r>f1', 'f1>s', 'r>f2', 'r>f3', ...extraEdges].map((x) => { const [from, to] = x.split('>'); return { from, to } }),
  }, { ...BASE, catchmentArea: 400 }, data).families.water
  const loose = g([])
  has(loose.reasons, REASON.CAPACITY_CLAMPED, 'loose filters: still clamped')
  const wired = g(['f2>s', 'f3>s'])
  hasNot(wired.reasons, REASON.CAPACITY_CLAMPED, 'wired in parallel: no longer clamped')
  if (!(wired.band[0] > loose.band[0])) throw new Error('wiring the outputs should raise the supply')
})

check('a step placed twice is named once', () => {
  // Eric, 2026-09-11: "Bottleneck: This system is capped by Bio-sand filter, Bio-sand
  // filter". clampedBy carried one entry per NODE, so a step the reader placed twice was
  // read out twice. What binds is the step, not each copy of it.
  const w = runWired(['SOL-053', 'SOL-131', 'SOL-131', 'SOL-091'], { catchmentArea: 1000 }).families.water
  eq(JSON.stringify(w.clampedBy), JSON.stringify(['SOL-131']), 'clampedBy')
})

check('a clamped supply really does stop responding, which is why it must be said', () => {
  // Pins the behaviour Eric saw, so nobody "fixes" the arithmetic later: past the cap
  // the roof and the rainfall year are genuinely inert, and that is correct.
  const g = ['SOL-053', 'SOL-131', 'SOL-091']
  const a = runWired(g, { catchmentArea: 1000, dryYearFactor: 1.0 }).families.water.band
  const b = runWired(g, { catchmentArea: 4000, dryYearFactor: 0.64 }).families.water.band
  near(a[0], b[0], 'low end is the filter, not the rain', 0.001)
  near(a[1], b[1], 'high end is the filter, not the rain', 0.001)
})

check('the three storage options rank the way their sourced figures say', () => {
  // Not pinning any one number, which sourcing is entitled to change, but the ORDER
  // the three must keep: compressed air 0.11-0.17 round trip, lead-acid 0.70-0.85,
  // lithium 0.92-0.98. A transcription error in any of them would break the ordering,
  // and this comparison is the reason the compressed-air row was written at all --
  // a reader attracted to "ditch the batteries" meets the exergetic 70 pc first.
  const load = ['SOL-082', 'SOL-087', 'SOL-112']
  const band = (store) => runWired(['SOL-076', store, ...load]).families.electricity.band
  const caes = band('SOL-192'), lead = band('SOL-080'), lithium = band('SOL-155')
  for (const [name, b] of [['caes', caes], ['lead', lead], ['lithium', lithium]]) {
    if (!b) throw new Error(`no band for ${name}`)
  }
  if (!(caes[1] < lead[0])) {
    throw new Error(`compressed air should be strictly worse than lead-acid: ${caes} vs ${lead}`)
  }
  if (!(lead[0] < lithium[0])) {
    throw new Error(`lithium should beat lead-acid: ${lead} vs ${lithium}`)
  }
})

check('a lower per-use figure moves the verdict, end to end', () => {
  // The recirculating shower's whole claim is that it draws a fraction of what a
  // conventional one does. On the same roof and the same filter that has to show up as
  // a better verdict, or the figure is not reaching the arithmetic.
  const conv = runWired(['SOL-053', 'SOL-131', 'SOL-092']).families.water
  const loop = runWired(['SOL-053', 'SOL-131', 'SOL-170']).families.water
  if (!(loop.band[0] > conv.band[0])) {
    throw new Error(`the recirculating shower did not improve the band: ${conv.band} vs ${loop.band}`)
  }
})

check('nothing is named in two lists at once', () => {
  // The sources panel showed the same solution as "not counted here" and as "placed but
  // carrying no figure at all", two sentences that look like one sentence
  // (Eric, 2026-09-04). They answer different questions and in a single-family graph
  // they collide by construction.
  // The example was the greywater diversion until 2026-09-04, when it became a flagged
  // CONDUIT and correctly stopped being an uncounted gap. Swapped for a swale, which
  // touches water, carries no figure, and is emphatically not a pipe: infiltration into
  // the ground is its whole purpose, which is exactly why it failed the conduit test.
  const r = runWired(['SOL-053', 'SOL-131', 'SOL-091', 'SOL-012'])
  const named = new Set()
  for (const f of Object.values(r.families)) for (const u of f.uncounted) named.add(u.solutionId)
  for (const sol of r.withoutFigures) {
    if (named.has(sol)) throw new Error(`${sol} appears in both lists`)
  }
  if (!named.has('SOL-012')) throw new Error('the uncounted row went missing entirely')
})

check('a solution touching no computable family is still surfaced', () => {
  // What the global list is actually FOR, once the overlap is gone: something placed
  // that no family would ever mention. Deleting the overlap must not delete this.
  // REPOINTED 2026-09-05. This used SOL-022, the airtight membrane, which was a fair
  // example until decision 2d gave every fabric row an advisory io and a block of its
  // own. The row did not vanish from the report -- it moved to a better place in it, and
  // the test read that move as the regression it was written to catch. So it now uses a
  // STRUCTURAL row, which genuinely fits nowhere: a timber frame moves no resource, is
  // not advisory, and no family will ever mention it. That is the case this guards.
  const r = runWired(['SOL-053', 'SOL-131', 'SOL-091', 'SOL-001'])
  if (!r.withoutFigures.includes('SOL-001')) {
    throw new Error('a structural solution vanished from the report: ' + JSON.stringify(r.withoutFigures))
  }
})

check('a fabric measure is advised, not reported as missing a figure', () => {
  // Decision 2d, 2026-09-05. Insulation and shading carry no figure BY DESIGN -- what an
  // insulation saves depends on what it is applied to and what was there before, which no
  // source states per technique. Listing them under "placed but carrying no figure at
  // all" reads as a complaint about a wall.
  const r = runWired(['SOL-053', 'SOL-131', 'SOL-091', 'SOL-022', 'SOL-026'])
  const adv = (r.advisory || []).map((a) => a.solutionId)
  if (!adv.includes('SOL-022')) throw new Error('the airtight membrane is not advised: ' + JSON.stringify(adv))
  if (!adv.includes('SOL-026')) throw new Error('the overhang is not advised: ' + JSON.stringify(adv))
  // And it must be OUT of the complaint list, or it is reported twice in two sentences
  // that look like the same sentence -- the exact duplication Eric flagged on 2026-09-04.
  if (r.withoutFigures.includes('SOL-022')) throw new Error('advised AND reported as figureless')
  // Winter and summer are separated, because that is what decides which measure helps:
  // an overhang does nothing for a cold January.
  const membrane = r.advisory.find((a) => a.solutionId === 'SOL-022')
  const overhang = r.advisory.find((a) => a.solutionId === 'SOL-026')
  if (!membrane.ios.includes('IO-46')) throw new Error('airtightness not filed under reduced heat loss')
  if (!overhang.ios.includes('IO-47')) throw new Error('shading not filed under reduced heat gain')
  // An advisory io must never become a family: it has no unit, so a verdict on it would
  // be a verdict on nothing.
  if (r.families.advisory || r.families['IO-46']) throw new Error('an advisory io reached the verdict machinery')
})

check('a figure we HAVE but cannot count says which of those it is', () => {
  // Answers the question the flat list raised: yes, four of the five reasons are cases
  // where a figure exists and still does not reach the total.
  const r = runWired(['SOL-061'])
  const un = r.families.hotwater.uncounted
  if (!un.length) throw new Error('a water heater with no power supply counted anyway')
  eq(un[0].why, REASON.RATIO_NO_INPUT, 'why')
  if (!un[0].coef) throw new Error('reported as having no figure when it has one')
})

check('a second fuel type seeds its own family, independently of the first', () => {
  // Until 2026-09-04 only wood (IO-04) had ever exercised the fuel-stock path. The
  // backup generator moving to liquid fuel (IO-29) is the first row to seed a different
  // one, and the two must not leak into each other: a reader who burns wood and keeps a
  // propane can has two quantities, not one.
  const g = ['SOL-156', 'SOL-083', 'SOL-087']
  const none = runWired(g).families.electricity
  const some = runWired(g, { fuelStock: { 'IO-29': 400 } }).families.electricity
  if (none.band) throw new Error('a generator produced electricity with no fuel entered')
  if (!some.band) throw new Error('entering liquid fuel produced nothing')
  // Wood in the tank must do nothing for a generator that does not burn wood.
  const wrongFuel = runWired(g, { fuelStock: { 'IO-04': 4000 } }).families.electricity
  if (wrongFuel.band) throw new Error('firewood fuelled a petrol generator')
})

check('a two-input basis scales with both of its inputs', () => {
  // Micro-hydro is the only basis needing TWO scale inputs, and it sat in the sheet
  // unimplemented until 2026-09-04: the menu offered flow and head, the engine had no
  // case, and any row against it would have vanished as missing-scenario. Doubling
  // either one has to double the output, or only one of them is reaching the sum.
  const g = ['SOL-078', 'SOL-082', 'SOL-087']
  const base = { head: 10, flow: 0.01 }
  const sup = (o) => runWired(g, { ...base, ...o }).families.electricity.supply.annual[1]
  const one = sup({})
  near(sup({ flow: 0.02 }) / one, 2, 'doubling the flow doubles the output', 0.01)
  near(sup({ head: 20 }) / one, 2, 'doubling the head doubles the output', 0.01)
  // And with either missing it must go quiet rather than guess.
  const noFlow = runWired(g, { ...base, flow: 0 }).families.electricity
  has(noFlow.reasons, REASON.MISSING_SCENARIO, 'no flow entered')
})

// --- conduits, Eric 2026-09-04 ---------------------------------------------
check('a conduit is not counted as a gap', () => {
  // A cistern carries water without changing the quantity, so it needs no coefficient.
  // Counting it as a thing we failed to estimate made a realistic house read as one
  // third covered.
  const without = runWired(['SOL-053', 'SOL-092']).families.water
  const withPipe = runWired(['SOL-053', 'SOL-092', 'SOL-055']).families.water
  eq(withPipe.coverage.touching, without.coverage.touching, 'a conduit does not enlarge the denominator')
  hasNot(withPipe.reasons, REASON.NO_FIGURE, 'a conduit is not a missing figure')
  hasNot(withPipe.reasons, REASON.PARTIAL_COVERAGE, 'and does not make the total partial')
  // The verdict itself must be untouched: a pipe changes nothing about the arithmetic.
  near(withPipe.band[0], without.band[0], 'band low unchanged by a conduit', 0.0001)
  near(withPipe.band[1], without.band[1], 'band high unchanged by a conduit', 0.0001)
})

check('a solution that hands a family on is not also a gap in it', () => {
  // Eric, 2026-09-12: the panel counted the thermosiphon under Hot water at 350-600
  // kWh/m2/yr AND listed it under Water as "we have no figure for it". The litres it takes
  // are the litres it gives back; what draws them is the shower, where the demand is counted.
  const r = runWired(['SOL-053', 'SOL-131', 'SOL-059', 'SOL-091'])
  const w = r.families.water
  if (w.uncounted.some((u) => u.solutionId === 'SOL-059')) {
    throw new Error('the water heater is still a water gap')
  }
  if (r.withoutFigures.includes('SOL-059')) throw new Error('it moved to the other list instead')
  eq(w.coverage.counted, w.coverage.touching, 'water coverage is clean')
  // And what it IS measured for still counts, or this test would pass by deleting the row.
  if (!r.families.hotwater.rows.some((x) => x.solutionId === 'SOL-059')) {
    throw new Error('the collector stopped counting towards hot water')
  }
  // THE CASE THIS MUST NOT SWALLOW: water that leaves as waste is not water handed on, so a
  // flush toilet with no figure is still the gap it always was.
  // (SOL-216 takes potable water and gives back blackwater: same family, and still a draw.
  // It carries a figure, so what this pins is that the rule did not quietly lift it out of
  // the water report the way it lifts the heater.)
  const t = runWired(['SOL-053', 'SOL-216']).families.water
  eq(t.coverage.touching, 2, 'the flush toilet still counts against the water family')
})

check('a conduit is excused only for the family it passes through', () => {
  // THE CARE IN THE WHOLE FEATURE. A pressurised pump IS a pipe for water and ALSO draws
  // electricity nobody has quantified. Excusing the row outright would hide a real gap
  // behind a true statement, so the flag is honoured per (solution, io).
  const r = runWired(['SOL-053', 'SOL-092', 'SOL-058'])
  hasNot(r.families.water.reasons, REASON.NO_FIGURE, 'water: it is a pipe')
  eq(r.families.water.coverage.counted, r.families.water.coverage.touching,
     'water coverage is clean, the pipe is not a gap')
  // AND THE ELECTRICITY GAP IS STILL SAID, in the global list rather than as a verdict
  // card. Writing this test first expected an electricity FAMILY, and building that
  // turned out to contradict a deliberate rule: a family whose members all lack figures
  // has nothing to say beyond "we do not know", and the global list already says it.
  // Creating a grey card here would have duplicated that in two places, which is the
  // repetition this panel was cleaned of on 2026-09-04.
  if (!r.withoutFigures.includes('SOL-058')) {
    throw new Error('the pump was excused everywhere: its electricity draw went unmentioned')
  }
  // While a conduit with NOTHING unexcused must leave that list too: "placed but
  // carrying no figure at all" is a complaint, and a pipe deserves none.
  const pipes = runWired(['SOL-053', 'SOL-055', 'SOL-057', 'SOL-092'])
  for (const sol of ['SOL-055', 'SOL-057']) {
    if (pipes.withoutFigures.includes(sol)) {
      throw new Error(`${sol} is a pure conduit and was still reported as missing a figure`)
    }
  }
  hasNot(pipes.families.water.reasons, REASON.PARTIAL_COVERAGE, 'a chain of pipes is not partial')
})

check('the conduit marking cannot excuse a row that only consumes', () => {
  // Belt and braces on the rule above, on a fixture so no catalogue edit can weaken it:
  // flagging a pure consumer must not remove it from coverage, because it does not pass
  // anything through -- it eats it.
  const f = JSON.parse(JSON.stringify(FIXTURE))
  f.solutions = [{ id: 'X-EATER', name: 'eater', conduit_for: ['IO-36'] }]
  f.io_index.push({ sol: 'X-EATER', io: 'IO-36', role: 'consumes' })
  const r = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD', 'X-EATER'] },
                   { ...BASE, arrayKwp: 1 }, f)
  has(r.families.heat.reasons, REASON.NO_FIGURE, 'a marked consumer is still a gap')
  eq(r.families.heat.coverage.touching, 3, 'and still counts in the denominator')
})

check('a conduit that IS given a figure still uses it', () => {
  // The flag suppresses the COVERAGE complaint, not the arithmetic. If somebody later
  // sources a leakage rate for a distribution network, it must take effect.
  const f = JSON.parse(JSON.stringify(FIXTURE))
  f.solutions = [{ id: 'X-PIPE', name: 'pipe', conduit_for: ['IO-36'] }]
  f.coefficients.push(
    { solution_id: 'X-PIPE', io_type_id: 'IO-36', role: 'out', kind: 'RATIO',
      low: 0.5, high: 0.5, unit: 'ratio', basis: 'dimensionless ratio',
      converts_from: 'IO-36', condition: 'fixture', source: 'fixture',
      tier: 'A', precision: 'P1' })
  f.io_index.push({ sol: 'X-PIPE', io: 'IO-36', role: 'consumes' },
                  { sol: 'X-PIPE', io: 'IO-36', role: 'produces' })
  const plain = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD'] }, { ...BASE, arrayKwp: 1 }, FIXTURE)
  const leaky = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD', 'X-PIPE'] }, { ...BASE, arrayKwp: 1 }, f)
  if (!(leaky.families.heat.band[1] < plain.families.heat.band[1] * 0.75)) {
    throw new Error('a flagged conduit ignored a figure it was given: '
      + JSON.stringify(leaky.families.heat.band) + ' vs ' + JSON.stringify(plain.families.heat.band))
  }
})

check('a behavioural basis serves exactly one appliance class', () => {
  // THE WHOLE-SYSTEM FINDING, 2026-09-04, after three separate defects in these four
  // bases in three days. All three had ONE root cause: the usage range lives on the
  // BASIS, which is a unit, while the behaviour belongs to the APPLIANCE CLASS. They
  // coincided only by luck.
  //  - two ranges were back-calculated from a figure they were then multiplied into;
  //  - one carried a laundry frequency under a name ("per cycle") that invited any
  //    cycling appliance to adopt it, which a composter row nearly did.
  // The bases are now named for their behaviour rather than their unit, and this check
  // replaces the hardcoded "only laundry may use it" list that patched the third one.
  // DERIVED, not enumerated: it reads the sub-function of every solution using each
  // behavioural basis, so it keeps working as the catalogue grows.
  const beh = new Set(data.bases.filter((b) => b.behavioural).map((b) => b.basis))
  const sub = Object.fromEntries(data.solutions.map((x) => [x.id, x.subfunction_id]))
  const users = new Map()
  for (const c of data.coefficients) {
    if (!beh.has(c.basis)) continue
    if (!users.has(c.basis)) users.set(c.basis, new Set())
    users.get(c.basis).add(sub[c.solution_id])
  }
  for (const [basis, subs] of users) {
    if (subs.size > 1) {
      throw new Error(`the behavioural basis "${basis}" is used across ${subs.size} `
        + `sub-functions (${[...subs].join(', ')}). Its usage range is ONE rhythm, and `
        + 'two appliance classes do not share one. Give the second a basis of its own, '
        + 'or state its figure per year.')
    }
  }
  // And a behavioural basis nobody uses is a trap waiting for its first adopter: the
  // generic "per use", with an admittedly invented 1-3 a day, was deleted for this.
  for (const b of data.bases) {
    if (b.behavioural && !users.has(b.basis)) {
      throw new Error(`the behavioural basis "${b.basis}" is unused. A usage range nobody `
        + 'has justified against a real appliance is a guess waiting to be adopted.')
    }
  }
})

check('the household demand scales with the household', () => {
  const two = run(['SOL-059']).families.hotwater.demand.annual
  const four = run(['SOL-059'], { people: 4 }).families.hotwater.demand.annual
  near(four[0], two[0] * 2, 'four people need twice as much')
})

check('a household demand with an unrecognised denominator is dropped, not guessed', () => {
  // A per-YEAR figure read as per-day is wrong by 365 and looks entirely plausible.
  const f = JSON.parse(JSON.stringify(FIXTURE))
  f.io_types = [{ id: 'IO-36', name: 'fixture heat',
                  household_demand: { low: 500, high: 600, unit: 'kWh/year' } }]
  const r = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD'] }, { ...BASE, arrayKwp: 1 }, f)
  // X-RAD's own 2 kWh/day demand stands; the unusable household figure adds nothing.
  near(r.families.heat.demand.annual[1], 2, 'only the real demand counted')
  hasNot(r.families.heat.reasons, REASON.HOUSEHOLD_DEMAND, 'reasons')
})

check('a ratio is aimed at the io its own row names', () => {
  // A water heater outputs BOTH litres of hot water and kilowatt hours of heat. The
  // destination used to be guessed as "the solution's first output with a family",
  // which aimed an efficiency stated on the kWh row at the LITRES pool and got it
  // refused as a unit mismatch. Same shape as the converts-from bug, same cause.
  const h = run(['SOL-076', 'SOL-082', 'SOL-061']).families.hotwater
  if (!h) throw new Error('no hotwater family at all')
  hasNot(h.reasons, REASON.UNIT_MISMATCH, 'reasons')
  has(h.reasons, REASON.RATIO_APPLIED, 'reasons')
})

check('every family declares the unit it is summed in', () => {
  for (const fam of Object.keys(FAMILIES)) {
    if (!FAMILY_UNIT[fam]) throw new Error(`family ${fam} has no declared unit`)
  }
  for (const fam of Object.keys(FAMILY_UNIT)) {
    if (!FAMILIES[fam]) throw new Error(`unit declared for a family that does not exist: ${fam}`)
  }
})

// --- the unit guard covers RATIO rows only, found by probing 2026-09-03 -----
// Two unit-mixing incidents produced the FAMILY_UNIT guard, and both happened to be
// RATIOs, so the guard was written inside the RATIO branch. Nothing checks a
// SOURCE, CAPACITY or DEMAND. A solar water heater's 500 kWh/m2/yr booked on Heated
// Water -- which is in the WATER family, summed in litres -- would add kilowatt
// hours to a pool of litres with no guard anywhere and no reason code, which is
// worse than the two incidents that prompted the guard because those at least
// said unit-mismatch out loud.
// Decided at data level rather than at run time: this is a defect in a row, and a
// row can be judged before anybody places it. Lives here rather than in
// validate_coefficients.py because FAMILIES and FAMILY_UNIT are DEFINED here --
// a Python copy of them would be a second thing to keep in step.
check('no non-ratio row puts energy into a volume pool, or the reverse', () => {
  const famOf = {}
  for (const [fam, ios] of Object.entries(FAMILIES)) for (const io of ios) famOf[io] = fam
  const basisByName = Object.fromEntries((data.bases || []).map((b) => [b.basis, b]))
  const ioById = Object.fromEntries((data.io_types || []).map((t) => [t.id, t]))
  // Leading dimension of a unit string: what the figure counts, before the "per".
  const dimOf = (unit) => {
    const head = String(unit || '').trim().split('/')[0].trim().toLowerCase()
    if (/^(kwh|wh|kw|w|mj|kj|j)\b/.test(head)) return 'energy'
    if (/^(l|litre|liter|m3|m³)\b/.test(head)) return 'volume'
    return null   // areas, masses, fractions, counts: not this check's business
  }
  const DIM = { 'L/day': 'volume', 'kWh/day': 'energy' }
  const bad = []
  for (const c of data.coefficients || []) {
    if (c.engine_use === false) continue
    if (c.kind === 'RATIO') continue          // already guarded at run time
    const fam = famOf[c.io_type_id]
    if (!fam) continue                         // no family, no pool to mix
    const basis = basisByName[c.basis]
    if (basis && basis.contributes_to_flow === false) continue
    const want = DIM[FAMILY_UNIT[fam]]
    const got = dimOf(c.unit)
    if (!want || !got || want === got) continue
    // A volume of FUEL is legitimate in an energy family when the resource carries
    // an energy density to convert it -- that is how biogas in m3 becomes kWh.
    if (want === 'energy' && got === 'volume' && (ioById[c.io_type_id] || {}).energy_density) continue
    bad.push(`${c.solution_id}/${c.io_type_id} ${c.kind} "${c.unit}" is ${got}, but the `
             + `${fam} family is summed in ${FAMILY_UNIT[fam]}`)
  }
  if (bad.length) throw new Error(bad.join('; '))
})

check('two ratios splitting one input cannot both create energy', () => {
  // Three rows in the catalogue split one input two ways: a stove's fuel into delivered
  // heat AND flue gas, reverse osmosis's feed into permeate AND reject. They are written
  // as two independent ranges because the sheet has no way to say "these are shares of
  // one thing", and the engine propagates low/low and high/high.
  //
  // WHAT THAT MEANS, and it is a limit rather than a defect: the HIGH corner of a
  // complementary pair is not a physically possible device. A stove cannot be 80 pc
  // efficient and lose 35 pc up the flue; a membrane cannot recover 50 pc and reject
  // 80 pc. Every band in this engine is a bound rather than a joint distribution, and
  // usually its corners are at least possible -- a dry year AND long showers. Here they
  // are not, so the flue stream's high end and the brine's high end each overstate.
  //
  // WHAT IS ACTUALLY CHECKABLE, and worth checking: the LOW corner. If the pessimistic
  // shares already sum above 1 the pair creates energy in every case, not just at a
  // corner, and that is a straightforward error. A single ratio above 1 is fine and
  // means ambient harvest (a heat pump's COP), so only PAIRS are summed.
  const bySource = new Map()
  for (const c of data.coefficients) {
    if (c.kind !== 'RATIO' || c.engine_use === false || !c.converts_from) continue
    const key = `${c.solution_id}|${c.converts_from}`
    if (!bySource.has(key)) bySource.set(key, [])
    bySource.get(key).push(c)
  }
  for (const [key, group] of bySource) {
    if (group.length < 2) continue
    const lows = group.reduce((a, c) => a + Number(c.low), 0)
    if (lows > 1.0001) {
      throw new Error(`${key}: ${group.length} ratios share one input and their LOW ends `
        + `sum to ${lows.toFixed(2)}, so the pair creates energy in every case, not only `
        + `at a corner. Shares of one stream must sum to at most 1.`)
    }
  }
})

check('a ratio within one unit still works', () => {
  // The guard must not block legitimate conversions: electricity and heat are both
  // kWh/day, so a heat pump may still convert between them.
  const r = assess({ solutionIds: ['X-PV', 'X-HP', 'X-RAD'] }, { ...BASE, arrayKwp: 1 }, FIXTURE)
  has(r.families.heat.reasons, REASON.RATIO_APPLIED, 'fixture heat')
  hasNot(r.families.heat.reasons, REASON.UNIT_MISMATCH, 'fixture heat')
})

// --- a basis the engine cannot convert must not be in use --------------------
// SOL-147 was written with the basis "per minute", which exists in the vocabulary
// and which the engine has no conversion for. The row did not fail; it silently
// became missing-scenario and contributed nothing. Same shape as a reason code with
// no string: two files that must agree, with nothing making them.
// READ OUT OF THE ENGINE, not copied from it. This used to be a hand-kept list, which
// is a second copy of a fact and drifts the moment somebody adds a case and forgets --
// the failure the protocol's "derive the check from the artifact" rule exists for, and
// one this project has already been bitten by twice. The switch in dailyBand IS the
// list of bases the engine can convert, so the test parses it.
const ENGINE_HANDLES = (() => {
  const src = readFileSync(resolve(HERE, '../src/adequacy/engine.js'), 'utf8')
  const start = src.indexOf('function dailyBand(')
  if (start < 0) throw new Error('cannot find dailyBand in engine.js to read its cases')
  // Bounded at the next top-level function, so a `case` in some later switch cannot
  // widen the set and quietly weaken this check.
  const end = src.indexOf('\nfunction ', start + 1)
  const body = src.slice(start, end < 0 ? undefined : end)
  const found = [...body.matchAll(/case '([^']+)':/g)].map((m) => m[1])
  if (!found.length) throw new Error('no basis cases found in dailyBand')
  return new Set(found)
})()

check('every basis in active use can actually be converted by the engine', () => {
  const bases = new Map(data.bases.map((b) => [b.basis, b]))
  for (const c of data.coefficients) {
    if (c.engine_use === false) continue
    const b = bases.get(c.basis)
    if (!b) throw new Error(`${c.solution_id}: basis ${c.basis} is not in the Bases sheet`)
    // Behavioural bases are converted through their usage range, not the switch.
    if (b.behavioural) continue
    // Sizing bases never enter the arithmetic at all.
    if (b.contributes_to_flow === false) continue
    if (!ENGINE_HANDLES.has(c.basis)) {
      throw new Error(`${c.solution_id} uses "${c.basis}", which the engine cannot convert. ` +
        `Either add a case for it or mark the row Engine Use = N.`)
    }
  }
})

check('EVERY basis the sheet declares can be converted, not only the used ones', () => {
  // The check above walks the COEFFICIENTS, so a basis nobody has written a row against
  // escapes it entirely. That is the same untested-surface hole that let both collector
  // bases ignore the climate for a day: declared, offered by the menu, and unreachable
  // by any test. Three bases were found unimplemented this way on 2026-09-04.
  // A basis in the sheet is a promise the menu will honour. Implement it or delete it;
  // leaving it declared is a trap for whoever writes the first row against it.
  // THREE OUTCOMES, and only one of them is a defect.
  //  - unconvertible and used ONLY by reference rows: fine, and deliberate. A hand
  //    pump's litres per minute is real and cannot become a daily figure without
  //    guessing how long somebody pumps, so the basis exists to record it, not to sum
  //    it. The check above already fails if such a row is ever marked Engine Use = Y.
  //  - unconvertible and UNUSED: a trap. Nothing has exercised it, nothing will fail
  //    when somebody writes the first row against it, and the menu already offers its
  //    scale input.
  //  - convertible: fine.
  const usedByActive = new Set()
  const usedAtAll = new Set()
  for (const c of data.coefficients) {
    usedAtAll.add(c.basis)
    if (c.engine_use !== false) usedByActive.add(c.basis)
  }
  const traps = []
  for (const b of data.bases) {
    if (b.behavioural) continue                      // handled by the usage range
    if (b.contributes_to_flow === false) continue    // never enters the arithmetic
    if (ENGINE_HANDLES.has(b.basis)) continue
    if (usedAtAll.has(b.basis) && !usedByActive.has(b.basis)) continue  // reference-only
    traps.push(b.basis)
  }
  if (traps.length) {
    throw new Error(`declared in Bases, unused, and the engine cannot convert them: `
      + `${traps.join(', ')}. Add a case, or remove the basis so nobody writes a row `
      + 'against it expecting it to work.')
  }
})

check('no active coefficient silently contributes nothing', () => {
  // The end-to-end form of the check above: place each solution that carries an
  // active figure and confirm it moves a total somewhere.
  // Every scale input the engine can ask for must be present, or a row is judged
  // inert when it was only unsupplied.
  const scen = { ...BASE, people: 2, catchmentArea: 100, arrayKwp: 3, collectorArea: 4,
                 feedstock: 400, fuelStock: { 'IO-04': 2000, 'IO-30': 100 },
                 flow: 0.002, head: 10 }
  const active = data.coefficients.filter((c) => c.engine_use !== false)
  for (const c of new Set(active.map((x) => x.solution_id))) {
    const r = assess({ solutionIds: [c] }, scen, data)
    const touched = Object.values(r.families).some((f) =>
      (f.supply.annual && f.supply.annual[1] > 0) || (f.demand.annual && f.demand.annual[1] > 0))
    const excused = Object.values(r.families).some((f) =>
      f.reasons.includes(REASON.RATIO_NO_INPUT) ||
      f.reasons.includes(REASON.CAPACITY_STARVED) ||
      f.reasons.includes(REASON.NOT_A_FLOW)) ||
      // Surfaced as a reference figure counts as explaining itself: the reader sees
      // the number and why it is not in a total.
      r.referenceFigures.some((x) => x.solutionId === c)
    if (!touched && !excused) {
      throw new Error(`${c} carries an active figure that moves nothing and gives no reason`)
    }
  }
})

// --- identity is per node, not per solution ---------------------------------
// Keying on the solution id collapsed two of the same thing into one. On the demand
// side that was an OPTIMISTIC error -- two showers counted as one -- which is the
// category this module exists to prevent. Raised by Eric, 2026-09-02.
const solById = Object.fromEntries(data.solutions.map((s) => [s.id, s]))
const N = (...pairs) => ({ nodes: pairs.map(([id, sol]) => ({ id, sol })) })
const runG = (g, over = {}) => assess(g, { ...BASE, ...over }, data)

check('two of the same demand are two draws, not one', () => {
  const one = runG(N(['a', 'SOL-053'], ['c', 'SOL-092'])).families.water
  const two = runG(N(['a', 'SOL-053'], ['c', 'SOL-092'], ['c2', 'SOL-092'])).families.water
  if (!(two.band[0] < one.band[0] * 0.75)) {
    throw new Error(`a second shower barely moved demand: ${one.band} -> ${two.band}`)
  }
})

check('parallel throughput-limited steps add their capacity', () => {
  const g = N(['a', 'SOL-053'], ['b', 'SOL-131'], ['b2', 'SOL-131'], ['c', 'SOL-092'])
  const one = runG(N(['a', 'SOL-053'], ['b', 'SOL-131'], ['c', 'SOL-092']),
                   { catchmentArea: 1000 }).families.water
  const parallel = runG({ ...g, edges: [
    { from: 'a', to: 'b' }, { from: 'a', to: 'b2' },
    { from: 'b', to: 'c' }, { from: 'b2', to: 'c' }] }, { catchmentArea: 1000 }).families.water
  has(parallel.reasons, REASON.PARALLEL_CAPACITY, 'reasons')
  near(parallel.band[1], one.band[1] * 2, 'two filters should double the throughput', 0.2)
})

check('steps in series do not add their capacity', () => {
  const g = N(['a', 'SOL-053'], ['b', 'SOL-131'], ['b2', 'SOL-131'], ['c', 'SOL-092'])
  const one = runG(N(['a', 'SOL-053'], ['b', 'SOL-131'], ['c', 'SOL-092']),
                   { catchmentArea: 1000 }).families.water
  const series = runG({ ...g, edges: [
    { from: 'a', to: 'b' }, { from: 'b', to: 'b2' },
    { from: 'b2', to: 'c' }] }, { catchmentArea: 1000 }).families.water
  near(series.band[1], one.band[1], 'series should behave as a single unit', 0.05)
})

check('without edges the cautious reading is taken, and said out loud', () => {
  const g = N(['a', 'SOL-053'], ['b', 'SOL-131'], ['b2', 'SOL-131'], ['c', 'SOL-092'])
  const r = runG(g, { catchmentArea: 1000 }).families.water
  has(r.reasons, REASON.SERIES_ASSUMED, 'reasons')
  const parallel = runG({ ...g, edges: [
    { from: 'a', to: 'b' }, { from: 'a', to: 'b2' },
    { from: 'b', to: 'c' }, { from: 'b2', to: 'c' }] }, { catchmentArea: 1000 }).families.water
  if (!(r.band[1] <= parallel.band[1] + 1e-9)) {
    throw new Error('the no-edges assumption was more generous than parallel')
  }
})

// --- only what is linked is counted (the builder's mode) --------------------
check('an unlinked card is left out of every sum, and named', () => {
  // A shower fed through a filter, and a rainwater tank nobody linked (U1 journeys F10).
  const g = { ...N(['f', 'SOL-131'], ['s', 'SOL-091'], ['t', 'SOL-053']),
    edges: [{ from: 'f', to: 's' }] }
  const pooled = runG(g)
  const linked = runG({ ...g, linkedOnly: true })
  eq(linked.unlinked.map((u) => u.solutionId).join(), 'SOL-053', 'unlinked')
  eq(pooled.unlinked.length, 0, 'unlinked without the flag')
  const sup = (r) => r.families.water.supply
  if (JSON.stringify(sup(pooled)) === JSON.stringify(sup(linked))) {
    throw new Error('the unlinked tank still changed the water supply')
  }
  const alone = runG({ ...N(['f', 'SOL-131'], ['s', 'SOL-091']), edges: g.edges, linkedOnly: true })
  eq(JSON.stringify(linked.families.water.band), JSON.stringify(alone.families.water.band), 'band')
  eq(linked.families.water.verdict, alone.families.water.verdict, 'verdict')
})

check('linked to anything counts, and one card alone is still checked', () => {
  // The link goes to a destination, which is not an engine node.
  const g = { ...N(['t', 'SOL-053'], ['s', 'SOL-094']),
    edges: [{ from: 't', to: 's' }, { from: 's', to: 'dest-home' }], linkedOnly: true }
  eq(runG(g).unlinked.length, 0, 'unlinked')
  const one = runG({ ...N(['t', 'SOL-053']), edges: [], linkedOnly: true })
  eq(one.unlinked.length, 0, 'a single card')
  const two = runG({ ...N(['t', 'SOL-053'], ['s', 'SOL-094']), edges: [], linkedOnly: true })
  eq(two.unlinked.length, 2, 'two cards, no link')
  eq(Object.keys(two.families).length, 0, 'families with nothing linked')
})

check('the older solutionIds form still works', () => {
  const a = runG(N(['n0', 'SOL-053'], ['n1', 'SOL-094'])).families.water
  const b = assess({ solutionIds: ['SOL-053', 'SOL-094'] }, BASE, data).families.water
  near(a.band[0], b.band[0], 'low')
  near(a.band[1], b.band[1], 'high')
})

// --- drinking water (C10): one pool of litres, and a check on what the links make drinkable ------
const linked = (pairs, edges, over = {}) => runG({ ...N(...pairs),
  edges: edges.map(([from, to, ...ios]) => ({ from, to, ios })), linkedOnly: true }, over)
const BIG = { catchmentArea: 400 }

check('a fed filter with its output linked to nothing is flagged and not counted', () => {
  // Eric, 2026-11-02: it makes drinking water, but it is not assumed to reach the people.
  const r = linked([['r', 'SOL-053'], ['f', 'SOL-131'], ['t', 'SOL-216']],
    [['r', 'f', 'IO-16'], ['r', 't', 'IO-16']], BIG)
  const w = r.families.water
  eq(w.drinking.state, 'unused', 'state')
  eq(w.drinking.nodeId, 'f', 'the filter is named')
  has(w.reasons, REASON.DRINKING_UNUSED, 'reasons')
  if (w.verdict === VERDICT.GREEN) throw new Error('water read as covered with no drinking water used')
  eq(moveFor('water', w, r, BASE).kind, 'link-drinking', 'the move')
  const done = linked([['r', 'SOL-053'], ['f', 'SOL-131'], ['t', 'SOL-216']],
    [['r', 'f', 'IO-16'], ['r', 't', 'IO-16'], ['f', 'dest-home', 'IO-09']], BIG).families.water
  eq(done.drinking.state, 'ok', 'linked to the humans in the home')
  hasNot(done.reasons, REASON.DRINKING_UNUSED, 'reasons once linked')
})

check('a filter nothing feeds makes no drinking water, though the same system has rain', () => {
  const w = linked([['r', 'SOL-053'], ['t', 'SOL-216'], ['f', 'SOL-131']],
    [['r', 't', 'IO-16'], ['f', 'dest-home', 'IO-09']], BIG).families.water
  eq(w.drinking.state, 'none', 'state')
  has(w.reasons, REASON.NO_DRINKING, 'reasons')
  if (w.verdict === VERDICT.GREEN) throw new Error('water read as covered with nothing drinkable')
})

check('a card with no raw alternative, fed by nothing, asks for drinking water', () => {
  const w = linked([['r', 'SOL-053'], ['t', 'SOL-216'], ['d', 'SOL-227'], ['s', 'SOL-153']],
    [['r', 't', 'IO-16'], ['d', 's', 'IO-10']], BIG).families.water
  eq(w.drinking.state, 'none', 'state')
})

check('a rain-fed toilet opens no drinking-water need', () => {
  const w = linked([['r', 'SOL-053'], ['t', 'SOL-216']], [['r', 't', 'IO-16']], BIG).families.water
  eq(w.drinking, null, 'nothing asks for drinking water')
  eq(w.householdDemands.length, 0, 'no household need opened')
})

check('rain on a heater opens no drinking-water need either', () => {
  const w = linked([['r', 'SOL-053'], ['h', 'SOL-059']], [['r', 'h', 'IO-16']], BIG).families.water
  eq(w.householdDemands.length, 0, 'no household need opened')
})

check('a tank or a pump cannot launder raw water into drinking water', () => {
  const w = linked([['r', 'SOL-053'], ['k', 'SOL-055'], ['p', 'SOL-058']],
    [['r', 'k', 'IO-16'], ['k', 'p', 'IO-16'], ['p', 'dest-home', 'IO-09']], BIG).families.water
  eq(w.drinking.state, 'none', 'state')
  const { out } = waterQualities(N(['f', 'SOL-131'], ['p', 'SOL-058'], ['r', 'SOL-053']).nodes,
    [{ from: 'r', to: 'f', ios: ['IO-16'] }, { from: 'f', to: 'p', ios: ['IO-09'] }], solById)
  eq(out.get('p').drinking, true, 'drinking water stays drinking through a pump')
  eq(out.get('p').raw, false, 'and is not raw')
})

check('a pass-through alone does not count as using drinking water', () => {
  const w = linked([['r', 'SOL-053'], ['f', 'SOL-131'], ['p', 'SOL-058']],
    [['r', 'f', 'IO-16'], ['f', 'p', 'IO-09']], BIG).families.water
  eq(w.drinking.state, 'unused', 'the pump passes it to nothing')
  eq(w.drinking.nodeId, 'p', 'the loose end is named')
})

check('the mains is drinking water, and off it is not', () => {
  const on = linked([['m', 'SOL-195'], ['t', 'SOL-216']], [['m', 't', 'IO-09']])
  eq(on.families.water.verdict, VERDICT.SUPPLIED, 'supplied')
  eq(on.families.water.drinking, null, 'no check over a supplied state')
  const off = linked([['m', 'SOL-195'], ['t', 'SOL-216']], [['m', 't', 'IO-09']], { mainsOff: true })
  eq(off.families.water.drinking.state, 'none', 'mains off')
})

check('raw water warns on a shower or basin, straight or through a heater; drinking water does not', () => {
  const flagged = (pairs, edges) => [...rawWaterWarnings(N(...pairs).nodes,
    edges.map(([from, to, ...ios]) => ({ from, to, ios })), solById).keys()].join()
  eq(flagged([['r', 'SOL-053'], ['s', 'SOL-091']], [['r', 's', 'IO-16']]), 's', 'rain on a shower')
  eq(flagged([['r', 'SOL-053'], ['s', 'SOL-199']], [['r', 's', 'IO-16']]), 's', 'rain on a basin')
  eq(flagged([['r', 'SOL-053'], ['h', 'SOL-059'], ['s', 'SOL-091']], [['r', 'h', 'IO-16'], ['h', 's', 'IO-17']]), 's', 'through a heater')
  eq(flagged([['r', 'SOL-053'], ['f', 'SOL-131'], ['s', 'SOL-091']], [['r', 'f', 'IO-16'], ['f', 's', 'IO-09']]), '', 'filtered')
  eq(flagged([['m', 'SOL-195'], ['h', 'SOL-059'], ['s', 'SOL-091']], [['m', 'h', 'IO-09'], ['h', 's', 'IO-17']]), '', 'mains through a heater')
  eq(flagged([['r', 'SOL-053'], ['k', 'SOL-055'], ['s', 'SOL-091']], [['r', 'k', 'IO-16'], ['k', 's', 'IO-16']]), 's', 'through a tank')
})

check('raw water beside treated water names the untreated one (a user, 2026-11-03)', () => {
  // A misting shower on the mains and on a stove coil fed with rain: only the coil is untreated.
  const w = (pairs, edges) => rawWaterWarnings(N(...pairs).nodes,
    edges.map(([from, to, ...ios]) => ({ from, to, ios })), solById).get('s')
  const both = w([['m', 'SOL-195'], ['r', 'SOL-053'], ['c', 'SOL-178'], ['s', 'SOL-230']],
    [['m', 's', 'IO-09'], ['r', 'c', 'IO-16'], ['c', 's', 'IO-17']])
  eq(both.from.join(), 'c', 'the coil, not the mains')
  eq(both.mixed, true, 'treated water arrives too')
  eq(w([['r', 'SOL-053'], ['c', 'SOL-178'], ['s', 'SOL-230']], [['r', 'c', 'IO-16'], ['c', 's', 'IO-17']]).mixed, false, 'coil alone')
})

check('every card that takes raw water can also run on the mains, treatment aside', () => {
  const treatment = new Set(['SOL-056', 'SOL-131', 'SOL-148', 'SOL-219'])
  for (const s of data.solutions) {
    if (!(s.inputs || []).some((i) => i.io === 'IO-16')) continue
    const takes = (s.inputs || []).some((i) => i.io === 'IO-09')
    if (treatment.has(s.id) ? takes : !takes) throw new Error(s.id + ' ' + (takes ? 'should take raw only' : 'cannot run on the mains'))
    if (!treatment.has(s.id) && !(s.input_groups || []).some((g) => g.includes('IO-16') && g.includes('IO-09'))) {
      throw new Error(s.id + ' would ask for both raw and drinking water')
    }
  }
  const mains = data.solutions.find((s) => s.id === 'SOL-195')
  eq(mains.outputs.map((o) => o.io).join(), 'IO-09', 'the mains gives drinking water only')
})

// --- every reason the engine can emit must be sayable, in both languages -----
// The engine emits codes and the strings files say them, and nothing connected the
// two: `not-a-flow` shipped with no sentence, so the panel silently dropped a reason
// that does fire, while `dry-year-binds` sat declared and never emitted. Neither was
// visible by reading either file alone.
check('every reason code has a string in both languages, and none is orphaned', () => {
  const codes = Object.values(REASON)
  const missEn = codes.filter((c) => !uiEn.adequacy.reasons[c])
  const missFr = codes.filter((c) => !uiFr.adequacy.reasons[c])
  const orphan = Object.keys(uiEn.adequacy.reasons).filter((k) => !codes.includes(k))
  if (missEn.length) throw new Error('no English string for: ' + missEn.join(', '))
  if (missFr.length) throw new Error('no French string for: ' + missFr.join(', '))
  if (orphan.length) throw new Error('string with no matching code: ' + orphan.join(', '))
})

check('every verdict and scale input the engine can produce is sayable', () => {
  for (const v of Object.values(VERDICT)) {
    if (!uiEn.adequacy.verdicts[v]) throw new Error('no English verdict label for ' + v)
    if (!uiFr.adequacy.verdicts[v]) throw new Error('no French verdict label for ' + v)
  }
  const inputs = new Set(data.bases.map((b) => b.scale_input).filter((x) => x && x !== 'none'))
  for (const i of inputs) {
    if (!uiEn.adequacy.inputs[i]) throw new Error('no English label for scale input ' + i)
    if (!uiFr.adequacy.inputs[i]) throw new Error('no French label for scale input ' + i)
  }
})

console.log(`\n${pass}/${pass + fails.length} adequacy checks pass.`)
console.log('  NOT checked here: whether any coefficient is TRUE, whether a RATIO chain')
console.log('  would change a verdict where two consumers share one pool, or anything about the UI.')
if (fails.length) {
  console.log('\nFAILURES:')
  for (const [label, msg] of fails) console.log(`  - ${label}: ${msg}`)
  process.exit(1)
}
