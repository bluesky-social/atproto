import { Selectable } from 'kysely'
import {
  Code,
  DeviceId,
  OAuthClientId,
  RequestId,
} from '@atproto/oauth-provider'
import { DateISO, JsonObject } from '../../../db'

export interface AuthorizationRequest {
  id: RequestId
  did: string | null
  deviceId: DeviceId | null

  clientId: OAuthClientId
  clientAuth: JsonObject
  parameters: JsonObject
  expiresAt: DateISO
  code: Code | null
}

export type AuthorizationRequestEntry = Selectable<AuthorizationRequest>

export const tableName = 'authorization_request'

export type PartialDB = { [tableName]: AuthorizationRequest }
