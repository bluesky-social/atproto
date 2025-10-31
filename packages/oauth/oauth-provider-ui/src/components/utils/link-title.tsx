import { useLingui } from '@lingui/react/macro'
import { ReactNode } from 'react'
import type { LinkDefinition } from '@atproto/oauth-provider-api'
import { useLangString } from './lang-string.tsx'

export type LinkNameProps = {
  link: LinkDefinition
}

export function LinkTitle({ link }: LinkNameProps): ReactNode {
  const { t } = useLingui()

  const title = useLangString(link.title)
  if (title) return title

  // Fallback
  if (link.rel === 'canonical') return t`Home`
  if (link.rel === 'privacy-policy') return t`Privacy Policy`
  if (link.rel === 'terms-of-service') return t`Terms of Service`
  if (link.rel === 'help') return t`Support`

  // English version
  return typeof link.title === 'object'
    ? link.title['en'] || Object.values(link.title).find(Boolean)
    : link.title
}
