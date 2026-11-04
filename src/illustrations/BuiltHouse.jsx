import { useEffect, useMemo, useRef, useState } from 'react'
import * as cat from '../catalogue.js'
import { ui, fill } from '../ui-strings.js'
import { pathFor } from '../router.js'
import { TutorialsPick } from '../Tutorials.jsx'
import { plateAt } from './plateHit.js'
import { WhereToFindHelp } from '../People.jsx'
import { plateFor, composedSvg } from './plates.js'
import { sitePlateFor, composedSiteSvg } from './sitePlates.js'
import { competes } from './competePairs.js'
import { flyChip } from '../fly.js'
import { numberLabels } from './plateLegend.js'
import { PlateLegend } from './Plate.jsx'
import './plate.css'

/*
 * The built house (TODO S6): the builder's solutions drawn on the house as they are placed.
 * A vignette floats on the canvas and shows each new drawing arriving in its slot; it opens the
 * sheet: when both views have drawings, a tall 840 x 720 page whose 160 units of headroom hold
 * the other view as an inset, so the inset never covers the roof. The list beside the sheet is its index.
 */

// Site plates that draw the shared detail box (the long section or a plan inset) all use one
// slot in the sheet's corner, so only one of them can show at a time. Same test as the site
// plan's collision study: the box's filled frame starts at 34,50.
const usesInset = (p, t) => p.draw(t).includes('class="dr-fill" d="M34,50')

const HEAD = 160   // the tall sheet is 840 x 720 when both views show
const INSET = [606, 12, 216, 144]

