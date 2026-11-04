// URL routing: the one place that maps a route object to a path and back. App.jsx owns the
// state.
//
// /en/need/<fn>[/<sub>]      /fr/besoin/<fn>[/<sub>]
// /en/solution/<slug>        /fr/solution/<slug>
// /en/resource/<slug>        /fr/ressource/<slug>
// /en/resources              /fr/ressources    the resources index
// /en/search?q=...           /fr/recherche?q=...
// /en/settings  /en/tree     /fr/reglages  /fr/arbre
// /en/tree?add=<slug>[,<slug>] the builder with that solution (or those) placed
// /en/why  /en/needs         /fr/pourquoi  /fr/besoins
// /en/guide/<slug>           /fr/guide/<slug>
// /en/guides                 /fr/guides        the guides index
//
// The language lives in the path so both languages are separately addressable (hreflang). Slugs
// come from the workbook and are frozen: never derived from names here.
import { catalogue, fnById, subById, ioById, solById } from './catalogue'
// Segments and languages live in url-vocab.js so the prerenderer can share them without the
// catalogue.
import { LANGS, DEFAULT_LANG, SEG, segPath, TOPIC_PARAM, TOPIC_SLUG } from './url-vocab'
// Guide slugs live in the content folder: a guide is an editorial page, not a catalogue entity.
import { guideIdForSlug, guideSlug } from './content'

export { LANGS }

const slugOf = (entity, lang) =>
  (lang === 'fr' ? entity?.slug_fr : entity?.slug) || entity?.slug || ''

// Slug-to-entity indexes, one per kind and language, built once at module load.
function indexBy(list, lang) {
  const out = {}
  for (const e of list) {
    const s = slugOf(e, lang)
    if (s) out[s] = e
  }
  return out
}
const IDX = {}
for (const lang of LANGS) {
  IDX[lang] = {
    fn: indexBy(catalogue.functions, lang),
    io: indexBy(catalogue.io_types, lang),
    sol: indexBy(catalogue.solutions, lang),
    // Sub-function slugs are unique only within a parent, so they are keyed
    // "<parent-slug>/<sub-slug>".
    sub: Object.fromEntries(
      catalogue.subfunctions
        .map((s) => [`${slugOf(fnById[s.function_id], lang)}/${slugOf(s, lang)}`, s])
        .filter(([k]) => !k.startsWith('/') && !k.endsWith('/'))
    ),
  }
}

/*
 * The language for a visitor with no preference at "/": French if French appears anywhere in
 * `navigator.languages` (browser or OS), English otherwise. So ['en-GB', 'fr-FR'] gets French.
 */
export function preferredLang() {
  const stored = localStorage.getItem('lang')
  if (LANGS.includes(stored)) return stored
  const tags = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || '']
  const wantsFrench = tags.some((t) => String(t).slice(0, 2).toLowerCase() === 'fr')
  return wantsFrench ? 'fr' : DEFAULT_LANG
}

