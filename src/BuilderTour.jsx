import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as cat from './catalogue'
import { ui, fill } from './ui-strings'
import { calm } from './motion.js'
import './BuilderTour.css'

/*
 * How the builder works, in about ten seconds (S8, Eric 2026-11-03): add a solution, tap what it
 * gives, pick what uses it, ask whether it could work. Drawn with the builder's own look, not a
 * video, so it is in the reading language, follows the theme and weighs nothing. The names are
 * the catalogue's, the rainwater example's first three cards.
 *
 * The scene is laid out once at STAGE_W x STAGE_H and scaled to its box. It loops with a Pause
 * button (anything moving for more than five seconds needs one, WCAG 2.2.2); with reduced motion
 * it shows the finished system and the four steps as a list.
 */
const STAGE_W = 520
const STAGE_H = 240

// [time in ms, step]. The pointer, the open lists and the cards all read the step.
const BEATS = [
  [300, 1], [1000, 2], [1500, 3], [2400, 4], [3000, 5], [3800, 6], [4400, 7],
  [5400, 8], [6000, 9], [6800, 10], [7400, 11], [8400, 12], [9000, 13],
]
const LOOP = 12500

const A = 'SOL-053'   // Rainwater harvesting and storage
const B = 'SOL-131'   // Bio-sand filter
const C = 'SOL-091'   // Gravity-fed shower
const RAW = 'IO-16'
const POTABLE = 'IO-09'
// Two other real options in each list, so it reads as a choice.
const ALSO_RAW = ['SOL-148', 'SOL-056']
const ALSO_POTABLE = ['SOL-070', 'SOL-092']

const name = (id) => cat.tName(cat.solById[id]) || id
const io = (id) => cat.tName(cat.ioById[id]) || id
const others = (ids) => ids.filter((id) => cat.solById[id]).map(name)

function MiniCard({ sol, takes, gives, giveRef, hot, style, on, fit }) {
  const T = ui.treeNode
  return (
    <div className={'bt-card' + (on ? ' is-on' : '') + (fit ? ' is-fit' : '')} style={style}>
      <b className="bt-name">{name(sol)}</b>
      {takes && <span className="bt-row"><span className="bt-lbl">{T.consumes}</span><span className="bt-chip is-linked">{io(takes)}</span></span>}
      {gives && <span className="bt-row"><span className="bt-lbl">{T.produces}</span><span ref={giveRef} className={'bt-chip' + (hot ? ' is-hot' : '')}>{io(gives)}</span></span>}
    </div>
  )
}

function Picker({ ioId, chosen, also, optRef, open, picked, style }) {
  return (
    <div className={'bt-pick' + (open ? ' is-on' : '')} style={style} aria-hidden="true">
      <div className="bt-pick-head">{fill(ui.tour.pickerHead, { io: io(ioId) })}</div>
      <div ref={optRef} className={'bt-pick-row' + (picked ? ' is-sel' : '')}>{name(chosen)}</div>
      {also.map((n) => <div key={n} className="bt-pick-row">{n}</div>)}
    </div>
  )
}

// A target's middle in stage units, from layout offsets: the camera's transform, mid-glide, would
// throw a measured rectangle off.
function middleIn(el, root) {
  let x = el.offsetWidth / 2, y = el.offsetHeight / 2
  for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop }
  return { x, y }
}

/*
 * `camera`: for a narrow 3:2 frame (the home page's card). The scene is filmed closer, about
 * CAMERA_W stage units wide, and the frame glides after the pointer, held inside the stage; it
 * pulls back to the whole system for the verdict. The caption rides on the drawing, and the
 * Pause button is placed by the page (`paused` comes from outside), since the card is a link.
 */
const CAMERA_W = 300

