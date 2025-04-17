import { useHydrationData } from './useHydrationData'

export function useCustomizationData() {
  return useHydrationData('__customizationData')
}
