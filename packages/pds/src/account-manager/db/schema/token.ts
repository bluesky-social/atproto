import {
  ClientId,
  Code,
  DeviceId,
  RefreshToken,
  Sub,
  TokenId,
} from '@atproto/oauth-provider'
import { Generated, Selectable } from 'kysely'

import { DateISO, JsonArray, JsonObject } from '../../../db/cast.js'

export interface Token {
  id: Generated<number>
  did: Sub

  tokenId: TokenId
  createdAt: DateISO
  updatedAt: DateISO
  expiresAt: DateISO
  clientId: ClientId
  clientAuth: JsonObject
  deviceId: DeviceId | null
  parameters: JsonObject
  details: JsonArray | null
  code: Code | null
  currentRefreshToken: RefreshToken | null // TODO: Index this
}

export type TokenEntry = Selectable<Token>

export const tableName = 'token'

export type PartialDB = { [tableName]: Token }
