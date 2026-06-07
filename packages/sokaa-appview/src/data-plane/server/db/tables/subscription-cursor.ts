export const tableName = 'subscription_cursor'

export interface SubscriptionCursor {
  id: number
  lastSeq: number
  updatedAt: string
}

export type PartialDB = { [tableName]: SubscriptionCursor }
