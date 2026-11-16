// Reader journeys in a real browser (TODO Q1, step 1), run before a release: `npm run qa:journeys`.
//
// Serves dist/ with `vite preview` on its own port, drives Chromium through Playwright, one fresh
// browser context per journey (no storage, no service worker carried over), and fails on any
// broken step or uncaught page error. Run `npm run build` first: it tests the built site.
//
// NOT checked: Firefox and Safari (Q1 step 3); real phones (a 412 x 750 viewport is not a phone:
// touch, the address bar and Safari's quirks are F1's); Cloudflare's own routing (qa-host and
// qa-markdown cover the worker); accessibility (Q1 step 2); whether a verdict is right (qa-adequacy);
// how anything looks. The journeys are described for people in Automated-Tests.md (project root);
// the run fails if that list and this file disagree. Arrange is checked for overlapping cards and chain order, not for beauty.
import { chromium } from 'playwright'
import { preview } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const cat = JSON.parse(fs.readFileSync(path.join(APP, 'dist', 'catalogue.json'), 'utf8'))
const PORT = 4181
const BASE = `http://localhost:${PORT}`
const SIZES = { desktop: { width: 1280, height: 800 }, phone: { width: 412, height: 750 } }

const server = await preview({ root: APP, preview: { port: PORT, strictPort: true, open: false }, logLevel: 'silent' })
const browser = await chromium.launch()
let pass = 0
const fails = []
const must = (cond, msg) => { if (!cond) throw new Error(msg) }

const seen = new Set()
async function journey(label, sizes, fn) {
  seen.add(label.toLowerCase())
  for (const size of sizes) {
    const ctx = await browser.newContext({ viewport: SIZES[size], locale: 'en-GB' })
    const page = await ctx.newPage()
    page.setDefaultTimeout(8000)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    try {
      await fn(page, ctx, size)
      must(!errors.length, `page error: ${errors[0]}`)
      pass += 1
      console.log(`  PASS  ${label} (${size})`)
    } catch (e) {
      fails.push(`${label} (${size})`)
      console.log(`  FAIL  ${label} (${size})\n          ${e.message.split('\n')[0]}`)
      fs.mkdirSync(path.join(APP, 'qa-output'), { recursive: true })
      await page.screenshot({ path: path.join(APP, 'qa-output', `${label.replace(/\W+/g, '-')}-${size}.png`) }).catch(() => {})
    }
    await ctx.close()
  }
}

// The builder's first-visit explainer covers the canvas: dismiss it when it shows.
async function dismissIntro(page) {
  const got = page.getByRole('button', { name: 'Got it' }).first()
  if (await got.isVisible().catch(() => false)) await got.click()
}

// On a phone the header's links and Settings sit behind the Menu button.
async function header(page, size, name, role = 'link') {
  if (size === 'phone') await page.getByRole('button', { name: 'Menu' }).first().click()
  await page.getByRole(role, { name, exact: true }).first().click()
}

// A system as a share link (#t=), the builder's own format: cards stacked at one spot.
function treeLink(sols, edges) {
  const nodes = sols.map((sol, i) => ({ id: `n${i + 1}`, sol, position: { x: 0, y: 0 } }))
  const payload = { nodes, edges: edges.map(([a, b, io], i) => ({ id: `e${i}`, source: `n${a + 1}`, target: `n${b + 1}`, io, ios: [io] })), name: '', counter: sols.length }
  return '/en/tree#t=r' + Buffer.from(JSON.stringify(payload)).toString('base64url')
}

const sol = (slug) => cat.solutions.find((s) => s.slug === slug)
const outs = (s) => (s.outputs || []).map((o) => o.io)
const ins = (s) => (s.inputs || []).map((o) => o.io)
const feeds = (a, b) => outs(a).find((io) => ins(b).includes(io))

console.log('\nreader journeys in Chromium\n')

await journey('find a need and compare its options', ['desktop', 'phone'], async (page, ctx, size) => {
  await page.goto(BASE + '/en')
  await header(page, size, 'Solutions')
  await page.waitForURL('**/en/needs')
  await page.goto(BASE + '/en/need/potable-water-supply/sourcing-extraction')
  await page.getByRole('heading', { level: 1, name: 'Where the water comes from' }).waitFor()
  // A table on a wide screen; on a phone the same options as a list (the table is hidden there).
  const rowsOf = size === 'phone' ? page.locator('main .cr-list > li') : page.getByRole('table').first().locator('tbody tr')
  await rowsOf.first().waitFor()
  const rows = await rowsOf.count()
  must(rows >= 5, `the comparison has ${rows} options`)
  const tab = page.getByRole('button', { name: 'Keeping it going' })
  if (await tab.isVisible()) {
    await tab.click()
    must((await rowsOf.count()) === rows, 'the second tab changed the number of options')
  }
})

