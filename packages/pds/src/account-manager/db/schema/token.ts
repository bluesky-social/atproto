import { Generated, Selectable } from 'kysely'
import {
  ClientAuth,
  ClientAuthLegacy,
  Code,
  DeviceId,
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
  OAuthClientId,
  RefreshToken,
  Sub,
  TokenId,
} from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db/cast'

export interface Token {
  id: Generated<number>
  did: Sub

  tokenId: TokenId
  createdAt: DateISO
  updatedAt: DateISO
  expiresAt: DateISO
  clientId: OAuthClientId
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
