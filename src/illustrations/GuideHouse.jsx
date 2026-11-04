import { useEffect, useState } from 'react'
import * as cat from '../catalogue.js'
import { ui, fill } from '../ui-strings.js'
import { calm } from '../motion.js'
import Nav from '../Nav.jsx'
import { plateAt } from './plateHit.js'
import { AddButton, AddAllButton } from '../AddToTree.jsx'
import { plateFor, composedSvg } from './plates.js'
import { sitePlateFor, composedSiteSvg } from './sitePlates.js'
import { numberLabels, altText } from './plateLegend.js'
import { PlateLegend } from './Plate.jsx'
import './plate.css'

/*
 * A guide's picks drawn together on the house, above the list of picks (Eric, 2026-09-17).
 * Nothing selected: every pick's drawing on one sheet, faded, labels and bubbles hidden.
 * A pick selected: its drawing on top with its labels, the others faded, and its box unfolded
 * with the description, the reason and the link. Clicking a drawing selects its pick too.
 * Picks on the site plan get their own sheet, reached by the view switch or by selecting one.
 */
export default function GuideHouse({ picks, go, title }) {
  const t = (en, fr) => (cat.getLang() === 'fr' ? fr : en)
  const rows = picks.map((p) => {
    const section = plateFor(p.sol.id)
    const site = section ? null : sitePlateFor(p.sol.id)
    return { ...p, plate: section || site, base: section ? 'section' : site ? 'site' : null }
  })
  const plates = (base) => [...new Map(rows.filter((r) => r.base === base).map((r) => [r.plate.id, r.plate])).values()]
  const bases = ['section', 'site'].filter((b) => plates(b).length)
  // #SOL-123 in the address opens that pick, so a single pick can be linked to
  const fromHash = typeof window !== 'undefined' && rows.find((r) => '#' + r.sol.id === window.location.hash)
  const [open, setOpen] = useState(fromHash ? fromHash.sol.id : null)
  const [view, setView] = useState((fromHash && fromHash.base) || bases[0] || null)

  const current = rows.find((r) => r.sol.id === open)
  const shown = current && current.base ? current.base : view
  const select = (id) => {
    const r = rows.find((x) => x.sol.id === id)
    const hash = (h) => { try { history.replaceState(history.state, '', window.location.pathname + window.location.search + h) } catch { /* ignore */ } }
    if (open === id) { setOpen(null); hash(''); return }
    setOpen(id)
    hash('#' + id)
    if (r && r.base) setView(r.base)
  }
  const onDrawingClick = (e) => {
    const onSheet = (id) => rows.some((x) => x.base === shown && x.plate.id === id)
    const id = plateAt(e, e.currentTarget, onSheet)
    const r = id && rows.find((x) => x.base === shown && x.plate.id === id)
    if (r) select(r.sol.id)
  }
  // nothing chosen on this sheet: every pick faded, as the unchosen ones are once one is chosen
  const chosen = current && current.base === shown ? current.plate.id : null
  const layerClass = chosen ? () => '' : () => ' is-off'
  // The chosen pick's labels number on a phone like a solution page's (brief 02, B); the drawing
  // is named either way (A-A17).
  let labels = []
  const post = (p, f) => { if (p.id !== chosen) return f; const r = numberLabels(f); labels = r.labels; return r.fragment }
  const draw = (label) => (shown === 'site'
    ? composedSiteSvg(plates('site'), { t, selected: chosen, layerClass, post, label })
    : shown === 'section'
      ? composedSvg(plates('section'), { t, selected: chosen, layerClass, post, label })
      : '')
  draw(null)
  const name = current && current.base === shown
    ? altText(cat.tName(current.sol), shown, labels, ui, fill)
    : fill(shown === 'site' ? ui.guide.drawingNameSite : ui.guide.drawingName, { n: plates(shown).length, guide: title || '' })
  const html = draw(name)

  return (
    <>
      {html && (
        <figure className={'plate guide-house' + (current && current.base === shown ? '' : ' is-overview') + (labels.length ? ' has-legend' : '')}>
          {bases.length > 1 && (
            <div className="guide-views" role="group" aria-label={ui.guide.viewsLabel}>
              {bases.map((b) => (
                <button key={b} type="button" aria-pressed={shown === b}
                  onClick={() => { setView(b); if (current && current.base !== b) setOpen(null) }}>
                  {b === 'site' ? ui.guide.viewSite : ui.guide.viewSection}
                </button>
              ))}
            </div>
          )}
          <div className="guide-drawing" onClick={onDrawingClick} dangerouslySetInnerHTML={{ __html: html }} />
          <PlateLegend labels={labels} />
          <figcaption>{current ? cat.tName(current.sol) : ui.guide.drawingHint}</figcaption>
        </figure>
      )}

      <ol className="picks">
        {rows.map(({ sol, why }, i) => {
          const isOpen = open === sol.id
          return (
            <li key={sol.id} className={'pick' + (isOpen ? ' is-open' : '')}>
              <button type="button" className="pick-head" aria-expanded={isOpen}
                aria-controls={`pick-${sol.id}`} onClick={() => select(sol.id)}>
                <span className="pick-n" aria-hidden="true">{i + 1}</span>
                <span className="pick-name">{cat.tName(sol)}</span>
                <span className="pick-tri" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="pick-body" id={`pick-${sol.id}`}>
                  <p className="pick-sum">{cat.tSummary(sol)}</p>
                  {why && (
                    <p className="pick-why">
                      <span className="pick-why-label">{ui.guide.whyLabel}</span> {why}
                    </p>
                  )}
                  <div className="pick-actions">
                    <Nav route={{ view: 'solution', id: sol.id }} go={go} className="link-btn pick-link">
                      {ui.guide.openSolution}
                    </Nav>
                    <AddButton sol={sol} go={go} className="btn secondary" />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {/* The whole list onto the builder at once, next to anything already there. */}
      <AddAllButton sols={rows.map((r) => r.sol)} go={go} from={title} />
    </>
  )
}

/*
 * One solution's own drawing, with its labels, the whole of it a link to that solution's page:
 * the home page's drawing (brief 06; Eric, 2026-10-20: four plates composed on one house
 * collided, and a drawing that looked clickable led nowhere). Brief 02 will draw the house with
 * a person in it.
 */
export function HouseDrawing({ sol, go, caption, shortCaption }) {
  const plate = plateFor(sol.id)
  if (!plate) return null
  const t = (en, fr) => (cat.getLang() === 'fr' ? fr : en)
  const html = composedSvg([plate], { t, selected: plate.id, layerClass: () => '' })
  return (
    <Nav route={{ view: 'solution', id: sol.id }} go={go} className="home-house-link">
      <figure className="plate home-house">
        <div className="home-drawing" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
        <figcaption><span className="home-house-name">{cat.tName(sol)}</span>{caption && <span className="home-house-rest"> · {caption}</span>}{shortCaption && <span className="home-house-short"> · {shortCaption}</span>}</figcaption>
      </figure>
    </Nav>
  )
}

const ROTATE_MS = 6000

/*
 * The home page's drawing, turning through a few solutions (Eric, 2026-11-02: more alive, and it
 * shows the range). One round, then it rests on the first. It waits while the pointer or the
 * keyboard is on it, stops once a dot is chosen, and never turns under reduced motion or in a
 * hidden tab. All the slides stay in the grid, unseen, so the tallest caption sets the height and
 * nothing below moves at any width.
 */
export function HouseCarousel({ sols, go }) {
  const H = ui.home
  const C = ui.comparison
  const [index, setIndex] = useState(0)
  const [stopped, setStopped] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [turned, setTurned] = useState(false)   // the first drawing appears as it is, with no fade
  useEffect(() => {
    if (stopped || waiting || calm() || sols.length < 2) return undefined
    const timer = setInterval(() => {
      if (document.hidden) return
      setTurned(true)
      setIndex((i) => (i + 1) % sols.length)
    }, ROTATE_MS)
    return () => clearInterval(timer)
  }, [stopped, waiting, sols.length])
  useEffect(() => { if (turned && index === 0) setStopped(true) }, [turned, index])
  return (
    <div className="home-carousel" onPointerEnter={() => setWaiting(true)} onPointerLeave={() => setWaiting(false)}
         onFocus={() => setWaiting(true)} onBlur={() => setWaiting(false)}>
      <div className="home-slides">
        {sols.map((s, i) => (
          <div key={s.id} className={'home-slide' + (i === index ? (turned ? ' is-on is-turning' : ' is-on') : '')}>
            <HouseDrawing sol={s} go={go} caption={`${C.chooseIf} ${cat.L(s, 'choose_if')}`} shortCaption={H.carouselShort} />
          </div>
        ))}
      </div>
      <div className="home-dots" role="group" aria-label={H.carouselLabel}>
        {sols.map((s, i) => (
          <button key={s.id} type="button" className="home-dot" aria-current={i === index ? 'true' : undefined}
                  aria-label={fill(H.carouselShow, { name: cat.tName(s) })}
                  onClick={() => { setTurned(true); setIndex(i); setStopped(true) }} />
        ))}
      </div>
    </div>
  )
}

/*
 * A sub-need page's one drawing (Eric, 2026-10-21: the page is heavy with its comparison; one
 * plate, top right of the column, as on the home page): the first option with a section drawing,
 * a low-tech one with a tutorial before the rest.
 */
export function SubDrawing({ sols, go }) {
  const rank = (s) => (s.benchmark ? 2 : 0) + (s.tutorials.length ? 0 : 1)
  const sol = [...sols].filter((s) => plateFor(s.id)).sort((a, b) => rank(a) - rank(b))[0]
  return sol ? <HouseDrawing sol={sol} go={go} /> : null
}

/*
 * A guide's card on the guides index (Eric, 2026-10-21): its picks drawn together on the house,
 * as the guide's own page opens, at full weight and without labels at this size.
 */
export function GuideThumb({ picks }) {
  const plates = [...new Map(picks.map((p) => plateFor(p.sol.id)).filter(Boolean).map((p) => [p.id, p])).values()]
  if (!plates.length) return null
  const t = (en, fr) => (cat.getLang() === 'fr' ? fr : en)
  const html = composedSvg(plates, { t, layerClass: () => '', chrome: false })
  return <div className="plate guide-thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
}
