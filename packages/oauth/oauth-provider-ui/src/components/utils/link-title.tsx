import { useLingui } from '@lingui/react/macro'
import type { LinkDefinition } from '@atproto/oauth-provider-api'
import { useLangString } from './lang-string.tsx'

export type LinkNameProps = {
  link: LinkDefinition
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
