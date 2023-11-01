import { Generated, Selectable } from 'kysely'

export interface Account {
  did: string
  email: string
  passwordScrypt: string
  emailConfirmedAt: string | null
  invitesDisabled: Generated<0 | 1>
}

export type AccountEntry = Selectable<Account>

export const tableName = 'account'

export type PartialDB = { [tableName]: Account }
