export interface UserAccount {
  did: string
  email: string
  passwordScrypt: string
  createdAt: string
  passwordResetToken: string | null
  passwordResetGrantedAt: string | null
}

export const tableName = 'user_account'

export type PartialDB = { [tableName]: UserAccount }
