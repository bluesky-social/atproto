import { Trans } from '@lingui/react/macro'
import { LinkDefinition } from '../../backend-types.ts'
import { MultiLangString } from './multi-lang-string.tsx'

export type LinkNameProps = {
  link: LinkDefinition
}

export function LinkTitle({ link }: LinkNameProps) {
  return (
    <MultiLangString
      value={link.title}
      fallback={
        link.rel === 'canonical' ? (
          <Trans>Home</Trans>
        ) : link.rel === 'privacy-policy' ? (
          <Trans>Privacy Policy</Trans>
        ) : link.rel === 'terms-of-service' ? (
          <Trans>Terms of Service</Trans>
        ) : link.rel === 'help' ? (
          <Trans>Support</Trans>
        ) : undefined
      }
    />
  )
}
