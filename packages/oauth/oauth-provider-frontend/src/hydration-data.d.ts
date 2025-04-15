import {
  ActiveDeviceSession,
  CustomizationData,
} from '@atproto/oauth-provider-api'

export type HydrationData = {
  'account-page': {
    /**
     * needed by `useCustomizationData.ts`
     */
    __customizationData: CustomizationData
    /**
     * needed by `useDeviceSessionsQuery.ts`
     */
    __deviceSessions: readonly ActiveDeviceSession[]
  }
}
