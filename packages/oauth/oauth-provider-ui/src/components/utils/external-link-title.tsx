import { Trans } from '@lingui/react/macro'
import { ReactNode } from 'react'
import type { LinkDefinition } from '@atproto/oauth-provider-api'
import { useLangString } from './lang-string.tsx'

export function ExternalLinkTitle({
  link,
}: {
  link: LinkDefinition
}): ReactNode {
  const title = useLangString(link.title)
  if (title) return title

  // Fallback
  if (link.rel === 'canonical') return <Trans>Home</Trans>
  if (link.rel === 'privacy-policy') return <Trans>Privacy Policy</Trans>
  if (link.rel === 'terms-of-service') return <Trans>Terms of Service</Trans>
  if (link.rel === 'help') return <Trans>Support</Trans>

  // English version
  return typeof link.title === 'object'
    ? link.title['en'] || Object.values(link.title).find(Boolean)
    : link.title
}
