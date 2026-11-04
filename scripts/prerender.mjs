// Static prerender — writes one real HTML file per catalogue entity, per language.
//
// WHY: the app is client-rendered, so a crawler that doesn't execute JavaScript sees an
// empty shell. Most LLM crawlers don't; Google does but had one URL to index until
// routing landed. This step turns ~660 catalogue views into ~660 indexable, citable,
// JS-free HTML pages. The SPA still boots on top and takes over.
//
// WHY NODE, NOT build_app_data.py (which the backlog originally proposed): the pages need
// the interface labels, and those live in src/ui-strings.js under the "one home per kind
// of text" rule (01-Methodology.md §2.1). A Python prerenderer would have to restate
// every label, creating a second home that silently drifts. Node imports the real one.
// It also runs AFTER `vite build`, because it needs the hashed asset filenames that only
// exist once Vite has written dist/index.html.
//
// HOW IT LAYERS: content goes in <div id="prerender">, a sibling of #root, not inside it.
// React would wipe it on mount if it were inside; as a sibling, main.jsx removes it
// explicitly once the app is up. A visitor without JavaScript keeps the content.
//
// Output shape: dist/en/solution/<slug>/index.html, so static hosts serve it at the
// extensionless URL the router produces. A real file wins over the /* -> /index.html SPA
// fallback in public/_redirects, which is what keeps the two compatible.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SEG, LANGS, segPath } from '../src/url-vocab.js'
import { ui, setUiLang, fill } from '../src/ui-strings.js'
// The app loads its French on demand (B2, src/language.js); here both languages are needed at once.
import { provideFrench } from '../src/ui-strings.js'
import { fr as frStrings } from '../src/ui-strings.fr.js'
provideFrench(frStrings)
// Same shortening the app uses, from the same file, so the static page and the app
// show a reader the same label rather than two different ones.
import { tutorialLabel } from '../src/display-url.js'
import { tradeoffs, fitFacts } from '../src/tradeoffs.js'
// The need icons, from the same module the app renders, so a crawler and a reader see the
// same mark drawn by the same code. Decorative (aria-hidden) in both.
import { needIconSvg } from '../src/illustrations/needIcons.js'
import { siteCounts, ABOUT_STEPS, ABOUT_DIFFS } from '../src/siteCounts.js'
import { FEEDBACK_EMAIL } from '../src/platform.js'
import { buildLlms } from './llms.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
const DIST = path.join(ROOT, 'dist')

// Canonical origin for canonical/hreflang/og and the sitemap. Overridable so a staging
// deploy doesn't emit production URLs.
const SITE = (process.env.SITE_URL || 'https://lowtechgraph.org').replace(/\/$/, '')

// One card for every page, referenced absolutely because a crawler resolves og:image
// against nothing. Until 2026-08-21 there was no og:image at all, which meant most
// platforms rendered a shared link as bare text: no image, no card, nothing to look at.
// twitter:card is stated explicitly rather than left to fall back through the og tags, so
// the card type is decided here rather than by each platform's guess.
const OG_CARD = '/og-card.png'
// The card in the page's language (brief 11, E; made by scripts/make-og-card.mjs).
const ogCard = (lang) => (lang === 'fr' ? '/og-card-fr.png' : OG_CARD)

const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalogue.json'), 'utf8'))
// People and places (brief 11): the same file the page reads.
const people = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/people.json'), 'utf8'))
const info = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/build-info.json'), 'utf8'))
const byId = (l) => Object.fromEntries(l.map((x) => [x.id, x]))
const fnById = byId(cat.functions)
const subById = byId(cat.subfunctions)
const ioById = byId(cat.io_types)
const solById = byId(cat.solutions)
// The catalogue's own figures, quoted by the About page, the AI statement and llms.txt.
const COUNTS = siteCounts(cat)

// alphabetical in the page's language, as in the app
const subsOf = (fid, lang) => cat.subfunctions.filter((s) => s.function_id === fid)
  .sort((a, b) => tName(a, lang).localeCompare(tName(b, lang), lang, { sensitivity: 'base' }))
const solsOfSub = (sid) => cat.solutions.filter((s) => s.subfunction_id === sid)
const solsOfFn = (fid) => cat.solutions.filter((s) => s.function_id === fid)

// --- language helpers: mirror catalogue.js so pages read like the app --------
const slugOf = (e, lang) => (lang === 'fr' ? e?.slug_fr : e?.slug) || e?.slug || ''
const L = (e, field, lang) => {
  if (!e) return ''
  if (lang === 'fr' && e.fr && e.fr[field]) return e.fr[field]
  return e[field === 'description' ? 'summary' : field] ?? ''
}
// As src/catalogue.js: the everyday label where there is one (C2), the full name for titles.
const tName = (e, lang) => L(e, 'short', lang) || L(e, 'name', lang) || e?.name || ''
const tLong = (e, lang) => L(e, 'name', lang) || e?.name || ''
const longLine = (e, lang) => (tLong(e, lang).toLowerCase() === tName(e, lang).toLowerCase() ? ''
  : `<p class="pr-long">${esc(tLong(e, lang))}</p>`)
const tSummary = (e, lang) => L(e, 'description', lang)

const ENUM_FR = {
  low: 'faible', medium: 'moyen', high: 'élevé', 'low-medium': 'faible à moyen',
  none: 'aucun', occasional: 'occasionnel', seasonal: 'saisonnier', frequent: 'fréquent',
  basic: 'basique', intermediate: 'intermédiaire', specialist: 'spécialiste',
  minor: 'mineures', significant: 'importantes',
  'continuous process': 'processus continu',
  'on-demand/controllable': 'à la demande / pilotable',
  'weather/time-dependent': 'dépendant de la météo / du moment',
}
const tEnum = (v, lang) => (!v || lang !== 'fr' ? v : ENUM_FR[String(v).trim().toLowerCase()] || v)

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// --- the folder-CMS, read with fs -------------------------------------------
// src/content.js reads the same folders with import.meta.glob, which is a Vite feature a
// plain Node script cannot use, so this is a second reader over ONE source of truth. The
// data cannot drift because there is only one copy of it; only the reading could, which is
// why this deliberately does no interpretation beyond picking the language.
const CONTENT = fileURLToPath(new URL('../src/content/', import.meta.url))

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** Cards for one group ('hero', 'section1', 'section2'), in slot order. A slot folder with
 *  no card.json is a hidden card, which is how a section carries fewer than four. */
function cards(group, lang) {
  const dir = path.join(CONTENT, group)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).sort()
    .map((slot) => path.join(dir, slot, 'card.json'))
    .filter((f) => fs.existsSync(f))
    .map((f) => {
      const d = readJson(f)
      const t = d[lang] || d.en || {}
      return { to: d.to, title: t.title || '', text: t.text || '', cta: t.cta || '' }
    })
    .filter((c) => c.to && c.title)
}

// In their `order`, as the app (content.js): no number, last and off the home page.
const rank = (g) => (typeof g.order === 'number' ? g.order : Infinity)
const guides = fs.existsSync(path.join(CONTENT, 'guides'))
  ? fs.readdirSync(path.join(CONTENT, 'guides')).sort()
      .filter((id) => fs.existsSync(path.join(CONTENT, 'guides', id, 'guide.json')))   // not the README
      .map((id) => ({ id, ...readJson(path.join(CONTENT, 'guides', id, 'guide.json')) }))
      .filter((g) => g.slug)
      .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
  : []

const guideById = Object.fromEntries(guides.map((g) => [g.id, g]))

/** A card's destination as a path. Cards can only point at views the prerenderer knows. */
function cardHref(to, lang) {
  const seg = SEG[lang]
  switch (to.view) {
    case 'guide': {
      const g = guideById[to.id]
      return g ? segPath(lang, seg.guide, g.slug[lang] || g.slug.en) : segPath(lang)
    }
    case 'needs': return segPath(lang, seg.needs)
    case 'guides': return segPath(lang, seg.guides)
    case 'tree': return segPath(lang, seg.tree)
    case 'why': return segPath(lang, seg.why)
    case 'about': return segPath(lang, seg.about)
    case 'people': return segPath(lang, seg.people)
    case 'legal': return segPath(lang, seg.legal)
    default: return segPath(lang)
  }
}

