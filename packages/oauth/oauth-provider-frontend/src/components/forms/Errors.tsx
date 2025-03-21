import React from 'react'

export function Errors({ children }: { children: React.ReactNode }) {
  return (
    <ul className="space-y-1 px-2 py-1 bg-error-100 dark:bg-error-800 rounded-md">
      {children}
    </ul>
  )
}

export function Error({ children }: { children: React.ReactNode }) {
  return (
    <li className="space-y-1 text-sm text-error-900 dark:text-error-25">
      {children}
    </li>
  )
}
