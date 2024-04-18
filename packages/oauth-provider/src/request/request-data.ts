import { OAuthClientId } from '@atproto-labs/oauth-client-metadata'

import { ClientAuth } from '../client/client-auth.js'
import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { Code } from './code.js'

export type RequestData = {
  clientId: OAuthClientId
  clientAuth: ClientAuth
  parameters: AuthorizationParameters
  expiresAt: Date
  deviceId: DeviceId | null
  sub: Sub | null
  code: Code | null
}
