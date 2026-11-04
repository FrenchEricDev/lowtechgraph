import { useState, useRef, useEffect, useLayoutEffect, useCallback, useContext, createContext, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Glyph, { ResourceMark } from './Glyph.jsx'
import {
  ReactFlow, ReactFlowProvider, Background,
  useNodesState, useEdgesState, addEdge, Handle, Position,
  useReactFlow, useNodesInitialized, useStore, useUpdateNodeInternals,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import * as cat from './catalogue'
import { shareLink, copyText, prefersShareSheet } from './platform'
import { EXAMPLES } from './example-tree'
import Nav from './Nav'
import { pathFor } from './router'
import { TutorialsPick } from './Tutorials.jsx'
import BuilderTour from './BuilderTour.jsx'
import { ui, fill } from './ui-strings'
import AdequacyPanel from './adequacy/AdequacyPanel.jsx'
import BuiltHouse from './illustrations/BuiltHouse.jsx'
import { FacetHead, FacetControls } from './FacetBar.jsx'
import useDialog from './useDialog'
import { tradeoffs } from './tradeoffs.js'
import './TreeBuilder.css'
import diagnostic from 'virtual:catalogue-diagnostic'
import { rankSupply } from './adequacy/moves.js'
import { DRINKING, RAW, rawWaterWarnings } from './adequacy/water.js'
import { HASH_PREFIX, SCENARIO_KEY, decodeTree, edgeIos, encodeTree, hydrateTree, persistSession, serializeTree, treeSession, restoredFrom, forgetRestored } from './treeStore'
import { calm } from './motion.js'

// Set once the reader has seen or dismissed the builder's animation away from the empty canvas.
const TOUR_SEEN = 'lowtech_tour_seen'

// The start of a description, for a tooltip: its first dozen words, cut at a word.
const firstWords = (text, n = 12) => {
  const words = (text || '').split(/\s+/).filter(Boolean)
  return words.length <= n ? words.join(' ') : words.slice(0, n).join(' ').replace(/[,;:.]$/, '') + '…'
}

// All user-facing wording lives in ui-strings.js.

const TreeCtx = createContext(null)
const FINE_POINTER = typeof window !== 'undefined' && !!window.matchMedia
  && window.matchMedia('(pointer: fine)').matches

/* ---------- custom node ---------- */

/*
 * An input or output chip. It is the one move the builder is about, so an open one reads as a
 * button: an accent border and a raised edge (S3, 2026-09-24; a "+" was tried and dropped, its
 * meaning was not obvious). A linked one is filled; a spare one is grey.
 * `hinted`: the chip the tip points at, pulsing while the canvas has cards and no link.
 */
function IoButton({ dir, io, linked, spare, hinted, onClick }) {
  const open = !linked && !spare
  const name = cat.tName(cat.ioById[io.io]) || io.name
  return (
    <button aria-label={`${name}: ${dir === 'in' ? ui.treeNode.consumes : ui.treeNode.produces}, ${linked ? ui.treeNode.chipLinked : ui.treeNode.chipOpen}`}
            className={'nodrag ' + 'tio ' + dir + (linked ? ' linked' : '') + (spare ? ' spare' : '')
                       + (open ? ' is-open' : '') + (hinted ? ' is-hinted' : '')}
            title={spare ? ui.treeNode.alternativeCovered
                         : dir === 'in' ? ui.treeNode.findProducers : ui.treeNode.findConsumers}
            onClick={onClick}>
      {cat.ioById[io.io] && <ResourceMark group={cat.resourceGroup(cat.ioById[io.io])} size={13} />}{name}
    </button>
  )
}

/*
 * "Fix it" on a constraint warning (Eric, 2026-09-25): the catalogue solutions that would satisfy
 * the rule, each offered as one step. Nothing changes until the reader picks one (actions are
 * understood before they are done; users decide). The options are computed on opening, from the
 * graph as it is then.
 */
function FixIt({ id }) {
  const { fixOptions, applyFix, reveal } = useContext(TreeCtx)
  const [open, setOpen] = useState(false)
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  // The list makes the card taller: a card near the canvas edge had its options cut off.
  useEffect(() => {
    if (!open) return undefined
    const t = requestAnimationFrame(() => reveal([id]))
    return () => cancelAnimationFrame(t)
  }, [open, id, reveal])
  const opts = open ? fixOptions(id) : []
  const nameOf = (n) => (n?.data.sol ? cat.tName(n.data.sol)
    : n?.data.io ? (cat.tName(cat.ioById[n.data.io.io]) || n.data.label) : '')
  const labelOf = (o) => {
    if (o.mode === 'add') return fill(ui.treeNode.fixAdd, { name: cat.tName(o.sol) })
    const from = nameOf(o.from)
    return from ? fill(ui.treeNode.fixInsert, { name: cat.tName(o.sol), from })
      : fill(ui.treeNode.fixInsertShort, { name: cat.tName(o.sol) })
  }
  return (
    <div className="tnode-fix nodrag">
      <button type="button" className="tnode-fix-btn nodrag" aria-expanded={open}
              onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}>
        {ui.treeNode.fixButton} <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && !narrow && (
        <div className="tnode-fix-list">
          {opts.length ? opts.map((o) => (
            <button key={o.key} type="button" className="tnode-fix-opt nodrag"
                    onClick={(e) => { e.stopPropagation(); applyFix(id, o); setOpen(false) }}>
              {labelOf(o)}
            </button>
          )) : <p className="tnode-fix-none">{ui.treeNode.fixNone}</p>}
        </div>
      )}
      {/* On a phone the options come up as a sheet over the canvas, never cut by its edge
          (brief 03, B); out of the card, since a transformed card would trap a fixed box. */}
      {open && narrow && createPortal(
        <>
          <div className="fix-sheet-back" onPointerDown={() => setOpen(false)} aria-hidden="true" />
          <div className="fix-sheet" role="dialog" aria-modal="true" aria-label={ui.treeNode.fixButton}>
            <div className="fix-sheet-head">
              <b>{ui.treeNode.fixSheetTitle}</b>
              <button type="button" className="tnode-x nodrag" aria-label={ui.adequacy.close} onClick={() => setOpen(false)}>×</button>
            </div>
            <p className="fix-sheet-note">{ui.treeNode.fixSheetNote}</p>
            {opts.length ? opts.map((o) => (
              <button key={o.key} type="button" className="tnode-fix-opt nodrag"
                      onClick={() => { applyFix(id, o); setOpen(false) }}>
                {labelOf(o)}
              </button>
            )) : <p className="tnode-fix-none">{ui.treeNode.fixNone}</p>}
          </div>
        </>, document.body)}
    </div>
  )
}

function SolutionNode({ id, data }) {
  const { onIo, onDelete, onReplace, onToggle, expanded, linked, pressureWarnings, hostWarnings, rawWarnings, closedLoops, filters, hintChip, portrait } = useContext(TreeCtx)
  const s = data.sol
  const hinted = (dir, io) => !!hintChip && hintChip.nodeId === id && hintChip.dir === dir && hintChip.io === io
  const isOpen = expanded.has(id)
  const link = linked[id] || { in: new Set(), out: new Set() }
  const zoom = useStore((st) => st.transform[2])
  if (zoom < COMPACT_BELOW && !isOpen) {
    const isIn = (io) => link.in.has(io) || link.in.has(cat.ioById[io] ? cat.ioById[io].name : io)  // i18n-ok: id first, name only for older edges
    const openIn = cat.offeredInputs(s).filter((i) => !isIn(i.io) && !(s.input_groups || []).some((g) => g.includes(i.io) && g.some((x) => x !== i.io && isIn(x))))
    const openOut = s.outputs.filter((o) => !(link.out.has(o.io) || link.out.has(o.name)))  // i18n-ok: id first, name only for older edges
    const nothing = !link.in.size && !link.out.size
    const T = ui.treeNode
    const status = nothing && (openIn.length || openOut.length) ? T.compactNothing
      : !openIn.length && !openOut.length ? T.compactAll
        : [openIn.length === 1 ? fill(T.compactInOne, { io: cat.tName(cat.ioById[openIn[0].io]).toLowerCase() }) : openIn.length ? fill(T.compactInMany, { n: openIn.length }) : null,
           openOut.length === 1 ? fill(T.compactOutOne, { io: cat.tName(cat.ioById[openOut[0].io]).toLowerCase() }) : openOut.length ? fill(T.compactOutMany, { n: openOut.length }) : null]
            .filter(Boolean).join(' · ')
    return (
      <div className={'tnode is-compact' + (s.benchmark ? ' is-benchmark' : '') + (s.societal ? ' is-societal is-societal-' + s.societal : '')}
           data-sol={s.id}>
        <Handle type="target" position={IN_AT(portrait)} />
        <span className="tnode-name">{cat.tName(s)}</span>
        <span className="tnode-status">{status}</span>
        <Handle type="source" position={OUT_AT(portrait)} />
      </div>
    )
  }
  const alts = (cat.solsBySubfunction[s.subfunction_id] || []).length
  // is-societal marks the rows that are the connection to the outside world (grid, mains,
  // sewer, kerbside collection).
  return (
    <div className={'tnode' + (s.benchmark ? ' is-benchmark' : '')
                            + (s.societal ? ' is-societal is-societal-' + s.societal : '')}
         data-sol={s.id /* where the house vignette's chip starts from */}>
      <Handle type="target" position={IN_AT(portrait)} />
      <div className="tnode-head">
        {/* The tag sits under the name, not beside it: beside it, it took the width a long
            name needs (Gas boiler (condensing), MVHR). */}
        <span className="tnode-title">
          <span className="tnode-name">{cat.tName(s)}{s.societal && <span className="sr-only">, {ui.treeNode.societalNote}</span>}</span>
          {s.benchmark && <span className="benchmark-tag" title={ui.benchmark.tooltip}><Glyph name="gear" size={13} />{ui.benchmark.tag}</span>}
        </span>
        {/* Hovering shows how the description starts, so a glance says what the card is
            (a user's session, 2026-11-03). */}
        <button className="tnode-i nodrag" title={isOpen ? ui.treeNode.less : firstWords(cat.tSummary(s)) || ui.treeNode.moreInfo}
                aria-label={isOpen ? ui.treeNode.less : ui.treeNode.moreInfo} aria-expanded={isOpen} onClick={() => onToggle(id)}>{isOpen ? '▴' : <Glyph name="info" size={20} />}</button>
        <button className="tnode-x nodrag" title={ui.treeNode.delete} aria-label={fill(ui.treeNode.deleteNamed, { name: cat.tName(s) })} onClick={() => onDelete(id)}>×</button>
      </div>
      <div className="tnode-io">
        <div className="tcol">
          <div className="tcol-lbl">{ui.treeNode.consumes}</div>
          {s.inputs.length ? s.inputs.filter((i) => cat.offeredInputs(s).includes(i) || link.in.has(i.io)).map((i) => {
            const isLinked = (io) => link.in.has(io) || link.in.has(cat.ioById[io] ? cat.ioById[io].name : io)  // i18n-ok: id first, name only for edges saved before they carried an id
            // one of a group is enough (S9): the rest go grey, and stay connectable
            const spare = !isLinked(i.io) && (s.input_groups || [])
              .some((g) => g.includes(i.io) && g.some((io) => io !== i.io && isLinked(io)))
            return <IoButton key={i.io} dir="in" io={i} linked={isLinked(i.io)} spare={spare}
                             hinted={hinted('in', i.io)} onClick={() => onIo(id, 'in', i.io)} />
          }) : <span className="tio-none">{ui.solutionPage.none}</span>}
        </div>
        <div className="tcol right">
          <div className="tcol-lbl">{ui.treeNode.produces}</div>
          {s.outputs.length ? s.outputs.map((o) => (
            <IoButton key={o.io} dir="out" io={o} linked={link.out.has(o.io) || link.out.has(o.name)} hinted={hinted('out', o.io)} onClick={() => onIo(id, 'out', o.io)} />  // i18n-ok: id first, name only for edges saved before they carried an id
          )) : <span className="tio-none">{ui.solutionPage.none}</span>}
        </div>
      </div>
      {isOpen && (
        <div className="tnode-more">
          <div className="tnode-crumbs">
            {cat.tName(cat.fnById[s.function_id])} · {cat.tName(cat.subById[s.subfunction_id])}
          </div>
          <p className="tnode-desc">{cat.tSummary(s)}</p>
          {/* The comparison's five levels, the same words as the solution page (U-F21). */}
          <dl className="tnode-levels">
            {tradeoffs(s, ui, cat.tEnum).map((t) => (
              <div key={t.key}><dt>{t.label}</dt><dd>{t.word}</dd></div>
            ))}
          </dl>
          {alts <= 1 && <p className="tnode-only">{ui.treeNode.onlyOptionForNeed}</p>}
          <TutorialsPick sol={s} className="tnode-tut" />
        </div>
      )}
      {hostWarnings.has(id) && (
        <div className="tnode-warn" role="status" title={ui.treeNode.hostWarning[hostWarnings.get(id)]}>
          <Glyph name="warning" size={14} className="tnode-warn-mark" /><span>{ui.treeNode.hostWarning[hostWarnings.get(id)]}</span>
        </div>
      )}
      {pressureWarnings.has(id) && (
        <div className="tnode-warn" role="status" title={ui.treeNode.needsPressureWarning}>
          <Glyph name="warning" size={14} className="tnode-warn-mark" /><span>{ui.treeNode.needsPressureWarning}</span>
        </div>
      )}
      {rawWarnings.has(id) && (() => {
        // With treated water arriving too, name the card the untreated water comes from.
        const w = rawWarnings.get(id)
        const text = w.mixed ? fill(ui.treeNode.rawWaterWarningMixed, { from: w.names.join(', ') }) : ui.treeNode.rawWaterWarning
        return (
          <div className="tnode-warn" role="status" title={text}>
            <Glyph name="warning" size={14} className="tnode-warn-mark" /><span>{text}</span>
          </div>
        )
      })()}
      {(hostWarnings.has(id) || pressureWarnings.has(id) || rawWarnings.has(id)) && <FixIt id={id} />}
      {closedLoops.has(id) && (
        <div className="tnode-warn" role="status" title={ui.treeNode.closedLoopWarning}>
          <Glyph name="warning" size={14} className="tnode-warn-mark" /><span>{ui.treeNode.closedLoopWarning}</span>
        </div>
      )}
      <div className="tnode-actions">
        {/* Offered only where there is something to swap to, counted with the same filter the picker applies. */}
        {cat.visibleSolutions(cat.solsBySubfunction[s.subfunction_id] || [], filters).length > 1 && (
          <button className="tnode-act nodrag" onClick={() => onReplace(id)}>{ui.treeNode.replace}</button>
        )}
        {/* Always a new tab, and says so: leaving the builder for the page lost the reader's
            place (a user's session, 2026-11-03). */}
        <a href={pathFor({ view: 'solution', id: s.id }, cat.getLang())} target="_blank" rel="noopener"
           className="tnode-act">
          {ui.treeNode.details} <span aria-hidden="true">↗</span><span className="sr-only">{ui.solutionPage.opensNewTab}</span>
        </a>
      </div>
      <Handle type="source" position={OUT_AT(portrait)} />
    </div>
  )
}

