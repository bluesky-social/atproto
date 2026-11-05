import type { DidString, SpaceRefString } from '@atproto/syntax'

export interface SpaceNotificationRetry {
  repo: DidString
  space: SpaceRefString
  repoRev: string
  data: Uint8Array
  attempts: number
  retryAt: number
  expiresAt: number
}

export interface SpaceStatusNotificationRetry {
  space: SpaceRefString
  service: string
  attempts: number
  retryAt: number
  expiresAt: number
}

export interface SpaceNotificationLease {
  id: number
  owner: string
  expiresAt: number
}

export type PartialDB = {
  space_notification_retry: SpaceNotificationRetry
  space_status_notification_retry: SpaceStatusNotificationRetry
  space_notification_lease: SpaceNotificationLease
}
