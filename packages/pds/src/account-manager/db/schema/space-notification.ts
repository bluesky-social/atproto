import type { DidString, SpaceRefString } from '@atproto/lex'

export interface SpaceNotificationRetry {
  repo: DidString
  space: SpaceRefString
  repoRev: string
  hash: Uint8Array
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
  space_notification_lease: SpaceNotificationLease
}
