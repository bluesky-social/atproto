import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'

import { ClientAuth } from '../client/client-auth.js'
import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { Code } from './code.js'

export type RequestData = {
  clientId: ClientId
  clientAuth: ClientAuth
  parameters: Readonly<OAuthAuthorizationRequestParameters>
  expiresAt: Date
  deviceId: DeviceId | null
  sub: Sub | null
  code: Code | null
}

export type RequestDataAuthorized = RequestData & {
  sub: Sub
  deviceId: DeviceId
}

export const isRequestDataAuthorized = (
  data: RequestData,
): data is RequestDataAuthorized => data.sub !== null && data.deviceId !== null
