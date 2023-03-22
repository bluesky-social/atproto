export interface RefreshToken {
  id: string
  did: string
  expiresAt: string
  nextId: string | null
}

export const tableName = 'refresh_token'

export type PartialDB = { [tableName]: RefreshToken }
