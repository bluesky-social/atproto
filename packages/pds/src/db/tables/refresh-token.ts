export interface RefreshToken {
  id: string
  did: string
  expiresAt: string
}

export const tableName = 'refresh_token'

export type PartialDB = { [tableName]: RefreshToken }
