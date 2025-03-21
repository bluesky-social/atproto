import React from 'react'
import clsx from 'clsx'

export function Label({
  children,
  name,
  hidden,
}: {
  children: React.ReactNode
  name: string
  hidden?: boolean
}) {
  return (
    <label
      htmlFor={name}
      className={clsx([
        'block text-sm font-medium text-text-light',
        hidden && 'sr-only',
      ])}
    >
      {children}
    </label>
  )
}
