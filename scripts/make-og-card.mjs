// Makes the social cards (brief 11, E): public/og-card.png (English) and public/og-card-fr.png
// (French), 1200 x 630. Not part of the build: run it when the card should change, then commit
// the two images.
//
//   node scripts/make-og-card.mjs
//
// The card is the section house with three solutions at full weight on the left (the site's own
// plates and plate.css, light theme), and the name, a line and the address on the right. It is
// rendered by a headless Chrome or Edge already on the machine (CHROME=path overrides), so the
// project takes no image library.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
const { plateFor, composedSvg } = await import(pathToFileURL(path.join(ROOT, 'src/illustrations/plates.js')))

const BROWSERS = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean)
const browser = BROWSERS.find((b) => fs.existsSync(b))
if (!browser) throw new Error('No Chrome or Edge found: set CHROME to its path.')

// The rain tank, the rocket mass heater, the insulated shutters: water, heat and the envelope.
const PICKS = ['SOL-053', 'SOL-126', 'SOL-124']
const WORDS = {
  en: { line: 'Low-tech solutions that heat, cool, water, power and insulate a home, and the people who build them.' },
  fr: { line: 'Des solutions low-tech pour chauffer, rafraîchir, alimenter en eau et en énergie et isoler un logement, et les personnes qui les construisent.' },
}

const fontUrl = pathToFileURL(path.join(ROOT, 'src/assets/fonts')).href + '/'
const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8').replaceAll('./assets/fonts/', fontUrl)
  + fs.readFileSync(path.join(ROOT, 'src/illustrations/plate.css'), 'utf8')

for (const lang of ['en', 'fr']) {
  const t = (en, fr) => (lang === 'fr' ? fr : en)
  const plates = PICKS.map(plateFor).filter(Boolean)
  const svg = composedSvg(plates, { t, layerClass: () => '' })
  const html = `<!doctype html><html lang="${lang}" data-theme="light"><head><meta charset="utf-8"><style>${css}
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: var(--bg); }
.card { box-sizing: border-box; width: 1200px; height: 630px; padding: 48px; display: grid;
  grid-template-columns: 600px minmax(0, 1fr); gap: 48px; align-items: center;
  font-family: 'Source Sans 3', system-ui, sans-serif; color: var(--ink); }
.card figure.plate { margin: 0; }
.card .plate .ov-txt, .card .plate .ov-num { display: none; }
.words { display: flex; flex-direction: column; gap: 22px; }
.rule { width: 96px; height: 8px; border-radius: 4px; background: var(--accent); }
.name { font-size: 64px; font-weight: 700; line-height: 1.02; letter-spacing: -.01em; }
.line { font-size: 30px; line-height: 1.3; }
.site { font-size: 24px; font-weight: 600; color: var(--accent-ink); }
</style></head><body><div class="card">
  <figure class="plate">${svg}</figure>
  <div class="words"><div class="rule"></div><div class="name">Lowtech Graph</div>
    <div class="line">${WORDS[lang].line}</div><div class="site">lowtechgraph.org</div></div>
</div></body></html>`
  const tmp = path.join(os.tmpdir(), `og-card-${lang}.html`)
  fs.writeFileSync(tmp, html)
  const out = path.join(ROOT, 'public', lang === 'en' ? 'og-card.png' : 'og-card-fr.png')
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1200,630', `--screenshot=${out}`, pathToFileURL(tmp).href], { stdio: 'ignore' })
  console.log('wrote', path.relative(ROOT, out))
}
