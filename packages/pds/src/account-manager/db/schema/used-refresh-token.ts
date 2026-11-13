import type { Selectable } from 'kysely'
import type { RefreshToken } from '@atproto/oauth-provider/store'

export interface UsedRefreshToken {
  tokenId: number
  refreshToken: RefreshToken
}

export type UsedRefreshTokenEntry = Selectable<UsedRefreshToken>

export const tableName = 'used_refresh_token'

export type PartialDB = { [tableName]: UsedRefreshToken }
