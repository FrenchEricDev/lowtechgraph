import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore, lazy, Suspense } from 'react'
import Glyph, { ResourceMark } from './Glyph.jsx'
import * as cat from './catalogue'
import { search } from './search'
import { shareLink, copyText, prefersShareSheet, sendFeedback, FEEDBACK_EMAIL } from './platform'
import { subscribeTree, placedSolutionCount, placedSolutionIds, isPlaced } from './treeStore'
// The builder, its graph library and the system check load on demand (2026-09-25): most
// visits never open it, and search crawlers were fetching all of it with every page.
const TreeBuilder = lazy(() => import('./TreeBuilder'))
import { ui, fill, setUiLang } from './ui-strings'
import { parsePath, pathFor, urlFor, preferredLang } from './router'
import Nav from './Nav'
import { TutorialRow } from './Tutorials.jsx'
import useDialog from './useDialog'
// The drawings (a fifth of the code) load on demand too, and are fetched while the browser is
// idle after the first page, so they are normally there before anyone scrolls to them.
const loadPlate = () => import('./illustrations/Plate.jsx')
const loadGuideHouse = () => import('./illustrations/GuideHouse.jsx')
const SolutionPlate = lazy(loadPlate)
// The three solutions with no drawing. Everywhere else the drawing's room is kept while its code
// loads, or the page jumped by its height (589 px on a desktop) a moment after first paint.
// A stale entry costs only that jump on one page.
const NO_PLATE = new Set(['SOL-042', 'SOL-105', 'SOL-138'])
const GuideHouse = lazy(loadGuideHouse)
const HouseCarousel = lazy(() => loadGuideHouse().then((m) => ({ default: m.HouseCarousel })))
const SubDrawing = lazy(() => loadGuideHouse().then((m) => ({ default: m.SubDrawing })))
const GuideThumb = lazy(() => loadGuideHouse().then((m) => ({ default: m.GuideThumb })))
// Why's drawings (brief 11, C): the plates, loaded with the page that needs them.
const WhyBubble = lazy(() => import('./illustrations/WhyBubble.jsx'))
if (typeof window !== 'undefined') {
  const warm = () => { loadPlate(); loadGuideHouse() }
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 4000 })
  else setTimeout(warm, 2000)
}
import NeedIcon from './illustrations/NeedIcon.jsx'
import FacetBar, { activeCountOf, FilterLine, EmptyByFilters, FiltersHost, filterNames } from './FacetBar.jsx'
import Comparison, { CompareTable, CompareRows, AspectSwitch } from './Comparison.jsx'
import { AddButton, AddPlus, AddToast, IoChip, ConnectBar, ConnectButton, keepConnectingOn,
         useConnecting, candidatesOf } from './AddToTree.jsx'
import { guide, guideIds } from './content'
import { applyUpdateIfPending } from './sw-update'
import buildInfo from './data/build-info.json'
import { siteCounts, ABOUT_STEPS, ABOUT_DIFFS } from './siteCounts'
import PathArt from './illustrations/PathArt.jsx'
import BuilderTour from './BuilderTour.jsx'
import PeopleView, { topicOfNeed, PEOPLE, entryMeta, WhereToFindHelp } from './People.jsx'
import './App.css'
import { calm } from './motion.js'
import { loadLanguage, languageReady } from './language.js'

// All user-facing wording lives in ui-strings.js. The en. Tipeee host serves an English payment
// page to French readers too.
const TIPEEE_URL = 'https://en.tipeee.com/lowtechgraphorg/'

// Replaced at build time by vite.config.js (date and short sha, + on a dirty tree).
// No referrer counts as outside: a link opened from a messaging app or typed in has none
// (cross-check 15).
const ARRIVED_FROM_OUTSIDE = (() => {
  try { return !document.referrer || new URL(document.referrer).origin !== window.location.origin }
  catch { return true }
})()
const BUILD_STAMP = typeof __BUILD_STAMP__ === 'string' ? __BUILD_STAMP__ : 'dev'

// A reload starts at the top of the page. Set at module scope, because the browser restores
// after load, possibly after React has mounted. Handed straight back: `scrollRestoration`
// belongs to the document, and leaving it 'manual' breaks every later Back.
if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
  history.scrollRestoration = 'manual'
  // A timer, not requestAnimationFrame, which never fires in a background tab.
  const handBack = () => setTimeout(() => { history.scrollRestoration = 'auto' }, 0)
  if (document.readyState === 'complete') handBack()
  else addEventListener('load', handBack, { once: true })
}

export default function App() {
  // The URL is the source of truth for the view and the language (router.js).
  const [{ lang, route }, setNav] = useState(() => {
    const parsed = parsePath()
    // Bare / has no language: pick one and replace the URL, so Back does not land here.
    if (!parsed.lang) {
      const l = preferredLang()
      window.history.replaceState({ depth: 0 }, '', pathFor(parsed.route, l))
      return { lang: l, route: parsed.route }
    }
    // Sent here by the CDN with l=auto: the host cannot branch on Accept-Language, so the root
    // lands on French and the app corrects it. A /fr link without the marker stays French. The
    // parameter is stripped so a reload never re-runs this.
    if (new URLSearchParams(window.location.search).get('l') === 'auto') {
      const l = preferredLang()
      window.history.replaceState({ depth: 0 }, '', pathFor(parsed.route, l))
      return { lang: l, route: parsed.route }
    }
    if (!window.history.state) window.history.replaceState({ depth: 0 }, '')
    return parsed
  })

  // History depth lives in history.state, so it survives reload and the browser's own back and
  // forward.

  // Set only when the reader picks a language: history entries still carry the old prefix, so
  // Back onto the other language is rewritten to the chosen one. A ref, not storage, so a
  // shared link opens in its own language on a fresh load.
  const chosenLang = useRef(null)

  // A pending deploy is applied on navigation, the natural break a reload wants.
  const go = useCallback((r) => {
    applyUpdateIfPending()
    // The offset is saved on the entry being left: the browser's own restore runs at popstate,
    // before React has redrawn the page, so on a long page it lands short.
    window.history.replaceState({ ...window.history.state, scrollY: window.scrollY }, '')
    setNav((n) => {
      const d = (window.history.state?.depth || 0) + 1
      window.history.pushState({ depth: d }, '', pathFor(r, n.lang))
      return { ...n, route: r }
    })
  }, [])
  const home = useCallback(() => {
    applyUpdateIfPending()
    setNav((n) => {
      window.history.pushState({ depth: 0 }, '', pathFor({ view: 'home' }, n.lang))
      return { ...n, route: { view: 'home' } }
    })
  }, [])

  // Connecting mode (TODO F16) survives only on the pages where it means something.
  useEffect(() => { keepConnectingOn(route) }, [route])

  // A new page starts at the top. Back and forward are excluded (the browser restores their
  // offset), as is the first render.
  const cameFromPop = useRef(false)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (cameFromPop.current) {
      cameFromPop.current = false
      // Runs after the page below has committed, so the rows the offset points at exist.
      const y = window.history.state?.scrollY
      if (typeof y === 'number') window.scrollTo(0, y)
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [route])

  // Browser back/forward, and any external navigation into the app.
  useEffect(() => {
    const onPop = () => {
      cameFromPop.current = true
      const parsed = parsePath()
      if (!parsed.lang) {
        setNav({ lang: preferredLang(), route: { view: 'home' } })
      } else if (chosenLang.current && parsed.lang !== chosenLang.current) {
        const l = chosenLang.current
        window.history.replaceState(window.history.state, '', pathFor(parsed.route, l))
        setNav({ lang: l, route: parsed.route })
      } else {
        setNav(parsed)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Switching language keeps the same entity, in the other language's URL (hreflang reciprocity
  // depends on it).
  // The other language's chunks first (B2), so the switch lands in one render.
  const setLang = useCallback((l) => {
    chosenLang.current = l
    loadLanguage(l).catch(() => {}).finally(() => setNav((n) => {
      window.history.replaceState(window.history.state, '', pathFor(n.route.view === 'tree' ? { view: 'tree' } : n.route, l))
      localStorage.setItem('lang', l)
      return { ...n, lang: l }
    }))
  }, [])
  // Any other way into a language not loaded yet (Back onto the other prefix): load it, then
  // draw again.
  const [, redraw] = useState(0)
  if (!languageReady(lang)) loadLanguage(lang).then(() => redraw((x) => x + 1), () => {})

  // The catalogue filters: one sticky object applied everywhere. Two filters shipped as
  // separate localStorage keys: they are read once and folded in, and left in place so a
  // rollback keeps them.
  const [filters, setFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('filters') || 'null')
      // A skill ceiling that is no longer offered must not survive in storage, or nothing on
      // screen could undo it.
      if (saved && saved.maxSkill === 'None') saved.maxSkill = 'Basic'
      if (saved) return { ...cat.DEFAULT_FILTERS, ...saved }
    } catch { /* fall through to the migration below */ }
    const oldBenchmark = localStorage.getItem('showBenchmark')
    return {
      ...cat.DEFAULT_FILTERS,
      retrofitOnly: localStorage.getItem('hideNewBuild') === 'true',
      lowTechOnly: oldBenchmark === null ? false : oldBenchmark !== 'true',
    }
  })
  useEffect(() => localStorage.setItem('filters', JSON.stringify(filters)), [filters])
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  // Called during render, not in an effect, so the first paint is already in the right
  // language.
  setUiLang(lang)
  cat.setCatalogueLang(lang)
  useEffect(() => { document.documentElement.lang = lang }, [lang])

  // Keep the title and canonical in step with the route: the prerendered HTML is right only on
  // the entry page, and a repeat visit gets the SPA shell from the service worker. Same "<name>
  // · <app>" format as the prerenderer.
  useEffect(() => {
    const entity =
      route.view === 'solution' ? cat.solById[route.id]
      : route.view === 'function' ? cat.fnById[route.id]
      : route.view === 'subfunction' ? cat.subById[route.id]
      : route.view === 'io' ? cat.ioById[route.id]
      : null
    // Non-entity views get a real title too, matching their prerendered HTML.
    const pageName =
      route.view === 'why' ? ui.why.heading
      : route.view === 'about' ? ui.about.heading
      : route.view === 'people' ? ui.people.heading
      : route.view === 'legal' ? ui.legal.heading
      : route.view === 'settings' ? ui.settings.heading
      : route.view === 'notfound' ? ui.notFound.heading
      : route.view === 'needs' ? ui.needs.title
      : route.view === 'resources' ? ui.resourcePage.indexTitle
      : route.view === 'guides' ? ui.guides.title
      : route.view === 'guide' ? ((guide(route.id, lang) || {}).title || ui.guides.title)
      : route.view === 'tree' ? ui.app.navBuild
      : route.view === 'search' ? `“${route.q || ''}”`
      : ''
    // The full name in the tab, as the static page's title: it holds the words people search for.
    const name = entity ? cat.tLong(entity) : pageName
    document.title = name ? `${name} · ${ui.app.name}` : ui.prerender.rootTitle

    let link = document.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = window.location.origin + pathFor(route, lang)
    setPageSaid(document.title)
  }, [route, lang])

  // A new page for a keyboard or a screen reader: focus goes to the page's content (so the next
  // Tab is its first link, not the logo) and the title is announced. Not on the first render,
  // where the browser has already done both.
  const mainRef = useRef(null)
  const [pageSaid, setPageSaid] = useState('')
  const skip = (e) => { e.preventDefault(); mainRef.current?.focus({ preventScroll: true }) }

  // Theme: 'auto' stamps nothing on <html> so prefers-color-scheme decides; 'light' or 'dark'
  // stamp data-theme, which wins either way.
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'auto')
  useEffect(() => {
    localStorage.setItem('theme', theme)
    const el = document.documentElement
    if (theme === 'auto') el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', theme)
    // A chosen theme wins over the device's for the phone's bar too.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      const own = m.media.includes('dark') ? '#221F19' : '#4F6247'
      m.content = theme === 'auto' ? own : theme === 'dark' ? '#221F19' : '#4F6247'
    })
  }, [theme])


  const filtersActive = cat.anyFilterActive(filters)
  // The site's one line shows on the page a reader arrives on from outside, and only there.
  const firstRouteKey = useRef(route.view + '|' + (route.id || '') + '|' + (route.q || ''))
  const landing = ARRIVED_FROM_OUTSIDE
    && firstRouteKey.current === route.view + '|' + (route.id || '') + '|' + (route.q || '')
  const ctx = { go, lang, filters, setFilter, landing }

  /*
   * Settings is a panel over the page, not a page to leave (Eric, 2026-10-18; brief 10). The gear,
   * or Settings in the phone menu, opens it; the gear again, its close button, Escape and a tap
   * outside close it, and the reader is where they were. /settings still works as an address: it
   * opens the same panel over the home page, and closing it goes home.
   */
  const [settingsOpen, setSettingsOpen] = useState(route.view === 'settings')
  useEffect(() => { if (route.view === 'settings') setSettingsOpen(true) }, [route.view])
  // Following a link from inside the panel (About) closes it. A language switch keeps the route.
  const routeKey = route.view + '|' + (route.id || '') + '|' + (route.q || '')
  const lastRoute = useRef(routeKey)
  useEffect(() => {
    if (lastRoute.current !== routeKey && route.view !== 'settings') setSettingsOpen(false)
    lastRoute.current = routeKey
  }, [routeKey, route.view])
  // Closing plays the exit for --dur-fast before the panel goes (brief 10, 13): a timer, not
  // animationend, so a skipped animation can never leave it on screen.
  const [settingsLeaving, setSettingsLeaving] = useState(false)
  const leaveTimer = useRef(null)
  const closeSettings = useCallback(() => {
    if (route.view === 'settings') home()
    if (calm()) { setSettingsOpen(false); return }
    setSettingsLeaving(true)
    clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => { setSettingsOpen(false); setSettingsLeaving(false) }, 150)
  }, [route.view, home])
  useEffect(() => () => clearTimeout(leaveTimer.current), [])
  const toggleSettings = useCallback(() => {
    if (settingsOpen && !settingsLeaving) closeSettings()
    else {
      clearTimeout(leaveTimer.current); setSettingsLeaving(false)
      window.dispatchEvent(new Event('lowtech:panel')); setSettingsOpen(true)
    }
  }, [settingsOpen, settingsLeaving, closeSettings])

  return (
    // The tree fills the window exactly and never scrolls; sized here because a child cannot
    // know what the shell puts around it.
    <div className={`app${route.view === 'tree' ? ' app--fullbleed' : ''}`}>
      <a className="skip-link" href="#main" onClick={skip}>{ui.app.skipToContent}</a>
      <div className="sr-only" role="status" aria-live="polite">{pageSaid}</div>
      <Header home={home} go={go} lang={lang}
              setLang={setLang} route={route} filters={filters}
              filtersActive={filtersActive}
              settingsOpen={settingsOpen} toggleSettings={toggleSettings} />
      {/* Under the bar, not inside a view: it follows the reader across two or three pages. */}
      <ConnectBar route={route} go={go} />
      <InstallLine route={route} />
      <main className="main" id="main" tabIndex={-1} ref={mainRef}>
        {route.view === 'notfound' && <NotFound home={home} go={go} />}
        {(route.view === 'home' || route.view === 'settings') && <Home {...ctx} />}
        {route.view === 'why' && <WhyView {...ctx} />}
        {route.view === 'about' && <AboutView {...ctx} />}
        {route.view === 'people' && <PeopleView {...ctx} route={route} lang={lang} Crumbs={Crumbs} homeCrumb={homeCrumb} />}
        {route.view === 'legal' && <LegalView {...ctx} />}
        {route.view === 'needs' && <NeedsView {...ctx} />}
        {route.view === 'resources' && <ResourcesView {...ctx} />}
        {route.view === 'guides' && <GuidesView {...ctx} />}
        {route.view === 'guide' && <GuideView id={route.id} {...ctx} />}
        {route.view === 'function' && <FunctionView id={route.id} {...ctx} />}
        {route.view === 'subfunction' && <SubfunctionView id={route.id} {...ctx} />}
        {route.view === 'solution' && <SolutionView id={route.id} {...ctx} />}
        {route.view === 'io' && <IoView id={route.id} {...ctx} />}
        {route.view === 'search' && <SearchView q={route.q} {...ctx} />}
        {route.view === 'tree' && (
          <Suspense fallback={
            // The builder's own frame while it loads (Mo-F5): the bar's strip and an empty
            // canvas, so the page keeps its shape; the word only after 400 ms.
            <div className="tree-root tree-loading"><div className="tree-toolbar" /><div className="tree-canvas"><p className="tree-loading-word">{ui.app.loading}</p></div></div>
          }>
            <TreeBuilder filters={filters} setFilter={setFilter} go={go} lang={lang} seed={route.add} />
          </Suspense>
        )}
      </main>
      {/* The footer stays on the tree route, compacted: its CC BY-SA line is the attribution for the catalogue content the canvas shows. */}
      <SiteFooter go={go} compact={route.view === 'tree'} />
      {settingsOpen && (
        <SettingsPanel go={go} route={route} onClose={closeSettings} leaving={settingsLeaving}
                       filters={filters} setFilter={setFilter}
                       lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
      )}
      {/* Not on the builder, where nothing is added from outside the canvas. */}
      {route.view !== 'tree' && <AddToast go={go} />}
      <FiltersHost filters={filters} setFilter={setFilter} />
    </div>
  )
}


