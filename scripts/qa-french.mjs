/**
 * Does the French actually read as French?
 *
 * WHY THIS EXISTS. The French strings were swept for missing accents twice on
 * 2026-09-05, and both sweeps used a hand-built list of unaccented words gathered from
 * the strings already looked at. Both reported themselves complete. The second one
 * reported "0 of 650" while eighteen strings in the diagnostics module still read
 * "Une etape de conversion n'est alimentee par rien".
 *
 * A tell-list finds its tells. It cannot find a string whose missing accents fall on
 * words nobody thought to list, and it gets more convincing with each pass while
 * covering no more of the problem.
 *
 * THE PROPERTY, checked instead: a French sentence of any length almost always contains
 * an accented character. Not always -- "Rechercher une solution, un besoin, une
 * ressource" is perfectly correct and carries none -- so the handful of genuine
 * exceptions are named in ACCENTLESS_BUT_CORRECT below. That list is the maintenance
 * cost, and it is the right cost: adding a string to it is a deliberate act, whereas
 * extending a tell-list is a guess.
 *
 * Run:  node scripts/qa-french.mjs
 */
import frStrings from '../src/ui-strings.fr.js'

let failures = 0
const fail = (what, detail) => {
  failures += 1
  console.log(`  FAIL  ${what}`)
  if (detail) console.log(`          ${detail}`)
}
const pass = (what) => console.log(`  PASS  ${what}`)

// Latin-1 supplement letters plus the French ligatures.
const ACCENTED = /[À-ÿŒœ]/
// Long enough that an accent-free sentence is genuinely unusual.
const LONG = 45

// Sentences that are correct French and happen to carry no accented character. Each one
// was read before being added. If a string here later gains an accent, nothing breaks --
// the check only looks at strings that have none.
const ACCENTLESS_BUT_CORRECT = new Set([
  'home.carouselShort',
  'home.whyHeading',
  // 'adequacy.noSolver', 'adequacy.reasons.missing-scenario': correct French. Read 2026-10-30.
  'adequacy.unitNames.kWh per kg seasoned / kWh per kg green',
  'adequacy.noSolver',
  'adequacy.reasons.missing-scenario',
  // 'Une fois ouvert, le site fonctionne sans connexion : on peut le garder ouvert sur un chantier.': correct French. Read 2026-10-21.
  'about.offlineLine',
  // 'associations, ateliers, groupes locaux, chantiers' and 'Forums, groupes et auteurs qui construisent ce genre de chose :': correct French. Read 2026-10-21.
  'people.groupSub.meet', 'people.whoToAskLine',
  // 'Touchez un nom pour l’ouvrir. Il remplace ce qui est sur le canevas ; Annuler le fait revenir.': correct French. Read 2026-10-20.
  'treeModals.openNote',
  // 'Rien ne change tant que vous n’avez pas choisi.': correct French. Read 2026-10-20.
  'treeNode.fixSheetNote',
  // Three builder lines ('Ce que donne la nature : pluie, soleil…', 'Chaque solution avec sa page
  // et ses tutoriels', 'Tout effacer : {cards} cartes et {links} liens'): correct French. Read 2026-10-20.
  'tree.kindResourceLine',
  'tree.buildListLine',
  'tree.eraseAll',
  // 'Les deux fourchettes se chevauchent : c’est limite, selon votre usage…': correct French. Read 2026-10-20.
  'adequacy.check.overlap',
  // 'ce n’est pas un flux que ce calcul additionne': correct French, no accents. Read 2026-10-20.
  'adequacy.check.notUsedWhy.no-family',
  // 'Recueillir la pluie sur une plus grande surface': correct French, no accents. Read 2026-10-20.
  'adequacy.check.nextFields.catchment-area',
  // 'Une maison, quatre choses que l’on construit pour elle…': correct French, no accents. Read 2026-10-20.
  // 'Essayez d’autres mots, ou partez d’un besoin…': correct French, no accents. Read 2026-10-20.
  'searchPage.missBody',
  // 'Ce que vous pouvez en faire quand vous en avez.' and 'Rien dans la maison n’a besoin de
  // l’utiliser : elle quitte la maison ici.': correct French, no accents. Read 2026-10-20.
  'resourcePage.usedByLead',
  'resourcePage.endsEnvironmentBody',
  // 'Tous les besoins qu’un logement doit assurer…': correct French, no accents. Read 2026-10-20.
  'needs.intro',
  // 'Pas encore de tutoriel en {lang}. Celui-ci est en {other} ; un navigateur peut le
  // traduire.' and its plural: correct French, no word takes an accent. Read 2026-10-20.
  'solutionPage.tutorialsNoneInLangOne',
  'solutionPage.tutorialsNoneInLangMany',
  // 'Vos filtres masquent toutes les solutions ici ({filters}).' and its two siblings --
  // correct French, no word takes an accent. Read and excused 2026-10-12.
  'facets.hiddenAll',
  'facets.hiddenOne',
  'facets.hiddenMany',
  // 'Liaison pour {name} : ce qui peut utiliser / fournir « {io} »' -- correct French, no
  // word in it takes an accent. Read and excused 2026-09-24 (connecting mode, TODO F16).
  'connect.barOut',
  'connect.barIn',
  // '{sourced} des {solutions} solutions citent la source qui les fonde, avec un niveau de
  // confiance' and 'Construire : nous vous orientons vers ceux qui savent' -- correct French,
  // no word in either takes an accent. Read and excused 2026-09-25 (the About page).
  'about.communitiesHeading',
  // 'Des filtres sont actifs sur tout le catalogue' -- correct French, and every word in
  // it happens to be accent-free. Read and excused 2026-09-09.
  'app.filtersActive',
  // 'Retirer les solutions high-tech du catalogue.' -- correct French, no accented letter
  // in any of its words. Read and excused 2026-09-09 when the sentence was shortened.
  'settings.showBenchmarkHelp',
  'home.searchPlaceholder',
  'needs.title',
  'guide.placeholderNote',
  'prerender.descIo',
  'prerender.rootTitle',
  'retrofit.availableOne',
  'retrofit.availableMany',
  'retrofit.settingsLabel',
  'ranking.explainOpen',
  'settings.languageHelp',
  'settings.themeHelp',
  'about.licenceCode',
  'settings.contributionText',
  'feedback.missingButton',
  'adequacy.sourceMeta',
  'treeNode.ranksLine',
  // 'Rechercher, ou parcourir ci-dessous par besoin' -- correct French, no accented
  // letter in any of its words. Read and excused 2026-09-05, which is the allowlist
  // working as intended: a long accent-free string has to be looked at, not assumed.
  'treeModals.searchPlaceholder',
])

