import { RefreshToken } from '@atproto/oauth-provider'
import { Selectable } from 'kysely'

export interface UsedRefreshToken {
  tokenId: number
  refreshToken: RefreshToken
}

export type UsedRefreshTokenEntry = Selectable<UsedRefreshToken>

export const tableName = 'used_refresh_token'

export type PartialDB = { [tableName]: UsedRefreshToken }
