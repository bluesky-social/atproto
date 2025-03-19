import { JSX } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'

export type ButtonProps = Override<
  JSX.IntrinsicElements['button'],
  {
    color?: 'brand' | 'grey'
    loading?: boolean
    transparent?: boolean
    square?: boolean
  }
>

export function Button({
  color = 'grey',
  transparent = false,
  loading = undefined,
  square = false,

  // button
  children,
  className,
  type = 'button',
  role = 'Button',
  disabled = false,
  ...props
}: ButtonProps) {
  return (
    <button
      role={role}
      type={type}
      disabled={disabled || loading === true}
      {...props}
      className={clsx(
        'rounded-lg truncate cursor-pointer touch-manipulation tracking-wide overflow-hidden',
        square ? 'p-2' : 'py-2 px-6',
        color === 'brand'
          ? clsx(
              'accent-slate-100',
              transparent
                ? 'bg-transparent text-brand'
                : 'bg-brand text-brand-c',
            )
          : color === 'grey'
            ? clsx(
                'accent-brand',
                'text-slate-600 dark:text-slate-300',
                'hover:bg-gray-200 dark:hover:bg-gray-700',
                transparent ? 'bg-transparent' : 'bg-gray-100 dark:bg-gray-800',
              )
            : undefined,
        'disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  )
}
