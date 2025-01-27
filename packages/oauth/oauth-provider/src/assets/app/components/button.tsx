import { ButtonHTMLAttributes } from 'react'
import { clsx } from '../lib/clsx'

export function Button({
  children,
  className,
  type = 'button',
  role = 'Button',
  color = 'grey',
  disabled = false,
  transparent = false,
  loading = undefined,
  ...props
}: {
  color?: 'brand' | 'grey'
  loading?: boolean
  transparent?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      role={role}
      type={type}
      disabled={disabled || loading === true}
      {...props}
      className={clsx(
        'py-2 px-6 rounded-lg truncate cursor-pointer touch-manipulation tracking-wide overflow-hidden',
        color === 'brand'
          ? transparent
            ? 'bg-transparent text-brand'
            : 'bg-brand text-white'
          : clsx(
              'text-slate-600 dark:text-slate-300',
              'hover:bg-slate-200 dark:hover:bg-slate-700',
              transparent ? 'bg-transparent' : 'bg-slate-100 dark:bg-slate-800',
            ),
        className,
      )}
    >
      {children}
    </button>
  )
}