/*
 * Why a row has no tutorial, when it is not that none has been found. The suggest-a-link prompt
 * is withheld for all three keys; an unknown key falls through to the ordinary empty state.
 */
const TUTORIAL_STATUS_STRING = {
  'not-diy': 'tutorialsNotDiy',
  trade: 'tutorialsTrade',
  'no-build': 'tutorialsNoBuild',
}
const tutorialStatusText = (ui, status) =>
  (status && ui.solutionPage[TUTORIAL_STATUS_STRING[status]]) || null

/*
 * A count on the corner of a header control: active filters on the gear and the menu button,
 * solutions placed on Build. Decorative, because every control carrying one also states the
 * fact in its name or beside it. Keyed on the number, so a change replays the pop.
 */
function Badge({ n }) {
  if (!n) return null
  return <span key={n} className="nav-badge" aria-hidden="true">{n > 99 ? '99+' : n}</span>
}

/*
 * The top bar: logo left, search centred, language and settings right. A 1fr/auto/1fr grid, so
 * the search sits on the bar's centre line whatever the sides measure.
 *
 * Must not drift: the language control stays a real <a href> to the alternate URL
 * (middle-click, copy link, hreflang); the bar's height stays --header-h, which the desktop
 * rail's sticky offset derives from.
 */
function Header({ home, go, lang, setLang, route, filters, filtersActive, settingsOpen, toggleSettings }) {
  const other = lang === 'fr' ? 'en' : 'fr'
  const filterCount = activeCountOf(filters)
  const placed = useSyncExternalStore(subscribeTree, placedSolutionCount, () => 0)
  // The count joins the link's name, which still starts with the visible label.
  const buildLabel = placed
    ? fill(placed === 1 ? ui.app.navBuildOne : ui.app.navBuildMany, { n: placed })
    : undefined
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const boxRef = useRef(null)
  // The mobile menu closes on route change, Escape and a click outside, so it never covers the
  // page just asked for.
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const menuBtnRef = useRef(null)
  useEffect(() => { setMenuOpen(false) }, [route.view, route.id, lang])
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') { setMenuOpen(false); menuBtnRef.current?.focus() }
    }
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || menuBtnRef.current?.contains(e.target)) return
      setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [menuOpen])

  const query = q.trim()
  const [listHidden, setListHidden] = useState(false)
  const results = open && !listHidden && query.length >= 2 ? search(query) : null
  // On a phone the panel ends above the keyboard and scrolls in itself (brief 07, C).
  const [acMax, setAcMax] = useState(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!open || !vv) return
    const fit = () => {
      const top = boxRef.current?.getBoundingClientRect().bottom || 0
      setAcMax(Math.max(160, vv.height + vv.offsetTop - top - 8))
    }
    fit()
    vv.addEventListener('resize', fit)
    return () => vv.removeEventListener('resize', fit)
  }, [open])
  // Arrow keys move through the field and the suggestions; Tab still works as before.
  const onBoxKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = [...(boxRef.current?.querySelectorAll('input, .ac-item, .ac-all') || [])]
    const i = items.indexOf(document.activeElement)
    if (i < 0) return
    e.preventDefault()
    const next = items[Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
    next?.focus()
  }
  const onBoxBlur = (e) => {
    if (!boxRef.current?.contains(e.relatedTarget)) close()
  }

  const close = useCallback(() => { setOpen(false); setQ('') }, [])
  const pick = (r) => { close(); go(r) }
  const submit = (e) => {
    e.preventDefault()
    if (query) { close(); go({ view: 'search', q: query }) }
  }

  // Any navigation collapses it, including a link followed from the results list.
  useEffect(() => { close() }, [route, close])

  useEffect(() => {
    if (!open) return
    // pointerdown, not click: a close on click would unmount the result being clicked. The
    // dropdown is inside boxRef so it is excluded.
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) close() }
    // Escape hides the suggestions first, then closes the field.
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (results) setListHidden(true)
      else close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close, results])

  return (
    <header className={'header' + (open ? ' is-searching' : '')}>
      <div className="header-left">
        {/* aria-label on the link: below 380px the wordmark is display:none, which also removes it from the accessibility tree. */}
        {/* href/onNavigate rather than route/go: home() resets the history depth, go() does not. */}
        <Nav href={pathFor({ view: 'home' }, lang)} onNavigate={home}
             className="title" aria-label={fill(ui.app.homeButtonLabel, { name: ui.app.name })}>
          <img className="brand-mark" src="/logo-mark.png" alt="" width="154" height="84" />
          <span className="brand-name">{ui.app.name}</span>
        </Nav>

        {/* A real <nav> of real anchors; aria-current marks the page. Hidden below 900px by CSS: the mobile menu carries it. */}
        <nav className="hnav" aria-label={ui.app.navLabel}>
          <Nav route={{ view: 'needs' }} go={go} className="hnav-item"
               aria-current={route.view === 'needs' || route.view === 'resources' ? 'page' : undefined}>
            {ui.app.navBrowse}
          </Nav>
          {/* D10 Q5: read as a path, browse everything or be guided, and gather into your
              system. "Why low-tech" lives in the footer, the homepage and the site line. */}
          <Nav route={{ view: 'guides' }} go={go} className="hnav-item"
               aria-current={route.view === 'guides' || route.view === 'guide' ? 'page' : undefined}>
            {ui.app.navGuides}
          </Nav>
          <Nav route={{ view: 'tree' }} go={go} className="hnav-item has-count"
               aria-current={route.view === 'tree' ? 'page' : undefined} aria-label={buildLabel}>
            {ui.app.navBuild}
            <Badge n={placed} />
          </Nav>
        </nav>
      </div>

      {/* Not on the builder: there it read as a way to put solutions on the canvas, which only
          the Add buttons do. An empty cell keeps the grid's three columns. */}
      {route.view === 'tree' ? <div aria-hidden="true" /> : (
      <div className="hsearch" ref={boxRef} onKeyDown={onBoxKey} onBlur={onBoxBlur}>
        <form className="hsearch-form" onSubmit={submit} autoComplete="off" role="search">
          {/* An inline SVG, not U+2315, which renders as tofu on some phones. */}
          <svg className="hsearch-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6.5" />
            <line x1="15.8" y1="15.8" x2="20.5" y2="20.5" />
          </svg>
          <input value={q} onChange={(e) => { setQ(e.target.value); setListHidden(false) }}
                 onFocus={() => setOpen(true)}
                 type="search" enterKeyHint="search" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                 placeholder={ui.home.searchPlaceholder}
                 aria-label={ui.app.searchOpenLabel} />
          {open && (
            <button type="button" className="hsearch-close" onClick={close}
                    aria-label={ui.app.searchCloseLabel}><Glyph name="close" size={18} /></button>
          )}
        </form>
        {results && (
          <Autocomplete results={results} filters={filters} pick={pick} query={query} maxHeight={acMax} />
        )}
      </div>
      )}

      <div className="header-right">
        {/* The label is the language you would get. */}
        {/* A seed has been placed by now: the other language must not place it again on a reload. */}
        <Nav href={pathFor(route.view === 'tree' ? { view: 'tree' } : route, other)} onNavigate={() => setLang(other)}
             className="icon-btn lang-quick" lang={other} hrefLang={other}
             aria-label={fill(ui.app.switchLanguageLabel, { lang: ui.app['language_' + other] })}>
          {other.toUpperCase()}
        </Nav>
        {/* A stroked SVG on the search glyph's 24 grid, not the emoji gear, whose font the OS picks. Radial strokes stay legible at 17px where a filled gear blurs. */}
        {/* Desktop shows the gear; on mobile the menu button takes its slot. Both are in the DOM and CSS decides, so there is no hydration mismatch. */}
        {/* A button, not a link: it opens a panel over the page. */}
        <button type="button" data-settings-opener
             className="icon-btn is-desktop-only has-badge"
             title={filtersActive ? ui.app.filtersActive : undefined}
             aria-expanded={settingsOpen} aria-controls="settings-panel"
             onClick={toggleSettings}
             aria-label={filtersActive
               ? ui.app.settingsLabel + ' — ' + ui.app.filtersActive
               : ui.app.settingsLabel}>
          <svg className="icon-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="3.4" />
            <path d="M12 3.2v2.6M12 18.2v2.6M3.2 12h2.6M18.2 12h2.6
                     M5.8 5.8l1.85 1.85M16.35 16.35l1.85 1.85
                     M18.2 5.8l-1.85 1.85M7.65 16.35L5.8 18.2" />
          </svg>
          <Badge n={filterCount} />
        </button>
        <button ref={menuBtnRef} type="button" data-settings-opener
                className="icon-btn is-mobile-only has-badge"
                title={filtersActive ? ui.app.filtersActive : undefined}
                aria-label={(menuOpen || settingsOpen ? ui.app.menuClose : ui.app.menuLabel)
                  + (filtersActive ? ' — ' + ui.app.filtersActive : '')}
                aria-expanded={menuOpen || settingsOpen} aria-controls={settingsOpen ? 'settings-panel' : 'hmenu'}
                // With the Settings sheet open, the same button closes it.
                onClick={() => (settingsOpen ? toggleSettings() : setMenuOpen((v) => !v))}>
          <svg className="icon-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {menuOpen || settingsOpen
              ? <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
              : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          <Badge n={filterCount} />
        </button>
      </div>

      {menuOpen && (
        <div className="hmenu" id="hmenu" ref={menuRef}>
          <nav aria-label={ui.app.navLabel}>
            <Nav route={{ view: 'needs' }} go={go} className="hmenu-item"
                 aria-current={route.view === 'needs' ? 'page' : undefined}>
              {ui.app.navBrowse}
            </Nav>
            <Nav route={{ view: 'guides' }} go={go} className="hmenu-item"
                 aria-current={route.view === 'guides' || route.view === 'guide' ? 'page' : undefined}>
              {ui.app.navGuides}
            </Nav>
            <Nav route={{ view: 'tree' }} go={go} className="hmenu-item"
                 aria-current={route.view === 'tree' ? 'page' : undefined} aria-label={buildLabel}>
              {ui.app.navBuild}
              <Badge n={placed} />
            </Nav>
          </nav>
          {/* Settings sits in the mobile menu, after a rule: a preference, not a destination. */}
          <button type="button"
               className={'hmenu-item is-secondary' + (filtersActive ? ' has-note' : '')}
               aria-controls="settings-panel"
               onClick={() => { setMenuOpen(false); toggleSettings() }}>
            {ui.app.settingsLabel}
            <Badge n={filterCount} />
            {/* The dot is decorative; this states the same fact as text. */}
            {filtersActive && <span className="hmenu-note">{ui.app.filtersActive}</span>}
          </button>
        </div>
      )}
    </header>
  )
}

