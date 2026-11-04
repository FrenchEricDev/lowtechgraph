import { useEffect, useMemo, useState } from 'react'
import { ui, fill } from './ui-strings'
import { FEEDBACK_EMAIL } from './platform'
import Nav from './Nav.jsx'
import people from './content/people.json'
import { calm } from './motion.js'

/*
 * People and places (brief 11, CM1): the people who teach the solutions in this catalogue, and the
 * places to learn and build with others. Two views of the same entries: what they do (learn from,
 * meet, ask) and what they cover (the home page's everyday topics). Alphabetical everywhere, no
 * ranking, no counts of followers; one link to their own space (CM1 Q4). The prerendered twin is
 * peopleBody() in scripts/prerender.mjs.
 */
export const PEOPLE = people.entries
export const TOPICS = people.topics
// A need's everyday topic: the same grouping the page's "What they cover" view uses, so a
// solution page's "Who to ask" opens the right section.
const TOPIC_OF = {
  'FN-06': 'water', 'FN-02': 'heat', 'FN-03': 'heat', 'FN-10': 'food', 'FN-09': 'power', 'FN-04': 'power',
  'FN-15': 'power', 'FN-07': 'sanitation', 'FN-08': 'sanitation', 'FN-11': 'sanitation', 'FN-14': 'sanitation',
  'FN-01': 'building', 'FN-05': 'building', 'FN-12': 'building', 'FN-13': 'building',
}
export const topicOfNeed = (fnId) => TOPIC_OF[fnId] || null
const GROUPS = ['learn', 'meet', 'ask']
// Formats a reader can filter the Learn group by; the others have none.
const FORMATS = ['wiki', 'video', 'article', 'guide', 'how they live']
const tagKey = (t) => t.replace(/ /g, '_')

/* The words under an entry's name: kind, languages, then where it is or how it publishes. */
export function entryMeta(e, lang) {
  const P = ui.people
  const bits = [P.kind[e.kind] || e.kind, e.langs.map((l) => P.langName[l] || l).join(', ')]
  if (e.where) bits.push(e.where[lang] || e.where.en)
  else {
    // An author on the Low-tech Lab wiki: say which wiki.
    const t = e.tags.filter((x) => P.tag[tagKey(x)]).map((x) => (x === 'wiki' && e.link.includes('wiki.lowtechlab.org') ? P.ltlWiki : P.tag[tagKey(x)]))
    if (t.length) bits.push(t.join(', '))
  }
  return bits.filter(Boolean).join(' · ')
}

function Entry({ e, lang, showGroup }) {
  const P = ui.people
  return (
    <li className="pp-entry">
      <a className="pp-name" href={e.link} target="_blank" rel="noopener" hrefLang={e.langs[0]}>
        {e.title}<span className="pp-out" aria-hidden="true"> ↗</span>
        <span className="sr-only"> {P.newTab}</span>
      </a>
      <span className="pp-line">{e.line[lang] || e.line.en}</span>
      <span className="pp-meta">{showGroup ? P.groupShort[e.group] + ' · ' : ''}{entryMeta(e, lang)}</span>
    </li>
  )
}