// --- paths ------------------------------------------------------------------
function pathOf(kind, entity, lang) {
  const seg = SEG[lang]
  switch (kind) {
    case 'home': return segPath(lang)
    case 'function': return segPath(lang, seg.need, slugOf(entity, lang))
    case 'subfunction': {
      const fn = fnById[entity.function_id]
      return segPath(lang, seg.need, slugOf(fn, lang), slugOf(entity, lang))
    }
    case 'solution': return segPath(lang, seg.solution, slugOf(entity, lang))
    case 'io': return segPath(lang, seg.resource, slugOf(entity, lang))
    case 'why': return segPath(lang, seg.why)
    case 'about': return segPath(lang, seg.about)
    case 'people': return segPath(lang, seg.people)
    case 'legal': return segPath(lang, seg.legal)
    case 'needs': return segPath(lang, seg.needs)
    case 'resources': return segPath(lang, seg.resources)
    case 'guides': return segPath(lang, seg.guides)
    case 'guide': return segPath(lang, seg.guide, entity.slug[lang] || entity.slug.en)
    case 'tree': return segPath(lang, seg.tree)
    /* The default returns the HOMEPAGE, so a kind this function does not know yields a
       working link to the wrong place rather than an error. That is how the nav first
       shipped with "Build" pointing at /en on 784 pages, caught by reading the built
       output and by no gate. If you add a view, add it here too. */
    default: return segPath(lang)
  }
}