function ResourceNode({ id, data }) {
  const { onIo, onDelete, linked, portrait } = useContext(TreeCtx)
  const io = data.io
  const link = linked[id] || { in: new Set(), out: new Set() }
  return (
    <div className="tnode is-resource">
      <div className="tnode-head">
        <span className="tnode-name"><Glyph name="leaf" className="glyph-resource" /> {cat.resourceLabel(io.io)}</span>
        <button className="tnode-x nodrag" title={ui.treeNode.delete} aria-label={fill(ui.treeNode.deleteNamed, { name: cat.resourceLabel(io.io) })} onClick={() => onDelete(id)}>×</button>
      </div>
      <div className="tnode-io">
        <div className="tcol right">
          <div className="tcol-lbl">{ui.treeNode.naturalResource}</div>
          {/* i18n-ok: id first, name only for edges saved before they carried an id */}
          <IoButton dir="out" io={io} linked={link.out.has(io.io) || link.out.has(io.name)} onClick={() => onIo(id, 'out', io.io)} />
        </div>
      </div>
      <Handle type="source" position={OUT_AT(portrait)} />
    </div>
  )
}

/*
 * Where an output ends up, so daylight, space heat and CO2 do not dangle. Not policed by IO
 * type: CO2 arriving in the home is a true statement about a hob without extraction, not an
 * error to prevent.
 */
