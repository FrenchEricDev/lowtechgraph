// Fails the build when app source identifies or displays a catalogue entity by its raw
// `.name` instead of the translated `tName()`.
//
// Why this exists as a script rather than a rule someone remembers: the same defect has
// now shipped five times, each in a different place, each invisible in English and total
// in French.
//
//   1. the tree share table matched edges by label            (fixed 2026-08-19)
//   2. `linked` matched IO buttons by name, so nothing lit up (fixed 2026-08-20)
//   3. Replace recovered an IO id by name and DELETED edges   (fixed 2026-08-20)
//   4. "place as a natural resource" built an English label   (fixed 2026-08-20)
//   5. "solutions that produce Heated Water" on a French page (fixed 2026-08-20)
//   6. the tree picker's SEARCH matched .name while the browse list beside it
//      rendered tName(), so a French reader saw "Forage" and "Captage de source"
//      in the tree and found nothing when searching for them (fixed 2026-09-04)
//
// NUMBER 6 IS THE FIRST THIS FILE DID NOT CATCH, and how it escaped is worth keeping.
// The line carried an `i18n-ok` marker, so the gate was satisfied. The marker's stated
// reason was "search matches both languages, so a French term finds an untranslated
// row" -- which is TRUE, and is not the same claim as finding a TRANSLATED row. The
// exception was deliberate and its reasoning was wrong, which is precisely the limit
// this file already declares below: it insists an exception is visible, never that it
// is correct. A reviewer has to read the marker, and for a year nobody did.
// The structural fix was one shared matcher for the picker and the site search, and
// qa-build.mjs now asserts on real data that every translated solution is findable by
// its French name.
//
// A written rule is read once and then competes with everything after it. This reads the
// delivered source on every build instead.
//
// THE RULE: a line touching `.name` must also call `tName` on that line, or carry the
// marker `i18n-ok`. Nothing here judges whether a use is correct; it only insists that
// every one is deliberate. The marker is the whole point: it costs a keystroke and it
// makes an exception something a reviewer can see.
//
// WHAT THIS DOES NOT CHECK, so a green run is never read as "the app is translated":
//   - a raw name read on one line and used on another. The pattern is line-local.
//   - `.label`, `.slug` or any other field used as an identity. Only `.name`.
//   - whether a `tName()` call passes the right entity.
//   - the workbook, the pipeline, or the prerenderer. App source only.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath, not .pathname: the project path contains a space, which stays
// percent-encoded in a URL and produces a directory that does not exist.
const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const MARKER = 'i18n-ok'

// Property accesses that are not a catalogue entity's display name. These are structural,
// not judgement calls: none of them is an entity, so none is ever translatable.
// Structural exemptions, not judgement calls: none of these is a catalogue entity, so
// none is ever translatable through tName().
//   ui.app.name   the product's own name, which already comes from the strings file
//   *Name         identifiers that merely end in "Name"
const NOT_AN_ENTITY = /\bui\.app\.name\b|\b(className|fileName|treeName|nodeName|ioName|localName|tagName)\b/g

const files = readdirSync(SRC).filter((f) => /\.jsx?$/.test(f))
const offences = []

for (const file of files) {
  const lines = readFileSync(join(SRC, file), 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    if (!/\.name\b/.test(line)) return
    // The marker may sit on the line itself, or on the line above. The second form is
    // needed for JSX: in children position `//` is not a comment, it is text on the page,
    // so the only safe marker there is a {/* ... */} on the preceding line.
    if (line.includes(MARKER) || (lines[i - 1] || '').includes(MARKER)) return
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*')) return   // a comment cannot render anything
    if (/\btName\b/.test(line)) return                    // uses tName, or defines it
    const stripped = line.replace(NOT_AN_ENTITY, '')
    if (!/\.name\b/.test(stripped)) return
    offences.push(`${file}:${i + 1}\n    ${line.trim()}`)
  })
}

if (offences.length) {
  console.error(
    `\ni18n identity check FAILED: ${offences.length} line(s) use a raw .name without tName().\n\n` +
    offences.join('\n') +
    `\n\nEither use cat.tName(entity), or append a comment containing "${MARKER}" with the\n` +
    `reason this raw name is correct (a search index, a legacy fallback, a non-entity).\n`
  )
  process.exit(1)
}

// --- second phase: --built, run after vite ---------------------------------
// A marker placed after a `}` that closes a JSX expression is not a comment, it is text,
// and it renders. That shipped: three appeared in the breadcrumbs. Reasoning about JSX
// context by eye is exactly the judgement this file exists to avoid, so the built bundle
// is searched for the marker instead. A comment cannot survive minification; only text can.
if (process.argv.includes('--built')) {
  const dist = fileURLToPath(new URL('../dist/assets/', import.meta.url))
  const leaked = readdirSync(dist)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => readFileSync(join(dist, f), 'utf8').includes(MARKER))
  if (leaked.length) {
    console.error(
      `
i18n marker LEAKED into the built output: ${leaked.join(', ')}

` +
      `A "${MARKER}" comment rendered as page text. It sits in JSX children position, where
` +
      `// is not a comment. Move it above the line as {/* ${MARKER}: ... */}.
`
    )
    process.exit(1)
  }
  console.log('i18n marker leak check: no marker text in the built bundle.')
  process.exit(0)
}

console.log(
  `i18n identity check: ${files.length} source files, no unmarked raw .name.\n` +
  `  not checked: cross-line uses, fields other than .name, whether tName got the right entity.`
)
