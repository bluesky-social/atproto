import {
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
} from '@atproto/oauth-types'
import { ClientAuth, ClientAuthLegacy } from '../client/client-auth.js'
import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { Code } from '../request/code.js'

export type {
  ClientAuth,
  ClientId,
  Code,
  DeviceId,
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
  Sub,
}

export type TokenData = {
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
  clientId: ClientId
  clientAuth: ClientAuth | ClientAuthLegacy
  deviceId: DeviceId | null
  sub: Sub
  parameters: OAuthAuthorizationRequestParameters
  details?: null // Legacy field, not used
  code: Code | null

  /**
   * This will contain the parameter scope, translated into permissions
   *
   * @note null because this didn't use to exist. New tokens should always
   * include a scope.
   */
  scope: string | null
}
