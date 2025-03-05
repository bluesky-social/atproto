import { Trans } from '@lingui/react/macro'
import { JSX } from 'react'
import { LinkDefinition } from '../../backend-types'
import { Override } from '../../lib/util'

export type LinkNameProps = Override<
  JSX.IntrinsicElements['span'],
  {
    link: LinkDefinition
  }
>
export function LinkTitle({ link, ...props }: LinkNameProps) {
  return (
    <span {...props}>
      {link.rel === 'bookmark' ? (
        <Trans>Home</Trans>
      ) : link.rel === 'privacy-policy' ? (
        <Trans>Privacy Policy</Trans>
      ) : link.rel === 'terms-of-service' ? (
        <Trans>Terms of Service</Trans>
      ) : link.rel === 'help' ? (
        <Trans>Support</Trans>
      ) : (
        link.title
      )}
    </span>
  )
}
