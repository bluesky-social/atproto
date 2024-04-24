import {
  OAuthAuthenticationRequestParameters,
  OAuthAuthorizationDetails,
  OAuthClientId,
} from '@atproto/oauth-types'

import { ClientAuth } from '../client/client-auth.js'
import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { Code } from '../request/code.js'

export type {
  ClientAuth,
  Code,
  DeviceId,
  OAuthAuthenticationRequestParameters,
  OAuthAuthorizationDetails,
  OAuthClientId,
  Sub,
}

export type TokenData = {
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
  clientId: OAuthClientId
  clientAuth: ClientAuth
  deviceId: DeviceId | null
  sub: Sub
  parameters: OAuthAuthenticationRequestParameters
  details: OAuthAuthorizationDetails | null
  code: Code | null
}
