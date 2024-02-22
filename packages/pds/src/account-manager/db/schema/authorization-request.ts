import { ClientId, Code, DeviceId, RequestId } from '@atproto/oauth-provider'
import { Selectable } from 'kysely'
import { DateISO, JsonObject } from '../../../db'

export interface AuthorizationRequest {
  id: RequestId
  did: string | null
  deviceId: DeviceId | null

  clientId: ClientId
  clientAuth: JsonObject
  parameters: JsonObject
  expiresAt: DateISO // TODO: Index this
  code: Code | null
}

export type AuthorizationRequestEntry = Selectable<AuthorizationRequest>

export const tableName = 'authorization_request'

export type PartialDB = { [tableName]: AuthorizationRequest }
