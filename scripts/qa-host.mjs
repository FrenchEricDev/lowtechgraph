/**
 * The host-attachment rule, checked against the catalogue rather than the UI.
 *
 * Some solutions are built INTO a specific appliance: a coil around a stove's flue,
 * a coil through a compost pile, a basin on a WC cistern. Unlike pressure, which any
 * ANCESTOR can satisfy, a host must be the DIRECT producer. Raised by Eric
 * 2026-09-02, after finding the flue coil could be wired to an induction cooktop.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import uiEn from '../src/ui-strings.js'
import uiFr from '../src/ui-strings.fr.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(resolve(HERE, '../src/data/catalogue.json'), 'utf8'))
const by = Object.fromEntries(data.solutions.map((s) => [s.id, s]))

let pass = 0
const fails = []
const check = (label, fn) => {
  try { fn(); pass += 1; console.log('  PASS  ' + label) }
  catch (e) { fails.push([label, e.message]); console.log('  FAIL  ' + label + '\n          ' + e.message) }
}

console.log('\nhost attachment\n')

check('every host requirement has at least one provider', () => {
  const provides = new Set(data.solutions.map((s) => s.host_provides).filter(Boolean))
  for (const s of data.solutions.filter((x) => x.host_required)) {
    if (!provides.has(s.host_required)) {
      throw new Error(`${s.id} requires ${s.host_required}, which nothing provides`)
    }
  }
})

check('every host kind has a message in both languages', () => {
  const kinds = new Set(data.solutions.flatMap((s) => [s.host_provides, s.host_required]).filter(Boolean))
  for (const k of kinds) {
    if (!uiEn.treeNode.hostWarning[k]) throw new Error('no English message for ' + k)
    if (!uiFr.treeNode.hostWarning[k]) throw new Error('no French message for ' + k)
  }
  for (const k of Object.keys(uiEn.treeNode.hostWarning)) {
    if (!kinds.has(k)) throw new Error('message for a host kind nothing uses: ' + k)
  }
})

// Input via (2026-09-25): a named resource must come in straight from a row providing a kind.
check('every input-via kind has a provider, a message, and names a real input', () => {
  const provides = new Set(data.solutions.map((s) => s.host_provides).filter(Boolean))
  for (const s of data.solutions) {
    for (const [io, kind] of Object.entries(s.input_via || {})) {
      if (!provides.has(kind)) throw new Error(`${s.id} wants ${io} via ${kind}, which nothing provides`)
      if (!uiEn.treeNode.hostWarning[kind] || !uiFr.treeNode.hostWarning[kind]) throw new Error(`no message for ${kind}`)
      if (!(s.inputs || []).some((i) => i.io === io)) throw new Error(`${s.id} wants ${io} via ${kind} but does not take ${io}`)
    }
  }
})

check('greywater reaches both toilets only through a diversion, and each diversion delivers greywater', () => {
  for (const id of ['SOL-070', 'SOL-216']) {
    if ((by[id].input_via || {})['IO-10'] !== 'greywater-diversion') throw new Error(`${id} lost its greywater rule`)
  }
  for (const id of ['SOL-153', 'SOL-199']) {
    const s = by[id]
    if (s.host_provides !== 'greywater-diversion') throw new Error(`${id} no longer provides the diversion`)
    if (!(s.outputs || []).some((o) => o.io === 'IO-10')) throw new Error(`${id} no longer outputs greywater`)
  }
})

// Every appliance that sends heat up a flue offers that flue to a coil (2026-09-25: the pellet
// stove, added the day before, was missing from the flue coil's "Fix it" list).
check('every producer of flue gas heat offers a flue', () => {
  for (const s of data.solutions) {
    if ((s.outputs || []).some((o) => o.io === 'IO-42') && s.host_provides !== 'combustion-flue') {
      throw new Error(`${s.id} (${s.name}) produces flue gas heat but offers no flue`)
    }
  }
})

check('nothing both provides and requires the same host', () => {
  for (const s of data.solutions) {
    if (s.host_provides && s.host_provides === s.host_required) {
      throw new Error(`${s.id} provides and requires ${s.host_provides}`)
    }
  }
})

check('the cases Eric named are now invalid, and the valid ones still are', () => {
  const coil = by['SOL-178']
  if (coil.host_required !== 'combustion-flue') throw new Error('flue coil lost its requirement')
  const bad = ['SOL-191', 'SOL-163', 'SOL-090', 'SOL-169', 'SOL-213', 'SOL-162']
  for (const id of bad) {
    if (by[id].host_provides === 'combustion-flue') {
      throw new Error(`${id} (${by[id].name}) should not offer a flue`)
    }
  }
  const good = ['SOL-030', 'SOL-089', 'SOL-126', 'SOL-136', 'SOL-180']
  for (const id of good) {
    if (by[id].host_provides !== 'combustion-flue') {
      throw new Error(`${id} (${by[id].name}) should offer a flue`)
    }
  }
})

check('a host requirement is not satisfiable by a distant ancestor', () => {
  // Documents the rule the UI check must implement: DIRECT producer only. If this
  // ever needs relaxing it is a deliberate decision, not a quiet one.
  const coil = by['SOL-178']
  const stove = by['SOL-030']
  if (!stove.host_provides || !coil.host_required) throw new Error('fixture rows changed')
  if (stove.host_provides !== coil.host_required) throw new Error('stove no longer hosts the coil')
})

console.log(`\n${pass}/${pass + fails.length} host checks pass.`)
console.log('  NOT checked here: whether the flue judgement is RIGHT for any given stove,')
console.log('  which is a question about appliances, not about data.')
if (fails.length) {
  console.log('\nFAILURES:')
  for (const [l, m] of fails) console.log(`  - ${l}: ${m}`)
  process.exit(1)
}
