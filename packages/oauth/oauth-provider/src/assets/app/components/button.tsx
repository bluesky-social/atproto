import { ButtonHTMLAttributes } from 'react'
import { clsx } from '../lib/clsx'

export function Button({
  children,
  className,
  type = 'button',
  role = 'Button',
  color = 'grey',
  disabled = false,
  loading = undefined,
  ...props
}: {
  color?: 'brand' | 'grey'
  loading?: boolean
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
          ? 'bg-brand text-white'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300',
        className,
      )}
    >
      {children}
    </button>
  )
}
