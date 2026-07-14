import type { Selectable } from 'kysely'
import type {
  ClientAuth,
  ClientAuthLegacy,
  ClientId,
  Code,
  DeviceId,
  Did,
  OAuthAuthorizationRequestParameters,
  RequestId,
} from '@atproto/oauth-provider/store'
import type { DateISO, JsonEncoded } from '../../../db/index.js'

export interface AuthorizationRequest {
  id: RequestId
  did: Did | null
  deviceId: DeviceId | null

  clientId: ClientId
  clientAuth: JsonEncoded<null | ClientAuth | ClientAuthLegacy>
  parameters: JsonEncoded<OAuthAuthorizationRequestParameters>
  expiresAt: DateISO
  code: Code | null
}

export type AuthorizationRequestEntry = Selectable<AuthorizationRequest>

export const tableName = 'authorization_request'

export type PartialDB = { [tableName]: AuthorizationRequest }
