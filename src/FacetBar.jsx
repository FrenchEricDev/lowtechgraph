import { useEffect, useState } from 'react'
import Glyph from './Glyph.jsx'
import useDialog from './useDialog'
import * as cat from './catalogue'
import { ui, fill } from './ui-strings'

/*
 * The facet bar: the shared, sticky filter object. Desktop shows every control; a phone shows
 * one Filter button that opens them in a sheet. Changes apply instantly (no Apply button: the
 * filters are global, nothing is pending). Counts are computed against the other active facets,
 * so a number says what touching that control would do.
 *
 * Three places mount it, and they share these parts so they cannot drift: the needs page
 * (FacetBar), Settings (FacetBar variant="settings", always open) and the builder's solution
 * pickers (FacetHead beside the dialog title, FacetControls under it).
 */

export const activeCountOf = (filters) =>
  Object.keys(cat.DEFAULT_FILTERS).filter((k) => filters[k] !== cat.DEFAULT_FILTERS[k]).length

const clearAll = (setFilter) =>
  Object.keys(cat.DEFAULT_FILTERS).forEach((k) => setFilter(k, cat.DEFAULT_FILTERS[k]))

/*
 * Filters in words, as the bar names them: "Works in a flat", "Skill: Basic". `keys` limits it to
 * some of the active ones (the ones a given solution fails).
 */
export function filterNames(filters, keys) {
  const F = ui.facets
  const named = { maxSkill: F.skill, maxCost: F.cost, maxDaily: F.daily, maxUpkeep: F.upkeep }
  const U = ui.comparison.upkeepWords
  const value = {
    Basic: F.skillBasic, Intermediate: F.skillIntermediate, low: F.costLow, medium: F.costMedium,
    none: F.dailyNone, occasional: F.dailyOccasional, daily: F.dailyDaily, light: U[1], regular: U[2],
  }
  return (keys || Object.keys(cat.DEFAULT_FILTERS).filter((k) => filters[k] !== cat.DEFAULT_FILTERS[k]))
    .map((k) => (named[k] ? `${named[k]}: ${value[filters[k]] || filters[k]}` : F[k]))
}

export const clearFilters = (setFilter) => clearAll(setFilter)

const activeKeys = (filters) =>
  Object.keys(cat.DEFAULT_FILTERS).filter((k) => filters[k] !== cat.DEFAULT_FILTERS[k])

/*
 * One filters panel for the whole site, opened from any list's "Change" (Eric, 2026-10-20). The
 * host lives in the app shell; `pool` is the list it was opened from, so its count is that list.
 */
let showFilters = () => {}
export const openFilters = (pool) => showFilters(pool)

export function FiltersHost({ filters, setFilter }) {
  const [pool, setPool] = useState(null)
  useEffect(() => {
    showFilters = (p) => setPool(p || cat.catalogue.solutions)
    return () => { showFilters = () => {} }
  }, [])
  if (!pool) return null
  return <FilterSheet filters={filters} setFilter={setFilter} pool={pool} onClose={() => setPool(null)} />
}

/*
 * The line above every list the filters cut (brief 05, U-F1): how many are showing, which
 * filters are on, and "Change", which opens the filters panel. No removal from the line itself:
 * a filter taken off there could not be put back from there (Eric, 2026-10-20). `stress` marks
 * the filters hiding what the reader is looking at. The count is a polite status, and takes
 * emphasis when it changes. `onChange` replaces the site panel (the needs index has its own).
 */
// `always`: shown with no filter set too, so a reader can set one and watch the comparison
// below change (Eric, 2026-10-21: solution and sub-need pages).
export function FilterLine({ all, filters, stress = [], onChange, always = false }) {
  const F = ui.facets
  const keys = activeKeys(filters)
  if (!keys.length && !always) return null
  const shown = cat.visibleSolutions(all, filters).length
  return (
    <div className="filter-line">
      <span className="filter-count" role="status" key={shown}>
        {fill(F.showing, { shown, total: all.length })}
      </span>
      <ActiveFilters filters={filters} stress={stress} />
      <button type="button" className="btn secondary filter-change"
              onClick={(e) => (onChange ? onChange(e) : openFilters(all))}>
        {F.change}
      </button>
    </div>
  )
}

// The filters that are on, in words; nothing when none is.
export function ActiveFilters({ filters, stress = [] }) {
  const keys = activeKeys(filters)
  if (!keys.length) return null
  const names = filterNames(filters, keys)
  return (
    <span className="filter-names">
      <span className="filter-label">{ui.facets.yourFilters}</span>{' '}
      {keys.map((k, i) => (
        <span key={k}>
          <span className={'filter-name' + (stress.includes(k) ? ' is-stressed' : '')}>{names[i]}</span>
          {i < keys.length - 1 ? ', ' : ''}
        </span>
      ))}
    </span>
  )
}

