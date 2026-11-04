import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Keep in sync with ui.app.name in src/ui-strings.js — this is the name shown on the phone
// home screen / install prompt, and the title on the offline shell. Chosen 2026-08-19; the
// site is lowtechgraph.org. "Graph" rather than "tree" because the data model is a directed
// graph (several hundred typed IO edges), and because graph/graphe reads in both languages where
// tree/arbre does not. The tree-builder FEATURE keeps its metaphor in the UI.
const APP_NAME = 'Lowtech Graph'

/* WHICH BUILD IS THIS PHONE RUNNING? Added 2026-09-12, after an evening spent answering that
   question from outside: two phones and a desktop looked like they were serving something
   older, and the only way to tell was to diff the live bundle against the repo. It is shown
   at the foot of Settings, quiet and copyable, so the answer takes two seconds instead.
   The date is the build's, not the commit's -- a rebuild of the same commit is a different
   artefact, and that difference is exactly what we were chasing. A tree with uncommitted work
   is marked, because "770ec65" on a dirty tree names a build that does not exist anywhere. */
function buildStamp() {
  // The builder's own date, not UTC: a build made at half past midnight was stamped with
  // yesterday, which is exactly the kind of small wrongness that makes somebody distrust the
  // stamp when they most need it. CI runs in UTC, where the two agree anyway.
  const d = new Date()
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim()
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().length > 0
    return `${day} · ${sha}${dirty ? '+' : ''}`
  } catch {
    // No git (a tarball, a CI checkout without history). The date alone still separates two
    // builds a week apart, which is the question people actually ask.
    return day
  }
}

/* A COPY OF THE REAL SHELL, under a name nothing redirects. The service worker falls back to
   this when a reader is offline on a page they have never opened. It cannot use index.html:
   Cloudflare 307s /index.html to /, and _redirects sends / to /fr?l=auto, so precaching
   "index.html" stored the French home page under that name for months (see src/sw.js).
   Written in writeBundle so it is on disk before vite-plugin-pwa globs the output. */
function appShellCopy() {
  return {
    name: 'app-shell-copy',
    apply: 'build',
    // FROM DISK, not from the bundle: under rolldown-vite the HTML is not a bundle entry at
    // all (the keys in generateBundle are the js and the css alone), so the obvious version
    // of this plugin copied nothing and said nothing. Order is what makes writeBundle work:
    // it runs after dist/index.html exists and before vite-plugin-pwa's closeBundle, which
    // is where the precache manifest globs the directory.
    writeBundle(options) {
      const dir = options.dir || 'dist'
      const index = path.join(dir, 'index.html')
      // The worker's own build passes through here too, and has no HTML of its own.
      if (!fs.existsSync(index)) return
      // scripts/prerender.mjs later rewrites dist/index.html into a language selector, so
      // this copy is the RAW shell -- which is what an offline fallback wants: it boots the
      // app, which renders the route from the URL. Only the scaffold title goes, or a reader
      // offline gets a tab called "webapp".
      // noindex: it is reachable at /app-shell, and a crawler finding an empty shell would
      // be right to think less of the site for it. scripts/qa-seo.mjs skips it for the same
      // reason, and says so there.
      const shell = fs.readFileSync(index, 'utf8')
        .replace('<title>webapp</title>',
                 `<title>${APP_NAME}</title>\n    <meta name="robots" content="noindex">`)
      fs.writeFileSync(path.join(dir, 'app-shell.html'), shell)
    },
  }
}

// https://vite.dev/config/
/* TWO VIEWS OF ONE CATALOGUE (2026-09-25). The system check's figures (bases, coefficients,
   fabric classes, départements, climate zones) are a fifth of the catalogue and
   only the builder reads them, so they ship with the builder, which loads on demand. The rest is
   what every page needs. Both are cut from src/data/catalogue.json at build time, so the workbook
   pipeline still writes one file, and the published /catalogue.json stays complete. */
const DIAGNOSTIC_KEYS = ['bases', 'coefficients', 'fabric_classes', 'departments', 'climate']
/* THE FRENCH TEXT, a third view (B2, 2026-10-26): the long French fields (descriptions, rules,
   "choose it if"…) are a third of the pages' catalogue and only a French reader needs them, so
   they ship in their own chunk, loaded before the first French render (src/language.js). The
   French names and slugs stay in the core: search matches names in both languages and the
   router builds French addresses. Every French field sits at entity level (fr: {...},
   label_fr), which is what this relies on. regulation_fr is the exception in name only: it means
   "the rules in France" and holds the English text, so it stays in the core; its French sits
   under fr. */
