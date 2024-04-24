import {
  OAuthAuthenticationRequestParameters,
  OAuthClientId,
} from '@atproto/oauth-types'

import { ClientAuth } from '../client/client-auth.js'
import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { Code } from './code.js'

export type RequestData = {
  clientId: OAuthClientId
  clientAuth: ClientAuth
  parameters: OAuthAuthenticationRequestParameters
  expiresAt: Date
  deviceId: DeviceId | null
  sub: Sub | null
  code: Code | null
}
