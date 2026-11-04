import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/*
 * What makes a box a dialog for a keyboard: focus moves into it on opening, Tab stays inside it,
 * Escape closes it, and focus goes back to whatever opened it. `fallback` names where focus goes
 * when the opener is gone (a picker opened from a chip whose card was replaced).
 * Returns the ref to put on the dialog's box, which needs tabIndex={-1}.
 */
export default function useDialog(onClose, fallback = '.tree-toolbar button') {
  const box = useRef(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  // Read during the first render: by the time an effect runs, an autofocus field inside the
  // dialog has already taken the focus from whatever opened it.
  const openerRef = useRef(undefined)
  if (openerRef.current === undefined) openerRef.current = document.activeElement || null

  useEffect(() => {
    const el = box.current
    const opener = openerRef.current
    if (el && !el.contains(document.activeElement)) {
      // An autofocus field inside wins; otherwise the box itself, so the title is read first.
      (el.querySelector('[autofocus]') || el).focus({ preventScroll: true })
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return }
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
      if (!items.length) { e.preventDefault(); return }
      const first = items[0], last = items[items.length - 1]
      const at = document.activeElement
      if (e.shiftKey && (at === first || at === el || !el.contains(at))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (at === last || !el.contains(at))) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      const back = opener && opener !== document.body && document.contains(opener)
        // The first fallback on screen: the desktop and phone openers are both in the DOM.
        ? opener : [...document.querySelectorAll(fallback)].find((n) => n.offsetParent !== null)
      if (back) back.focus({ preventScroll: true })
    }
  }, [fallback])

  return box
}
