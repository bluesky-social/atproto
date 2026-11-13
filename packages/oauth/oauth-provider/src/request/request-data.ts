import type { Did } from '@atproto/did'
import type { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import type { ClientAuth, ClientAuthLegacy } from '../client/client-auth.js'
import type { ClientId } from '../client/client-id.js'
import type { DeviceId } from '../device/device-id.js'
import type { NonNullableKeys } from '../lib/util/type.js'
import type { Code } from './code.js'

export type {
  ClientAuth,
  ClientAuthLegacy,
  ClientId,
  Code,
  DeviceId,
  Did,
  OAuthAuthorizationRequestParameters,
}

export type RequestData = {
  clientId: ClientId
  clientAuth: null | ClientAuth | ClientAuthLegacy
  parameters: Readonly<OAuthAuthorizationRequestParameters>
  expiresAt: Date
  deviceId: DeviceId | null
  did: Did | null
  code: Code | null
}

export type RequestDataAuthorized = NonNullableKeys<
  RequestData,
  'did' | 'deviceId'
>

export const isRequestDataAuthorized = (
  data: RequestData,
): data is RequestDataAuthorized => data.did !== null && data.deviceId !== null
