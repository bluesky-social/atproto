import { Selectable } from 'kysely'
import {
  ClientAuth,
  Code,
  DeviceId,
  OAuthAuthorizationRequestParameters,
  OAuthClientId,
  RequestId,
} from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db'

export interface AuthorizationRequest {
  id: RequestId
  did: string | null
  deviceId: DeviceId | null

  clientId: OAuthClientId
  clientAuth: JsonEncoded<ClientAuth>
  parameters: JsonEncoded<OAuthAuthorizationRequestParameters>
  expiresAt: DateISO
  code: Code | null
}

export type AuthorizationRequestEntry = Selectable<AuthorizationRequest>

export const tableName = 'authorization_request'

export type PartialDB = { [tableName]: AuthorizationRequest }
