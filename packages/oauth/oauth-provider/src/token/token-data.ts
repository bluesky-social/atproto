import {
  OAuthAuthenticationRequestParameters,
  OAuthAuthorizationDetails,
} from '@atproto/oauth-types'

import { ClientAuth } from '../client/client-auth.js'
import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { Code } from '../request/code.js'

export type {
  ClientAuth,
  ClientId,
  Code,
  DeviceId,
  OAuthAuthenticationRequestParameters,
  OAuthAuthorizationDetails,
  Sub,
}

export type TokenData = {
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
  clientId: ClientId
  clientAuth: ClientAuth
  deviceId: DeviceId | null
  sub: Sub
  parameters: OAuthAuthenticationRequestParameters
  details: OAuthAuthorizationDetails | null
  code: Code | null
}