const KEEP_FR = new Set(['name', 'short'])
function splitFrench(entity) {
  const core = {}, fr = {}
  for (const [k, v] of Object.entries(entity)) {
    if (k === 'fr' && v && typeof v === 'object') {
      const kept = {}, moved = {}
      for (const [fk, fv] of Object.entries(v)) (KEEP_FR.has(fk) ? kept : moved)[fk] = fv
      if (Object.keys(kept).length) core.fr = kept
      if (Object.keys(moved).length) fr.fr = moved
    } else if (k.endsWith('_fr') && k !== 'slug_fr' && k !== 'regulation_fr') fr[k] = v
    else core[k] = v
  }
  return [core, fr]
}
function catalogueViews() {
  const file = path.resolve('src/data/catalogue.json')
  const ids = { core: 'virtual:catalogue-core', diagnostic: 'virtual:catalogue-diagnostic', fr: 'virtual:catalogue-fr' }
  return {
    name: 'catalogue-views',
    resolveId(id) { return Object.values(ids).includes(id) ? '\0' + id : null },
    load(id) {
      if (!Object.values(ids).some((x) => id === '\0' + x)) return null
      this.addWatchFile(file)
      const all = JSON.parse(fs.readFileSync(file, 'utf8'))
      const part = {}
      for (const [k, v] of Object.entries(all)) {
        if (id === '\0' + ids.diagnostic) { if (DIAGNOSTIC_KEYS.includes(k)) part[k] = v; continue }
        if (DIAGNOSTIC_KEYS.includes(k)) continue
        if (!Array.isArray(v)) { if (id === '\0' + ids.core) part[k] = v; continue }
        // Collections: the core keeps each entity without its long French; the French view keeps
        // only that, keyed by the entity's id (natural resources by their io).
        if (id === '\0' + ids.core) part[k] = v.map((e) => (e && typeof e === 'object' ? splitFrench(e)[0] : e))
        else {
          const byId = {}
          for (const e of v) {
            if (!e || typeof e !== 'object') continue
            const fr = splitFrench(e)[1]
            if (Object.keys(fr).length) byId[e.id ?? e.io] = fr
          }
          if (Object.keys(byId).length) part[k] = byId
        }
      }
      // JSON.parse of a string literal: parsed faster than an object literal of this size.
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(part))})`
    },
  }
}

export default defineConfig({
  // Bind the dev server on all local addresses. Without this, Vite listens only on
  // IPv6 ([::1]), so http://localhost:5173 works but http://127.0.0.1:5173 is
  // refused — confusing when the IPv4 address is the one you happen to type.
  server: { host: true },
  define: { __BUILD_STAMP__: JSON.stringify(buildStamp()) },
  plugins: [
    react(),
    catalogueViews(),
    appShellCopy(),
    VitePWA({
      // OUR OWN WORKER since 2026-09-12 (src/sw.js), because the two things that had to
      // change -- network-first navigations and an offline fallback that is the real shell
      // rather than the French home page -- cannot both be expressed in generateSW options.
      // The precache manifest is still generated and injected; only the routing is ours.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // 'autoUpdate': the service worker checks for a new version when online and
      // re-caches the app + data in the background, activating on the next launch.
      registerType: 'autoUpdate',
      // The header's mark at three times its 28 px display, not the 326 px original (B2).
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png', 'logo-mark.png'],
      // The manifest's icons are the system's to fetch at install, not the pages' (B2).
      includeManifestIcons: false,
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description:
          'Browse and compare low-tech, bioclimatic housing solutions — by need, by resource, or by name.',
        theme_color: '#4F6247',  // = --header-bg; the phone's status bar is the header
        background_color: '#F6F1E6',  // = --bg; the splash before the app paints
        display: 'standalone',
        // A stable identity for the installed app (B12), whatever the start address becomes.
        id: '/',
        // Where the host's own redirect of / lands (public/_redirects), so an installed app opens
        // without a redirect; l=auto still lets the app pick the reader's language (B12).
        start_url: '/fr?l=auto',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // Separate file, not the same one relabelled: Android crops icons to the
          // launcher's own shape, so a maskable icon needs its own generous margin or
          // the edges of the mark get sliced off.
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Precache the app shell + bundled data (catalogue.json is bundled into the JS, so
        // it's covered) → the app still starts and browses with no network.
        //
        // `**/*.html` matches index.html and app-shell.html and nothing else, even though
        // the build ends with 784 HTML files. scripts/prerender.mjs writes the rest AFTER
        // this plugin has generated its manifest, so the service worker never sees them.
        // That is the outcome we want: they are 5.1 MB of crawler-facing HTML, and a page a
        // reader actually opened is cached as they go (the `pages` cache in src/sw.js).
        // Left as-is deliberately; do not "fix" the glob into precaching them.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}'],
        // Not part of the app (B2): the social cards are for link previews, and the 512 px icons
        // are fetched by the system when the app is installed, never by a page. The climate files
        // (TODO C9) are fetched per country when a reader picks one (src/sw.js).
        globIgnores: ['og-card*.png', 'icon-512*.png', 'logo.png', 'climate/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // The denylist that used to live here moved into src/sw.js, with the reason it
        // exists, because the routing is now written rather than generated.
      },
    }),
  ],
})
