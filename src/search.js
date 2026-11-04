/*
 * The site search (brief 07, confirmed by Eric 2026-10-20). No taxonomy, no interpretation: a
 * query looks in four places, in this order, and a result says which place matched.
 *   1. the name, by whole word (a word of the query starts a word of the name: "rent" no longer
 *      finds "Exposed thermal mass" through "parent"-like letters inside other words);
 *   2. text the site already has: the description, the tutorials' titles (both languages, so
 *      "frigo" finds the zeer pot through "Frigo du désert"), the need and sub-need, a guide's
 *      intro;
 *   3. a short hand-made sheet of everyday words (content/search-words.json);
 *   4. light word endings (plurals) and accents, in every place.
 * Both languages are searched whatever the reading language, as the name matcher always did.
 */
import * as cat from './catalogue'
import { guide, guideIds } from './content'
import { ui } from './ui-strings'
import WORDS from './content/search-words.json'
import people from './content/people.json'

const flat = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const words = (v) => flat(v).split(/[^a-z0-9]+/).filter(Boolean)
const stem = (w) => (w.length > 3 ? w.replace(/(es|s|x)$/, '') : w)
// Words that say nothing on their own, in both languages.
const STOP = new Set(['a', 'an', 'the', 'of', 'for', 'my', 'in', 'to', 'and', 'or', 'with', 'how',
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'pour', 'mon', 'ma', 'mes', 'en', 'et', 'd', 'l', 'au', 'aux', 'avec'])

export const queryTerms = (q) => {
  const all = words(q)
  const kept = all.filter((w) => !STOP.has(w))
  return (kept.length ? kept : all).map(stem)
}

// Every term of the query starts some word of the text: for names and titles, read as typed.
const hits = (terms, ...texts) => terms.length > 0 && texts.some((t) => {
  const ws = words(t)
  return ws.length > 0 && terms.every((term) => ws.some((w) => w.startsWith(term)))
})

// Words too common to mean anything inside a sentence, in both languages.
const COMMON = new Set(['about', 'also', 'more', 'less', 'most', 'other', 'than', 'then', 'from', 'into',
  'your', 'their', 'they', 'this', 'that', 'these', 'which', 'when', 'where', 'what', 'without', 'only',
  'some', 'each', 'very', 'much', 'many', 'used', 'uses', 'make', 'made', 'over', 'under', 'house', 'home',
  'plus', 'moins', 'avec', 'sans', 'dans', 'leur', 'leurs', 'cette', 'ces', 'elle', 'elles', 'tout', 'tous',
  'maison', 'logement', 'comme', 'mais', 'sont', 'fait', 'faire', 'peut', 'aussi'])

/*
 * Inside a sentence (a description, a sub-need's name under a solution): a whole word, plurals
 * aside, and several words only side by side, so "power cut" does not find a pump whose text
 * says "power" in one place and "cuts" in another.
 */
const inText = (terms, ...texts) => {
  const ts = terms.filter((t) => t.length > 2 && !COMMON.has(t))
  if (!ts.length) return false
  return texts.some((t) => {
    const ws = words(t).map(stem)
    for (let i = 0; i + ts.length <= ws.length; i++) {
      if (ts.every((term, k) => ws[i + k] === term)) return true
    }
    return false
  })
}

const fr = (x, k) => x && x.fr && x.fr[k]

// The everyday words that match, and what they point at: target -> the word that matched.
function sheetHits(terms) {
  const out = new Map()
  for (const e of WORDS.entries || []) {
    const w = (e.words || []).find((x) => hits(terms, x))
    if (w) for (const t of e.targets || []) if (!out.has(t)) out.set(t, w)
  }
  return out
}

/*
 * What matched, for the "why" line. `place` is name, description, tutorial, need, word or picks;
 * `detail` the matching tutorial title, word or names.
 */
