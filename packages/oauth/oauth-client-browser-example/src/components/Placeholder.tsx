import type { JSX } from 'react'

export type PlaceholderProps = JSX.IntrinsicElements['span']
export function Placeholder({ className = '', ...props }: PlaceholderProps) {
  return (
    <span
      className={`inline-block animate-pulse bg-gray-300 dark:bg-gray-700 ${className}`}
      {...props}
    />
  )
}
