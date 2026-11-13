import { useEffect, useMemo, useRef, useState } from 'react'

import { fill, ui as strings } from '../ui-strings'
import { assess, lessUsing, DEFAULT_SCENARIO, FAMILIES } from './engine.js'
import { moveFor, USED_WATER } from './moves.js'
import useDialog from '../useDialog'
import Glyph from '../Glyph.jsx'
import { calm } from '../motion.js'
import { copyText, FEEDBACK_EMAIL, sendFeedback } from '../platform'
import { SCENARIO_KEY } from '../treeStore'

/*
 * "Could this work out?" (brief 04, second design, agreed by Eric 2026-10-18). Docked beside the
 * canvas on a desktop, a sheet over its lower part on a phone, so the system stays in view. In
 * the order of importance Eric set, carried by size and weight as well as position:
 *   1. the verdict per resource, in words with its mark, and one sentence in the reader's terms;
 *   2. the one next move the site can point to (B17), as an action;
 *   3. what was counted, and what was not and why, in one quiet line;
 *   4. "How this was worked out": the balance, what makes up each side, why it is a range, what
 *      was assumed, the sources. Behind a disclosure, never in view by default.
 * Above all four, the reader's situation: every setting the figures depend on, unset ones in
 * grey, so the inputs come before the answer (Eric, 2026-11-06).
 * Numbers come from engine.js, sentences from ui-strings; the engine is unchanged.
 */

// Winter, then summer, then every other advisory IO in catalogue order.
const ADVISORY_HEAD = ['IO-46', 'IO-47']
const advisoryOrder = (rows) => {
  const seen = []
  for (const r of rows) for (const io of r.ios) if (!seen.includes(io)) seen.push(io)
  return [...ADVISORY_HEAD.filter((io) => seen.includes(io)),
          ...seen.filter((io) => !ADVISORY_HEAD.includes(io)).sort()]
}

// By number; Corsica's 2A and 2B fall between 19 and 21, where French lists put them.
const codeOrder = (code) => (code === '2A' ? 20 : code === '2B' ? 20.5 : Number(code))
const byCode = (list) => [...list].sort((a, b) => codeOrder(a.code) - codeOrder(b.code))

// Number fields: the scenario key, the range and the step of the − / + buttons.
const FIELDS = {
  'people': { key: 'people', min: 1, max: 12, step: 1 },
  'catchment-area': { key: 'catchmentArea', min: 5, max: 400, step: 5 },
  'collector-area': { key: 'collectorArea', min: 1, max: 60, step: 1 },
  'array-kwp': { key: 'arrayKwp', min: 0.2, max: 20, step: 0.2 },
  'head': { key: 'head', min: 1, max: 200, step: 1 },
  'flow': { key: 'flow', min: 0.001, max: 2, step: 0.001 },
  'flow+head': { key: 'flow', min: 0.001, max: 2, step: 0.001 },
  'feedstock': { key: 'feedstock', min: 0, max: 5000, step: 25 },
}
// A hydro figure needs both numbers: its one scale input is two fields.
const fieldsFor = (inputs) => [...new Set(inputs.flatMap((i) => (i === 'flow+head' ? ['flow+head', 'head'] : [i])))]

function loadScenario() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SCENARIO_KEY) || 'null')
    return raw && typeof raw === 'object' ? { ...DEFAULT_SCENARIO, _set: [], ...raw } : { ...DEFAULT_SCENARIO, _set: [] }
  } catch {
    return { ...DEFAULT_SCENARIO, _set: [] }
  }
}

const fr = () => document.documentElement.lang === 'fr'
// A decimal comma in French, as everywhere else on a French page.
const fmt = (n) => {
  const v = n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100
  return fr() ? String(v).replace('.', ',') : v
}
const days = (t, n) => {
  const v = Math.round(n)
  return `${v} ${v >= t.dayPluralFrom ? t.dayMany : t.dayOne}`
}
const WORKING_REMARK = /20\d\d-\d\d-\d\d|\bEric\b|\bearlier draft\b/
// Units and bases are written in English in the workbook; the strings translate them by key.
const unitOf = (u) => strings.adequacy.unitNames[u] || u
const basisOf = (b) => strings.adequacy.basisNames[b] || b
const readerText = (s) => String(s || '')
  .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
  .filter((part) => !WORKING_REMARK.test(part))
  .join(' ')

/*
 * A share of the demand in plain words, rounded DOWN (Eric, 2026-10-20: err on the side of
 * caution): under one, a quarter, a third, half, three quarters; from one, "as much as", then
 * "1.5 times", "twice"… in half units.
 */
const amount = (c, r) => {
  if (r < 0.25) return c.amounts.little
  if (r < 1 / 3) return c.amounts.quarter
  if (r < 0.5) return c.amounts.third
  if (r < 0.75) return c.amounts.half
  if (r < 1) return c.amounts.threeQuarters
  if (r < 1.5) return c.amounts.same
  if (r < 2.5 && r >= 2) return c.amounts.twice
  return fill(c.amounts.times, { n: fmt(Math.floor(r * 2) / 2) })
}