function whyFor(x, kind, terms, sheet) {
  if (cat.matchesName(x, terms.join(' '))) return { place: 'name' }
  if (kind === 'solution') {
    const t = (x.tutorials || []).find((tu) => tu.title && hits(terms, tu.title))
    if (sheet.has(x.id)) return { place: 'word', detail: sheet.get(x.id) }
    if (t) return { place: 'tutorial', detail: t.title, site: t.site }
    if (inText(terms, x.summary, fr(x, 'description'))) return { place: 'description' }
    const sub = cat.subById[x.subfunction_id]
    const fn = cat.fnById[x.function_id]
    if (sub && inText(terms, sub.name, sub.short, fr(sub, 'name'), fr(sub, 'short'))) return { place: 'need', detail: cat.tName(sub) }
    if (fn && inText(terms, fn.name, fn.short, fr(fn, 'name'), fr(fn, 'short'))) return { place: 'need', detail: cat.tName(fn) }
    return null
  }
  if (sheet.has(x.id)) return { place: 'word', detail: sheet.get(x.id) }
  if (inText(terms, x.summary, fr(x, 'description'))) return { place: 'description' }
  return null
}

// The ranking: the name; a hand-made everyday word (meant, so above a passing mention); a
// tutorial's title; the description; the need it sits under; a guide's picks.
const RANK = { name: 0, word: 1, tutorial: 2, description: 3, need: 4, picks: 5 }

// Static pages a search can land on, with the text they are found by.
const PAGES = () => [
  { id: 'page:needs', route: { view: 'needs' }, title: ui.needs.heading, text: [ui.needs.intro] },
  { id: 'page:resources', route: { view: 'resources' }, title: ui.resourcePage.indexTitle, text: [ui.resourcePage.indexIntro] },
  { id: 'page:guides', route: { view: 'guides' }, title: ui.guides.title, text: [ui.guides.intro] },
  { id: 'page:why', route: { view: 'why' }, title: ui.why.heading, text: [] },
  { id: 'page:about', route: { view: 'about' }, title: ui.about.heading, text: [] },
  // Found by the names and lines of everyone on it: searching for a maker or a forum lands here.
  { id: 'page:people', route: { view: 'people' }, title: ui.people.heading,
    text: [ui.people.lede, ...people.entries.map((e) => `${e.title} ${e.line[cat.getLang()] || e.line.en}`)] },
]

/*
 * Results by group, in the order the results page shows them, each list ranked by place; `why`
 * maps an id to what matched. Guides match by title or intro, or through their picks.
 */
export function search(q) {
  const empty = { solutions: [], functions: [], subfunctions: [], io_types: [], guides: [], pages: [], why: new Map(), terms: [] }
  const terms = queryTerms(q)
  if (!terms.length) return empty
  const sheet = sheetHits(terms)
  const why = new Map()
  const run = (list, kind) => list
    .map((x) => [x, whyFor(x, kind, terms, sheet)])
    .filter(([, w]) => w)
    .sort((a, b) => RANK[a[1].place] - RANK[b[1].place])
    .map(([x, w]) => { why.set(x.id, w); return x })

  const solutions = run(cat.catalogue.solutions, 'solution')
  const nameHit = new Set(solutions.filter((x) => why.get(x.id).place === 'name').map((x) => x.id))
  const lang = cat.getLang()
  const guides = guideIds().map((id) => guide(id, lang)).filter(Boolean).map((g) => {
    if (hits(terms, g.title)) return [g, { place: 'name' }]
    if (inText(terms, g.intro)) return [g, { place: 'description' }]
    if (sheet.has('guide:' + g.id)) return [g, { place: 'word', detail: sheet.get('guide:' + g.id) }]
    const through = g.picks.filter((p) => nameHit.has(p.sol.id))
    if (through.length) return [g, { place: 'picks', detail: through.map((p) => cat.tName(p.sol)).join(', ') }]
    return null
  }).filter(Boolean).sort((a, b) => RANK[a[1].place] - RANK[b[1].place])
    .map(([g, w]) => { why.set('guide:' + g.id, w); return g })
  const pages = PAGES().map((p) => {
    if (hits(terms, p.title) || inText(terms, ...p.text)) return [p, { place: 'name' }]
    if (sheet.has(p.id)) return [p, { place: 'word', detail: sheet.get(p.id) }]
    return null
  }).filter(Boolean).map(([p, w]) => { why.set(p.id, w); return p })

  return {
    solutions,
    functions: run(cat.catalogue.functions, 'function'),
    subfunctions: run(cat.catalogue.subfunctions, 'subfunction'),
    io_types: run(cat.catalogue.io_types, 'io'),
    guides,
    pages,
    why,
    terms,
  }
}
