import type { SpaceRefString } from '@atproto/syntax'

// Identified by its endpoint and token together.
export interface SpaceNotifyRegistration {
  space: SpaceRefString
  endpoint: string
  token: string
  // When the credential that last renewed the registration expires.
  expiresAt: string
  // Whether the lapsed registration has been sent its expiry notice. After that,
  // it is sent nothing but a deletion notice until it's renewed.
  expiryNotified: 0 | 1
}

const tableName = 'space_notify_registration'

export type PartialDB = { [tableName]: SpaceNotifyRegistration }
