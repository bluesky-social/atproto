import type { Generated, Selectable } from 'kysely'
import type {
  ClientAuth,
  ClientAuthLegacy,
  ClientId,
  Code,
  DeviceId,
  Did,
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
  RefreshToken,
  TokenId,
} from '@atproto/oauth-provider/store'
import type { DateISO, JsonEncoded } from '../../../db/cast.js'

export interface Token {
  id: Generated<number>
  did: Did

  tokenId: TokenId
  createdAt: DateISO
  updatedAt: DateISO
  expiresAt: DateISO
  clientId: ClientId
  clientAuth: JsonEncoded<ClientAuth | ClientAuthLegacy>
  deviceId: DeviceId | null
  parameters: JsonEncoded<OAuthAuthorizationRequestParameters>
  details: JsonEncoded<OAuthAuthorizationDetails> | null
  code: Code | null
  currentRefreshToken: RefreshToken | null
  scope: string | null
}

export type TokenEntry = Selectable<Token>

export const tableName = 'token'

export type PartialDB = { [tableName]: Token }
