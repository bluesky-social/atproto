import type { ReactNode } from 'react'
import type { JSX } from 'react/jsx-runtime'
import { useCustomizationData } from '#/contexts/customization.tsx'

export function CustomizationName(
  props: JSX.IntrinsicElements['span'],
): ReactNode {
  const { name, logo } = useCustomizationData()

  return (
    <span {...props}>
      {logo && (
        <img
          src={logo}
          alt={name}
          className="not-prose mr-1 inline-block h-[1em] select-none object-contain align-baseline"
        />
      )}
      {/* @NOTE Carries its own colour so the operator's name reads the same
        wherever it lands — muted body copy on the home page, prose on the
        about page. */}
      <b className="text-foreground">{name}</b>
    </span>
  )
}
