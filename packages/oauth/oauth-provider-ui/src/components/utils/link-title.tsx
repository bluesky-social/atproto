import { Trans, useLingui } from '@lingui/react/macro'
import type { LinkDefinition } from '@atproto/oauth-provider-api'
import { useLangString } from './lang-string.tsx'

export type LinkNameProps = {
  link: LinkDefinition
}

/**
 * Names the standard links by one word each — "Terms" rather than "Terms of
 * Service" — keyed on the link's `rel`, so all four fit on one line at phone
 * width. A link with any other `rel` keeps its own title.
 *
 * Used by both shells, so a deployment's footer reads the same on the auth
 * screens and in the account dashboard.
 */
export function ShortLinkTitle({ link }: LinkNameProps) {
  switch (link.rel) {
    case 'canonical':
      return <Trans>Home</Trans>
    case 'terms-of-service':
      return <Trans>Terms</Trans>
    case 'privacy-policy':
      return <Trans>Privacy</Trans>
    case 'help':
      return <Trans>Support</Trans>
    default:
      return <LinkTitle link={link} />
  }
}

export function LinkTitle({ link }: LinkNameProps): string | undefined {
  const { t } = useLingui()

  const title = useLangString(link.title)
  if (title) return title

  // Fallback
  if (link.rel === 'canonical') return t`Home`
  if (link.rel === 'privacy-policy') return t`Privacy Policy`
  if (link.rel === 'terms-of-service') return t`Terms of Service`
  if (link.rel === 'help') return t`Support`

  if (typeof link.title === 'object') {
    // English version, or any version if English is not available
    return link.title['en'] || Object.values(link.title).find(Boolean)
  }

  return link.title
}
