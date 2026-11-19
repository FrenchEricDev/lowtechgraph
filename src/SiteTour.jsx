import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as cat from './catalogue'
import { ui, fill } from './ui-strings'
import { search } from './search.js'
import { calm } from './motion.js'
import verdict from 'virtual:site-tour-verdict'
import { RAIN, FILTER, SHOWER } from './siteTourSystem.js'
import { PEOPLE, entryMeta } from './People.jsx'
import { MiniCard } from './BuilderTour.jsx'
import Glyph from './Glyph.jsx'
import './BuilderTour.css'
import './SiteTour.css'

/*
 * The site in seven steps (F19, storyboard reviews/F19-Animation-Storyboard-2026-11-14.md,
 * decided by Eric 2026-11-15 and 2026-11-18). Drawn with the site's own pieces like the builder's
 * tour (S8): the strings and the catalogue's names are the real ones, so it follows the reading
 * language and never goes stale. One example all the way through: rain, a bio-sand filter, a shower.
 *
 * Seven scenes of SCENE_MS, looping (about 25 s). Each scene has its beats; the finger shows from
 * its `aim` beat and presses from its `press` beat. Pause, as anything moving for more than five
 * seconds needs one (WCAG 2.2.2); the dots (phone) or the captions (wide) jump to a scene. It only
 * runs while on screen. With reduced motion: the seven finished frames as a list, nothing moves.
 * Loaded after the home page (App.jsx), and the water verdict is worked out at build time
 * (vite.config.js), so the page never loads the check's engine.
 */
const STAGE_W = 360
const STAGE_H = 256
const MAX_K = 1.3
const SCENE_MS = 3600

const NEED = 'FN-06.1'                                     // Where the water comes from
const COMPARE = ['SOL-053', 'SOL-054', 'SOL-195']            // rain, a spring, the mains
const MEET = ['repaircafe', 'twiza', 'cat']

const lang = () => cat.getLang()
const sol = (id) => cat.solById[id]
const name = (id) => cat.tName(sol(id)) || id
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const num = (x) => x.toLocaleString(lang() === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })
const fade = (on) => 'st-fade' + (on ? ' is-on' : '')

