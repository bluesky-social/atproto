import { Did } from '@atproto/did'
import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { ClientAuth, ClientAuthLegacy } from '../client/client-auth.js'
import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { NonNullableKeys } from '../lib/util/type.js'
import { Code } from './code.js'

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
