// The Markdown twin of a prerendered page (TODO I3, 2026-11-13): what the worker answers to a
// request that asks for `Accept: text/markdown`, and what `<page>.md` serves directly.
//
// Converted from the page's own <main> HTML rather than written again from the data, so the
// Markdown and the HTML say the same thing in the same order: one renderer, two encodings.
// It handles only the elements prerender.mjs emits; anything else keeps its text and loses
// its tag, and qa-markdown.mjs fails the build if a tag survives.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, k) => ENT[k])
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))

const abs = (href, site) => (href.startsWith('/') ? site + href : href)

/** Inline HTML to inline Markdown: links, bold, italics, line breaks. */
function inline(html, site) {
  return decode(html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<br\s*\/?>/g, '  \n')
    .replace(/<a\s[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, h, t) => {
      const text = t.replace(/<[^>]+>/g, '').trim()
      return text ? `[${text.replace(/[[\]]/g, '\\$&')}](${abs(decode(h), site).replace(/ /g, '%20')})` : ''
    })
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, (_, __, t) => (t.trim() ? `**${t.trim()}**` : ''))
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/g, (_, __, t) => (t.trim() ? `*${t.trim()}*` : ''))
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, (m) => (m.includes('  \n') ? '  \n' : '\n'))
    .trim()
}

/** Block-level conversion of the page body (the inside of <main>). */
export function htmlToMarkdown(html, site) {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<(script|style|form)[\s\S]*?<\/\1>/g, '')
  // Each converted block is fenced by two control characters, so the loose text between
  // blocks can be told apart afterwards without splitting a multi-line block.
  const block = (s) => `\u0001${s}\u0002`
  // Lists first, so their items are not split by the paragraph pass.
  h = h.replace(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/g, (_, kind, inner) => {
    let i = 0
    const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => {
      i += 1
      const text = inline(m[1], site).replace(/\n/g, '\n   ')
      return `${kind === 'ol' ? `${i}.` : '-'} ${text}`
    })
    return block(items.join('\n'))
  })
  // A definition list (the solution's facts) as a two-column table would need escaping of
  // every pipe; a "Term: value" list reads as well and cannot break.
  h = h.replace(/<dl[^>]*>([\s\S]*?)<\/dl>/g, (_, inner) => {
    const rows = [...inner.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)]
      .map((m) => `- **${inline(m[1], site)}:** ${inline(m[2], site)}`)
    return block(rows.join('\n'))
  })
  h = h.replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/g, (_, n, t) => block(`${'#'.repeat(Number(n))} ${inline(t, site)}`))
  h = h.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_, t) => block(inline(t, site)))
  // Odd parts are converted blocks; even parts are what was left between them (a bare link,
  // a span), each a paragraph of its own.
  const out = h.split(/\u0001([\s\S]*?)\u0002/).map((part, i) => (i % 2 ? part.trim() : inline(part, site)))
  return out.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n'
}

/** The whole file: a short provenance header, then the page. */
export function pageMarkdown({ body, url, lang, alternates, licence, siteName }) {
  const alts = Object.entries(alternates)
    .filter(([l]) => l !== lang)
    .map(([l, u]) => `[${l}](${u}.md)`).join(' · ')
  const head = `> ${siteName} · ${url}${alts ? ` · ${alts}` : ''}  \n> ${licence}\n\n`
  return head + htmlToMarkdown(body, url.replace(/^(https?:\/\/[^/]+).*$/, '$1'))
}