export default function BuiltHouse({ sols, go, lang, openKey }) {
  const t = (en, fr) => (lang === 'fr' ? fr : en)
  const key = sols.map((s) => s.id).join(',')

  // keyed on the list of ids, not on `sols`: the builder hands a new array on every node drag
  const model = useMemo(() => {
    const seen = new Set()
    const rows = []
    for (const s of sols) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      const section = plateFor(s.id)
      const site = section ? null : sitePlateFor(s.id)
      rows.push({ sol: s, plate: section || site, base: section ? 'section' : site ? 'site' : null })
    }
    const plates = (base) => [...new Map(rows.filter((r) => r.base === base).map((r) => [r.plate.id, r.plate])).values()]
    const section = plates('section'), site = plates('site')
    // alternatives placed together, listed pair by pair ("A vs. B")
    const drawn = [...section, ...site]
    const conflicts = []
    for (let i = 0; i < drawn.length; i++)
      for (let j = i + 1; j < drawn.length; j++)
        if (competes(drawn[i].id, drawn[j].id)) conflicts.push([drawn[i].id, drawn[j].id])
    return { rows, section, site, conflicts, notDrawn: rows.filter((r) => !r.base) }
  }, [key])

  // What arrived since the last render: a chip flies from its card on the canvas to the vignette
  // (Eric, 2026-09-24), the drawing is held back while it travels, and on landing it drops into
  // its slot and the vignette's frame lights up. Nothing on the first render, so opening a saved
  // system does not replay the whole house.
  const prev = useRef(null)
  const vignetteRef = useRef(null)
  const [fresh, setFresh] = useState(() => new Set())
  const [pending, setPending] = useState(() => new Set())
  const [hit, setHit] = useState(0)                 // bumped on each landing, keys the highlight
  const [lastBase, setLastBase] = useState(null)
  useEffect(() => {
    const now = new Set(model.rows.filter((r) => r.base).map((r) => r.plate.id))
    if (prev.current) {
      const added = [...now].filter((id) => !prev.current.has(id))
      prev.current = now
      if (added.length) {
        const r = model.rows.find((x) => x.base && x.plate.id === added[added.length - 1])
        setLastBase(r.base)
        setPending(new Set(added))
        const timers = []
        let live = true
        const land = () => {
          if (!live) return
          setPending(new Set())
          setFresh(new Set(added))
          setHit((h) => h + 1)
          timers.push(setTimeout(() => setFresh(new Set()), 1600))
        }
        // React Flow draws a new card a moment after the tree changes, so look for it then.
        timers.push(setTimeout(() => {
          const card = document.querySelector(`.tnode[data-sol="${r.sol.id}"]`)
          flyChip(card, vignetteRef.current, '+' + added.length, { land: 'center', onLand: land })
        }, 80))
        return () => { live = false; timers.forEach(clearTimeout); setPending(new Set()) }
      }
    }
    prev.current = now
  }, [model])

  const [open, setOpen] = useState(false)
  const [view, setView] = useState(null)
  const [selected, setSelected] = useState(null)   // a solution id
  // "What to build, and how" in the More menu opens the same sheet.
  useEffect(() => { if (openKey) { setSelected(null); setOpen(true) } }, [openKey])
  const closeRef = useRef(null)
  useEffect(() => {
    if (!open) return
    closeRef.current && closeRef.current.focus()
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    // Closed: focus goes back to the vignette that opened it (B4).
    const back = vignetteRef.current
    return () => { window.removeEventListener('keydown', onKey); if (back && back.isConnected) back.focus() }
  }, [open])

  const bases = ['section', 'site'].filter((b) => model[b].length)
  const vignetteBase = bases.includes(lastBase) ? lastBase : bases[0]
  const ghost = model.site.some((p) => p.ghostHouse)
  const cls = (p) => (fresh.has(p.id) ? ' is-new' : pending.has(p.id) ? ' is-pending' : '')

  // the detail box holds one plate: the selected one if it uses the box, else the first placed
  const siteShown = (selPlate) => {
    const boxed = model.site.filter((p) => usesInset(p, t))
    const keep = selPlate && boxed.includes(selPlate) ? selPlate : boxed[0]
    return model.site.filter((p) => !boxed.includes(p) || p === keep)
  }

  const compose = (base, opts) => (base === 'site'
    ? composedSiteSvg(siteShown(opts.selectedPlate), { t, ghost, layerClass: cls, selected: opts.selectedPlate ? opts.selectedPlate.id : null, ...opts })
    : composedSvg(model.section, { t, layerClass: cls, selected: opts.selectedPlate ? opts.selectedPlate.id : null, ...opts }))

  const vignette = useMemo(() => (vignetteBase ? compose(vignetteBase, { chrome: false }) : ''),
    [key, vignetteBase, fresh, pending, lang])

  if (!bases.length) return null

  const selRow = model.rows.find((r) => r.sol.id === selected && r.base)
  const main = selRow ? selRow.base : bases.includes(view) ? view : vignetteBase
  const other = bases.find((b) => b !== main)
  const selPlate = selRow && selRow.base === main ? selRow.plate : null
  const viewName = (b) => (b === 'site' ? ui.guide.viewSite : ui.guide.viewSection)

  const head = other ? HEAD : 0
  // The chosen solution's labels number on a phone (brief 02, B).
  let sheetLabels = []
  const post = (p, f) => { if (!selPlate || p.id !== selPlate.id) return f; const r = numberLabels(f); sheetLabels = r.labels; return r.fragment }
  // nothing chosen: every drawing faded, as the unchosen ones are once one is chosen
  const sheet = open ? `
<svg viewBox="0 0 840 ${560 + head}" xmlns="http://www.w3.org/2000/svg" class="plate-svg" role="img" aria-label="${viewName(main)}">
  <rect class="pl-paper" x="-40" y="-40" width="920" height="${560 + head + 80}"/>
  ${compose(main, { at: [0, head, 840, 560], selectedPlate: selPlate, layerClass: selPlate ? cls : (p) => cls(p) + ' is-off', post })}
  ${other ? `<g class="bh-inset" data-swap="${other}"><title>${viewName(other)}</title>
    ${compose(other, { at: INSET, chrome: false })}
    <rect class="pl-line" x="${INSET[0]}" y="${INSET[1]}" width="${INSET[2]}" height="${INSET[3]}" fill="none"/>
    <text class="bh-inset-label" x="${INSET[0]}" y="${INSET[1] + INSET[3] + 0}" dy="-6" dx="8">${viewName(other)}</text>
  </g>` : ''}
</svg>` : ''

  const select = (id) => { setSelected(selected === id ? null : id) }
  const onSheetClick = (e) => {
    const sw = e.target.closest && e.target.closest('[data-swap]')
    if (sw) { setView(sw.dataset.swap); setSelected(null); return }
    const onSheet = (id) => model.rows.some((x) => x.base === main && x.plate.id === id)
    const id = plateAt(e, e.currentTarget, onSheet)
    const r = id && model.rows.find((x) => x.base === main && x.plate.id === id)
    if (r) select(r.sol.id)
  }
  const nameOf = (plateId) => {
    const r = model.rows.find((x) => x.plate && x.plate.id === plateId)
    return r ? cat.tName(r.sol) : plateId
  }
  const lastFresh = fresh.size ? model.rows.find((r) => r.base && fresh.has(r.plate.id)) : null

  return (
    <>
      {/* One button for the page's life (B11): a key that changed on each landing remounted it and
          dropped the focus; the landing marks the new layer instead. */}
      <button type="button" ref={vignetteRef}
        className={'plate bh-vignette' + (hit && fresh.size ? ' is-hit' : '')}
        onClick={() => { setView(vignetteBase); setSelected(null); setOpen(true) }}
        aria-label={ui.builtHouse.vignetteLabel} title={ui.builtHouse.vignetteTip}>
        <span className="bh-vignette-drawing" aria-hidden="true" dangerouslySetInnerHTML={{ __html: vignette }} />
        <span className="bh-vignette-foot">
          <span>{ui.builtHouse.vignetteTitle}</span>
          {model.notDrawn.length > 0 && <span className="bh-count">{fill(ui.builtHouse.notDrawn, { n: model.notDrawn.length })}</span>}
        </span>
      </button>
      <p className="bh-live" aria-live="polite">
        {lastFresh ? fill(ui.builtHouse.justAdded, { name: cat.tName(lastFresh.sol) }) : ''}
      </p>

      {open && (
        <div className="bh-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="bh-panel" role="dialog" aria-modal="true" aria-labelledby="bh-title">
            <div className="bh-head">
              <h2 id="bh-title">{ui.builtHouse.sheetTitle}</h2>
              {bases.length > 1 && (
                <div className="guide-views bh-views" role="group" aria-label={ui.guide.viewsLabel}>
                  {bases.map((b) => (
                    <button key={b} type="button" aria-pressed={main === b}
                      onClick={() => { setView(b); if (selRow && selRow.base !== b) setSelected(null) }}>
                      {viewName(b)}
                    </button>
                  ))}
                </div>
              )}
              <button ref={closeRef} type="button" className="bh-close" onClick={() => setOpen(false)}
                aria-label={ui.builtHouse.close}>×</button>
            </div>
            <div className="bh-body">
              <figure className={'plate bh-sheet' + (selPlate ? '' : ' is-overview') + (sheetLabels.length ? ' has-legend' : '')}>
                <div className="guide-drawing" onClick={onSheetClick} dangerouslySetInnerHTML={{ __html: sheet }} />
                <PlateLegend labels={sheetLabels} />
                {model.notDrawn.length > 0 && (
                  <span className="bh-count bh-count-sheet">{fill(ui.builtHouse.notDrawn, { n: model.notDrawn.length })}</span>
                )}
              </figure>
              <div className="bh-index">
                {model.conflicts.length > 0 && (
                  <div className="bh-choices">
                    <h3>{ui.builtHouse.conflictsTitle}</h3>
                    <p>{ui.builtHouse.conflictsLead}</p>
                    <ul>
                      {model.conflicts.map(([a, b]) => (
                        <li key={a + b}>{fill(ui.builtHouse.conflictLine, { a: nameOf(a), b: nameOf(b) })}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <h3>{ui.builtHouse.indexTitle}</h3>
                <ul>
                  {model.rows.map((r) => {
                    const on = selected === r.sol.id
                    const sub = cat.subById[r.sol.subfunction_id]
                    return (
                      <li key={r.sol.id} className={'bh-row' + (on ? ' is-on' : '') + (r.base ? '' : ' is-undrawn')}>
                        <button type="button" disabled={!r.base} aria-pressed={r.base ? on : undefined}
                          onClick={() => select(r.sol.id)}>
                          <span className="bh-row-name">{cat.tName(r.sol)}</span>
                          {sub && <span className="bh-row-sub">{cat.tName(sub)}</span>}
                        </button>
                        {/* Buttons, not small links, which readers missed; both open a new tab, so
                            the drawing stays open (a user's session, 2026-11-03). */}
                        <span className="bh-row-links">
                          <a className="bh-row-btn" href={pathFor({ view: 'solution', id: r.sol.id }, lang)} target="_blank" rel="noopener">
                            {ui.builtHouse.solutionPage} <span aria-hidden="true">↗</span><span className="sr-only">{ui.solutionPage.opensNewTab}</span>
                          </a>
                          <TutorialsPick sol={r.sol} className="bh-row-btn" />
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {model.notDrawn.length > 0 && <p className="bh-note">{ui.builtHouse.notDrawnWhy}</p>}
                {/* CM1 place 3: before building, where to find help (the solution page's line). */}
                <WhereToFindHelp go={go} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