/*
 * A list the filters have emptied: what is hidden, by which filter, and the one-tap fix for
 * each filter in the way, without clearing the others (Eric, 2026-10-18). Then the filters
 * themselves, since they apply on every page.
 */
export function EmptyByFilters({ all, filters, setFilter }) {
  const F = ui.facets
  if (!all.length || cat.visibleSolutions(all, filters).length) return null
  const blocking = [...new Set(all.flatMap((x) => cat.failedFilters(x, filters)))]
  const names = filterNames(filters, blocking)
  return (
    <div className="filter-empty">
      <h2>{all.length === 1 ? F.emptyOne : fill(F.emptyMany, { n: all.length })}</h2>
      {all.length === 1 && (
        <p>{fill(F.hiddenBy, { name: cat.tName(all[0]), filters: names.join(', ') })}</p>
      )}
      <p className="filter-fixes">
        {blocking.map((k, i) => (
          <button key={k} type="button" className="btn secondary"
                  onClick={() => setFilter(k, cat.DEFAULT_FILTERS[k])}>
            {fill(F.removeOne, { name: names[i] })}
          </button>
        ))}
      </p>
      <FilterLine all={all} filters={filters} stress={blocking} />
    </div>
  )
}

export function HiddenByFilters({ all, filters, setFilter }) {
  const F = ui.facets
  const hidden = all.length - cat.visibleSolutions(all, filters).length
  if (!hidden) return null
  const names = filterNames(filters)
  return (
    <p className={'filters-note' + (hidden === all.length ? ' is-empty' : '')} role="status">
      {fill(hidden === all.length ? F.hiddenAll : hidden === 1 ? F.hiddenOne : F.hiddenMany,
        { n: hidden, filters: names.join(', ') })}{' '}
      <button type="button" className="link-btn" onClick={() => clearAll(setFilter)}>{F.hiddenShow}</button>
    </p>
  )
}

