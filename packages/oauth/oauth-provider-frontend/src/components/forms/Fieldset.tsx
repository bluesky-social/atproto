import React from 'react'

export function Fieldset({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="hidden">{label}</legend>
      {children}
    </fieldset>
  )
}