export default function PeopleView({ go, lang, route, Crumbs, homeCrumb }) {
  const P = ui.people
  const [by, setBy] = useState(route.topic ? 'topic' : 'kind')
  const [langs, setLangs] = useState([])        // empty: every language
  const [formats, setFormats] = useState([])    // empty: every format
  useEffect(() => { if (route.topic) setBy('topic') }, [route.topic])
  // Arriving for a group (#pp-meet, from "Where to find help"): the page opens at its top, then
  // scrolls down to it where the reader can see it happen, and the section is marked a moment.
  const at = route.at || (typeof window !== 'undefined' && /^#pp-(learn|meet|ask)$/.test(window.location.hash) ? window.location.hash.slice(4) : null)
  const [arrived, setArrived] = useState(null)
  useEffect(() => {
    if (!at) return
    setBy('kind')
    const still = calm()
    const t1 = setTimeout(() => {
      const el = document.getElementById('pp-' + at)
      if (!el) return
      el.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
      setArrived(at)
    }, still ? 0 : 400)
    const t2 = setTimeout(() => setArrived(null), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [at])
  // Opened on a topic ("Who to ask" on a solution page): that section, once laid out.
  useEffect(() => {
    if (!route.topic) return
    const el = document.getElementById('pp-' + route.topic)
    if (el) el.scrollIntoView({ block: 'start' })
  }, [route.topic, by])

  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const shown = useMemo(() => PEOPLE.filter((e) =>
    (!langs.length || e.langs.some((l) => langs.includes(l)))
    && (!formats.length || e.group !== 'learn' || e.tags.some((t) => formats.includes(t)))
  ), [langs, formats])

  const sections = by === 'kind'
    ? GROUPS.map((g) => ({ key: g, title: P.groupHeading[g], sub: P.groupSub[g], items: shown.filter((e) => e.group === g) }))
    : [...TOPICS.map((t) => ({ key: t, title: P.topic[t], items: shown.filter((e) => e.topics.includes(t)) })),
       { key: 'across', title: P.acrossHeading, sub: P.acrossSub, items: shown.filter((e) => !e.topics.length) }]

  return (
    <div className="view people">
      <Crumbs go={go} trail={[homeCrumb(), { name: P.heading, route: null }]} />
      <h1>{P.heading}</h1>
      <p className="lede">{P.lede}</p>

      <div className="pp-controls">
        <div className="seg" role="group" aria-label={P.groupBy}>
          {[['kind', P.byKind], ['topic', P.byTopic]].map(([k, label]) => (
            <button key={k} type="button" className={'seg-item' + (by === k ? ' is-on' : '')}
                    aria-pressed={by === k} onClick={() => setBy(k)}>{label}</button>
          ))}
        </div>
        <div className="pp-filter" role="group" aria-label={P.languageLabel}>
          <span className="pp-filter-label" aria-hidden="true">{P.languageLabel}</span>
          {['fr', 'en'].map((l) => (
            <button key={l} type="button" className={'facet-chip' + (langs.includes(l) ? ' is-on' : '')}
                    aria-pressed={langs.includes(l)} onClick={() => toggle(langs, setLangs, l)}>
              {langs.includes(l) && <span aria-hidden="true">✓ </span>}{P.langChip[l]}
            </button>
          ))}
        </div>
        <div className="pp-filter" role="group" aria-label={P.formatLabel}>
          <span className="pp-filter-label" aria-hidden="true">{P.formatLabel}</span>
          {FORMATS.map((f) => (
            <button key={f} type="button" className={'facet-chip' + (formats.includes(f) ? ' is-on' : '')}
                    aria-pressed={formats.includes(f)} onClick={() => toggle(formats, setFormats, f)}>
              {formats.includes(f) && <span aria-hidden="true">✓ </span>}{P.formatChip[tagKey(f)]}
            </button>
          ))}
        </div>
        {formats.length > 0 && <p className="pp-filter-note">{P.formatNote}</p>}
      </div>

      {sections.map((s) => (
        <section key={s.key} id={'pp-' + s.key} className={'pp-section' + (arrived === s.key ? ' is-arrived' : '')} aria-labelledby={'pph-' + s.key}>
          <h2 id={'pph-' + s.key}>{s.title}{s.sub && <span className="pp-sub">{s.sub}</span>}</h2>
          {s.items.length
            ? <ul className="pp-list">{s.items.map((e) => <Entry key={e.id} e={e} lang={lang} showGroup={by === 'topic'} />)}</ul>
            : <p className="pp-none">{P.noneHere}</p>}
          {s.key === 'meet' && (
            <div className="pp-hello">
              <h3>{P.helloHeading}</h3>
              <p className="pp-hello-lead">{P.helloLead}</p>
              <ul className="pp-list">
                {P.hello.map((h) => (
                  <li key={h.id} className="pp-entry">
                    <a className="pp-name" href={h.link} target="_blank" rel="noopener" hrefLang={h.lang}>
                      {h.title}<span className="pp-out" aria-hidden="true"> ↗</span>
                      <span className="sr-only"> {P.newTab}</span>
                    </a>
                    <span className="pp-line">{h.line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}

      <p className="pp-foot">
        {P.footRules}{' '}
        <a href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(P.mailSubject)}`}>{P.writeUs}</a>
      </p>
      <p className="pp-foot">{fill(P.checked, { date: new Date(oldestCheck()).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
    </div>
  )
}

// The whole list was read by this date: the oldest entry's, so one recheck does not move it.
export const oldestCheck = () => PEOPLE.map((e) => e.checked).sort()[0] || ''

/*
 * Where to find help (brief 01, CM1 place 1): People and places, landing on its Meet section.
 * One generic line (Eric, 2026-10-21), the same on a solution page and in the house sheet.
 */
export function WhereToFindHelp({ go }) {
  const P = ui.people
  return (
    <p className="who-to-ask">
      {P.helpLine}{' '}
      <Nav route={{ view: 'people', at: 'meet' }} go={go} className="link">{P.heading}</Nav>
    </p>
  )
}
