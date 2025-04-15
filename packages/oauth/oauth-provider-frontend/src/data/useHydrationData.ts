import type { HydrationData } from '../hydration-data.d.ts'

const hydrationData = window as typeof window & HydrationData['account-page']

export function useHydrationData<T extends keyof HydrationData['account-page']>(
  key: T,
): HydrationData['account-page'][T] {
  return hydrationData[key]
}
