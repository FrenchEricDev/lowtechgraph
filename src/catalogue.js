// Data layer: loads the bundled catalogue (generated from Housing-Systems.xlsx by
// scripts/build_app_data.py) and builds lookup indexes. Read-only.
// The pages' part of the catalogue; the system check's figures load with the builder
// (vite.config.js, catalogueViews).
import { upkeepLevel } from './tradeoffs.js'
import raw from 'virtual:catalogue-core'

export const catalogue = raw

const index = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]))
export const fnById = index(raw.functions)
export const subById = index(raw.subfunctions)
export const ioById = index(raw.io_types)
export const solById = index(raw.solutions)

// Group helpers.
const groupBy = (arr, key) => {
  const out = {}
  for (const x of arr) (out[x[key]] ||= []).push(x)
  return out
}
export const subsByFunction = groupBy(raw.subfunctions, 'function_id')
export const solsBySubfunction = groupBy(raw.solutions, 'subfunction_id')
export const solsByFunction = groupBy(raw.solutions, 'function_id')

// IO producers and consumers, from the flat io_index.
export const producersByIo = {}
export const consumersByIo = {}
// A resource a card may take only with a warning is never offered: not on a resource page, not as a
// suggestion (raw water on a shower, C10). It stays linkable by a reader who has placed both.
const WARNED_INPUT = new Set(raw.solutions.flatMap((s) => Object.keys(s.input_warn || {}).map((io) => s.id + '|' + io)))
export const offeredInputs = (s) => (s.inputs || []).filter((i) => !WARNED_INPUT.has(s.id + '|' + i.io))
for (const e of raw.io_index) {
  if (e.role !== 'produces' && WARNED_INPUT.has(e.sol + '|' + e.io)) continue
  const bucket = e.role === 'produces' ? producersByIo : consumersByIo
  ;(bucket[e.io] ||= []).push(e.sol)
}

/*
 * Does an entity's name match a search term, in either language? The one matcher for the site
 * search and the builder's picker. `needle` arrives trimmed and lower-cased.
 */
