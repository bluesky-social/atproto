import { Trans } from '@lingui/react/macro'
import type { JSX, ReactNode } from 'react'
import type { LinkDefinition } from '@atproto/oauth-provider-api'
import { LinkAnchor } from '#/components/utils/link-anchor.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

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
    <p className={cn('text-muted-foreground text-sm', className)} {...attrs}>
      <Trans>
        By creating an account you agree to the{' '}
        <ConditionalLink link={tosLink}>Terms of Service</ConditionalLink>
        {' and the '}
        <ConditionalLink link={ppLink}>Privacy Policy</ConditionalLink>
        {' of this service.'}
      </Trans>
    </p>
  )
}

function ConditionalLink({
  link,
  children,
}: {
  link: LinkDefinition | undefined
  children: ReactNode
}) {
  if (link) {
    return (
      <LinkAnchor className="text-foreground underline" link={link}>
        {children}
      </LinkAnchor>
    )
  }
  return <>{children}</>
}
