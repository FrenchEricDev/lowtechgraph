// Page translators (Chrome's own, and others) swap the text nodes React wrote for <font> wrappers,
// so the node React later removes, or inserts beside, is no longer where React left it. React then
// throws NotFoundError while committing, and the whole app unmounts to a blank page: a reader on
// Chrome Translate lost the site on opening My system (2026-11-27). Where the node React means has
// left that parent, do the nearest harmless thing instead of throwing: leave it out, or append.
// The workaround from facebook/react#11538. Checked by scripts/qa-resilience.mjs.
if (typeof Node === 'function' && Node.prototype) {
  const { removeChild, insertBefore } = Node.prototype
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) return child
    return removeChild.call(this, child)
  }
  Node.prototype.insertBefore = function (node, ref) {
    return insertBefore.call(this, node, ref && ref.parentNode !== this ? null : ref)
  }
}