// --- page building blocks ---------------------------------------------------
const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`
// Mirrors App.jsx. This block is rendered TWICE in this project -- once by the component
// and once here -- and the prerendered copy is what a search engine and a first paint see.
const TUTORIAL_STATUS_STRING = {
  'not-diy': 'tutorialsNotDiy',
  trade: 'tutorialsTrade',
  'no-build': 'tutorialsNoBuild',
}
const tutorialStatusText = (ui, status) =>
  (status && ui.solutionPage[TUTORIAL_STATUS_STRING[status]]) || null

const listOf = (items) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '')

function factRows(sol, lang) {
  const cap = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '')
  const rows = [
    [ui.solutionPage.factCost, cap(tEnum(sol.cost, lang))],
    [ui.solutionPage.factUpkeep, cap(tEnum(sol.maintenance, lang))],
    [ui.solutionPage.factBuildSkill, cap(tEnum(sol.build_skill, lang))],
    [ui.solutionPage.factLifespan, L(sol, 'lifespan', lang)],
    [ui.solutionPage.factCarbon, cap(tEnum(sol.embodied_carbon, lang))],
    [ui.solutionPage.factFootprint, cap(tEnum(sol.footprint, lang))],
    [ui.solutionPage.factDispatch, cap(tEnum(sol.dispatchability, lang))],
    [ui.solutionPage.factRepairSkill, cap(tEnum(sol.repair_skill, lang))],
    [ui.solutionPage.factRegulation, L(sol, 'regulation_fr', lang)],
  ].filter(([, v]) => v)
  return `<dl class="pr-facts">${rows.map(([k, v]) =>
    `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
}

// Whether a solution needs a supply to run, and whether it can go into an existing
// house, are the two facts that disqualify it outright. Neither was in the static HTML
// at all: they live in the badges, which only the hydrated app rendered.
function badgeLine(sol) {
  const passive = !(sol.power || '').toLowerCase().includes('active')
  const parts = [passive ? ui.solutionPage.passive : ui.solutionPage.active]
  if (sol.new_build_only) parts.push(ui.solutionPage.newBuildOnly)
  return `<p class="pr-badges">${esc(parts.join(' · '))}</p>`
}

// The comparison summary, mirroring CompareStrip in App.jsx. It belongs in the static
// HTML and not only in the hydrated app, because a crawler or an LLM fetching a solution
// page gets this file, and "one of 8 ways, 2nd easiest to build" is the single most useful
// sentence on it. Where a sub-function holds one option there is nothing to rank against,
// so the page says what the buckets are instead of claiming a comparison that has no set.
function compareLine(sol) {
  const sub = subById[sol.subfunction_id]
  const n = solsOfSub(sol.subfunction_id).length
  if (n <= 1 || !sub) return `<p class="pr-note">${esc(ui.solutionPage.factsRelativeNote)}</p>`
  // Matches the app's strip, which stopped carrying the three rank cells on 2026-08-27:
  // every one of those numbers is in the comparison table lower down, for every option
  // and with the note that explains it, so repeating three of them here told a reader
  // (and a crawler) nothing the page did not already say better.
  // The relative-rating caveat stays in the STATIC copy though, and this is the one place
  // the two renderings deliberately differ: in the app it lives inside a fold a reader can
  // open, and a fold is not a thing a crawler or an LLM opens. Losing it there would let
  // a machine read "Cost: Low" as an absolute claim, which is exactly the misreading the
  // sentence exists to prevent.
  // No added full stop: compareIntro carries its own since the strip became one line.
  return `<p class="pr-cmp">${esc(fill(ui.ranking.compareIntro, { n }))} ` +
    `${esc(ui.ranking.compareRelative)}</p>`
}

// The comparison (D10 Q2, TODO F15), as the app shows it: the page's own option first, then
// each alternative, with the three layers. The levels come from src/tradeoffs.js, the same
// derivation the app uses, so the two renderings cannot disagree about a level. Written out
// as text rather than dots: a crawler or an LLM reads words. Site and rules notes are left to
// each option's own page, where they are already printed in full.
function comparisonBlock(sol, lang) {
  const sibs = solsOfSub(sol.subfunction_id)
  if (sibs.length <= 1) {
    return `<h2>${esc(ui.ranking.headingSingle)}</h2><p>${esc(ui.ranking.onlyOption)}</p>`
  }
  const C = ui.comparison
  const Lx = (e, f) => L(e, f, lang)
  const tx = (v) => tEnum(v, lang)
  const card = (p) => {
    const name = p.id === sol.id ? `<b>${esc(tName(p, lang))}</b> (${esc(C.thisOne)})`
      : link(pathOf('solution', p, lang), tName(p, lang))
    const fit = fitFacts(p, ui, Lx).filter((f) => f.text === undefined).map((f) => f.word).join(' · ')
    const trade = tradeoffs(p, ui, tx).map((t) => `${t.label}: ${t.word}`).join(' · ')
    const clause = L(p, 'choose_if', lang)
    return `<li>${name}<br>${esc(C.canUse)} ${esc(fit)}<br>${esc(C.costs)} ${esc(trade)}` +
      (clause ? `<br>${esc(C.chooseIf)} ${esc(clause)}` : '') + '</li>'
  }
  return `<h2>${esc(C.assessHeading)} · ${esc(fill(C.waysCount, { n: sibs.length }))}</h2>
    <ul class="pr-compare">${[sol, ...sibs.filter((p) => p.id !== sol.id)].map(card).join('')}</ul>`
}

function solutionBody(sol, lang) {
  const sub = subById[sol.subfunction_id]
  const fn = fnById[sol.function_id]
  const io = (arr) => listOf((arr || []).map((x) => {
    const e = ioById[x.io]
    return e ? link(pathOf('io', e, lang), tName(e, lang)) : esc(x.name)
  })) || `<p>${esc(ui.solutionPage.none)}</p>`
  const sources = listOf((sol.sources || []).map((s) =>
    s.url ? link(s.url, s.name || s.url) : esc(s.name)))
  // Named as the app names them (brief 01): the tutorial's own title, then where, in which
  // language, and by whom. A citation a reader or a model can follow by name as well as by link.
  const S = ui.solutionPage
  const tuts = listOf((sol.tutorials || []).map((t) => {
    const site = t.site === 'Low-tech Lab wiki' ? S.lowtechLabWiki : t.site
    const bits = [site, t.lang && (S.languageName[t.lang] || t.lang.toUpperCase()),
      t.maker && `${S.tutorialBy} ${t.maker}`].filter(Boolean)
    const title = t.title ? t.title.charAt(0).toUpperCase() + t.title.slice(1) : tutorialLabel(t)
    const line = (lang === 'fr' && sol.tutorial_lines_fr && sol.tutorial_lines_fr[t.url]) || t.line
    return `<a href="${esc(t.url)}"${t.lang ? ` hreflang="${esc(t.lang)}"` : ''}>${esc(title)}</a>`
      + (line ? ` ${esc(line)}.` : '')
      + (bits.length ? ` <span class="pr-lang">${esc(bits.join(' · '))}</span>` : '')
  }))
  return `
    ${crumbTrail(lang, [
      fn ? link(pathOf('function', fn, lang), tName(fn, lang)) : '',
      sub ? link(pathOf('subfunction', sub, lang), tName(sub, lang)) : '',
    ], { home: false })}
    ${siteLine(lang)}
    <h1>${esc(tName(sol, lang))}</h1>
    ${badgeLine(sol)}
    ${compareLine(sol)}
    ${/* Same order as the app, 2026-08-27. The two renderings of one page drifting apart
         is its own defect: a crawler and a reader should be told the same things in the
         same sequence, and the sequence is an editorial decision either way. Site
         requirements first because they can end the reader's interest outright; the
         tutorial straight after the description because it is what the page is FOR. */''}
    ${L(sol, 'site_prerequisites', lang)
      ? `<h2>${esc(ui.solutionPage.siteHeading)}</h2><p>${esc(L(sol, 'site_prerequisites', lang))}</p>` : ''}
    <p class="pr-lede">${esc(tSummary(sol, lang))}</p>
    <div class="pr-tutorials">
      <h2>${esc(ui.solutionPage.tutorialsHeading)}</h2>
      ${tuts || `<p>${esc(tutorialStatusText(ui, sol.tutorial_status)
        || ui.solutionPage.tutorialsNone)}</p>`}
    </div>
    ${factRows(sol, lang)}
    <h2>${esc(ui.solutionPage.inputsHeading)}</h2>${io(sol.inputs)}
    <h2>${esc(ui.solutionPage.outputsHeading)}</h2>${io(sol.outputs)}
    ${comparisonBlock(sol, lang)}
    <h2>${esc(ui.solutionPage.sourcesHeading)}</h2>
    ${sources || `<p>${esc(ui.solutionPage.sourcesNone)}</p>`}
    <h2>${esc(ui.prerender.limitsHeading)}</h2>
    <p>${esc(ui.prerender.limitsBody)}</p>`
}

// The crumb trail, matching the app's since 2026-09-09. The app gained a "Browse" step
// between home and the function when breadcrumbs became the way back and the header's back
// button was removed; the four trails below were each hand-built and would otherwise have
// kept the old shape, which is the static-vs-hydrated divergence that has bitten the
// tutorial block and the <h1> already. One builder, four callers.
// The same two steps the visible trail starts with, for the BreadcrumbList. qa-seo checks
// that structured depth equals visible depth, which is what caught this the moment the
// visible trail gained "Browse" and the structured one did not: 758 pages, one check.
const crumbHead = (lang) => [
  { name: ui.app.name, path: segPath(lang) },
  { name: ui.app.navBrowse, path: pathOf('needs', null, lang) },
]

// `home: false` where the app's own trail starts below home (B2: the same first screen; the
// header's logo is the way home, and the JSON-LD keeps the full trail for crawlers).
function crumbTrail(lang, parts, { home = true } = {}) {
  // A labelled breadcrumb (B7): a screen reader names it as the app's does.
  return `<nav class="pr-crumbs" aria-label="${esc(ui.app.breadcrumbLabel)}">${[
    home && link(pathOf('home', null, lang), ui.app.name),
    ...parts,
  ].filter(Boolean).join(' › ')}</nav>`
}

// Prepended to every prerendered page, 2026-09-09. The static pages are what a crawler and
// a JS-less reader receive, and the 230 solution pages are the site's search surface: until
// now each of them offered a breadcrumb and nothing else, so an arrival from a search engine
// had no route to the catalogue, the builder or the reasoning. Same three destinations as
// the app's header nav, from the same strings, so the two cannot drift.
// The app's own bar, with its classes and therefore its stylesheet (B2, 2026-10-26): the static
// page and the app now open on the same first screen, so nothing jumps when the app takes over.
// The search field and Settings need the app; the menu button leads to the page foot's links.
function pageNav(lang, altPaths) {
  const item = (view, label) => `<a href="${esc(pathOf(view, null, lang))}" class="hnav-item">${esc(label)}</a>`
  const other = LANGS.find((l) => l !== lang)
  const otherPath = (altPaths && altPaths[other]) || segPath(other)
  return `
    <header class="header">
      <div class="header-left">
        <a href="${esc(segPath(lang))}" class="title" aria-label="${esc(fill(ui.app.homeButtonLabel, { name: ui.app.name }))}"><img class="brand-mark" alt="" width="154" height="84" src="/logo-mark.png"><span class="brand-name">${esc(ui.app.name)}</span></a>
        <nav class="hnav" aria-label="${esc(ui.app.navLabel)}">${[
          item('needs', ui.app.navBrowse),
          item('guides', ui.app.navGuides),
          item('tree', ui.app.navBuild),
        ].join('')}</nav>
      </div>
      <div class="header-right">
        <a href="${esc(otherPath)}" class="icon-btn lang-quick" lang="${other}" hreflang="${other}">${other.toUpperCase()}</a>
        <a href="#pr-foot" class="icon-btn is-mobile-only" aria-label="${esc(ui.app.menuLabel)}"><svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></a>
      </div>
    </header>`
}

// Appended to every prerendered page: the reader-facing footer, plus the statement
// addressed to automated readers. Both belong in the static HTML specifically because
// that is what a crawler or an LLM fetcher receives.
function pageFoot(lang) {
  return `
    <footer class="pr-foot" id="pr-foot">
      <p>${link(pathOf('about', null, lang), ui.app.navAbout)} · ${link(pathOf('people', null, lang), ui.people.nav)} · ${link(pathOf('why', null, lang), ui.app.navWhy)} · ${link(pathOf('legal', null, lang), ui.app.navLegal)}</p>
      <p>${esc(fill(ui.footer.lastUpdated, { date: info.data_updated }))}</p>
      <p>${esc(ui.footer.licence)}</p>
      <h2>${esc(ui.prerender.aiHeading)}</h2>
      <p>${esc(fill(ui.prerender.aiBody, COUNTS))}</p>
      <p><a href="/catalogue.json">catalogue.json</a> · <a href="/llms.txt">llms.txt</a></p>
    </footer>`
}

function functionBody(fn, lang) {
  const subs = subsOf(fn.id, lang)
  return `
    ${crumbTrail(lang, [link(pathOf('needs', null, lang), ui.app.navBrowse)])}
    <h1 class="pr-fn-title">${needIconSvg(fn.id, { size: 48 })}${esc(tName(fn, lang))}</h1>
    ${longLine(fn, lang)}
    ${tSummary(fn, lang) ? `<p class="pr-lede">${esc(tSummary(fn, lang))}</p>` : ''}
    <h2>${esc(ui.needPages.subfunctionsHeading)}</h2>
    ${listOf(subs.map((s) => {
      const n = solsOfSub(s.id).length
      return `${link(pathOf('subfunction', s, lang), tName(s, lang))} — ${fill(ui.home.solutionCount, { n })}`
        .replace(' — ', ', ')
    }))}`
}

function subfunctionBody(sub, lang) {
  const fn = fnById[sub.function_id]
  const sols = solsOfSub(sub.id)
  return `
    ${crumbTrail(lang, [
      link(pathOf('needs', null, lang), ui.app.navBrowse),
      fn ? link(pathOf('function', fn, lang), tName(fn, lang)) : '',
    ], { home: false })}
    ${siteLine(lang)}
    <h1>${esc(tName(sub, lang))}</h1>
    ${longLine(sub, lang)}
    ${tSummary(sub, lang) ? `<p class="pr-lede">${esc(tSummary(sub, lang))}</p>` : ''}
    ${L(sub, 'efficiency_basis', lang) ? `<p>${esc(L(sub, 'efficiency_basis', lang))}</p>` : ''}
    <h2>${esc(sols.length > 1 ? fill(ui.comparison.heading, { n: sols.length }) : ui.searchPage.solutions)}</h2>
    ${listOf(sols.map((s) =>
      `${link(pathOf('solution', s, lang), tName(s, lang))}: ${esc(tSummary(s, lang).slice(0, 160))}`))}`
}

// The resources index's groups, as the app's catalogue.js forms them (brief 09).
const GROUP_OF = {
  Energy: 'energy', Water: 'water', Material: 'material', Air: 'air',
  Durability: 'building', Safety: 'building', Structure: 'building', Acoustic: 'building',
  Light: 'signal', Information: 'signal',
}
const RESOURCE_GROUPS = ['energy', 'water', 'air', 'material', 'building', 'signal']
const groupOf = (e) => GROUP_OF[e?.category] || 'water'
const touching = (id) => [...new Set(cat.io_index.filter((x) => x.io === id).map((x) => x.sol))]
  .map((x) => solById[x]).filter(Boolean)

function ioBody(e, lang) {
  const R = ui.resourcePage
  const produces = cat.io_index.filter((x) => x.io === e.id && x.role === 'produces').map((x) => solById[x.sol]).filter(Boolean)
  const consumes = cat.io_index.filter((x) => x.io === e.id && x.role === 'consumes').map((x) => solById[x.sol]).filter(Boolean)
  // Same rules and order as the app's IoView (brief 09): used by, passed on by, made by; a
  // natural resource says nature supplies it; an output nothing uses says where it ends.
  const natural = (cat.natural_resources || []).some((r) => r.io === e.id)
  const household = (cat.household_sources || []).some((r) => r.io === e.id)
  const label = (cat.natural_resources || []).find((r) => r.io === e.id)
  const through = produces.filter((s) => consumes.some((c) => c.id === s.id))
  const made = produces.filter((s) => !through.includes(s))
  const used = consumes.filter((s) => !produces.some((p) => p.id === s.id))
  const grp = (title, list) => list.length
    ? `<h2>${esc(title)} · ${list.length}</h2>${listOf(list.map((s) => link(pathOf('solution', s, lang), tName(s, lang))))}` : ''
  const t = e.terminal === 'both' ? 'home' : e.terminal
  const END = { home: [R.endsHomeTitle, R.endsHomeBody], dwelling: [R.endsDwellingTitle, R.endsDwellingBody],
    environment: [R.endsEnvironmentTitle, R.endsEnvironmentBody] }
  const ends = !used.length && !through.length && END[t]
    ? `<h2>${esc(END[t][0])}</h2><p>${esc(END[t][1])}</p>` : ''
  const origin = natural
    ? `<h2>${esc(R.natureTitle)}</h2><p>${esc(fill(R.natureBody, { label: (label && ((lang === 'fr' && label.label_fr) || label.label)) || e.id }))}</p>`
    : household ? `<h2>${esc(R.comesFrom)}</h2><p>${esc(R.householdLead)}</p>` : ''
  return `
    ${crumbTrail(lang, [link(pathOf('resources', null, lang), R.crumb),
      link(pathOf('resources', null, lang) + '#' + groupOf(e), R.groups[groupOf(e)])], { home: false })}
    ${siteLine(lang)}
    <h1>${esc(tName(e, lang))}</h1>
    ${tSummary(e, lang) ? `<p class="pr-lede">${esc(tSummary(e, lang))}</p>` : ''}
    ${ends}
    ${origin}
    ${grp(R.usedBy, used)}
    ${grp(R.passedOnBy, through)}
    ${grp(natural ? R.broughtInBy : R.madeBy, made)}`
}

function resourcesBody(lang) {
  const R = ui.resourcePage
  return `
    <h1>${esc(R.indexTitle)}</h1>
    <p class="pr-lede">${esc(R.indexIntro)}</p>
    ${RESOURCE_GROUPS.map((g) => {
      const items = cat.io_types.filter((e) => groupOf(e) === g)
        .sort((a, b) => tName(a, lang).localeCompare(tName(b, lang), lang, { sensitivity: 'base' }))
      return items.length ? `<h2 id="${g}">${esc(R.groups[g])}</h2>${listOf(items.map((e) =>
        `${link(pathOf('io', e, lang), tName(e, lang))}, ${fill(ui.home.solutionCount, { n: touching(e.id).length })}`))}` : ''
    }).join('')}`
}

function homeBody(lang) {
  // Mirrors the app's home page (brief 06, second pass): the doors in the reader's words, each
  // to its guide, then where the know-how comes from, the path, and why. A crawler and a JS-less
  // reader get the same doors and words a visitor gets.
  const H = ui.home
  const doorLink = (href, title, sub, extra = '') =>
    `<a class="door${extra}" href="${esc(href)}"><span class="door-title">${esc(title)}</span>${sub ? ` <span class="door-sub">${esc(sub)}</span>` : ''}</a>`
  const door = (g) => {
    const label = (g[lang] || g.en || {}).door
    return typeof g.order === 'number' && label && (g.picks || []).length
      ? doorLink(pathOf('guide', g, lang), label, fill(H.doorGuide, { n: g.picks.length })) : ''
  }
  const by = new Map()
  // As the app: a host (YouTube, an archive) is not a source.
  const HOSTS = new Set(['YouTube', 'Internet Archive'])
  for (const s of cat.solutions) for (const t of s.tutorials || []) if (t.site && !HOSTS.has(t.site)) by.set(t.site, (by.get(t.site) || 0) + 1)
  const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([site]) => esc(site === 'Low-tech Lab wiki' ? 'Low-tech Lab' : site))
  return `
    <div class="is-home">
    <h1 class="home-title">${esc(H.title)}</h1>
    <p class="home-tagline">${esc(H.tagline || H.intro)}</p>
    <div class="home-start">
      <section class="home-doors"><h2>${esc(H.startHeading)}</h2><div class="door-grid">${guides.map(door).join('')}</div><a class="link home-doors-all" href="${esc(pathOf('guides', null, lang))}">${esc(H.doorGuides)} →</a></section>
      <div class="home-house-reserve" aria-hidden="true"></div>
    </div>
    </div>
    <section class="home-sec"><h2>${esc(H.pathHeading)}</h2><ul class="home-path">${[
      ['needs', H.pathCompare, H.pathCompareBody, H.pathCompareGo],
      ['people', H.pathTeach, H.pathTeachBody, H.pathTeachGo],
      ['tree', H.pathFit, H.pathFitBody, H.pathFitGo],
    ].map(([view, t, b, label]) => `<li><a class="home-path-card" href="${esc(pathOf(view, null, lang))}"><div class="home-path-art"></div><div class="home-path-text"><h3 class="home-path-title">${esc(t)}</h3><p>${esc(b)}</p><span class="btn home-path-go">${esc(label)}</span></div></a></li>`).join('')}</ul></section>
    <section><h2>${esc(H.whyHeading)}</h2><p>${esc(ui.why.lede)}</p><p>${link(pathOf('why', null, lang), H.readMore)}</p><p class="home-sources">${esc(fill(H.sourcesBody, { names: '' })).replace(/\.$/, '')}${top.join(' · ')}.</p></section>`
}

// The same line the app prints for a reader arriving from outside (D10 Q2, brief 01). Why
// low-tech? is in the footer.
const siteLine = (lang) =>
  `<p class="pr-site">${esc(ui.app.siteLine)}</p>`

function guidesBody(lang) {
  return `
    <h1>${esc(ui.guides.title)}</h1>
    <p class="pr-lede">${esc(ui.guides.intro)}</p>
    ${listOf(guides.map((g) => {
      const t = g[lang] || g.en || {}
      return `${link(pathOf('guide', g, lang), t.title || '')}: ${esc(t.intro || '')} `
        + `(${esc(fill(ui.guides.picks, { n: (g.picks || []).length }))})`
    }))}`
}

function needsBody(lang) {
  return `
    <h1>${esc(ui.needs.heading)}</h1>
    <p class="pr-lede">${esc(ui.needs.intro)}</p>
    <p>${link(pathOf('resources', null, lang), ui.resourcePage.indexTitle)}</p>
    ${listOf(cat.functions.map((f) => {
      const n = solsOfFn(f.id).length
      return `<span class="pr-need">${needIconSvg(f.id, { size: 32 })}`
        + `${link(pathOf('function', f, lang), tName(f, lang))}</span>, ${fill(ui.home.solutionCount, { n })}`
    }))}`
}

function guideBody(g, lang) {
  const t = g[lang] || g.en || {}
  // Only the pick and the reason come from the file; the name and summary are read from
  // the catalogue, exactly as the app does it, so a renamed solution is renamed here too.
  const picks = (g.picks || []).map((p) => {
    const sol = solById[p.id]
    if (!sol) return ''
    const why = (p[lang] || p.en || {}).why || ''
    return `${link(pathOf('solution', sol, lang), tName(sol, lang))}: ${esc(tSummary(sol, lang).slice(0, 160))}`
      + (why ? ` — ${esc(ui.guide.whyLabel)}: ${esc(why)}` : '')
  }).filter(Boolean)
  return `
    <h1>${esc(t.title || '')}</h1>
    <p class="pr-lede">${esc(t.intro || '')}</p>
    ${listOf(picks)}
    <section><h2>${esc(ui.guide.moreHeading)}</h2><p>${esc(ui.guide.moreBody)}</p>
    ${link(pathOf('needs', null, lang), fill(ui.guide.moreButton, { n: cat.solutions.length }))}</section>`
}

// --- structured data --------------------------------------------------------
function jsonLd(kind, entity, lang, url, title, desc, name, crumbs) {
  const graph = []
  if (kind === 'solution') {
    graph.push({
      // `name` is the bare entity name, not the site-suffixed <title>: the suffix is
      // navigation furniture, and repeating it inside structured data is noise to anyone
      // consuming the graph.
      '@type': 'TechArticle', '@id': url, url, name, headline: name,
      description: desc, inLanguage: lang, dateModified: info.data_updated,
      identifier: entity.id,        // stable catalogue id, so a citation can be precise
      license: 'https://creativecommons.org/licenses/by-sa/4.0/',
      isPartOf: { '@type': 'Dataset', name: ui.app.name, url: `${SITE}${segPath(lang)}` },
    })
    // HowTo ONLY where a real tutorial exists. Never fabricated to win a rich result.
    // Pick the tutorial in THIS page's language where there is one: a French page
    // pointing at an English how-to is a worse answer than no how-to at all.
    const tut = (entity.tutorials || []).find((t) => t.lang === lang)
      || (entity.tutorials || []).find((t) => !t.lang)
      || (entity.tutorials || [])[0]
    if (tut) {
      graph.push({ '@type': 'HowTo', name, description: desc, inLanguage: tut.lang || lang,
        url: tut.url })
    }
  } else if (kind === 'function' || kind === 'subfunction') {
    // The 15-function decomposition is a controlled vocabulary nobody else publishes.
    graph.push({
      '@type': 'DefinedTerm', '@id': url, url, name, description: desc,
      inLanguage: lang, identifier: entity.id,
      inDefinedTermSet: { '@type': 'DefinedTermSet', name: ui.app.name, url: `${SITE}${segPath(lang)}` },
    })
  } else if (kind === 'io') {
    graph.push({ '@type': 'DefinedTerm', '@id': url, url, name, description: desc,
      inLanguage: lang, identifier: entity.id })
  } else if (kind === 'home') {
    // The home page states what the site IS, three ways a search engine or a model can read:
    // the site, the application a reader uses on it, and the dataset behind both (which
    // makes the catalogue eligible for dataset search). Descriptions come from the About copy.
    const about = fill(ui.about.lede, COUNTS)
    graph.push({ '@type': 'WebSite', '@id': url, url, name: ui.app.name, description: desc,
      inLanguage: lang })
    graph.push({ '@type': 'WebApplication', name: ui.app.name, url, description: about,
      applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', inLanguage: lang,
      isAccessibleForFree: true, offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR' } })
    graph.push({ '@type': 'Dataset', name: `${ui.app.name} catalogue`, description: about,
      url: `${SITE}${pathOf('about', null, lang)}`, inLanguage: ['en', 'fr'],
      license: 'https://creativecommons.org/licenses/by-sa/4.0/', isAccessibleForFree: true,
      dateModified: info.data_updated,
      creator: { '@type': 'Organization', name: ui.app.name, url: SITE },
      keywords: ['low-tech', 'bioclimatic', 'home renovation', 'circular economy', 'self-build',
        'resilience', 'sustainable housing', 'DIY'],
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json',
        contentUrl: `${SITE}/catalogue.json` }] })
  } else if (kind === 'about') {
    graph.push({ '@type': 'AboutPage', '@id': url, url, name, description: desc, inLanguage: lang,
      about: { '@type': 'WebApplication', name: ui.app.name, url: `${SITE}${segPath(lang)}` } })
  } else {
    graph.push({ '@type': 'WebSite', '@id': url, url, name: ui.app.name, description: desc,
      inLanguage: lang })
  }
  if (crumbs && crumbs.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.path,
      })),
    })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}


// Write a page as "<path>.html", NOT "<path>/index.html".
//
// Why it matters: with a directory + index.html, static hosts answer /foo with a 307 to
// /foo/ before serving anything. Our canonicals and sitemap use the slash-less form, so
// every indexed URL would redirect, and the page it landed on would declare a canonical
// pointing back at the redirecting URL. Google reads that as a canonical conflict, on
// every page at once. Emitting a real file at the exact canonical path removes the
// redirect entirely, and does so on any host rather than relying on one host's config.
function writeHtml(routePath, html) {
  const rel = routePath.replace(/^\//, '').replace(/\/$/, '')
  const file = rel ? path.join(DIST, rel + '.html') : path.join(DIST, 'index.html')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, html)
}

// The "why low-tech" page. Prerendered and indexable on purpose: it is the most
// linkable and most quotable content on the site, and the page an LLM is most likely to
// reach for when asked why someone would use low-tech systems at home.
function whyBody(lang) {
  const S = ui.why
  const sec = (h, b) => `<section><h2>${esc(h)}</h2><p>${esc(b)}</p></section>`
  return `
    <h1>${esc(S.heading)}</h1>
    <p>${esc(S.lede)}</p>
    <p>${esc(S.tradeoff)}</p>
    ${sec(S.agencyHeading, S.agencyBody)}
    ${sec(S.impactHeading, S.impactBody)}
    ${sec(S.costHeading, S.costBody)}
    ${sec(S.resilienceHeading, S.resilienceBody)}
    ${sec(S.joyHeading, S.joyBody)}
    <h2>${esc(S.notInsteadHeading)}</h2>
    <p>${esc(S.notInsteadP1)}</p>
    <p>${esc(S.notInsteadP2)}</p>
    <p>${esc(S.closing)}</p>
    <p><a href="${esc(segPath(lang))}">${esc(S.browseButton)}</a></p>`
}

// The About page: what the tool is. Twin of AboutView in src/App.jsx; both read ui.about and
// fill it with siteCounts(), so the page, the app and llms.txt quote the same figures.
/* People and places, as the page shows it by what they do (twin of People.jsx). */
function peopleBody(lang) {
  const P = ui.people
  const meta = (e) => {
    const bits = [P.kind[e.kind] || e.kind, e.langs.map((l) => P.langName[l] || l).join(', ')]
    if (e.where) bits.push(e.where[lang] || e.where.en)
    else {
      const t = e.tags.map((x) => (x === 'wiki' && e.link.includes('wiki.lowtechlab.org') ? P.ltlWiki : P.tag[x.replace(/ /g, '_')])).filter(Boolean)
      if (t.length) bits.push(t.join(', '))
    }
    return bits.filter(Boolean).join(' · ')
  }
  const group = (g) => {
    const items = people.entries.filter((e) => e.group === g)
    return `<section><h2>${esc(P.groupHeading[g])}</h2><p>${esc(P.groupSub[g])}</p><ul>${items.map((e) =>
      `<li><a href="${esc(e.link)}" rel="noopener">${esc(e.title)}</a>: ${esc(e.line[lang] || e.line.en)} <small>${esc(meta(e))}</small></li>`).join('')}</ul></section>`
  }
  const hello = `<section><h3>${esc(P.helloHeading)}</h3><p>${esc(P.helloLead)}</p><ul>${P.hello.map((h) =>
    `<li><a href="${esc(h.link)}" rel="noopener">${esc(h.title)}</a>: ${esc(h.line)}</li>`).join('')}</ul></section>`
  return `
    <h1>${esc(P.heading)}</h1>
    <p>${esc(P.lede)}</p>
    ${['learn', 'meet', 'ask'].map((g) => group(g) + (g === 'meet' ? hello : '')).join('')}
    <p>${esc(P.footRules)}</p>`
}

function aboutBody(lang) {
  const S = ui.about
  const f = (t) => esc(fill(t, COUNTS))
  const item = (k) => `<li><strong>${esc(S[k + 'Title'])}</strong> ${f(S[k + 'Body'])}</li>`
  // The steps link to their places, as on the page (twin of ABOUT_STEP_ROUTE in App.jsx).
  const rmh = solById['SOL-126']
  const stepPath = {
    discover: pathOf('needs', null, lang),
    compare: rmh ? pathOf('subfunction', subById[rmh.subfunction_id], lang) : pathOf('needs', null, lang),
    pick: pathOf('guides', null, lang), plan: segPath(lang, SEG[lang].tree), build: pathOf('people', null, lang),
  }
  const step = (k) => `<li><a href="${esc(stepPath[k])}"><strong>${esc(S[k + 'Title'])}</strong></a> ${f(S[k + 'Body'])}</li>`
  return `
    <h1>${esc(S.heading)}</h1>
    <p>${f(S.lede)}</p>
    <p><strong>${esc(S.whoHeading)}.</strong> ${esc(S.whoP1)} <a href="#who">${esc(S.readWhy)}</a></p>
    <p>${esc(S.offlineLine)}</p>
    <h2>${esc(S.stepsHeading)}</h2>
    <ol>${ABOUT_STEPS.map(step).join('')}</ol>
    <h2>${esc(S.differentHeading)}</h2>
    <ul>${ABOUT_DIFFS.map(item).join('')}</ul>
    <h2>${esc(S.circularHeading)}</h2>
    <p>${f(S.circularBody)}</p>
    <h2>${esc(S.communitiesHeading)}</h2>
    <p>${f(S.communitiesBody)}</p>
    <p>${link(pathOf('people', null, lang), S.communitiesLink)}</p>
    <h2>${esc(S.notHeading)}</h2>
    <p>${f(S.notBody)}</p>
    <h2>${esc(S.dataHeading)}</h2>
    <p>${esc(fill(S.catalogueText, { ...COUNTS, date: info.data_updated, subfunctions: COUNTS.subs, io: COUNTS.ios }))}</p>
    <p><a href="/catalogue.json">${esc(S.dataLink)}</a></p>
    <p>${esc(S.sourcesText)}</p>
    <p>${esc(S.licenceContent)}</p>
    <p>${esc(S.licenceCode)}</p>
    <h2 id="who">${esc(S.whoHeading)}</h2>
    ${['whoP1', 'whoP2', 'whoP3', 'whoP4', 'whoP5', 'whoSignoff'].map((k) => `<p>${esc(S[k])}</p>`).join('')}
    <p>${link(pathOf('needs', null, lang), S.browseButton)} · ${link(pathOf('tree', null, lang), S.buildButton)}</p>`
}

// Legal notice and privacy. Twin of LegalView in src/App.jsx; both read ui.legal.
function legalBody() {
  const S = ui.legal
  const mail = (t) => esc(t).replace('{email}', `<a href="mailto:${FEEDBACK_EMAIL}">${FEEDBACK_EMAIL}</a>`)
  const item = (k) => `<li><strong>${esc(S[k + 'Title'])}</strong> ${esc(S[k + 'Body'])}</li>`
  return `
    <h1>${esc(S.heading)}</h1>
    <h2>${esc(S.publisherHeading)}</h2><p>${mail(S.publisherBody)}</p>
    <h2>${esc(S.hostHeading)}</h2><p>${esc(S.hostBody)}</p>
    <h2>${esc(S.licenceHeading)}</h2><p>${esc(S.licenceBody)}</p>
    <h2>${esc(S.privacyHeading)}</h2><p>${esc(S.privacyNone)}</p>
    <ul>${['privacyCount', 'privacyBrowser', 'privacyShare', 'privacyMail'].map(item).join('')}</ul>
    <p>${mail(S.privacyRights)}</p>`
}

// --- page assembly ----------------------------------------------------------
const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')

function writePage({ kind, entity, lang, body, title, desc, altPaths, name, crumbs, xDefault }) {
  const p = pathOf(kind, entity, lang)
  const url = SITE + p
  // A handful of sub-functions are deliberately empty (CO2 removal in a dwelling IS
  // ventilation; circulation is a spatial-design question). They still get a URL so the
  // taxonomy is complete and linkable, but a 60-character page asserted as an article
  // dilutes the index — so they declare noindex while still passing links onward.
  const visible = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const thin = visible.length < 120
  const alts = LANGS.map((l) =>
    `<link rel="alternate" hreflang="${l}" href="${esc(SITE + altPaths[l])}">`).join('\n    ')
  const head = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    ${thin ? '<meta name="robots" content="noindex,follow">' : ''}
    <link rel="canonical" href="${esc(url)}">
    ${alts}
    <link rel="alternate" hreflang="x-default" href="${esc(SITE + (xDefault || altPaths.fr))}">
    <meta property="og:type" content="article">
    <!-- the bare name, not the site-suffixed <title>: og:site_name now supplies
         "Lowtech Graph" above the card, so the suffix would print it twice -->
    <meta property="og:title" content="${esc(name || title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${esc(url)}">
    <meta property="og:locale" content="${lang === 'fr' ? 'fr_FR' : 'en_GB'}">
    <meta property="og:site_name" content="${esc(ui.app.name)}">
    <meta property="og:image" content="${SITE}${ogCard(lang)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${esc(ui.prerender.ogAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">${JSON.stringify(jsonLd(kind, entity, lang, url, title, desc, name || title, crumbs))}</script>`

  // The page's own content as the main landmark (B7), between the site's nav and its foot.
  body = pageNav(lang, altPaths) + `<div class="pr-page"><main>${body}</main>${pageFoot(lang)}</div>`
  let html = template
    .replace('<html lang="en">', `<html lang="${lang}">`)
    .replace('<title>webapp</title>', head.trim())
    .replace('<div id="root"></div>',
      `<div id="prerender">${body}</div>\n    <div id="root"></div>`)

  writeHtml(p, html)
  return thin ? null : p
}

// --- run --------------------------------------------------------------------
const urls = []
// The ellipsis is a character too. Cutting at n and then appending it produced strings
// of exactly n+1, which is how 64 descriptions landed at 161 against a cap of 160. The
// budget is now on the RESULT, which is the only length anybody cares about.
const trim = (s, n = 155) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  const room = n - 1
  const cut = t.lastIndexOf(' ', room)
  return t.slice(0, cut > 0 ? cut : room).trimEnd() + '…'
}

