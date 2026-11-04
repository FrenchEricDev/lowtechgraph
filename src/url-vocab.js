// The URL vocabulary — path segments and the language list, and nothing else.
//
// Extracted from router.js on 2026-08-18 so the build-time prerenderer can share it.
// It deliberately imports NOTHING: router.js pulls in catalogue.json (a browser-side
// JSON module import), which a plain Node script can't consume without import
// attributes. Keeping the vocabulary dependency-free means the app and the prerenderer
// build identical paths from one definition instead of two that can drift apart.
export const LANGS = ['en', 'fr']
export const DEFAULT_LANG = 'en'

// Segments are translated too: a French URL reading half-English is exactly the small
// tell that makes a site feel machine-made.
export const SEG = {
  en: { need: 'need', needs: 'needs', guide: 'guide', guides: 'guides', solution: 'solution', resource: 'resource', resources: 'resources', search: 'search', settings: 'settings', tree: 'tree', why: 'why', about: 'about', legal: 'legal', people: 'people' },
  fr: { need: 'besoin', needs: 'besoins', guide: 'guide', guides: 'guides', solution: 'solution', resource: 'ressource', resources: 'ressources', search: 'recherche', settings: 'reglages', tree: 'arbre', why: 'pourquoi', about: 'a-propos', legal: 'mentions-legales', people: 'gens-et-lieux' },
}

// People and places opened on one topic ("Who to ask" on a solution page): the query word and
// the topic words, translated like the segments.
export const TOPIC_PARAM = { en: 'topic', fr: 'sujet' }
export const TOPIC_SLUG = {
  en: { water: 'water', heat: 'heating', food: 'food', power: 'power', sanitation: 'sanitation', building: 'building' },
  fr: { water: 'eau', heat: 'chauffage', food: 'alimentation', power: 'energie', sanitation: 'assainissement', building: 'construction' },
}

// `need` (singular) is one function; `needs` (plural) is the index of all of them, which
// moved off the homepage when the homepage became a set of doors rather than a list.
// `guides` (plural) is their index, in the nav since D10 (2026-09-24).
// `guide` is an editorialised recommendation page: a handful of hand-picked solutions with
// a reason each, as opposed to the exhaustive machine-ranked lists everywhere else.

/** '/en/solution/adobe' from ('en', 'solution', 'adobe'). */
export const segPath = (lang, ...parts) => '/' + [lang, ...parts.filter(Boolean)].join('/')
