import { clsx } from 'clsx'
import { JSX } from 'react'
import { Override } from '../../lib/util.ts'

export type ButtonProps = Override<
  JSX.IntrinsicElements['button'],
  {
    color?: 'primary' | 'grey'
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
        'cursor-pointer touch-manipulation overflow-hidden truncate rounded-md tracking-wide',
        square ? 'p-2' : 'px-6 py-2',
        color === 'primary'
          ? clsx(
              'accent-slate-100',
              transparent
                ? 'text-primary bg-transparent'
                : 'bg-primary text-primary-contrast',
            )
          : color === 'grey'
            ? clsx(
                'accent-primary',
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