// --- titles and meta descriptions -------------------------------------------
// Budgets shared with scripts/qa-seo.mjs, which fails the build if anything here breaks
// them. Kept as numbers in both places rather than imported: the checker has to be able
// to disagree with the generator, or it is only checking that the code equals itself.
const TITLE_MAX = 65
const DESC_MIN = 70
const DESC_MAX = 160

// Some entity names carry a parenthetical of examples: "Passive/natural ventilation
// strategy (cross-ventilation, stack effect, ...)". That gloss earns its place on the
// page, where it is the h1 and the reader has room for it. In a <title> it is the reason
// 99 pages ran past 65 characters and got truncated mid-word by the search engine anyway.
const bareStrip = (name) => String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

// ...UNLESS the parenthetical is the only thing telling two entities apart. The catalogue
// deliberately lists one physical thing under two functions and names the facet in
// brackets: "Household anaerobic biodigester (biogas + digestate)" and "(biogas cooking
// fuel)" are two pages. Stripping both produced ONE title for both, which is how a
// tidying rule turned into a duplicate-title defect. So a bracket that disambiguates is
// kept, and only a bracket that merely illustrates is dropped. Computed from the data
// rather than listed by hand, so a future pair is covered without anyone remembering.
const AMBIGUOUS = (() => {
  const byBare = new Map()
  const note = (n) => {
    const k = bareStrip(n)
    if (!k) return
    if (!byBare.has(k)) byBare.set(k, new Set())
    byBare.get(k).add(String(n).trim())
  }
  for (const list of [cat.functions, cat.subfunctions, cat.solutions, cat.io_types]) {
    for (const e of list) { note(e.name); if (e.fr && e.fr.name) note(e.fr.name) }
  }
  return new Set([...byBare].filter(([, v]) => v.size > 1).map(([k]) => k))
})()