// b: the beat reached in this scene. live: the timeline is running.
function SearchScene({ b, live }) {
  const word = ui.siteTour.searchWord
  const hits = (search(word).solutions || []).slice(0, 2)
  // The word is typed during beat 1, a letter at a time.
  const [n, setN] = useState(b >= 2 ? word.length : 0)
  useEffect(() => {
    if (b === 0) { setN(0); return }
    if (b >= 2 || !live) { if (b >= 2) setN(word.length); return }
    const t = setInterval(() => setN((x) => (x < word.length ? x + 1 : x)), 65)
    return () => clearInterval(t)
  }, [b, live, word])
  return (
    <>
      <div className="st-field" style={{ left: 16, top: 20, width: 328 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M9.5 9.5 13 13" stroke="currentColor" strokeWidth="1.6" /></svg>
        <span>{word.slice(0, n)}</span><span className="st-caret" />
      </div>
      <div className={'st-panel ' + fade(b >= 2)} style={{ left: 16, top: 62, width: 328 }}>
        <div className="st-head">{ui.searchPage.solutions}</div>
        {hits.map((s, i) => <div key={s.id} className={'st-row' + (i === 0 && b >= 3 ? ' is-lit' : '')} data-aim={i === 0 ? '0.92' : undefined}>{cat.tName(s)}</div>)}
      </div>
    </>
  )
}

function FilterScene({ b }) {
  const F = ui.facets
  const all = cat.catalogue.solutions
  const shown = b >= 2 ? cat.visibleSolutions(all, { ...cat.DEFAULT_FILTERS, flatOnly: true }).length : all.length
  const rows = [['flatOnly', true], ['retrofitOnly'], ['passiveOnly'], ['tutorialOnly']]
  return (
    <div className="st-panel" style={{ left: 16, top: 16, width: 328 }}>
      <div className="st-head">{F.heading}</div>
      {rows.map(([k, aim]) => {
        const on = aim && b >= 2
        return (
          <div key={k} className={'st-row st-check' + (on ? ' is-lit' : '')} data-aim={aim ? '0.9' : undefined}>
            <span className={'st-box-mark' + (on ? ' is-on' : '')}>{on && <Glyph name="check" size={11} />}</span>{F[k]}
          </div>
        )
      })}
      <div className="st-foot">{fill(F.count, { shown, total: all.length })}</div>
    </div>
  )
}

function CompareScene({ b }) {
  const C = ui.comparison
  const head = [C.colOption, C.tCost, C.tSkill, C.colFlat]
  const lit = b >= 2 ? 'is-lit' : undefined
  return (
    <>
      <div className="st-title" style={{ left: 16, top: 14 }}>{cat.tName(cat.subById[NEED])}</div>
      <table className="st-table" style={{ left: 16, top: 40, width: 328 }}>
        <thead><tr>{head.map((h, i) => <th key={h} className={i === 1 ? lit : undefined}>{h}</th>)}</tr></thead>
        <tbody>
          {COMPARE.filter(sol).map((id) => {
            const s = sol(id)
            return (
              <tr key={id} className={id === RAIN ? 'is-ours' : undefined}>
                <td>{name(id)}</td>
                <td className={lit} data-aim={id === RAIN ? '0.78' : undefined}>{cap(cat.tEnum(s.cost))}</td>
                <td>{cap(cat.tEnum(s.build_skill))}</td>
                <td>{s.flat_feasible ? C.yes : C.no}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function TutorialScene({ b }) {
  const s = sol(RAIN)
  const tuts = cat.tutorialsForLang(s.tutorials || []).slice(0, 3)
  const n = (s.tutorials || []).length
  return (
    <>
      <div className="st-title" style={{ left: 16, top: 14, width: 328 }}>{name(RAIN)}</div>
      <div className="st-panel" style={{ left: 16, top: 62, width: 328 }}>
        <div className="st-head">{ui.solutionPage.tutorialsHeading} · {fill(ui.tutorialsPick.many, { n })}</div>
        {tuts.map((t, i) => (
          <div key={t.url || i} className={'st-row st-tut' + (i === 1 && b >= 2 ? ' is-lit' : '')} data-aim={i === 1 ? '0.92' : undefined}>
            <span className="st-tut-title">{t.title}</span>
            <span className="st-tut-site">{t.site}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// A point of an element in stage units, from layout offsets (as in BuilderTour): a transform
// mid-glide would throw a measured rectangle off.
function at(el, root, fx, fy) {
  let x = el.offsetWidth * fx, y = el.offsetHeight * fy
  for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop }
  return { x, y }
}

function LinkScene({ b }) {
  const svg = useRef(null)
  const giveA = useRef(null)
  const giveB = useRef(null)
  const [low, setLow] = useState(120)
  const [paths, setPaths] = useState([])
  // Rain and the filter side by side, the shower under the filter. The third card's place and
  // the links are measured, so it holds whatever the names' length in either language.
  useLayoutEffect(() => {
    const root = svg.current?.parentNode
    if (!root || !giveA.current || !giveB.current) return
    const cards = root.querySelectorAll('.bt-card')
    const next = 12 + Math.max(cards[0].offsetHeight, cards[1].offsetHeight) + 22
    if (next !== low) { setLow(next); return }
    const a = at(giveA.current, root, 1, 0.5)
    const p = at(cards[1], root, 0, 0.72)
    const c = at(giveB.current, root, 0.5, 1)
    const d = at(cards[2], root, 0.5, 0)
    const mx = (a.x + p.x) / 2
    setPaths([
      `M${a.x} ${a.y} C${mx} ${a.y}, ${mx} ${p.y}, ${p.x} ${p.y}`,
      `M${c.x} ${c.y} C${c.x} ${(c.y + d.y) / 2}, ${d.x} ${(c.y + d.y) / 2}, ${d.x} ${d.y}`,
    ])
  }, [low])
  return (
    <>
      <svg ref={svg} className="bt-links" width={STAGE_W} height={STAGE_H}>
        {paths.map((d, i) => <path key={i} className={'st-link' + (b >= (i ? 4 : 2) ? ' is-on' : '')} d={d} pathLength="1" />)}
      </svg>
      <MiniCard sol={RAIN} gives="IO-16" giveRef={giveA} on style={{ left: 8, top: 12 }} />
      <MiniCard sol={FILTER} takes="IO-16" gives="IO-09" giveRef={giveB} on={b >= 1} style={{ left: 204, top: 12 }} />
      <MiniCard sol={SHOWER} takes="IO-09" on={b >= 3} style={{ left: 204, top: low }} />
      <span data-aim-at="takesC" />
    </>
  )
}

function CheckScene({ b }) {
  const A = ui.adequacy
  const v = verdict.verdict
  const mark = v === 'green' ? 'check' : v === 'red' ? 'close' : v === 'yellow' ? 'warning' : 'info'
  const band = verdict.band
  return (
    <div className="st-panel" style={{ left: 16, top: 12, width: 328 }}>
      <div className="st-title is-in">{A.title}</div>
      <div className="st-label">{A.check?.region}</div>
      <div className={'st-select' + (b === 2 ? ' is-press' : '')} data-aim="0.8">{`${verdict.dept.code} — ${verdict.dept.name}`}<span aria-hidden="true">▾</span></div>{/* i18n-ok: a département's name is the same in both languages, as in the panel */}
      <div className={'st-verdict ' + fade(b >= 3)} style={{ '--v': `var(--adq-${v}, var(--muted))`, '--v-bg': `var(--adq-${v}-bg, var(--bg))` }}>
        <Glyph name={mark} size={14} />
        <b>{A.families.water}</b><span className="st-v-word">{A.verdicts[v]}</span>
      </div>
      {band && <div className={'st-band ' + fade(b >= 3)}>{fill(A.bandReads, { low: num(band[0]), high: num(band[1]), period: A.periodAnnual })}</div>}
    </div>
  )
}

function PeopleScene({ b }) {
  const P = ui.people
  const l = lang()
  const rows = MEET.map((id) => PEOPLE.find((e) => e.id === id)).filter(Boolean)
  const title = (e) => (typeof e.title === 'object' ? e.title[l] || e.title.en : e.title)
  return (
    <>
      <div className="st-title" style={{ left: 16, top: 14 }}>{P.heading}</div>
      <div className="st-panel" style={{ left: 16, top: 48, width: 328 }}>
        <div className="st-head">{P.groupHeading.meet}</div>
        {rows.map((e, i) => (
          <div key={e.id} className={'st-row st-tut' + (i === 1 && b >= 2 ? ' is-lit' : '')} data-aim={i === 1 ? '0.92' : undefined}>
            <span className="st-tut-title">{title(e)}</span>
            <span className="st-tut-site">{entryMeta(e, l)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// beats: ms into the scene. The finger shows from `aim` and presses from `press`; the last beat is
// the finished frame.
const SCENES = [
  { C: SearchScene, beats: [0, 300, 1300, 1900], aim: 2, press: 3 },
  { C: FilterScene, beats: [0, 700, 1400], aim: 1, press: 2 },
  { C: CompareScene, beats: [0, 700, 1400], aim: 1, press: 2 },
  { C: TutorialScene, beats: [0, 700, 1400], aim: 1, press: 2 },
  { C: LinkScene, beats: [0, 500, 1000, 1600, 2100], aim: 3, press: 4 },
  { C: CheckScene, beats: [0, 700, 1300, 1900], aim: 1, press: 2 },
  { C: PeopleScene, beats: [0, 700, 1400], aim: 1, press: 2 },
]
const last = (i) => SCENES[i].beats.length - 1

// One frame: the stage scaled to its box, the scene at beat b, the finger, and the step's caption
// in the frame's foot, part of the drawing as in the builder's tour (Eric 2026-11-19). On a wide
// screen the foot hides and the captions are a list beside the frame.
function Frame({ scene, b, live, caption, still }) {
  const box = useRef(null)
  const stage = useRef(null)
  const [w, setW] = useState(STAGE_W)
  const [dot, setDot] = useState(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const k = Math.min(MAX_K, w / STAGE_W)
  const S = SCENES[scene]
  // The finger rests on what the frame is about: an element marked data-aim="x" (x across it,
  // halfway down). Scene 5 aims at the shower's "takes" chip, the link just made.
  useLayoutEffect(() => {
    const root = stage.current
    if (!root || b < S.aim) return
    const el = root.querySelector('[data-aim]') || (root.querySelector('[data-aim-at]') && root.querySelectorAll('.bt-card .bt-chip')[3])
    if (el) setDot(at(el, root, Number(el.dataset.aim || 0.88), 0.5))
  }, [scene, b, w, S.aim])
  return (
    <div className={'bt-box st-box' + (still ? ' is-still' : '')} ref={box}>
      <div className="st-room" style={{ height: STAGE_H * k }} aria-hidden="true">
        <div className="bt-stage" ref={stage} style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${k})` }}>
          <div className="st-scene" key={scene}><S.C b={b} live={live} /></div>
          {dot && <span className={'bt-dot' + (b >= S.press ? ' is-press' : '') + (b < S.aim ? ' is-off' : '')} style={{ left: dot.x, top: dot.y }} />}
        </div>
      </div>
      {/* Read once by a screen reader in the still list; while it plays, the list below is. */}
      <p className="st-foot-cap" aria-hidden={still ? undefined : 'true'}>
        <span className="st-foot-n">{scene + 1}/{SCENES.length}</span>
        <span key={scene} className="st-foot-text">{caption}</span>
      </p>
    </div>
  )
}

export default function SiteTour({ actions }) {
  const S = ui.siteTour
  const T = ui.tour
  const captions = [S.s1, S.s2, S.s3, S.s4, S.s5, S.s6, S.s7]
  const still = calm()
  const [scene, setScene] = useState(0)
  const [b, setB] = useState(0)
  const [paused, setPaused] = useState(false)
  const [seen, setSeen] = useState(false)
  const root = useRef(null)

  // Only while on screen: no timer runs for a reader who never scrolls down to it.
  useEffect(() => {
    const el = root.current
    if (!el || still || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [still])

  // The timeline: one timer per beat left in this scene, then the next scene; Pause and leaving
  // the screen clear them where they are.
  const live = !still && !paused && seen
  useEffect(() => {
    if (!live) return
    const beats = SCENES[scene].beats
    const from = beats[b]
    const timers = beats.map((t, i) => (i > b ? setTimeout(() => setB(i), t - from) : null)).filter(Boolean)
    timers.push(setTimeout(() => { setScene((s) => (s + 1) % SCENES.length); setB(0) }, SCENE_MS - from))
    return () => timers.forEach(clearTimeout)
  }, [live, scene, b])

  // A jump plays the scene from its start, or shows it finished while paused.
  const pick = (i) => { setScene(i); setB(paused ? last(i) : 0) }

  if (still) {
    return (
      <>
        <ol className="st-stills" aria-label={S.label}>
          {captions.map((c, i) => (
            <li key={c} className="st-still">
              <Frame scene={i} b={last(i)} live={false} caption={c} still />
            </li>
          ))}
        </ol>
        {actions && <div className="st-actions">{actions(-1)}</div>}
      </>
    )
  }

  return (
    <figure className="st" aria-label={S.label} ref={root}>
      <Frame scene={scene} b={b} live={live} caption={captions[scene]} />
      <figcaption className="st-side">
        {/* Phone: the caption is in the frame's foot, the dots below. Wide: the seven captions as a list. */}
        <ol className="st-list">
          {captions.map((c, i) => (
            <li key={c}>
              <button type="button" className={'st-item' + (i === scene ? ' is-on' : '')}
                      aria-current={i === scene ? 'step' : undefined} onClick={() => pick(i)}>
                <span className="st-item-n">{i + 1}</span>{c}
              </button>
            </li>
          ))}
        </ol>
        {/* For a screen reader on a phone, the seven steps in words; the drawing is hidden from it. */}
        <ol className="st-sr sr-only">{captions.map((c) => <li key={c}>{c}</li>)}</ol>
        <div className="st-controls">
          <div className="st-dots">
            {captions.map((c, i) => (
              <button key={c} type="button" className={'st-dot' + (i === scene ? ' is-on' : '')}
                      aria-current={i === scene ? 'step' : undefined}
                      aria-label={fill(S.goTo, { n: i + 1 })} onClick={() => pick(i)} />
            ))}
          </div>
          <button type="button" className="bt-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? T.play : T.pause}
          </button>
        </div>
      </figcaption>
      {/* Where to go and do it: the page's own links, the one for the step on screen lit (F19, Eric 2026-11-19). */}
      {actions && <div className="st-actions">{actions(scene)}</div>}
    </figure>
  )
}
