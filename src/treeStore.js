import * as cat from './catalogue'

/*
 * The working tree, outside any component (moved here from TreeBuilder.jsx on 2026-09-25 so the
 * builder can load on demand): its storage, its share-link encoding, and the edits other pages
 * make to it (the Add buttons, connecting mode, the badge on My system).
 */

/*
 * A tree as a URL: the whole graph goes in the fragment, so the receiver opens a working,
 * editable copy. A fragment is never sent to the server, so shared trees stay out of access
 * logs. deflate-raw via CompressionStream; without it the JSON goes in uncompressed.
 */

export const HASH_PREFIX = '#t='

const b64url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (str) => Uint8Array.from(
  atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export async function encodeTree(payload) {
  const json = new TextEncoder().encode(JSON.stringify(payload))
  if (typeof CompressionStream !== 'function') return 'r' + b64url(json)
  const cs = new CompressionStream('deflate-raw')
  const w = cs.writable.getWriter(); w.write(json); w.close()
  const buf = await new Response(cs.readable).arrayBuffer()
  return 'z' + b64url(new Uint8Array(buf))
}

// The check's settings, kept for the session; a report's link carries them too.
export const SCENARIO_KEY = 'lowtech_adequacy_scenario'

export async function decodeTree(code) {
  const kind = code[0]
  const bytes = unb64url(code.slice(1))
  if (kind === 'r') return JSON.parse(new TextDecoder().decode(bytes))
  const ds = new DecompressionStream('deflate-raw')
  const w = ds.writable.getWriter(); w.write(bytes); w.close()
  const buf = await new Response(ds.readable).arrayBuffer()
  return JSON.parse(new TextDecoder().decode(buf))
}

/*
 * The working tree survives in-app navigation (module scope), a reload (sessionStorage), and
 * since 2026-10-20 a closed tab too: it is kept on the device until Erase (Eric, 2026-10-13,
 * B3; a phone that closes the tab lost it). A system brought back from an earlier visit says so
 * on arrival ("Continue the system from …? / Start fresh"). Named trees live under Save/Open.
 */
const SESSION_KEY = 'lowtech_tree_session'
const DEVICE_KEY = 'lowtech_tree_device'
// When the system on the canvas came back from an earlier visit: its last save, else null.
export let restoredFrom = null
export const forgetRestored = () => { restoredFrom = null }

/*
 * Every IO id an edge carries. Edges saved before ids became a list have a single `io`, and
 * shared links still do.
 */
export const edgeIos = (e) => {
  const list = e.data?.ios
  if (Array.isArray(list) && list.length) return list
  const one = e.data?.io ?? e.io
  return one ? [one] : []
}

/*
 * Node and edge objects to the small JSON shape: ids and positions only, since the catalogue is
 * the source of truth.
 */
export function serializeTree(nodes, edges) {
  return {
    nodes: nodes.map((n) => n.data.sol
      ? { id: n.id, sol: n.data.sol.id, position: n.position }
      : n.data.dest
        ? { id: n.id, dest: n.data.dest, position: n.position }
        : { id: n.id, res: n.data.io.io, position: n.position }),
    edges: edges.map((e) => {
      const ios = edgeIos(e)
      // `io` stays alongside `ios` so a tree saved today opens in an older build.
      return { id: e.id, source: e.source, target: e.target,
               io: ios[0] ?? null, ios, label: e.label }
    }),
  }
}

/*
 * The inverse. Drops anything the catalogue no longer has, and any edge left dangling by that,
 * so an updated catalogue degrades instead of crashing.
 */
export function hydrateTree(raw) {
  const nodes = (raw?.nodes || []).map((n) => {
    if (n.dest) {
      return { id: n.id, type: 'destination', position: n.position, data: { dest: n.dest } }
    }
    if (n.res) {
      const rd = cat.resourceDescriptor(n.res)
      return rd && { id: n.id, type: 'resource', position: n.position,
                     data: { io: { io: rd.io, name: rd.name }, label: rd.label } }  // i18n-ok: stores the raw descriptor; the node renders it through tName
    }
    const sol = cat.solById[n.sol]
    return sol && { id: n.id, type: 'solution', position: n.position, data: { sol } }
  }).filter(Boolean)
  const live = new Set(nodes.map((n) => n.id))
  const edges = (raw?.edges || [])
    .filter((e) => live.has(e.source) && live.has(e.target))
    .map((e) => ({
      ...e, animated: true,
      // Put the IO id back where a live edge keeps it (data.io), or the share table falls back
      // to language-dependent labels and the next save loses the id.
      data: { ...e.data, io: e.io ?? e.data?.io ?? null,
              ios: (Array.isArray(e.ios) && e.ios.length) ? e.ios
                   : [e.io ?? e.data?.io].filter(Boolean) },
      // The label is re-derived from all the IO ids in the current language; the stored label
      // is only a fallback.
      label: ((Array.isArray(e.ios) && e.ios.length ? e.ios : [e.io].filter(Boolean))
                .map((x) => cat.tName(cat.ioById[x])).filter(Boolean).join(', ')) || e.label,
    }))
  return { nodes, edges }
}

function loadSession() {
  try {
    let raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    if (!raw) {
      raw = JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null')
      if (raw && (raw.nodes || []).length) restoredFrom = raw.savedAt || null
    }
    if (!raw) return null
    const { nodes, edges } = hydrateTree(raw)
    return { nodes, edges, name: raw.name || '', nameKey: raw.nameKey || null, counter: raw.counter || 0 }  // i18n-ok: the tree name the user typed, not an entity
  } catch { return null }
}

export function persistSession() {
  const data = {
    ...serializeTree(treeSession.nodes, treeSession.edges),
    name: treeSession.name, nameKey: treeSession.nameKey || null, counter: treeSession.counter,  // i18n-ok: the tree name the user typed
  }
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)) } catch { /* private mode */ }
  try {
    if (data.nodes.length) localStorage.setItem(DEVICE_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() }))
    else localStorage.removeItem(DEVICE_KEY)
  } catch { /* quota, or private mode: losing scratch work is not worth throwing over */ }
  treeListeners.forEach((fn) => fn())
}

