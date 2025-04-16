import { Trans } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX } from 'react'
import type { LinkDefinition } from '@atproto/oauth-provider-api'
import { Override } from '../../lib/util.ts'

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
        'rounded-md bg-slate-100 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-400',
        className,
      )}
    >
      <Trans>
        Having trouble?{' '}
        <a
          role="link"
          href={helpLink.href}
          rel={helpLink.rel}
          target="_blank"
          className="text-primary"
        >
          <Trans>Contact support</Trans>
        </a>
      </Trans>
    </p>
  )
}
