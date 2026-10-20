import type { HeroBrandMarkOwnerProps } from '@onprem-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@onprem-ai/dsh-client-ui-sidebar/client'

/** The product name every brand surface shows. */
export const PRODUCT_NAME = 'Swiss Harness'

/**
 * The mark: the Swiss flag, a red square with a white cross, in fixed colours
 * so it reads the same on light and dark themes. Corners are nearly square
 * (1-unit radius); the geometry stays plain so it reads at 24px in the sidebar
 * and at 34px in the hero without separate artwork.
 * @param props - Host-supplied size and optional placement class.
 * @returns the mark svg (aria-hidden; the name beside it carries meaning).
 */
export function OnpremBrandMark({ size, className }: { size: number; className?: string | undefined }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="1" fill="#DA291C" />
      <rect x="13" y="6" width="6" height="20" fill="#FFFFFF" />
      <rect x="6" y="13" width="20" height="6" fill="#FFFFFF" />
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