export const matchesName = (x, needle) => {
  // Accent-insensitive on both sides, so "poele" finds "Poêle" and a typed accent still
  // matches. By whole word since brief 07 (2026-10-20): each word typed must start a word of the
  // name, so "rent" no longer finds names with those letters inside another word; a plural
  // typed finds the singular. Helpers are defined inside because qa-build.mjs extracts this
  // function and evals it on its own.
  const flat = (v) => (v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const words = (v) => flat(v).split(/[^a-z0-9]+/).filter(Boolean)
  const terms = words(needle).map((w) => (w.length > 3 ? w.replace(/(es|s|x)$/, '') : w))
  if (!terms.length) return false
  const hit = (v) => {
    const ws = words(v)
    return terms.every((t) => ws.some((w) => w.startsWith(t)))
  }
  // i18n-ok: the search index deliberately matches BOTH languages, the long name and the short label
  return hit(x && x.name) || hit(x && x.fr && x.fr.name) || hit(x && x.short) || hit(x && x.fr && x.fr.short)
}


// `retrofitOnly` drops what cannot go into a house already standing: feasibility only, not cost
// or permission.
//
// The catalogue filters: one object, applied in one place, so a new facet is one entry here and
// one control in the bar. Each boolean is "only X" against everything, because one side is a
// strict subset of the other. The two ordinals are ceilings ("nothing harder than Basic"), not
// selections.
export const DEFAULT_FILTERS = {
  flatOnly: false,      // works in a flat
  retrofitOnly: false,  // excludes new-build-only
  passiveOnly: false,   // no power or delivery dependency
  tutorialOnly: false,  // has at least one build tutorial
  lowTechOnly: false,   // excludes benchmark options
  maxSkill: null,       // null = any; else a value from SKILL_ORDER
  maxCost: null,        // null = any; else a value from COST_ORDER
  // Eric, 2026-09-25: "Change to Daily Life" (A13) as a facet too, a ceiling like the other two:
  // "nothing that changes my days more than occasionally".
  maxDaily: null,       // null = any; else a value from DAILY_ORDER
  // Eric, 2026-11-01: the level the comparison shows, how often and what it consumes in one.
  maxUpkeep: null,      // null = any; else a value from UPKEEP_ORDER
}

// 'None' stays in the order although it is not offered as a ceiling: the data still has None
// rows, and they must pass every ceiling for the right reason.
export const SKILL_ORDER = ['None', 'Basic', 'Intermediate', 'Specialist']
export const COST_ORDER = ['low', 'medium', 'high']
export const DAILY_ORDER = ['none', 'occasional', 'daily', 'way of living']
export const UPKEEP_ORDER = ['none', 'light', 'regular', 'heavy']

// A value the order does not know is never filtered out, or a row with a missing level would
// vanish from every list.
const withinCeiling = (order, ceiling, value) => {
  if (!ceiling) return true
  const max = order.indexOf(ceiling)
  const v = order.indexOf(value)
  return v === -1 || max === -1 || v <= max
}

export const visibleSolutions = (sols, f = DEFAULT_FILTERS) => {
  let out = sols
  if (f.lowTechOnly) out = out.filter((x) => !x.benchmark)
  if (f.retrofitOnly) out = out.filter((x) => !x.new_build_only)
  if (f.flatOnly) out = out.filter((x) => x.flat_feasible)
  if (f.passiveOnly) out = out.filter((x) => x.power === 'Passive')
  if (f.tutorialOnly) out = out.filter((x) => (x.tutorials || []).length > 0)
  if (f.maxSkill) out = out.filter((x) => withinCeiling(SKILL_ORDER, f.maxSkill, x.build_skill))
  if (f.maxCost) out = out.filter((x) => withinCeiling(COST_ORDER, f.maxCost, x.cost))
  if (f.maxDaily) out = out.filter((x) => withinCeiling(DAILY_ORDER, f.maxDaily, x.daily_life))
  if (f.maxUpkeep) out = out.filter((x) => withinCeiling(UPKEEP_ORDER, f.maxUpkeep, UPKEEP_ORDER[upkeepLevel(x)]))
  return out
}

/* Is anything being hidden? Derived from the filters themselves. */
export const anyFilterActive = (f) =>
  Object.keys(DEFAULT_FILTERS).some((k) => f[k] !== DEFAULT_FILTERS[k])

/** The active filters one solution fails, for "Outside your filters: …" in words. */
export const failedFilters = (sol, f) =>
  Object.keys(DEFAULT_FILTERS).filter((k) => f[k] !== DEFAULT_FILTERS[k]
    && visibleSolutions([sol], { ...DEFAULT_FILTERS, [k]: f[k] }).length === 0)

/** The same filters with one facet relaxed, for "N of these are hidden" counts. */
export const without = (f, key) => ({ ...f, [key]: DEFAULT_FILTERS[key] })

// Natural resources a solution draws on directly, placeable as nodes. Curated in the IO-Types
// sheet; the optional label overrides the node title, while the IO name still drives link
// matching.
export const naturalResources = raw.natural_resources || []
export const NATURAL_RESOURCE_IDS = naturalResources.map((r) => r.io)
export const isNaturalResource = (ioId) => NATURAL_RESOURCE_IDS.includes(ioId)

// Connections to the world outside the house (Solutions: Societal Connection), grouped for
// their own picker. Ordinary solutions otherwise. Supplies first, then stock, then sinks.
const SOCIETAL_ORDER = { supply: 0, stock: 1, sink: 2 }
export const societalConnections = (raw.solutions || [])
  .filter((s) => s.societal in SOCIETAL_ORDER)
  .sort((a, b) => SOCIETAL_ORDER[a.societal] - SOCIETAL_ORDER[b.societal])

// Descriptor {io, name, label} for a resource IO type, wherever a resource node is built or
// rebuilt.
export const resourceDescriptor = (ioId) =>
  naturalResources.find((r) => r.io === ioId) ||
  (ioById[ioId] ? { io: ioId, name: ioById[ioId].name, label: ioById[ioId].name } : null)  // i18n-ok: builds the raw descriptor; callers translate it

// Language. Content carries an optional `fr` block per entity; anything untranslated falls back
// to English. The long French fields arrive in their own chunk (B2, vite.config.js
// catalogueViews): mergeFrench folds them into the same entity objects, so every index above
// sees them without being rebuilt.
export function mergeFrench(byCollection) {
  for (const [k, byId] of Object.entries(byCollection || {})) {
    for (const e of raw[k] || []) {
      const extra = byId[e.id ?? e.io]
      if (!extra) continue
      for (const [f, v] of Object.entries(extra)) {
        if (f === 'fr') e.fr = { ...(e.fr || {}), ...v }
        else e[f] = v
      }
    }
  }
}

// Current reading language, set once per render by App, so small components need no `lang`
// prop.
let CURRENT_LANG = 'en'
export function setCatalogueLang(l) { CURRENT_LANG = l }
export const getLang = () => CURRENT_LANG

/** Translated text for a field, falling back to the English column. */
export function L(entity, field, lang = CURRENT_LANG) {
  if (!entity) return ''
  if (lang === 'fr' && entity.fr && entity.fr[field]) return entity.fr[field]
  // The English value lives under a different key for this field.
  const enKey = field === 'description' ? 'summary' : field
  return entity[enKey] ?? ''
}

// A need's or sub-need's everyday label where it has one (C2); tLong is its full name: the
// subtitle, the page title, and any sentence that inserts the name.
export const tName = (entity, lang = CURRENT_LANG) => L(entity, 'short', lang) || L(entity, 'name', lang) || entity?.name || ''
export const tLong = (entity, lang = CURRENT_LANG) => L(entity, 'name', lang) || entity?.name || ''  // i18n-ok: the translated name, then the English fallback
// Alphabetical by the word that matters: "A safe structure" under S, "La lumière" under L of lumière.
const sortWord = (entity, lang) => {
  const n = tName(entity, lang)
  return entity?.short ? n.replace(/^(?:(?:a|an|the|le|la|les|un|une|des|du|de)\s+|l’|d’)+/i, '') : n
}
export const tSummary = (entity, lang = CURRENT_LANG) => L(entity, 'description', lang)

// Alphabetical in the reading language.
export const sortByName = (list, lang = CURRENT_LANG) =>
  [...list].sort((a, b) => sortWord(a, lang).localeCompare(sortWord(b, lang), lang, { sensitivity: 'base' }))

// The sub-functions of a need, alphabetical in the reading language (Eric, 2026-09-16), so the
// order differs between English and French.
export const subsOf = (fnId, lang = CURRENT_LANG) =>
  [...(subsByFunction[fnId] || [])].sort((a, b) =>
    sortWord(a, lang).localeCompare(sortWord(b, lang), lang, { sensitivity: 'base' }))

/*
 * Display title for a resource, resolved at render from the IO id, so a tree built in one
 * language reads in another.
 */
// The mirror of terminalsFor: what the home node may emit. Curated in the workbook, like
// natural resources.
export const householdSources = raw.household_sources || []
export const HOUSEHOLD_SOURCE_IDS = householdSources.map((r) => r.io)
export const isHouseholdSource = (ioId) => HOUSEHOLD_SOURCE_IDS.includes(ioId)

// Everything that may end at a kind of destination: the inverse of terminalsFor, listed on the
// destination card.
export const acceptedAt = (kind) =>
  catalogue.io_types.filter((t) => t.terminal === kind || t.terminal === 'both')

/*
 * Which destinations an IO may end at: ['home'], ['environment'], both, or none. None means an
 * intermediate something else must consume (biogas is burned), so a graph cannot end on it: it
 * is not finished.
 */
export function terminalsFor(ioId) {
  const t = ioById[ioId]?.terminal
  if (!t) return []
  return t === 'both' ? ['home', 'environment'] : [t]
}

/*
 * The six groups of the resources index (brief 09), from the workbook's IO category. The rare
 * categories fold into two groups; a resource with none is water (fog moisture, the one case).
 */
const GROUP_OF = {
  Energy: 'energy', Water: 'water', Material: 'material', Air: 'air',
  Durability: 'building', Safety: 'building', Structure: 'building', Acoustic: 'building',
  Light: 'signal', Information: 'signal',
}
export const RESOURCE_GROUPS = ['energy', 'water', 'air', 'material', 'building', 'signal']
export const resourceGroup = (io) => GROUP_OF[io?.category] || 'water'

// Every solution that makes, passes on or uses a resource, once each.
export const solutionsTouching = (ioId) =>
  [...new Set([...(producersByIo[ioId] || []), ...(consumersByIo[ioId] || [])])].map((id) => solById[id]).filter(Boolean)

export function resourceLabel(ioId, lang = CURRENT_LANG) {
  const rd = naturalResources.find((r) => r.io === ioId)
  if (rd) return (lang === 'fr' && rd.label_fr) || rd.label || ioId
  return tName(ioById[ioId], lang) || ioId
}

/** Prefer a tutorial in the reading language; otherwise take whatever exists. */
export const primaryTutorial = (tutorials = [], lang = CURRENT_LANG) =>
  tutorials.find((t) => t.lang === lang) || tutorials.find((t) => !t.lang) || tutorials[0] || null

export { displayUrl, tutorialLabel } from './display-url.js'

// One line on what a tutorial covers (C3), ours, so in the reader's language.
export function tutorialLine(sol, t, lang = CURRENT_LANG) {
  return (lang === 'fr' && sol.tutorial_lines_fr && sol.tutorial_lines_fr[t.url]) || t.line || ''
}

/**
 * Tutorials ordered so the reading language comes first. One wiki page in both languages (its
 * address ending /fr and /en) is one row, in the reading language, with the other as `twin`.
 */
export const tutorialsForLang = (tutorials = [], lang = CURRENT_LANG) => {
  const rows = new Map()
  for (const t of [...tutorials].sort((a, b) => (b.lang === lang) - (a.lang === lang))) {
    const page = t.url.replace(/\/(fr|en)\/?$/, '')
    const first = rows.get(page)
    if (first && first.lang !== t.lang) first.twin = t
    else rows.set(first ? t.url : page, { ...t })
  }
  return [...rows.values()]
}

// Closed-vocabulary values are translated once here rather than as rows in the Translations
// sheet. Keys match case-insensitively.
const ENUM_FR = {
  low: 'faible', medium: 'moyen', high: 'élevé', 'low-medium': 'faible à moyen',
  none: 'aucun', occasional: 'occasionnel', seasonal: 'saisonnier', frequent: 'fréquent',
  basic: 'basique', intermediate: 'intermédiaire', specialist: 'spécialiste',
  minor: 'mineures', significant: 'importantes',   // agrees with "pièces" (fem.), the only noun these qualify
  'continuous process': 'processus continu',
  'on-demand/controllable': 'à la demande / pilotable',
  'weather/time-dependent': 'dépendant de la météo / du moment',
  // Lifespan Band (2026-11-03)
  'under 5 years': 'moins de 5 ans', '5 to 15 years': '5 à 15 ans', '15 to 30 years': '15 à 30 ans',
  '30 years or more': '30 ans ou plus', 'as long as the building': 'aussi longtemps que le bâtiment',
  'not applicable': 'sans objet',
}

/* Translates a closed-vocabulary value; English and unknown values pass through unchanged. */
export function tEnum(value, lang = CURRENT_LANG) {
  if (!value) return value
  if (lang !== 'fr') return value
  const hit = ENUM_FR[String(value).trim().toLowerCase()]
  return hit || value
}

// Chaining suggestions for the builder: dir 'out' gives solutions that consume `io`, dir 'in'
// those that produce it. Tier 1 is the same function, a different sub-function; tier 2 a
// different function; the same sub-function is excluded. Sorted by tier, then build rank.
// Unfiltered: the caller applies visibleSolutions.
export function suggestChain({ io, dir, sourceSolId, excludeIds = [], placedIds = [] }) {
  const src = solById[sourceSolId]
  // A warned input is offered only to link a card the reader has already placed.
  const warned = dir === 'out' ? placedIds.filter((id) => WARNED_INPUT.has(id + '|' + io)) : []
  const pool = [...((dir === 'out' ? consumersByIo[io] : producersByIo[io]) || []), ...warned]
  const exclude = new Set([sourceSolId, ...excludeIds])
  const rank = (s) => s.ratings?.build ?? 9
  // A card that takes and gives the same resource (a pot skirt on cooking heat, a battery on
  // power) sits beside its suppliers in the same sub-need: there they are the answer, not rivals
  // (a user's session, 2026-11-03: the skirt's cooking heat offered nothing).
  const passThrough = !!src && src.inputs.some((i) => i.io === io) && src.outputs.some((o) => o.io === io)
  const tier = (s) => {
    if (src && s.function_id === src.function_id)
      return s.subfunction_id === src.subfunction_id ? (passThrough ? 1 : 0) : 1 // 0 = same sub-fn (drop)
    return 2
  }
  const seen = new Set()
  return pool
    .map((id) => solById[id])
    .filter((s) => s && !exclude.has(s.id))
    .filter((s) => (seen.has(s.id) ? false : seen.add(s.id)))
    .map((s) => ({ sol: s, tier: tier(s) }))
    .filter((x) => x.tier !== 0)
    .sort((a, b) => a.tier - b.tier || rank(a.sol) - rank(b.sol))
}
