export interface User {
  did: string
  username: string
  email: string
  password: string
  lastSeenNotifs: string
  createdAt: string
}

export const tableName = 'user'

export type PartialDB = { [tableName]: User }