// One breadcrumb for the whole app. The last entry is the current page and is not a link.
function Crumbs({ trail, go }) {
  if (!trail || !trail.length) return null
  return (
    <nav className="crumbs" aria-label={ui.app.breadcrumbLabel}>
      {trail.map((c, i) => (
        <span key={i} className="crumb">
          {i > 0 && <span className="crumb-sep" aria-hidden="true">›</span>}
          {c.route
            ? <Nav route={c.route} go={go} className="link">{c.name}</Nav>  // i18n-ok: crumb names are resolved with tName by the trail builders
            : <span aria-current="page">{c.name}</span>  // i18n-ok: same trail, already resolved
          }
        </span>
      ))}
    </nav>
  )
}

// Trail builders, so the call sites cannot drift apart.
const homeCrumb = () => ({ name: ui.app.homeLabel, route: { view: 'home' } })
/*
 * The catalogue root uses the nav's label ("Solutions"), not the needs page title, which is a
 * sentence.
 */
const needsCrumb = () => ({ name: ui.app.navBrowse, route: { view: 'needs' } })
const guidesCrumb = () => ({ name: ui.app.navGuides, route: { view: 'guides' } })

/*
 * What this site is, in one line, for a reader who has just arrived from outside it (brief 01,
 * Eric 2026-10-18): a search, a shared link, or no referrer at all. Gone once they move to
 * another page. The prerendered page keeps it for crawlers.
 */
function SiteLine({ show }) {
  if (!show) return null
  return <p className="site-line">{ui.app.siteLine}</p>
}
const fnCrumb = (fn, linked) => ({ name: cat.tName(fn), route: linked ? { view: 'function', id: fn.id } : null })
const subCrumb = (sub, linked) => ({ name: cat.tName(sub), route: linked ? { view: 'subfunction', id: sub.id } : null })

function Benchmark() {
  return <span className="benchmark-tag" title={ui.benchmark.tooltip}><Glyph name="gear" size={13} />{ui.benchmark.tag}</span>
}

// Why a solution has no tutorial: not a DIY project, a trade, or nothing to build.
const NOT_BUILT = new Set(['not-diy', 'trade', 'no-build'])

// Badges for what can disqualify a solution outright: whether it needs a supply to run, and
// whether it fits a house that already exists. Tapping reveals the explanation inline, since a
// title attribute never fires on touch.
function SolutionBadges({ sol }) {
  const passive = !(sol.power || '').toLowerCase().includes('active')
  const [open, setOpen] = useState(null)
  const items = [
    passive
      ? { key: 'passive', cls: 'is-passive', label: ui.solutionPage.passive, tip: ui.solutionPage.passiveTip }
      : { key: 'active', cls: 'is-active', mark: 'plug', label: ui.solutionPage.active, tip: ui.solutionPage.activeTip },
    ...(sol.new_build_only
      ? [{ key: 'newbuild', cls: 'is-newbuild', mark: 'newbuild', label: ui.solutionPage.newBuildOnly, tip: ui.solutionPage.newBuildOnlyTip }]
      : []),
    // Shown only when a flat is ruled out, as with the new-build badge: "yes" is the common
    // case. Technical possibility only; permission is in the regulation note.
    ...(sol.flat_feasible === false
      ? [{ key: 'noflat', cls: 'is-noflat', mark: 'house', label: ui.solutionPage.houseOnly,
           // The blocker is a vocabulary key translated here, never a sentence from the
           // workbook.
           tip: ui.solutionPage.flatBlocker[sol.flat_blocker] || ui.solutionPage.houseOnlyTip }]
      : []),
    // A yes that depends on something (a shared roof, an existing flue).
    ...(sol.flat_feasible !== false && sol.flat_blocker
      ? [{ key: 'flatif', cls: 'is-flatif', mark: 'flat', label: ui.solutionPage.flatWithCare,
           tip: ui.solutionPage.flatCondition[sol.flat_blocker] || '' }]
      : []),
  ]
  const shown = items.find((i) => i.key === open)
  return (
    <>
      <span className="badges">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            className={`badge ${i.cls}${open === i.key ? ' is-open' : ''}`}
            aria-expanded={open === i.key}
            onClick={() => setOpen(open === i.key ? null : i.key)}
          >
            {i.mark && <Glyph name={i.mark} size={14} />}{i.label}<span className="badge-q" aria-hidden="true">?</span>
          </button>
        ))}
      </span>
      {shown && <p className="badge-tip muted small" role="status">{shown.tip}</p>}
    </>
  )
}

// A disclosure that says whether it is open (A-A16): a real button with aria-expanded.
function Disclosure({ label, openLabel, children }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={'detail-btn' + (open ? ' is-open' : '')}
              aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{open && openLabel ? openLabel : label}</span>
        <span className="detail-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && children}
    </>
  )
}

