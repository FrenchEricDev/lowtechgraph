/**
 * Does the app survive a page translator, and does a failure ever leave a blank page?
 *
 * WHY THIS EXISTS. On 2026-11-27 a reader on Chrome Translate opened My system and got a blank
 * page, in the browser and in the installed app. Translate swaps the text nodes React wrote for
 * <font> wrappers; the footer's switch to its compact form then removed a " · " text node that was
 * no longer there, React threw NotFoundError while committing, and with nothing to catch it the
 * whole app unmounted. Reproduced in a browser with a simulated translator; this file checks the
 * three things that fixed it, on every build:
 *
 *   1. src/dom-guard.js tolerates a node a translator moved, and changes nothing otherwise. Run
 *      here against a stand-in DOM node, so it is the real file's behaviour, not a reading of it.
 *   2. main.jsx loads the guard before anything else, and draws the app inside an error boundary.
 *   3. The built first load carries the guard, and the boundary's words exist in both languages.
 *
 * Run:  node scripts/qa-resilience.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import uiEn from '../src/ui-strings.js'
import uiFr from '../src/ui-strings.fr.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
let pass = 0
const fails = []
const check = async (label, fn) => {
  try { await fn(); pass += 1; console.log('  PASS  ' + label) }
  catch (e) { fails.push(label); console.log('  FAIL  ' + label + '\n          ' + e.message) }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg) }

console.log('\nresilience: page translators and blank pages\n')

// A stand-in for the DOM's Node, strict as a browser is: removing or inserting beside a node that
// is not a child throws NotFoundError.
class FakeNode {
  constructor(name) { this.name = name; this.parentNode = null; this.childNodes = [] }
  removeChild(c) {
    const i = this.childNodes.indexOf(c)
    if (i < 0) throw new Error('NotFoundError: not a child')
    this.childNodes.splice(i, 1); c.parentNode = null; return c
  }
  insertBefore(n, ref) {
    if (n.parentNode) n.parentNode.removeChild(n)
    const i = ref == null ? this.childNodes.length : this.childNodes.indexOf(ref)
    if (i < 0) throw new Error('NotFoundError: reference is not a child')
    this.childNodes.splice(i, 0, n); n.parentNode = this; return n
  }
}
const strict = { removeChild: FakeNode.prototype.removeChild, insertBefore: FakeNode.prototype.insertBefore }
// What a translator does to one text node: a wrapper takes its place, and the node leaves the DOM.
const translated = () => {
  const p = new FakeNode('p'), a = new FakeNode('a'), dot = new FakeNode('#text'), b = new FakeNode('a')
  for (const n of [a, dot, b]) p.insertBefore(n, null)
  const font = new FakeNode('font')
  p.childNodes[1] = font; font.parentNode = p; dot.parentNode = null
  return { p, a, dot, b, font }
}

await check('without the guard, the stand-in throws as a browser does (the test can fail)', () => {
  const { p, dot } = translated()
  let threw = false
  try { strict.removeChild.call(p, dot) } catch { threw = true }
  must(threw, 'removing a translated-away node did not throw, so the checks below prove nothing')
})

globalThis.Node = FakeNode
await import('../src/dom-guard.js')

await check('removing a node a translator took away does not throw, and leaves the rest', () => {
  const { p, a, dot, b, font } = translated()
  p.removeChild(dot)
  must(p.childNodes.length === 3 && p.childNodes[0] === a && p.childNodes[1] === font && p.childNodes[2] === b,
    'the parent\'s children changed')
})
await check('inserting beside a node a translator took away still inserts (at the end)', () => {
  const { p, dot } = translated()
  const x = new FakeNode('div')
  p.insertBefore(x, dot)
  must(x.parentNode === p && p.childNodes.at(-1) === x, 'the new node was not inserted')
})
await check('ordinary removes and inserts behave exactly as before', () => {
  const { p, a, b, font } = translated()
  const y = new FakeNode('span')
  p.insertBefore(y, b)
  must(p.childNodes.indexOf(y) === p.childNodes.indexOf(b) - 1, 'insertBefore did not place the node before its reference')
  p.removeChild(a)
  must(!p.childNodes.includes(a) && a.parentNode === null && p.childNodes[0] === font, 'removeChild did not remove a real child')
})

const main = fs.readFileSync(path.join(ROOT, 'src', 'main.jsx'), 'utf8')
await check('main.jsx imports the guard before anything else', () => {
  const first = main.match(/^import\s.*$/m)
  must(first && /['"]\.\/dom-guard(\.js)?['"]/.test(first[0]), `the first import is ${first ? first[0] : 'missing'}`)
})
await check('main.jsx draws the app inside an error boundary', () => {
  const m = main.match(/\.render\(\s*<(\w+)>\s*<App\s*\/>\s*<\/\1>\s*\)/)
  must(m, 'the render call does not wrap <App /> in a component')
  must(new RegExp(`class ${m[1]} extends Component[\\s\\S]*?getDerivedStateFromError`).test(main),
    `${m[1]} is not a class with getDerivedStateFromError`)
})

await check('the built first load carries the guard', () => {
  const dist = path.join(ROOT, 'dist')
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  const scripts = [...html.matchAll(/<(?:script[^>]*type="module"[^>]*src|link rel="modulepreload"[^>]*href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
  must(scripts.length, 'found no entry script in dist/index.html')
  const js = scripts.map((s) => fs.readFileSync(path.join(dist, s), 'utf8')).join('\n')
  must(/prototype\.removeChild\s*=/.test(js) && /prototype\.insertBefore\s*=/.test(js),
    'no assignment to Node.prototype.removeChild / insertBefore in the entry page\'s scripts')
})

await check('the error boundary has its words in both languages', () => {
  for (const k of ['crashHeading', 'crashBody', 'crashReload']) {
    must(uiEn.app?.[k], `no English ui.app.${k}`)
    must(uiFr.app?.[k], `no French ui.app.${k}`)
  }
})

console.log(`\n${pass} passed, ${fails.length} failed`)
console.log('Not checked: a real translator in a real browser (the 2026-11-27 reproduction was by hand,'
  + ' with a simulated one), translators that move elements rather than text, whether translated text'
  + ' stays current after React changes it, errors in event handlers or timers (no boundary catches'
  + ' those), and a deploy removing a chunk an open page still needs (the boundary offers a reload;'
  + ' src/sw-update.js reloads on update).')
if (fails.length) process.exit(1)
