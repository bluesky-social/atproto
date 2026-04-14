import { Trans } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX } from 'react'
import type { LinkDefinition } from '@atproto/oauth-provider-api'
import { Override } from '#/lib/util.ts'
import { LinkAnchor } from './link-anchor'

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
        'text-text-default rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-800',
        className,
      )}
    >
      <Trans>
        Having trouble?{' '}
        <LinkAnchor link={helpLink} className="text-primary underline">
          <Trans>Contact support</Trans>
        </LinkAnchor>
      </Trans>
    </p>
  )
}
