// Make a deploy visible on this visit instead of the next. With 'autoUpdate', a returning
// reader is served the old cached bundle while the new worker installs in the background, so a
// copy change shows one visit late. This asks for an update as soon as a registration exists
// and reloads once when a new worker takes control. Registration stays with vite-plugin-pwa's
// registerSW.js: owning it risks silently ending offline support.

// Was this page already controlled when it loaded? On a first visit the new worker also fires
// controllerchange, and there is nothing stale to reload. Read at module load.
const wasControlled = !!navigator.serviceWorker?.controller

// Set when an update arrived at a bad moment; applied on the reader's next navigation.
let pending = false
let reloading = false

// A guard against a reload loop, which would be worse than the bug.
const GUARD = 'sw-reloads'
// A rate, not a lifetime count: a loop reloads about once a second, real deploys arrive minutes
// apart. Three reloads within thirty seconds stops a loop; a day of deploys never fills a
// window. A lifetime count left pages stuck on old bundles after a day of many builds.
const WINDOW_MS = 30_000
const MAX_IN_WINDOW = 3

function recentReloads() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(GUARD) || '[]')
    const now = Date.now()
    // A tab holding the old format (a bare number) is read as no recent reloads.
    return (Array.isArray(raw) ? raw : []).filter((t) => now - t < WINDOW_MS)
  } catch {
    // Private mode and blocked storage throw: treat as none, since the guard is only a
    // backstop.
    return []
  }
}

function applyUpdate() {
  if (reloading) return
  const recent = recentReloads()
  if (recent.length >= MAX_IN_WINDOW) {
    // If this prints, it really is a loop, and the problem is the deploy.
    console.warn('[sw-update] reloads are looping; leaving the page alone')
    return
  }
  reloading = true
  try {
    sessionStorage.setItem(GUARD, JSON.stringify([...recent, Date.now()]))
  } catch { /* see recentReloads */ }
  window.location.reload()
}

// Is now a decent moment to reload? In this order, because the order matters: never in the
// system builder (a hidden tab is where half-built graphs are parked); a hidden tab, freely;
// otherwise, only at the top of the page.
function safeToReloadNow() {
  // "/en/tree" -> ["", "en", "tree"]: the view segment is [2].
  const seg = window.location.pathname.split('/')[2]
  if (seg === 'tree' || seg === 'arbre') return false
  if (document.visibilityState === 'hidden') return true
  return window.scrollY < 100
}

export function startUpdateWatch() {
  const sw = navigator.serviceWorker
  if (!sw) return

  // `ready` resolves once there is an active worker, which never happens in dev.
  const check = () => sw.ready
    .then((registration) => registration.update())
    .catch(() => {
      // A stale registration from a production preview 404s against the dev server.
    })
  check()
  // A single-page app never navigates, so the browser never re-checks the worker by itself: a
  // phone tab left open for days kept a build two weeks old (F1 phone session, 2026-10-13). Check
  // again whenever the tab comes back into view, and hourly while it stays open.
  let last = Date.now()
  const checkIfStale = () => {
    if (Date.now() - last < 60_000) return
    last = Date.now()
    check()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkIfStale()
  })
  setInterval(checkIfStale, 60 * 60 * 1000)

  sw.addEventListener('controllerchange', () => {
    if (!wasControlled) return          // first registration, not an update
    if (safeToReloadNow()) applyUpdate()
    else pending = true
  })
}

// Called by App.jsx on forward in-app navigation, a natural break. Not on back and forward,
// where the browser restores scroll.
export function applyUpdateIfPending() {
  if (!pending) return
  pending = false
  // Let the navigation land first: App pushes the URL inside a state updater, so reloading
  // synchronously would reload the page being left and eat the click.
  setTimeout(applyUpdate, 0)
}
