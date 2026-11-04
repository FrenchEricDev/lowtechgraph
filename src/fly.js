import { calm } from './motion.js'
/*
 * The chip that flies from where something was added to where it is counted: to the Build link
 * (AddToTree.jsx) and, inside the builder, from a new card to the "Your picks" vignette
 * (BuiltHouse.jsx). One motion for both, so the reader learns it once.
 *
 * `land` is where on the target the chip ends: 'corner' (a badge's corner) or 'center'.
 * `onLand` always runs, straight away when motion is reduced or an end is missing, so callers
 * can hang their own highlight on it without a second code path.
 */
export function flyChip(fromEl, toEl, text, { land = 'corner', onLand } = {}) {
  const done = () => { if (onLand) onLand() }
  if (!fromEl || !toEl || calm()) { done(); return }
  const a = visibleRect(fromEl)
  const b = toEl.getBoundingClientRect()
  if (!b.width) { done(); return }
  const chip = document.createElement('span')
  chip.className = 'fly-chip'
  chip.setAttribute('aria-hidden', 'true')
  chip.textContent = text
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2
  chip.style.left = x0 + 'px'
  chip.style.top = y0 + 'px'
  document.body.appendChild(chip)
  const x1 = land === 'center' ? b.left + b.width / 2 : b.right - 6
  const y1 = land === 'center' ? b.top + b.height / 2 : b.top + 4
  const dx = x1 - x0, dy = y1 - y0
  // A shallow arc: up and over, rather than a straight line across the page.
  const lift = Math.min(120, Math.abs(dy) * 0.25 + 40)
  const anim = chip.animate([
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
    { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - lift}px)) scale(.95)`, opacity: 1, offset: 0.45 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`, opacity: 0.5 },
  ], { duration: 650, easing: 'cubic-bezier(.45, 0, .55, 1)' })
  // Once only, and on a timer too: a page that is not being drawn (a background tab) holds the
  // animation, and whatever the caller held back for the landing must still appear.
  let landed = false
  const finish = () => { if (landed) return; landed = true; chip.remove(); done() }
  anim.onfinish = finish
  anim.oncancel = finish
  setTimeout(finish, 1000)
}

// Replays a one-shot class (the landing bump), even when it is still running from last time.
export function bump(el, cls = 'is-bumped', ms = 450) {
  if (!el) return
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
  setTimeout(() => el.classList.remove(cls), ms)
}

// The element's box, or the middle of the screen when it sits outside it (a card placed off the
// visible part of the canvas): a chip should never start from nowhere.
function visibleRect(el) {
  const r = el.getBoundingClientRect()
  const onScreen = r.width && r.bottom > 0 && r.right > 0
    && r.top < window.innerHeight && r.left < window.innerWidth
  if (onScreen) return r
  return { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 }
}
