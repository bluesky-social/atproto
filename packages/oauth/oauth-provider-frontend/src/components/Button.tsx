import React from 'react'
import { clsx } from 'clsx'

export function Button({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode
}) {
  return (
    <button
      {...rest}
      className={clsx([
        'px-4 py-2 rounded-md bg-contrast-500 text-white text-sm font-bold',
        'hover:bg-contrast-600',
        'focus:outline-none focus-visible:ring focus-visible:ring-contrast-500',
      ])}
    >
      {children}
    </button>
  )
}
