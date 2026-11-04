/*
 * The site's drawn marks (brief 12, section C): one line dialect on the need icons' 24-unit grid,
 * in place of emoji and text characters. A mark is decorative by default (it always sits beside
 * its words); pass `label` when it stands alone.
 *
 * The condition marks tell neutral conditions apart without a hue: plug (needs the grid), block
 * of flats (a flat with a condition), house (needs a house), ground pin (what your site needs).
 *
 * The resource marks (F7, 2026-10-26): one per group of the resources index, so a chip says
 * what kind of thing flows through it before its name is read. ResourceMark picks it.
 */
const PATHS = {
  plug: 'M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0zM12 16.5V21',
  flat: 'M6 21V3h12v18M6 9h12M6 15h12M10 21v-3h4v3',
  house: 'M3 11l9-8l9 8M5.5 9.5V20h13V9.5',
  pin: 'M12 19s-5.5-5-5.5-9.2a5.5 5.5 0 0 1 11 0C17.5 14 12 19 12 19zM10.1 9.8a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0M4 21.5h16',
  gear: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M12 3.5v2.6M12 17.9v2.6M3.5 12h2.6M17.9 12h2.6M6 6l1.8 1.8M16.2 16.2L18 18M6 18l1.8-1.8M16.2 7.8L18 6',
  newbuild: 'M3 20h18M6 20v-5h12v5M9 15V9.5h6V15',
  warning: 'M12 4l9 15.5H3zM12 10v4.2M12 16.9v.3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  info: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0M12 11v5M12 7.8v.4',
  leaf: 'M5 19c0-8 6-14 14-14c0 8-6 14-14 14zM5 19l8-8',
  wrench: 'M15 4a5 5 0 0 0-4.6 6.9L4 17.3L6.7 20l6.4-6.4A5 5 0 0 0 20 9l-3 3l-3-1l-1-3z',
  pylon: 'M8 21l4-18l4 18M6.5 8h11M9.3 15h5.4',
  arrive: 'M3 12h13M12 8l4 4l-4 4M20 5v14',
  tap: 'M4 9h9v3M13 9h3a3 3 0 0 1 3 3v1M8 9V6M5 6h6M19 16.5v.5M19 19.5v.5',
  tank: 'M6 6c0-1.7 12-1.7 12 0v12c0 1.7-12 1.7-12 0zM6 6c0 1.7 12 1.7 12 0M6 12c0 1.7 12 1.7 12 0',
  drain: 'M4 10h16M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M9 21h6',
  play: 'M8 5.5v13l10.5-6.5z',
  folder: 'M3 6.5h6l2 2.5h10V19H3z',
  'res-energy': 'M13 3L6 13.5h5.5L10 21l8-11h-5.5z',
  'res-water': 'M12 3.5c-3.5 4.5-6 7.6-6 10.5a6 6 0 0 0 12 0c0-2.9-2.5-6-6-10.5z',
  'res-air': 'M3 9h10a2.5 2.5 0 1 0-2.5-2.5M3 13h14a2.5 2.5 0 1 1-2.5 2.5M3 17h7',
  'res-material': 'M4 8l8-4l8 4v8l-8 4l-8-4zM4 8l8 4l8-4M12 12v8',
  'res-building': 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6',
  'res-signal': 'M12 21v-8M10.8 11.5a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0M8.3 8.3a5.2 5.2 0 0 1 7.4 0M5.7 5.7a8.9 8.9 0 0 1 12.6 0',
}

export default function Glyph({ name, size = 16, label, className = '' }) {
  const d = PATHS[name]
  if (!d) return null
  const dashed = name === 'newbuild'
  return (
    <svg className={`glyph ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
         strokeDasharray={dashed ? '2.4 2' : undefined}
         {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' })}>
      <path d={d} />
    </svg>
  )
}

// A resource's group mark (energy, water, air, material, building, signal), by its group name.
export function ResourceMark({ group, size = 14, className = '' }) {
  return <Glyph name={'res-' + group} size={size} className={('res-mark ' + className).trim()} />
}
