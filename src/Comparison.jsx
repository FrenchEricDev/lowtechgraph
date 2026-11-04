import { useState } from 'react'
import * as cat from './catalogue'
import { ui, fill } from './ui-strings'
import Nav from './Nav'
import Glyph from './Glyph.jsx'
import { filterNames, ActiveFilters, openFilters } from './FacetBar.jsx'
import { tradeoffs, keepLevels, fitFacts } from './tradeoffs.js'

/*
 * The comparison, on two pages with one question each (Eric, 2026-11-01).
 * Sub-need page, "which one should I pick?": every option in a table.
 * Solution page, "is this the right one?": this option's card, the others in a line each. The card
 * has the same rows in the same order for every option:
 *   1. Can I use it?          flat, rebuilding needed or not, site requirements, rules in France
 *   2. What does it cost me?  five trade-offs as levels, not ranks
 *   3. Choose it if...        one authored clause
 * The filters work as everywhere: on the solution page the others outside them leave the list, one
 * tap brings them back, and this page's own option stays, greyed, saying which filters it fails.
 */

/* ---- the sub-need page (brief 08; Eric, 2026-11-01): "Choose it if" first, then every dimension ---- */

/*
 * Two tabs over one table, so it never grows wider (Eric, 2026-11-03): "Building it" (cost, skill,
 * daily life and the three yes-or-no marks) and "Keeping it going" (upkeep, skill to repair,
 * spares). "Choose it if" is in both.
 */
export const ASPECTS = ['build', 'keep']

export function AspectSwitch({ aspect, setAspect }) {
  const C = ui.comparison
  return (
    <div className="seg ct-aspect" role="group" aria-label={C.aspectLabel}>
      {ASPECTS.map((a) => (
        <button key={a} type="button" className={'seg-item' + (aspect === a ? ' is-on' : '')}
                aria-pressed={aspect === a} onClick={() => setAspect(a)}>
          {a === 'build' ? C.aspectBuild : C.aspectKeep}
        </button>
      ))}
    </div>
  )
}

// The levels, the words under the dots.
const levels = (x, aspect = 'build') => aspect === 'keep'
  ? keepLevels(x, ui, cat.tEnum)
  : tradeoffs(x, ui, cat.tEnum).filter((t) => t.key !== 'grid' && t.key !== 'upkeep')

// The yes-or-no dimensions, a check or a cross. "In a flat" can also carry a condition.
const marks = (x, aspect = 'build') => {
  const C = ui.comparison
  if (aspect === 'keep') return []
  return [
    { key: 'flat', label: C.colFlat, ok: !!x.flat_feasible, note: x.flat_feasible && x.flat_blocker ? C.flatCondition : '' },
    { key: 'standing', label: C.colStanding, ok: !x.new_build_only },
    { key: 'grid', label: C.colGrid, ok: tradeoffs(x, ui, cat.tEnum).find((t) => t.key === 'grid').yes },
  ]
}

function Mark({ m }) {
  const C = ui.comparison
  return (
    <span className={'ct-mark' + (m.ok ? ' is-yes' : ' is-no')}>
      <Glyph name={m.ok ? 'check' : 'close'} size={18} />
      <span className="sr-only">{m.ok ? C.yes : C.no}</span>
      {m.note && <span className="ct-mark-note">{m.note}</span>}
    </span>
  )
}

/*
 * Options in the filters first, then the rest under a labelled divider at full contrast, each
 * with the filters it fails in words: the reader can still see what they ruled out, and why.
 */
function orderForCompare(sols, filters) {
  const fits = (x) => cat.visibleSolutions([x], filters).length > 0
  return { inside: sols.filter(fits), outside: sols.filter((x) => !fits(x)) }
}

// What can rule an option out, in words, and only when it does: most rows carry nothing.
function RulesOut({ x }) {
  const words = fitFacts(x, ui, cat.L).filter((f) => (f.key === 'flat' || f.key === 'standing') && !f.ok).map((f) => f.word)
  return words.length > 0 ? <span className="ct-rules">{words.join(' · ')}</span> : null
}

function Level({ t }) {
  return (
    <span className="lvl">
      {t.dots !== null && <Dots n={t.dots} />}
      <span>{t.word}</span>
    </span>
  )
}

