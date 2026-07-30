import { Trans } from '@lingui/react/macro'
import { clsx } from 'clsx'
import type { JSX } from 'react'
import type { LinkDefinition } from '@atproto/oauth-provider-api'
import type { Override } from '#/lib/util.ts'
import { LinkAnchor } from './link-anchor.js'

export type HelpCardProps = Override<
  Omit<JSX.IntrinsicElements['p'], 'children'>,
  {
    links?: readonly LinkDefinition[]
  }
>

export function HelpCard({
  links,

  className,
  ...props
}: HelpCardProps) {
  const helpLink = links?.find((l) => l.rel === 'help')

  if (!helpLink) return null

  return (
    <p
      {...props}
      className={clsx(
        'text-foreground bg-muted rounded-md p-3 text-sm',
        className,
      )}
    >
      <Trans>
        Having trouble?{' '}
        <LinkAnchor link={helpLink} className="text-foreground underline">
          <Trans>Contact support</Trans>
        </LinkAnchor>
      </Trans>
    </p>
  )
}
