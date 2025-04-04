import {
  ActiveDeviceSession,
  CustomizationData,
} from '@atproto/oauth-provider-api'

export type HydrationData = {
  customizationData: CustomizationData
  sessions: ActiveDeviceSession[]
}

export const hydrationData = window['__hydrationData'] as HydrationData

export function useHydrationData() {
  return hydrationData
}
