import React from 'react'

export function Label({
  children,
  name,
}: {
  children: React.ReactNode
  name: string
}) {
  return (
    <label htmlFor={name} className="block text-sm font-medium text-text-light">
      {children}
    </label>
  )
}