export function FacetControls({ filters, setFilter, pool, fold = false }) {
  const CEIL = ['maxSkill', 'maxCost', 'maxUpkeep', 'maxDaily']
  const U = ui.comparison.upkeepWords
  const ceilOn = CEIL.filter((k) => filters[k]).length
  const [more, setMore] = useState(() => ceilOn > 0)
  const F = ui.facets
  const TOGGLES = [
    ['flatOnly', F.flatOnly], ['retrofitOnly', F.retrofitOnly],
    ['passiveOnly', F.passiveOnly], ['tutorialOnly', F.tutorialOnly],
    ['lowTechOnly', F.lowTechOnly],
  ]
  // No "No skill" rung: the rows rated None are decisions (an orientation, a footprint), not
  // easy builds, so a None ceiling would show what nobody can make and hide the true first
  // builds. The data keeps None, which still passes every ceiling.
  const CEILINGS = [
    ['maxSkill', F.skill, [[null, F.any], ['Basic', F.skillBasic],
                           ['Intermediate', F.skillIntermediate]]],
    ['maxCost', F.cost, [[null, F.any], ['low', F.costLow], ['medium', F.costMedium]]],
    // No "Heavy" rung: as a ceiling it is the same as Any.
    ['maxUpkeep', F.upkeep, [[null, F.any], ['none', U[0]], ['light', U[1]], ['regular', U[2]]]],
    // No "Way of living" rung: as a ceiling it is the same as Any.
    ['maxDaily', F.daily, [[null, F.any], ['none', F.dailyNone], ['occasional', F.dailyOccasional],
                           ['daily', F.dailyDaily]]],
  ]
  return (
    <div className="facet-controls">
      <div className="facet-toggles">
        {TOGGLES.map(([key, label]) => {
          // What this control would leave, with every other facet still applied.
          const n = cat.visibleSolutions(pool, { ...filters, [key]: !filters[key] }).length
          return (
            <button key={key} type="button"
                    className={'facet-chip' + (filters[key] ? ' is-on' : '')}
                    aria-pressed={filters[key]}
                    onClick={() => setFilter(key, !filters[key])}>
              {/* On: filled, a check, no number (a number on a pressed chip read as "it did nothing"). */}
              {filters[key] && <Glyph name="check" size={15} />}
              {label}
              {!filters[key] && <span className="facet-n"><span className="sr-only">, </span>{n}<span className="sr-only"> {F.countNoun}</span></span>}
            </button>
          )
        })}
      </div>
      {/* On a wide screen the three ceilings fold behind one button, so the bar is one row (D). */}
      {fold && (
        <button type="button" className="facet-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {F.moreCeilings}
          {ceilOn > 0 && <span className="facet-more-n">{ceilOn}</span>}
          <span aria-hidden="true">{more ? '▴' : '▾'}</span>
        </button>
      )}
      {(!fold || more) && CEILINGS.map(([key, label, opts]) => (
        <div className="facet-ceiling" key={key}>
          <span className="facet-ceiling-label" id={'fc-' + key}>{label}</span>
          <div className="facet-seg" role="group" aria-labelledby={'fc-' + key}>
            {opts.map(([value, text]) => (
              <button key={String(value)} type="button"
                      className={'facet-seg-item' + (filters[key] === value ? ' is-on' : '')}
                      aria-pressed={filters[key] === value}
                      onClick={() => setFilter(key, value)}>{text}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* "Clear all" when something is on, and the Filter button with its count. */
export function FacetHead({ filters, setFilter, open, onToggle, controls }) {
  const F = ui.facets
  const n = activeCountOf(filters)
  return (
    <span className="facet-head">
      {n > 0 && (
        <button type="button" className="link-btn facet-clear" onClick={() => clearAll(setFilter)}>
          {F.clear}
        </button>
      )}
      <button type="button" className={'btn sm facet-toggle' + (n ? ' is-active' : '')}
              aria-expanded={open} aria-controls={controls} onClick={onToggle}>
        {F.button}{n ? ' · ' + n : ''}
        {/* Folds and unfolds the panel under the title, so it wears the tree rows' triangle. */}
        <span className="facet-tri" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
    </span>
  )
}

/*
 * The phone's filters: a sheet from the foot of the screen, its live count in the footer as the
 * button that closes it (brief 05, B).
 */
function FilterSheet({ filters, setFilter, pool, onClose }) {
  const F = ui.facets
  const box = useDialog(onClose, '.filter-change, .facet-open, [data-filters-opener]')
  const n = cat.visibleSolutions(pool, filters).length
  return (
    <>
      <div className="settings-backdrop is-full" onPointerDown={onClose} aria-hidden="true" />
      <div className="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title"
           ref={box} tabIndex={-1}>
        <div className="settings-head">
          <h2 id="filter-sheet-title">{F.sheetTitle}</h2>
          {cat.anyFilterActive(filters) && (
            <button type="button" className="link-btn facet-clear" onClick={() => clearAll(setFilter)}>{F.clear}</button>
          )}
          <button type="button" className="settings-close" onClick={onClose} aria-label={F.closeLabel}>
            <Glyph name="close" size={20} />
          </button>
        </div>
        <p className="settings-help">{F.sheetIntro}</p>
        <FacetControls filters={filters} setFilter={setFilter} pool={pool} />
        <div className="filter-sheet-foot">
          <button type="button" className="btn" onClick={onClose}>
            {n === 1 ? F.showResultsOne : fill(F.showResultsMany, { n })}
          </button>
        </div>
      </div>
    </>
  )
}

/*
 * The bar above the needs index. A wide screen: the five filters on one row, the ceilings folded
 * behind "Skill, cost, daily life", then the line (count, removable chips, Clear all). A phone:
 * the line and a Filter button that opens the sheet. Settings mounts the controls, always open.
 */
export default function FacetBar({ filters, setFilter, pool, variant }) {
  const [open, setOpen] = useState(false)
  const F = ui.facets
  const activeCount = activeCountOf(filters)
  if (variant === 'settings') {
    return (
      <div className="facetbar is-settings">
        <FacetControls filters={filters} setFilter={setFilter} pool={pool} />
      </div>
    )
  }
  return (
    <div className="facetbar">
      <div className="facet-desktop">
        <FacetControls filters={filters} setFilter={setFilter} pool={pool} fold />
      </div>
      <div className="facetbar-head">
        {activeCount ? (
          <>
            <FilterLine all={pool} filters={filters} onChange={() => setOpen(true)} />
            {/* The controls are right above on a wide screen: Clear all there, not Change. */}
            <button type="button" className="link-btn facet-clear" onClick={() => clearAll(setFilter)}>{F.clear}</button>
          </>
        ) : (
          <>
            <span className="facetbar-count">{fill(F.count, { shown: pool.length, total: pool.length })}</span>
            <button type="button" className="btn secondary facet-open" aria-expanded={open}
                    onClick={() => setOpen(true)}>
              {F.button}
            </button>
          </>
        )}
      </div>
      {open && <FilterSheet filters={filters} setFilter={setFilter} pool={pool} onClose={() => setOpen(false)} />}
    </div>
  )
}
