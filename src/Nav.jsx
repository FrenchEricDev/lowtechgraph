import * as cat from './catalogue'
import { pathFor } from './router'

/*
 * An internal link: a real anchor with a real href, intercepting only the plain left click, so
 * middle-click, ctrl-click, copy link and the status bar all work. Anything the browser should
 * handle returns before preventDefault; preventDefault runs before go(), so a throw in routing
 * cannot become a full page load.
 */
function Nav({ route, go, href, onNavigate, children, ...rest }) {
  const onClick = (e) => {
    if (e.defaultPrevented) return
    if (e.button !== 0) return                                    // not a primary click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return  // new tab, window, download
    e.preventDefault()
    if (onNavigate) onNavigate()
    else go(route)
  }
  // href/onNavigate are for the language switch, which replaces the URL rather than pushing an
  // entry.
  return <a href={href ?? pathFor(route, cat.getLang())} onClick={onClick} {...rest}>{children}</a>
}

export default Nav
