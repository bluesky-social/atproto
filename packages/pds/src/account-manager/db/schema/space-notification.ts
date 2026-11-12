import type { DidString, SpaceRefString } from '@atproto/syntax'
import type { JsonEncoded } from '../../../db/index.js'
import type { SyncerNotice } from '../../../space-notifications.js'

export interface SpaceNotificationRetry {
  repo: DidString
  space: SpaceRefString
  repoRev: string
  data: Uint8Array
  attempts: number
  retryAt: number
  expiresAt: number
}

// At most one pending notice per registration.
export interface SpaceSyncerNotificationRetry {
  space: SpaceRefString
  endpoint: string
  token: string
  noticeJson: JsonEncoded<SyncerNotice>
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
  space_syncer_notification_retry: SpaceSyncerNotificationRetry
  space_notification_lease: SpaceNotificationLease
}
