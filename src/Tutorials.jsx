import { useEffect, useId, useRef, useState } from 'react'
import Glyph from './Glyph.jsx'
import * as cat from './catalogue'
import { ui, fill } from './ui-strings'

/*
 * A solution's tutorials, as the solution page lists them, and the one control the builder's
 * cards and the house drawing use to reach them.
 */

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const isPdf = (url) => /\.pdf($|[?#])/i.test(url || '')

// The Low-tech Lab wiki is the one site named differently in French.
const siteLabel = (t) =>
  t.site === 'Low-tech Lab wiki' ? ui.solutionPage.lowtechLabWiki : (t.site || cat.displayUrl(t.url).split('/')[0])

/*
 * One tutorial: what it is (its own title, in its own language), where, in which language and
 * format, and who made it (brief 01; CM1 Q4: a maker is named, nothing more without their yes; the
 * link to a maker's own page lives on People and places). The whole row is the link, "also in
 * French" being the one other way out (Eric, 2026-11-01). Only the arrow says it leaves the site;
 * a screen reader hears it in words.
 */
export function TutorialRow({ t, line }) {
  const S = ui.solutionPage
  const format = isPdf(t.url) ? 'pdf' : (t.format || 'text')
  return (
    // The format first, as a column; then the title, what it covers (C3), and one line: source,
    // maker, language (Eric, 2026-10-22, option B).
    <li className="tut">
      <span className="tut-fmt">{format === 'video' && <Glyph name="play" size={11} />}{S.formatName[format]}</span>
      <a className="tut-link" href={t.url} target="_blank" rel="noreferrer">
        {/* i18n-ok: the tutorial's own title, in its own language */}
        <span className="tut-title" lang={t.lang || undefined}>{capFirst(t.title) || cat.tutorialLabel(t)}</span>
        {' '}<span aria-hidden="true">↗</span><span className="sr-only">{S.opensNewTab}</span>
      </a>
      {line && <p className="tut-line">{line}</p>}
      <p className="tut-meta">
        {siteLabel(t)}
        {t.maker && (
          <>
            {' · '}{S.tutorialBy.toLowerCase()}{' '}
            {/* i18n-ok: a maker's own name */}
            {t.maker}
          </>
        )}
        {t.lang && <> · {S.languageName[t.lang] || t.lang.toUpperCase()}</>}
        {t.twin && (
          <>
            {' · '}
            <a href={t.twin.url} target="_blank" rel="noreferrer" hrefLang={t.twin.lang}>
              {fill(S.alsoIn, { lang: S.languageName[t.twin.lang] })}<span className="sr-only"> {S.opensNewTab}</span>
            </a>
          </>
        )}
      </p>
    </li>
  )
}


/*
 * One tutorial: a link straight to it. Several: "Tutorials (3)", opening the same rows as the
 * solution page, so the reader picks rather than landing on whichever came first (a user's
 * session, 2026-11-03: the single link could open the wrong one). The list opens in place, under
 * the button, and closes on Escape or a tap outside it.
 */
export function TutorialsPick({ sol, className = '' }) {
  const T = ui.tutorialsPick
  const tuts = cat.tutorialsForLang(sol.tutorials)
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const btnRef = useRef(null)
  const listId = useId()
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  if (!tuts.length) return null
  if (tuts.length === 1) {
    return (
      <a className={'tut-pick-btn ' + className} href={tuts[0].url} target="_blank" rel="noreferrer">
        {T.one} <span aria-hidden="true">↗</span><span className="sr-only">{ui.solutionPage.opensNewTab}</span>
      </a>
    )
  }
  return (
    <span className={'tut-pick' + (open ? ' is-open' : '')} ref={boxRef}>
      <button type="button" ref={btnRef} className={'tut-pick-btn nodrag ' + className}
              aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        {fill(T.many, { n: tuts.length })} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <ul id={listId} className="tut-list tut-pick-list nodrag nowheel"
            aria-label={fill(T.listLabel, { name: cat.tName(sol) })}>
          {tuts.map((t, i) => <TutorialRow key={i} t={t} line={cat.tutorialLine(sol, t)} />)}
        </ul>
      )}
    </span>
  )
}
