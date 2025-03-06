import { memo, JSX } from 'react'
import { clsx, cx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'
import { AlertIcon } from './icons.tsx'

export type Props = Override<
  JSX.IntrinsicElements['div'],
  {
    role: 'alert' | 'status'
  }
>

export const Admonition = memo(function Admonition({
  role = 'alert',
  children,
  className,
  ...props
}: Props) {
  return (
    <div
      {...props}
      className={cx([
        'flex',
        'flex-row',
        'gap-2',
        'p-3',
        'rounded-lg',
        'border',
        'border-gray-300 dark:border-gray-700',
        role === 'alert' && 'bg-error',
        className,
      ])}
    >
      <AlertIcon
        aria-hidden
        className={clsx(
          'fill-current h-6 w-6',
          role === 'alert' ? 'text-error-c' : 'text-brand',
        )}
      />

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
})
