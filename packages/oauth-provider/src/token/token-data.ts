import { OAuthClientId } from '@atproto/oauth-client-metadata'

import { ClientAuth } from '../client/client-auth.js'
import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { AuthorizationDetails } from '../parameters/authorization-details.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { Code } from '../request/code.js'

export type {
  AuthorizationDetails,
  AuthorizationParameters,
  ClientAuth,
  Code,
  DeviceId,
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
  parameters: AuthorizationParameters
  details: AuthorizationDetails | null
  code: Code | null
}
