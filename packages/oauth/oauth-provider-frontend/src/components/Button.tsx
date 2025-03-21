import React from 'react'
import { clsx } from 'clsx'

export function Button({
  children,
  color = 'primary',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode
  color?: 'primary' | 'secondary'
}) {
  return (
    <button
      {...rest}
      aria-disabled={rest.disabled ? 'true' : 'false'}
      className={clsx([
        'w-full px-6 py-3 rounded-md text-md font-medium',
        color === 'primary' && [
          rest.disabled
            ? ['bg-primary-400 text-primary-100', 'cursor-not-allowed']
            : [
                'bg-primary-500 text-white',
                'hover:bg-primary-600 focus:bg-primary-600',
                'focus:outline-none focus:shadow-sm focus:shadow-primary-700/30',
              ],
        ],
      ])}
    >
      {children}
    </button>
  )
}
