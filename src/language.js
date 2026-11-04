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