function DestinationNode({ id, data }) {
  const { onDelete, onIo, arrivingAt, linked, portrait } = useContext(TreeCtx)
  const home = data.dest === 'home'
  // The building: reduced heat loss and gain act on the envelope, not on what the household
  // uses or leaves behind.
  const dwelling = data.dest === 'dwelling'
  const arriving = arrivingAt[id] || []
  // Only the house emits (what the household leaves behind); the environment and the building
  // are pure sinks.
  const emits = home ? cat.householdSources : []
  const accepted = cat.acceptedAt(data.dest)
  const link = linked[id] || { in: new Set(), out: new Set() }
  return (
    <div className={'tnode is-destination is-wide'
                    + (home ? ' is-home' : dwelling ? ' is-dwelling' : ' is-env')}>
      <Handle type="target" position={IN_AT(portrait)} />
      {home && <Handle type="source" position={OUT_AT(portrait)} />}
      <div className="tnode-head">
        <span className="tnode-name">{home ? '🏠' : dwelling ? '🧱' : '🌍'} {
          home ? ui.treeNode.homeNode
               : dwelling ? ui.treeNode.dwellingNode
                          : ui.treeNode.destinationEnvironment}</span>
        <button className="tnode-x nodrag" title={ui.treeNode.delete} onClick={() => onDelete(id)}
                aria-label={fill(ui.treeNode.deleteNamed, { name: home ? ui.treeNode.homeNode : dwelling ? ui.treeNode.dwellingNode : ui.treeNode.destinationEnvironment })}>×</button>
      </div>
      {/* What has actually arrived here; the full list of what it could take belongs in the modal and on the output button. */}
      <div className="tnode-io">
        {/* Everything this ending can take; what has arrived carries .linked. */}
        <div className="tcol tcol-accepts">
          <div className="tcol-lbl">{ui.treeNode.accepts}</div>
          {/* Buttons, not labels: an input chip here asks "what produces this?", as on a solution card. */}
          <div className="tio-grid">
            {accepted.map((t) => (
              <button key={t.id}
                      className={'nodrag ' + 'tio in' + (arriving.includes(t.id) ? ' linked' : '')}
                      onClick={() => onIo(id, 'in', t.id)}>
                {cat.tName(t)}
              </button>
            ))}
          </div>
        </div>
        {/* Everything the house can emit, as buttons: they are how a reader chains a toilet onto the household. */}
        {!!emits.length && (
          <div className="tcol">
            <div className="tcol-lbl">{ui.treeNode.produces}</div>
            {emits.map((r) => (
              <button key={r.io}
                      className={'nodrag ' + 'tio out' + (link.out.has(r.io) ? ' linked' : '')}
                      onClick={() => onIo(id, 'out', r.io)}>
                {cat.tName(cat.ioById[r.io]) || r.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const nodeTypes = { solution: SolutionNode, resource: ResourceNode, destination: DestinationNode }

// The flow library's screen-reader words, in the reader's language (B4). Read at each render:
// `ui` follows the language switch.
const flowAriaFor = () => ({
  'node.a11yDescription.default': ui.tree.a11y.node,
  'node.a11yDescription.keyboardDisabled': ui.tree.a11y.nodeMove,
  'node.a11yDescription.ariaLiveMessage': ({ direction }) => fill(ui.tree.a11y.moved, { direction: ui.tree.a11y.dir[direction] || direction }),
  'edge.a11yDescription.default': ui.tree.a11y.edge,
  'handle.ariaLabel': ui.tree.a11y.handle,
})

/* ---------- modal + pickers ---------- */

function Modal({ title, onClose, children, head = null }) {
  // Close only when the press started on the backdrop: a drag released outside, or iOS's
  // delayed synthetic click landing on the new backdrop, would otherwise close the modal inside
  // the tap that opened it.
  const downOnBackdrop = useRef(false)
  const box = useDialog(onClose)
  return (
    <div className="modal-back"
         onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
         onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={box}
           onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2 className="modal-title">{title}</h2>{head}<button className="tnode-x" aria-label={ui.adequacy.close} onClick={onClose}>×</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// Pick any solution. Used for "Add" and "Replace".
//   • empty search  -> collapsible function -> sub-function -> solution browser
//     (same hierarchy as the home page, unfolded with ▸/▾ triangles)
//   • typing         -> flat filtered list (name / function / sub-function match)
//   • restrictSub    -> flat list of one sub-function's options (Replace)
function SolutionPicker({ onPick, filters, restrictSub }) {
  const [q, setQ] = useState('')
  const [openFns, setOpenFns] = useState(() => new Set())
  const [openSubs, setOpenSubs] = useState(() => new Set())
  const toggle = (setSet, id) =>
    setSet((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const query = q.trim().toLowerCase()
  const vis = (sols) => cat.visibleSolutions(sols || [], filters)

  const searchBox = (
    /* Focused at once only with a mouse: on a phone the keyboard covered the list it offers. */
    <input className="picker-search" type="search" autoFocus={FINE_POINTER} value={q} onChange={(e) => setQ(e.target.value)}
           aria-label={restrictSub ? ui.treeModals.searchOptionsPlaceholder : ui.treeModals.searchPlaceholder}
           placeholder={restrictSub ? ui.treeModals.searchOptionsPlaceholder : ui.treeModals.searchPlaceholder} />
  )

  // --- flat mode: a sub-function's options, or an active text search ---
  if (restrictSub || query) {
    const pool = vis(restrictSub ? cat.solsBySubfunction[restrictSub] : cat.catalogue.solutions)
    // One matcher, shared with the site search, matching both languages.
    const list = query
      ? pool.filter((s) =>
          cat.matchesName(s, query) ||
          cat.matchesName(cat.fnById[s.function_id], query) ||
          cat.matchesName(cat.subById[s.subfunction_id], query))
      : pool
    const byFn = {}
    for (const s of list) (byFn[s.function_id] ||= []).push(s)
    return (
      <div>
        {searchBox}
        <div className="picker-list">
          {list.length === 0 && <div className="tio-none">{ui.treeModals.noMatches}</div>}
          {cat.catalogue.functions.filter((f) => byFn[f.id]).map((f) => (
            <div key={f.id}>
              {!restrictSub && <div className="picker-fn">{cat.tName(f)}</div>}
              {byFn[f.id].map((s) => (
                <button key={s.id} className="picker-item" onClick={() => onPick(s)}>
                  <span>{cat.tName(s)}</span>
                  {s.benchmark && <span className="benchmark-tag" title={ui.benchmark.tooltip}><Glyph name="gear" size={13} />{ui.benchmark.tag}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- browse mode: collapsible function -> sub-function -> solutions ---
  return (
    <div>
      {searchBox}
      <div className="picker-list">
        {cat.catalogue.functions.map((f) => {
          const fnOpen = openFns.has(f.id)
          const subs = cat.subsOf(f.id).filter((sub) => vis(cat.solsBySubfunction[sub.id]).length)
          if (!subs.length) return null
          return (
            <div key={f.id}>
              <button className="picker-branch" onClick={() => toggle(setOpenFns, f.id)}
                      aria-expanded={fnOpen} aria-controls={`picker-${f.id}`}>
                <span className="picker-tri" aria-hidden="true">{fnOpen ? '▾' : '▸'}</span>
                <span>{cat.tName(f)}</span>
              </button>
              {/* `display: contents`: the panel exists for aria-controls without changing the list */}
              <div className="branch-panel" id={`picker-${f.id}`}>
              {fnOpen && subs.map((sub) => {
                const subSols = vis(cat.solsBySubfunction[sub.id])
                const subOpen = openSubs.has(sub.id)
                return (
                  <div key={sub.id} className="picker-sub">
                    <button className="picker-branch lvl2" onClick={() => toggle(setOpenSubs, sub.id)}
                            aria-expanded={subOpen} aria-controls={`picker-${sub.id}`}>
                      <span className="picker-tri" aria-hidden="true">{subOpen ? '▾' : '▸'}</span>
                      <span>{cat.tName(sub)}</span>
                      <span className="sugg-tier">{subSols.length}</span>
                    </button>
                    <div className="branch-panel" id={`picker-${sub.id}`}>
                    {subOpen && subSols.map((s) => (
                      <button key={s.id} className="picker-item lvl3" onClick={() => onPick(s)}>
                        <span>{cat.tName(s)}</span>
                        {s.benchmark && <span className="benchmark-tag" title={ui.benchmark.tooltip}><Glyph name="gear" size={13} />{ui.benchmark.tag}</span>}
                      </button>
                    ))}
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SuggestionList({ ask, filters, placedIds, destsPlaced, onPick, onPickResource, onPickDestination, onPickHousehold }) {
  const io = cat.ioById[ask.io]
  // suggestChain returns { sol, ... } wrappers; the facets read the solution. Passing the
  // wrappers straight in let every suggestion through whatever was set (fixed 2026-09-23).
  const items = cat.suggestChain({ io: ask.io, dir: ask.dir, sourceSolId: ask.sol, placedIds })
    .filter(({ sol }) => cat.visibleSolutions([sol], filters).length > 0)
  const placed = new Set(placedIds || [])
  // When looking for producers of an input, offer the natural resource itself.
  const naturalIo = ask.dir === 'in' && cat.NATURAL_RESOURCE_IDS.includes(ask.io)
    ? cat.resourceDescriptor(ask.io) : null
  // The household side of the same idea: the house supplies what its people leave behind.
  // Offered on an input only.
  const householdIo = ask.dir === 'in' && cat.isHouseholdSource(ask.io)
  const label = fill(
    ask.dir === 'out' ? ui.treeModals.suggestionConsumes : ui.treeModals.suggestionProduces,
    // tName, not .name, which is the raw English string.
    { io: cat.tName(io) || ask.io })
  // An advisory IO has no consumers by design, so the heading says what is actually on offer.
  const advisoryOut = ask.dir === 'out' && items.length === 0 && (io || {}).advisory
  // The places a clicked output can end, kept only where this resource can end there; the
  // group's heading shows only if something sits under it.
  const destinations = ask.dir === 'out' ? [
    ['home', '🏠', ui.treeModals.destinationHomeOption, ui.treeModals.destinationHomeHint],
    ['dwelling', '🧱', ui.treeModals.destinationDwellingOption, ui.treeModals.destinationDwellingHint],
    ['environment', '🌍', ui.treeModals.destinationEnvOption, ui.treeModals.destinationEnvHint],
  ].filter(([kind]) => cat.terminalsFor(ask.io).includes(kind)) : []
  // Cards already on the canvas come first, in their own group (S3, 2026-09-24): a reader who
  // gathered solutions while browsing arrives with a tray of them, and linking those is the job.
  const coll = new Intl.Collator(cat.getLang())
  const onCanvas = items.map(({ sol }) => sol)
    .filter((sol) => placed.has(sol.id) && sol.id !== ask.sol)
    .sort((a, b) => coll.compare(cat.tName(a), cat.tName(b)))
  const onCanvasIds = new Set(onCanvas.map((s) => s.id))
  // Grouped by need, needs in the reading language's order, solutions by name within a need.
  const byNeed = useMemo(() => {
    const m = new Map()
    for (const { sol } of items) {
      if (onCanvasIds.has(sol.id)) continue
      if (!m.has(sol.function_id)) m.set(sol.function_id, [])
      m.get(sol.function_id).push(sol)
    }
    for (const list of m.values()) list.sort((a, b) => coll.compare(cat.tName(a), cat.tName(b)))
    return [...m.entries()].sort((a, b) =>
      coll.compare(cat.tName(cat.fnById[a[0]]) || '', cat.tName(cat.fnById[b[0]]) || ''))
  }, [items, onCanvas.length])  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <p className="muted small">{advisoryOut
        ? fill(ui.treeModals.suggestionAdvisory, { io: cat.tName(io) || ask.io })
        : fill(ui.treeModals.suggestionIntro, { what: label })}</p>
      <div className="picker-list">
        {/* Two kinds of answer, kept apart (TODO S4): what the resource can come from or end up
            as, then the solutions, grouped by need. */}
        {(naturalIo || householdIo || destinations.length > 0) && (
          <div className="picker-fn">
            {ask.dir === 'out' ? ui.treeModals.groupDestinations : ui.treeModals.groupSources}
          </div>
        )}
        {naturalIo && (
          <button className="picker-item resource-opt" onClick={onPickResource}>
            <span><Glyph name="leaf" className="glyph-resource" /> {cat.resourceLabel(naturalIo.io)}</span>
            <span className="sugg-tier">{ui.treeModals.placeAsResource}</span>
          </button>
        )}
        {householdIo && (
          <button className="picker-item household-opt" onClick={onPickHousehold}>
            <span>🏠 {ui.treeNode.homeNode}</span>
            {destsPlaced?.has('home')
              ? <span className="sugg-placed">{ui.treeModals.alreadyPlaced}</span>
              : <span className="sugg-tier">{ui.treeModals.placeAsHousehold}</span>}
          </button>
        )}
        {/* The mirror of placing a natural resource: a sink for a clicked output, so a graph gets ends rather than dangling edges. */}
        {destinations.map(([kind, glyph, label, hint]) => (
          <button key={kind} className="picker-item resource-opt"
                  onClick={() => onPickDestination(kind)}>
            <span>{glyph} {label}</span>
            {/* Picking it links to the one already there, so it says so, as a placed card does
                (a user's session, 2026-11-03). */}
            {destsPlaced?.has(kind)
              ? <span className="sugg-placed">{ui.treeModals.alreadyPlaced}</span>
              : <span className="sugg-tier">{hint}</span>}
          </button>
        ))}
        {items.length === 0 && !naturalIo && !householdIo && ask.dir !== 'out' && <div className="tio-none">{ui.treeModals.noCataloguedMatch}</div>}
        {onCanvas.length > 0 && (
          <div className="sugg-group is-on-canvas">
            <div className="picker-fn">{ui.treeModals.groupOnCanvas}</div>
            {onCanvas.map((sol) => (
              <button key={sol.id} className="picker-item sugg-row is-placed" onClick={() => onPick(sol)}>
                <span className="picker-name">{cat.tName(sol)}</span>
                <span className="picker-tags">
                  <span className="sugg-placed">{ui.treeModals.linkToIt}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {byNeed.map(([fnId, sols]) => (
          <div key={fnId} className="sugg-group">
            <div className="picker-fn">{cat.tName(cat.fnById[fnId])}</div>
            {sols.map((sol) => (
              <button key={sol.id} className={'picker-item sugg-row' + (placed.has(sol.id) ? ' is-placed' : '')}
                      onClick={() => onPick(sol)}>
                <span className="picker-name">{cat.tName(sol)}</span>
                <span className="picker-tags">
                  {placed.has(sol.id) && <span className="sugg-placed">{ui.treeModals.alreadyPlaced}</span>}
                  {sol.benchmark && <span className="benchmark-tag" title={ui.benchmark.tooltip}><Glyph name="gear" size={13} />{ui.benchmark.tag}</span>}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Group icons for the network picker: a townscape for what arrives, a cistern for what leaves,
// since one utility's icon would misname the group.
// Drawn marks for the three mains kinds (brief 12: no emoji; they ignored the palette and the theme).
const MAINS_ICON = { supply: 'tap', stock: 'tank', sink: 'drain' }


function Canvas({ filters, setFilter, go, seed, lang }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(treeSession.nodes)
  /*
   * Each card's size at full size, for Arrange (Eric, 2026-10-20): arranged while zoomed out,
   * the name-only cards overlapped once brought close. Recorded whenever a card is measured at
   * reading zoom; estimated from its chips until then.
   */
  const fullSizes = useRef(new Map())
  const onNodesChangeTracked = useCallback((changes) => {
    // The zoom the cards are drawn at now: a card measured below it is the name-only card.
    if (rfApi.current && rfApi.current.getViewport().zoom >= COMPACT_BELOW) {
      for (const c of changes) if (c.type === 'dimensions' && c.dimensions) fullSizes.current.set(c.id, c.dimensions)
    }
    onNodesChange(changes)
  }, [onNodesChange])
  const rfApi = useRef(null)
  const [edges, setEdges, onEdgesChange] = useEdgesState(treeSession.edges)
  const counter = useRef(treeSession.counter)
  useEffect(() => { treeSession.nodes = nodes; persistSession() }, [nodes])
  useEffect(() => { treeSession.edges = edges; persistSession() }, [edges])
  const [adding, setAdding] = useState(false)
  const [ask, setAsk] = useState(null)      // { node, dir, io, sol, pos }
  const [replacing, setReplacing] = useState(null) // node id
  const [treesModal, setTreesModal] = useState(false)
  const [treeName, setTreeName] = useState(treeSession.name)  // i18n-ok: the tree name the user typed
  useEffect(() => { treeSession.name = treeName; persistSession() }, [treeName])  // i18n-ok: the tree name the user typed
  // A worked example's name is a key, not a string (2026-10-10): it is read in the current
  // language, so a French reader opening an English reader's shared example sees it in French.
  // `name` is still stored beside it, for builds that do not know the key. Typing a name drops it.
  const [nameKey, setNameKey] = useState(treeSession.nameKey || null)
  useEffect(() => { treeSession.nameKey = nameKey; persistSession() }, [nameKey])
  useEffect(() => { if (nameKey && ui.tree[nameKey]) setTreeName(ui.tree[nameKey]) }, [nameKey, lang])
  const [resourceModal, setResourceModal] = useState(false)
  const [mainsModal, setMainsModal] = useState(false)
  const [destModal, setDestModal] = useState(false)
  const [shareText, setShareText] = useState(null)
  const [shareUrl, setShareUrl] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [copied, setCopied] = useState(false)
  const shareBox = useRef(null)
  const [expanded, setExpanded] = useState(() => new Set())
  const [, setRefresh] = useState(0)
  const bump = () => setRefresh((r) => r + 1)

  // The adequacy check is an explicit step, not an ambient warning: it needs scenario inputs
  // and would fire constantly on a half-built graph.
  const [pickedEdge, setPickedEdge] = useState(null)   // the link a tap selected (S2)
  const [viewport, setViewport] = useState(null)       // pan/zoom, so the Remove button follows
  const canvasRef = useRef(null)
  /*
   * The four add buttons fold into "+ Add" when the row would not fit (Eric, 2026-10-20: labels
   * wrapped and More left the screen between 760 and 1050 px). Measured, not a breakpoint: the
   * French labels are longer. The name slot keeps at least SLOT_MIN before the row folds.
   */
  const barRef = useRef(null)
  const addRowWidth = useRef(0)
  const [folded, setFolded] = useState(false)
  const fitBar = useCallback(() => {
    const bar = barRef.current
    if (!bar) return
    // The landscape strip down the left (132 px): always "+ Add".
    if (getComputedStyle(bar).flexDirection === 'column') { setFolded(true); return }
    const row = bar.querySelector('.tree-add-row')
    if (row && row.offsetWidth) addRowWidth.current = row.offsetWidth
    const slot = bar.querySelector('.tree-name-slot, .tree-toolbar-gap')
    const SLOT_MIN = slot && slot.classList.contains('tree-name-slot') ? 96 : 0
    const slack = slot ? slot.offsetWidth : 0
    setFolded((f) => {
      // A phone hides the row by CSS: nothing to fold.
      if (!f) return !!(row && row.offsetWidth) && (bar.scrollWidth > bar.clientWidth || slack < SLOT_MIN)
      const menu = bar.querySelector('.tree-add')
      const grows = addRowWidth.current - (menu ? menu.offsetWidth : 0)
      // Never measured (the strip, or a phone, came first): unfold once to measure.
      if (!addRowWidth.current) return false
      return slack - grows < SLOT_MIN
    })
  }, [])
  const [adequacyOpen, setAdequacyOpen] = useState(false)
  /*
   * The ten-second animation away from the empty canvas (S8, Eric 2026-11-04): a reader who added
   * cards while browsing arrives here with no idea how it works, and never saw the empty canvas.
   * "?" opens it at any time; once per device, a reader with cards and no link yet is offered it
   * in a small panel, gone at "Got it" or at their first link.
   */
  const [tourOpen, setTourOpen] = useState(false)
  const [tourSeen, setTourSeen] = useState(() => { try { return localStorage.getItem(TOUR_SEEN) === '1' } catch { return false } })
  const markTourSeen = () => { setTourSeen(true); try { localStorage.setItem(TOUR_SEEN, '1') } catch { /* fine */ } }
  const [houseKey, setHouseKey] = useState(0)   // bumped to open the built house's sheet
  /*
   * Arriving from a guide's "Add these N" (J-F9): say what this view is for. Whether the picks
   * share a resource decides the sentence; the line goes once dismissed or once a link is drawn.
   */
  const [arrival, setArrival] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('lowtech_arrival') || 'null') } catch { return null }
  })
  // A system kept from an earlier visit: say so, once, with the way to start fresh.
  const [restored, setRestored] = useState(() => (restoredFrom && treeSession.nodes.length ? restoredFrom : null))
  const dropRestored = () => { forgetRestored(); setRestored(null) }
  const dropArrival = () => { try { sessionStorage.removeItem('lowtech_arrival') } catch { /* fine */ } setArrival(null) }
  const arrivalSols = arrival ? arrival.ids.map((x) => cat.solById[x]).filter(Boolean) : []
  const arrivalShare = arrivalSols.some((a) => arrivalSols.some((b) => a !== b
    && (a.outputs || []).some((o) => (b.inputs || []).some((i) => i.io === o.io))))
  useEffect(() => { if (arrival && edges.length) dropArrival() }, [edges.length])  // eslint-disable-line react-hooks/exhaustive-deps
  // On a coarse pointer the first fit stops at reading size (brief 03, A: about 0.6).
  const touchFloor = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 0.6 : undefined
  const closeAdequacy = useCallback(() => setAdequacyOpen(false), [])
  const [facetsOpen, setFacetsOpen] = useState(false)   // the filter panel in a solution picker
  const solIdsInTree = useMemo(() => nodes.filter((n) => n.data.sol).map((n) => n.data.sol.id), [nodes])
  const solsInTree = useMemo(() => nodes.filter((n) => n.data.sol).map((n) => n.data.sol), [nodes])

  // The engine identifies by node (two filters are two filters). It counts only linked cards,
  // and reads edges to tell parallel from series.
  const adequacyGraph = useMemo(() => ({
    linkedOnly: true,
    nodes: nodes.filter((n) => n.data.sol).map((n) => ({ id: n.id, sol: n.data.sol.id })),
    edges: edges.map((e) => ({ from: e.source, to: e.target, ios: edgeIos(e) })),
  }), [nodes, edges])

  // The IO ids that have actually reached each destination, in the order they were wired.
  const arrivingAt = useMemo(() => {
    const m = {}
    const dests = new Set(nodes.filter((n) => n.data.dest).map((n) => n.id))
    for (const e of edges) {
      if (!dests.has(e.target)) continue
      for (const io of edgeIos(e)) {
        ;(m[e.target] ||= []).includes(io) || (m[e.target] ||= []).push(io)
      }
    }
    return m
  }, [nodes, edges])

  // Nodes caught in a loop that nothing feeds. Cycles are legitimate (water heated, used,
  // returned); a cycle with nothing entering it is not. Flag a strongly connected component
  // only when no edge reaches it from outside. Tarjan, iterative, so a large graph cannot
  // overflow the stack.
  const closedLoops = useMemo(() => {
    // The house is exempt: house to greywater to treatment to toilet to house is the
    // circularity the catalogue is for. Edges leaving a home node are dropped, so no cycle
    // routes through it.
    const homeIds = new Set(nodes.filter((n) => n.data?.dest === 'home').map((n) => n.id))
    const out = {}
    for (const e of edges) {
      if (homeIds.has(e.source)) continue
      ;(out[e.source] ||= []).push(e.target)
    }

    const index = {}, low = {}, onStack = new Set(), stack = []
    const comps = []
    let counter = 0

    for (const root of nodes.map((n) => n.id)) {
      if (index[root] !== undefined) continue
      // Each frame is [node, position in its adjacency list].
      const work = [[root, 0]]
      while (work.length) {
        const frame = work[work.length - 1]
        const [v, i] = frame
        if (i === 0) {
          index[v] = low[v] = counter++
          stack.push(v)
          onStack.add(v)
        }
        const kids = out[v] || []
        if (i < kids.length) {
          frame[1]++
          const w = kids[i]
          if (index[w] === undefined) work.push([w, 0])
          else if (onStack.has(w)) low[v] = Math.min(low[v], index[w])
        } else {
          if (low[v] === index[v]) {
            const comp = []
            for (;;) {
              const w = stack.pop()
              onStack.delete(w)
              comp.push(w)
              if (w === v) break
            }
            comps.push(comp)
          }
          work.pop()
          if (work.length) {
            const parent = work[work.length - 1][0]
            low[parent] = Math.min(low[parent], low[v])
          }
        }
      }
    }

    const flagged = new Set()
    for (const comp of comps) {
      const members = new Set(comp)
      // A single node is only a loop if it feeds itself.
      const isLoop = comp.length > 1 || edges.some((e) => e.source === comp[0] && e.target === comp[0])
      if (!isLoop) continue
      const fedFromOutside = edges.some((e) => members.has(e.target) && !members.has(e.source))
      if (!fedFromOutside) comp.forEach((id) => flagged.add(id))
    }
    return flagged
  }, [nodes, edges])

  // Host attachment: unlike pressure, the host must be the direct producer (a coil round one
  // stove's flue), so this reads immediate parents only and must never become a chain walk.
  const hostWarnings = useMemo(() => {
    const parents = {}
    for (const e of edges) (parents[e.target] ||= []).push(e.source)
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    const flagged = new Map()
    for (const n of nodes) {
      const need = n.data.sol?.host_required
      if (!need) continue
      const direct = parents[n.id] || []
      // Unconnected is not yet wrong: a node just placed has no parents.
      if (!direct.length) continue
      const ok = direct.some((pid) => byId[pid]?.data.sol?.host_provides === need)
      if (!ok) flagged.set(n.id, need)
    }
    // Input via (2026-09-25): a named resource must come in straight from a row providing a
    // kind. Greywater reaches a toilet through a diversion, never straight from a shower. Same
    // warning slot and message table as the host rule; again immediate parents only.
    for (const n of nodes) {
      const via = n.data.sol?.input_via
      if (!via || flagged.has(n.id)) continue
      for (const e of edges) {
        if (e.target !== n.id) continue
        const ios = e.data?.ios || [e.data?.io ?? e.io]
        const bad = Object.entries(via).find(([io, kind]) =>
          ios.includes(io) && byId[e.source]?.data.sol?.host_provides !== kind)
        if (bad) { flagged.set(n.id, bad[1]); break }
      }
    }
    return flagged
  }, [nodes, edges])

  // Pressure check: a solution needing pressurised water must have a pressure source (mains or
  // a pump) somewhere upstream. Walks the edges backwards; structural, so it needs no sizing
  // data.
  const pressureWarnings = useMemo(() => {
    const parents = {}
    for (const e of edges) (parents[e.target] ||= []).push(e.source)
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    const hasSourceUpstream = (startId) => {
      const seen = new Set([startId])
      const queue = [...(parents[startId] || [])]
      while (queue.length) {
        const id = queue.shift()
        if (seen.has(id)) continue      // cycle guard
        seen.add(id)
        if (byId[id]?.data.sol?.provides_pressure) return true
        queue.push(...(parents[id] || []))
      }
      return false
    }
    const flagged = new Set()
    for (const n of nodes) {
      if (n.data.sol?.needs_pressure && !hasSourceUpstream(n.id)) flagged.add(n.id)
    }
    return flagged
  }, [nodes, edges])

  // Raw water reaching a shower or a basin: linkable, with a warning (C10).
  const rawWarnings = useMemo(() => {
    const solOf = new Map(adequacyGraph.nodes.map((n) => [n.id, cat.solById[n.sol]]))
    const m = rawWaterWarnings(adequacyGraph.nodes, adequacyGraph.edges, cat.solById)
    for (const w of m.values()) w.names = w.from.map((x) => cat.tName(solOf.get(x)))
    return m
  }, [adequacyGraph])

  // Which IO types on each node are wired, keyed by IO id, never by the translated label (kept
  // only for trees saved before edges carried ids).
  const linked = useMemo(() => {
    const m = {}
    for (const e of edges) {
      // Every flow on the edge, not just the first.
      const ks = edgeIos(e)
      const keys = ks.length ? ks : [e.label]
      for (const k of keys) {
        ;(m[e.source] ??= { in: new Set(), out: new Set() }).out.add(k)
        ;(m[e.target] ??= { in: new Set(), out: new Set() }).in.add(k)
      }
    }
    return m
  }, [edges])

  const cardName = (id) => {
    const n = nodes.find((x) => x.id === id)
    if (!n) return ''
    if (n.data.sol) {
      return cat.tName(n.data.sol) + (n.data.sol.societal ? ', ' + ui.treeNode.societalNote : '')
    }
    if (n.data.io) return cat.resourceLabel(n.data.io.io)
    return n.data.dest === 'home' ? ui.treeNode.homeNode
      : n.data.dest === 'dwelling' ? ui.treeNode.dwellingNode : ui.treeNode.destinationEnvironment
  }

  // Edge labels are derived per render from the IO ids, so they follow the current language
  // rather than the one the edge was made in.
  const shownEdges = useMemo(() => edges.map((e) => {
    const names = edgeIos(e).map((io) => cat.tName(cat.ioById[io])).filter(Boolean)
    const name = names.join(', ')
    // interactionWidth: the invisible stroke that takes the tap, 34 units rather than the
    // default 20, because M9 measured thumbs missing the handles at that size.
    const base = { ...e, interactionWidth: 34, selected: e.id === pickedEdge,
      ariaLabel: fill(ui.tree.linkLabel, { from: cardName(e.source), to: cardName(e.target), io: name || '' }) }
    return name && name !== base.label ? { ...base, label: name } : base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [edges, nodes, lang, pickedEdge])

  // A card just added arrives (brief 13): it fades in and grows slightly, and keeps an outline
  // for 1.5 s; under reduced motion only the outline. Not on the first load.
  const [arriving, setArriving] = useState(() => new Set())
  const seenNodes = useRef(null)
  useEffect(() => {
    const ids = nodes.map((n) => n.id)
    if (seenNodes.current) {
      const fresh = ids.filter((id) => !seenNodes.current.has(id))
      if (fresh.length && fresh.length < ids.length) {
        setArriving((a) => new Set([...a, ...fresh]))
        setTimeout(() => setArriving((a) => { const n = new Set(a); fresh.forEach((i) => n.delete(i)); return n }), 1500)
      }
    }
    seenNodes.current = new Set(ids)
  }, [nodes])

  // Cards named for a screen reader. Cached per node object, so a drag re-labels nothing.
  const labelled = useRef(new WeakMap())
  const shownNodes = useMemo(() => nodes.map((n) => {
    let c = labelled.current.get(n)
    if (!c || c.lang !== lang) {
      c = { lang, node: { ...n, ariaLabel: cardName(n.id) } }
      labelled.current.set(n, c)
    }
    return arriving.has(n.id) ? { ...c.node, className: 'is-arriving' } : c.node
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nodes, lang, arriving])

  // What just happened, for a screen reader: the canvas changes silently otherwise.
  const [said, setSaid] = useState('')

  // Never an id already on the canvas: a tree opened from a link, or the example then extended,
  // could leave the counter behind its own ids, and a new card then replaced an old one
  // (found 2026-10-20, a second bio-sand filter overwrote the sand filter).
  const newId = () => {
    const taken = new Set((treeSession.nodes || []).map((n) => String(n.id)))
    do { counter.current += 1 } while (taken.has(`n${counter.current}`))
    treeSession.counter = counter.current
    return `n${counter.current}`
  }

  // Undo: a bounded stack of pre-images, via serializeTree/hydrateTree. Snapshots read
  // `treeSession`, not the nodes/edges closures, which go stale inside memoised callbacks.
  // Every discrete action pushes once, and a whole drag is one action.
  const UNDO_LIMIT = 30
  const history = useRef([])
  const [canUndo, setCanUndo] = useState(false)
  // What Undo took back, so Redo can put it again; any new change empties it (a user, 2026-11-03).
  const future = useRef([])
  const [canRedo, setCanRedo] = useState(false)
  const systemCounts = fill(nodes.length === 1 ? ui.tree.countCardOne : ui.tree.countCards, { n: nodes.length })
    + ' · ' + (edges.length ? fill(edges.length === 1 ? ui.tree.countLinkOne : ui.tree.countLinks, { n: edges.length }) : ui.tree.countLinksNone)
  // A new language: unfold and measure again, since the labels changed width.
  useLayoutEffect(() => { addRowWidth.current = 0; setFolded(false) }, [lang])
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const ro = new ResizeObserver(() => fitBar())
    ro.observe(bar)
    return () => ro.disconnect()
  }, [fitBar])
  useLayoutEffect(() => { fitBar() }, [fitBar, folded, lang, treeName, nodes.length, edges.length, canRedo])

  const snapshot = useCallback(() => {
    history.current.push(serializeTree(treeSession.nodes, treeSession.edges))
    if (history.current.length > UNDO_LIMIT) history.current.shift()
    setCanUndo(true)
    future.current = []; setCanRedo(false)
  }, [])

  // The drag's pre-image is committed on stop, and only if something moved: React Flow also
  // starts a drag on a plain click.
  const dragPre = useRef(null)
  const onNodeDragStart = useCallback(() => {
    dragPre.current = serializeTree(treeSession.nodes, treeSession.edges)
  }, [])
  /*
   * Non-overlapping placement. freeSpot takes the position the caller wants and, if taken, the
   * nearest free spot (right, down, left, up, then diagonals), so a displaced node stays beside
   * its parent. Sizes come from React Flow's internal lookup: `n.measured` on the state copy is
   * never filled in this tree. The fallback size, for nodes not yet measured, is the small end
   * of the observed range so it never over-claims.
   */
  const rf = useReactFlow()
  rfApi.current = rf
  // The screen's shape, followed live: turning the phone moves the connection points and the
  // links re-attach; the cards themselves do not move (Eric, 2026-10-18).
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const on = () => setPortrait(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => { updateNodeInternals(nodes.map((n) => n.id)) }, [portrait])  // eslint-disable-line react-hooks/exhaustive-deps
  const sizeOf = (n) => {
    const m = n && rf.getInternalNode(n.id)?.measured
    return {
      w: m?.width ?? n?.measured?.width ?? n?.width ?? 210,
      h: m?.height ?? n?.measured?.height ?? n?.height ?? 130,
    }
  }

  /*
   * Bring cards into view (U1, 2026-10-12: a card added by a picker, a chip or "Fix it" landed
   * outside the visible canvas and nothing moved). The smallest pan that shows them; if they
   * cannot fit at the current zoom, the whole system is fitted instead.
   */
  const reveal = useCallback((ids) => {
    const box = canvasRef.current && canvasRef.current.getBoundingClientRect()
    if (!box || !box.width) return
    const rects = ids.map((id) => rf.getInternalNode(id)).filter(Boolean).map((n) => ({
      x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y,
      w: n.measured?.width ?? 210, h: n.measured?.height ?? 130,
    }))
    if (!rects.length) return
    const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y))
    const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h))
    const { x, y, zoom } = rf.getViewport()
    const M = 16
    const still = calm()
    const duration = still ? 0 : 250
    if ((x1 - x0) * zoom + 2 * M > box.width || (y1 - y0) * zoom + 2 * M > box.height) {
      rf.fitView({ maxZoom: 1, padding: 0.1, duration })
      return
    }
    const left = x0 * zoom + x, right = x1 * zoom + x, top = y0 * zoom + y, bottom = y1 * zoom + y
    const dx = left < M ? M - left : right > box.width - M ? box.width - M - right : 0
    const dy = top < M ? M - top : bottom > box.height - M ? box.height - M - bottom : 0
    if (dx || dy) rf.setViewport({ x: x + dx, y: y + dy, zoom }, { duration })
  }, [rf])

  // Where the Remove button sits: the midpoint between the two node centres, converted to
  // screen coordinates and then into the canvas's own box, so it follows pan and zoom.
  const pickedAt = useMemo(() => {
    const e = edges.find((x) => x.id === pickedEdge)
    if (!e || !rf.flowToScreenPosition) return null
    const a = nodes.find((n) => n.id === e.source), b = nodes.find((n) => n.id === e.target)
    if (!a || !b) return null
    const mid = (n) => { const s2 = sizeOf(n); return { x: n.position.x + s2.w / 2, y: n.position.y + s2.h / 2 } }
    const ma = mid(a), mb = mid(b)
    const p = rf.flowToScreenPosition({ x: (ma.x + mb.x) / 2, y: (ma.y + mb.y) / 2 })
    const box = canvasRef.current && canvasRef.current.getBoundingClientRect()
    return box ? { left: p.x - box.left, top: p.y - box.top } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedEdge, edges, nodes, rf, viewport])

  /*
   * True rectangle intersection: touching is fine. GAP is how far a displaced node moves, not a
   * collision margin.
   */
  const GAP = 12
  const freeSpot = useCallback((want, taken, self) => {
    const me = sizeOf(self)
    const hits = (p) => taken.some((n) => {
      const b = sizeOf(n)
      return p.x < n.position.x + b.w && p.x + me.w > n.position.x
          && p.y < n.position.y + b.h && p.y + me.h > n.position.y
    })
    if (!hits(want)) return want
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    for (let ring = 1; ring <= 12; ring++) {
      for (const [dx, dy] of dirs) {
        const p = { x: want.x + dx * ring * (me.w + GAP), y: want.y + dy * ring * (me.h + GAP) }
        if (!hits(p)) return p
      }
    }
    return want   // a canvas this full has no good answer; do not lose the node
  }, [])

  /*
   * A dropped node settles by the same rule as a spawned one: nudged on release rather than
   * blocked mid-drag, which would make it stutter under the pointer.
   */
  const settleDropped = useCallback((dropped) => {
    setNodes((ns) => {
      const others = ns.filter((n) => n.id !== dropped.id)
      const at = freeSpot(dropped.position, others, ns.find((n) => n.id === dropped.id) || dropped)
      if (at.x === dropped.position.x && at.y === dropped.position.y) return ns
      return ns.map((n) => (n.id === dropped.id ? { ...n, position: at } : n))
    })
  }, [setNodes, freeSpot])

  // A new node is placed twice: at once with a guess, then again once React Flow has measured
  // it (the house card is far larger than the fallback). A node chained to the left is
  // re-anchored by its right edge, a gutter short of the node it feeds. Keyed on "every node
  // measured", which drops to false when a node is added.
  const placing = useRef(new Map())   // id -> { want, anchor? }, until measured
  const allMeasured = useNodesInitialized()
  // On a phone the system opens centred on the card added last, at reading size (J-F7), not
  // fitted so small nothing reads. Once per visit to the builder.
  const centred = useRef(false)
  useEffect(() => {
    if (centred.current || !allMeasured || !nodes.length || !touchFloor) return
    centred.current = true
    const last = rf.getInternalNode(nodes[nodes.length - 1].id)
    if (!last) return
    const w = last.measured?.width ?? 220, h = last.measured?.height ?? 130
    requestAnimationFrame(() => rf.setCenter(last.internals.positionAbsolute.x + w / 2, last.internals.positionAbsolute.y + h / 2, { zoom: Math.max(touchFloor, rf.getZoom()) }))
  }, [allMeasured])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!allMeasured || !placing.current.size) return
    for (const id of placing.current.keys()) {
      if (!nodes.some((n) => n.id === id)) placing.current.delete(id)   // deleted or undone first
    }
    const jobs = [...placing.current].filter(([id]) => rf.getInternalNode(id)?.measured?.width)
    if (!jobs.length) return
    for (const [id] of jobs) placing.current.delete(id)
    setNodes((ns) => {
      let out = ns
      for (const [id, { want, anchor }] of jobs) {
        const me = out.find((n) => n.id === id)
        if (!me) continue
        const goal = {
          x: anchor?.right == null ? want.x : anchor.right - sizeOf(me).w,
          y: anchor?.bottom == null ? want.y : anchor.bottom - sizeOf(me).h,
        }
        const at = freeSpot(goal, out.filter((n) => n.id !== id), me)
        if (at.x !== me.position.x || at.y !== me.position.y) {
          out = out.map((n) => (n.id === id ? { ...n, position: at } : n))
        }
      }
      return out
    })
    // Two frames: the positions above must be committed before the view is moved to them.
    const ids = jobs.map(([id]) => id)
    // The first card on an empty canvas is centred at life size, whatever zoom the canvas was
    // left at: after Erase a phone still showed it at the old, zoomed-out scale (F1 re-test,
    // 2026-10-17), although the reset on Erase measured right here.
    const first = nodes.length === ids.length
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!first) { reveal(ids); return }
      const n = rf.getInternalNode(ids[0])
      if (!n) return
      const w = n.measured?.width ?? 210, h = n.measured?.height ?? 130
      rf.setCenter(n.internals.positionAbsolute.x + w / 2, n.internals.positionAbsolute.y + h / 2, { zoom: 1 })
    }))
  }, [nodes, allMeasured, setNodes, freeSpot, reveal])
  // The gap between a node chained before another and the node it feeds.
  const CHAIN_GUTTER = 80
  // Where a card added from another card's input ('in') or output ('out') goes: left or right
  // of it in landscape, above or below it in portrait, where the links attach top and bottom.
  // `nth` is how many cards already hang off that side, so siblings fan out instead of piling.
  // Returns the wanted position and, for a card placed before, the edge to anchor it by once
  // its size is known.
  const besideCard = useCallback((nodeId, pos, dir, nth = 0) => {
    if (!portrait) {
      return dir === 'out'
        ? { pos: { x: pos.x + 320, y: pos.y + nth * 110 } }
        : { pos: { x: pos.x - 320, y: pos.y + nth * 110 }, anchor: { right: pos.x - CHAIN_GUTTER } }
    }
    const h = rf.getInternalNode(nodeId)?.measured?.height ?? 200
    const x = pos.x + nth * 290
    return dir === 'out'
      ? { pos: { x, y: pos.y + h + CHAIN_GUTTER } }
      : { pos: { x, y: pos.y - 300 }, anchor: { bottom: pos.y - CHAIN_GUTTER } }
  }, [portrait, rf])

  const onNodeDragStop = useCallback((_e, node) => {
    if (node) settleDropped(node)
    const pre = dragPre.current
    dragPre.current = null
    if (!pre) return
    const posOf = (t) => JSON.stringify(t.nodes.map((n) => [n.id, n.position.x, n.position.y]))
    if (posOf(pre) === posOf(serializeTree(treeSession.nodes, treeSession.edges))) return
    history.current.push(pre)
    if (history.current.length > UNDO_LIMIT) history.current.shift()
    setCanUndo(true)
    future.current = []; setCanRedo(false)
  }, [settleDropped])

  const undo = useCallback(() => {
    const prev = history.current.pop()
    setCanUndo(history.current.length > 0)
    if (!prev) return
    future.current.push(serializeTree(treeSession.nodes, treeSession.edges))
    setCanRedo(true)
    const { nodes: hn, edges: he } = hydrateTree(prev)
    setNodes(hn)
    setEdges(he)
    // `counter` is never rewound, or an undone add followed by another add reuses an id that a
    // stale edge may still reference.
  }, [setNodes, setEdges])
  const redo = useCallback(() => {
    const next = future.current.pop()
    setCanRedo(future.current.length > 0)
    if (!next) return
    history.current.push(serializeTree(treeSession.nodes, treeSession.edges))
    setCanUndo(true)
    const { nodes: hn, edges: he } = hydrateTree(next)
    setNodes(hn)
    setEdges(he)
  }, [setNodes, setEdges])
  // The key listener binds once; these keep it pointed at the current undo and redo.
  const undoRef = useRef(undo)
  useEffect(() => { undoRef.current = undo }, [undo])
  const redoRef = useRef(redo)
  useEffect(() => { redoRef.current = redo }, [redo])

  // Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Not in a text field, where they must
  // act on the typing.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      const isRedo = (k === 'z' && e.shiftKey) || (k === 'y' && !e.shiftKey)
      if (!(k === 'z' && !e.shiftKey) && !isRedo) return
      const t = e.target
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      ;(isRedo ? redoRef : undoRef).current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // `anchor`, when given ({ right } or { bottom }), places the node by that edge once its size
  // is known.
  const addNode = useCallback((sol, pos, anchor) => {
    snapshot()
    const id = newId()
    placing.current.set(id, { want: pos, anchor })
    setNodes((ns) => ns.concat({ id, type: 'solution', position: freeSpot(pos, ns), data: { sol } }))
    setSaid(fill(ui.tree.saidAdded, { name: cat.tName(sol) }))
    return id
  }, [setNodes, snapshot, freeSpot])

  const addResource = useCallback((ioId, pos, anchor) => {
    const rd = cat.resourceDescriptor(ioId)
    if (!rd) return null
    snapshot()          // after the guard, so a rejected id does not push an empty step
    const id = newId()
    placing.current.set(id, { want: pos, anchor })
    // {io, name} matches the solution input/output shape; label is the node title.
    setNodes((ns) => ns.concat({
      id, type: 'resource', position: freeSpot(pos, ns),
      data: { io: { io: rd.io, name: rd.name }, label: rd.label },  // i18n-ok: stores the raw descriptor; the node renders it through tName
    }))
    return id
  }, [setNodes, snapshot, freeSpot])

  const addDestination = useCallback((kind, pos, anchor) => {
    snapshot()
    const id = newId()
    placing.current.set(id, { want: pos, anchor })
    setNodes((ns) => ns.concat({ id, type: 'destination', position: freeSpot(pos, ns), data: { dest: kind } }))
    return id
  }, [setNodes, snapshot, freeSpot])

  // A shared tree arriving in the fragment. Consumed once, then the fragment is cleared, or
  // every reload would snap back to the shared version. It replaces the unsaved scratch tree;
  // named saves are untouched.
  const fromLink = useRef(false)
  useEffect(() => {
    // Also on hashchange: following a shared link while already on the tree page changes only
    // the fragment.
    const load = () => {
      const hash = window.location.hash
      if (!hash.startsWith(HASH_PREFIX)) return
      if (fromLink.current === hash) return          // same link twice, ignore
      fromLink.current = hash
      decodeTree(hash.slice(HASH_PREFIX.length))
        .then((raw) => {
          const { nodes: hn, edges: he } = hydrateTree(raw)
          if (!hn.length) return
          setNodes(hn)
          setEdges(he)
          counter.current = raw.counter || hn.length
          setTreeName(raw.name || '')   // i18n-ok: the tree's own name, chosen by whoever built it
          setNameKey(raw.nameKey && ui.tree[raw.nameKey] ? raw.nameKey : null)
          // A reader's report carries the settings of the check, so we see what they saw.
          if (raw.scenario && typeof raw.scenario === 'object') {
            try { sessionStorage.setItem(SCENARIO_KEY, JSON.stringify(raw.scenario)) } catch { /* the defaults apply */ }
          }
        })
        .catch(() => { /* a mangled or truncated link leaves the canvas as it was */ })
        .finally(() => {
          window.history.replaceState(window.history.state, '',
            window.location.pathname + window.location.search)
        })
    }
    load()
    window.addEventListener('hashchange', load)
    return () => window.removeEventListener('hashchange', load)
  }, [setNodes, setEdges])

  // Consume a ?add= seed once: never duplicate a solution already placed, add rather than
  // replace, and strip the query so a reload does not re-add.
  const seeded = useRef(false)
  useEffect(() => {
    if (!seed || seeded.current) return
    seeded.current = true
    // One solution, or a guide's whole list: placed in rows of four to the right of anything
    // already there, as one undo step.
    const placed = new Set(treeSession.nodes.map((n) => n.data?.sol?.id))
    const sols = [].concat(seed).map((id) => cat.solById[id]).filter((s) => s && !placed.has(s.id))
    if (sols.length) {
      const xs = treeSession.nodes.map((n) => n.position.x)
      const x0 = xs.length ? Math.max(...xs) + 260 : 90
      snapshot()
      // Ids and positions outside the updater, which React may call twice.
      const add = sols.map((sol, i) => {
        const id = newId()
        // Steps a little over a card, the tallest near 250: 260 and 180 had them touching and overlapping.
        const pos = { x: x0 + (i % 4) * 280, y: 90 + Math.floor(i / 4) * 270 }
        placing.current.set(id, { want: pos })
        return { id, sol, pos }
      })
      setNodes((ns) => add.reduce((acc, { id, sol, pos }) =>
        acc.concat({ id, type: 'solution', position: freeSpot(pos, acc), data: { sol } }), ns))
    }
    const url = window.location.pathname
    window.history.replaceState(window.history.state, '', url)
  }, [seed, setNodes, snapshot, freeSpot])

  const onIo = useCallback((nodeId, dir, io) => {
    const node = nodes.find((n) => n.id === nodeId)
    setAsk({ nodeId, dir, io, sol: node.data.sol?.id ?? null, pos: node.position })
  }, [nodes])

  const onDelete = useCallback((nodeId) => {
    snapshot()
    setSaid(fill(ui.tree.saidRemoved, { name: cardName(nodeId) }))
    setNodes((ns) => ns.filter((n) => n.id !== nodeId))
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, setEdges, snapshot, nodes])

  /*
   * Deleting a link (TODO S2). A hairline is a small target, so the edge carries a wide invisible
   * interaction stroke and one tap selects it: it thickens and a Remove button appears beside it.
   * Nothing is drawn on the canvas until a link is touched, and the same gesture works for a
   * thumb and for a mouse.
   */
  const onEdgeClick = useCallback((ev, edge) => { ev.stopPropagation(); setPickedEdge(edge.id) }, [])
  const deleteEdge = useCallback(() => {
    if (!pickedEdge) return
    snapshot()
    setEdges((es) => es.filter((e) => e.id !== pickedEdge))
    setPickedEdge(null)
    setSaid(ui.tree.saidLinkRemoved)
  }, [pickedEdge, setEdges, snapshot])

  // The same by keyboard: a focused link is picked with Enter or Space and removed with Delete
  // or Backspace. Focus moves to the canvas, so it is not left on a link that is gone.
  const onCanvasKey = (e) => {
    const el = e.target.closest && e.target.closest('.react-flow__edge')
    const id = el && el.getAttribute('data-id')
    if (!id) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPickedEdge(id); return }
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    e.preventDefault()
    snapshot()
    setEdges((es) => es.filter((x) => x.id !== id))
    setPickedEdge(null)
    setSaid(ui.tree.saidLinkRemoved)
    const pane = canvasRef.current && canvasRef.current.querySelector('.react-flow__node')
    if (pane) pane.focus({ preventScroll: true })
  }

  const onReplace = useCallback((nodeId) => setReplacing(nodeId), [])
  const onToggle = useCallback((nodeId) => setExpanded((s) => {
    const n = new Set(s); n.has(nodeId) ? n.delete(nodeId) : n.add(nodeId); return n
  }), [])

  // `lang` is in the context for its effect: React Flow memoises node components and `nodes`
  // does not change with the language, so without it a graph kept its old-language names. A
  // context change re-renders every node type without minting new node objects mid-drag.
  /*
   * The connect tip (S3, P0.3b "videogame tutorials"): shown whenever the canvas has cards and no
   * link, with one chip pulsing, and back whenever the last link goes (Eric, 2026-09-24: no
   * dismissal, no memory). The empty canvas teaches the step before with its two examples. A
   * second tip for the verdict button was tried and dropped until the diagnostic's own pass.
   */
  const solNodes = nodes.filter((n) => n.data?.sol)
  const hint = solNodes.length > 0 && edges.length === 0 ? 'connect' : null
  // The pulsing chip: on the leftmost card, its first output (a chain reads left to right), else
  // its first input.
  const hintAnchor = hint === 'connect'
    ? [...solNodes].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0]
    : null
  const hintSol = hintAnchor?.data.sol
  const hintChip = useMemo(() => {
    if (!hintSol) return null
    if (hintSol.outputs.length) return { nodeId: hintAnchor.id, dir: 'out', io: hintSol.outputs[0].io }
    if (hintSol.inputs.length) return { nodeId: hintAnchor.id, dir: 'in', io: hintSol.inputs[0].io }
    return null
  }, [hintAnchor?.id, hintSol])  // eslint-disable-line react-hooks/exhaustive-deps
  const touch = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches

  /*
   * The system check's next moves (B17, Eric 2026-10-18), from what "Fix it" already does.
   * supplyOptions: for a resource a placed card lacks, up to three catalogue solutions that make it
   * (inside the filters, ranked by rankSupply), each one tap to add and link. compareFor: the comparison page of the need a solution answers.
   */
  const supplyOptions = (nodeId, io) => {
    const placed = new Set(solIdsInTree)
    const pool = cat.visibleSolutions(cat.catalogue.solutions, filters || cat.DEFAULT_FILTERS)
      .filter((c) => !placed.has(c.id))
    return rankSupply(pool, io, { ...cat.catalogue, ...diagnostic }).map((c) => ({
      key: c.id, name: cat.tName(c),
      apply: () => applyFix(nodeId, { key: 'a-' + c.id, mode: 'add', sol: c, io }),
    }))
  }
  // Arrange: only on a tap, Undo restores; its direction follows the screen's shape at the tap.
  // Where Arrange puts each card, always at full size, whatever the zoom at the tap.
  // `measured`: React Flow's own sizes, taken only from full cards (a name-only card is smaller).
  const arrangedOf = (ns, es, measured = false) => {
    const sizeOf = (id) => {
      const n = ns.find((x) => x.id === id)
      if (measured && n?.measured?.width >= 200) return { w: n.measured.width, h: n.measured.height }
      const known = fullSizes.current.get(id)
      if (known) return { w: known.width, h: known.height }
      const sol = n?.data.sol
      // A long name wraps, about 22 characters to a line, 20 px each (2026-11-03: a three-line
      // name pushed its card under the next one).
      const nameLines = sol ? Math.ceil(cat.tName(sol).length / 22) : 1
      if (sol) return { w: 260, h: 120 + 20 * nameLines + 36 * Math.max(sol.inputs.length, sol.outputs.length, 1) }
      if (n?.data.dest) return { w: 480, h: 440 }
      return { w: 230, h: 120 }
    }
    const pos = arrangePositions(ns, es, { down: portrait, sizeOf })
    return ns.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n))
  }
  const arrange = () => {
    if (!nodes.length) return
    snapshot()
    setNodes(arrangedOf(nodes, edges))
    const still = calm()
    requestAnimationFrame(() => requestAnimationFrame(() => rf.fitView({ maxZoom: 1, padding: 0.12, duration: still ? 0 : 400 })))
  }
  // See it all: zooms out to fit, moving nothing.
  const seeAll = () => {
    const still = calm()
    rf.fitView({ maxZoom: 1, padding: 0.12, duration: still ? 0 : 400 })
  }

  // Another unit of a step that caps the flow, side by side: same inputs, same outputs.
  const onParallel = (solId) => {
    const n = nodes.find((x) => x.data.sol?.id === solId)
    if (!n) return
    const id = addNode(n.data.sol, { x: n.position.x, y: n.position.y + 170 })
    setEdges((es) => es.concat(
      es.filter((e) => e.target === n.id).map((e) => ({ ...e, id: `${e.id}-p${id}`, target: id })),
      es.filter((e) => e.source === n.id).map((e) => ({ ...e, id: `${e.id}-p${id}`, source: id })),
    ))
    requestAnimationFrame(() => reveal([n.id, id]))
  }
  const compareFor = (solId) => {
    const sub = cat.subById[cat.solById[solId]?.subfunction_id]
    return sub ? { name: cat.tLong(sub).toLowerCase(), route: { view: 'subfunction', id: sub.id } } : null
  }

  // "Fix it" (2026-09-25). What would satisfy each rule on this node:
  //  - a host (a coil needs a flue): add a solution providing it, linked in upstream;
  //  - an input route (greywater into a toilet only through a diversion): insert a solution
  //    providing the route BETWEEN the offending source and this node, rerouting that flow;
  //  - pressure: insert a pressure source on the incoming water line where it can carry that
  //    water through (a pump), else add one upstream (the mains, reused if already placed).
  const fixOptions = (nodeId) => {
    const n = nodes.find((x) => x.id === nodeId)
    const sol = n?.data.sol
    if (!sol) return []
    const byId = Object.fromEntries(nodes.map((x) => [x.id, x]))
    const into = edges.filter((e) => e.target === nodeId)
    const iosOf = (e) => e.data?.ios || [e.data?.io ?? e.io]
    const ins = (s) => new Set((s.inputs || []).map((i) => i.io))
    const outs = (s) => new Set((s.outputs || []).map((o) => o.io))
    const opts = []
    const pushInsert = (c, e, io) =>
      opts.push({ key: `i-${c.id}-${e.id}`, mode: 'insert', sol: c, edge: e, io, from: byId[e.source] })
    const pushAdd = (c) => {
      const io = [...outs(c)].find((x) => ins(sol).has(x))
      if (io) opts.push({ key: `a-${c.id}`, mode: 'add', sol: c, io })
    }
    const kind = hostWarnings.get(nodeId)
    if (kind && sol.host_required === kind) {
      for (const c of cat.catalogue.solutions) if (c.host_provides === kind) pushAdd(c)
    } else if (kind) {
      for (const [io, k] of Object.entries(sol.input_via || {})) {
        if (k !== kind) continue
        const bad = into.filter((e) => iosOf(e).includes(io) && byId[e.source]?.data.sol?.host_provides !== k)
        for (const c of cat.catalogue.solutions) {
          if (c.host_provides !== k || !ins(c).has(io) || !outs(c).has(io)) continue
          for (const e of bad) pushInsert(c, e, io)
        }
      }
    }
    if (rawWarnings.has(nodeId)) {
      // A treatment step on the raw link. Through a heater there is no single link to fix here.
      const raws = into.filter((e) => iosOf(e).includes(RAW))
      for (const c of cat.catalogue.solutions) {
        if (c.conduit_for?.length || !ins(c).has(RAW) || !outs(c).has(DRINKING)) continue
        for (const e of raws) pushInsert(c, e, RAW)
      }
    }
    if (pressureWarnings.has(nodeId)) {
      for (const c of cat.catalogue.solutions) {
        if (!c.provides_pressure) continue
        const through = [...ins(c)].filter((x) => outs(c).has(x) && ins(sol).has(x))
        const e = into.find((x) => iosOf(x).some((y) => through.includes(y)))
        if (e) pushInsert(c, e, iosOf(e).find((y) => through.includes(y)))
        else pushAdd(c)
      }
    }
    return opts
  }

  const applyFix = (nodeId, opt) => {
    const target = nodes.find((x) => x.id === nodeId)
    if (!target) return
    // A solution already on the canvas is reused when it is only being added upstream (one
    // mains, one stove); an insertion always places a new one on that line.
    const existing = opt.mode === 'add' && nodes.find((x) => x.data.sol?.id === opt.sol.id)
    let cid
    if (existing) { snapshot(); cid = existing.id }
    else {
      const from = opt.mode === 'insert' ? nodes.find((x) => x.id === opt.edge.source) : null
      const before = besideCard(target.id, target.position, 'in')
      const pos = from
        ? { x: (from.position.x + target.position.x) / 2 + (portrait ? 150 : 0),
            y: (from.position.y + target.position.y) / 2 + (portrait ? 0 : 80) }
        : before.pos
      cid = addNode(opt.sol, pos, from ? undefined : before.anchor)
    }
    const stand = { data: { sol: opt.sol } }
    const mk = (s, t, ios) => ({ id: `e-${s}-${t}-${ios[0]}`, source: s, target: t,
      data: { io: ios[0], ios }, label: iosLabel(ios, ios[0]), animated: true })
    setEdges((es) => {
      let out = es
      if (opt.mode === 'insert') {
        const e = opt.edge
        // The rerouted flow leaves the old link; anything else it carried stays on it.
        const rest = (e.data?.ios || [e.data?.io ?? e.io]).filter((x) => x !== opt.io)
        out = out.filter((x) => x.id !== e.id)
        if (rest.length) out = out.concat({ ...e, data: { ...e.data, io: rest[0], ios: rest }, label: iosLabel(rest, rest[0]) })
        const from = nodes.find((x) => x.id === e.source)
        const a = from ? allMatchingIos(from, stand) : []
        out = addEdge(mk(e.source, cid, a.length ? a : [opt.io]), out)
      }
      const b = allMatchingIos(stand, target)
      return addEdge(mk(cid, target.id, b.length ? b : [opt.io]), out)
    })
    setSaid(fill(ui.tree.saidFixed, { name: cat.tName(opt.sol), to: cardName(target.id) }))
    // The fix sheet has closed; focus lands on the card it fixed rather than on the page.
    setTimeout(() => {
      const el = canvasRef.current && canvasRef.current.querySelector(`.react-flow__node[data-id="${CSS.escape(target.id)}"]`)
      if (el) el.focus()
    }, 0)
  }

  const ctx = useMemo(() => ({ onIo, onDelete, onReplace, onToggle, go, expanded, linked, pressureWarnings, hostWarnings, rawWarnings, closedLoops, arrivingAt, filters, lang, hintChip, fixOptions, applyFix, reveal, portrait }),
    // fixOptions and applyFix read the graph when called; they change whenever nodes or edges do.
    [onIo, onDelete, onReplace, onToggle, go, expanded, linked, pressureWarnings, hostWarnings, rawWarnings, closedLoops, arrivingAt, filters, lang, hintChip, nodes, edges, reveal, portrait])  // eslint-disable-line react-hooks/exhaustive-deps

  // Manual drag-connect: only an output to an input sharing an IO type. A home node is a source
  // as well as a target.
  const nodeOuts = (n) => (n.data.sol ? n.data.sol.outputs
                        : n.data.io ? [n.data.io]
                        : n.data.dest === 'home' ? cat.householdSources : [])
  const nodeIns = (n) => (n.data.sol ? n.data.sol.inputs : [])

  /** Edge label: every flow it carries, in the reading language. */
  const iosLabel = (ios, fallback) =>
    ios.map((x) => cat.tName(cat.ioById[x])).filter(Boolean).join(', ') || fallback

  // Every flow that can move from src to tgt, not just the first (a sorting station into
  // kerbside collection moves three). A destination is asked what it is allowed to take
  // (`terminalsFor`), since it has no inputs of its own.
  // A pass-through gives only what has entered it (C10).
  const givenBy = (src) => {
    const all = nodeOuts(src)
    const through = src.data.sol?.conduit_for
    if (!through?.length || !src.id) return all
    const entered = edges.filter((e) => e.target === src.id).flatMap(edgeIos)
    return entered.some((io) => through.includes(io))
      ? all.filter((o) => !through.includes(o.io) || entered.includes(o.io)) : all
  }
  const allMatchingIos = (src, tgt) => {
    const outs = givenBy(src).map((o) => o.io)
    if (tgt.data.dest) {
      return outs.filter((io) => cat.terminalsFor(io).includes(tgt.data.dest))
    }
    const wanted = new Set(nodeIns(tgt).map((i) => i.io))
    return outs.filter((io) => wanted.has(io))
  }
  const matchingIo = (src, tgt) => {
    const outs = givenBy(src)
    // A destination takes the first output not already wired; the output buttons say precisely
    // which.
    if (tgt.data.dest) {
      // Only outputs this ending may take, so dragging cannot assert something the data says is
      // false (blackwater into the home).
      const ok = outs.filter((o) => cat.terminalsFor(o.io).includes(tgt.data.dest))
      const used = new Set(edges.filter((e) => e.source === src.id).map((e) => e.data?.io))
      return (ok.find((o) => !used.has(o.io)) || ok[0])?.io
    }
    const set = new Set(outs.map((o) => o.io))
    return nodeIns(tgt).map((i) => i.io).find((io) => set.has(io))
  }
  const isValidConnection = useCallback((c) => {
    const s = nodes.find((n) => n.id === c.source)
    const t = nodes.find((n) => n.id === c.target)
    return !!(s && t && matchingIo(s, t))
  }, [nodes])
  const onConnect = useCallback((c) => {
    const s = nodes.find((n) => n.id === c.source)
    const t = nodes.find((n) => n.id === c.target)
    const io = s && t && matchingIo(s, t)
    if (!io) return
    const ios = allMatchingIos(s, t)
    snapshot()      // after the guard: a drag that connects nothing is not a step
    setSaid(fill(ui.tree.saidLinked, { from: cardName(c.source), to: cardName(c.target) }))
    setEdges((es) => addEdge(
      { ...c, id: `e-${c.source}-${c.target}-${io}`, data: { io, ios },
        label: ios.map((x) => cat.tName(cat.ioById[x])).filter(Boolean).join(', ') || io,
        animated: true }, es))
  }, [nodes, setEdges, snapshot, cardName])

  // Pick from the suggestion list: connect to an existing node, or add a new one.
  const pickSuggestion = (sol) => {
    const dir = ask.dir
    const existing = nodes.find((n) => n.data.sol?.id === sol.id)
    let targetId
    if (existing) {
      // One push per action: this branch adds no node, so it snapshots itself; addNode
      // snapshots for the other.
      snapshot()
      targetId = existing.id
    } else {
      const childCount = edges.filter((e) =>
        (dir === 'out' ? e.source : e.target) === ask.nodeId).length
      const { pos, anchor } = besideCard(ask.nodeId, ask.pos, dir, childCount)
      targetId = addNode(sol, pos, anchor)
    }
    const io = ask.io
    const source = dir === 'out' ? ask.nodeId : targetId
    const target = dir === 'out' ? targetId : ask.nodeId
    // The far node may not be in `nodes` yet; a stand-in with the same data shape is all
    // allMatchingIos reads.
    const here = nodes.find((n) => n.id === ask.nodeId)
    const there = existing || { data: { sol } }
    const ios = dir === 'out' ? allMatchingIos(here, there) : allMatchingIos(there, here)
    setEdges((es) => addEdge(
      { id: `e-${source}-${target}-${io}`, source, target,
        data: { io, ios: ios.length ? ios : [io] },
        label: iosLabel(ios, cat.tName(cat.ioById[io]) || io), animated: true }, es))
    setAsk(null)
  }

  // Place the house as the source of the clicked input. An existing home node is reused: a
  // graph has one household.
  const pickHousehold = () => {
    const existing = nodes.find((n) => n.data?.dest === 'home')
    const childCount = edges.filter((e) => e.target === ask.nodeId).length
    const { pos, anchor } = besideCard(ask.nodeId, ask.pos, 'in', childCount)
    if (!existing) snapshot()
    const houseId = existing ? existing.id : addDestination('home', pos, anchor)
    const ios = allMatchingIos({ data: { dest: 'home' } },
                               nodes.find((n) => n.id === ask.nodeId))
    setEdges((es) => addEdge(
      { id: `e-${houseId}-${ask.nodeId}-${ask.io}`, source: houseId, target: ask.nodeId,
        data: { io: ask.io, ios: ios.length ? ios : [ask.io] },
        label: iosLabel(ios, cat.tName(cat.ioById[ask.io]) || ask.io), animated: true }, es))
    setAsk(null)
  }

  // Place a natural resource that produces the clicked input, and link it in.
  const pickResource = () => {
    const childCount = edges.filter((e) => e.target === ask.nodeId).length
    const { pos, anchor } = besideCard(ask.nodeId, ask.pos, 'in', childCount)
    const resId = addResource(ask.io, pos, anchor)
    if (!resId) return
    setEdges((es) => addEdge(
      // data.io and a translated label, like every other edge. A resource emits exactly one
      // thing.
      { id: `e-${resId}-${ask.nodeId}-${ask.io}`, source: resId, target: ask.nodeId,
        data: { io: ask.io, ios: [ask.io] },
        label: cat.tName(cat.ioById[ask.io]) || ask.io, animated: true }, es))
    setAsk(null)
  }

  // Place a destination and wire the clicked output into it; the IO is known because a specific
  // output was clicked.
  const pickDestination = (kind) => {
    const childCount = edges.filter((e) => e.source === ask.nodeId).length
    // Auto-linking reuses an ending already on the graph, of any kind: chaining an output means
    // "this finishes here", not "add another sink". Where several exist, link to the nearest;
    // duplicates stay possible from the Destinations menu.
    const sameKind = nodes.filter((n) => n.data?.dest === kind)
    const near = (a, b) => Math.hypot(a.position.x - b.x, a.position.y - b.y)
    const existing = sameKind.length
      ? sameKind.reduce((best, n) => (near(n, ask.pos) < near(best, ask.pos) ? n : best))
      : null
    if (existing) snapshot()
    const destId = existing ? existing.id
      : addDestination(kind, besideCard(ask.nodeId, ask.pos, 'out', childCount).pos)
    const ios = allMatchingIos(nodes.find((n) => n.id === ask.nodeId),
                               { data: { dest: kind } })
    setEdges((es) => addEdge(
      { id: `e-${ask.nodeId}-${destId}-${ask.io}`, source: ask.nodeId, target: destId,
        data: { io: ask.io, ios: ios.length ? ios : [ask.io] },
        label: iosLabel(ios, cat.tName(cat.ioById[ask.io]) || ask.io), animated: true }, es))
    setAsk(null)
  }

  const pickReplace = (sol) => {
    snapshot()
    const nodeId = replacing
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { sol } } : n)))
    // Drop edges whose IO the new solution no longer supports.
    const outIos = new Set(sol.outputs.map((o) => o.io))
    const inIos = new Set(sol.inputs.map((i) => i.io))
    setEdges((es) => es.map((e) => {
      if (e.source !== nodeId && e.target !== nodeId) return e
      // Read the ids off the edge; name lookup is only for edges saved before they carried ids.
      let ios = edgeIos(e)
      if (!ios.length) {
        const guess = Object.keys(cat.ioById).find((k) => cat.ioById[k].name === e.label)  // i18n-ok: last resort only, after data.ios and data.io; see the comment above
        ios = guess ? [guess] : []
      }
      // Prune the flows the new solution cannot carry, and keep the edge for the rest.
      const keep = ios.filter((io) => (e.source === nodeId ? outIos.has(io) : inIos.has(io)))
      if (!keep.length) return null
      if (keep.length === ios.length) return e
      return { ...e, data: { ...e.data, io: keep[0], ios: keep },
               label: keep.map((x) => cat.tName(cat.ioById[x])).filter(Boolean).join(', ') }
    }).filter(Boolean))
    setReplacing(null)
  }

  // Save, load (localStorage) and share.
  const STORE_KEY = 'lowtech_trees'
  const loadStore = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') } catch { return {} } }
  const saveStore = (o) => localStorage.setItem(STORE_KEY, JSON.stringify(o))
  const listTrees = () => Object.keys(loadStore()).sort()
  const savedCount = listTrees().length
  const slotText = treeName.trim() || (nodes.length ? systemCounts : ui.tree.openSaved)
  const serialize = () => serializeTree(nodes, edges)
  const saveTree = (name) => {
    if (!name.trim() || !nodes.length) return
    const st = loadStore(); st[name.trim()] = serialize(); saveStore(st); setTreesModal(false)
  }
  const openTree = (name) => {
    snapshot()
    const t = loadStore()[name]; if (!t) return
    const { nodes: hn, edges: he } = hydrateTree(t)
    setNodes(hn)
    setEdges(he)
    counter.current = Math.max(0, ...t.nodes.map((n) => parseInt(String(n.id).replace(/\D/g, ''), 10) || 0))
    setTreeName(name); setNameKey(null); setTreesModal(false)
  }
  const deleteTree = (name) => { const st = loadStore(); delete st[name]; saveStore(st); bump() }
  // Load a worked example, through hydrateTree so its labels are in the reading language. Only
  // reachable from the empty state.
  const loadExample = (key) => {
    const tree = EXAMPLES[key]
    if (!tree) return
    snapshot()
    const { nodes: hn, edges: he } = hydrateTree(tree)
    // Arranged on arrival: the stored positions read cramped until Arrange was pressed (a user,
    // 2026-11-03). Framed whatever the view was before (after Erase it opened at the old zoom).
    // Once drawn, arranged again from the cards' real sizes, then framed.
    setNodes(arrangedOf(hn, he)); setEdges(he)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setNodes(arrangedOf(rf.getNodes(), he, true))
      requestAnimationFrame(() => rf.fitView({ maxZoom: 1, padding: 0.12 }))
    }))
    counter.current = tree.counter
    setNameKey(key === 'power' ? 'exampleNamePower' : 'exampleName')
    setTreeName(key === 'power' ? ui.tree.exampleNamePower : ui.tree.exampleName)
  }
  const newTree = () => {
    snapshot()
    setNodes([]); setEdges([]); setTreeName(''); setNameKey(null)
    counter.current = 0; treeSession.counter = 0
    // Without this the emptied canvas comes back on the next reload.
    treeSession.nodes = []; treeSession.edges = []; treeSession.name = ''  // i18n-ok: the tree name the user typed
    persistSession()
    // The view too: a card added next arrived at the erased system's zoom (84 px wide on a phone).
    rf.setViewport({ x: 0, y: 0, zoom: 1 })
  }

  const nodeName = (id) => {
    const n = nodes.find((x) => x.id === id)
    return (n?.data.sol ? cat.tName(n.data.sol) : n?.data.io && cat.resourceLabel(n.data.io.io)) || '?'
  }
  /*
   * The system as a list, one entry per solution: what it takes and from where, what it gives
   * and to where, its tutorial (J-F18: the Markdown table pasted into an email was rows of pipes).
   * The same rows feed the share text and "Read this system as a list".
   */
  const systemRows = () => nodes.filter((n) => n.data.sol).map((n) => {
    const s = n.data.sol
    // Match on the IO id, never the displayed label; the label fallback is for trees saved
    // before edges carried an id.
    const wired = (e, io) => (e.data?.io ? e.data.io === io.io : e.label === io.name)  // i18n-ok: id first, label only for edges saved before they carried an id
    const ioName = (io) => cat.tName(cat.ioById[io.io]) || io.name
    return {
      id: n.id, sol: s,
      sub: cat.tName(cat.subById[s.subfunction_id]) || '',
      ins: s.inputs.map((i) => ({ io: ioName(i), with: edges.filter((e) => e.target === n.id && wired(e, i)).map((e) => nodeName(e.source)) })),
      outs: s.outputs.map((o) => ({ io: ioName(o), with: edges.filter((e) => e.source === n.id && wired(e, o)).map((e) => nodeName(e.target)) })),
      tutorial: cat.primaryTutorial(s.tutorials)?.url || '',
    }
  })
  const buildTable = () => {
    const X = ui.treeExport
    const side = (list, tpl) => list.map((x) => x.io + (x.with.length ? ' ' + fill(tpl, { nodes: x.with.join(', ') }) : '')).join('; ') || ui.solutionPage.none
    const heading = treeName ? fill(X.titleNamed, { name: treeName }) : X.title
    const blocks = systemRows().map((r) => [
      `- ${cat.tName(r.sol)}${r.sub ? ` (${r.sub})` : ''}`,
      `  ${X.takes}: ${side(r.ins, X.fromNodes)}`,
      `  ${X.gives}: ${side(r.outs, X.toNodes)}`,
      ...(r.tutorial ? [`  ${X.colTutorial}: ${r.tutorial}`] : []),
    ].join('\n'))
    return [heading, '', ...blocks].join('\n')
  }
  // Whether saving under the current name would replace an existing save.
  const overwrites = !!treeName.trim() && listTrees().includes(treeName.trim())

  // Show the table before sending it anywhere: copy is primary, and the system sheet stays
  // available where the platform has one.
  const shareTree = async () => {
    if (!nodes.length) { alert(ui.tree.shareEmptyWarning); return }
    setShareText(buildTable())
    setCopied(false)
    setShareUrl('')
    const code = await encodeTree({ ...serialize(), name: treeName, nameKey, counter: counter.current })
    setShareUrl(window.location.origin + window.location.pathname + HASH_PREFIX + code)
  }
  const systemLink = async (scenario) => {
    const code = await encodeTree({ ...serialize(), name: treeName, nameKey, counter: counter.current, scenario })
    return window.location.origin + window.location.pathname + HASH_PREFIX + code
  }
  const copyLink = async () => {
    setLinkCopied((await copyText(shareUrl)) ? true : 'failed')
  }
  const copyTable = async () => {
    setCopied((await copyText(shareText, shareBox.current)) ? true : 'failed')
  }


  // The site-wide facets, in the two dialogs that list solutions (Eric, 2026-09-23).
  // The same state as the needs page and Settings, so a filter set anywhere applies here.
  const facetHead = setFilter ? (
    <FacetHead filters={filters} setFilter={setFilter} open={facetsOpen}
               onToggle={() => setFacetsOpen((v) => !v)} controls="tree-facets" />
  ) : null
  const facetPanel = (pool) => (
    <div className="tree-facets" id="tree-facets">
      <FacetControls filters={filters} setFilter={setFilter} pool={pool} />
    </div>
  )

  const flowAria = useMemo(flowAriaFor, [lang])
  return (
    <TreeCtx.Provider value={ctx}>
      {/* With the check docked, the canvas narrows beside it, so no card hides under it. */}
      <div className={'tree-root' + (adequacyOpen ? ' has-dock' : '')}>
        {/* Two rows: what you put on the canvas (green), and what you do to a canvas you have (grey), so Erase never weighs like Add. The verdict button floats over the canvas. */}
        {/* A hidden heading for the page (A-A13). */}
        <h1 className="sr-only">{ui.app.navBuild}</h1>
        {/* One row (brief 03, C): Add, Undo, the house, More; the check apart, at the right on a
            wide screen and in thumb reach under the canvas on a phone. */}
        <div className={'tree-toolbar' + (folded ? ' is-folded' : '')} ref={barRef}>
          <span className="tree-add-row is-desktop-only">
            <span className="tree-tools-label">{ui.tree.addLabel}</span>
            <button className="btn sm" onClick={() => setAdding(true)} title={ui.tree.kindSolutionLine}><Glyph name="wrench" />{ui.tree.addSolutionButton}</button>
            <button className="btn sm" onClick={() => setResourceModal(true)} title={ui.tree.kindResourceLine}><Glyph name="leaf" />{ui.tree.addResourceButton}</button>
            <button className="btn sm" onClick={() => setMainsModal(true)} title={ui.tree.kindMainsLine}><Glyph name="plug" size={18} />{ui.tree.addMainsButton}</button>
            <button className="btn sm" onClick={() => setDestModal(true)} title={ui.tree.kindDestLine}><Glyph name="arrive" />{ui.tree.addDestinationButton}</button>
          </span>
          <ToolMenu label={ui.tree.add} glyph="+" className="btn sm tree-add" title={ui.tree.tipAdd} tray
                    wrapClass="is-mobile-only" head={ui.tree.addTitle}
                    items={[
                      { key: 'sol', title: ui.tree.kindSolution, line: ui.tree.kindSolutionLine, glyph: 'wrench', run: () => setAdding(true) },
                      { key: 'res', title: ui.tree.kindResource, line: ui.tree.kindResourceLine, glyph: 'leaf', run: () => setResourceModal(true) },
                      { key: 'net', title: ui.tree.kindMains, line: ui.tree.kindMainsLine, glyph: 'plug', run: () => setMainsModal(true) },
                      { key: 'end', title: ui.tree.kindDest, line: ui.tree.kindDestLine, glyph: 'arrive', run: () => setDestModal(true) },
                    ]} />
          <button className="btn sm ghost tree-undo" onClick={undo} disabled={!canUndo}
                  title={canUndo ? ui.tree.tipUndo : ui.tree.undoNothing}>
            {ui.tree.undoButton}
          </button>
          <button type="button" className="btn sm ghost tree-help" onClick={() => { setTourOpen(true); markTourSeen() }}
                  aria-label={ui.tour.open} title={ui.tour.open}>?</button>
          {/* Only once something has been undone: there is nothing to redo before. */}
          {canRedo && (
            <button className="btn sm ghost tree-redo" onClick={redo} title={ui.tree.tipRedo}>
              {ui.tree.redoButton}
            </button>
          )}
          <ToolMenu label={ui.tree.more} glyph="⋯" className="btn sm ghost tree-more" title={ui.tree.moreTitle}
                    head={treeName || null}
                    items={[
                      { key: 'share', title: ui.tree.shareOrList, run: shareTree, disabled: !nodes.length },
                      { key: 'erase', title: fill(ui.tree.eraseAll, { cards: nodes.length, links: edges.length }), line: ui.tree.eraseNote, run: newTree, danger: true, disabled: !nodes.length },
                    ]}
                    foot={<span className="tree-more-foot">{ui.footer.licenceShort} · <a href={'/' + lang + '/' + (lang === 'fr' ? 'a-propos' : 'about')}>{ui.app.navAbout}</a></span>} />
          {/*
            The middle of the bar: the system's name, or its counts while unnamed, or "Open a saved
            system" on an empty canvas with saves; the one door to Save / open (Eric, 2026-10-20).
          */}
          {nodes.length > 0 || savedCount > 0 ? (
            <button type="button" className="tree-name-slot" onClick={() => setTreesModal(true)}
                    title={ui.tree.tipName} aria-label={slotText + '. ' + ui.tree.tipName}>
              <Glyph name="folder" />
              <span className={treeName.trim() ? 'tree-name-slot-name' : 'tree-name-slot-count'}>{slotText}</span>
            </button>
          ) : <span className="tree-toolbar-gap" />}
          {/* the house as built so far: in the bar, so it never covers the canvas */}
          <BuiltHouse sols={solsInTree} go={go} lang={lang} openKey={houseKey} />
          <button className="btn sm tree-verdict is-desktop-only" onClick={() => setAdequacyOpen((v) => !v)} aria-expanded={adequacyOpen}
                  disabled={!solIdsInTree.length} title={solIdsInTree.length ? ui.tree.tipCheck : ui.tree.tipCheckEmpty}>{ui.adequacy.button}</button>
        </div>
        {restored && !arrival && (
          <div className="tree-arrival" role="note">
            <p>{fill(ui.tree.restoredLead, { date: new Date(restored).toLocaleDateString(lang, { day: 'numeric', month: 'long' }) })}</p>
            <span className="tree-arrival-acts">
              <button type="button" className="link-btn" onClick={dropRestored}>{ui.tree.restoredContinue}</button>
              <button type="button" className="link-btn" onClick={() => { dropRestored(); newTree() }}>{ui.tree.restoredFresh}</button>
            </span>
            <button type="button" className="tree-arrival-x" aria-label={ui.tree.arrivalDismiss} onClick={dropRestored}><Glyph name="close" size={18} /></button>
          </div>
        )}
        {arrival && arrivalSols.length > 0 && (
          <div className="tree-arrival" role="note">
            <p>
              {fill(arrival.joined ? ui.tree.arrivalJoined : ui.tree.arrivalLead, { n: arrivalSols.length, guide: arrival.from || '' })}{' '}
              {arrivalShare ? ui.tree.arrivalShare : ui.tree.arrivalApart}
            </p>
            <span className="tree-arrival-acts">
              <button type="button" className="link-btn" onClick={() => setHouseKey((k) => k + 1)}>{ui.tree.buildList} →</button>
              <button type="button" className="link-btn" onClick={() => { arrange(); }}>{ui.tree.arrivalArrange} →</button>
            </span>
            <button type="button" className="tree-arrival-x" aria-label={ui.tree.arrivalDismiss} onClick={dropArrival}><Glyph name="close" size={18} /></button>
          </div>
        )}
        <div className="tree-canvas" ref={canvasRef} onKeyDown={onCanvasKey} role="region" aria-label={ui.tree.canvasLabel}>
          <div className="sr-only" role="status" aria-live="polite">{said}</div>
          <ReactFlow
            nodes={shownNodes} edges={shownEdges}
            onNodesChange={onNodesChangeTracked} onEdgesChange={onEdgesChange}
            onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop}
            onConnect={onConnect} isValidConnection={isValidConnection}
            onEdgeClick={onEdgeClick} onPaneClick={() => setPickedEdge(null)}
            onNodeClick={(ev, n) => {
              // Small on screen: bring it close, so its chips can be read and tapped.
              if (rf.getViewport().zoom < COMPACT_BELOW && !ev.target.closest('button, a')) {
                const w = n.measured?.width ?? 220, h = n.measured?.height ?? 130
                const still = calm()
                rf.setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: 1, duration: still ? 0 : 400 })
              }
            }}
            onMove={(_, v) => setViewport(v)}
            nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
            ariaLabelConfig={flowAria}
            /* Never closer than life size: one card alone used to open at 2.5x, so the next fell outside. */
            fitViewOptions={{ maxZoom: 1, minZoom: touchFloor }}
            /* Wider than the 0.5-2 default: a dozen nodes fit whole, one node reads close up. */
            minZoom={0.15} maxZoom={2.5}
            /*
             * Scroll pans and ctrl-scroll zooms, so a wheel over the canvas never scrolls the
             * document.
             */
            panOnScroll zoomOnScroll={false} zoomOnPinch
          >
            <Background />
          </ReactFlow>
          {nodes.length > 0 && (
            <div className="tree-bottom">
              <button type="button" className="btn sm ghost" onClick={arrange} title={ui.tree.tipArrange}>{ui.tree.arrange}</button>
              <button type="button" className="btn sm ghost" onClick={seeAll} title={ui.tree.tipSeeAll}>{ui.tree.seeAll}</button>
              <span className="tree-zoom is-desktop-only">
                <button type="button" className="btn sm ghost" aria-label={ui.tree.zoomIn} title={ui.tree.zoomIn} onClick={() => rf.zoomIn({ duration: 150 })}>+</button>
                <button type="button" className="btn sm ghost" aria-label={ui.tree.zoomOut} title={ui.tree.zoomOut} onClick={() => rf.zoomOut({ duration: 150 })}>−</button>
              </span>
              <span className="tree-toolbar-gap" />
              <button className="btn sm tree-verdict is-mobile-only" onClick={() => setAdequacyOpen((v) => !v)} aria-expanded={adequacyOpen}
                      disabled={!solIdsInTree.length} title={solIdsInTree.length ? ui.tree.tipCheck : ui.tree.tipCheckEmpty}>{ui.adequacy.button}</button>
            </div>
          )}
          {nodes.length > 0 && edges.length === 0 && !tourSeen && !tourOpen && (
            <section className="tree-tour-offer" aria-labelledby="tour-offer-h">
              <div className="tree-tour-offer-head">
                <h2 id="tour-offer-h">{ui.tour.offerTitle}</h2>
                <button type="button" className="tree-arrival-x" aria-label={ui.tour.gotIt} onClick={markTourSeen}><Glyph name="close" size={18} /></button>
              </div>
              <BuilderTour />
              <button type="button" className="btn sm" onClick={markTourSeen}>{ui.tour.gotIt}</button>
            </section>
          )}
          {hint && (
            <div className="tree-hint" role="status">
              {touch ? ui.tree.hintConnectTouch : ui.tree.hintConnect}
            </div>
          )}
          {/* Inside the canvas: its position is computed in the canvas's own box. */}
          {pickedEdge && pickedAt && (
            <button className="btn sm edge-del" style={{ left: pickedAt.left, top: pickedAt.top }}
                    onClick={deleteEdge}>
              {ui.tree.removeLink}
            </button>
          )}
          {nodes.length === 0 && (
            <div className="tree-empty">
              <div className="tree-empty-inner">
                <p className="tree-empty-lead">{ui.tree.emptyLead}</p>
                {/* How it works before the examples (S8): ten seconds, on a loop until a card is placed. */}
                <BuilderTour />
                {/* The two examples teach two graph shapes, a chain and a branch; the drawn miniature shows the shape, aria-hidden because the sentence says it. */}
                <div className="tree-examples">
                  <button className="tree-example" onClick={() => loadExample('water')}>
                    <svg className="tree-example-mini" viewBox="0 0 96 64" aria-hidden="true">
                      <path d="M12 20 L36 44 L60 26 L84 42" />
                      <circle cx="12" cy="20" r="5" /><circle cx="36" cy="44" r="5" />
                      <circle cx="60" cy="26" r="5" /><circle cx="84" cy="42" r="5" />
                    </svg>
                    <span className="tree-example-name">{ui.tree.exampleName}</span>
                    <span className="tree-example-shape">{ui.tree.emptyShapeChain}</span>
                    <span className="tree-example-go">{ui.tree.emptyOpen}</span>
                  </button>
                  <button className="tree-example" onClick={() => loadExample('power')}>
                    <svg className="tree-example-mini" viewBox="0 0 96 64" aria-hidden="true">
                      <path d="M12 32 L34 32 L58 14 L84 22 M34 32 L58 50" />
                      <circle cx="12" cy="32" r="5" /><circle cx="34" cy="32" r="5" />
                      <circle cx="58" cy="14" r="5" /><circle cx="58" cy="50" r="5" />
                      <circle cx="84" cy="22" r="5" />
                    </svg>
                    <span className="tree-example-name">{ui.tree.exampleNamePower}</span>
                    <span className="tree-example-shape">{ui.tree.emptyShapeBranch}</span>
                    <span className="tree-example-go">{ui.tree.emptyOpen}</span>
                  </button>
                </div>
                <p className="tree-empty-own">{ui.tree.emptyOwn}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {tourOpen && (
        <Modal title={ui.tour.open} onClose={() => setTourOpen(false)}>
          <BuilderTour />
        </Modal>
      )}
      {adding && (
        <Modal title={ui.treeModals.addSolutionTitle} onClose={() => { setAdding(false); setFacetsOpen(false) }}
               head={facetHead}>
          {facetsOpen && facetPanel(cat.catalogue.solutions)}
          <SolutionPicker filters={filters}
            onPick={(s) => { addNode(s, { x: 80, y: 60 + nodes.length * 40 }); setAdding(false) }} />
        </Modal>
      )}
      {ask && (
        <Modal title={ui.treeModals.chainSolutionTitle} onClose={() => { setAsk(null); setFacetsOpen(false) }}
               head={facetHead}>
          {facetsOpen && facetPanel(cat.suggestChain({ io: ask.io, dir: ask.dir, sourceSolId: ask.sol }).map((x) => x.sol))}
          <SuggestionList ask={ask} filters={filters}
            placedIds={solIdsInTree} destsPlaced={new Set(nodes.map((n) => n.data?.dest).filter(Boolean))}
            onPick={pickSuggestion} onPickResource={pickResource}
            onPickDestination={pickDestination} onPickHousehold={pickHousehold} />
        </Modal>
      )}
      {replacing && (
        <Modal title={ui.treeModals.replaceTitle} onClose={() => setReplacing(null)}>
          <SolutionPicker filters={filters}
            restrictSub={nodes.find((n) => n.id === replacing)?.data.sol?.subfunction_id}
            onPick={pickReplace} />
        </Modal>
      )}
      {treesModal && (
        <Modal title={ui.treeModals.savedSystemsTitle} onClose={() => setTreesModal(false)}>
          {/* Labelled as naming the tree, not filtering the list below. */}
          <div className="trees-save">
            <h4 className="share-h">{ui.treeModals.saveHeading}</h4>
            <label className="trees-save-label" htmlFor="tree-name">{ui.treeModals.nameLabel}</label>
            <div className="trees-save-row">
              <input id="tree-name" className="tree-name-input" value={treeName}
                     onChange={(e) => { setTreeName(e.target.value); setNameKey(null) }}
                     placeholder={ui.treeModals.nameSystemPlaceholder} />
              <button className="btn sm" onClick={() => saveTree(treeName)}
                      disabled={!nodes.length || !treeName.trim()}>
                {overwrites ? ui.treeModals.overwriteButton : ui.treeModals.saveButton}
              </button>
            </div>
            {/* Say why Save is disabled, and when it would overwrite an existing save. */}
            {!treeName.trim() && <p className="muted small trees-save-note">{ui.treeModals.nameRequired}</p>}
            {overwrites && <p className="muted small trees-save-note">{ui.treeModals.overwriteWarning}</p>}
          </div>
          <h4 className="share-h">{ui.treeModals.openHeading}</h4>
          {savedCount > 0 && <p className="muted small">{ui.treeModals.openNote}</p>}
          <div className="picker-list">
            {savedCount === 0 && <div className="tio-none">{ui.treeModals.noSavedSystems}</div>}
            {listTrees().map((name) => (
              <div key={name} className="tree-row">
                <button className="picker-item" onClick={() => openTree(name)}><span>{name}</span></button>
                <button className="link-btn" onClick={() => deleteTree(name)}>{ui.treeModals.deleteLink}</button>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {shareText !== null && (
        <Modal title={ui.treeModals.shareTitle} onClose={() => setShareText(null)}>
          {/* The link first: it hands over a working copy. The table stays for a document or an email. */}
          <h4 className="share-h">{ui.treeModals.shareLinkHeading}</h4>
          <p className="muted small">{ui.treeModals.shareLinkIntro}</p>
          <div className="share-actions">
            <button className="btn sm" onClick={copyLink} disabled={!shareUrl}>
              {linkCopied === true ? ui.treeModals.linkCopiedLabel : ui.treeModals.copyLinkButton}
            </button>
            {prefersShareSheet() && shareUrl && (
              <button className="btn sm alt"
                      onClick={() => shareLink({ title: treeName || ui.tree.untitledSystem, url: shareUrl })}>
                {ui.treeModals.systemShareButton}
              </button>
            )}
          </div>
          {linkCopied === 'failed' && <p className="muted small">{ui.treeModals.copyFailed}</p>}

          <h4 className="share-h">{ui.treeModals.shareTableHeading}</h4>
          <p className="muted small">{ui.treeModals.shareIntro}</p>
          <ol className="system-list">
            {systemRows().map((r) => (
              <li key={r.id}>
                <Nav route={{ view: 'solution', id: r.sol.id }} go={go} className="link system-list-name">{cat.tName(r.sol)}</Nav>
                {r.sub && <span className="muted small"> · {r.sub}</span>}
                <dl>
                  <div><dt>{ui.treeExport.takes}</dt><dd>{r.ins.length ? r.ins.map((x) => x.io + (x.with.length ? ' ' + fill(ui.treeExport.fromNodes, { nodes: x.with.join(', ') }) : '')).join('; ') : ui.solutionPage.none}</dd></div>
                  <div><dt>{ui.treeExport.gives}</dt><dd>{r.outs.length ? r.outs.map((x) => x.io + (x.with.length ? ' ' + fill(ui.treeExport.toNodes, { nodes: x.with.join(', ') }) : '')).join('; ') : ui.solutionPage.none}</dd></div>
                </dl>
                {r.tutorial && <a href={r.tutorial} target="_blank" rel="noreferrer">{ui.treeNode.tutorialLink}</a>}
              </li>
            ))}
          </ol>
          {/* What Copy puts on the clipboard; off screen, kept for the select-and-copy fallback. */}
          <textarea ref={shareBox} className="share-text-copy" readOnly value={shareText} tabIndex={-1} aria-hidden="true" />
          <div className="share-actions">
            <button className="btn sm alt" onClick={copyTable}>
              {copied === true ? ui.treeModals.copiedLabel : ui.treeModals.copyButton}
            </button>
          </div>
          {copied === 'failed' && <p className="muted small">{ui.treeModals.copyFailed}</p>}
        </Modal>
      )}
      {destModal && (
        <Modal title={ui.treeModals.destinationTitle} onClose={() => setDestModal(false)}>
          <p className="muted small">{ui.treeModals.destinationIntro}</p>
          <div className="picker-list">
            {[['home', ui.treeModals.destinationHomeOption, ui.treeModals.destinationHomeHint, '🏠'],
              ['dwelling', ui.treeModals.destinationDwellingOption, ui.treeModals.destinationDwellingHint, '🧱'],
              ['environment', ui.treeModals.destinationEnvOption, ui.treeModals.destinationEnvHint, '🌍']]
              .map(([kind, label, hint, glyph]) => {
                // A second ending of the same kind is allowed; the reader is told they already
                // have one.
                const already = nodes.some((n) => n.data?.dest === kind)
                return (
                  <button key={kind} className="picker-item resource-opt"
                          onClick={() => { addDestination(kind, { x: 620, y: 60 + nodes.length * 40 }); setDestModal(false) }}>
                    <span>{glyph} {label}</span>
                    <span className="muted small">
                      {already ? ui.treeModals.destinationAlready : hint}
                    </span>
                  </button>
                )
              })}
            {/* The sinks live under Destinations: a sewer is where a stream ends. */}
            {cat.societalConnections.filter((x) => x.societal === 'sink').length > 0 && (
              <>
                <div className="picker-fn">{ui.treeModals.destinationSinkGroup}</div>
                {cat.societalConnections.filter((x) => x.societal === 'sink').map((x) => (
                  <button key={x.id} className="picker-item"
                          onClick={() => { addNode(x, { x: 620, y: 60 + nodes.length * 40 }); setDestModal(false) }}>
                    <span><Glyph name={MAINS_ICON.sink} /> {cat.tName(x, lang)}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </Modal>
      )}
      {mainsModal && (
        <Modal title={ui.treeModals.addMainsTitle} onClose={() => setMainsModal(false)}>
          <p className="muted small">{ui.treeModals.mainsIntro}</p>
          <div className="picker-list">
            {/* Supply and stock only; sinks are under Destinations. */}
            {['supply', 'stock'].map((kind) => {
              const rows = cat.societalConnections.filter((x) => x.societal === kind)
              if (!rows.length) return null
              return (
                <div key={kind}>
                  <div className="picker-fn">{ui.treeModals.mainsGroups[kind]}</div>
                  {rows.map((x) => (
                    <button key={x.id} className="picker-item"
                            onClick={() => { addNode(x, { x: 80, y: 60 + nodes.length * 40 }); setMainsModal(false) }}>
                      <span><Glyph name={MAINS_ICON[kind]} /> {cat.tName(x, lang)}</span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </Modal>
      )}
      {resourceModal && (
        <Modal title={ui.treeModals.addResourceTitle} onClose={() => setResourceModal(false)}>
          <p className="muted small">{ui.treeModals.resourceIntro}</p>
          <div className="picker-list">
            {cat.naturalResources.map((r) => (
              <button key={r.io} className="picker-item"
                      onClick={() => { addResource(r.io, { x: 80, y: 60 + nodes.length * 40 }); setResourceModal(false) }}>
                <span><Glyph name="leaf" className="glyph-resource" /> {cat.resourceLabel(r.io)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {adequacyOpen && (
        <AdequacyPanel
          graph={adequacyGraph}
          data={{ ...cat.catalogue, ...diagnostic }}
          ui={ui}
          nameOf={(id) => cat.tName(cat.solById[id], lang) || id}
          ioNameOf={(id) => cat.tName(cat.ioById[id], lang) || id}
          onClose={closeAdequacy}
          onReveal={reveal}
          supplyOptions={supplyOptions}
          compareFor={compareFor}
          go={go}
          nodeSolution={(id) => nodes.find((n) => n.id === id)?.data.sol || null}
          onParallel={onParallel}
          onChain={(nodeId, io) => onIo(nodeId, 'out', io)}
          onTryOthers={(solId) => { const n = nodes.find((x) => x.data.sol?.id === solId); if (n) setReplacing(n.id) }}
          systemLink={systemLink}
        />
      )}
    </TreeCtx.Provider>
  )
}

function ToolMenu({ label, glyph, className, title, items, align, head, foot, tray, wrapClass = '' }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <span className={'tool-menu' + (align === 'end' ? ' is-end' : '') + (tray ? ' is-tray' : '') + (wrapClass ? ' ' + wrapClass : '')} ref={box}>
      <button type="button" className={className} aria-expanded={open} title={title}
              onClick={() => setOpen((v) => !v)}>
        <span className="tool-menu-glyph" aria-hidden="true">{glyph}</span>{label}
      </button>
      {open && tray && <div className="tool-menu-backdrop" aria-hidden="true" />}
      {open && (
        <div className="tool-menu-list" role="menu">
          {head && <p className="tool-menu-head">{head}</p>}
          {items.map((it) => (
            <button key={it.key} type="button" role="menuitem" disabled={it.disabled}
                    className={'tool-menu-item' + (it.danger ? ' is-danger' : '')}
                    onClick={() => { setOpen(false); it.run() }}>
              {it.glyph && <Glyph name={it.glyph} size={18} />}
              <span><span className="tool-menu-title">{it.title}</span>{it.line && <span className="tool-menu-line">{it.line}</span>}</span>
            </button>
          ))}
          {foot && <div className="tool-menu-foot">{foot}</div>}
        </div>
      )}
    </span>
  )
}

// Where links attach: top and bottom when the screen is portrait, left and right otherwise.
const IN_AT = (portrait) => (portrait ? Position.Top : Position.Left)
const OUT_AT = (portrait) => (portrait ? Position.Bottom : Position.Right)

// Below this zoom a card shows only its name and what is still open; a tap brings it close.
const COMPACT_BELOW = 0.6


/*
 * Arrange (brief 03, confirmed by Eric 2026-10-18): cards laid out in rows by their links. What
 * nothing feeds comes first; each card one row after the last card feeding it; a branch side by
 * side under its source; a loop drawn as a return (its back link ignored for the order); cards
 * linked to nothing in a last row. Down the screen in portrait, across it in landscape. Returns
 * a position for every node id. Second pass (Eric, 2026-10-20, on his tree): a source sits one
 * column before what it feeds, the order within a column starts from the reader's own and is
 * refined to cut crossings, and each card is spaced by its own size.
 */
export function arrangePositions(nodes, edges, { down, sizeOf }) {
  const ids = nodes.map((n) => n.id)
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const linked = new Set(edges.flatMap((e) => [e.source, e.target]))
  const out = new Map(ids.map((id) => [id, []]))
  const inn = new Map(ids.map((id) => [id, []]))
  for (const e of edges) {
    if (!out.has(e.source) || !inn.has(e.target) || e.source === e.target) continue
    out.get(e.source).push(e.target)
    inn.get(e.target).push(e.source)
  }
  // Back links (into a card still on the walk) close a loop: left out of the order.
  const back = new Set()
  const state = new Map()
  const walk = (id) => {
    state.set(id, 1)
    for (const t of out.get(id)) {
      if (state.get(t) === 1) back.add(id + '>' + t)
      else if (!state.get(t)) walk(t)
    }
    state.set(id, 2)
  }
  const starts = ids.filter((id) => linked.has(id) && !inn.get(id).length)
  for (const id of [...starts, ...ids.filter((x) => linked.has(x))]) if (!state.get(id)) walk(id)
  const parents = (id) => inn.get(id).filter((p) => !back.has(p + '>' + id))
  const children = (id) => out.get(id).filter((c) => !back.has(id + '>' + c))
  // Each card one column after the last card feeding it.
  const depth = new Map()
  const depthOf = (id, seen = new Set()) => {
    if (depth.has(id)) return depth.get(id)
    if (seen.has(id)) return 0
    seen.add(id)
    const ps = parents(id)
    const d = ps.length ? Math.max(...ps.map((p) => depthOf(p, seen) + 1)) : 0
    depth.set(id, d)
    return d
  }
  for (const id of ids) if (linked.has(id)) depthOf(id)
  // A source sits one column before the first card it feeds, not always at the far left
  // (Eric's tree: the sun two columns before the solar heater it feeds).
  for (let pass = 0; pass < 3; pass++) {
    for (const id of ids) {
      if (!linked.has(id) || parents(id).length) continue
      const cs = children(id)
      if (cs.length) depth.set(id, Math.max(0, Math.min(...cs.map((c) => depth.get(c))) - 1))
    }
  }
  const layers = []
  for (const id of ids) if (linked.has(id)) (layers[depth.get(id)] ||= []).push(id)
  const rows = layers.filter(Boolean)
  // The order within a column starts from where the reader had put the cards, then a few
  // passes place each card level with the cards it is linked to (fewer crossings).
  const across = (id) => (down ? byId[id].position.x : byId[id].position.y)
  rows.forEach((row) => row.sort((a, b) => across(a) - across(b)))
  const at = new Map()
  const index = () => rows.forEach((row) => row.forEach((id, i) => at.set(id, i / Math.max(1, row.length - 1))))
  index()
  const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + at.get(x), 0) / xs.length : null)
  for (let pass = 0; pass < 4; pass++) {
    const order = pass % 2 ? [...rows].reverse() : rows
    for (const row of order) {
      const key = new Map(row.map((id) => {
        const m = mean(pass % 2 ? children(id) : parents(id))
        return [id, m === null ? at.get(id) : m]
      }))
      row.sort((a, b) => key.get(a) - key.get(b))
      row.forEach((id, i) => at.set(id, i / Math.max(1, row.length - 1)))
    }
  }
  const loose = ids.filter((id) => !linked.has(id))
  if (loose.length) rows.push(loose)
  // Each card spaced by its own size; columns as wide as their widest card.
  const GAP_ALONG = 90, GAP_ACROSS = 40
  const pos = {}
  let along = 0
  for (const row of rows) {
    const sizes = row.map((id) => sizeOf(id))
    const thick = Math.max(...sizes.map((s) => (down ? s.h : s.w)))
    const total = sizes.reduce((a, s) => a + (down ? s.w : s.h), 0) + GAP_ACROSS * (row.length - 1)
    let c = -total / 2
    row.forEach((id, i) => {
      const s = sizes[i]
      pos[id] = down ? { x: c, y: along } : { x: along, y: c }
      c += (down ? s.w : s.h) + GAP_ACROSS
    })
    along += thick + GAP_ALONG
  }
  return pos
}

// No exit control: navigation is the breadcrumbs and the global nav.
export default function TreeBuilder({ filters, setFilter, go, seed, lang }) {
  return (
    <ReactFlowProvider>
      <Canvas filters={filters} setFilter={setFilter} go={go} seed={seed} lang={lang} />
    </ReactFlowProvider>
  )
}