const stripGloss = (name) => {
  const bare = bareStrip(name)
  return AMBIGUOUS.has(bare) ? String(name || '').trim() : bare
}

const clampWords = (s, n) => {
  if (s.length <= n) return s
  const room = n - 1                       // leave space for the ellipsis
  const cut = s.lastIndexOf(' ', room)
  return s.slice(0, cut > room * 0.6 ? cut : room).trim() + '…'
}

// `parent` is passed for sub-functions and nothing else. It is what stops two different
// pages sharing one title: greywater Collection and blackwater Collection were both
// "Collection · Lowtech Graph", while their URLs had always been distinct. The parent is
// context, so when something has to give it is shortened before the name is.
function pageTitle(name, parent) {
  const suffix = ` · ${ui.app.name}`
  const room = TITLE_MAX - suffix.length
  const full = String(name || '').trim()
  const bare = bareStrip(full)
  // A kept disambiguator must survive the length clamp, or the clamp re-creates exactly
  // the duplicate the disambiguator existed to prevent. So the STEM is shortened around
  // it rather than the whole string being cut from the right.
  const gloss = AMBIGUOUS.has(bare) && full.length > bare.length ? full.slice(bare.length).trim() : ''
  let head = gloss ? full : bare
  if (head.length > room) {
    head = gloss
      ? `${clampWords(bare, Math.max(room - gloss.length - 1, 12))} ${gloss}`
      : clampWords(bare, room)
  }
  if (!parent) return head + suffix
  // Truncating BOTH halves produced titles like
  // "Everyday connectivit… · Connectivity & communicat… · Lowtech Graph", which reads as
  // broken rather than abbreviated. So only the context is ever shortened, and when there
  // is no room to shorten it usefully the context is dropped instead of mangled.
  const left = room - head.length - 3
  if (head.length <= room && left >= 12) {
    return `${head} · ${clampWords(stripGloss(parent), left)}${suffix}`
  }
  return clampWords(head, room) + suffix
}

