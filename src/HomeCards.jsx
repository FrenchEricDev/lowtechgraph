import { useState, useEffect, useRef, useCallback } from 'react'
import Nav from './Nav'
import { ui, fill } from './ui-strings'
import { heroSlides, sectionCards, guide } from './content'

// The homepage blocks: a hero carousel, a card, and a titled row of cards. All content comes
// from src/content/ (content.js); none is authored here.

/*
 * The hero: images carrying their own text, per language. The slide is one link; prev, next and
 * the dots sit outside it, since a control stacked on a link is a coin-flip for which gets the
 * tap.
 */
export function HeroCarousel({ lang, go }) {
  const slides = heroSlides(lang)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length

  const at = useCallback((k) => setI(((k % n) + n) % n), [n])

  // Swiping, with pointer events (finger, pen, mouse). The hard part is the tap: the slide is a
  // link, so a swipe sets a flag and the capture-phase click handler eats the click that
  // follows. The flag is cleared on the next pointerdown. Vertical drags are ignored and
  // `touch-action: pan-y` keeps the page scrolling.
  const drag = useRef(null)
  const swiped = useRef(false)
  const SWIPE_MIN = 40      // px: below this a flick is indistinguishable from a tap

  const onPointerDown = (e) => {
    if (n < 2) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    swiped.current = false
    drag.current = { x: e.clientX, y: e.clientY }
    // Only touch and pen pause here; a mouse is handled by hover.
    if (e.pointerType !== 'mouse') setPaused(true)
  }

  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    if (e.pointerType !== 'mouse') setPaused(false)
    if (!d || n < 2) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    // Horizontal intent, or it was a scroll.
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return
    swiped.current = true
    // The functional form: two flicks before a re-render must not both step from the same
    // index.
    setI((k) => (k + (dx < 0 ? 1 : n - 1)) % n)
  }

  const onPointerCancel = () => {
    drag.current = null
    setPaused(false)
  }

  // Runs before the link's own handler: the only place a swipe can cancel the navigation.
  const onClickCapture = (e) => {
    if (!swiped.current) return
    e.preventDefault()
    e.stopPropagation()
  }

  // Auto-advance, unless the reader asked for less motion or is interacting.
  useEffect(() => {
    if (n < 2 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((k) => (k + 1) % n), 7000)
    return () => clearInterval(t)
  }, [n, paused])

  if (!n) return null

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); at(i - 1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); at(i + 1) }
  }

  return (
    <section className="hero" aria-roledescription="carousel" aria-label={ui.home.heroLabel}
             onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
             onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
             onPointerDown={onPointerDown} onPointerUp={onPointerUp}
             onPointerCancel={onPointerCancel} onClickCapture={onClickCapture}
             onKeyDown={onKey}>
      <div className="hero-track">
        {slides.map((s, k) => (
          <div key={s.slot} className={'hero-slide' + (k === i ? ' is-on' : '')}
               aria-hidden={k !== i} inert={k !== i}>
            <Nav route={s.to} go={go} className="hero-link">
              {s.image
                ? <img src={s.image} alt={s.alt || s.title} className="hero-img" />
                /* No artwork yet: the title still shows where the slide goes. */
                : <span className="hero-fallback">{s.title}</span>}
            </Nav>
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button className="hero-arrow prev" onClick={() => at(i - 1)}
                  aria-label={ui.home.heroPrev}>‹</button>
          <button className="hero-arrow next" onClick={() => at(i + 1)}
                  aria-label={ui.home.heroNext}>›</button>
          <div className="hero-dots">
            {slides.map((s, k) => (
              <button key={s.slot} className={'hero-dot' + (k === i ? ' is-on' : '')}
                      aria-current={k === i} onClick={() => at(k)}
                      aria-label={fill(ui.home.heroGoTo, { n: k + 1 })} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/*
 * One card: visual, title, text and a button, the visual and button going to the same place.
 * The text is clamped to three lines and expands in place. The expand control shows only when
 * the clamped box actually overflows: measure the clamped state, since an unclamped paragraph
 * never overflows.
 */
export function ContentCard({ card, go, lang }) {
  const [open, setOpen] = useState(false)
  const [clamped, setClamped] = useState(false)
  const textRef = useRef(null)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    const measure = () => {
      // Measure the clamped state, never the expanded one.
      if (open) return
      setClamped(el.scrollHeight - el.clientHeight > 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, card.text])

  // Resolve {n} against the guide this card points at.
  const picks = card.to?.view === 'guide' ? guide(card.to.id, lang)?.picks?.length : null
  const ctaText = card.cta && card.cta.includes('{n}') && picks
    ? fill(card.cta, { n: picks })
    : card.cta

  return (
    <article className="ccard">
      <Nav route={card.to} go={go} className="ccard-visual" tabIndex={-1} aria-hidden="true">
        {card.image
          ? <img src={card.image} alt="" className="ccard-img" />
          : <span className="ccard-img is-empty" />}
      </Nav>
      <div className="ccard-body">
        <h3 className="ccard-title">{card.title}</h3>
        {card.text && (
          <p ref={textRef} className={'ccard-text' + (open ? ' is-open' : '')}>
            {card.text}
          </p>
        )}
        {(clamped || open) && (
          <button className="ccard-more" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? ui.home.cardCollapse : ui.home.cardExpand}
          </button>
        )}
        {card.cta && (
          /* The count is read from the guide, never typed into the card. */
          <Nav route={card.to} go={go} className="btn ccard-cta">{ctaText}</Nav>
        )}
      </div>
    </article>
  )
}

/*
 * A titled row of cards: the heading comes from ui-strings, the cards from folders. A section
 * with no filled slots renders nothing, heading included.
 */
export function CardSection({ name, heading, lang, go }) {
  const cards = sectionCards(name, lang)
  if (!cards.length) return null
  return (
    <section className="csection">
      <h2 className="csection-title">{heading}</h2>
      <div className="ccards" data-count={cards.length}>
        {cards.map((c) => <ContentCard key={c.slot} card={c} go={go} lang={lang} />)}
      </div>
    </section>
  )
}
