// First, before React draws anything: tolerate a page translator's edits (src/dom-guard.js).
import './dom-guard.js'
import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { startUpdateWatch } from './sw-update.js'
import { loadLanguage, loadLong } from './language.js'
import { parsePath, preferredLang } from './router.js'
import { ui } from './ui-strings.js'

// Whatever goes wrong while drawing, never a blank page (2026-11-27): one there had no header, no
// words and no way out. A reload fetches a fresh copy, which also mends a deploy's missing chunk.
class Recover extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="view" role="alert">
        <h1>{ui.app.crashHeading}</h1>
        <p className="lede">{ui.app.crashBody}</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>{ui.app.crashReload}</button>
      </div>
    )
  }
}

// React StrictMode omitted as a precaution: its dev-only double-mount can
// disrupt React Flow's ResizeObserver-based node measurement. Production is
// unaffected either way.
//
// A French page waits for its French (B2): the strings and the catalogue's long text, one chunk
// each, so the first paint is already in French. The language is the one App will pick: the
// address's, or the reader's preference at the bare root or with l=auto. Should the chunk fail
// (offline before it was ever cached), the app still starts, in English.
const parsed = parsePath()
const first = !parsed.lang || new URLSearchParams(window.location.search).get('l') === 'auto'
  ? preferredLang() : parsed.lang
// Any page but the home page waits for the long English text too (Q2); the home page fetches it
// once it is drawn.
const home = parsed.route.view === 'home'
Promise.all([loadLanguage(first).catch(() => {}), home ? null : loadLong().catch(() => {})]).finally(() => {
  if (home) setTimeout(() => loadLong().catch(() => {}), 0)
  createRoot(document.getElementById('root')).render(<Recover><App /></Recover>)
  // Drop the prerendered static copy once React is up. It lives in a sibling of #root
  // (scripts/prerender.mjs) rather than inside it, so React never has to reconcile with
  // it — and a visitor with JavaScript disabled keeps it, because nothing removes it.
  document.getElementById('prerender')?.remove()
})

// A deploy should be visible on this visit, not the next one. See sw-update.js for why
// the injected registerSW.js cannot do this on its own.
startUpdateWatch()
