// Platform adapter: the only place the app touches device-native features, so Capacitor plugins
// can replace these later.

// The project's public address. Email rather than GitHub issues: this audience mostly has no
// GitHub account. On the project's domain so it can be handed over.
export const FEEDBACK_EMAIL = 'eric@lowtechgraph.org'

/*
 * True where the system share sheet is the right answer rather than merely available: on a
 * laptop, navigator.share opens an app list with no way to copy the link.
 */
export function prefersShareSheet() {
  if (typeof navigator === 'undefined' || !navigator.share) return false
  if (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches) return true
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

/*
 * Hand a link to the system share sheet. `text` is not passed: Android concatenates it with the
 * title, repeating the name. Returns false when unavailable or dismissed.
 */
export async function shareLink({ title, url }) {
  if (!navigator.share) return false
  try {
    await navigator.share({ title, url })
    return true
  } catch {
    return false
  }
}

/*
 * Copy text: the async clipboard, then execCommand, then return false and let the caller say
 * so. No words here: the strings file owns them.
 */
export async function copyText(text, selectEl) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch { /* insecure origin, permission policy, or no user gesture */ }
  if (selectEl && selectEl.select) {
    selectEl.select()
    try {
      if (document.execCommand('copy')) return true
    } catch { /* deprecated, and still the one that works sometimes */ }
  }
  return false
}

export function sendFeedback(subject, body) {
  const href =
    `mailto:${FEEDBACK_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  window.location.href = href
}
