export interface RefreshToken {
  id: string
  did: string
  expiresAt: string
  appPasswordName: string | null
  nextId: string | null
  loginJid: string | null
}

export const tableName = 'refresh_token'

export type PartialDB = { [tableName]: RefreshToken }
