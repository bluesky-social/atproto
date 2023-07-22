import { Generated, Selectable } from 'kysely'

export interface UserAccount {
  did: string
  email: string
  passwordScrypt: string
  createdAt: string
  passwordResetToken: string | null
  passwordResetGrantedAt: string | null
  invitesDisabled: Generated<0 | 1>
  signupIpAddr: string | null
  loginAttemptAt: string | null
  loginAttemptCount: Generated<number>
}

export type UserAccountEntry = Selectable<UserAccount>

export const tableName = 'user_account'

export type PartialDB = { [tableName]: UserAccount }