/*
 * The number of solutions on the canvas, for the badge on the Build link: the header lives
 * outside the builder and must follow the tree while the reader is on other pages.
 * Resources and destinations are not counted: the badge answers "what have I picked".
 */
const treeListeners = new Set()
export const subscribeTree = (fn) => { treeListeners.add(fn); return () => treeListeners.delete(fn) }
export const placedSolutionCount = () => treeSession.nodes.filter((n) => n.data?.sol).length
// A string, so useSyncExternalStore can compare snapshots.
export const placedSolutionIds = () =>
  treeSession.nodes.filter((n) => n.data?.sol).map((n) => n.data.sol.id).sort().join(',')
export const isPlaced = (solId) => treeSession.nodes.some((n) => n.data?.sol?.id === solId)

/*
 * Adding from outside the builder (a solution page, a guide, a list row): the canvas is not
 * mounted, so the session is edited directly and the canvas picks it up when it next opens.
 * Loose additions gather in a block of four columns to the right of the connected tree, each
 * in the first free cell, so a browsing session lands as one tidy tray to wire up later.
 */
// A little over a card, the tallest near 250: 260 and 180 had them touching and overlapping.
const CELL = { w: 280, h: 270 }
export function addToTree(solIds) {
  const fresh = [...new Set(solIds)].filter((id) => cat.solById[id] && !isPlaced(id))
  if (!fresh.length) return 0
  const linked = new Set(treeSession.edges.flatMap((e) => [e.source, e.target]))
  const anchored = treeSession.nodes.filter((n) => linked.has(n.id) || !n.data?.sol)
  const x0 = anchored.length ? Math.max(...anchored.map((n) => n.position.x)) + CELL.w : 90
  const y0 = anchored.length ? Math.min(...anchored.map((n) => n.position.y)) : 90
  const taken = (x, y) => treeSession.nodes.some((n) =>
    Math.abs(n.position.x - x) < CELL.w - 20 && Math.abs(n.position.y - y) < CELL.h - 40)
  // Ids continue past every id in use: a tree loaded from a link or an example may not have
  // moved the counter.
  let next = Math.max(treeSession.counter || 0, ...treeSession.nodes.map((n) =>
    parseInt(String(n.id).replace(/\D/g, ''), 10) || 0))
  let cell = 0
  for (const id of fresh) {
    let x, y
    do {
      x = x0 + (cell % 4) * CELL.w
      y = y0 + Math.floor(cell / 4) * CELL.h
      cell++
    } while (taken(x, y) && cell < 400)
    next++
    treeSession.nodes = treeSession.nodes.concat(
      { id: `n${next}`, type: 'solution', position: { x, y }, data: { sol: cat.solById[id] } })
  }
  treeSession.counter = next
  persistSession()
  return fresh.length
}
/*
 * Connecting mode (D10 Q3, TODO F16): add two solutions and the link between them from outside
 * the builder. `from` is the solution the reader started at, `dir` which side of it the resource
 * is on ('out': `from` makes it and `to` uses it; 'in': the reverse). Whichever is not placed yet
 * is placed: the origin in the tray, the other beside it on the side the link runs. The edge has
 * the canvas's own shape, every matching io included, so the builder cannot tell the difference.
 * Returns how many solutions were added and whether a link was drawn.
 */
