import type { Generated, Selectable } from 'kysely'
import type { DatetimeString } from '@atproto/lex'

export interface Account {
  did: string
  email: string
  passwordScrypt: string
  emailConfirmedAt: DatetimeString | null
  invitesDisabled: Generated<0 | 1>
}

export type AccountEntry = Selectable<Account>

export const tableName = 'account'

export type PartialDB = { [tableName]: Account }
