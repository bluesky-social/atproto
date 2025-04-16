import { StandardSchemaV1Issue } from '@tanstack/react-form'
import { ReactNode } from 'react'

export function Errors({
  errors,
}: {
  errors: (StandardSchemaV1Issue | undefined)[]
}) {
  if (errors.length === 0) return null
  return (
    <ul className="space-y-1">
      {(errors.filter(Boolean) as StandardSchemaV1Issue[]).map((error, i) => (
        <Error key={i}>{error.message}</Error>
      ))}
    </ul>
  )
}

export function Error({ children }: { children: ReactNode }) {
  return (
    <li className="text-error-900 dark:text-error-25 bg-error-100 dark:bg-error-800 space-y-1 rounded-md px-2 py-1 text-sm">
      {children}
    </li>
  )
}
