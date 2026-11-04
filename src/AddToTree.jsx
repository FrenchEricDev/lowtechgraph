import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import * as cat from './catalogue'
import { ui, fill } from './ui-strings'
import Nav from './Nav'
import { subscribeTree, isPlaced, addToTree, removeFromTree, connectInTree, disconnectInTree, linkedThrough, edgeKey } from './treeStore'
import { flyChip, bump } from './fly'
import Glyph, { ResourceMark } from './Glyph.jsx'

/*
 * Adding solutions to the builder without going there (Eric, 2026-09-23): the reader gathers
 * picks while browsing, then opens the builder to connect them and run the diagnosis.
 * Every add gives three signals: the control turns to "In my system", a chip flies to My system
 * (or to the menu button on a phone, where Build is hidden), and a message at the foot of the
 * screen offers the builder for seven seconds, then gets out of the way.
 */

export const usePlaced = (solId) =>
  useSyncExternalStore(subscribeTree, () => isPlaced(solId), () => false)

/* ---- the message at the foot of the screen */

let showToast = () => {}
// = --hold-message in index.css.
const HOLD_MESSAGE = 7000
// `undo`, when given, replaces "See my system" with an Undo button.
const toast = (text, undo) => showToast(text, undo)

export function AddToast({ go }) {
  const [msg, setMsg] = useState(null)       // { text, undo, n } ; n changes so a repeat restarts
  const timer = useRef(null)
  const start = () => {
    clearTimeout(timer.current)
    // Seven seconds, with or without Undo (Eric, 2026-10-18): a sentence and a link need it.
    timer.current = setTimeout(() => setMsg(null), HOLD_MESSAGE)
  }
  // A tap anywhere else dismisses it: only its own link takes taps.
  const boxRef = useRef(null)
  useEffect(() => {
    if (!msg) return
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setMsg(null) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [msg])
  useEffect(() => {
    let n = 0
    showToast = (text, undo) => { setMsg({ text, undo, n: ++n }); start() }
    return () => { showToast = () => {}; clearTimeout(timer.current) }
  }, [])
  // The live region stays in the page so a screen reader hears each message; its content comes
  // and goes. Pointer or focus inside holds it open (WCAG 2.2.1), leaving restarts the count.
  return (
    <div className="add-toast-region" role="status" aria-live="polite">
      {msg && (
        <div key={msg.n} ref={boxRef} className="add-toast"
             onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={start}
             onFocus={() => clearTimeout(timer.current)} onBlur={start}>
          <span>{msg.text}</span>
          {msg.undo ? (
            <button type="button" className="add-toast-go"
                    onClick={() => { const back = msg.undo(); setMsg(null); if (back) toast(ui.add.toastRestored) }}>
              {ui.add.undo}
            </button>
          ) : (
            <Nav route={{ view: 'tree' }} go={(r) => { setMsg(null); go(r) }} className="add-toast-go">
              {ui.add.open}
            </Nav>
          )}
        </div>
      )}
    </div>
  )
}

/* ---- the chip that flies to Build */

// Whichever of the two is on screen: Build on a wide bar, the menu button on a phone.
const buildTarget = () =>
  [...document.querySelectorAll('.hnav-item.has-count, .header .icon-btn[aria-controls="hmenu"]')]
    .find((t) => t.getBoundingClientRect().width > 0)

function flyFrom(el, n) {
  const target = buildTarget()
  flyChip(el, target, '+' + n, { onLand: () => bump(target) })
}

const addSols = (el, sols) => {
  const n = addToTree(sols.map((s) => s.id))
  if (!n) return
  flyFrom(el, n)
  toast(n === 1 && sols.length === 1
    ? fill(ui.add.toastOne, { name: cat.tName(sols[0]) })
    : fill(ui.add.toastMany, { n }))
}
// Pressing "Added" takes the solution out with its links; the message offers them back.
const removeSol = (sol) => {
  const undo = removeFromTree(sol.id)
  toast(fill(ui.add.toastRemoved, { name: cat.tName(sol) }), undo || undefined)
}

/* ---- the controls */

/*
 * The full control: solution page, comparison cards and guide picks. Once added it is a status,
 * "In my system", with the way there and a worded Remove beside it, not a button that deletes
 * (brief 01). `plan`: the solution page's Plan it, whose link says what to do there.
 * `compact`: a comparison table's row ("Add"; once added, the status and Remove only).
 * Focus follows the reader's own press: onto the status after adding, back onto the add
 * button after removing, so a keyboard is never dropped to the top of the page.
 */
export function AddButton({ sol, go, className = 'btn', plan = false, compact = false }) {
  const placed = usePlaced(sol.id)
  const pressed = useRef(false)
  const statusRef = useRef(null)
  const addRef = useRef(null)
  useEffect(() => {
    if (!pressed.current) return
    pressed.current = false
    ;(placed ? statusRef : addRef).current?.focus({ preventScroll: true })
  }, [placed])
  if (!placed) {
    return (
      <span className="add-wrap">
        <button type="button" ref={addRef} className={className}
                aria-label={compact ? fill(ui.add.plusAdd, { name: cat.tName(sol) }) : undefined}
                onClick={(e) => { pressed.current = true; addSols(e.currentTarget, [sol]) }}>
          {compact ? ui.comparison.colAdd : ui.add.add}
        </button>
      </span>
    )
  }
  return (
    <span className={'add-wrap is-in' + (compact ? ' is-compact' : '')}>
      <span className="add-status" ref={statusRef} tabIndex={-1}>
        <Glyph name="check" size={16} />{ui.add.inSystem}
      </span>
      <span className="add-after">
        {!compact && (
          <Nav route={{ view: 'tree' }} go={go} className="link add-open">
            {plan ? ui.add.linkIt : ui.add.open} <span aria-hidden="true">→</span>
          </Nav>
        )}
        <button type="button" className="link-btn add-remove"
                aria-label={fill(ui.add.removeLabel, { name: cat.tName(sol) })}
                onClick={() => { pressed.current = true; removeSol(sol) }}>
          {ui.add.remove}
        </button>
      </span>
    </span>
  )
}

// A guide's whole list. Adds only what is not there yet, and says so.
export function AddAllButton({ sols, go, from }) {
  useSyncExternalStore(subscribeTree, () => sols.filter((s) => isPlaced(s.id)).length, () => 0)
  const missing = sols.filter((s) => !isPlaced(s.id))
  const label = missing.length === 0 ? fill(ui.add.allIn, { n: sols.length })
    : missing.length === sols.length ? fill(ui.add.addAll, { n: sols.length })
      : fill(ui.add.addOthers, { n: missing.length })
  if (!missing.length) {
    return (
      <div className="guide-done">
        <p className="add-status"><Glyph name="check" size={16} />{label.replace(/^✓\s*/, '')}</p>
        <p className="guide-done-next">{ui.add.allInNext}</p>
        <Nav route={{ view: 'tree' }} go={go} className="btn secondary">{ui.add.open}</Nav>
      </div>
    )
  }
  return (
    <span className="add-wrap guide-add-all">
      <button type="button" className="btn"
              onClick={(e) => {
                addSols(e.currentTarget, missing)
                // Read by the builder on arrival (brief 03, E; cross-check): what this view is for.
                try { sessionStorage.setItem('lowtech_arrival', JSON.stringify({ from, ids: sols.map((s) => s.id), joined: !!document.querySelector('.nav-badge') })) } catch { /* fine */ }
              }}>
        {label}
      </button>
      {missing.length < sols.length && (
        <Nav route={{ view: 'tree' }} go={go} className="link-btn add-open">{ui.add.open}</Nav>
      )}
    </span>
  )
}

// The small square beside a list row: + to add, ✓ once added (pressing it takes it out).
export function AddPlus({ sol }) {
  const placed = usePlaced(sol.id)
  const name = cat.tName(sol)
  const label = fill(placed ? ui.add.plusRemove : ui.add.plusAdd, { name })
  return (
    <button type="button" className={'add-plus' + (placed ? ' is-added' : '')}
            aria-label={label} title={label}
            onClick={(e) => (placed ? removeSol(sol) : addSols(e.currentTarget, [sol]))}>
      <span aria-hidden="true">{placed ? '✓' : '+'}</span>
    </button>
  )
}

/* ---- connecting mode (D10 Q3, TODO F16) -------------------------------------------------
 *
 * Remembered, not silent: the reader follows an input or output from a solution page to the
 * resource's list, and the site remembers where they came from until they either connect
 * something (one tap, "Add and connect") or go elsewhere. Nothing is added without that tap
 * (Eric's principles, 2026-09-24: understandable before done, affordance carries meaning, the
 * user decides).
 *
 * `from` is the solution they started at, `io` the resource, `dir` the side of `from` it is on:
 * 'out' (from makes it, looking for what uses it) or 'in' (from needs it, looking for a source).
 */
let connecting = null
const connectListeners = new Set()
const subscribeConnect = (fn) => { connectListeners.add(fn); return () => connectListeners.delete(fn) }
const setConnecting = (c) => { connecting = c; connectListeners.forEach((fn) => fn()) }
export const startConnecting = (from, io, dir) => setConnecting({ from, io, dir })
export const stopConnecting = () => { if (connecting) setConnecting(null) }
export const useConnecting = () => useSyncExternalStore(subscribeConnect, () => connecting, () => null)

/* The solutions on the other side of the resource: what uses it, or what supplies it. */
export function candidatesOf(c) {
  if (!c) return new Set()
  const pool = c.dir === 'out' ? cat.consumersByIo[c.io] : cat.producersByIo[c.io]
  return new Set((pool || []).filter((id) => id !== c.from))
}

/*
 * Keeps the mode only where it means something: the resource's own page, the page of an option
 * on the other side (to compare before choosing), and the origin (Back). Anywhere else ends it.
 */
export function keepConnectingOn(route) {
  const c = connecting
  if (!c) return
  const keep = (route.view === 'io' && route.id === c.io)
    || (route.view === 'solution' && (route.id === c.from || candidatesOf(c).has(route.id)))
  if (!keep) stopConnecting()
}

const useEdges = () => useSyncExternalStore(subscribeTree, edgeKey, () => '')

function connectAndTell(el, c, sol) {
  const from = cat.solById[c.from]
  const { added, linked, undo } = connectInTree(c.from, sol.id, c.io, c.dir)
  const [a, b] = c.dir === 'out' ? [from, sol] : [sol, from]
  const names = { from: cat.tName(a), to: cat.tName(b) }
  if (added) {
    const target = buildTarget()
    flyChip(el, target, '+' + added, { onLand: () => bump(target) })
  }
  // The message offers Undo, as an add does (brief 09).
  if (added || linked) toast(fill(added ? ui.connect.toastAdded : ui.connect.toastLinked, names), undo)
}

function disconnectAndTell(c, sol) {
  const from = cat.solById[c.from]
  const undo = disconnectInTree(c.from, sol.id, c.io, c.dir)
  if (!undo) return
  const [a, b] = c.dir === 'out' ? [from, sol] : [sol, from]
  toast(fill(ui.connect.toastUnlinked, { from: cat.tName(a), to: cat.tName(b) }), undo)
}

/*
 * One tap: add what is missing and draw the link. Says which of the three it will do. Once
 * connected it is a status, "Connected to Gravity-fed shower", with the way to the system and
 * Disconnect beside it (brief 09; the same pattern as In my system / Remove). Focus moves to the
 * status, so a keyboard is not dropped when the button goes.
 */
export function ConnectButton({ sol, go, className = 'btn secondary connect-btn', compact = false }) {
  const c = useConnecting()
  useEdges()
  const placedHere = usePlaced(sol.id)
  const pressed = useRef(false)
  const statusRef = useRef(null)
  const btnRef = useRef(null)
  const already = !!c && linkedThrough(c.from, c.io, c.dir).some((s) => s.id === sol.id)
  useEffect(() => {
    if (!pressed.current) return
    pressed.current = false
    ;(already ? statusRef : btnRef).current?.focus({ preventScroll: true })
  }, [already])
  if (!c || sol.id === c.from) return null
  const origin = cat.tName(cat.solById[c.from])
  if (already) {
    return (
      <span className={'add-wrap is-in connect-done' + (compact ? ' is-compact' : '')}>
        <span className="add-status" ref={statusRef} tabIndex={-1}>
          <Glyph name="check" size={16} />{compact ? ui.connect.connected.replace(/^✓\s*/, '') : fill(ui.connect.connectedTo, { origin })}
        </span>
        <span className="add-after">
          {!compact && go && (
            <Nav route={{ view: 'tree' }} go={go} className="link add-open">
              {ui.add.open} <span aria-hidden="true">→</span>
            </Nav>
          )}
          <button type="button" className="link-btn add-remove"
                  aria-label={fill(ui.connect.disconnectLabel, { name: cat.tName(sol), origin })}
                  onClick={() => { pressed.current = true; disconnectAndTell(c, sol) }}>
            {ui.connect.disconnect}
          </button>
        </span>
      </span>
    )
  }
  const label = placedHere && isPlaced(c.from) ? ui.connect.connect : ui.connect.addConnect
  return (
    <button type="button" ref={btnRef} className={className}
            aria-label={fill(ui.connect.addConnectLabel, { name: cat.tName(sol), origin })}
            onClick={(e) => { pressed.current = true; connectAndTell(e.currentTarget, c, sol) }}>
      {label}
    </button>
  )
}

// A long name cut in the middle, so both ends stay readable in a one-line bar.
const middleCut = (s, max = 26) =>
  s.length <= max ? s : s.slice(0, Math.ceil(max * 0.6)).trimEnd() + '…' + s.slice(-Math.floor(max * 0.4)).trimStart()

/*
 * The memory made visible: which solution the reader is connecting, through what, and a way
 * out. On a phone one line of 44 px, "Connecting: Gravity-fed shower · greywater", the full
 * sentence on a tap; on a wide screen the sentence, "See my system" and Stop (brief 09). On the
 * page of an option on the other side, it also carries that option's button.
 */
export function ConnectBar({ route, go }) {
  const c = useConnecting()
  const [full, setFull] = useState(false)
  if (!c) return null
  const onIo = route.view === 'io' && route.id === c.io
  const onCandidate = route.view === 'solution' && candidatesOf(c).has(route.id)
  if (!onIo && !onCandidate) return null
  const from = cat.solById[c.from]
  const io = cat.tName(cat.ioById[c.io])
  const text = fill(c.dir === 'out' ? ui.connect.barOut : ui.connect.barIn, { name: cat.tName(from), io })
  const short = fill(ui.connect.barShort, { name: middleCut(cat.tName(from)), io: io.toLowerCase() })
  return (
    <div className={'connect-bar' + (full ? ' is-full' : '')} role="status">
      <span className="connect-bar-text is-long">{text}</span>
      <button type="button" className="connect-bar-text is-short" aria-expanded={full}
              aria-label={text} onClick={() => setFull((v) => !v)}>
        {full ? text : short}
      </button>
      {onCandidate && <ConnectButton sol={cat.solById[route.id]} className="btn connect-btn" compact />}
      {go && (
        <Nav route={{ view: 'tree' }} go={go} className="connect-bar-go">{ui.add.open}</Nav>
      )}
      <button type="button" className="connect-bar-x" aria-label={ui.connect.stop} title={ui.connect.stop}
              onClick={stopConnecting}><Glyph name="close" size={18} /></button>
    </div>
  )
}

/*
 * A solution's input or output on its page: the resource, how many solutions sit on the other
 * side, and what it is already linked to in the reader's system. Following it starts the mode.
 */
export function IoChip({ sol, ioId, dir, go }) {
  useEdges()
  const io = cat.ioById[ioId]
  const pool = (dir === 'out' ? cat.consumersByIo[ioId] : cat.producersByIo[ioId]) || []
  const n = pool.filter((id) => id !== sol.id).length
  const linked = linkedThrough(sol.id, ioId, dir)
  const C = ui.connect
  // Zero is said too (Eric, 2026-09-24): every chip reads the same way, and "0 solutions use it"
  // is itself worth knowing. French takes the singular for zero, so it has its own string.
  const pick = (zero, one, many) => (n === 0 ? zero : n === 1 ? one : many)
  const count = fill(dir === 'out' ? pick(C.usedByZero, C.usedByOne, C.usedByMany)
    : pick(C.madeByZero, C.madeByOne, C.madeByMany), { n })
  // Zero is not a dead end (brief 09, A): the chip first says what it is for. The count stays.
  const END = { home: C.endsHome, dwelling: C.endsDwelling, environment: C.endsEnvironment }
  const lead = n === 0
    ? (dir === 'out' ? END[cat.terminalsFor(ioId)[0]] : cat.isNaturalResource(ioId) ? C.fromNature : null)
    : null
  return (
    <Nav route={{ view: 'io', id: ioId }} className="chip io-chip"
         /* Nothing on the other side: the resource page opens, and no connecting mode starts
            on an empty list (Eric, 2026-10-12). */
         go={(r) => { if (n > 0) startConnecting(sol.id, ioId, dir); go(r) }}>
      <span className="io-chip-name">{io && <ResourceMark group={cat.resourceGroup(io)} />}{io ? cat.tName(io) : ioId}</span>
      {count && <span className="io-chip-count">{lead && <><b>{lead}</b> · </>}{count}</span>}
      {linked.length > 0 && (
        <span className="io-chip-linked">{fill(C.linkedTo, { names: linked.map((s) => cat.tName(s)).join(', ') })}</span>
      )}
    </Nav>
  )
}
