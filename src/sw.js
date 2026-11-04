/*
 * The service worker.
 *
 * Navigations go to the network first: every URL has a prerendered page, and no device can be
 * pinned to an old build. A visited page is served from its cache when the network is gone or
 * slow; anything else falls back to `app-shell.html`, a copy of the true index.html under a
 * name nothing redirects. Never precache `index.html` as the shell: /index.html 307s to / and /
 * 302s to /fr?l=auto, so the "shell" would be the French home page.
 *
 * `skipWaiting` + `clientsClaim`: src/sw-update.js relies on `controllerchange` to reload a
 * stale page.
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

self.skipWaiting()
clientsClaim()

// The app shell, the bundle, the icons: everything the app needs to start with no network.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

/*
 * Files the site invites people to take must never be answered with the app, online or offline
 * (opening /catalogue.json once served the app shell). The named list is the promise; the
 * pattern catches anything with a file extension, which no route has.
 */
const NOT_THE_APP = [
  /^\/catalogue\.json$/,
  /^\/llms\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/robots\.txt$/,
  /\/[^/?]+\.[^/]+$/,
]

/*
 * Four seconds, then the cached copy. The cache is capped: a reader who wandered through
 * hundreds of pages should not hold them all on a phone.
 */
const pages = new NetworkFirst({
  cacheName: 'pages',
  networkTimeoutSeconds: 4,
  plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 })],
})

/*
 * One climate file per country outside France (TODO C9), not precached: the whole world would add
 * megabytes nobody needs. A country a reader picked is kept, so the check works offline after.
 */
registerRoute(({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/climate/'),
  new NetworkFirst({
    cacheName: 'climate',
    networkTimeoutSeconds: 4,
    plugins: [new ExpirationPlugin({ maxEntries: 12 })],
  }))

registerRoute(new NavigationRoute(async (options) => {
  // Known to be offline (airplane mode): no four-second wait on a network that is not there
  // (F1 phone session, 2026-10-13: the first page took "a lot of time" offline).
  if (self.navigator && self.navigator.onLine === false) {
    const cached = await caches.match(options.request, { cacheName: 'pages' })
    if (cached) return cached
    return (await matchPrecache('app-shell.html')) || Response.error()
  }
  try {
    const response = await pages.handle(options)
    if (response) return response
  } catch {
    // Offline with nothing cached for this URL. The shell can still render it.
  }
  // Response.error(), not undefined: returning nothing from a navigation handler is a runtime
  // error in the worker.
  return (await matchPrecache('app-shell.html')) || Response.error()
}, { denylist: NOT_THE_APP }))
