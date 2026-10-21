import type { HeroBrandMarkOwnerProps } from '@onprem-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@onprem-ai/dsh-client-ui-sidebar/client'
import styles from './Brand.module.css'

/** The product name every brand surface shows. */
export const PRODUCT_NAME = 'Swiss Harness'

/**
 * The mark: a Swiss-flag cross in monochrome. The square takes the theme's
 * brand colour (near-black on light, near-white on dark) and the cross the
 * page background, so the pair inverts with the theme; the dark theme's black
 * cross is drawn wider (Brand.module.css) because it reads thinner. Corners are nearly
 * square (1-unit radius); the geometry reads at 24px in the sidebar and at
 * 34px in the hero without separate artwork. The mark draws at 80% of the
 * host-requested size and carries right-hand spacing (`.mark`).
 * @param props - Host-supplied size and optional placement class.
 * @returns the mark svg (aria-hidden; the name beside it carries meaning).
 */
export function OnpremBrandMark({ size, className }: { size: number; className?: string | undefined }) {
  return (
    <svg
      width={Math.round(size * 0.8)}
      height={Math.round(size * 0.8)}
      className={className === undefined ? styles.mark : `${styles.mark} ${className}`}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="1" fill="var(--dsw-alias-brand-primary, #0f1115)" />
      <rect className={styles.vertical} x="13" y="6" width="6" height="20" fill="var(--dsw-alias-bg-base, #fff)" />
      <rect className={styles.horizontal} x="6" y="13" width="20" height="6" fill="var(--dsw-alias-bg-base, #fff)" />
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
