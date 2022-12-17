export interface User {
  handle: string
  email: string
  password: string
  lastSeenNotifs: string
  createdAt: string
  passwordResetToken: string | null
  passwordResetGrantedAt: string | null
}

export const tableName = 'user'

export type PartialDB = { [tableName]: User }
