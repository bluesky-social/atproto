import { useHydrationData } from './useHydrationData'

export function useCustomizationData() {
  const { customizationData } = useHydrationData()
  return customizationData
}