export function CompareTable({ sols, filters, go, showOutside = true, aspect = 'build' }) {
  const C = ui.comparison
  const { inside, outside: out0 } = orderForCompare(sols, filters)
  const outside = showOutside ? out0 : []
  const head = [...levels(sols[0], aspect), ...marks(sols[0], aspect)]
  const row = (x, out) => (
    <tr key={x.id} className={out ? 'is-out' : undefined}>
      <th scope="row">
        <Nav route={{ view: 'solution', id: x.id }} go={go} className="link ct-name">{cat.tName(x)}</Nav>
        {x.benchmark && <span className="benchmark-tag">{ui.benchmark.tag}</span>}
        {out && <span className="ct-why">{fill(C.outsideWhy, { filters: filterNames(filters, cat.failedFilters(x, filters)).join(', ') })}</span>}
      </th>
      <td className="ct-choose-cell">{cat.L(x, 'choose_if')}</td>
      {levels(x, aspect).map((t) => <td key={t.key}><Level t={t} /></td>)}
      {marks(x, aspect).map((m) => <td key={m.key}><Mark m={m} /></td>)}
    </tr>
  )
  return (
    <div className="ct-wrap" role="region" aria-label={fill(C.tableCaption, { n: sols.length })} tabIndex={0}>
      <table className="ct">
        <caption className="sr-only">{fill(C.tableCaption, { n: sols.length })}</caption>
        <thead>
          <tr>
            <th scope="col">{C.colOption}</th>
            <th scope="col">{C.chooseIf}</th>
            {head.map((t) => <th key={t.key} scope="col">{t.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {inside.map((x) => row(x, false))}
          {outside.length > 0 && (
            <tr className="ct-divider"><th colSpan={head.length + 2} scope="rowgroup">{C.outsideHeading}</th></tr>
          )}
          {outside.map((x) => row(x, true))}
        </tbody>
      </table>
    </div>
  )
}

/* The same on a tight screen: the name, "Choose it if", the levels side by side, then the marks. */
export function CompareRows({ sols, filters, go, showOutside = true, aspect = 'build' }) {
  const C = ui.comparison
  const { inside, outside: out0 } = orderForCompare(sols, filters)
  const outside = showOutside ? out0 : []
  const row = (x, out) => {
    const clause = cat.L(x, 'choose_if')
    return (
      <li key={x.id} className={'cr' + (out ? ' is-out' : '')}>
        <Nav route={{ view: 'solution', id: x.id }} go={go} className="link cr-name">
          {cat.tName(x)}
        </Nav>
        {x.benchmark && <span className="benchmark-tag">{ui.benchmark.tag}</span>}
        {out && <span className="ct-why">{fill(C.outsideWhy, { filters: filterNames(filters, cat.failedFilters(x, filters)).join(', ') })}</span>}
        {clause && <span className="ct-choose"><b>{C.chooseIf}</b> {clause}</span>}
        <span className="cr-facts">
          {levels(x, aspect).map((t) => <span key={t.key} className="cr-fact"><span className="cr-label">{t.label}</span><Level t={t} /></span>)}
        </span>
        {aspect === 'build' && <span className="cr-marks">
          {marks(x).map((m) => <span key={m.key} className="cr-mark"><Mark m={{ ...m, note: '' }} /><span className="cr-label">{m.label}</span>{m.note && <span className="ct-mark-note">{m.note}</span>}</span>)}
        </span>}
      </li>
    )
  }
  return (
    <>
      <ul className="cr-list">{inside.map((x) => row(x, false))}</ul>
      {outside.length > 0 && (
        <>
          <h3 className="sec cr-divider">{C.outsideHeading}</h3>
          <ul className="cr-list">{outside.map((x) => row(x, true))}</ul>
        </>
      )}
    </>
  )
}


function Dots({ n }) {
  return (
    <span className="cmp-dots" aria-hidden="true">
      {[1, 2, 3].map((i) => <span key={i} className={'cmp-dot' + (i <= n ? ' is-on' : '')} />)}
    </span>
  )
}

function OptionCard({ sol, self, go, filters }) {
  const C = ui.comparison
  const fits = cat.visibleSolutions([sol], filters).length > 0
  const clause = cat.L(sol, 'choose_if')
  return (
    <article className={'cmp-card' + (self ? ' is-self' : '') + (fits ? '' : ' is-unfit')}>
      <div className="cmp-card-body">
      <header className="cmp-card-head">
        {self
          ? <h3 className="cmp-name">{cat.tName(sol)}</h3>
          : <h3 className="cmp-name"><Nav route={{ view: 'solution', id: sol.id }} go={go} className="link">{cat.tName(sol)}</Nav></h3>}
        {/* Under the name, on its own line, with the filters it fails in words. */}
        {!fits && (
          <span className="cmp-unfit-tag">
            {fill(C.outsideWhy, { filters: filterNames(filters, cat.failedFilters(sol, filters)).join(', ') })}
          </span>
        )}
      </header>

      <div className="cmp-layer">
        <div className="cmp-layer-label">{C.canUse}</div>
        <ul className="cmp-fit">
          {fitFacts(sol, ui, cat.L).map((f) => f.text !== undefined
            ? (f.text
              ? <li key={f.key}><details><summary>{f.word}</summary><p>{f.text}</p></details></li>
              : f.key === 'site' ? <li key={f.key} className="is-ok">{C.noSite}</li> : null)
            : <li key={f.key} className={f.ok ? 'is-ok' : 'is-no'}>{f.word}</li>)}
        </ul>
      </div>

      <div className="cmp-layer">
        <div className="cmp-layer-label">{C.costs}</div>
        <dl className="cmp-trade">
          {tradeoffs(sol, ui, cat.tEnum).map((t) => (
            <div key={t.key} className="cmp-row">
              <dt>{t.label}</dt>
              <dd>
                {t.dots !== null && <Dots n={t.dots} />}
                <span className={t.key === 'grid' ? (t.yes ? 'cmp-yes' : 'cmp-no') : undefined}>{t.word}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {clause && (
        <p className="cmp-choose"><span className="cmp-layer-label">{C.chooseIf}</span> {clause}</p>
      )}
      </div>

    </article>
  )
}

export default function Comparison({ sol, go, filters }) {
  const C = ui.comparison
  const sibs = cat.solsBySubfunction[sol.subfunction_id] || []
  const [showHidden, setShowHidden] = useState(false)

  // The only option for its need: nothing to compare, but its own card is still the one place
  // on the page that shows its cost, skill, upkeep and the rest (the facts table went, 2026-09-24).
  if (sibs.length <= 1) {
    return (
      <section className="cmp-block" id="ranking">
        <h2>{ui.ranking.headingSingle}</h2>
        <p className="muted small">{ui.ranking.onlyOption}</p>
        <div className="cmp-single"><OptionCard sol={sol} self go={go} filters={filters} /></div>
      </section>
    )
  }
  const fitsAll = (p) => cat.visibleSolutions([p], filters).length > 0
  const others = sibs.filter((p) => p.id !== sol.id)
  const inside = others.filter(fitsAll)
  const hidden = others.length - inside.length
  // The ones in the filters first, the ones outside them last, once asked for.
  const ordered = showHidden ? [...inside, ...others.filter((p) => !fitsAll(p))] : inside
  return (
    <section className="cmp-block" id="ranking">
      {/* No "showing" count: the list says what the filters left, and offers the rest (Eric, 2026-11-01). */}
      <div className="cmp-head">
        <h2>{C.assessHeading}<span className="sec-count"> · {fill(C.waysCount, { n: sibs.length })}</span></h2>
        <button type="button" className="btn secondary filter-change" onClick={() => openFilters(sibs)}>
          {ui.facets.change}
        </button>
      </div>
      <ActiveFilters filters={filters} />
      {/* This page's option in full, the others in a line each: is this the right one? The full
          comparison is the sub-need page's table (Eric, 2026-11-01). */}
      <div className="cmp-split">
        <div className="cmp-this">
          <h3>{C.thisSolution}</h3>
          <OptionCard sol={sol} self go={go} filters={filters} />
        </div>
        <div className="cmp-others">
          <h3>{ordered.length === 0 ? C.othersNone : ordered.length === 1 ? C.othersOne : fill(C.othersMany, { n: ordered.length })}</h3>
          <ul>
            {ordered.map((p) => {
              const clause = cat.L(p, 'choose_if')
              return (
                <li key={p.id}>
                  <Nav route={{ view: 'solution', id: p.id }} go={go} className="link cmp-other-name">{cat.tName(p)}</Nav>
                  <RulesOut x={p} />
                  {!fitsAll(p) && <span className="ct-why">{fill(C.outsideWhy, { filters: filterNames(filters, cat.failedFilters(p, filters)).join(', ') })}</span>}
                  {clause && <span className="ct-choose"><b>{C.chooseIf}</b> {clause}</span>}
                </li>
              )
            })}
          </ul>
          {hidden > 0 && (
            <button type="button" className="btn secondary show-hidden" aria-expanded={showHidden}
                    onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? ui.facets.hideHidden
                : hidden === 1 ? ui.facets.showHiddenOne : fill(ui.facets.showHiddenMany, { n: hidden })}
              <span aria-hidden="true"> {showHidden ? '▴' : '▾'}</span>
            </button>
          )}
          <Nav route={{ view: 'subfunction', id: sol.subfunction_id }} go={go} className="link cmp-all">
            {C.compareAll} <span aria-hidden="true">→</span>
          </Nav>
        </div>
      </div>
    </section>
  )
}
