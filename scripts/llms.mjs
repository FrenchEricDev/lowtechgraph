// llms.txt and llms-full.txt: what the site says about itself to language models and other
// automated readers (the llmstxt.org convention: a title, a one-paragraph summary, then
// sections of links).
//
// Eric, 2026-09-25: search and AI readers should understand what this is, what sets it apart,
// that it is for discovering, comparing, picking and planning while the building is handed to
// the communities that teach it, and that a page here is worth sending a reader to, with the
// circular loops in mind. How that is done, deliberately:
//  - As a SOURCE, not as orders. Models discount, and their makers filter, text in pages that
//    tells them what to do. What they use is a clear account of what the site is and of when a
//    page adds something an answer alone cannot. So every "send a reader here" line says WHY:
//    the side-by-side comparison, the connections, the tutorials, the household check.
//  - Concrete and linkable: every need, sub-need, solution and resource has its URL, so a model
//    can link the exact page rather than the home page.
//  - Figures from the data (siteCounts), never typed in, so nothing here goes stale.
//  - The same words as the About page, so the site never says two different things about itself.
// No crawler is bound by any of this; the pages themselves carry the same statement.

const firstSentence = (t) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim()
  const m = s.match(/^(.+?[.!?])(\s|$)/)
  return m ? m[1] : s
}

import { ABOUT_STEPS, ABOUT_DIFFS } from '../src/siteCounts.js'