/** Route object -> path (always absolute, always language-prefixed). */
export function pathFor(route, lang) {
  const seg = SEG[lang] || SEG[DEFAULT_LANG]
  const p = (...parts) => segPath(lang, ...parts)
  switch (route?.view) {
    case 'function': {
      const fn = fnById[route.id]
      return fn ? p(seg.need, slugOf(fn, lang)) : p()
    }
    case 'subfunction': {
      const sub = subById[route.id]
      const fn = sub && fnById[sub.function_id]
      return sub && fn ? p(seg.need, slugOf(fn, lang), slugOf(sub, lang)) : p()
    }
    case 'solution': {
      const s = solById[route.id]
      return s ? p(seg.solution, slugOf(s, lang)) : p()
    }
    case 'io': {
      const e = ioById[route.id]
      return e ? p(seg.resource, slugOf(e, lang)) : p()
    }
    case 'search':
      return p(seg.search) + (route.q ? `?q=${encodeURIComponent(route.q)}` : '')
    case 'settings': return p(seg.settings)
    case 'tree': {
      // ?add carries a solution slug, so "put this in my graph" is a real link.
      // One id, or a list (a guide's "add these solutions"): slugs joined by commas.
      const slugs = [].concat(route.add || []).map((id) => solById[id]).filter(Boolean)
        .map((s) => encodeURIComponent(slugOf(s, lang)))
      return p(seg.tree) + (slugs.length ? `?add=${slugs.join(',')}` : '')
    }
    case 'needs':    return p(seg.needs)
    case 'resources': return p(seg.resources)
    case 'guides':   return p(seg.guides)
    case 'guide': {
      const g = guideSlug(route.id, lang)
      return g ? p(seg.guide, g) : p()
    }
    case 'why':      return p(seg.why)
    case 'about':    return p(seg.about)
    case 'people': {
      const t = route.topic && (TOPIC_SLUG[lang] || TOPIC_SLUG.en)[route.topic]
      // `at`: a group to land on ("Where to find help" lands on Meet), as the section's own id.
      return p(seg.people) + (t ? `?${TOPIC_PARAM[lang] || 'topic'}=${t}` : '') + (route.at ? `#pp-${route.at}` : '')
    }
    case 'legal':    return p(seg.legal)
    default:         return p()
  }
}

/** Absolute URL for sharing. */
export const urlFor = (route, lang) => window.location.origin + pathFor(route, lang)

/* Path to {lang, route}. Unknown slugs resolve to 'notfound', never silently to home. */
export function parsePath(pathname = window.location.pathname, search = window.location.search) {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const lang = LANGS.includes(parts[0]) ? parts[0] : null
  if (!lang) return { lang: null, route: { view: 'home' } }   // bare "/" -> caller redirects

  const seg = SEG[lang]
  const [, kind, a, b] = parts
  const idx = IDX[lang]
  const q = new URLSearchParams(search).get('q') || ''

  if (!kind) return { lang, route: { view: 'home' } }
  if (kind === seg.settings) return { lang, route: { view: 'settings' } }
  if (kind === seg.tree) {
    const add = (new URLSearchParams(search).get('add') || '').split(',')
      .map((slug) => IDX[lang].sol[slug]?.id).filter(Boolean)
    const seeded = add.length > 1 ? add : add[0]
    return { lang, route: { view: 'tree', ...(seeded ? { add: seeded } : {}) } }
  }
  if (kind === seg.why) return { lang, route: { view: 'why' } }
  if (kind === seg.about) return { lang, route: { view: 'about' } }
  if (kind === seg.people) {
    const word = new URLSearchParams(search).get(TOPIC_PARAM[lang])
    const topic = Object.keys(TOPIC_SLUG[lang]).find((k) => TOPIC_SLUG[lang][k] === word)
    return { lang, route: { view: 'people', ...(topic ? { topic } : {}) } }
  }
  if (kind === seg.legal) return { lang, route: { view: 'legal' } }
  if (kind === seg.needs) return { lang, route: { view: 'needs' } }
  if (kind === seg.resources) return { lang, route: { view: 'resources' } }
  if (kind === seg.guides) return { lang, route: { view: 'guides' } }
  if (kind === seg.guide && a) {
    const id = guideIdForSlug(a, lang)
    return { lang, route: id ? { view: 'guide', id } : { view: 'notfound' } }
  }
  if (kind === seg.search) return { lang, route: { view: 'search', q } }

  if (kind === seg.need && a) {
    if (b) {
      const sub = idx.sub[`${a}/${b}`]
      return { lang, route: sub ? { view: 'subfunction', id: sub.id } : { view: 'notfound' } }
    }
    const fn = idx.fn[a]
    return { lang, route: fn ? { view: 'function', id: fn.id } : { view: 'notfound' } }
  }
  if (kind === seg.solution && a) {
    const s = idx.sol[a]
    return { lang, route: s ? { view: 'solution', id: s.id } : { view: 'notfound' } }
  }
  if (kind === seg.resource && a) {
    const e = idx.io[a]
    return { lang, route: e ? { view: 'io', id: e.id } : { view: 'notfound' } }
  }
  return { lang, route: { view: 'notfound' } }
}
