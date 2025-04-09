import { clsx } from 'clsx'
import { JSX, memo } from 'react'
import { Override } from '../../lib/util.ts'
import { AlertIcon, EyeIcon } from './icons.tsx'

export type AdmonitionProps = Override<
  JSX.IntrinsicElements['div'],
  {
    role: 'alert' | 'status' | 'info'
  }
>

export const Admonition = memo(function Admonition({
  role = 'alert',
  children,
  className,
  ...props
}: AdmonitionProps) {
  return (
    <div
      {...props}
      role={role}
      className={clsx(
        'flex flex-row',
        'gap-2',
        'p-3',
        'rounded-lg',
        'border',
        'border-gray-300 dark:border-gray-700',
        role === 'alert' && 'bg-error text-error-contrast',
        className,
      )}
    >
      {role === 'info' ? (
        <EyeIcon
          aria-hidden
          className={clsx('h-6 w-6 fill-current', 'text-primary')}
        />
      ) : (
        <AlertIcon
          aria-hidden
          className={clsx(
            'h-6 w-6 fill-current',
            role === 'alert' ? 'text-inherit' : 'text-primary',
          )}
        />
      )}

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
})