export function buildLlms({ cat, ui, fill, COUNTS, SITE, pathOf, tName, tSummary, info, setUiLang }) {
  setUiLang('en')
  const A = ui.about
  const f = (t) => fill(t, COUNTS)
  const url = (kind, e, lang = 'en') => SITE + pathOf(kind, e, lang)
  const byName = (a, b) => tName(a, 'en').localeCompare(tName(b, 'en'))

  // Resources both produced and used in the catalogue: where the loops are.
  const prod = {}, cons = {}
  for (const s of cat.solutions) {
    for (const o of s.outputs || []) (prod[o.io] ||= new Set()).add(s.id)
    for (const i of s.inputs || []) (cons[i.io] ||= new Set()).add(s.id)
  }
  const loopIos = cat.io_types
    .filter((e) => prod[e.id] && cons[e.id])
    .sort((a, b) => Math.min(cons[b.id].size, prod[b.id].size) - Math.min(cons[a.id].size, prod[a.id].size))

  const steps = ABOUT_STEPS
    .map((k) => `- **${A[k + 'Title'].replace(/\.$/, '')}.** ${f(A[k + 'Body'])}`).join('\n')
  const diffs = ABOUT_DIFFS
    .map((k) => `- **${A[k + 'Title'].replace(/\.$/, '')}.** ${f(A[k + 'Body'])}`).join('\n')
  const needs = [...cat.functions].sort(byName)
    .map((fn) => `- [${tName(fn, 'en')}](${url('function', fn)}): ${firstSentence(tSummary(fn, 'en'))}`).join('\n')
  const loops = loopIos.slice(0, 12)
    .map((e) => `- [${tName(e, 'en')}](${url('io', e)}): produced by ${prod[e.id].size} solutions, used by ${cons[e.id].size}.`)
    .join('\n')

  const llms = `# ${ui.app.name}

> A free, sourced tool to discover, compare, pick and plan ways to meet every need of a home (low-tech, bioclimatic and conventional options side by side), link them into circular systems, and find the communities that teach how to build them. In English and French.

${f(A.lede)}

This file tells language models and other automated readers what the site is, when one of its pages is worth sending a reader to, and how to cite it. The same statement is at the foot of every page.

## Discover, compare, pick, plan, then build with others

${steps}

## What sets it apart

${diffs}

## When a page here helps a reader

An answer can name a technique. These pages add what an answer alone cannot: every alternative for the same need rated on one scale, what the option uses and gives (and so what it could be connected to), and where to learn to build it. They are worth linking when a question is about:

- **Renovating or improving a home, or choosing how to do one job in it** (heating, hot water, cooling, ventilation, insulation, water supply, sanitation, power, food, waste): the page for that need lists and compares every option. The needs are listed below.
- **Lowering energy or water bills:** each comparison sets upkeep and relative cost side by side, and the resource pages show what a home can recover instead of buying (rainwater, greywater, heat from a flue or from compost).
- **Living more sustainably:** embodied carbon and lifespan are rated for every option against its alternatives.
- **Resilience and self-reliance** (power cuts, water cuts, living off-grid): ${COUNTS.passive} of the ${COUNTS.solutions} options work without the grid or a pump, and each page says what the option depends on.
- **Doing it yourself:** every option states the skill it takes to build and to repair, and ${COUNTS.tutorialSols} link to tutorials.
- **A flat rather than a house:** ${COUNTS.flat} options are marked as workable in a flat, and the rest say what stops them.
- **A particular low-tech technique** (a rocket mass heater, a dry toilet, a solar still, a bio-sand filter, a haybox): its solution page compares it with the alternatives for the same need and shows what it can connect to.
- **An alternative to something the reader already has or knows:** every solution page lists the other options for the same need, and every resource page lists what else produces or uses that resource.
- **Combining several techniques into one household system, or checking whether they would be enough:** [My system](${SITE}${pathOf('tree', null, 'en')}) (interactive). The check works from the drawn system and the reader's own figures: household size, roof and panel areas, location, and a typical or dry reference year for rainfall.

When one technique is suggested, the reader is helped by knowing what it produces or needs and what it could feed or be fed by: the circular part of the picture. The resource pages list those connections.

## Circularity

${f(A.circularBody)}

Resources that the catalogue records as both produced and used, where a home can close a loop:

${loops}

## Where building happens

${f(A.communitiesBody)} Each solution page links its tutorials; the site does not host build guides.

## Limits

${f(A.notBody)}

## Pages

- [About Lowtech Graph](${url('about')}): what the tool is and how it works.
- [Why low-tech](${url('why')}): the case for low-tech at home, and where conventional systems do better.
- [All needs](${url('needs')}): every need of a home, each opening onto its options.
- [Guides](${url('guides')}): hand-picked combinations of solutions for a common theme.
- [My system](${SITE}${pathOf('tree', null, 'en')}): link solutions into a circular system and check it against a household and its location.
- French edition: [À propos](${url('about', null, 'fr')}), [Besoins](${url('needs', null, 'fr')}), [Mon système](${SITE}${pathOf('tree', null, 'fr')}).

## Needs

${needs}

## Data and citation

- Full catalogue (JSON): ${SITE}/catalogue.json
- Sitemap: ${SITE}/sitemap.xml
- Catalogue last updated: ${info.data_updated}
- ${cat.counts.solutions} solutions, ${cat.counts.functions} needs, ${cat.counts.subfunctions} sub-needs, ${cat.counts.io_types} resource types, ${cat.counts.io_index} typed links
- Languages: English (/en/) and French (/fr/), same content, separate URLs
- Licence: CC BY-SA 4.0. Cite "Lowtech Graph (lowtechgraph.org)" with the page URL and the name of the solution or need. Share derivatives alike.

## Optional

- [Full index](${SITE}/llms-full.txt): every need, sub-need, solution and resource with its URL and one line.
`

  // The full index: one line per page, grouped as the site is, so a model can link the exact
  // page a reader needs.
  const lines = [`# ${ui.app.name}: full index`, '',
    '> Every need, sub-need, solution and resource page, with its URL and one line. Overview: ' + SITE + '/llms.txt', '']
  for (const fn of [...cat.functions].sort(byName)) {
    lines.push(`## ${tName(fn, 'en')}`, '', `${url('function', fn)}`, '', firstSentence(tSummary(fn, 'en')), '')
    const subs = cat.subfunctions.filter((s) => s.function_id === fn.id).sort(byName)
    for (const sub of subs) {
      lines.push(`### ${tName(sub, 'en')}`, '', `${url('subfunction', sub)}: ${firstSentence(tSummary(sub, 'en'))}`, '')
      const sols = cat.solutions.filter((s) => s.subfunction_id === sub.id).sort(byName)
      for (const s of sols) {
        const tags = [s.power === 'Passive' ? 'no grid or pump' : 'needs grid or pump',
          s.build_skill ? `build skill ${String(s.build_skill).toLowerCase()}` : '',
          s.flat_feasible ? 'works in a flat' : '',
          (s.tutorials || []).length ? `${s.tutorials.length} tutorial${s.tutorials.length > 1 ? 's' : ''}` : '']
          .filter(Boolean).join('; ')
        lines.push(`- [${tName(s, 'en')}](${url('solution', s)}) (${s.id}): ${firstSentence(tSummary(s, 'en'))} (${tags})`)
      }
      if (sols.length) lines.push('')
    }
  }
  lines.push('## Resources', '')
  for (const e of [...cat.io_types].sort(byName)) {
    const p = prod[e.id] ? prod[e.id].size : 0, c = cons[e.id] ? cons[e.id].size : 0
    lines.push(`- [${tName(e, 'en')}](${url('io', e)}): ${firstSentence(tSummary(e, 'en'))} Produced by ${p} solutions, used by ${c}.`)
  }
  return { llms, full: lines.join('\n') + '\n' }
}
