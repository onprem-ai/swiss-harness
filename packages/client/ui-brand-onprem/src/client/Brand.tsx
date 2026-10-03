import type { HeroBrandMarkOwnerProps } from '@onprem-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@onprem-ai/dsh-client-ui-sidebar/client'

/** The product name every brand surface shows. */
export const PRODUCT_NAME = 'Swiss Harness'

/**
 * The mark: a rounded square carrying an equal-armed cross, drawn in
 * currentColor so it follows the surrounding text colour in both themes.
 * The geometry is deliberately plain so it reads at 24px in the sidebar and
 * at 34px in the hero without separate artwork.
 * @param props - Host-supplied size and optional placement class.
 * @returns the mark svg (aria-hidden; the name beside it carries meaning).
 */
export function OnpremBrandMark({ size, className }: { size: number; className?: string | undefined }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="currentColor" />
      <rect x="10" y="5" width="4" height="14" rx="1" fill="var(--dsw-alias-background-primary, #fff)" />
      <rect x="5" y="10" width="14" height="4" rx="1" fill="var(--dsw-alias-background-primary, #fff)" />
    </svg>
  )
}

/**
 * Render the sidebar mark at the size the sidebar requests.
 * @param props - Host-supplied mark presentation.
 * @returns the mark.
 */
export function SidebarBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <OnpremBrandMark size={size} />
}

/**
 * Render the product name as text; the sidebar's own brand-name styles size it.
 * @returns the name.
 */
export function SidebarBrandName() {
  return <span>{PRODUCT_NAME}</span>
}

/**
 * Render the hero mark with the geometry class the hero supplies.
 * @param props - Host-supplied size and placement class.
 * @returns the mark.
 */
export function HeroBrandMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <OnpremBrandMark size={size} className={className} />
}
