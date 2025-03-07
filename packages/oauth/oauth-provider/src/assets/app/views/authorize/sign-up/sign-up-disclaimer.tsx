import { Trans } from '@lingui/react/macro'
import { JSX } from 'react'
import { LinkDefinition } from '../../../backend-types.ts'
import { LinkAnchor } from '../../../components/utils/link-anchor.tsx'
import { clsx } from '../../../lib/clsx.ts'
import { Override } from '../../../lib/util.ts'

export type SignUpDisclaimerProps = Override<
  Omit<JSX.IntrinsicElements['p'], 'children'>,
  {
    links?: readonly LinkDefinition[]
  }
>

export function SignUpDisclaimer({
  links,

  // p
  className,
  ...attrs
}: SignUpDisclaimerProps) {
  const tosLink = links?.find((l) => l.rel === 'terms-of-service')
  const ppLink = links?.find((l) => l.rel === 'privacy-policy')

  return (
    <p
      className={clsx('text-sm text-slate-500 dark:text-slate-400', className)}
      {...attrs}
    >
      <Trans>
        By creating an account you agree to the{' '}
        {tosLink ? (
          <LinkAnchor className="text-brand underline" link={tosLink}>
            <Trans>Terms of Service</Trans>
          </LinkAnchor>
        ) : (
          <Trans>Terms of Service</Trans>
        )}
        {' and the '}
        {ppLink ? (
          <LinkAnchor className="text-brand underline" link={ppLink}>
            <Trans>Privacy Policy</Trans>
          </LinkAnchor>
        ) : (
          <Trans>Privacy Policy</Trans>
        )}{' '}
        of this service.
      </Trans>
    </p>
  )
}
