import { JSX, memo } from 'react'
import { clsx } from '../../lib/clsx.ts'
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
        role === 'alert' && 'bg-error text-error-c',
        className,
      )}
    >
      {role === 'info' ? (
        <EyeIcon
          aria-hidden
          className={clsx('fill-current h-6 w-6', 'text-brand')}
        />
      ) : (
        <AlertIcon
          aria-hidden
          className={clsx(
            'fill-current h-6 w-6',
            role === 'alert' ? 'text-inherit' : 'text-brand',
          )}
        />
      )}

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
})