export default function BuilderTour({ camera = false, paused: pausedFrom }) {
  const still = calm()
  const [step, setStep] = useState(still ? 99 : 0)
  const [pausedHere, setPaused] = useState(false)
  const paused = camera ? !!pausedFrom : pausedHere
  const [size, setSize] = useState({ w: STAGE_W, h: STAGE_H })
  const [dot, setDot] = useState(null)
  const box = useRef(null)
  const stage = useRef(null)
  const refs = { add: useRef(null), giveA: useRef(null), opt1: useRef(null), giveB: useRef(null), opt2: useRef(null), check: useRef(null) }

  // The box's own size; the inline version scales the whole stage to its width, never past 1.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const k = Math.min(1, size.w / STAGE_W)

  // The timeline: one timer per beat, restarted for each loop; Pause clears them where they are.
  useEffect(() => {
    if (still || paused) return
    const from = (BEATS.find(([, x]) => x === step) || [0])[0]
    const timers = BEATS.filter(([, s]) => s > step).map(([t, s]) => setTimeout(() => setStep(s), t - from))
    timers.push(setTimeout(() => setStep(0), LOOP - from))
    return () => timers.forEach(clearTimeout)
  }, [step, paused, still])

  // Where the pointer goes at each step: the middle of what it is about to press, measured, so it
  // lands right in either language.
  const AIM = { 1: 'add', 2: 'add', 4: 'giveA', 5: 'giveA', 6: 'opt1', 8: 'giveB', 9: 'giveB', 10: 'opt2', 12: 'check', 13: 'check' }
  useLayoutEffect(() => {
    const target = refs[AIM[step]]?.current
    if (!target || !stage.current) { if (step === 0 || step >= 99) setDot(null); return }
    setDot(middleIn(target, stage.current))
  }, [step])  // eslint-disable-line react-hooks/exhaustive-deps

  const at = (s) => step >= s
  const pressing = [2, 5, 6, 9, 10, 13].includes(step)
  const T = ui.tour
  const caption = step >= 99 ? null : step >= 13 && camera ? T.verdict : step >= 12 ? T.step4 : step >= 7 ? T.step3 : step >= 4 ? T.step2 : T.step1
  const n = step >= 12 ? 4 : step >= 7 ? 3 : step >= 4 ? 2 : 1

  // The camera: close on the pointer; the whole stage before the first press and for the verdict.
  let view = `scale(${k})`
  if (camera) {
    const wide = step === 0 || step >= 13 || !dot
    const z = wide ? Math.min(size.w / STAGE_W, size.h / STAGE_H) : size.w / CAMERA_W
    const vw = size.w / z, vh = size.h / z
    const cx = wide ? STAGE_W / 2 : dot.x, cy = wide ? STAGE_H / 2 : dot.y
    const clamp = (v, lo, hi) => (hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)))
    const tx = clamp(cx - vw / 2, 0, STAGE_W - vw), ty = clamp(cy - vh / 2, 0, STAGE_H - vh)
    view = `scale(${z}) translate(${-tx}px, ${-ty}px)`
  }

  return (
    <figure className={'bt' + (camera ? ' is-camera' : '')} aria-label={T.label}>
      <div className="bt-box" ref={box} style={camera ? undefined : { height: STAGE_H * k }} aria-hidden="true">
        <div className="bt-stage" ref={stage} style={{ width: STAGE_W, height: STAGE_H, transform: view }}>
          <span ref={refs.add} className={'bt-btn is-add' + (step === 2 ? ' is-press' : '')}>+ {ui.tree.addSolutionButton}</span>
          <span ref={refs.check} className={'bt-btn is-check' + (at(13) ? ' is-press' : '')}>{ui.adequacy.button}</span>
          <svg className="bt-links" width={STAGE_W} height={STAGE_H}>
            <path className={'bt-link' + (at(7) ? ' is-on' : '')} d="M156 118 C172 118, 172 132, 188 132" />
            <path className={'bt-link' + (at(11) ? ' is-on' : '')} d="M336 150 C352 150, 352 104, 368 104" />
          </svg>
          <MiniCard sol={A} gives={RAW} giveRef={refs.giveA} hot={step === 5 || step === 6} on={at(3)} fit={at(13)}
                    style={{ left: 8, top: 56 }} />
          <MiniCard sol={B} takes={RAW} gives={POTABLE} giveRef={refs.giveB} hot={step === 9 || step === 10} on={at(7)} fit={at(13)}
                    style={{ left: 188, top: 86 }} />
          <MiniCard sol={C} takes={POTABLE} on={at(11)} fit={at(13)} style={{ left: 368, top: 56 }} />
          <Picker ioId={RAW} chosen={B} also={others(ALSO_RAW)} optRef={refs.opt1} open={step === 5 || step === 6} picked={step === 6}
                  style={{ left: 120, top: 132 }} />
          <Picker ioId={POTABLE} chosen={C} also={others(ALSO_POTABLE)} optRef={refs.opt2} open={step === 9 || step === 10} picked={step === 10}
                  style={{ left: 300, top: 52 }} />
          {!camera && <div className={'bt-verdict' + (at(13) ? ' is-on' : '')}>{T.verdict}</div>}
          {dot && <span className={'bt-dot' + (pressing ? ' is-press' : '')} style={{ left: dot.x, top: dot.y }} />}
        </div>
        {camera && caption && <span className={'bt-overlay' + (at(13) ? ' is-verdict' : '')}>{n}/4 · {caption}</span>}
      </div>
      {still ? (
        <ol className="bt-steps">
          <li>{T.step1}</li><li>{T.step2}</li><li>{T.step3}</li><li>{T.step4}</li>
        </ol>
      ) : !camera && (
        <figcaption className="bt-cap">
          <span className="bt-n">{n}/4</span>
          <span className="bt-cap-text">{caption}</span>
          <button type="button" className="bt-pause" aria-pressed={paused}
                  onClick={() => setPaused((p) => !p)}>
            {paused ? T.play : T.pause}
          </button>
        </figcaption>
      )}
      {/* For a screen reader, the four steps in words; the drawing itself is hidden from it. */}
      {!still && <p className="sr-only">{[T.step1, T.step2, T.step3, T.step4].join(' ')}</p>}
    </figure>
  )
}