// A description falls back to a TEMPLATE, never to the bare name.
//
// The bare name was the old fallback and it failed twice over: too short to tell a
// searcher anything, and not unique, because a sub-function name is only unique within
// its parent. Everything the templates interpolate is read from the catalogue, so each
// one is factual and distinct. See the note in ui-strings.js: this is a floor for the
// pages whose Description column is still empty, not a substitute for writing them.
function metaDesc(kind, entity, lang, own) {
  const have = trim(own || '', DESC_MAX)
  if (have.length >= DESC_MIN) return have
  const P = ui.prerender
  const name = tName(entity, lang)
  // One is one. A budget check can tell you a sentence is 144 characters long and never
  // that it says "1 catalogued options"; a reader notices that immediately.
  const plural = (n, one, many) => (Math.abs(n) === 1 ? one : many)
  let extra = ''
  if (kind === 'function') {
    const subs = cat.subfunctions.filter((s) => s.function_id === entity.id).length
    const count = cat.solutions.filter((s) => s.function_id === entity.id).length
    extra = fill(P.descFunction, {
      name, subs, count,
      wordSub: plural(subs, P.wordSubOne, P.wordSubMany),
      wordOption: plural(count, P.wordOptionOne, P.wordOptionMany),
    })
  } else if (kind === 'subfunction') {
    const count = cat.solutions.filter((s) => s.subfunction_id === entity.id).length
    extra = fill(P.descSubfunction, {
      name, count,
      parent: tName(fnById[entity.function_id], lang),
      wordOption: plural(count, P.wordOptionOne, P.wordOptionMany),
    })
  } else if (kind === 'io') {
    const produced = cat.solutions.filter((s) => (s.outputs || []).some((x) => x.io === entity.id)).length
    const consumed = cat.solutions.filter((s) => (s.inputs || []).some((x) => x.io === entity.id)).length
    extra = fill(P.descIo, {
      name, produced, consumed,
      wordProduced: plural(produced, P.wordSolutionOne, P.wordSolutionMany),
    })
  } else if (kind === 'solution') {
    extra = fill(P.descSolution, {
      parent: tName(subById[entity.subfunction_id], lang),
      grandparent: tName(fnById[entity.function_id], lang),
    })
  }
  // Join with a full stop, not a space. Where the entity has its own short summary the
  // two sentences ran together: "Untreated precipitation runoff Which parts of a home..."
  const joiner = !have ? '' : /[.!?…]$/.test(have) ? ' ' : '. '
  return trim(`${have}${joiner}${extra}`.trim(), DESC_MAX)
}

