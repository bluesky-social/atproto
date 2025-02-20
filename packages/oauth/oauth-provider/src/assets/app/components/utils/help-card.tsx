import { JSX } from 'react'
import { LinkDefinition } from '../../backend-data'
import { clsx } from '../../lib/clsx'
import { Override } from '../../lib/util'

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

  // @TODO translate
  return (
    <p
      {...props}
      className={clsx(
        'text-sm rounded-md bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 p-3',
        className,
      )}
    >
      Having trouble?{' '}
      <a
        role="link"
        href={helpLink.href}
        rel={helpLink.rel}
        target="_blank"
        className="text-brand"
      >
        Contact {helpLink.title}
      </a>
    </p>
  )
}
