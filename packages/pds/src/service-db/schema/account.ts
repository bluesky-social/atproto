import { Generated, Selectable } from 'kysely'

export interface Account {
  did: string
  handle: string | null
  email: string
  passwordScrypt: string
  createdAt: string
  emailConfirmedAt: string | null
  invitesDisabled: Generated<0 | 1>
  inviteNote: string | null
  takedownId: string | null
}

export type AccountEntry = Selectable<Account>

export const tableName = 'account'

export type PartialDB = { [tableName]: Account }
