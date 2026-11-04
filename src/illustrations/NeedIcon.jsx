import { needIconSvg } from './needIcons.js'
import './need-icon.css'

/**
 * A need's icon. Decorative by construction -- the SVG is aria-hidden -- because it is only
 * ever placed beside the need's name, and a screen reader hearing "Thermal comfort" twice
 * learns nothing from the second one.
 *
 * Renders nothing for an id with no icon, so a function added to the workbook tomorrow shows
 * its name without a gap rather than breaking the row.
 */
export default function NeedIcon({ id, size = 32 }) {
  const svg = needIconSvg(id, { size })
  if (!svg) return null
  return (
    <span className="nic-slot" style={{ width: size, height: size }}
          dangerouslySetInnerHTML={{ __html: svg }} />
  )
}