// Second-tier facts: needed when comparing closely, noise on a first read.
function MoreDetail({ sol }) {
  const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '')
  // None and blank are different answers for the assessed enums: None is a judgement, blank
  // means not assessed yet, and is shown as such.
  const assessed = (v) => cap(cat.tEnum(v)) || ui.solutionPage.notCollected
  // Lifespan joined these on 2026-09-24 (Eric), when the comparison's trade-offs made the
  // cost / upkeep / skill table above it a repeat: it was the one fact that table added.
  const lifespan = cat.L(sol, 'lifespan')
  // The French rules, one row of the details since 2026-10-21 (Eric): a box of their own
  // repeated the disclosure for one paragraph.
  const rules = cat.L(sol, 'regulation_fr')
  const rows = [
    [ui.solutionPage.factCarbon, assessed(sol.embodied_carbon)],
    [ui.solutionPage.factFootprint, assessed(sol.footprint)],
    [ui.solutionPage.factDispatch, assessed(sol.dispatchability)],
    [ui.solutionPage.factConsumables, assessed(sol.consumables)],
    [ui.solutionPage.factRepairSkill, assessed(sol.repair_skill)],
  ]
  return (
    <Disclosure label={ui.solutionPage.detailsOpen} openLabel={ui.solutionPage.detailsClose}>
      <dl className="facts secondary">
        {/* Free text, so it takes the whole row rather than a narrow column (U-F21). */}
        {lifespan && (
          <div className="fact wide"><dt>{ui.solutionPage.factLifespan}</dt><dd>{lifespan}</dd></div>
        )}
        {rows.map(([k, v]) => (
          <div key={k} className="fact"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
        {rules && (
          <div className="fact wide">
            <dt>{ui.solutionPage.regulationHeading}</dt>
            <dd>{rules}<span className="fact-note">{ui.solutionPage.regulationNote}</span></dd>
          </div>
        )}
      </dl>
    </Disclosure>
  )
}

/*
 * Build it: the tutorials, or why there are none. A solution nobody builds at home (an
 * installer's job, or nothing to build) is "Getting it done", and points to the options for the
 * same need that a reader can build (J-F14).
 */
function BuildIt({ sol, go, filters }) {
  const S = ui.solutionPage
  const lang = cat.getLang()
  const tuts = cat.tutorialsForLang(sol.tutorials)
  const suggest = () =>
    sendFeedback(`[LOWTECH][tutorial:${sol.id}]`,
      fill(ui.feedback.tutorialEmailBody, { name: cat.tName(sol), id: sol.id }))

  if (NOT_BUILT.has(sol.tutorial_status)) {
    const diy = cat.visibleSolutions(cat.solsBySubfunction[sol.subfunction_id] || [], filters)
      .filter((x) => x.id !== sol.id && x.tutorials.length && !NOT_BUILT.has(x.tutorial_status))
      .slice(0, 4)
    return (
      <section className="build-block" id="build" aria-labelledby="build-h">
        <h2 id="build-h">{S.gettingDoneHeading}</h2>
        <div className="tut-box">
          <p className="tut-lead">{tutorialStatusText(ui, sol.tutorial_status)}</p>
          {sol.tutorial_status !== 'no-build' && <p className="tut-lead">{S.gettingDoneAsk}</p>}
          {diy.length > 0 && (
            <div className="tut-alt">
              <h3>{S.diyAlternatives}</h3>
              <ul>
                {diy.map((x) => (
                  <li key={x.id}><Nav route={{ view: 'solution', id: x.id }} go={go} className="link">{cat.tName(x)}</Nav></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    )
  }

  const inLang = tuts.filter((t) => t.lang === lang).length
  const others = [...new Set(tuts.map((t) => t.lang).filter((l) => l && l !== lang))]
  return (
    <section className="build-block" id="build" aria-labelledby="build-h">
      <h2 id="build-h">
        {S.tutorialsHeading}
        {tuts.length > 0 && <span className="sec-count"> · {tuts.length === 1 ? S.tutorialCountOne : fill(S.tutorialCountMany, { n: tuts.length })}</span>}
      </h2>
      <div className="tut-box is-build">
        {tuts.length === 0 ? (
          <p className="tut-lead">
            {S.tutorialsNone}{' '}
            <button type="button" className="link-btn is-inline" onClick={suggest}>{S.tutorialsSuggest}</button>
          </p>
        ) : (
          <>
            {/* Said plainly when nothing is in the reading language (J-F1). */}
            {inLang === 0 && others.length === 1 && (
              <p className="tut-lead">
                {fill(tuts.length === 1 ? S.tutorialsNoneInLangOne : S.tutorialsNoneInLangMany,
                  { lang: S.languageName[lang], other: S.languageName[others[0]] || others[0], n: tuts.length })}
              </p>
            )}
            <ul className="tut-list">
              {tuts.map((t, i) => <TutorialRow key={i} t={t} line={cat.tutorialLine(sol, t)} />)}
            </ul>
          </>
        )}
      </div>
      <WhereToFindHelp go={go} />
    </section>
  )
}


/*
 * Share this page, and "Built one?" (CM1 step 4, Eric 2026-10-21): the site keeps nothing, so a
 * build is shown where builders already gather. The places to ask about this solution's topic,
 * the reader's language first, the wiki forum always; the rest on People and places.
 */
function ShareRow({ sol, go, onShare, shareLabel }) {
  const S = ui.solutionPage
  const P = ui.people
  const [open, setOpen] = useState(false)
  const lang = cat.getLang()
  const topic = topicOfNeed(sol.function_id)
  const places = PEOPLE.filter((e) => e.group === 'ask' && (e.id === 'ltl-forum' || (topic && e.topics.includes(topic))))
    .sort((a, b) => (b.langs.includes(lang) - a.langs.includes(lang)) || (b.id === 'ltl-forum') - (a.id === 'ltl-forum')
      || a.title.localeCompare(b.title))
  const shown = places.slice(0, 5)
  const tellUs = () =>
    sendFeedback(`[LOWTECH][built:${sol.id}]`, fill(S.builtEmailBody, { name: cat.tName(sol), id: sol.id }))
  return (
    <div className="share-sec">
      <div className="share-row">
        <button type="button" className="btn secondary" onClick={onShare}>{shareLabel}</button>
        <button type="button" className="btn secondary" aria-expanded={open} aria-controls="built-panel"
                onClick={() => setOpen(!open)}>{S.builtButton}</button>
      </div>
      {open && (
        <div className="built-panel" id="built-panel">
          <p>{S.builtLead}</p>
          <ul className="built-places">
            {shown.map((e) => (
              <li key={e.id}>
                <a href={e.link} target="_blank" rel="noopener" hrefLang={e.langs[0]}>
                  {e.title}<span aria-hidden="true"> ↗</span><span className="sr-only"> {P.newTab}</span>
                </a>
                <span className="muted small"> · {entryMeta(e, lang)}</span>
              </li>
            ))}
          </ul>
          <p className="small">
            {S.builtMaker}{' '}
            {topic && places.length > shown.length && (
              <><Nav route={{ view: 'people', topic }} go={go} className="link">{fill(P.topicLink, { topic: P.topic[topic] })}</Nav>{' · '}</>
            )}
            <button type="button" className="link-btn is-inline" onClick={tellUs}>{S.builtTellUs}</button>
          </p>
        </div>
      )}
    </div>
  )
}

// A solution row: the link to its page, and beside it the square that adds it to the builder
// (a button cannot sit inside the link).
// The ids of the solutions in the builder, as a Set that changes only when that list does.
function usePlacedIds() {
  const key = useSyncExternalStore(subscribeTree, placedSolutionIds, () => '')
  return useMemo(() => new Set(key ? key.split(',') : []), [key])
}

// `muted`: another solution for the same sub-need is already in the system (needs page and
// sub-need page).
function SolutionItem({ sol, go, muted = false, connect = false }) {
  return (
    <div className={'sol-line' + (muted ? ' is-muted' : '')}>
      <Nav route={{ view: 'solution', id: sol.id }} go={go}
           className={'row sol' + (sol.benchmark ? ' is-benchmark' : '')}>
        <span className="row-main">
          <span className="row-name">{cat.tName(sol)}</span>
          {sol.benchmark && <Benchmark />}
          {muted && <span className="row-note">{ui.add.siblingPlaced}</span>}
        </span>
      </Nav>
      {connect ? <ConnectButton sol={sol} go={go} /> : <AddPlus sol={sol} />}
    </div>
  )
}

function SomethingMissing({ fn, sub }) {
  const body = fill(ui.feedback.missingEmailBody, { fn: fn || '', sub: sub || '' })
  return (
    <button className="link-btn" onClick={() => sendFeedback('[LOWTECH][missing]', body)}>
      {ui.feedback.missingButton}
    </button>
  )
}


function isIosBrowser() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return ios && !standalone
}

// iOS Safari's Share glyph, drawn so the reader can match it against their screen.
function ShareGlyph() {
  return (
    <svg className="ios-glyph" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"
         fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 10H17" />
    </svg>
  )
}

/*
 * The install line (brief 06): one line under the bar, after the first add or on a second
 * visit, never on the home page before the reader knows what the site is. iOS names the share
 * mark; Android gets a real Install button. Once dismissed or installed it never returns.
 */
let installEvent = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e })
}
const VISITS = (() => {
  try {
    if (!sessionStorage.getItem('counted')) {
      sessionStorage.setItem('counted', '1')
      localStorage.setItem('visits', String((parseInt(localStorage.getItem('visits'), 10) || 0) + 1))
    }
    return parseInt(localStorage.getItem('visits'), 10) || 1
  } catch { return 1 }
})()

function InstallLine({ route }) {
  const placed = useSyncExternalStore(subscribeTree, placedSolutionCount, () => 0)
  const [gone, setGone] = useState(() => {
    try { return localStorage.getItem('installDismissed') === 'true' || localStorage.getItem('iosHintDismissed') === 'true' } catch { return false }
  })
  const [, rerender] = useState(0)
  useEffect(() => {
    const on = () => rerender((n) => n + 1)
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  const ios = isIosBrowser()
  if (gone || standalone || route.view === 'home' || route.view === 'tree') return null
  if (!(placed > 0 || VISITS >= 2)) return null
  if (!ios && !installEvent) return null
  const dismiss = () => { try { localStorage.setItem('installDismissed', 'true') } catch { /* ignore */ } setGone(true) }
  const [before, after] = ui.install.ios.split('{icon}')
  return (
    <div className="install-line" role="note">
      <span className="install-text">
        {ui.install.text}{ios && <> {before}<ShareGlyph />{after}</>}
      </span>
      {!ios && (
        <button type="button" className="btn sm install-btn"
                onClick={async () => { const e = installEvent; installEvent = null; if (e) { e.prompt(); await e.userChoice.catch(() => null) } dismiss() }}>
          {ui.install.button}
        </button>
      )}
      <button type="button" className="install-x" aria-label={ui.install.dismissLabel} title={ui.install.dismissLabel} onClick={dismiss}>
        <Glyph name="close" size={18} />
      </button>
    </div>
  )
}

/*
 * The suggestions under the field (brief 07, C): a status line, solutions first (phone session),
 * then needs, parts of a need, resources, guides and pages; "See all N results" pinned at the
 * foot. Two columns on a wide screen. Arrow keys move through it; the field keeps typing.
 */
function Autocomplete({ results, filters, pick, query, maxHeight }) {
  const A = ui.autocomplete
  const sols = cat.visibleSolutions(results.solutions, filters)
  const groups = [
    [A.solutions, sols, (s) => ({ view: 'solution', id: s.id }), 'main'],
    [A.functions, results.functions, (f) => ({ view: 'function', id: f.id }), 'side'],
    [A.subfunctions, results.subfunctions, (s) => ({ view: 'subfunction', id: s.id }), 'side'],
    [A.resources, results.io_types, (t) => ({ view: 'io', id: t.id }), 'side'],
    [A.guides, results.guides, (g) => ({ view: 'guide', id: g.id }), 'side'],
    [A.pages, results.pages, (p) => p.route, 'side'],
  ]
  const total = groups.reduce((n, g) => n + g[1].length, 0)
  const nameOf = (it) => it.title || cat.tName(it)
  const col = (which) => groups.filter((g) => g[3] === which && g[1].length).map(([label, items, toRoute]) => (
    <div className="ac-group" key={label} role="group" aria-label={label}>
      <div className="ac-label" aria-hidden="true">{label}</div>
      {items.slice(0, 5).map((it) => (
        <button type="button" key={it.id} className="ac-item" onClick={() => pick(toRoute(it))}>
          <span>{nameOf(it)}</span>
          {label === A.solutions && it.benchmark && <Benchmark />}
        </button>
      ))}
    </div>
  ))
  return (
    <div className="ac" style={maxHeight ? { maxHeight } : undefined}>
      <div className="ac-status" role="status">
        {total === 0 ? A.noMatches : total === 1 ? A.statusOne : fill(A.statusMany, { n: total })}
      </div>
      {total > 0 && (
        <div className="ac-cols">
          <div className="ac-col">{col('main')}</div>
          <div className="ac-col">{col('side')}</div>
        </div>
      )}
      {total > 0 && (
        <button type="button" className="ac-all" onClick={() => pick({ view: 'search', q: query })}>
          {fill(A.seeAll, { n: total })} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  )
}

// The date is the workbook's last-modified date (build-info.json): how current the catalogue
// is, not the build.
function SiteFooter({ go, compact }) {
  // On the builder, one line: the canvas needs the height, and the licence line is the
  // attribution for the catalogue content it shows.
  if (compact) {
    return (
      <footer className="site-foot is-compact">
        <p>
          <Nav route={{ view: 'about' }} go={go} className="link">{ui.app.navAbout}</Nav>
          {' · '}
          <Nav route={{ view: 'legal' }} go={go} className="link">{ui.app.navLegal}</Nav>
          {' · '}
          <span>{ui.footer.licenceShort}</span>
        </p>
      </footer>
    )
  }
  return (
    <footer className="site-foot">
      {/* Out of the top bar since D10 Q5; still one tap away from every page. */}
      <p className="site-foot-links">
        <Nav route={{ view: 'about' }} go={go} className="link">{ui.app.navAbout}</Nav>
        {' · '}
        <Nav route={{ view: 'people' }} go={go} className="link">{ui.people.nav}</Nav>
        {' · '}
        <Nav route={{ view: 'why' }} go={go} className="link">{ui.app.navWhy}</Nav>
        {' · '}
        <Nav route={{ view: 'legal' }} go={go} className="link">{ui.app.navLegal}</Nav>
      </p>
      <p>{fill(ui.footer.lastUpdated, { date: buildInfo.data_updated })}</p>
      <p>{ui.footer.offline}</p>
      <p className="small">{ui.footer.licence}</p>
    </footer>
  )
}

// Foot of the home page: the two things a reader can do for the project.
function HomeFoot() {
  return (
    <div className="home-foot">
      <div className="home-foot-item">
        <h2>{ui.home.contributeHeading}</h2>
        <button className="btn secondary"
                onClick={() => sendFeedback('[LOWTECH][suggestion]',
                                            ui.feedback.proposeEmailBody)}>
          {ui.home.contributeButton}
        </button>
      </div>
      <div className="home-foot-item">
        <h2>{ui.home.supportHeading}</h2>
        <a className="btn secondary" href={TIPEEE_URL} target="_blank" rel="noreferrer">
          {ui.home.supportButton}
        </a>
      </div>
    </div>
  )
}

function WhyView({ go }) {
  const S = ui.why
  // Each section with one drawing (brief 11, C): the board's objects where a close-up exists.
  const sections = [
    [S.agencyHeading, S.agencyBody, 'SOL-136'],      // rocket stove cooker
    [S.impactHeading, S.impactBody, 'SOL-184'],      // zeer pot: clay and water, no energy
    [S.costHeading, S.costBody, 'SOL-186'],          // draught-blocking curtains
    [S.resilienceHeading, S.resilienceBody, 'SOL-171'], // gravity lamp
    [S.joyHeading, S.joyBody, 'SOL-067'],            // greywater watering the garden
  ]
  return (
    <div className="view prose">
      <Crumbs go={go} trail={[homeCrumb(), { name: S.heading, route: null }]} />
      <h1>{S.heading}</h1>
      <p className="lede">{S.lede}</p>
      <p>{S.tradeoff}</p>
      {sections.map(([h, body, solId]) => (
        <section key={h} className="why-sec">
          <Suspense fallback={<div className="why-bubble-reserve" aria-hidden="true" />}>
            <WhyBubble solId={solId} go={go} />
          </Suspense>
          <div>
            <h2>{h}</h2>
            <p>{body}</p>
          </div>
        </section>
      ))}
      <h2>{S.notInsteadHeading}</h2>
      <p>{S.notInsteadP1}</p>
      <p>{S.notInsteadP2}</p>
      <p className="why-closing">{S.closing}</p>
      {/* Two ways on (brief 11, C): what you need, and the people who build. */}
      <p className="about-actions">
        <Nav route={{ view: 'needs' }} go={go} className="btn">{S.browseButton}</Nav>
        <Nav route={{ view: 'people' }} go={go} className="btn secondary">{S.peopleButton}</Nav>
      </p>
    </div>
  )
}

// What the tool is (2026-09-25): for a stranger arriving from a search, and the page search
// engines and language models are pointed at. The prerendered twin is aboutBody() in
// scripts/prerender.mjs; both read ui.about and siteCounts().
const COUNTS = siteCounts(cat.catalogue)
const ABOUT_STEP_ROUTE = {
  discover: () => ({ view: 'needs' }),
  compare: () => ({ view: 'subfunction', id: cat.solById['SOL-126']?.subfunction_id }),
  pick: () => ({ view: 'guides' }),
  plan: () => ({ view: 'tree' }),
  build: () => ({ view: 'people' }),
}
function AboutView({ go }) {
  const S = ui.about
  const f = (t) => fill(t, COUNTS)
  return (
    <div className="view prose">
      <Crumbs go={go} trail={[homeCrumb(), { name: S.heading, route: null }]} />
      <h1>{S.heading}</h1>
      <p className="lede">{f(S.lede)}</p>
      {/* Who built this, up beside the lede (brief 11, B); the whole story stays at the end. */}
      <aside className="about-who-intro">
        <p><strong>{S.whoHeading}.</strong> {S.whoP1}</p>
        <a className="link" href="#who">{S.readWhy} ↓</a>
      </aside>
      <p className="about-offline">{S.offlineLine}</p>
      <h2>{S.stepsHeading}</h2>
      {/* Each step opens its place on the site (U-F13): the same examples as the home page's path. */}
      <ol>
        {ABOUT_STEPS.map((k) => (
          <li key={k}>
            <Nav route={ABOUT_STEP_ROUTE[k]()} go={go} className="link"><strong>{S[k + 'Title']}</strong></Nav>
            {' '}{f(S[k + 'Body'])}
          </li>
        ))}
      </ol>
      <h2>{S.differentHeading}</h2>
      <ul>
        {ABOUT_DIFFS.map((k) => (
          <li key={k}><strong>{S[k + 'Title']}</strong> {f(S[k + 'Body'])}</li>
        ))}
      </ul>
      {/* Circularity with one drawing, as Why's sections (Eric, 2026-10-22): greywater from the
          basin flushing the toilet, what one solution gives another using. */}
      <section className="why-sec about-circular">
        <Suspense fallback={<div className="why-bubble-reserve" aria-hidden="true" />}>
          <WhyBubble solId="SOL-153" go={go} />
        </Suspense>
        <div>
          <h2>{S.circularHeading}</h2>
          <p>{f(S.circularBody)}</p>
        </div>
      </section>
      <h2>{S.communitiesHeading}</h2>
      <p>{f(S.communitiesBody)}</p>
      <p><Nav route={{ view: 'people' }} go={go} className="link">{S.communitiesLink} →</Nav></p>
      <h2>{S.notHeading}</h2>
      <p>{f(S.notBody)}</p>
      <h2>{S.dataHeading}</h2>
      <p>{fill(S.catalogueText, { ...COUNTS, date: buildInfo.data_updated, subfunctions: COUNTS.subs, io: COUNTS.ios })}</p>
      <p><a className="link-btn" href="/catalogue.json">{S.dataLink}</a></p>
      <p>{S.sourcesText}</p>
      <p>{S.licenceContent}</p>
      <p>{S.licenceCode}</p>
      {/* Moved from Settings, 2026-09-25: Eric's own words, in the first person. */}
      <h2 id="who">{S.whoHeading}</h2>
      <div className="about-who">
        <p>{S.whoP1}</p>
        <p>{S.whoP2}</p>
        <p>{S.whoP3}</p>
        <p>{S.whoP4}</p>
        <p>{S.whoP5}</p>
        <p className="about-signoff">{S.whoSignoff}</p>
      </div>
      <p className="about-actions">
        <Nav route={{ view: 'needs' }} go={go} className="btn">{S.browseButton}</Nav>
        <Nav route={{ view: 'tree' }} go={go} className="btn secondary">{S.buildButton}</Nav>
      </p>
    </div>
  )
}

// Legal notice and privacy (L1, 2026-10-10). Twin of legalBody() in scripts/prerender.mjs. The
// address is a real mailto link, split out of the sentence at {email}.
const LEGAL_PRIVACY = ['privacyCount', 'privacyBrowser', 'privacyShare', 'privacyMail']
function WithEmail({ text }) {
  const [before, after = ''] = text.split('{email}')
  return <>{before}<a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>{after}</>
}
function LegalView({ go }) {
  const S = ui.legal
  return (
    <div className="view prose">
      <Crumbs go={go} trail={[homeCrumb(), { name: S.heading, route: null }]} />
      <h1>{S.heading}</h1>
      <h2>{S.publisherHeading}</h2>
      <p><WithEmail text={S.publisherBody} /></p>
      <h2>{S.hostHeading}</h2>
      <p>{S.hostBody}</p>
      <h2>{S.licenceHeading}</h2>
      <p>{S.licenceBody}</p>
      <h2>{S.privacyHeading}</h2>
      <p>{S.privacyNone}</p>
      <ul>
        {LEGAL_PRIVACY.map((k) => (
          <li key={k}><strong>{S[k + 'Title']}</strong> {S[k + 'Body']}</li>
        ))}
      </ul>
      <p><WithEmail text={S.privacyRights} /></p>
    </div>
  )
}

function NotFound({ home, go }) {
  const [q, setQ] = useState('')
  return (
    <div className="view">
      <h1>{ui.notFound.heading}</h1>
      <p className="lede">{ui.notFound.body}</p>
      {/* What they were after, by name (brief 10). */}
      <form className="notfound-search" role="search"
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) go({ view: 'search', q: q.trim() }) }}>
        <label htmlFor="nf-q">{ui.notFound.searchLabel}</label>
        <div className="notfound-search-row">
          <input id="nf-q" type="search" value={q} onChange={(e) => setQ(e.target.value)}
                 enterKeyHint="search" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <button type="submit" className="btn">{ui.notFound.searchButton}</button>
        </div>
      </form>
      <div className="notfound-actions">
        <Nav route={{ view: 'needs' }} go={go} className="btn">{ui.notFound.browseButton}</Nav>
        <button className="btn secondary" onClick={home}>{ui.notFound.homeButton}</button>
      </div>
    </div>
  )
}

// The home page (brief 06, second pass): the reader's own words as doors into the guides, the
// house with things people build for it, where the know-how comes from, the path from an idea
// to something built, and why. Which guides have a tile, in what order and under what words, is
// in each guide's own file (`order` and `door`).

// The most used tutorial sources: named, not linked, no counts.
const HOSTS = new Set(['YouTube', 'Internet Archive'])
function topSources(n = 6) {
  const by = new Map()
  for (const s of cat.catalogue.solutions) {
    for (const t of s.tutorials || []) {
      // A host is not a source: the people are its channels, named on the solution pages.
      if (!t.site || HOSTS.has(t.site)) continue
      const e = by.get(t.site) || { site: t.site, n: 0 }
      e.n += 1
      by.set(t.site, e)
    }
  }
  return [...by.values()].sort((a, b) => b.n - a.n).slice(0, n)
}

// Water, heat, hot water, the envelope, sanitation: one drawing each, on the same house.
const HOME_DRAWINGS = ['SOL-053', 'SOL-126', 'SOL-059', 'SOL-124', 'SOL-069']

function Home({ go, lang }) {
  const H = ui.home
  const doors = guideIds().map((id) => guide(id, lang)).filter((g) => g && g.onHome && g.door && g.picks.length)
  const houseSols = HOME_DRAWINGS.map((id) => cat.solById[id]).filter(Boolean)
  // The builder card plays the four-step animation (S8, Eric 2026-11-04); its Pause sits beside
  // the card's link, as a button cannot go inside one.
  const [tourPaused, setTourPaused] = useState(false)
  return (
    <div className="view is-home">
      {/* The static page and the hydrated page render the same heading string. */}
      <h1 className="home-title">{H.title}</h1>
      {H.tagline && <p className="home-tagline">{H.tagline}</p>}

      <div className="home-start">
        <section className="home-doors" aria-labelledby="start-h">
          <h2 id="start-h">{H.startHeading}</h2>
          <div className="door-grid">
            {doors.map((g) => (
              <Nav key={g.id} route={{ view: 'guide', id: g.id }} go={go} className="door">
                <span className="door-title">{g.door}</span>
                <span className="door-sub">{fill(H.doorGuide, { n: g.picks.length })}</span>
              </Nav>
            ))}
          </div>
          <Nav route={{ view: 'guides' }} go={go} className="link home-doors-all">{H.doorGuides} →</Nav>
        </section>
        {houseSols.length > 0 && (
          <Suspense fallback={<div className="home-house-reserve" aria-hidden="true" />}>
            <HouseCarousel sols={houseSols} go={go} />
          </Suspense>
        )}
      </div>

      {/* The three ways onward, each a whole-card link (Eric, 2026-11-02: replaces the 2026-10-21
          "manual, no links"): the needs, the community, My system. */}
      <section className="home-sec" aria-labelledby="path-h">
        <h2 id="path-h">{H.pathHeading}</h2>
        <ul className="home-path">
          {[[H.pathCompare, H.pathCompareBody, 'compare', { view: 'needs' }, H.pathCompareGo],
            [H.pathTeach, H.pathTeachBody, 'steps', { view: 'people' }, H.pathTeachGo],
            [H.pathFit, H.pathFitBody, 'system', { view: 'tree' }, H.pathFitGo]].map(([t, b, art, route, goLabel]) => (
            <li key={t} className={art === 'system' ? 'has-tour' : undefined}>
              {art === 'system' && !calm() && (
                <button type="button" className="home-tour-pause" aria-pressed={tourPaused}
                        onClick={() => setTourPaused((v) => !v)}>
                  {tourPaused ? ui.tour.play : ui.tour.pause}
                </button>
              )}
              <Nav route={route} go={go} className="home-path-card">
                <div className="home-path-art">{art === 'system' ? <BuilderTour camera paused={tourPaused} /> : <PathArt step={art} />}</div>
                <div className="home-path-text">
                  <h3 className="home-path-title">{t}</h3>
                  <p>{b}</p>
                  <span className="btn home-path-go">{goLabel}</span>
                </div>
              </Nav>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-sec is-why" aria-labelledby="why-h">
        <h2 id="why-h">{H.whyHeading}</h2>
        <p className="home-why">{ui.why.lede}</p>
        <Nav route={{ view: 'why' }} go={go} className="link">{H.readMore} →</Nav>
        <p className="home-sources">{fill(H.sourcesBody, { names: topSources().map((x) => (x.site === 'Low-tech Lab wiki' ? 'Low-tech Lab' : x.site)).join(' · ') })}</p>
      </section>

      <HomeFoot />
    </div>
  )
}

// The two indexes of the catalogue, side by side (brief 09): by need, by resource.
function IndexSwitch({ go, current }) {
  const R = ui.resourcePage
  const item = (view, label) => (
    <Nav route={{ view }} go={go} className={'seg-item' + (current === view ? ' is-on' : '')}
         aria-current={current === view ? 'page' : undefined}>{label}</Nav>
  )
  return <nav className="seg index-switch" aria-label={ui.app.navBrowse}>{item('needs', R.byNeed)}{item('resources', R.byResource)}</nav>
}

const resourcesCrumb = () => ({ name: ui.resourcePage.crumb, route: { view: 'resources' } })

/*
 * Solutions by resource (brief 09): every resource in six groups, each with how many solutions
 * make, pass on or use it. Discovery "per resource" had no page before; a resource was reached by
 * a chip or by search only.
 */
function ResourcesView({ go, filters, setFilter }) {
  const R = ui.resourcePage
  const groups = cat.RESOURCE_GROUPS.map((g) => ({
    g, items: cat.sortByName(cat.catalogue.io_types.filter((t) => cat.resourceGroup(t) === g)),
  })).filter((x) => x.items.length)
  return (
    <div className="view is-wide">
      <Crumbs go={go} trail={[homeCrumb(), { name: R.crumb, route: null }]} />
      <h1>{R.indexTitle}</h1>
      <p className="lede">{R.indexIntro}</p>
      <IndexSwitch go={go} current="resources" />
      {/* The same bar as the needs index: the counts below follow it (Eric, 2026-10-20). */}
      <FacetBar filters={filters} setFilter={setFilter} pool={cat.catalogue.solutions} />
      <div className="res-index">
        {groups.map(({ g, items }) => (
          <section key={g} id={g} className="res-group" aria-labelledby={'rg-' + g}>
            {/* The heading rank, not the label style: a group must read as a new block in a column. */}
            <h2 id={'rg-' + g}><ResourceMark group={g} size={20} />{R.groups[g]}</h2>
            <div className="nlist">
              {items.map((t) => {
                const all = cat.solutionsTouching(t.id)
                const n = cat.visibleSolutions(all, filters).length
                return (
                  <Nav key={t.id} route={{ view: 'io', id: t.id }} go={go} className={'nrow is-sub' + (n ? '' : ' is-empty')}>
                    <span className="nrow-name">{cat.tName(t)}</span>
                    <RowCount n={n} total={all.length} filters={filters} />
                    <span className="nrow-chev" aria-hidden="true">›</span>
                  </Nav>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function NeedsView({ go, filters, setFilter }) {
  return (
    <div className="view">
      <Crumbs go={go} trail={[homeCrumb(), { name: ui.app.navBrowse, route: null }]} />
      <h1>{ui.needs.heading}</h1>
      <p className="lede">{ui.needs.intro}</p>
      <IndexSwitch go={go} current="needs" />
      {/* Counts against the whole catalogue, the set the bar narrows here. */}
      <FacetBar filters={filters} setFilter={setFilter} pool={cat.catalogue.solutions} />
      <HomeNeedsUnfold go={go} filters={filters} />
    </div>
  )
}

// The guides index (D10 Q5): every guide with its promise and its number of picks. Example homes
// will join as their own group.
function GuidesView({ go, lang }) {
  const list = guideIds().map((id) => guide(id, lang)).filter((g) => g && g.picks.length)
  return (
    <div className="view">
      <Crumbs go={go} trail={[homeCrumb(), { name: ui.guides.title, route: null }]} />
      <h1>{ui.guides.title}</h1>
      <p className="lede">{ui.guides.intro}</p>
      <div className="guide-index">
        {list.map((g) => (
          <article key={g.id} className="guide-tile">
            <Suspense fallback={<div className="guide-thumb-reserve" aria-hidden="true" />}><GuideThumb picks={g.picks} /></Suspense>
            <h2 className="guide-tile-title">{g.title}</h2>
            <p className="guide-tile-intro">{g.intro}</p>
            <ul className="guide-tile-picks">
              {g.picks.map((p) => <li key={p.sol.id}>{cat.tName(p.sol)}</li>)}
            </ul>
            <Nav route={{ view: 'guide', id: g.id }} go={go} className="btn secondary guide-tile-go">{ui.guides.open}</Nav>
          </article>
        ))}
      </div>
    </div>
  )
}

// A guide: the one place that recommends rather than ranks, so each pick carries its reason.
// Only the pick and the reason come from the content file; every fact about a solution is read
// from the catalogue.
function GuideReserve({ picks }) {
  return (
    <>
      <div className="plate-reserve guide-reserve" aria-hidden="true" />
      <ol className="picks">
        {picks.map(({ sol }, i) => (
          <li key={sol.id} className="pick">
            <span className="pick-head">
              <span className="pick-n" aria-hidden="true">{i + 1}</span>
              <span className="pick-name">{cat.tName(sol)}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

function GuideView({ id, go, lang }) {
  const g = guide(id, lang)
  if (!g) return <NotFound home={() => go({ view: 'home' })} />
  return (
    <div className="view">
      <Crumbs go={go} trail={[homeCrumb(), guidesCrumb(), { name: g.title, route: null }]} />
      <h1>{g.title}</h1>
      {g.placeholder && <p className="draft-note">{ui.guide.placeholderNote}</p>}
      <p className="lede">{g.intro}</p>

      {/* B10: the drawing's room and the picks, held while the drawing's code loads, so the page
          does not jump (as on a solution page). */}
      <Suspense fallback={<GuideReserve picks={g.picks} />}><GuideHouse key={id} picks={g.picks} go={go} title={g.title} /></Suspense>

      <section className="guide-more">
        <h2>{ui.guide.moreHeading}</h2>
        <p>{ui.guide.moreBody}</p>
        <Nav route={{ view: 'needs' }} go={go} className="btn">
          {fill(ui.guide.moreButton, { n: cat.catalogue.solutions.length })}
        </Nav>
      </section>
    </div>
  )
}


// Unfold need, then sub-function, then solutions in place (as in the builder's picker);
// solutions open their full page.
/*
 * The needs index (brief 08, Eric 2026-10-18): one level unfolds in place. A need is a button
 * that opens its parts; a part is a link to its comparison page. What is open is kept in this
 * page's history entry, so Back from a comparison reopens the same needs, and the saved scroll
 * offset lands on the same row. Two columns on a wide screen, filled top to bottom, so opening a
 * need pushes down only its own column.
 */
function HomeNeedsUnfold({ go, filters }) {
  const [openFns, setOpenFns] = useState(() => new Set(window.history.state?.openFns || []))
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, openFns: [...openFns] }, '')
  }, [openFns])
  const toggle = (id) =>
    setOpenFns((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const fns = cat.catalogue.functions
  const half = Math.ceil(fns.length / 2)
  const need = (f) => {
    const open = openFns.has(f.id)
    const fsols = cat.solsByFunction[f.id] || []
    const count = cat.visibleSolutions(fsols, filters).length
    return (
      <div key={f.id} className={'nblock' + (open ? ' is-open' : '')}>
        <button type="button" className="nrow is-need" onClick={() => toggle(f.id)}
                aria-expanded={open} aria-controls={`branch-${f.id}`}>
          <NeedIcon id={f.id} size={40} />
          <span className="nrow-name">{cat.tName(f)}</span>
          <RowCount n={count} total={fsols.length} filters={filters} />
          <span className="nrow-chev" aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
        <div className="nparts" id={`branch-${f.id}`} hidden={!open}>
          {open && (
            <>
              {cat.subsOf(f.id).map((sub) => <SubRow key={sub.id} sub={sub} go={go} filters={filters} />)}
              <Nav route={{ view: 'function', id: f.id }} go={go} className="link nabout">
                {fill(ui.needPages.aboutNeed, { name: cat.tName(f) })}
              </Nav>
            </>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="browse-tree">
      <div className="ncol">{fns.slice(0, half).map(need)}</div>
      <div className="ncol">{fns.slice(half).map(need)}</div>
    </div>
  )
}

// A row's count: the number, or "6 of 34" while filters are on, so a short list says why (brief
// 05). A part the filters empty keeps its row, marked, on the index and the need page alike.
function RowCount({ n, total, filters }) {
  const F = ui.facets
  if (!cat.anyFilterActive(filters) || n === total) return <span className="nrow-count">{n}</span>
  return (
    <span className={'nrow-count' + (n ? '' : ' is-hidden')}>
      {fill(F.nOf, { n, total })}{n === 0 && <> · {F.allHiddenTag}</>}
    </span>
  )
}

function SubRow({ sub, go, filters }) {
  const all = cat.solsBySubfunction[sub.id] || []
  const n = cat.visibleSolutions(all, filters).length
  return (
    <Nav route={{ view: 'subfunction', id: sub.id }} go={go} className={'nrow is-sub' + (n ? '' : ' is-empty')}>
      <span className="nrow-name">{cat.tName(sub)}</span>
      <RowCount n={n} total={all.length} filters={filters} />
      <span className="nrow-chev" aria-hidden="true">›</span>
    </Nav>
  )
}

/*
 * The need page: kept for search, shared links and the breadcrumb (brief 08); browsing goes
 * through the index, where the need unfolds in place.
 */
function FunctionView({ id, go, filters, setFilter }) {
  const fn = cat.fnById[id]
  const subs = cat.subsOf(id)
  const total = cat.visibleSolutions(cat.solsByFunction[id] || [], filters).length
  return (
    <div className="view">
      <Crumbs go={go} trail={[homeCrumb(), needsCrumb(), fnCrumb(fn, false)]} />
      {/* Inside the h1 but aria-hidden, so the heading's text is exactly the name (qa-seo and the static page compare it). */}
      <h1 className="fn-title"><NeedIcon id={fn.id} size={48} />{cat.tName(fn)}</h1>
      <LongName entity={fn} />
      {cat.tSummary(fn) && <p className="summary">{cat.tSummary(fn)}</p>}
      <h2 className="sec">{ui.needPages.subfunctionsHeading}</h2>
      <p className="muted small">{fill(ui.needPages.partsCount, { parts: subs.length, n: total })}</p>
      <FilterLine all={cat.solsByFunction[id] || []} filters={filters} />
      <div className="nlist">
        {subs.map((s) => <SubRow key={s.id} sub={s} go={go} filters={filters} />)}
      </div>
    </div>
  )
}

/*
 * The retrofit control, shown only where it discriminates. `pool` is the list before this
 * filter, so the count is of what exists. The state is a stored preference.
 */
function RetrofitFilter({ pool, shown, filters, setFilter }) {
  const n = (pool || []).filter((s) => s.new_build_only).length
  if (!n || filters.retrofitOnly) return null
  const S = ui.retrofit
  // Everything filtered away is a common state, so it gets a sentence rather than an empty
  // list.
  const allGone = filters.retrofitOnly && shown && shown.length === 0
  if (allGone) {
    const total = (pool || []).length
    return (
      <p className="retrofit-note is-empty">
        {total === 1 ? S.allHiddenOne : fill(S.allHiddenMany, { n: total })}{' '}
        <button className="link-btn" onClick={() => setFilter('retrofitOnly', false)}>{S.showAction}</button>
      </p>
    )
  }
  return (
    <p className="retrofit-note">
      {filters.retrofitOnly ? (
        <>
          {n === 1 ? S.hiddenOne : fill(S.hiddenMany, { n })}{' '}
          <button className="link-btn" onClick={() => setFilter('retrofitOnly', false)}>{S.showAction}</button>
        </>
      ) : (
        <>
          {n === 1 ? S.availableOne : fill(S.availableMany, { n })}{' '}
          <button className="link-btn" onClick={() => setFilter('retrofitOnly', true)}>
            {n === 1 ? S.hideAction : S.hideActionMany}
          </button>
        </>
      )}
    </p>
  )
}

/*
 * The sub-need page is the comparison (brief 08): a table on a wide screen, compact rows on a
 * phone, every option of the need on it, the ones outside the filters below a labelled divider.
 */
// The full name under an everyday label (C2), unless the two say the same thing.
function LongName({ entity }) {
  const long = cat.tLong(entity)
  return long.toLowerCase() === cat.tName(entity).toLowerCase() ? null : <p className="long-name">{long}</p>
}

function SubfunctionView({ id, go, filters, setFilter, landing }) {
  const sub = cat.subById[id]
  const fn = cat.fnById[sub.function_id]
  const all = cat.solsBySubfunction[id] || []
  const pool = cat.visibleSolutions(all, cat.without(filters, 'retrofitOnly'))
  const sols = cat.visibleSolutions(all, filters)
  const placed = usePlacedIds()
  const placedSol = all.find((x) => placed.has(x.id))
  // Hidden options stay one tap away, without clearing the filters (Eric, 2026-10-18).
  const [showHidden, setShowHidden] = useState(false)
  const [aspect, setAspect] = useState('build')
  const hidden = all.length - sols.length
  return (
    <div className="view is-wide">
      {/* The title and description beside one drawing, top right (Eric, 2026-10-21). */}
      <div className="sub-head">
        <div className="sub-head-text">
          <Crumbs go={go} trail={[needsCrumb(), fnCrumb(fn, true)]} />
          <SiteLine show={landing} />
          <h1>{cat.tName(sub)}</h1>
          <LongName entity={sub} />
          {cat.tSummary(sub) && <p className="summary">{cat.tSummary(sub)}</p>}
        </div>
        <div className="sub-head-drawing">
          <Suspense fallback={<div className="home-house-reserve" aria-hidden="true" />}><SubDrawing sols={all} go={go} /></Suspense>
        </div>
      </div>
      {all.length > 1 && <h2 className="sub-compare-h">{fill(ui.comparison.heading, { n: all.length })}</h2>}
      <RetrofitFilter pool={pool} shown={sols} filters={filters} setFilter={setFilter} />
      {/* Emptied by the filters: the box below carries the line, with the filter to remove. */}
      {sols.length > 0 && <FilterLine all={all} filters={filters} always />}
      <EmptyByFilters all={all} filters={filters} setFilter={setFilter} />
      {sols.length > 0 && (
        <>
          {placedSol && <p className="cmp-placed">{fill(ui.comparison.placedNote, { name: cat.tName(placedSol) })}</p>}
          {all.length > 1 && <AspectSwitch aspect={aspect} setAspect={setAspect} />}
          <div className="cmp-desk">
            <CompareTable sols={all} filters={filters} go={go} showOutside={showHidden} aspect={aspect} />
          </div>
          <div className="cmp-phone">
            <CompareRows sols={all} filters={filters} go={go} showOutside={showHidden} aspect={aspect} />
          </div>
          {hidden > 0 && (
            <button type="button" className="btn secondary show-hidden" aria-expanded={showHidden}
                    onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? ui.facets.hideHidden
                : hidden === 1 ? ui.facets.showHiddenOne : fill(ui.facets.showHiddenMany, { n: hidden })}
              <span aria-hidden="true"> {showHidden ? '▴' : '▾'}</span>
            </button>
          )}
          <p className="muted small cmp-foot">{ui.comparison.intro}</p>
        </>
      )}
      {/* Not under a list the filters emptied: it invited reporting as missing what they hide. */}
      {(sols.length > 0 || !all.length) && <SomethingMissing fn={cat.tLong(fn)} sub={cat.tLong(sub)} />}
    </div>
  )
}

// What a tier means, revealed from the ? on the tier itself (a title attribute never fires on
// touch).
function TierHelp() {
  const S = ui.solutionPage
  return (
    <div className="tier-help" role="status">
      <p>{S.tierIntro}</p>
      <ul>
        <li>{S.tierA}</li>
        <li>{S.tierB}</li>
        <li>{S.tierC}</li>
        <li>{S.tierD}</li>
      </ul>
      <p className="muted small">{S.tierNote}</p>
    </div>
  )
}

/*
 * Master-detail on a wide screen: the other options for this need beside the one being read.
 * Each entry is a real navigation, so every solution keeps its own URL and prerendered page.
 * Hidden below the breakpoint; honours the list filters.
 */
// Outside the component because the layout depends on it: no two-column grid without a rail to
// fill.
function railSiblings(sol, filters) {
  const sibs = cat.visibleSolutions(cat.solsBySubfunction[sol.subfunction_id] || [], filters)
  return cat.subById[sol.subfunction_id] && sibs.length > 1 ? sibs : null
}

function SiblingRail({ sol, go, sibs }) {
  const sub = cat.subById[sol.subfunction_id]
  return (
    <nav className="rail" aria-label={ui.solutionPage.railLabel}>
      <p className="rail-head">{ui.solutionPage.railHeading}</p>
      <Nav route={{ view: 'subfunction', id: sub.id }} go={go} className="rail-sub">
        {cat.tName(sub)}
      </Nav>
      <ul className="rail-list">
        {sibs.map((p) => (
          <li key={p.id}>
            {p.id === sol.id
              ? <span className="rail-item is-current" aria-current="page">{cat.tName(p)}</span>
              : <Nav route={{ view: 'solution', id: p.id }} go={go} className="rail-item">
                  {cat.tName(p)}
                </Nav>}
          </li>
        ))}
      </ul>
    </nav>
  )
}

/*
 * The solution page (brief 01, built 2026-10-20). In reading order: where it sits, its name and
 * badges, the jump row (the comparison and the tutorials further down), what the site needs,
 * what it is, the drawing, the site's one line for a newcomer, the comparison, what it takes and
 * gives (the door to connecting mode), Build it, Plan it, then the reference matter.
 */
function SolutionView({ id, go, filters, setFilter, landing }) {
  const [tierOpen, setTierOpen] = useState(false)
  const s = cat.solById[id]
  const fn = cat.fnById[s.function_id]
  const sub = cat.subById[s.subfunction_id]
  const sibs = railSiblings(s, filters)
  const S = ui.solutionPage
  // One control, two behaviours by device: the share sheet on a phone, copy on a laptop
  // (navigator.share there opens an app list with no way to just take the link). The
  // description is not sent: the unfurled card already carries it.
  const [shareState, setShareState] = useState(null)   // null | 'copied' | 'failed'
  const shareUrl = () => urlFor({ view: 'solution', id: s.id }, cat.getLang())
  const doShare = async () => {
    if (prefersShareSheet()) {
      if (await shareLink({ title: cat.tName(s), url: shareUrl() })) return
    }
    if (await copyText(shareUrl())) { setShareState('copied'); return }
    // Copy refused (insecure origin, policy, no gesture): fall back to the sheet rather than
    // claim a copy that did not happen.
    if (await shareLink({ title: cat.tName(s), url: shareUrl() })) return
    setShareState('failed')
  }
  const mistake = (type) =>
    sendFeedback(`[LOWTECH][mistake:${s.id}]`,
      fill(ui.feedback.mistakeEmailBody, { name: cat.tName(s), id: s.id, type }))

  const mistakeTypes = [
    ui.feedback.mistakeWrongInput,
    ui.feedback.mistakeWrongOutput,
    ui.feedback.mistakeWrongLink,
    ui.feedback.mistakeWrongDescription,
  ]

  return (
    <div className={'view card' + (sibs ? ' with-rail' : '')}>
      {sibs && <SiblingRail sol={s} go={go} sibs={sibs} />}
      <div className="detail">
      {/* The need and the sub-need only: the title comes first under one short line (U-F6 a). */}
      <Crumbs go={go} trail={[...(fn ? [fnCrumb(fn, true)] : []), ...(sub ? [subCrumb(sub, true)] : [])]} />
      <div className="card-head">
        {/* That tutorials exist, in the title's line as in a section's; a label, not a shortcut (Eric, 2026-11-02). */}
        <h1>{cat.tName(s)}{s.tutorials.length > 0 && <span className="sol-tutorials">{' '}· {s.tutorials.length === 1 ? ui.solutionPage.tutorialCountOne : fill(ui.solutionPage.tutorialCountMany, { n: s.tutorials.length })}</span>}</h1>
        {s.benchmark && <Benchmark />}
      </div>
      <SolutionBadges sol={s} />

      {/* Site prerequisites before the description: they can end a reader's interest outright (no stream, no south roof). */}
      {cat.L(s, 'site_prerequisites') && (
        <div className="site-req">
          <Glyph name="pin" size={22} className="site-req-mark" />
          <div>
            <h2 className="sec">{S.siteHeading}</h2>
            <p>{cat.L(s, 'site_prerequisites')}</p>
          </div>
        </div>
      )}

      <p className="summary">{cat.tSummary(s)}</p>
      <SiteLine show={landing} />

      <Suspense fallback={NO_PLATE.has(s.id) ? null : <div className="plate-reserve" aria-hidden="true" />}>
        <SolutionPlate sol={s} />
      </Suspense>


      {/* The lead next step for a reader who arrived from a search (D10 Q2): the options for
          the same need, compared, each with "Add to my system". */}
      <Comparison sol={s} go={go} filters={filters} />

      <BuildIt sol={s} go={go} filters={filters} />

      {/* Combine it (Eric, 2026-10-22): what it takes and gives is read to see what it could work
          with, so the chips (each the door to what makes or uses that resource) sit with the add,
          in one box after Build it. */}
      <section className="plan-sec" id="combine" aria-labelledby="plan-h">
        <h2 id="plan-h">{S.planHeading}</h2>
        <div className="plan-block">
          <p className="plan-sub">{S.planBody}</p>
          <div className="io-block">
            <div>
              <h3>{S.takesLabel}</h3>
              {s.inputs.length
                ? cat.offeredInputs(s).map((i) => <IoChip key={i.io} sol={s} ioId={i.io} dir="in" go={go} />)
                : <span className="muted">{S.none}</span>}
            </div>
            <div>
              <h3>{S.givesLabel}</h3>
              {s.outputs.length
                ? s.outputs.map((o) => <IoChip key={o.io} sol={s} ioId={o.io} dir="out" go={go} />)
                : <span className="muted">{S.none}</span>}
            </div>
          </div>
          {/* Adds it here, without leaving the page; the builder is one link away once it is in. */}
          <AddButton sol={s} go={go} className="btn" plan />
        </div>
      </section>

      <div className="ref-matter">
        <MoreDetail sol={s} />

        {/* At the foot, before the sources (Eric, 2026-10-21): share the page, or a build. */}
        <ShareRow sol={s} go={go} onShare={doShare} shareLabel={
          shareState === 'copied' ? S.copiedLabel : shareState === 'failed' ? S.copyFailedLabel : S.shareButton} />

        <h2 className="sec">{S.sourcesHeading}</h2>
        {s.sources.length === 0 ? (
          <p className="muted small">{S.sourcesNone}</p>
        ) : (
          <ul className="links">
            {s.sources.map((src, i) => (
              <li key={i}>
                {/* i18n-ok: a source is a citation, not a catalogue entity, and is not translated */}
                {src.url ? <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a> : src.name}
                {src.tier && (
                  <button className="tier-chip" aria-expanded={tierOpen}
                          aria-label={fill(S.sourceTier, { tier: src.tier }).replace(/^[^A-Za-z]+/, '') + '. ' + S.tierExplainOpen}
                          onClick={() => setTierOpen(!tierOpen)}>
                    {fill(S.sourceTier, { tier: src.tier })}
                    <span className="tier-q" aria-hidden="true">?</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {tierOpen && s.sources.some((x) => x.tier) && <TierHelp />}

        {/* The same scope note the prerendered page carries: hydration used to drop it. */}
        <h2 className="sec">{ui.prerender.limitsHeading}</h2>
        <p className="muted small limits-note">{ui.prerender.limitsBody}</p>

        <details className="mistake">
          <summary>{ui.feedback.mistakeSummary}</summary>
          <div className="mistake-btns">
            {mistakeTypes.map((t) => (
              <button key={t} className="link-btn" onClick={() => mistake(t)}>{t}</button>
            ))}
          </div>
        </details>
      </div>
      </div>
    </div>
  )
}

/*
 * A resource's page (brief 09). What uses it first, since a reader who has greywater wants to
 * know what to do with it; then what passes it on; what makes it last. An output that
 * nothing else uses says what it is for; an input nothing makes says it comes from nature.
 *
 * Connecting mode (TODO F16): arrived from a solution's input or output. The page names the
 * origin's resource ("Greywater from Gravity-fed shower"), the description folds, the other side
 * comes first as "Solutions that can use it", already-placed ones first, each row offering
 * "Add and connect"; the other sections fold.
 */
function IoView({ id, go, filters, setFilter, landing }) {
  const io = cat.ioById[id]
  const R = ui.resourcePage
  const all = (ids) => (ids || []).map((x) => cat.solById[x]).filter(Boolean)
  const prodAll = all(cat.producersByIo[id])
  const consAll = all(cat.consumersByIo[id])
  // A row that takes the resource in and hands the SAME resource out only moves it, so it is
  // listed apart from the rows that turn it into something else (Eric, 2026-09-23).
  const consIds = new Set(consAll.map((x) => x.id))
  const prodIds = new Set(prodAll.map((x) => x.id))
  const throughAll = prodAll.filter((x) => consIds.has(x.id))
  const madeAll = prodAll.filter((x) => !consIds.has(x.id))
  const usedAll = consAll.filter((x) => !prodIds.has(x.id))
  const natural = cat.isNaturalResource(id)
  const household = cat.isHouseholdSource(id)
  const ends = cat.terminalsFor(id)

  const c = useConnecting()
  const connecting = c && c.io === id
  const cands = candidatesOf(connecting ? c : null)
  const placedFirst = (list) => [...list].sort((a, b) => (isPlaced(b.id) ? 1 : 0) - (isPlaced(a.id) ? 1 : 0))
  const [openAbout, setOpenAbout] = useState(false)
  const [openSec, setOpenSec] = useState({})
  const toggle = (k) => setOpenSec((o) => ({ ...o, [k]: !o[k] }))

  const visible = (list) => cat.visibleSolutions(list, filters)
  const count = (list) => {
    const n = visible(list).length
    return cat.anyFilterActive(filters) && n !== list.length ? fill(ui.facets.nOf, { n, total: list.length }) : String(n)
  }
  const rows = (list) => (
    <div className="list">{(connecting ? placedFirst(visible(list)) : visible(list)).map((s) => (
      <SolutionItem key={s.id} sol={s} go={go} connect={connecting && cands.has(s.id)} />
    ))}</div>
  )
  // One section: its heading with a count, an optional lead, and its rows, folded or not.
  const section = (key, title, list, { lead, folded = false } = {}) => {
    if (!list.length) return null
    const open = !folded || openSec[key]
    return (
      <section key={key} className={'res-sec' + (folded ? ' is-folded' : '')} aria-labelledby={'rs-' + key}>
        {/* The reading rank, as a solution page's sections (Eric, 2026-10-22: the label style hid them). */}
        <h2 id={'rs-' + key}>
          {folded ? (
            <button type="button" className="res-fold" aria-expanded={!!open} onClick={() => toggle(key)}>
              <span>{title}<span className="sec-count"> · {count(list)}</span></span> <span className="res-fold-act">{open ? R.hide : R.show} <span aria-hidden="true">{open ? '▴' : '▾'}</span></span>
            </button>
          ) : <>{title}<span className="sec-count"> · {count(list)}</span></>}
        </h2>
        {open && lead && <p className="muted small res-lead">{lead}</p>}
        {open && rows(list)}
      </section>
    )
  }

  // An output that ends here, or an input that nature supplies: said, not left as an empty list.
  const endKind = !usedAll.length && !throughAll.length && ends[0]
  const END = {
    home: [R.endsHomeTitle, R.endsHomeBody, ui.treeNode.homeNode],
    dwelling: [R.endsDwellingTitle, R.endsDwellingBody, ui.treeNode.dwellingNode],
    environment: [R.endsEnvironmentTitle, R.endsEnvironmentBody, ui.treeModals.destinationEnvOption],
  }
  const note = (title, body, link) => (
    <div className="res-note">
      <h2>{title}</h2>
      <p>{body}</p>
      {link}
    </div>
  )

  if (connecting) {
    const origin = cat.tName(cat.solById[c.from])
    const candList = (c.dir === 'out' ? consAll : prodAll).filter((x) => cands.has(x.id))
    const rest = [...new Set([...prodAll, ...consAll])].filter((x) => !cands.has(x.id) && x.id !== c.from)
    return (
      <div className="view is-connecting">
        <Crumbs go={go} trail={[resourcesCrumb(), { name: R.groups[cat.resourceGroup(io)], route: null }]} />
        <h1>{fill(c.dir === 'out' ? R.titleOut : R.titleIn, { io: cat.tName(io), name: origin })}</h1>
        {cat.tSummary(io) && (
          <>
            <button type="button" className="res-about" aria-expanded={openAbout} onClick={() => setOpenAbout((v) => !v)}>
              {fill(R.aboutIo, { name: cat.tName(io) })} <span aria-hidden="true">{openAbout ? '▴' : '▾'}</span>
            </button>
            {openAbout && <p className="summary">{cat.tSummary(io)}</p>}
          </>
        )}
        <FilterLine all={candList} filters={filters} />
        {section('cand', c.dir === 'out' ? R.candidatesOut : R.candidatesIn, candList)}
        {section('rest', c.dir === 'out' ? R.madeBy : R.usedBy, rest, { folded: true })}
      </div>
    )
  }

  return (
    <div className="view">
      <Crumbs go={go} trail={[resourcesCrumb(), { name: R.groups[cat.resourceGroup(io)], route: null }]} />
      <SiteLine show={landing} />
      <h1>{cat.tName(io)}</h1>
      {cat.tSummary(io) && <p className="summary">{cat.tSummary(io)}</p>}
      <FilterLine all={cat.solutionsTouching(id)} filters={filters} />
      {endKind && END[endKind] && note(END[endKind][0], END[endKind][1],
        <Nav route={{ view: 'tree' }} go={go} className="link">{fill(R.endAt, { node: END[endKind][2] })}</Nav>)}
      {(natural || household) && (natural
        ? note(R.natureTitle, fill(R.natureBody, { label: cat.resourceLabel(id) }))
        : note(R.comesFrom, R.householdLead))}
      {section('used', R.usedBy, usedAll, { lead: R.usedByLead })}
      {section('through', R.passedOnBy, throughAll, { lead: R.passedOnLead })}
      {/* Open, last: the order already puts the uses first (Eric, 2026-10-20). */}
      {section('made', natural ? R.broughtInBy : R.madeBy, madeAll)}
      {!prodAll.length && !consAll.length && <p className="muted">{R.nothingCatalogued}</p>}
    </div>
  )
}

// Why a result matched, when it was not by its name (brief 07): one line, naming the place.
function WhyLine({ w }) {
  const S = ui.searchPage
  if (!w || w.place === 'name') return null
  const text = w.place === 'description' ? S.whyDescription
    : w.place === 'tutorial' ? fill(S.whyTutorial, { title: w.detail })
      : w.place === 'need' ? fill(S.whyNeed, { name: w.detail })
        : w.place === 'word' ? fill(S.whyWord, { word: w.detail })
          : w.place === 'picks' ? fill(S.whyPicks, { names: w.detail }) : null
  // i18n-ok: a tutorial's own title, quoted in its own language
  return text ? <span className="why"><Glyph name="info" size={14} />{text}</span> : null
}

const firstSentence = (t) => {
  const m = String(t || '').match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : String(t || '')).trim()
}

// A query typed again, from the results page or a miss.
function SearchAgain({ q, go }) {
  const [v, setV] = useState(q || '')
  return (
    <form className="search-again" role="search" onSubmit={(e) => { e.preventDefault(); if (v.trim()) go({ view: 'search', q: v.trim() }) }}>
      <input type="search" value={v} onChange={(e) => setV(e.target.value)} aria-label={ui.app.searchOpenLabel}
             enterKeyHint="search" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <button type="submit" className="btn">{ui.searchPage.searchAgain}</button>
    </form>
  )
}

/*
 * The results page (brief 07): solutions, needs, parts of a need, resources, guides, pages, in
 * that order. A solution shows its first sentence and where it sits; anything not found by its
 * name says why. A miss is not a dead end: the field again, the ways in, and a way to suggest.
 */
function SearchView({ q, go, filters, setFilter, lang }) {
  const r = search(q)
  const S = ui.searchPage
  const sols = cat.visibleSolutions(r.solutions, filters)
  const [showHidden, setShowHidden] = useState(false)
  const hidden = r.solutions.length - sols.length
  const shownSols = showHidden ? r.solutions : sols
  const total = r.solutions.length + r.functions.length + r.subfunctions.length + r.io_types.length + r.guides.length + r.pages.length
  const Group = ({ title, n, children }) => n ? (
    <section className="sr-group"><h2>{title} · {n}</h2>{children}</section>
  ) : null

  if (!total) {
    return (
      <div className="view">
        <h1>{fill(S.missTitle, { q })}</h1>
        <p className="lede">{S.missBody}</p>
        <SearchAgain q={q} go={go} />
        <div className="nlist sr-doors">
          {[['needs', ui.needs.heading], ['resources', ui.resourcePage.indexTitle], ['guides', ui.guides.title]].map(([view, label]) => (
            <Nav key={view} route={{ view }} go={go} className="nrow is-sub">
              <span className="nrow-name">{label}</span><span className="nrow-chev" aria-hidden="true">›</span>
            </Nav>
          ))}
          {guideIds().map((id) => guide(id, lang)).filter(Boolean).map((g) => (
            <Nav key={g.id} route={{ view: 'guide', id: g.id }} go={go} className="nrow is-sub">
              <span className="nrow-name">{g.title}</span><span className="nrow-chev" aria-hidden="true">›</span>
            </Nav>
          ))}
        </div>
        <SomethingMissing />
      </div>
    )
  }

  return (
    <div className="view">
      <Crumbs go={go} trail={[homeCrumb(), { name: ui.app.searchOpenLabel, route: null }]} />
      <h1>“{q}”</h1>
      <SearchAgain q={q} go={go} />
      <FilterLine all={r.solutions} filters={filters} />
      <Group title={S.solutions} n={shownSols.length}>
        <ul className="sr-list">
          {shownSols.map((s) => {
            const fn = cat.fnById[s.function_id], sub = cat.subById[s.subfunction_id]
            const out = !sols.includes(s)
            return (
              <li key={s.id} className={'sol-line sr-sol' + (out ? ' is-out' : '')}>
                <Nav route={{ view: 'solution', id: s.id }} go={go} className="row sol sr-row">
                  <span className="row-main">
                    <span className="row-name">{cat.tName(s)}</span>
                    {s.benchmark && <Benchmark />}
                  </span>
                  <span className="sr-where">{[fn, sub].filter(Boolean).map((x) => cat.tName(x)).join(' › ')}</span>
                  <span className="sr-lede">{firstSentence(cat.tSummary(s))}</span>
                  {out && <span className="ct-why">{fill(ui.comparison.outsideWhy, { filters: filterNames(filters, cat.failedFilters(s, filters)).join(', ') })}</span>}
                  <WhyLine w={r.why.get(s.id)} />
                </Nav>
                <AddPlus sol={s} />
              </li>
            )
          })}
        </ul>
        {hidden > 0 && (
          <button type="button" className="btn secondary show-hidden" aria-expanded={showHidden}
                  onClick={() => setShowHidden((v) => !v)}>
            {showHidden ? ui.facets.hideHidden : hidden === 1 ? ui.facets.showHiddenOne : fill(ui.facets.showHiddenMany, { n: hidden })}
            <span aria-hidden="true"> {showHidden ? '▴' : '▾'}</span>
          </button>
        )}
      </Group>
      {sols.length === 0 && hidden > 0 && !showHidden && <EmptyByFilters all={r.solutions} filters={filters} setFilter={setFilter} />}
      <Group title={S.functions} n={r.functions.length}>
        <div className="nlist">{r.functions.map((f) => (
          <Nav key={f.id} route={{ view: 'function', id: f.id }} go={go} className="nrow is-sub sr-nrow">
            <span className="nrow-name">{cat.tName(f)}<WhyLine w={r.why.get(f.id)} /></span>
            <span className="nrow-chev" aria-hidden="true">›</span>
          </Nav>
        ))}</div>
      </Group>
      <Group title={S.subfunctions} n={r.subfunctions.length}>
        <div className="nlist">{r.subfunctions.map((s) => (
          <Nav key={s.id} route={{ view: 'subfunction', id: s.id }} go={go} className="nrow is-sub sr-nrow">
            <span className="nrow-name">
              {cat.tName(s)}
              <span className="sr-where">{cat.tName(cat.fnById[s.function_id])}</span>
              <WhyLine w={r.why.get(s.id)} />
            </span>
            <span className="nrow-chev" aria-hidden="true">›</span>
          </Nav>
        ))}</div>
      </Group>
      <Group title={S.resources} n={r.io_types.length}>
        <p className="sr-res">
          {r.io_types.map((t, i) => (
            <span key={t.id}>{i > 0 && ' · '}<Nav route={{ view: 'io', id: t.id }} go={go} className="link">{cat.tName(t)}</Nav></span>
          ))}
          {' · '}<Nav route={{ view: 'resources' }} go={go} className="link sr-all">{fill(S.allResources, { n: cat.catalogue.io_types.length })}</Nav>
        </p>
      </Group>
      <Group title={S.guides} n={r.guides.length}>
        <div className="nlist">{r.guides.map((g) => (
          <Nav key={g.id} route={{ view: 'guide', id: g.id }} go={go} className="nrow is-sub sr-nrow">
            <span className="nrow-name">
              {g.title}
              <span className="sr-lede">{firstSentence(g.intro)}</span>
              <WhyLine w={r.why.get('guide:' + g.id)} />
            </span>
            <span className="nrow-chev" aria-hidden="true">›</span>
          </Nav>
        ))}</div>
      </Group>
      <Group title={S.pages} n={r.pages.length}>
        <div className="nlist">{r.pages.map((p) => (
          <Nav key={p.id} route={p.route} go={go} className="nrow is-sub sr-nrow">
            <span className="nrow-name">{p.title}<WhyLine w={r.why.get(p.id)} /></span>
            <span className="nrow-chev" aria-hidden="true">›</span>
          </Nav>
        ))}</div>
      </Group>
    </div>
  )
}

/*
 * Settings, as a panel docked right on a desktop and a sheet from the foot on a phone (brief 10).
 * One docked panel at a time. The language choices stay real links to the other language's URL.
 */
function SettingsPanel({ go, route, onClose, leaving, filters, setFilter, lang, setLang, theme, setTheme }) {
  const box = useDialog(onClose, '[data-settings-opener]')
  return (
    <>
      <div className={'settings-backdrop' + (leaving ? ' is-leaving' : '')} onPointerDown={onClose} aria-hidden="true" />
      <aside className={'settings-panel' + (leaving ? ' is-leaving' : '')} id="settings-panel" role="dialog" aria-modal="true"
             aria-labelledby="settings-title" ref={box} tabIndex={-1}>
        <div className="settings-head">
          <h2 id="settings-title">{ui.settings.heading}</h2>
          <button type="button" className="settings-close" onClick={onClose}
                  aria-label={ui.settings.closeLabel}>
            <Glyph name="close" size={20} />
          </button>
        </div>

        <section className="settings-sec">
          <h3>{ui.settings.languageLabel}</h3>
          <div className="seg" role="group" aria-label={ui.settings.languageLabel}>
            {[['en', ui.settings.languageEnglish], ['fr', ui.settings.languageFrench]].map(([l, label]) => (
              <Nav key={l} href={pathFor(route.view === 'tree' ? { view: 'tree' } : route, l)} onNavigate={() => setLang(l)}
                   className={'seg-item' + (lang === l ? ' is-on' : '')}
                   aria-current={lang === l ? 'true' : undefined} lang={l} hrefLang={l}>
                {label}
              </Nav>
            ))}
          </div>
          <p className="settings-help">{ui.settings.languageHelp}</p>
        </section>

        <section className="settings-sec">
          <h3>{ui.settings.themeLabel}</h3>
          <div className="seg" role="group" aria-label={ui.settings.themeLabel}>
            {['auto', 'light', 'dark'].map((t) => (
              <button key={t} type="button" className={'seg-item' + (theme === t ? ' is-on' : '')}
                      aria-pressed={theme === t} onClick={() => setTheme(t)}>
                {ui.settings['theme' + t.charAt(0).toUpperCase() + t.slice(1)]}
              </button>
            ))}
          </div>
          <p className="settings-help">{ui.settings.themeHelp}</p>
        </section>

        {/* The same FacetBar as the needs page, so labels and state cannot drift. "High-tech" and "retrofit" are the only terms that need an explanation. */}
        <section className="settings-sec">
          <h3>{ui.facets.settingsHeading}</h3>
          <p className="settings-help">{ui.facets.settingsIntro}</p>
          <FacetBar filters={filters} setFilter={setFilter}
                    pool={cat.catalogue.solutions} variant="settings" />
          <p className="settings-help">
            <strong>{ui.facets.lowTechOnly}</strong>{ui.app.labelSep}{ui.settings.showBenchmarkHelp}
          </p>
          <p className="settings-help">
            <strong>{ui.facets.retrofitOnly}</strong>{ui.app.labelSep}{ui.retrofit.settingsHelp}
          </p>
        </section>

        <section className="settings-sec">
          <p><Nav route={{ view: 'about' }} go={go} className="link">{ui.settings.aboutLink}</Nav></p>
          <p className="settings-help">{ui.footer.offline}</p>
        </section>

        <section className="settings-sec">
          <p className="settings-help">{ui.settings.contributionText}</p>
          <div className="settings-actions">
            <a className="btn secondary" href={TIPEEE_URL} target="_blank" rel="noreferrer">
              {ui.settings.contributionButton}
            </a>
            <button type="button" className="btn secondary"
                    onClick={() => sendFeedback('[LOWTECH][bug]',
                      ui.feedback.bugEmailBody + '\n\n' + fill(ui.settings.buildLabel, { build: BUILD_STAMP }))}>
              {ui.settings.reportBugButton}
            </button>
          </div>
          {/* Which build is running: quiet, last, and quoted by the bug report button. */}
          <p className="settings-help build-stamp">{fill(ui.settings.buildLabel, { build: BUILD_STAMP })}</p>
        </section>
      </aside>
    </>
  )
}
