// The one test for reduced motion (B11): every animation asks here, so they all follow the
// reader's setting the same way. Safe where there is no window (prerender).
export const calm = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
