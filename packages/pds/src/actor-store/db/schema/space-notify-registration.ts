import type { SpaceRefString } from '@atproto/syntax'

// Identified by its endpoint and token together.
export interface SpaceNotifyRegistration {
  space: SpaceRefString
  endpoint: string
  token: string
  // When the credential that last renewed the registration expires. A lapsed
  // registration is kept until one more notification is delivered, for up to a
  // day.
  expiresAt: string
}

const tableName = 'space_notify_registration'

export type PartialDB = { [tableName]: SpaceNotifyRegistration }
