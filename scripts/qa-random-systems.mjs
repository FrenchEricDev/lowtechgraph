/**
 * Random systems (Eric, 2026-10-30): not a regression test but a way to challenge the system check.
 * Builds systems the way a reader might, some with every input filled, some half done, runs the
 * same engine and next-move logic as the panel, and prints each result to be read and argued with.
 * Run on demand, not in the build:
 *
 *   node scripts/qa-random-systems.mjs [seed] [systems] [out.json] [extra-coefficients.json]
 *
 * The same seed gives the same systems, so a fix can be compared before and after. A last argument
 * adds draft coefficients, to see what figures under review would change. The sense rules at the end
 * fail the run: they hold for any system, however odd.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { assess, lessUsing, DEFAULT_SCENARIO } from '../src/adequacy/engine.js'
import { moveFor, rankSupply, USED_WATER } from '../src/adequacy/moves.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(resolve(HERE, '../src/data/catalogue.json'), 'utf8'))
const [seedArg, countArg, outPath, extraPath] = process.argv.slice(2)
if (extraPath) data.coefficients = data.coefficients.concat(JSON.parse(readFileSync(extraPath, 'utf8')))

let seed = Number(seedArg || 1)
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
const pick = (a) => a[Math.floor(rnd() * a.length)]
const sols = data.solutions
const byId = Object.fromEntries(sols.map((s) => [s.id, s]))
const ioName = Object.fromEntries(data.io_types.map((t) => [t.id, t.name]))
const free = new Set([...(data.natural_resources || []), ...(data.household_sources || [])].map((n) => n.io))
const makers = {}, users = {}
for (const s of sols) {
  for (const o of s.outputs || []) (makers[o.io] ||= []).push(s)
  for (const i of s.inputs || []) (users[i.io] ||= []).push(s)
}
const depts = data.departments.departments
const withFigure = new Set(data.coefficients.map((c) => c.solution_id))

function build(mode) {
  const nodes = [], edges = []
  const add = (s) => { const id = `n${nodes.length}`; nodes.push({ id, sol: s.id, s }); return id }
  // Gives every input of this card somewhere to come from, as far down as `depth`.
  const fill = (id, s, depth) => {
    for (const i of s.inputs || []) {
      if (free.has(i.io)) { edges.push({ from: 'res-' + i.io, to: id, ios: [i.io] }); continue }
      if (depth <= 0 || !makers[i.io]) continue
      const have = nodes.find((n) => n.s.outputs?.some((o) => o.io === i.io) && n.id !== id)
      if (have) { edges.push({ from: have.id, to: id, ios: [i.io] }); continue }
      const opts = makers[i.io].filter((m) => !nodes.some((n) => n.sol === m.id))
      if (!opts.length) continue
      const m = pick(opts), mid = add(m)
      edges.push({ from: mid, to: id, ios: [i.io] })
      fill(mid, m, depth - 1)
    }
  }
  const start = pick(sols.filter((s) => (s.inputs || []).length && withFigure.has(s.id)))
  const id0 = add(start)
  fill(id0, start, mode === 'complete' ? 4 : 1)
  let cur = id0, curS = start, steps = Math.floor(rnd() * (mode === 'complete' ? 3 : 5))
  while (steps-- > 0) {
    const opts = (curS.outputs || []).flatMap((o) => (users[o.io] || [])
      .filter((c) => !nodes.some((n) => n.sol === c.id)).map((c) => [o.io, c]))
    if (!opts.length) break
    const [via, nx] = pick(opts), nid = add(nx)
    edges.push({ from: cur, to: nid, ios: [via] })
    if (mode === 'complete') fill(nid, nx, 2)
    cur = nid; curS = nx
  }
  return { nodes, edges }
}

const describe = (m, placed) => {
  if (!m) return null
  const name = (id) => byId[id]?.name || id
  switch (m.kind) {
    case 'supply': {
      const offers = rankSupply(sols.filter((c) => !placed.has(c.id)), m.io, data)
      return { text: `supply ${ioName[m.io]} to ${name(m.solutionId)}: ${offers.map((o) => o.name).join(' | ') || 'NOTHING TO OFFER'}`, offers, io: m.io }
    }
    case 'use': return { text: `add something that uses ${ioName[m.io]} from ${name(m.solutionId)}` }
    case 'stream': return { text: 'give the stream\'s flow' }
    case 'reveal': return { text: `show ${name(m.solutionId)}` }
    case 'fuel': return { text: `enter ${ioName[m.io]}` }
    case 'parallel': return { text: `another ${name(m.solutionId)} side by side` }
    case 'field': return { text: `raise ${m.input}` }
    case 'compare': return { text: `compare options for ${name(m.solutionId)}` }
    case 'mains': return { text: 'try without the mains' }
    default: return { text: m.kind }
  }
}

const out = [], broken = []
const N = Number(countArg || 60)
for (let k = 0; k < N; k++) {
  const mode = k % 3 === 2 ? 'partial' : 'complete'
  const g = build(mode)
  const d = pick(depts)
  const scenario = { ...DEFAULT_SCENARIO, department: d.code, people: pick([1, 2, 2, 4, 6]),
    catchmentArea: pick([15, 40, 100, 200]), arrayKwp: pick([0.5, 1, 3, 6]), collectorArea: pick([2, 4, 8]),
    floorArea: pick([40, 100, 180]), fabricClass: pick(['', 'B', 'D', 'F']) }
  const r = assess({ nodes: g.nodes.map(({ id, sol }) => ({ id, sol })), edges: g.edges, linkedOnly: true }, scenario, data)
  const placed = new Set(g.nodes.map((n) => n.sol))
  const fams = Object.entries(r.families).filter(([, f]) => !f.byproduct).map(([fam, f]) => {
    const move = describe(moveFor(fam, f, r, scenario), placed)
    const less = ['yellow', 'red'].includes(f.verdict) ? lessUsing(f, data) : null
    // Sense rules.
    for (const o of move?.offers || []) {
      if ((o.inputs || []).some((i) => i.io === move.io)) broken.push(`#${k} offers ${o.name}, which needs the ${ioName[move.io]} it would supply`)
      if (!(o.outputs || []).some((x) => x.io === move.io)) broken.push(`#${k} offers ${o.name}, which does not make ${ioName[move.io]}`)
      if (USED_WATER.includes(move.io)) broken.push(`#${k} asks for used water as a supply`)
    }
    if (f.verdict === 'green' && f.band && f.band[0] <= 1) broken.push(`#${k} ${fam} green with a low end of ${f.band[0]}`)
    if (less && byId[less.betterId]?.subfunction_id !== byId[less.solutionId]?.subfunction_id) broken.push(`#${k} use-less crosses needs`)
    return { fam, v: f.verdict, band: f.band?.map((x) => +x.toFixed(2)), reasons: f.reasons, move: move?.text ?? null,
      less: less && `${byId[less.solutionId].name} -> ${byId[less.betterId].name} -${Math.round(less.saving * 100)}%` }
  })
  for (const n of g.nodes) if (n.sol && scenario.flow == null && fams.some((f) => f.v === 'green') && (r.scaleInputs || []).some((i) => i.startsWith('flow'))) {
    const fam = fams.find((f) => f.v === 'green' && (r.families[f.fam].rows || []).some((x) => (x.basis?.scale_input || '').startsWith('flow')))
    if (fam) broken.push(`#${k} ${fam.fam} green on a stream nobody gave`)
    break
  }
  // Water never reads as covered where the links make none of it drinkable, or leave it unused (C10).
  const dw = r.families.water?.drinking
  if (dw && dw.state !== 'ok' && r.families.water.verdict === 'green') broken.push(`#${k} water green with drinking water ${dw.state}`)
  out.push({ k, mode, dept: `${d.code} ${r.climateUsed?.station}`,
    sc: `p${scenario.people} roof${scenario.catchmentArea} kWp${scenario.arrayKwp} coll${scenario.collectorArea} ${scenario.floorArea}m2 ${scenario.fabricClass || '-'}`,
    cards: g.nodes.map((n) => n.s.name),
    unfed: (r.unfed || []).map((u) => `${byId[u.solutionId].name}<-${ioName[u.io]}`), fams })
}
if (outPath) writeFileSync(outPath, JSON.stringify(out, null, 1))

const v = {}, noMove = {}, kinds = {}
let total = 0, silent = 0, silentOpen = 0
for (const s of out) {
  if (!s.fams.length) { silent++; if (s.unfed.length) silentOpen++ }
  for (const f of s.fams) {
    total++; v[f.v] = (v[f.v] || 0) + 1
    if (f.v !== 'green' && !f.move) for (const x of f.reasons || []) noMove[x] = (noMove[x] || 0) + 1
    if (f.v !== 'green' && !f.move) kinds.none = (kinds.none || 0) + 1
  }
}
if (!outPath) {
  for (const s of out) {
    console.log(`\n#${s.k} ${s.mode} ${s.dept} ${s.sc}\n  ${s.cards.join(' + ')}${s.unfed.length ? '\n  OPEN: ' + s.unfed.join('; ') : ''}`)
    for (const f of s.fams) console.log(`   ${f.fam}: ${f.v} ${f.band ? f.band.join('-') : ''} [${(f.reasons || []).join(',')}] -> ${f.move}${f.less ? ' | LESS ' + f.less : ''}`)
  }
}
console.log(JSON.stringify({ systems: out.length, verdicts: total, ...v, noNextStep: kinds.none || 0, silent, silentOpen, noMoveReasons: noMove }))
if (broken.length) {
  console.log(`${broken.length} sense rule(s) broken:\n  ` + [...new Set(broken)].slice(0, 30).join('\n  '))
  process.exitCode = 1
} else console.log('sense rules hold')
