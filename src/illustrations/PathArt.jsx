/*
 * The home page's three steps, drawn as what each step does (Eric, 2026-10-21: a solution's
 * drawing said nothing about comparing, following steps or the builder). The motifs come from
 * the old home carousel's illustrations (src/content/section2, hero/slide3: the dot grid, rounded
 * boxes, numbered discs, links that close a loop), redrawn in the theme's tokens so they hold in
 * dark mode, and with the site's own marks: the comparison's three dots, a tutorial's numbered
 * steps, My system's cards and the check's verdict. Sage is the emphasis: terracotta means
 * high-tech on this site. Decorative: the step's title beside it says what it is.
 */
import { useId } from 'react'

function Sheet({ children }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className="path-art" viewBox="0 0 240 160" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={'g' + id} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="16" cy="16" r="1" className="pa-grid" />
        </pattern>
      </defs>
      <rect width="240" height="160" className="pa-sheet" />
      <rect width="240" height="160" fill={`url(#g${id})`} />
      {children}
    </svg>
  )
}

// Three dots, the comparison's own rating mark: n of them filled.
const dots = (x, y, n) => [0, 1, 2].map((i) => (
  <circle key={i} cx={x + i * 11} cy={y} r="3.6" className={i < n ? 'pa-dot is-on' : 'pa-dot'} />
))

// Compare: two option cards side by side, the same rows in the same order, rated in dots.
function Compare() {
  const card = (x, self, ratings) => (
    <g>
      <rect x={x} y="22" width="94" height="116" rx="10" className={self ? 'pa-card is-self' : 'pa-card'} />
      <rect x={x + 12} y="36" width={self ? 56 : 48} height="8" rx="4" className="pa-ink" />
      {ratings.map((n, i) => (
        <g key={i}>
          <rect x={x + 12} y={62 + i * 22} width="26" height="5" rx="2.5" className="pa-soft" />
          {dots(x + 54, 64.5 + i * 22, n)}
        </g>
      ))}
    </g>
  )
  return <Sheet>{card(20, true, [3, 1, 2, 3])}{card(126, false, [1, 3, 2, 1])}</Sheet>
}

// Follow the steps: a tutorial's page, numbered steps beside a sketch, the first two done.
function Steps() {
  return (
    <Sheet>
      <rect x="20" y="16" width="200" height="128" rx="10" className="pa-card" />
      <rect x="34" y="30" width="84" height="8" rx="4" className="pa-ink" />
      {[0, 1, 2].map((i) => {
        const y = 62 + i * 28, done = i < 2
        return (
          <g key={i}>
            <circle cx="44" cy={y} r="9" className={done ? 'pa-num is-done' : 'pa-num'} />
            {done
              ? <path d={`M39.5 ${y} l3.2 3.2 l6 -6.4`} className="pa-tick" />
              : <text x="44" y={y + 4} className="pa-n">3</text>}
            <rect x="60" y={y - 6} width={[64, 52, 58][i]} height="5" rx="2.5" className="pa-soft" />
            <rect x="60" y={y + 2} width={[44, 56, 36][i]} height="5" rx="2.5" className="pa-soft" />
          </g>
        )
      })}
      {/* The tutorial's sketch: a tool on a board. */}
      <rect x="140" y="52" width="66" height="76" rx="6" className="pa-inset" />
      <rect x="150" y="96" width="46" height="12" rx="2" className="pa-line" />
      <path d="M182 70 l-14 30" className="pa-line" />
      <path d="M176 64 l14 6 l-4 8 l-14 -6 z" className="pa-line is-accent" />
    </Sheet>
  )
}

// Make your system efficient: My system's cards, what one gives linked to what the next takes,
// the loop closing back, and the check's verdict.
function System() {
  const card = (x, y) => (
    <g>
      <rect x={x} y={y} width="62" height="40" rx="8" className="pa-card" />
      <rect x={x + 9} y={y + 10} width="34" height="6" rx="3" className="pa-ink" />
      <rect x={x + 9} y={y + 23} width="22" height="5" rx="2.5" className="pa-soft" />
    </g>
  )
  return (
    <Sheet>
      {card(18, 20)}{card(160, 20)}{card(89, 96)}
      <path d="M80 40 H160" className="pa-link" />
      <path d="M191 60 V116 H151" className="pa-link" />
      <path d="M89 116 H49 V60" className="pa-link is-loop" />
      {[[160, 40, 0], [151, 116, 180], [49, 60, 270]].map(([x, y, r]) => (
        <path key={x} d="M0 0 l-7 -4 v8 z" transform={`translate(${x} ${y}) rotate(${r})`} className="pa-head" />
      ))}
      {/* The check's verdict: it works out. */}
      <rect x="166" y="124" width="56" height="22" rx="11" className="pa-verdict" />
      <path d="M176 135 l4 4 l8 -8" className="pa-tick is-verdict" />
      <rect x="194" y="132.5" width="18" height="5" rx="2.5" className="pa-verdict-ink" />
    </Sheet>
  )
}

export default function PathArt({ step }) {
  return step === 'compare' ? <Compare /> : step === 'steps' ? <Steps /> : <System />
}