await journey('search, open a solution, add it to My system', ['desktop', 'phone'], async (page) => {
  await page.goto(BASE + '/en')
  const box = page.getByRole('searchbox', { name: 'Search' }).first()
  if (!(await box.isVisible())) await page.getByRole('button', { name: /search/i }).first().click()
  await box.fill('rainwater')
  await box.press('Enter')
  await page.waitForURL('**/en/search?q=rainwater')
  await page.locator('main a[href="/en/solution/rainwater-harvesting-and-storage"]').first().click()
  await page.getByRole('heading', { level: 1, name: /Rainwater harvesting and storage/ }).waitFor()
  must((await page.locator('main a[target="_blank"]').count()) >= 1, 'no tutorial link on the page')
  await page.getByRole('button', { name: 'Add to my system' }).first().click()
  await page.goto(BASE + '/en/tree')
  await dismissIntro(page)
  await page.getByRole('group', { name: 'Rainwater harvesting and storage' }).waitFor()
})

await journey('connecting mode: add and link from a solution page', ['desktop'], async (page) => {
  await page.goto(BASE + '/en/solution/bio-sand-filter')
  await page.getByRole('button', { name: 'Add to my system' }).first().click()
  await page.locator('main a', { hasText: 'Potable water' }).first().click()
  await page.waitForURL('**/en/resource/potable-water**')
  await page.getByRole('button', { name: 'Add Elevated cistern/tank storage and link it to Bio-sand filter' }).click()
  await page.getByText('Linked to Bio-sand filter').first().waitFor()
  await page.goto(BASE + '/en/tree')
  await dismissIntro(page)
  await page.getByRole('button', { name: /^2 cards · 1 link/ }).waitFor()
})

await journey('build a chain, see a warning, Fix it', ['desktop'], async (page) => {
  await page.goto(BASE + '/en/tree?add=gravity-fed-shower')
  await dismissIntro(page)
  await page.getByRole('button', { name: 'Greywater: gives, not linked' }).click()
  await page.getByRole('dialog', { name: 'Link a solution' }).getByRole('button', { name: /^Flush toilet \(standard cistern\)/ }).click()
  const warn = page.getByText(/Greywater reaches a cistern through a diversion/)
  await warn.first().waitFor()
  await page.locator('.tnode-fix-btn').first().click()
  await page.getByRole('button', { name: /^Insert Direct greywater diversion to toilet flushing between/ }).click()
  await warn.first().waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /^3 cards · 2 links/ }).waitFor()
})

await journey('the system check with a département', ['desktop'], async (page) => {
  await page.goto(BASE + '/en/tree?add=rainwater-harvesting-and-storage')
  await dismissIntro(page)
  await page.getByRole('button', { name: /^Could this work out/ }).click()
  await page.getByRole('heading', { level: 3, name: 'Your situation' }).waitFor()
  const water = page.locator('#adq-h-water')
  await water.waitFor()
  await page.getByLabel('Region').selectOption({ index: 13 })
  await page.getByLabel('Rainfall year to assume').selectOption({ index: 2 })
  await water.waitFor()
  must(await water.locator('.adq-mark').count() === 1, 'the water verdict lost its mark')
})

await journey('a guide: open a pick, reach its solution page', ['desktop', 'phone'], async (page) => {
  await page.goto(BASE + '/en/guide/in-a-flat')
  await page.locator('main button', { hasText: /^1/ }).first().click()
  const pick = page.getByRole('link', { name: 'Open the solution page' }).first()
  const href = await pick.getAttribute('href')
  await pick.click()
  await page.waitForURL('**' + href)
  await page.getByRole('heading', { level: 1 }).waitFor()
})

await journey('the language switch keeps the page', ['desktop', 'phone'], async (page, ctx, size) => {
  await page.goto(BASE + '/en/solution/bio-sand-filter')
  await header(page, size, 'Settings', 'button')
  await page.getByLabel('Language').selectOption('fr')
  await page.waitForURL('**/fr/solution/**')
  await page.waitForFunction(() => globalThis.document.documentElement.lang === 'fr', null, { timeout: 3000 })
    .catch(() => { throw new Error('html lang is not fr') })
  const s = sol('bio-sand-filter')
  must(page.url().endsWith('/fr/solution/' + (s.slug_fr || s.slug)), `landed on ${page.url()}`)
})

