import { ReactNode } from 'react'

export function Fieldset({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="hidden">{label}</legend>
      {children}
    </fieldset>
  )
}
