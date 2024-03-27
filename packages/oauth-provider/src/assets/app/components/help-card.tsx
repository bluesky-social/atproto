import { HTMLAttributes } from 'react'
import { LinkDefinition } from '../backend-data'
import { clsx } from '../lib/clsx'

export type HelpCardProps = {
  links?: readonly LinkDefinition[]
}

export function HelpCard({
  links,

  className,
  ...attrs
}: HelpCardProps &
  Omit<
    HTMLAttributes<HTMLParagraphElement>,
    keyof HelpCardProps | 'children'
  >) {
  const helpLink = links?.find((l) => l.rel === 'help')

  if (!helpLink) return null

  return (
    <p
      className={clsx(
        'text-sm rounded-md bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 p-3',
        className,
      )}
      {...attrs}
    >
      Having trouble?{' '}
      <a
        href={helpLink.href}
        rel={helpLink.rel}
        target="_blank"
        className="text-primary"
      >
        Contact {helpLink.title}
      </a>
    </p>
  )
}