const leaves = []
const walk = (node, path) => {
  if (typeof node === 'string') { leaves.push([path, node]); return }
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`)); return }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k)
  }
}
walk(frStrings, '')

console.log('\nfrench strings\n')

const suspects = leaves.filter(([key, v]) =>
  v.length >= LONG
  && !ACCENTED.test(v)
  && !/^https?:/.test(v)
  && !ACCENTLESS_BUT_CORRECT.has(key))

if (suspects.length) {
  fail(`${suspects.length} long French string(s) carry no accented character`,
       suspects.map(([k]) => k).join(', '))
  for (const [k, v] of suspects) console.log(`          ${k}: ${v.slice(0, 90)}`)
  console.log('          Either add the accents, or add the key to ACCENTLESS_BUT_CORRECT')
  console.log('          in this file if the sentence is genuinely accent-free.')
} else {
  pass(`no unaccented French among ${leaves.length} strings (${LONG}+ chars)`)
}

// The allowlist must not rot: an entry that no longer matches anything is either a
// renamed key or a string that has since gained its accents, and either way it is now
// hiding nothing and should go.
const byKey = new Map(leaves)
const stale = [...ACCENTLESS_BUT_CORRECT].filter((k) => {
  const v = byKey.get(k)
  return v === undefined || v.length < LONG || ACCENTED.test(v)
})
if (stale.length) {
  fail('the accent allowlist has stale entries', stale.join(', '))
  console.log('          These no longer need excusing. Remove them, so the list stays')
  console.log('          a short record of real exceptions rather than a dumping ground.')
} else {
  pass(`the ${ACCENTLESS_BUT_CORRECT.size} allowlisted exceptions are all still needed`)
}

// French spacing (B15, 2026-10-21): a narrow no-break space before ? ! ; and a no-break space
// before :, so the mark never wraps onto a line of its own. A plain space, or none, after a
// word is the slip. Times, ratios and URLs (a digit or a slash before the colon) are left alone.
const noUrl = (v) => v.replace(/https?:\S+/g, '')
const badSpace = leaves.filter(([, v]) =>
  /[^\s  ([«"'`?!] ?[?!;](?=[\s’»).]|$)/u.test(noUrl(v))
  || /[^\s  ([«"'`\d/] ?:(?=\s|$)/u.test(noUrl(v)))
if (badSpace.length) {
  fail(`${badSpace.length} French strings without the no-break space before ? ! : ;`,
    badSpace.slice(0, 8).map(([k]) => k).join(', '))
} else {
  pass('every ? ! : ; in French follows a no-break space')
}

console.log(`\n${failures ? `${failures} FAILED` : 'french strings OK'}\n`)
process.exit(failures ? 1 : 0)
