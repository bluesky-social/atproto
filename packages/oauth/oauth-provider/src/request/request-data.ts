import { OAuthAuthenticationRequestParameters } from '@atproto/oauth-types'

import { ClientAuth } from '../client/client-auth.js'
import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { Code } from './code.js'

export type RequestData = {
  clientId: ClientId
  clientAuth: ClientAuth
  parameters: OAuthAuthenticationRequestParameters
  expiresAt: Date
  deviceId: DeviceId | null
  sub: Sub | null
  code: Code | null
}
