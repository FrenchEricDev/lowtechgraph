import * as cat from '../catalogue.js'
import { ui, fill } from '../ui-strings.js'
import { plateFor, plateSvg, mobileView } from './plates.js'
import { sitePlateFor, sitePlateSvg } from './sitePlates.js'
import { numberLabels, altText } from './plateLegend.js'
import './plate.css'

/*
 * The illustration on a solution page: the whole drawing, scaled down at every width. It sits
 * after the summary and before the tutorials: site prerequisites first, then what it is, then
 * what it looks like, then how to build it. The zoomed phone framing (mobileView) is kept
 * commented out below; restoring it also needs the media query commented in plate.css.
 *
 * Below about 500 px the labels become numbered discs and the words are listed under the
 * sheet (PlateLegend); the same list is the drawing's text alternative (brief 02, B).
 */
export default function SolutionPlate({ sol }) {
  // Two bases: the house in section and the site in plan oblique. A solution has a plate on one
  // at most, and the page shows that one.
  const plate = plateFor(sol.id) || sitePlateFor(sol.id)
  if (!plate) return null
  const t = (en, fr) => (cat.getLang() === 'fr' ? fr : en)
  const render = plate.base === 'site' ? sitePlateSvg : plateSvg
  let labels = []
  const post = (p, f) => { const r = numberLabels(f); labels = r.labels; return r.fragment }
  const name = cat.tName(sol)
  // Rendered once for the labels, then with the alternative that names them. No title block on
  // the page (Eric, 2026-10-21: it repeats the title above and the caption below); plateSvg's
  // `titleBlock` stays for an image of the drawing shared on its own.
  render(plate, { t, post })
  const label = altText(name, plate.base, labels, ui, fill)
  const svg = (opts) => ({ __html: render(plate, { t, post, label, ...opts }) })
  return (
    <figure className={'plate' + (labels.length ? ' has-legend' : '')}>
      <div className="plate-wide" dangerouslySetInnerHTML={svg({})} />
      {/* The zoomed phone framing, off for now (see above):
      <div className="plate-narrow"
           dangerouslySetInnerHTML={svg({ view: mobileView(plate), chrome: false })} />
      */}
      <PlateLegend labels={labels} />
      <figcaption>{fill(ui.illustration.caption, { name })}</figcaption>
    </figure>
  )
}

/*
 * The words a narrow sheet takes off the drawing, by number. Hidden from a screen reader: the
 * drawing's own alternative already lists them.
 */
export function PlateLegend({ labels }) {
  if (!labels.length) return null
  return (
    <ol className="plate-legend" aria-hidden="true">
      {labels.map((l) => (
        <li key={l.n}><span className="plate-legend-n">{l.n}</span><span>{l.text}</span></li>
      ))}
    </ol>
  )
}

// Keeps the mobileView import referenced while the zoomed framing is commented out.
export { mobileView }
