import { useEffect, useState } from 'react'
import * as cat from './catalogue'
import { ui, fill } from './ui-strings'

// The photos' data loads on its own, after the first page (qa-budget, 2026-11-26: twelve photos with
// their alt text in two languages took the first load over its budget). App.jsx warms it when idle.
let MEDIA = null
let loading = null
export function warmMedia() {
  if (!loading) loading = import('./data/solution-media.json').then((m) => { MEDIA = m.default; return MEDIA })
  return loading
}

// The video tab plays the solution's first YouTube tutorial, in the reading language if it has one.
const youtubeId = (url) => {
  const m = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(url || '')
  return m ? m[1] : null
}

/*
 * The drawing, a photo and a video as tabs in one frame (R1, Eric 2026-11-22: readers asked
 * to see the real thing, and tabs keep the page from growing). The drawing comes first and is the
 * default: it is what the catalogue makes; the photo and the video are someone else's.
 *
 * Nothing third-party loads until asked: the photo is a local copy, and the video frame is built
 * only when the reader presses play, with a line saying it comes from YouTube.
 *
 * Kept 2026-11-22 (Eric): the Video tab on every solution with a YouTube tutorial; photos only
 * where the workbook's Media sheet has one (R1-b, 2026-11-23), exported to data/solution-media.json.
 */
export default function SolutionMedia({ sol, drawing }) {
  const M = ui.solutionPage.media
  const lang = cat.getLang()
  const [all, setAll] = useState(MEDIA)
  useEffect(() => {
    let live = true
    if (!all) warmMedia().then((m) => { if (live) setAll(m) })
    return () => { live = false }
  }, [all])
  const media = all ? all[sol.id] : null
  const vids = (sol.tutorials || []).filter((t) => t.format === 'video' && youtubeId(t.url))
  const video = vids.find((t) => t.lang === lang) || vids[0]
  const [tab, setTab] = useState('drawing')
  const [playing, setPlaying] = useState(false)
  if (!media && !video) return drawing

  const tabs = [['drawing', M.drawing], ...(media?.photo ? [['photo', M.photo]] : []), ...(video ? [['video', M.video]] : [])]
  const pid = `media-${sol.id}`
  const p = media?.photo
  return (
    <section className="media" aria-label={M.label}>
      <div className="media-tabs" role="tablist" aria-label={M.label}>
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`${pid}-${k}`} aria-selected={tab === k}
                  aria-controls={`${pid}-panel`} className={'media-tab' + (tab === k ? ' is-on' : '')}
                  onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="media-panel" role="tabpanel" id={`${pid}-panel`} aria-labelledby={`${pid}-${tab}`}>
        {tab === 'drawing' && drawing}
        {tab === 'photo' && p && (
          <figure className="media-photo">
            {/* Never wider than its own pixels: a small diagram stays sharp (R1-b6, 2026-11-26). */}
            <img src={p.src} width={p.w} height={p.h} alt={p.alt[lang] || p.alt.en} loading="lazy" decoding="async"
                 style={p.w ? { maxWidth: `min(${p.w}px, 720px, 100%)` } : undefined} />
            <figcaption className="media-credit">
              {/* i18n-ok: the author's own name */}
              {fill(M.photoBy, { author: p.author })}{' · '}
              <a href={p.licence_url} target="_blank" rel="noreferrer license">{p.licence}</a>{' · '}
              <a href={p.page} target="_blank" rel="noreferrer">{M.photoSource}</a>
            </figcaption>
          </figure>
        )}
        {tab === 'video' && video && (
          <div className="media-video">
            {playing ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId(video.url)}?autoplay=1&rel=0`}
                title={video.title || M.video} allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
            ) : (
              <div className="media-video-wait">
                {/* i18n-ok: the video's own title, in its own language */}
                <p className="media-video-title" lang={video.lang || undefined}>{video.title}</p>
                {video.maker && <p className="media-credit">{fill(M.videoBy, { maker: video.maker })}</p>}
                <button type="button" className="btn secondary" onClick={() => setPlaying(true)}>
                  <span aria-hidden="true">▶ </span>{M.play}
                </button>
                <p className="media-credit">{M.videoNote}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
