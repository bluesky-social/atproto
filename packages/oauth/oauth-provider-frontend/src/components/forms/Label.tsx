import { clsx } from 'clsx'
import { ReactNode } from 'react'

export function Label({
  children,
  name,
  hidden,
}: {
  children: ReactNode
  name: string
  hidden?: boolean
}) {
  return (
    <label
      htmlFor={`field-${name}`}
      className={clsx([
        'text-text-light block text-sm font-medium',
        hidden && 'sr-only',
      ])}
    >
      {children}
    </label>
  )
}
