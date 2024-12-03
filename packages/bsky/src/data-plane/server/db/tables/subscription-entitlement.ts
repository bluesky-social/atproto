import { ColumnType } from 'kysely'

export const tableName = 'subscription_entitlement'

export interface SubscriptionEntitlement {
  did: string
  // https://github.com/kysely-org/kysely/issues/137
  entitlements: ColumnType<string[], string, string>
  createdAt: string
  updatedAt: string
}

export type PartialDB = { [tableName]: SubscriptionEntitlement }
