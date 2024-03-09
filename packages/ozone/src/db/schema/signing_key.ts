import { Generated } from 'kysely'

export const tableName = 'signing_key'

export interface SigningKey {
  id: Generated<number>
  key: string
}

export type PartialDB = { [tableName]: SigningKey }
