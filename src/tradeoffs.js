/*
 * The comparison's first two layers, derived once for the app and the prerenderer (D10 Q2,
 * TODO F15). Dependency-free: both callers pass their own strings and enum translator, so the
 * static page and the app cannot derive a level two ways.
 *
 * Levels, not ranks: each trade-off is 0 to 3 dots plus a word, relative to the other options
 * for the same need. Fewer dots is lighter for the reader.
 */

const COST = { none: 0, low: 1, medium: 2, high: 3 }
const SKILL = { none: 0, basic: 1, intermediate: 2, specialist: 3 }
const MAINT = { none: 0, occasional: 1, seasonal: 2, frequent: 3 }
const CONS = { none: 0, minor: 1, significant: 2 }
const DAILY = { none: 0, occasional: 1, daily: 2, 'way of living': 3 }
const key = (v) => String(v || '').trim().toLowerCase()

/*
 * Upkeep folds how often and what it consumes into one level (D10 Q2a): the sum of the two
 * scales (0-5) read as none (0), light (1-2), regular (3), heavy (4-5). A frequent task with
 * significant spares is heavy; a seasonal check with nothing to buy is light.
 */
export function upkeepLevel(sol) {
  const s = (MAINT[key(sol.maintenance)] ?? 0) + (CONS[key(sol.consumables)] ?? 0)
  return s === 0 ? 0 : s <= 2 ? 1 : s === 3 ? 2 : 3
}

const cap = (w) => (w ? String(w).charAt(0).toUpperCase() + String(w).slice(1) : w)

/* Layer 2: the five trade-offs, in the order decided (D10 Q2a). */
export function tradeoffs(sol, ui, tEnum) {
  const C = ui.comparison
  const up = upkeepLevel(sol)
  const dl = DAILY[key(sol.daily_life)] ?? 0
  return [
    { key: 'cost', label: C.tCost, dots: COST[key(sol.cost)] ?? null, word: cap(tEnum(sol.cost)) },
    { key: 'skill', label: C.tSkill, dots: SKILL[key(sol.build_skill)] ?? null, word: cap(tEnum(key(sol.build_skill))) },
    { key: 'upkeep', label: C.tUpkeep, dots: up, word: C.upkeepWords[up] },
    { key: 'daily', label: C.tDaily, dots: dl, word: C.dailyWords[dl] },
    { key: 'grid', label: C.tGrid, dots: null, yes: key(sol.power) === 'passive',
      word: key(sol.power) === 'passive' ? C.yes : C.no },
  ]
}

/*
 * The table's second tab, "Keeping it going" (Eric, 2026-11-03): upkeep as in the first layer,
 * then the two things behind it a reader asks next, who can fix it and what has to be bought.
 * Spares have three levels, so they reach two dots at most.
 */
export function keepLevels(sol, ui, tEnum) {
  const C = ui.comparison
  const up = upkeepLevel(sol)
  return [
    { key: 'upkeep', label: C.tUpkeep, dots: up, word: C.upkeepWords[up] },
    { key: 'repair', label: C.tRepair, dots: SKILL[key(sol.repair_skill)] ?? null, word: cap(tEnum(key(sol.repair_skill))) },
    { key: 'spares', label: C.tSpares, dots: CONS[key(sol.consumables)] ?? null, word: cap(tEnum(sol.consumables)) },
    // A length of time, not a burden: the band in words, no dots. The whole solution, not its wearing part.
    { key: 'life', label: C.tLife, dots: null, word: cap(tEnum(sol.lifespan_band)) },
  ]
}

/*
 * Layer 1: what can rule the option out. Text items carry the row's own sentence. "No
 * rebuilding needed" is the new-build flag, worded as the facet words it (Eric, 2026-09-24:
 * "works in a standing house" read as a different, non-discriminating claim).
 */
export function fitFacts(sol, ui, L) {
  const C = ui.comparison
  return [
    { key: 'flat', ok: !!sol.flat_feasible, word: !sol.flat_feasible ? C.flatNo : sol.flat_blocker ? C.flatIf : C.flatYes },
    { key: 'standing', ok: !sol.new_build_only, word: sol.new_build_only ? C.standingNo : C.standingYes },
    { key: 'site', text: L(sol, 'site_prerequisites') || '', word: C.siteNeeds },
    { key: 'rules', text: L(sol, 'regulation_fr') || '', word: C.rules },
  ]
}