await journey('offline after one visit', ['desktop'], async (page, ctx) => {
  await page.goto(BASE + '/en')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await ctx.setOffline(true)
  await page.goto(BASE + '/en/solution/bio-sand-filter')
  await page.getByRole('heading', { level: 1, name: /Bio-sand filter/ }).waitFor()
  await page.goto(BASE + '/en/tree')
  await page.getByRole('heading', { level: 1, name: 'My system' }).waitFor()
})

// Arrange (Eric, 2026-10-18: "will need a lot of testing"): systems of each shape, stacked at one
// spot, must come out with no two cards overlapping, and a chain must read in order.
const A = sol('rainwater-harvesting-and-storage'), F = sol('bio-sand-filter')
const T = sol('elevated-cistern-tank-storage') || cat.solutions.find((s) => feeds(F, s) && s.id !== A.id)
const users = cat.solutions.filter((s) => feeds(F, s)).slice(0, 4)
const loop = (() => {
  for (const a of cat.solutions) for (const b of cat.solutions) {
    if (a.id !== b.id && feeds(a, b) && feeds(b, a)) return [a, b]
  }
  return null
})()
const SHAPES = {
  'one chain': [[A, F, T], [[0, 1], [1, 2]]],
  'one branch': [[F, users[0], users[1]], [[0, 1], [0, 2]]],
  'several branches': [[A, F, ...users], [[0, 1], [1, 2], [1, 3], [1, 4], [1, 5]]],
  'unlinked cards': [[A, F, T, users[3]], []],
  ...(loop ? { 'a loop': [loop, [[0, 1], [1, 0]]] } : {}),
}
for (const [shape, [sols, links]] of Object.entries(SHAPES)) {
  await journey(`Arrange: ${shape}`, ['desktop', 'phone'], async (page) => {
    const edges = links.map(([a, b]) => [a, b, feeds(sols[a], sols[b])])
    must(edges.every((e) => e[2]), 'the test system has a link no resource supports')
    await page.goto(BASE + treeLink(sols.map((s) => s.id), edges))
    await dismissIntro(page)
    await page.locator('.react-flow__node').nth(sols.length - 1).waitFor()
    await page.getByRole('button', { name: 'Arrange' }).click()
    await page.waitForTimeout(900)   // the motion spec's longest move
    const boxes = await page.locator('.react-flow__node').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.id, x: r.x, y: r.y, w: r.width, h: r.height } }))
    must(boxes.length === sols.length, `${boxes.length} cards on the canvas, expected ${sols.length}`)
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const p = boxes[i], q = boxes[j]
      const overlap = p.x < q.x + q.w - 1 && q.x < p.x + p.w - 1 && p.y < q.y + q.h - 1 && q.y < p.y + p.h - 1
      must(!overlap, `cards ${p.id} and ${q.id} overlap`)
    }
    if (shape !== 'a loop') {
      const at = Object.fromEntries(boxes.map((b) => [b.id, b]))
      for (const [a, b] of links) {
        const s = at[`n${a + 1}`], t = at[`n${b + 1}`]
        must(s.x < t.x || s.y < t.y, `n${a + 1} -> n${b + 1} does not read in order`)
      }
    }
  })
}

await browser.close()

// The human-readable list (Automated-Tests.md, section 1) must name exactly the journeys run here.
const DOC = path.join(APP, '..', '..', 'Automated-Tests.md')
const sec = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8').split(/^## 2\./m)[0] : ''
const documented = new Set([...sec.matchAll(/^### (.+)$/gm)].map((m) => m[1].trim().toLowerCase()))
const undocumented = [...seen].filter((l) => !documented.has(l))
const untested = [...documented].filter((l) => !seen.has(l))
if (!sec) fails.push('Automated-Tests.md not found')
if (undocumented.length) fails.push('not in Automated-Tests.md: ' + undocumented.join('; '))
if (untested.length) fails.push('in Automated-Tests.md but not tested: ' + untested.join('; '))
for (const f of fails.filter((x) => /Automated-Tests/.test(x))) console.log('  FAIL  ' + f)
await new Promise((r) => server.httpServer.close(r))
console.log(`\n${pass} passed, ${fails.length} failed`)
console.log('Not checked: Firefox, Safari, real phones, accessibility, whether verdicts are right, how it looks.'
  + (loop ? '' : ' No two solutions feed each other, so Arrange was not tried on a loop.'))
if (fails.length) { console.log('Screenshots of the failures: qa-output/'); process.exit(1) }