for (const lang of LANGS) {
  setUiLang(lang)
  const altsFor = (kind, e) =>
    Object.fromEntries(LANGS.map((l) => [l, pathOf(kind, e, l)]))

  urls.push(writePage({
    kind: 'home', entity: null, lang, body: homeBody(lang),
    // The site's most searched page gets its descriptive title, not the bare name (2026-09-25).
    title: ui.prerender.rootTitle, name: ui.app.name, desc: trim(ui.prerender.descHome, DESC_MAX),
    altPaths: Object.fromEntries(LANGS.map((l) => [l, segPath(l)])), xDefault: '/',
  }))

  urls.push(writePage({
    kind: 'resources', entity: null, lang, body: resourcesBody(lang),
    title: pageTitle(ui.resourcePage.indexTitle), name: ui.resourcePage.indexTitle,
    desc: trim(ui.resourcePage.indexIntro),
    crumbs: [{ name: ui.app.name, path: segPath(lang) },
             { name: ui.resourcePage.crumb, path: pathOf('resources', null, lang) }],
    altPaths: Object.fromEntries(LANGS.map((l) => [l, pathOf('resources', null, l)])),
  }))

  urls.push(writePage({
    kind: 'needs', entity: null, lang, body: needsBody(lang),
    title: pageTitle(ui.needs.title), name: ui.needs.title,
    desc: trim(ui.needs.intro),
    crumbs: [{ name: ui.app.name, path: segPath(lang) },
             { name: ui.needs.title, path: pathOf('needs', null, lang) }],
    altPaths: Object.fromEntries(LANGS.map((l) => [l, pathOf('needs', null, l)])),
  }))

  for (const g of guides) {
    const t = g[lang] || g.en || {}
    urls.push(writePage({
      kind: 'guide', entity: g, lang, body: guideBody(g, lang),
      title: pageTitle(t.title), name: t.title, desc: trim(t.intro || '', DESC_MAX),
      crumbs: [{ name: ui.app.name, path: segPath(lang) },
               { name: ui.app.navGuides, path: pathOf('guides', null, lang) },
               { name: t.title, path: pathOf('guide', g, lang) }],
      altPaths: Object.fromEntries(LANGS.map((l) => [l, pathOf('guide', g, l)])),
    }))
  }

  urls.push(writePage({
    kind: 'guides', entity: null, lang, body: guidesBody(lang),
    title: pageTitle(ui.guides.title), name: ui.guides.title,
    desc: trim(ui.guides.intro, DESC_MAX),
    crumbs: [{ name: ui.app.name, path: segPath(lang) },
             { name: ui.guides.title, path: pathOf('guides', null, lang) }],
    altPaths: Object.fromEntries(LANGS.map((l) => [l, pathOf('guides', null, l)])),
  }))

  urls.push(writePage({
    kind: 'why', entity: null, lang, body: whyBody(lang),
    title: pageTitle(ui.why.heading), name: ui.why.heading,
    desc: trim(ui.why.lede),
    crumbs: [{ name: ui.app.name, path: segPath(lang) },
             { name: ui.why.heading, path: pathOf('why', null, lang) }],
    altPaths: Object.fromEntries(LANGS.map((l) => [l, pathOf('why', null, l)])),
  }))

  urls.push(writePage({
    kind: 'about', entity: null, lang, body: aboutBody(lang),
    title: pageTitle(ui.about.heading), name: ui.about.heading,
    desc: trim(ui.about.desc, DESC_MAX),
    crumbs: [{ name: ui.app.name, path: segPath(lang) },
             { name: ui.about.heading, path: pathOf('about', null, lang) }],
    altPaths: Object.fromEntries(LANGS.map((l) => [l, pathOf('about', null, l)])),
  }))

  urls.push(writePage({
    kind: 'people', entity: null, lang, body: peopleBody(lang),
    title: pageTitle(ui.people.heading), name: ui.people.heading,
    desc: trim(ui.people.desc, DESC_MAX),
    crumbs: [{ name: ui.app.name, path: segPath(lang) },
             { name: ui.people.heading, path: pathOf('people', null, lang) }],
    altPaths: Object.fromEntries(LANGS.map((l) => [l, pathOf('people', null, l)])),
  }))

  urls.push(writePage({
    kind: 'legal', entity: null, lang, body: legalBody(),
    title: pageTitle(ui.legal.heading), name: ui.legal.heading,
    desc: trim(ui.legal.desc, DESC_MAX),
    crumbs: [{ name: ui.app.name, path: segPath(lang) },
             { name: ui.legal.heading, path: pathOf('legal', null, lang) }],
    altPaths: Object.fromEntries(LANGS.map((l) => [l, pathOf('legal', null, l)])),
  }))

  for (const f of cat.functions) {
    urls.push(writePage({ kind: 'function', entity: f, lang, body: functionBody(f, lang),
      title: pageTitle(tLong(f, lang)), name: tName(f, lang),
      crumbs: [...crumbHead(lang), { name: tName(f, lang), path: pathOf('function', f, lang) }],
      desc: metaDesc('function', f, lang, tSummary(f, lang)), altPaths: altsFor('function', f) }))
  }
  for (const s of cat.subfunctions) {
    urls.push(writePage({ kind: 'subfunction', entity: s, lang, body: subfunctionBody(s, lang),
      title: pageTitle(tLong(s, lang), tLong(fnById[s.function_id], lang)), name: tName(s, lang),
      crumbs: [...crumbHead(lang),
               { name: tName(fnById[s.function_id], lang), path: pathOf('function', fnById[s.function_id], lang) },
               { name: tName(s, lang), path: pathOf('subfunction', s, lang) }],
      desc: metaDesc('subfunction', s, lang, tSummary(s, lang)), altPaths: altsFor('subfunction', s) }))
  }
  for (const s of cat.solutions) {
    urls.push(writePage({ kind: 'solution', entity: s, lang, body: solutionBody(s, lang),
      title: pageTitle(tName(s, lang)), name: tName(s, lang),
      crumbs: [...crumbHead(lang),
               { name: tName(fnById[s.function_id], lang), path: pathOf('function', fnById[s.function_id], lang) },
               { name: tName(subById[s.subfunction_id], lang), path: pathOf('subfunction', subById[s.subfunction_id], lang) },
               { name: tName(s, lang), path: pathOf('solution', s, lang) }],
      desc: metaDesc('solution', s, lang, tSummary(s, lang)), altPaths: altsFor('solution', s) }))
  }
  for (const e of cat.io_types) {
    urls.push(writePage({ kind: 'io', entity: e, lang, body: ioBody(e, lang),
      title: pageTitle(tName(e, lang)), name: tName(e, lang),
      crumbs: [{ name: ui.app.name, path: segPath(lang) },
               { name: ui.resourcePage.crumb, path: pathOf('resources', null, lang) },
               { name: ui.resourcePage.groups[groupOf(e)], path: pathOf('resources', null, lang) + '#' + groupOf(e) },
               { name: tName(e, lang), path: pathOf('io', e, lang) }],
      desc: metaDesc('io', e, lang, tSummary(e, lang)), altPaths: altsFor('io', e) }))
  }

  // App-only routes (tree / settings / search). They have no indexable content -- a
  // canvas builder and a settings panel are nothing to a crawler -- but they still need
  // a FILE at their path. Without one they fall through to the catch-all rewrite, which
  // is what makes every unmatched URL answer HTTP 200. Emitting real shells here is what
  // lets that catch-all be removed, so a genuinely bad URL can return a real 404.
  // writePage's return is discarded: these must never reach the sitemap.
  // Keyed by SEG name so the OTHER language's segment can be looked up for hreflang.
  // The labels used to fall back to `ui.app.name` when a route had no title of its own,
  // and two of the three had none, so the title came out "Lowtech Graph · Lowtech Graph"
  // on four pages. They have real names now.
  for (const [segKey, label] of [['tree', ui.prerender.routeTree],
                                 ['settings', ui.settings.heading],
                                 ['search', ui.prerender.routeSearch]]) {
    const seg = SEG[lang][segKey]
    const p = segPath(lang, seg)
    // These are noindex, and they STILL need hreflang. Both language versions exist, a
    // reader can land on either from a shared link, and Google uses the alternate cluster
    // to serve the right one; noindex says "do not list this page", not "do not know what
    // it is". Six pages were missing it, caught by qa-seo.mjs.
    const altSegs = Object.fromEntries(LANGS.map((l) => {
      const s = l === lang ? seg : SEG[l][segKey]
      return [l, segPath(l, s)]
    }))
    const head = `<title>${esc(pageTitle(label))}</title>`
      + `<meta name="robots" content="noindex,follow">`
      + `<link rel="canonical" href="${esc(SITE + p)}">`
      + LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(SITE + altSegs[l])}">`).join('')
      + `<link rel="alternate" hreflang="x-default" href="${esc(SITE + altSegs.fr)}">`
    // The builder's page without JavaScript (B7): what it is, in one sentence, and three ways
    // on, rather than an empty shell.
    const body = segKey === 'tree'
      ? `<main><h1>${esc(label)}</h1><p>${esc(ui.prerender.treeBody)}</p><p>${[
        link(pathOf('needs', null, lang), ui.app.navBrowse),
        link(pathOf('guides', null, lang), ui.app.navGuides),
        link(pathOf('about', null, lang), ui.app.navAbout)].join(' · ')}</p></main>`
      : ''
    const html = template
      .replace('<html lang="en">', `<html lang="${lang}">`)
      .replace('<title>webapp</title>', head)
      .replace('<div id="root"></div>', body ? `<div id="prerender">${body}</div>
    <div id="root"></div>` : '<div id="root"></div>')
    writeHtml(p, html)
  }
}

