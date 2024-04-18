import { RefreshToken } from '@atproto-labs/oauth-provider'
import { Selectable } from 'kysely'

export interface UsedRefreshToken {
  id: number // TODO: Index this (foreign key to token)
  usedRefreshToken: RefreshToken
}

export type UsedRefreshTokenEntry = Selectable<UsedRefreshToken>

export const tableName = 'used_refresh_token'

export type PartialDB = { [tableName]: UsedRefreshToken }
