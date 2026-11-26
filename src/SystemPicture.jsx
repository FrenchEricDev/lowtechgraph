import { useEffect, useState } from 'react'
import useDialog from './useDialog'
import * as cat from './catalogue.js'
import { loadHomeSystem } from './content.js'
import { ui, fill } from './ui-strings.js'

/*
 * An example home's whole system as it opens in My system (Eric, 2026-11-26): every card and every
 * link, drawn from the same system.json the builder opens, so it is never out of date and follows
 * the reading language. A picture, not the builder: nothing moves or opens here, the button under
 * it does that.
 *
 * The builder lays a home out in columns (one per step from the resources to the house) and rows;
 * this keeps those columns and rows but packs them, since a card here carries only its name.
 */
const W = 196          // a card
const H = 64
const GX = 56          // between columns: room for the links to bend
const GY = 14
const PAD = 9
const LINE = 15
const CHARS = 25       // per line at 13 px in a 196 px card, measured on the site's face

function wrap(text) {
  const words = text.split(/\s+/)
  const lines = ['']
  for (const w of words) {
    const cur = lines[lines.length - 1]
    if (cur && (cur + ' ' + w).length > CHARS) lines.push(w)
    else lines[lines.length - 1] = cur ? cur + ' ' + w : w
  }
  if (lines.length > 3) {
    lines.length = 3
    lines[2] = lines[2].replace(/\s*\S*$/, '') + '…'
  }
  return lines
}

function label(n) {
  if (n.sol) return cat.tName(cat.solById[n.sol])
  if (n.res) return cat.resourceLabel(n.res)
  return n.dest === 'home' ? ui.treeNode.homeNode
    : n.dest === 'dwelling' ? ui.treeNode.dwellingNode : ui.treeNode.destinationEnvironment
}

export default function SystemPicture({ id, whole }) {
  const [system, setSystem] = useState(null)
  const [big, setBig] = useState(false)
  useEffect(() => {
    let live = true
    loadHomeSystem(id).then((s) => { if (live) setSystem(s) })
    return () => { live = false }
  }, [id])
  if (!system) return <div className="syspic syspic-reserve" aria-hidden="true" />

  // Column and row from the builder's own grid (330 by 230, from 60), packed.
  const at = {}
  for (const n of system.nodes) {
    const col = Math.round((n.position.x - 60) / 330)
    const row = Math.round((n.position.y - 60) / 230)
    at[n.id] = { x: col * (W + GX), y: row * (H + GY), n }
  }
  const boxes = Object.values(at)
  const width = Math.max(...boxes.map((b) => b.x)) + W
  const height = Math.max(...boxes.map((b) => b.y)) + H
  const seen = new Set()
  const links = system.edges.filter((e) => {
    const k = e.source + '>' + e.target
    if (seen.has(k) || !at[e.source] || !at[e.target]) return false
    seen.add(k)
    return true
  })
  const cards = system.nodes.filter((n) => n.sol).length
  const name = fill(whole ? ui.guide.pictureNameHome : ui.guide.pictureNameSystem, { n: cards, links: links.length })

  const svg = (full) => (
      <svg viewBox={`-2 -2 ${width + 4} ${height + 4}`} role="img" aria-label={name}
           style={full ? { width: width + 4, height: height + 4 } : undefined}>
        <g className="syspic-links">
          {links.map((e) => {
            const a = at[e.source]
            const b = at[e.target]
            const x1 = a.x + W
            const y1 = a.y + H / 2
            const x2 = b.x
            const y2 = b.y + H / 2
            const bend = Math.max(GX, Math.abs(x2 - x1) / 2)
            return <path key={e.id} d={`M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`} />
          })}
        </g>
        {boxes.map(({ x, y, n }) => {
          const lines = wrap(label(n))
          const top = y + H / 2 - ((lines.length - 1) * LINE) / 2 + 4.5
          return (
            <g key={n.id} className={'syspic-card ' + (n.sol ? 'is-sol' : n.res ? 'is-res' : 'is-dest')}>
              <rect x={x} y={y} width={W} height={H} rx="8" />
              <text x={x + PAD} y={top}>
                {lines.map((l, i) => <tspan key={i} x={x + PAD} dy={i ? LINE : 0}>{l}</tspan>)}
              </text>
            </g>
          )
        })}
      </svg>
  )

  // F10-p (Eric, 2026-11-26): crowded, the picture is unreadable at the page's width, so it opens
  // full screen at its own size (13 px names), scrolling both ways.
  return (
    <>
      <div className="syspic">
        <button type="button" className="syspic-open" onClick={() => setBig(true)} aria-label={ui.guide.pictureEnlarge}>
          {svg(false)}
        </button>
        <button type="button" className="btn secondary syspic-enlarge" onClick={() => setBig(true)}>{ui.guide.pictureEnlarge}</button>
      </div>
      {big && <BigPicture name={name} onClose={() => setBig(false)}>{svg(true)}</BigPicture>}
    </>
  )
}

function BigPicture({ name, onClose, children }) {
  const box = useDialog(onClose, '.syspic-enlarge')
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div className="syspic-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="syspic-panel" role="dialog" aria-modal="true" aria-label={name} ref={box} tabIndex={-1}>
        <div className="syspic-head">
          <p>{name}</p>
          <button type="button" className="syspic-close" onClick={onClose} aria-label={ui.guide.pictureClose}>×</button>
        </div>
        <div className="syspic-scroll">{children}</div>
      </div>
    </div>
  )
}
