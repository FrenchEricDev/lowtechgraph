// The folder CMS: homepage cards and guide pages authored as files (one home per kind of text,
// Methodology 2.1).
//
// Every card position is a folder: `content/section1/card3/` holds that card, and an absent
// folder or card.json renders nothing, so a section carries zero to four cards without code
// changes.
//
// A file says which and why (picks, reasons, page copy); the catalogue says what (name,
// summary, ratings, link). So a card stores a solution ID, never a name, and IDs rather than
// slugs, so one file serves both languages.
import { solById } from './catalogue'

// Resolved at build time: an added folder needs a rebuild. `eager` keeps call sites
// synchronous.
const CARDS = import.meta.glob('./content/{hero,section1,section2}/*/card.json', { eager: true })
const GUIDES = import.meta.glob('./content/guides/*/guide.json', { eager: true })
// Per-language artwork, since hero images carry their text: `image.*` for both languages, or
// `image-en.*` / `image-fr.*`.
const IMAGES = import.meta.glob('./content/**/image*.{png,jpg,jpeg,svg,webp,avif}', {
  eager: true, query: '?url', import: 'default',
})

const body = (rec) => rec?.default ?? rec

/** './content/section1/card2/card.json' -> 'section1/card2' */
const slotOf = (path) => path.split('/').slice(2, 4).join('/')

/** The artwork for one slot, preferring a language-specific file over the shared one. */
function imageFor(slot, lang) {
  const prefix = `./content/${slot}/image`
  let shared = null
  for (const [path, url] of Object.entries(IMAGES)) {
    if (!path.startsWith(prefix)) continue
    if (path.startsWith(`${prefix}-${lang}.`)) return url   // exact language wins outright
    if (path.startsWith(`${prefix}.`)) shared = url
  }
  return shared
}

/*
 * Cards for one group, in slot order. Slots sort by folder name, so card10 would sort before
 * card2: pad the names if a section ever needs ten.
 */
function group(name, lang) {
  return Object.entries(CARDS)
    .filter(([path]) => path.startsWith(`./content/${name}/`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, rec]) => {
      const slot = slotOf(path)
      const d = body(rec)
      const t = d[lang] || d.en || {}
      return {
        slot,
        to: d.to,
        title: t.title || '',
        text: t.text || '',
        cta: t.cta || '',
        alt: t.alt || '',
        image: imageFor(slot, lang),
      }
    })
    // A folder with a card.json but no destination is a half-finished edit, not a card.
    .filter((c) => c.to && c.title)
}

export const heroSlides = (lang) => group('hero', lang)
export const sectionCards = (name, lang) => group(name, lang)

/*
 * All guides, keyed by their folder name, which is the id a card's `to` refers to, in the order
 * their `order` numbers give (the home page's tiles and the guides page). A guide with no
 * `order` comes last and is not on the home page.
 */
const rank = (d) => (typeof d.order === 'number' ? d.order : Infinity)
function guideIndex() {
  const entries = Object.entries(GUIDES).map(([path, rec]) => [path.split('/')[3], body(rec)])
  entries.sort(([a, da], [b, db]) => rank(da) - rank(db) || a.localeCompare(b))
  return Object.fromEntries(entries)
}

/*
 * One guide, resolved for a language. A pick whose solution was retired drops out silently here
 * and loudly in the build validator.
 */
export function guide(id, lang) {
  const d = guideIndex()[id]
  if (!d) return null
  const t = d[lang] || d.en || {}
  return {
    id,
    title: t.title || '',
    intro: t.intro || '',
    door: t.door || '',
    onHome: typeof d.order === 'number',
    placeholder: !!d._placeholder,
    picks: (d.picks || [])
      .map((p) => {
        const sol = solById[p.id]
        if (!sol) return null
        const w = p[lang] || p.en || {}
        return { sol, why: w.why || '' }
      })
      .filter(Boolean),
  }
}

/** Guide id for a public slug, so the router can resolve /fr/guide/simple-et-plaisant. */
export function guideIdForSlug(slug, lang) {
  for (const [id, d] of Object.entries(guideIndex())) {
    if ((d.slug?.[lang] || d.slug?.en) === slug) return id
  }
  return null
}

/** Public slug for a guide id, per language. */
export function guideSlug(id, lang) {
  const d = guideIndex()[id]
  return d ? d.slug?.[lang] || d.slug?.en || id : null
}

/** Every guide id, for the validator and for prerendering. */
export const guideIds = () => Object.keys(guideIndex())
