import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { startUpdateWatch } from './sw-update.js'
import { loadLanguage } from './language.js'
import { parsePath, preferredLang } from './router.js'

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
loadLanguage(first).catch(() => {}).finally(() => {
  createRoot(document.getElementById('root')).render(<App />)
  // Drop the prerendered static copy once React is up. It lives in a sibling of #root
  // (scripts/prerender.mjs) rather than inside it, so React never has to reconcile with
  // it — and a visitor with JavaScript disabled keeps it, because nothing removes it.
  document.getElementById('prerender')?.remove()
})

// A deploy should be visible on this visit, not the next one. See sw-update.js for why
// the injected registerSW.js cannot do this on its own.
startUpdateWatch()
