import { ReactNode, createContext, useContext } from 'react'
import type { CustomizationData } from '@atproto/oauth-provider-api'

const CustomizationContext = createContext<CustomizationData>({})
CustomizationContext.displayName = 'CustomizationContext'

export function CustomizationProvider({
  children,
  value,
}: {
  children: ReactNode
  value: CustomizationData
}) {
  return <CustomizationContext value={value}>{children}</CustomizationContext>
}

export function useCustomizationData() {
  return useContext(CustomizationContext)
}
