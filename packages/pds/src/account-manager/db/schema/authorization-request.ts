import { Selectable } from 'kysely'
import {
  ClientAuth,
  ClientAuthLegacy,
  Code,
  DeviceId,
  Did,
  OAuthAuthorizationRequestParameters,
  OAuthClientId,
  RequestId,
} from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db/index.js'

export interface AuthorizationRequest {
  id: RequestId
  did: Did | null
  deviceId: DeviceId | null

  clientId: OAuthClientId
  clientAuth: JsonEncoded<null | ClientAuth | ClientAuthLegacy>
  parameters: JsonEncoded<OAuthAuthorizationRequestParameters>
  expiresAt: DateISO
  code: Code | null
}

export type AuthorizationRequestEntry = Selectable<AuthorizationRequest>

export const tableName = 'authorization_request'

export type PartialDB = { [tableName]: AuthorizationRequest }
