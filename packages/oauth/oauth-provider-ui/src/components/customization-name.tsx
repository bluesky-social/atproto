import { ReactNode } from 'react'
import { JSX } from 'react/jsx-runtime'
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
      <b>{name}</b>
    </span>
  )
}