// "a, b and c"
const listOf = (c, xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${c.and} ${xs[xs.length - 1]}`)

// Worst first: unlikely, not enough to say, either way, likely, from the mains.
const ORDER = { red: 0, grey: 1, yellow: 2, green: 3, supplied: 4 }
// The reasons that say why the figure is a range, for the working.
const RANGE_REASONS = ['behaviour-widens', 'bases-unioned', 'basis-set-aside', 'monthly-is-p2', 'monthly-one-source', 'worst-month-binds']

function Mark({ verdict }) {
  const name = verdict === 'green' ? 'check' : verdict === 'red' ? 'close' : verdict === 'yellow' ? 'warning' : verdict === 'supplied' ? 'plug' : 'info'
  return <span className={`adq-mark adq-${verdict}`} aria-hidden="true"><Glyph name={name} size={16} /></span>
}

// Above this a mail link can be cut short by the browser or the mail program.
const MAIL_DETAILS_MAX = 1500

export default function AdequacyPanel({ graph, data, ui, nameOf, ioNameOf, onClose, onReveal, supplyOptions, compareFor, go, nodeSolution, onParallel, onChain, onTryOthers, systemLink }) {
  const t = ui.adequacy
  const c = t.check
  const [scenario, setScenario] = useState(loadScenario)
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState({})          // family -> its row is unfolded (five-family case)
  const [worked, setWorked] = useState({})      // family -> its working is open
  const [picking, setPicking] = useState(null)  // "nodeId|io" whose supply options are listed
  const [typing, setTyping] = useState(false)   // a field has focus: verdicts fold to one line
  const [closing, setClosing] = useState(false)
  const [draft, setDraft] = useState({})        // a field's text while it is being typed
  const [report, setReport] = useState(null)    // what a report sent, for when no email opens
  const [reportCopied, setReportCopied] = useState(false)
  const box = useDialog(() => close(), '.tree-verdict')

  useEffect(() => {
    try { sessionStorage.setItem(SCENARIO_KEY, JSON.stringify(scenario)) } catch { /* the panel still works */ }
  }, [scenario])

  // Shrinks back into its button (brief 13: 150 ms); at once under reduced motion.
  const close = () => {
    const still = calm()
    if (still) { onClose(); return }
    setClosing(true)
    setTimeout(onClose, 150)
  }
  // One docked panel at a time: Settings opening closes the check (cross-check).
  useEffect(() => {
    const on = () => onClose()
    window.addEventListener('lowtech:panel', on)
    return () => window.removeEventListener('lowtech:panel', on)
  }, [onClose])

  // Outside France, the country's regions come from its own file, fetched when it is picked
  // (TODO C9); the service worker keeps it for offline use.
  const [world, setWorld] = useState(null)      // { country, regions } for scenario.country
  const abroad = scenario.country && scenario.country !== 'FR' ? scenario.country : null
  useEffect(() => {
    if (!abroad || (world && world.country === abroad)) return undefined
    let live = true
    fetch(`/climate/${abroad}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setWorld(j) })
      .catch(() => { if (live) setWorld(null) })
    return () => { live = false }
  }, [abroad, world])
  // Before a region is chosen, the country's default one (its biggest town's), never Caen.
  const regionRow = abroad && world && world.country === abroad
    ? world.regions.find((r) => r.id === (scenario.region || world.default)) || null : null
  const checked = useMemo(() => (regionRow ? { ...data, region: regionRow } : data), [data, regionRow])
  const result = useMemo(() => assess(graph, scenario, checked), [graph, scenario, checked])
  const set = (key, value) => setScenario((s) => ({ ...s, [key]: value, _set: [...new Set([...(s._set || []), key])] }))
  const isSet = (key) => (scenario._set || []).includes(key)

  const all = Object.entries(result.families)
  const families = all.filter(([, f]) => !f.byproduct).sort((a, b) => ORDER[a[1].verdict] - ORDER[b[1].verdict])
  const spares = all.filter(([, f]) => f.byproduct && f.spare)
  const advisory = result.advisory || []
  const departments = (data.departments && data.departments.departments) || []
  const town = (result.climateUsed && result.climateUsed.station) || 'Caen'
  // Every country with a finished file, France among them, in the reader's language and order.
  const countries = useMemo(() => {
    const lang = fr() ? 'fr' : 'en'
    let names
    try { names = new Intl.DisplayNames([lang], { type: 'region' }) } catch { names = null }
    const nameOf = (code) => (code === 'FR' ? c.countryFrance : (names && names.of(code)) || code)
    const codes = ['FR', ...((data.world && data.world.countries) || []).filter((x) => x.complete).map((x) => x.code)]
    return codes.map((code) => ({ code, name: nameOf(code) })).sort((a, b) => a.name.localeCompare(b.name, lang))
  }, [data.world, c.countryFrance])
  const regionList = abroad && world && world.country === abroad
    ? [...world.regions].sort((a, b) => a.name.localeCompare(b.name)) : []

  // What changed after an input: a tag held 1.5 s, and one polite status (A-A2). A range that
  // moves inside an unchanged verdict says so too (Mo-F2): the figures themselves never animate.
  const prev = useRef(null)
  const [changed, setChanged] = useState({})
  const [said, setSaid] = useState('')
  useEffect(() => {
    const rangeOf = (f) => (f.band ? f.band.map((x) => x.toFixed(2)).join('-') : '')
    const now = Object.fromEntries(families.map(([fam, f]) => [fam, { v: f.verdict, r: rangeOf(f) }]))
    if (prev.current) {
      const was = prev.current
      const moved = Object.keys(now).filter((k) => was[k] && was[k].v !== now[k].v)
      const shifted = Object.keys(now).filter((k) => was[k] && was[k].v === now[k].v && was[k].r !== now[k].r)
      if (moved.length || shifted.length) {
        setChanged(Object.fromEntries([...moved.map((k) => [k, c.changed]), ...shifted.map((k) => [k, c.rangeMoved])]))
        setSaid([...moved.map((k) => fill(c.statusChanged, { family: t.families[k] || k, verdict: t.verdicts[now[k].v] })),
                 ...shifted.map((k) => fill(c.statusMoved, { family: t.families[k] || k, verdict: t.verdicts[now[k].v] }))].join('. '))
        const id = setTimeout(() => setChanged({}), 1500)
        prev.current = now
        return () => clearTimeout(id)
      }
    }
    prev.current = now
    return undefined
  }, [families.map(([k, f]) => k + f.verdict + (f.band || []).map((x) => x.toFixed(2))).join('|')])  // eslint-disable-line react-hooks/exhaustive-deps

  // The cards that could supply a family but are not linked: their outputs are in it.
  // Dirty water is in the water family but supplies nobody: a toilet is no answer to "no water".
  const unlinkedSuppliers = (fam) => result.unlinked
    .filter((u) => (nodeSolution(u.nodeId)?.outputs || []).some((o) => (FAMILIES[fam] || []).includes(o.io) && !USED_WATER.includes(o.io)))

  // Level 1's sentence, in the reader's terms (J-F5).
  const sentence = (fam, f) => {
    const period = f.binding === 'worst-month' ? c.periodWorstMonth : c.periodAnnual
    if (f.verdict === 'supplied') return c.supplied
    if (f.verdict === 'green') return fill(c.green, { period })
    if (f.drinkingCapped) return f.drinking.state === 'unused' ? fill(c.drinkingUnused, { name: nameOf(f.drinking.solutionId) }) : c.noDrinking
    // The step that limits the flow is the most important reason when there is one: named first.
    const step = f.clampedBy && f.clampedBy.length ? listOf(c, f.clampedBy.map(nameOf)) : null
    if (step && (f.verdict === 'yellow' || f.verdict === 'red')) return fill(c.clamped, { step })
    if (f.verdict === 'yellow' && f.band) return fill(c.yellow, { period, low: amount(c, f.band[0]), high: amount(c, f.band[1]) })
    if (f.verdict === 'red' && f.band) return fill(c.red, { period, high: amount(c, f.band[1]) })
    const r = new Set(f.reasons)
    if (r.has('missing-scenario') && moveFor(fam, f, result, scenario)?.kind === 'stream') return c.greyStream
    if (r.has('no-supply')) {
      const u = unlinkedSuppliers(fam)
      return u.length ? fill(c.greyCouldSupply, { name: nameOf(u[0].solutionId) }) : c.greyNoSupply
    }
    // A placed card with no figure is why it cannot be worked out: name it.
    // A card that only passes the resource along (a cistern, a water heater) is not what is missing:
    // the source is named first.
    const noFigure = (f.uncounted || []).filter((u) => u.why === 'no-figure')
    const sources = noFigure.filter((u) => !(nodeSolution(u.nodeId)?.inputs || []).some((i) => (FAMILIES[fam] || []).includes(i.io)))
    const bare = [...new Set((sources.length ? sources : noFigure).map((u) => nameOf(u.solutionId)))]
    if (bare.length) return fill(c.greyNoFigure, { list: listOf(c, bare) })
    if (r.has('fuel-needed')) return c.greyFuel
    const stuck = [...new Set((f.uncounted || []).filter((u) => u.why === 'ratio-no-input').map((u) => nameOf(u.solutionId)))]
    if (stuck.length) return fill(c.greyStarved, { list: listOf(c, stuck) })
    if (r.has('no-demand')) return c.greyNoDemand
    return c.greyOther
  }

  // A reader doubts the result (Eric, 2026-11-02): an email to us holding what reproduces it.
  const sendReport = async () => {
    const url = await systemLink(scenario)
    const facts = {
      verdicts: families.map(([fam, f]) => `${t.families[fam] || fam}: ${t.verdicts[f.verdict]}`).join('; '),
      settings: (scenario._set || []).map((k) => `${k} ${JSON.stringify(scenario[k])}`).join('; ') || c.reportDefaults,
    }
    const details = fill(c.reportDetails, { url, ...facts })
    const long = encodeURIComponent(details).length > MAIL_DETAILS_MAX
    if (long) await copyText(url)
    sendFeedback(c.reportSubject, `${c.reportAsk}\n\n\n\n${long ? fill(c.reportDetails, { url: c.reportPasteLink, ...facts }) : details}`)
    setReportCopied(false)
    setReport({ details, long })
  }

  // Level 2: the one move (B17). Each returns { label, run, kind }.
  const fieldRef = useRef({})
  const nextMove = (fam, f) => {
    const m = moveFor(fam, f, result, scenario, unlinkedSuppliers)
    if (!m) return null
    switch (m.kind) {
      case 'mains': return { label: scenario.mainsOff ? c.nextMainsOn : c.nextMainsOff, run: () => set('mainsOff', !scenario.mainsOff) }
      case 'stream': return { label: c.nextStream, run: () => fieldRef.current[m.input]?.focus(), kind: 'field' }
      case 'reveal': return { label: fill(c.nextReveal, { name: nameOf(m.solutionId) }), run: () => onReveal(m.nodes) }
      case 'fuel': return { label: fill(c.nextField, { field: fill(t.inputs.fuelStock, { fuel: ioNameOf(m.io), unit: '' }).replace(/\s*\(\)\s*$/, '') }), run: () => fieldRef.current['fuel-' + m.io]?.focus(), kind: 'field' }
      case 'supply': {
        const key = m.nodeId + '|' + m.io
        return supplyOptions(m.nodeId, m.io).length ? { label: c.nextSupply, run: () => setPicking(picking === key ? null : key), kind: 'pick', open: picking === key, key } : null
      }
      case 'link-drinking': return { label: c.nextDrinking, run: () => onChain(m.nodeId, m.io), kind: 'add' }
      case 'use': return { label: c.nextUse, run: () => onChain(m.nodeId, m.io), kind: 'add' }
      case 'parallel': return { label: fill(c.nextParallel, { name: nameOf(m.solutionId) }), run: () => onParallel(m.solutionId), kind: 'add' }
      case 'field': return { label: c.nextFields[m.input] || fill(c.nextField, { field: (c.labels[m.input] || m.input).toLowerCase() }), run: () => fieldRef.current[m.input]?.focus(), kind: 'field' }
      // The replace menu on the card, in the builder: the comparison page left the reader with no
      // way back to swap the card, and another solution may not fix the shortfall, so the
      // wording only offers to try (Eric, 2026-11-05).
      case 'compare': {
        const cmp = compareFor(m.solutionId)
        return cmp ? { label: fill(c.nextCompare, { need: cmp.name }), run: () => onTryOthers(m.solutionId), kind: 'swap', solutionId: m.solutionId } : null
      }
      default: return null
    }
  }

  // Level 3: what was counted, and the cards left out.
  const countedLine = (f) => {
    const ids = [...new Set((f.counted || []).map((nid) => nodeSolution(nid)?.id).filter(Boolean))]
    const names = ids.map(nameOf)
    const out = [...new Set(result.unlinked.map((u) => nameOf(u.solutionId)))]
    const parts = []
    if (names.length) parts.push(fill(c.counted, { list: listOf(c, names) }))
    if (out.length) parts.push(fill(c.notCountedLinked, { list: listOf(c, out) }))
    return parts.join(' ')
  }

  // Level 4, per family.
  const Working = ({ fam, f }) => {
    const per = f.binding === 'worst-month' ? 'month' : 'annual'
    const sup = f.supply && f.supply[per]
    const dem = f.demand && f.demand[per]
    const unit = unitOf(f.unit || '').replace(/\/(day|jour)$/, '')
    const sideOf = (row) => (row.coef && row.coef.role === 'in' ? 'use' : 'supply')
    const rows = (side) => (f.rows || []).filter((row) => sideOf(row) === side)
    const why = (f.reasons || []).filter((r) => RANGE_REASONS.includes(r)).map((r) => t.reasons[r]).filter(Boolean)
    return (
      <div className="adq-work">
        {sup && dem && (
          <section>
            <h4>{per === 'month' ? c.balanceWorst : c.balanceHeading}</h4>
            <dl className="adq-balance">
              <div><dt>{c.canSupply}</dt><dd>{fill(c.range, { low: fmt(sup[0]), high: fmt(sup[1]), unit })}</dd></div>
              <div><dt>{c.youUse}</dt><dd>{fill(c.range, { low: fmt(dem[0]), high: fmt(dem[1]), unit })}</dd></div>
            </dl>
            <p>{sup[0] > dem[1] ? c.above : sup[1] < dem[0] ? c.below : c.overlap}</p>
            {f.clampedBy && <p>{fill(c.limitedBy, { step: f.clampedBy.map(nameOf).join(', ') })}</p>}
          </section>
        )}
        {(rows('supply').length > 0 || rows('use').length > 0 || (f.householdDemands || []).length > 0) && (
          <section>
            <h4>{c.makeupHeading}</h4>
            {[['supply', c.supplySide], ['use', c.useSide]].map(([side, label]) => {
              const list = rows(side)
              const hh = side === 'use' ? (f.householdDemands || []).filter((h) => h && h.demand) : []
              if (!list.length && !hh.length) return null
              return (
                <div key={side} className="adq-side">
                  <h5>{label}</h5>
                  <ul>
                    {list.map((row, i) => (
                      <li key={row.nodeId + i}><b>{nameOf(row.solutionId)}</b> {fill(t.figureReads, { low: row.coef.low, high: row.coef.high, unit: unitOf(row.coef.unit), basis: basisOf(row.coef.basis) })}</li>
                    ))}
                    {hh.map(({ io, demand }) => (
                      <li key={io}><b>{t.householdNeed}</b> {fill(t.figureReads, { low: demand.low, high: demand.high, unit: unitOf(demand.unit), basis: ioNameOf(io) })}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </section>
        )}
        {why.length > 0 && (
          <section><h4>{c.whyRange}</h4>{why.map((w) => <p key={w}>{w}</p>)}</section>
        )}
        <section>
          <h4>{c.assumedHeading}</h4>
          <p>{[
            ...fieldsFor(result.scaleInputs).filter((i) => FIELDS[i] && scenario[FIELDS[i].key] != null).map((i) => `${c.labels[i] || i}${fr() ? ' : ' : ': '}${fmt(scenario[FIELDS[i].key])}${c.units[i] ? ' ' + c.units[i] : ''}`),
            result.climateInputs.includes('rainfall') && fill(t.dryYearValue, { pct: Math.round(scenario.dryYearFactor * 100) }),
            result.climateUsed && fill(t.climateFrom, { town }),
          ].filter(Boolean).join(' · ')}</p>
        </section>
        {(f.rows || []).length > 0 && (
          <section>
            <h4>{c.sourcesHeading}</h4>
            <ul className="adq-src">
              {f.rows.map(({ solutionId, coef }, i) => (
                <li key={solutionId + i}>
                  {coef.source_url ? <a href={coef.source_url} target="_blank" rel="noopener noreferrer">{coef.source}</a> : coef.source}
                  {' · '}{nameOf(solutionId)}{fill(t.sourceMeta, { source: '', tier: coef.tier, precision: t.precisionLabels[coef.precision] || coef.precision })}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    )
  }

  // Open inputs no verdict's move already points at, so a card with no figure still gets a word.
  const movedTo = new Set(families.map(([fam, f]) => nextMove(fam, f)?.key).filter(Boolean))
  const unfedOpen = (result.unfed || []).filter((u) => !USED_WATER.includes(u.io) && !movedTo.has(u.nodeId + '|' + u.io))
  const unfedShown = unfedOpen.slice(0, 3)
  const anyDefault = result.scaleInputs.some((i) => FIELDS[i] && !isSet(FIELDS[i].key)) || !isSet('department')
  const fold = families.length > 2
  const numberField = (input, key, unit, opts = {}) => {
    const f = FIELDS[input] || opts
    const value = opts.value ?? scenario[key]
    // No ceiling: a roof of 425 m² is reachable with + (Eric, 2026-10-20). Only the floor stops.
    const step = (dir) => {
      const v = Math.round((Number(value) + dir * f.step) / f.step) * f.step
      set(key, Math.max(f.min, Number(v.toFixed(3))))
    }
    return (
      <div key={input} className="adq-row">
        <label htmlFor={'adq-' + input}>{opts.label || c.labels[input] || input}</label>
        <div className={'adq-stepper' + (isSet(key) ? '' : ' is-default')}>
          <button type="button" aria-label={c.less} onClick={() => step(-1)}>−</button>
          <input id={'adq-' + input} ref={(el) => { fieldRef.current[input] = el }}
                 type="text" inputMode="decimal" enterKeyHint="done"
                 value={draft[key] ?? String(value ?? '')}
                 onFocus={() => setTyping(true)}
                 onBlur={() => { setTyping(false); setDraft((d) => { const n = { ...d }; delete n[key]; return n }) }}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                 // Emptied while typing, it stays empty and the verdict waits for a number; it is
                 // never read as 0 (A-A15). A decimal comma is accepted.
                 onChange={(e) => {
                   const raw = e.target.value
                   setDraft((d) => ({ ...d, [key]: raw }))
                   const n = Number(raw.replace(',', '.'))
                   if (raw.trim() !== '' && Number.isFinite(n)) set(key, n)
                 }} />
          {unit && <span className="adq-unit">{unit}</span>}
          <button type="button" aria-label={c.more} onClick={() => step(1)}>+</button>
        </div>
      </div>
    )
  }

  return (
    <div className={'adq-dock' + (closing ? ' is-closing' : '')} role="dialog" aria-modal="false"
           aria-labelledby="adq-title" tabIndex={-1} ref={box}>
      <div className="adq-head">
        <h2 id="adq-title">{t.title}</h2>
        <button type="button" className="adq-close" onClick={close}>{t.close}</button>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{said}</div>
      {families.length > 0 && anyDefault && <p className="adq-top">{c.topDefaults}</p>}

      {/* Every setting the system's figures depend on, none behind "more" (Eric, 2026-10-18).
          First, before any verdict: an answer before the reader has entered anything made no sense
          (Eric, 2026-11-06). */}
      {(result.scaleInputs.length > 0 || result.fuelInputs.length > 0 || result.fabricInputs.length > 0 ||
        result.climateInputs.length > 0 || result.hasMains) && (
        <section className="adq-situation" aria-labelledby="adq-sit">
          <h3 id="adq-sit">{c.situation}</h3>
          {fieldsFor(result.scaleInputs).map((input) => FIELDS[input] && numberField(input, FIELDS[input].key, c.units[input],
            input === 'feedstock' && result.feedstockDerived && !scenario.feedstock ? { value: result.feedstockDerived.kgPerYear } : {}))}
          {result.fabricInputs.length > 0 && (
            <>
              <div className="adq-row">
                <label htmlFor="adq-fabric">{abroad ? t.inputs.fabricClassAbroad : t.inputs.fabricClass}</label>
                <select id="adq-fabric" className={isSet('fabricClass') ? '' : 'is-default'} value={scenario.fabricClass || ''}
                        onChange={(e) => set('fabricClass', e.target.value)}>
                  <option value="">{t.inputs.fabricClassUnset}</option>
                  {/* The letter, then what it means in plain words: outside France nobody has a DPE. */}
                  {result.fabricInputs[0].classes.map((cl) => (
                    <option key={cl} value={cl}>{t.fabricWords[cl] ? `${cl} — ${t.fabricWords[cl]}` : cl}</option>
                  ))}
                </select>
              </div>
              {numberField('floorArea', 'floorArea', c.units.floorArea, { label: c.labels.floorArea, min: 10, max: 500, step: 5 })}
            </>
          )}
          {result.fuelInputs.map((fu) => (
            <div key={fu.io} className="adq-row">
              <label htmlFor={'adq-fuel-' + fu.io}>{fill(t.inputs.fuelStock, { fuel: ioNameOf(fu.io), unit: unitOf(fu.unit).replace('kWh/', '') })}</label>
              <input id={'adq-fuel-' + fu.io} ref={(el) => { fieldRef.current['fuel-' + fu.io] = el }} className="adq-num"
                     type="number" inputMode="numeric" enterKeyHint="done" min="0" step="50" placeholder="0"
                     value={(scenario.fuelStock || {})[fu.io] ?? ''}
                     onFocus={() => setTyping(true)} onBlur={() => setTyping(false)}
                     onChange={(e) => { if (e.target.value !== '') setScenario((sc) => ({ ...sc, fuelStock: { ...(sc.fuelStock || {}), [fu.io]: Number(e.target.value) } })) }} />
            </div>
          ))}
          {departments.length > 0 && (result.climateInputs.length > 0 || result.fabricInputs.length > 0) && (
            <>
              {/* Country then Region (TODO C9): French departments, elsewhere the regions in the country's file. */}
              <div className="adq-row">
                <label htmlFor="adq-country">{c.country}</label>
                <select id="adq-country" className={isSet('country') ? '' : 'is-default'} value={scenario.country || 'FR'}
                        onChange={(e) => setScenario((s) => ({ ...s, country: e.target.value, region: '',
                          _set: [...new Set([...(s._set || []), 'country'])] }))}>
                  {countries.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                </select>
              </div>
              <div className="adq-row">
                <label htmlFor="adq-region">{c.region}</label>
                {abroad ? (
                  <select id="adq-region" className={scenario.region ? '' : 'is-default'} value={scenario.region || ''}
                          onChange={(e) => set('region', e.target.value)}>
                    <option value="">{fill(c.regionUnset, { town })}</option>
                    {regionList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                ) : (
                  <select id="adq-region" className={scenario.department ? '' : 'is-default'} value={scenario.department || ''}
                          onChange={(e) => set('department', e.target.value)}>
                    <option value="">{fill(c.regionUnset, { town })}</option>
                    {byCode(departments).map((d) => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
                  </select>
                )}
              </div>
              {result.regionUsed && !result.regionUsed.hasPv && result.climateInputs.includes('irradiance') && (
                <p className="adq-note">{fill(c.noSolarHere, { region: result.regionUsed.name })}</p>
              )}
            </>
          )}
          {result.climateInputs.includes('rainfall') && (
            <div className="adq-row">
              <label htmlFor="adq-dry">{t.inputs.dryYear}</label>
              <select id="adq-dry" className={isSet('dryYearFactor') ? '' : 'is-default'} value={scenario.dryYearFactor}
                      onChange={(e) => set('dryYearFactor', Number(e.target.value))}>
                <option value={1.0}>{t.dryYear.average}</option>
                <option value={0.8}>{t.dryYear.typicalDry}</option>
                <option value={0.64}>{t.dryYear.driest}</option>
              </select>
            </div>
          )}
          {result.hasMains && (
            <label className="adq-row adq-check-row">
              <span>{t.inputs.mainsOff}</span>
              <input type="checkbox" className="adq-check" checked={!!scenario.mainsOff}
                     onChange={(e) => set('mainsOff', e.target.checked)} />
            </label>
          )}
          <p className="adq-note">{c.situationNote}</p>
        </section>
      )}


      {families.length === 0 && spares.length === 0 && (
        result.unlinked.length > 0 ? (
          <section className="adq-fam adq-grey is-open">
            <h3 className="adq-fam-head"><Mark verdict="grey" /><span className="adq-verdict-word">{c.nothingLinkedTitle}</span></h3>
            <p className="adq-sentence">{c.nothingLinkedBody}</p>
            <button type="button" className="adq-next" onClick={() => onReveal(result.unlinked.map((u) => u.nodeId))}>{c.nothingLinkedShow} →</button>
            <p className="adq-counted">{fill(c.notCountedLinked, { list: listOf(c, [...new Set(result.unlinked.map((u) => nameOf(u.solutionId)))]) })}</p>
          </section>
        ) : unfedShown.length === 0 && <p className="adq-none">{advisory.length > 0 ? t.onlyFabric : t.nothingToAssess}</p>
      )}

      {families.map(([fam, f], idx) => {
        const shown = typing ? false : (fold ? (open[fam] ?? idx === 0) : true)
        const move = nextMove(fam, f)
        // The other side of the balance (brief 04): a second way on, only where a figure backs it.
        const less = (f.verdict === 'yellow' || f.verdict === 'red') && !f.drinkingCapped ? lessUsing(f, data) : null
        // Not twice for one card: the move may already offer to swap it.
        const lessCmp = less && !(move?.kind === 'swap' && move.solutionId === less.solutionId)
          && compareFor(less.solutionId)
        const opts = move && move.key && picking === move.key ? supplyOptions(...move.key.split('|')) : []
        return (
          <section key={fam} className={`adq-fam adq-${f.verdict}` + (shown ? ' is-open' : '') + (changed[fam] ? ' is-changed' : '')}
                   aria-labelledby={'adq-h-' + fam}>
            <h3 className="adq-fam-head" id={'adq-h-' + fam}>
              {fold || typing ? (
                <button type="button" className="adq-fam-toggle" aria-expanded={shown}
                        onClick={() => { setTyping(false); setOpen((o) => ({ ...o, [fam]: !(o[fam] ?? idx === 0) })) }}>
                  <span className="adq-fam-name">{t.families[fam] || fam}</span>
                  <Mark verdict={f.verdict} /><span className="adq-verdict-word">{t.verdicts[f.verdict]}</span>
                  {changed[fam] && <span className="adq-changed">{changed[fam]}</span>}
                  <span className="adq-caret" aria-hidden="true">{shown ? '▾' : '▸'}</span>
                </button>
              ) : (
                <>
                  <span className="adq-fam-name">{t.families[fam] || fam}</span>
                  <Mark verdict={f.verdict} /><span className="adq-verdict-word">{t.verdicts[f.verdict]}</span>
                  {changed[fam] && <span className="adq-changed">{changed[fam]}</span>}
                </>
              )}
            </h3>
            {shown && (
              <>
                <p className="adq-sentence">{sentence(fam, f)}</p>
                {f.drinking && f.drinking.state !== 'ok' && !f.drinkingCapped && (
                  <p className="adq-sentence">{f.drinking.state === 'unused' ? fill(c.drinkingUnusedAlso, { name: nameOf(f.drinking.solutionId) }) : c.noDrinkingAlso}</p>
                )}
                {move && (
                  <button type="button" className="adq-next" aria-expanded={move.kind === 'pick' ? !!move.open : undefined} onClick={move.run}>
                    {move.label} <span aria-hidden="true">{move.kind === 'pick' || move.kind === 'add' ? '+' : move.kind === 'field' ? '↑' : move.kind === 'swap' ? '⇄' : '→'}</span>
                  </button>
                )}
                {lessCmp && (
                  <button type="button" className="adq-next" onClick={() => onTryOthers(less.solutionId)}>
                    {fill(c.nextUseLess, { need: lessCmp.name })} <span aria-hidden="true">⇄</span>
                  </button>
                )}
                {opts.length > 0 && (
                  <ul className="adq-picks">
                    {opts.map((o) => (
                      <li key={o.key}><button type="button" className="btn secondary" onClick={() => { o.apply(); setPicking(null) }}>{fill(c.supplyPick, { name: o.name })}</button></li>
                    ))}
                  </ul>
                )}
                {countedLine(f) && <p className="adq-counted">{countedLine(f)}</p>}
                {f.verdict !== 'supplied' && (
                  <>
                    <button type="button" className="adq-worked" aria-expanded={!!worked[fam]}
                            onClick={() => setWorked((w) => ({ ...w, [fam]: !w[fam] }))}>
                      {c.worked} <span aria-hidden="true">{worked[fam] ? '▾' : '▸'}</span>
                    </button>
                    {worked[fam] && <Working fam={fam} f={f} />}
                  </>
                )}
              </>
            )}
          </section>
        )
      })}

      {unfedShown.length > 0 && (
        <section className="adq-fam adq-grey is-open" aria-labelledby="adq-unfed">
          <h3 className="adq-fam-head" id="adq-unfed"><Mark verdict="grey" /><span className="adq-verdict-word">{c.unfedHeading}</span></h3>
          {unfedShown.map((u) => {
            const key = u.nodeId + '|' + u.io
            const opts = supplyOptions(u.nodeId, u.io)
            return (
              <div key={key}>
                <p className="adq-sentence">{fill(c.unfedRow, { name: nameOf(u.solutionId), io: ioNameOf(u.io) })}</p>
                {opts.length > 0 && (
                  <button type="button" className="adq-next" aria-expanded={picking === key} onClick={() => setPicking(picking === key ? null : key)}>
                    {c.nextSupply} <span aria-hidden="true">+</span>
                  </button>
                )}
                {picking === key && (
                  <ul className="adq-picks">
                    {opts.map((o) => (
                      <li key={o.key}><button type="button" className="btn secondary" onClick={() => { o.apply(); setPicking(null) }}>{fill(c.supplyPick, { name: o.name })}</button></li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
          {unfedOpen.length > unfedShown.length && <p className="adq-counted">{fill(c.unfedMore, { n: unfedOpen.length - unfedShown.length })}</p>}
        </section>
      )}

      {spares.map(([fam, f]) => (
        <section key={fam} className="adq-fam adq-spare is-open">
          <h3 className="adq-fam-head"><span className="adq-fam-name">{t.families[fam] || fam}</span><span className="adq-verdict-word">{t.spareLabel}</span></h3>
          <p className="adq-sentence">{t.spareReads.replace('{low}', fmt(f.spare[0])).replace('{high}', fmt(f.spare[1])).replace('{unit}', unitOf(f.unit) || '')}</p>
        </section>
      ))}

      {/* Level 4 for the whole panel: the fabric, the summer, every source, the figures not used. */}
      <button type="button" className="adq-worked adq-all" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
        {c.allSourcesFound} <span aria-hidden="true">{showAll ? '▾' : '▸'}</span>
      </button>
      {showAll && (
        <div className="adq-work">
          {advisory.length > 0 && (
            <section>
              <h4>{t.fabricTitle}</h4>
              <p>{t.fabricReads}</p>
              {advisoryOrder(advisory).map((io) => {
                const rows = advisory.filter((a) => a.ios.includes(io))
                return rows.length ? <p key={io}><b>{ioNameOf(io)}</b>: {rows.map((a) => nameOf(a.solutionId)).join(', ')}</p> : null
              })}
            </section>
          )}
          {result.heatExposure && (
            <section>
              <h4>{t.exposureTitle}</h4>
              <p>{fill(t.exposureReads, {
                town: result.heatExposure.station, period: result.heatExposure.recent.period,
                hot: days(t, result.heatExposure.recent.hot_days['26']), veryHot: days(t, result.heatExposure.recent.hot_days['30']),
              })}</p>
              {result.heatExposure.gainMeasures.length > 0 && <p>{t.exposureHave} {result.heatExposure.gainMeasures.map(nameOf).join(', ')}</p>}
              {result.heatExposure.coolers.length > 0 && <p>{fill(t.exposureCoolers, { list: result.heatExposure.coolers.map(nameOf).join(', ') })}</p>}
            </section>
          )}
          {/* Used, then found and not used (Eric, 2026-10-20). */}
          <h4 className="adq-src-head">{c.usedHeading}</h4>
          {(result.climateFigures.length > 0 || result.fabricUsed || result.fuelInputs.length > 0) && (
            <section>
              <ul className="adq-src">
                {result.climateFigures.map((cf) => (
                  <li key={cf.kind}>{t.climateFigure[cf.kind] || cf.kind}: {fmt(cf.value)} {unitOf(cf.unit)} · {cf.source_url
                    ? <a href={cf.source_url} target="_blank" rel="noopener noreferrer">{cf.source}</a> : cf.source} · {town}{cf.tier ? ` · ${fill(t.tier, { tier: cf.tier })}` : ''}</li>
                ))}
                {result.fabricUsed && (
                  <li>{fill(result.fabricUsed.scaledBy ? t.fabricSourceAbroad : t.fabricSource, {
                    low: Math.round(result.fabricUsed.low), high: Math.round(result.fabricUsed.high),
                    zone: result.fabricUsed.zoneUsed, sample: result.fabricUsed.sample, tier: result.fabricUsed.tier,
                    town, hdd: result.fabricUsed.scaledBy ? result.fabricUsed.scaledBy.hdd : '',
                  })} {result.fabricUsed.source_url
                    ? <a href={result.fabricUsed.source_url} target="_blank" rel="noopener noreferrer">{result.fabricUsed.source}</a>
                    : result.fabricUsed.source}</li>
                )}
                {result.regionUsed && data.world && (
                  // Who drew the region and named its town; GeoNames' licence asks for the credit.
                  <li>{fill(t.regionSource, { region: result.regionUsed.name, town })}{' '}
                    {(world && world.division === 'NUTS-2' ? [data.world.sources.nuts, data.world.sources.towns] : [data.world.sources.towns])
                      .map((s, i) => <span key={s.source}>{i ? ' · ' : ''}<a href={s.source_url} target="_blank" rel="noopener noreferrer">{s.source}</a> ({s.licence})</span>)}</li>
                )}
                {result.fuelInputs.map((fu) => (
                  <li key={fu.io}>{fill(t.fuelDensity, { low: fu.density.low, high: fu.density.high, unit: unitOf(fu.unit), condition: (fr() && fu.density.condition_fr) || fu.density.condition, tier: fu.density.tier })}
                    {fu.density.source && <> · {fu.density.source_url
                      ? <a href={fu.density.source_url} target="_blank" rel="noopener noreferrer">{fu.density.source}</a>
                      : fu.density.source}</>}</li>
                ))}
              </ul>
            </section>
          )}
          {families.map(([fam, f]) => (f.rows || []).length > 0 && (
            <section key={fam}>
              <h5>{t.families[fam] || fam}</h5>
              <ul className="adq-src">
                {f.rows.map(({ solutionId, coef, sited = 1 }, i) => (
                  <li key={solutionId + i}>
                    <b>{nameOf(solutionId)}</b> {fill(t.figureReads, { low: sited === 1 ? coef.low : Math.round(coef.low * sited), high: sited === 1 ? coef.high : Math.round(coef.high * sited), unit: unitOf(coef.unit), basis: basisOf(coef.basis) })}
                    {coef.condition && <><br /><small>{readerText((fr() && coef.condition_fr) || coef.condition)}</small></>}
                    <br /><small>{coef.source_url ? <a href={coef.source_url} target="_blank" rel="noopener noreferrer">{coef.source}</a> : coef.source}
                      {fill(t.sourceMeta, { source: '', tier: coef.tier, precision: t.precisionLabels[coef.precision] || coef.precision })}</small>
                  </li>
                ))}
              </ul>
              {f.uncounted.length > 0 && (
                <p className="adq-note">{t.notCounted} {f.uncounted.map((u) => {
                  const why = t.notCountedWhy[u.why]
                  return why ? `${nameOf(u.solutionId)} (${why})` : nameOf(u.solutionId)
                }).join(', ')}</p>
              )}
            </section>
          ))}
          {result.referenceFigures.length > 0 && (
            <section className="adq-unused">
              <h4>{c.notUsedHeading}</h4>
              <p>{c.notUsedIntro}</p>
              <ul className="adq-src">
                {result.referenceFigures.map(({ nodeId, solutionId, coef, why }, i) => (
                  <li key={nodeId + i}>
                    <b>{nameOf(solutionId)}</b> {fill(t.figureReads, { low: coef.low, high: coef.high, unit: unitOf(coef.unit), basis: basisOf(coef.basis) })}
                    <br /><small>{coef.source_url ? <a href={coef.source_url} target="_blank" rel="noopener noreferrer">{coef.source}</a> : coef.source}
                      {why && c.notUsedWhy[why] ? <> · <b>{c.notUsedWhy[why]}</b></> : null}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {result.withoutFigures.length > 0 && <p className="adq-note">{t.noFigureAtAll} {result.withoutFigures.map(nameOf).join(', ')}</p>}
        </div>
      )}
      <p className="adq-scope">{c.scope}</p>
      <button type="button" className="adq-worked adq-report" onClick={sendReport}>{c.reportLink}</button>
      {report && (
        <div className="adq-note" role="status">
          {report.long && <p>{c.reportLong}</p>}
          <p>{fill(c.reportNoMail, { email: FEEDBACK_EMAIL })}</p>
          <button type="button" className="adq-worked" onClick={async () => setReportCopied(await copyText(report.details))}>
            {reportCopied ? c.reportCopied : c.reportCopy}
          </button>
        </div>
      )}
    </div>
  )
}
