import { Generated, Selectable } from 'kysely'

export interface UserAccount {
  did: string
  email: string
  passwordScrypt: string
  createdAt: string
  activatedAt: string | null
  emailConfirmedAt: string | null
  invitesDisabled: Generated<0 | 1>
  inviteNote: string | null
  pdsId: number | null
  takedownRef: string | null
}

export type UserAccountEntry = Selectable<UserAccount>

export const tableName = 'user_account'

export type PartialDB = { [tableName]: UserAccount }