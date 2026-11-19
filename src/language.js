// The second language, loaded on demand (B2, 2026-10-26): the French interface strings and the
// catalogue's long French text are two chunks an English reader never fetches. Both are in the
// offline download, so switching language works without a connection. Called before the first
// render (main.jsx) and before a switch (App.jsx setLang).
import { provideFrench } from './ui-strings.js'
import { mergeFrench } from './catalogue.js'

let french = null
let ready = false
export const languageReady = (lang) => lang !== 'fr' || ready
export function loadLanguage(lang) {
  if (lang !== 'fr') return Promise.resolve()
  french ||= Promise.all([import('./ui-strings.fr.js'), import('virtual:catalogue-fr')])
    .then(([s, c]) => { provideFrench(s.fr); mergeFrench(c.default); ready = true })
  return french
}

// The catalogue's long English text (Q2, 2026-11-19; vite.config.js LONG_EN): descriptions,
// choose-it-if, site needs, rules, lifespan, sources. Every page but the home page needs it, in
// either language, so main.jsx waits for it there; on the home page it is fetched just after the
// first paint, so it is usually in before the first click. Merged into the same entity objects.
let long = null
let longIn = false
export const longReady = () => longIn
export function loadLong() {
  long ||= import('virtual:catalogue-en').then((c) => { mergeFrench(c.default); longIn = true })
  return long
}
