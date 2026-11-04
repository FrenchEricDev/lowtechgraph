// The figures the About page, the AI statement and llms.txt quote about the catalogue itself.
// Computed from the data, once, by the app and by the prerenderer alike, so a sentence like
// "124 of the 246 solutions produce something another one can use" is never stale and the two
// renderings can never disagree.
// The About page's steps and differentiators, in order: one list for the app (AboutView), the
// static page (aboutBody in scripts/prerender.mjs) and llms.txt, so the three cannot drift.
// Differentiators as Eric stated them, 2026-09-25, plus sourced-neutral-open.
export const ABOUT_STEPS = ['discover', 'compare', 'pick', 'plan', 'build']
export const ABOUT_DIFFS = ['diffCatalogue', 'diffCompare', 'diffIo', 'diffPlan', 'diffCheck',
  'diffDiscover', 'diffOpen']

export function siteCounts(cat) {
  const sols = cat.solutions || []
  const consumed = new Set()
  for (const s of sols) for (const i of s.inputs || []) consumed.add(i.io)
  // A solution "feeds another" when one of its outputs is some solution's input.
  const loops = sols.filter((s) => (s.outputs || []).some((o) => consumed.has(o.io))).length
  const withTut = sols.filter((s) => (s.tutorials || []).length)
  return {
    solutions: sols.length,
    functions: (cat.functions || []).length,
    subs: (cat.subfunctions || []).length,
    ios: (cat.io_types || []).length,
    edges: (cat.counts && cat.counts.io_index) || 0,
    sourced: sols.filter((s) => (s.sources || []).length).length,
    loops,
    tutorials: withTut.reduce((n, s) => n + s.tutorials.length, 0),
    tutorialSols: withTut.length,
    // "Passive" is the catalogue's own definition: works without the grid or a pump.
    passive: sols.filter((s) => /^passive$/i.test(String(s.power || ''))).length,
    flat: sols.filter((s) => s.flat_feasible === 'Y' || s.flat_feasible === true).length,
  }
}
