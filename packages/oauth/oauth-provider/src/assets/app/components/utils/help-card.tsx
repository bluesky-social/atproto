import { Trans } from '@lingui/react/macro'
import { JSX } from 'react'
import { LinkDefinition } from '../../backend-types.ts'
import { clsx } from '../../lib/clsx.ts'
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
        'text-sm rounded-md bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 p-3',
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
          className="text-brand"
        >
          <Trans>Contact support</Trans>
        </a>
      </Trans>
    </p>
  )
}