export function connectInTree(fromId, toId, io, dir) {
  const before = { nodes: treeSession.nodes, edges: treeSession.edges }
  const added = addToTree([fromId])            // the origin, into the tray, if it is not there
  const nodeOf = (id) => treeSession.nodes.find((n) => n.data?.sol?.id === id)
  const from = nodeOf(fromId)
  let to = nodeOf(toId)
  let placed = added
  if (!to && cat.solById[toId]) {
    const side = dir === 'out' ? 1 : -1
    const taken = (x, y) => treeSession.nodes.some((n) =>
      Math.abs(n.position.x - x) < CELL.w - 20 && Math.abs(n.position.y - y) < CELL.h - 40)
    let x = from.position.x + side * 320
    let y = from.position.y
    for (let k = 0; k < 40 && taken(x, y); k++) y += 110
    const next = Math.max(treeSession.counter || 0, ...treeSession.nodes.map((n) =>
      parseInt(String(n.id).replace(/\D/g, ''), 10) || 0)) + 1
    treeSession.counter = next
    to = { id: `n${next}`, type: 'solution', position: { x, y }, data: { sol: cat.solById[toId] } }
    treeSession.nodes = treeSession.nodes.concat(to)
    placed += 1
  }
  const [src, tgt] = dir === 'out' ? [from, to] : [to, from]
  if (treeSession.edges.some((e) => e.source === src.id && e.target === tgt.id)) {
    persistSession()
    return { added: placed, linked: false }
  }
  const wanted = new Set(tgt.data.sol.inputs.map((i) => i.io))
  const ios = src.data.sol.outputs.map((o) => o.io).filter((x) => wanted.has(x))
  const list = ios.length ? ios : [io]
  treeSession.edges = treeSession.edges.concat({
    id: `e-${src.id}-${tgt.id}-${io}`, source: src.id, target: tgt.id,
    data: { io, ios: list },
    label: list.map((x) => cat.tName(cat.ioById[x])).filter(Boolean).join(', ') || io,
    animated: true,
  })
  persistSession()
  return { added: placed, linked: true, undo: undoTo(before) }
}

// Puts the system back as it was, unless it changed in the meantime.
function undoTo(before) {
  const after = { nodes: treeSession.nodes, edges: treeSession.edges }
  return () => {
    if (treeSession.nodes !== after.nodes || treeSession.edges !== after.edges) return false
    treeSession.nodes = before.nodes
    treeSession.edges = before.edges
    persistSession()
    return true
  }
}

/*
 * Takes away the link from `fromId` to `toId` through `io` (brief 09: a connected row can be
 * undone from the page). The cards stay. Returns an undo, or null when there was no link.
 */
export function disconnectInTree(fromId, toId, io, dir) {
  const ids = (id) => new Set(treeSession.nodes.filter((n) => n.data?.sol?.id === id).map((n) => n.id))
  const [srcIds, tgtIds] = dir === 'out' ? [ids(fromId), ids(toId)] : [ids(toId), ids(fromId)]
  const hit = (e) => srcIds.has(e.source) && tgtIds.has(e.target)
    && (e.data?.ios || [e.data?.io ?? e.io]).includes(io)
  if (!treeSession.edges.some(hit)) return null
  const before = { nodes: treeSession.nodes, edges: treeSession.edges }
  treeSession.edges = treeSession.edges.filter((e) => !hit(e))
  persistSession()
  return undoTo(before)
}

/* The solutions a placed solution is already linked to through one io, for its chip. */
export function linkedThrough(solId, io, dir) {
  const byId = Object.fromEntries(treeSession.nodes.map((n) => [n.id, n]))
  const mine = new Set(treeSession.nodes.filter((n) => n.data?.sol?.id === solId).map((n) => n.id))
  return treeSession.edges
    .filter((e) => (dir === 'out' ? mine.has(e.source) : mine.has(e.target))
      && (e.data?.ios || [e.data?.io ?? e.io]).includes(io))
    .map((e) => byId[dir === 'out' ? e.target : e.source]?.data?.sol)
    .filter(Boolean)
}
// Snapshot for useSyncExternalStore: the edges as one string, so it changes only when they do.
export const edgeKey = () => treeSession.edges.map((e) => e.id).join('|')

export function removeFromTree(solId) {
  const gone = new Set(treeSession.nodes.filter((n) => n.data?.sol?.id === solId).map((n) => n.id))
  if (!gone.size) return null
  const before = { nodes: treeSession.nodes, edges: treeSession.edges }
  treeSession.nodes = treeSession.nodes.filter((n) => !gone.has(n.id))
  treeSession.edges = treeSession.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target))
  persistSession()
  // Puts the cards and their links back exactly, unless the system changed in the meantime.
  const after = { nodes: treeSession.nodes, edges: treeSession.edges }
  return () => {
    if (treeSession.nodes !== after.nodes || treeSession.edges !== after.edges) return false
    treeSession.nodes = before.nodes
    treeSession.edges = before.edges
    persistSession()
    return true
  }
}

export const treeSession = loadSession() || { nodes: [], edges: [], name: '', nameKey: null, counter: 0 }