// A REAL 404. Cloudflare Pages serves dist/404.html with a 404 status for any path that
// matches no file -- which is the correct answer for a bad URL, and strictly better than
// the previous catch-all rewrite that answered 200 for everything (a "soft 404", which
// search engines treat as a quality problem). Every legitimate route now has a file, so
// anything reaching here really is missing.
{
  const block = (lang) => {
    setUiLang(lang)
    const N = ui.notFound
    return `<section lang="${lang}"><h1>${esc(N.heading)}</h1><p>${esc(N.body)}</p>`
      + `<form role="search" action="${segPath(lang, SEG[lang].search)}" method="get">`
      + `<label for="nf-q-${lang}">${esc(N.searchLabel)}</label> `
      + `<input id="nf-q-${lang}" type="search" name="q" enterkeyhint="search" autocapitalize="off" autocorrect="off" spellcheck="false"> `
      + `<button type="submit">${esc(N.searchButton)}</button></form>`
      + `<p><a href="${segPath(lang)}">${esc(N.homeButton)}</a></p></section>`
  }
  // French first (most readers), then English, each in its own language (B8).
  const bodyBoth = block('fr') + block('en')
  setUiLang('fr')
  const head = `<title>${esc(ui.notFound.heading)} · Page not found · ${esc(ui.app.name)}</title>`
    + `<meta name="robots" content="noindex">`
  // segPath, not a hand-written "/fr/". The trailing slash is the one thing this codebase
  // goes out of its way to avoid: the host 301s /foo/ to /foo, so these two links sent
  // everybody arriving at a bad URL through a redirect before they got home. Found by
  // qa-build.mjs, which resolves every internal link against the files actually written.
  const body = bodyBoth
  fs.writeFileSync(path.join(DIST, '404.html'), template
    .replace('<title>webapp</title>', head)
    .replace('<div id="root"></div>', `<div id="prerender">${body}</div>
    <div id="root"></div>`))
}

// THE ROOT DOCUMENT. Until now dist/index.html was Vite's raw shell, still carrying the
// scaffold title "webapp": the first thing a person saw in their tab, and the first thing
// a crawler or a chat app read, on the one URL everybody actually types and pastes.
//
// It gets a real head rather than real content, because it has none of its own. The app
// reads the browser's language preference and rewrites "/" to "/en" or "/fr" immediately,
// so this is a language selector. That makes it:
//   * noindex,follow   the two language homes are the indexable pages; indexing this as
//                      well would put a third near-duplicate of the same content in.
//   * x-default itself, with alternates to both languages, which is exactly what a
//     language-selector page is for in the hreflang spec.
//   * fully Open Graph tagged anyway. Sharing "lowtechgraph.org" in a chat is the single
//     most likely way this URL is used, and noindex has nothing to do with link previews.
// The visible body is two links, so a reader with JavaScript off is not stranded.
{
  setUiLang('en')
  const P = ui.prerender
  const rootHead = `
    <title>${esc(P.rootTitle)}</title>
    <meta name="description" content="${esc(trim(P.descHome, DESC_MAX))}">
    <meta name="robots" content="noindex,follow">
    <link rel="canonical" href="${SITE}/">
    ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${segPath(l)}">`).join('\n    ')}
    <link rel="alternate" hreflang="x-default" href="${SITE}/">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${esc(ui.app.name)}">
    <meta property="og:description" content="${esc(trim(P.descHome, DESC_MAX))}">
    <meta property="og:url" content="${SITE}/">
    <meta property="og:site_name" content="${esc(ui.app.name)}">
    <meta property="og:image" content="${SITE}${OG_CARD}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${esc(ui.app.name)}">
    <meta name="twitter:card" content="summary_large_image">`
  const rootBody = `<h1>${esc(ui.app.name)}</h1>`
    + `<p>${esc(P.rootChoose)}</p>`
    + `<ul><li><a href="${segPath('en')}">English</a></li>`
    + `<li><a href="${segPath('fr')}">Français</a></li></ul>`
  fs.writeFileSync(path.join(DIST, 'index.html'), template
    .replace('<title>webapp</title>', rootHead.trim())
    .replace('<div id="root"></div>',
      `<div id="prerender">${rootBody}</div>\n    <div id="root"></div>`))
}

// sitemap + robots
const indexable = urls.filter(Boolean)
const NL = String.fromCharCode(10)   // avoids an escape inside the template literal
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join(NL)}
</urlset>
`
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap)

// The interactive-only routes have no static page and nothing to index; the SPA
// fallback would serve them the shell, which is thin-content noise in an index.
const disallow = LANGS.flatMap((l) => [SEG[l].tree, SEG[l].settings, SEG[l].search]
  .map((s) => `Disallow: ${segPath(l, s)}`))
// Content-Signal (Cloudflare's Content Signals Policy, contentsignals.org): how crawlers may use
// what they fetch. All three are yes (Eric, 2026-09-25: the point is to spread the knowledge, so
// search indexing, answering from it, and training are all welcome). Written here rather than
// by Cloudflare's managed robots.txt, so this file stays the one source of truth.
const signals = '# Content signals: search = index and link; ai-input = use in AI answers;\n'
  + '# ai-train = train or fine-tune models. The catalogue is CC BY-SA 4.0: attribute and share alike.\n'
  + 'Content-Signal: search=yes, ai-input=yes, ai-train=yes\n'
fs.writeFileSync(path.join(DIST, 'robots.txt'),
  `User-agent: *\n${signals}${disallow.join('\n')}\nSitemap: ${SITE}/sitemap.xml\n`)

// The dataset itself, at a stable URL. Bulk consumers should take this rather than
// scrape every page, and the AI statement points them here.
fs.copyFileSync(path.join(ROOT, 'src/data/catalogue.json'), path.join(DIST, 'catalogue.json'))

// llms.txt and llms-full.txt: see scripts/llms.mjs for what they say and why.
const { llms, full: llmsFull } = buildLlms({ cat, ui, fill, COUNTS, SITE, pathOf, tName, tSummary, info, setUiLang })
fs.writeFileSync(path.join(DIST, 'llms.txt'), llms)
fs.writeFileSync(path.join(DIST, 'llms-full.txt'), llmsFull)

console.log(`prerendered ${urls.length} pages (${indexable.length} in sitemap, `
  + `${urls.length - indexable.length} noindex as too thin) + sitemap.xml + robots.txt + llms.txt + llms-full.txt`)
console.log(`  canonical origin: ${SITE}`)
